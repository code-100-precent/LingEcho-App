package voicev2

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/code-100-precent/LingEcho/pkg/recognizer"
	"github.com/gorilla/websocket"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// VoiceWebSocketHandler WebSocket语音处理器
type VoiceWebSocketHandler struct {
	clients            map[*websocket.Conn]*VoiceClient // 保存所有客户端
	mu                 sync.RWMutex                     // 读写锁
	serviceInitializer *ServiceInitializer              // 服务初始化器
	messageHandler     *MessageHandler                  // 消息处理器
	asrResultHandler   *ASRResultHandler                // ASR结果处理器
	textProcessor      *TextProcessor                   // 文本处理器
	logger             *zap.Logger                      // 全局logger
}

// NewVoiceWebSocketHandler 创建新的WebSocket语音处理器
func NewVoiceWebSocketHandler() *VoiceWebSocketHandler {
	// 使用zap的全局logger，如果没有初始化则使用默认的production logger
	log := zap.L()
	if log == nil {
		log, _ = zap.NewProduction()
	}
	return &VoiceWebSocketHandler{
		clients:            make(map[*websocket.Conn]*VoiceClient),
		serviceInitializer: NewServiceInitializer(),
		messageHandler:     NewMessageHandler(log),
		asrResultHandler:   NewASRResultHandler(log),
		textProcessor:      NewTextProcessor(log),
		logger:             log,
	}
}

// HandleWebSocket 处理WebSocket连接
// ctx: 应该从 gin 的 c.Request.Context() 传入，以便继承请求的取消信号
func (h *VoiceWebSocketHandler) HandleWebSocket(
	ctx context.Context,
	conn *websocket.Conn,
	credential *models.UserCredential,
	assistantID int,
	language, speaker string,
	temperature float64,
	systemPrompt string,
	knowledgeKey string,
	db *gorm.DB,
) {
	defer conn.Close()

	// 使用传入的 context，不再创建新的 context
	// 这样可以继承 gin 请求的取消信号，当请求被取消时，所有 goroutine 都能感知
	writer := NewMessageWriter(conn)

	// Query LLM model, temperature, and maxTokens from assistant (only once, cached in client)
	llmModel := DefaultLLMModel
	assistantTemperature := 0.6 // 默认值
	assistantMaxTokens := 0     // 0 表示不限制
	if assistantID > 0 && db != nil {
		var assistant models.Assistant
		if err := db.First(&assistant, assistantID).Error; err == nil {
			if assistant.LLMModel != "" {
				llmModel = assistant.LLMModel
			}
			if assistant.Temperature > 0 {
				assistantTemperature = float64(assistant.Temperature)
			}
			if assistant.MaxTokens > 0 {
				assistantMaxTokens = assistant.MaxTokens
			}
		}
	}
	// 如果temperature为0或未设置，使用assistant的temperature
	if temperature <= 0 {
		temperature = assistantTemperature
	}

	client := &VoiceClient{
		conn:         conn,
		credential:   credential,
		assistantID:  assistantID,
		language:     language,
		speaker:      speaker,
		temperature:  assistantTemperature,
		maxTokens:    assistantMaxTokens,
		systemPrompt: systemPrompt,
		state:        NewClientState(),
		ctx:          ctx,
		cancel:       func() {}, // 不再需要 cancel，使用传入的 context
		isActive:     0,         // 使用原子操作，0=false
		writer:       writer,
		// Knowledge base support
		knowledgeKey: knowledgeKey,
		db:           db,
		// LLM model (cached from assistant)
		llmModel: llmModel,
	}

	// 初始化服务
	if err := h.initializeServices(client); err != nil {
		// 检查是否是致命错误（额度不足等）
		if isFatalError(err) {
			HandleFatalError(client, err, "服务初始化", writer, h.logger)
		} else {
			h.logger.Error("初始化服务失败", zap.Error(err))
			writer.SendError(fmt.Sprintf("初始化服务失败: %v", err), true)
		}
		return
	}

	// 保存客户端
	h.mu.Lock()
	h.clients[conn] = client
	h.mu.Unlock()

	// 初始化ASR服务连接
	h.setupASRConnection(client)

	// 启动TTS队列处理goroutine
	h.startTTSQueueProcessor(client)

	// 等待ASR连接建立
	time.Sleep(DefaultASRConnectionDelay)

	// 发送连接成功消息
	if err := writer.SendConnected(); err != nil {
		h.logger.Error("发送连接成功消息失败", zap.Error(err))
		return
	}

	// 处理WebSocket消息循环
	h.handleMessageLoop(client)

	// 清理客户端
	h.mu.Lock()
	delete(h.clients, conn)
	h.mu.Unlock()

	// 清理资源
	h.cleanupClient(client)
	// 注意：不再需要调用 cancel()，因为使用的是传入的 context
}

// initializeServices 初始化所有服务
func (h *VoiceWebSocketHandler) initializeServices(client *VoiceClient) error {
	factory := transcribers.GetGlobalFactory()

	// 初始化ASR服务
	asrService, err := h.serviceInitializer.InitializeASR(client.credential, client.language, factory)
	if err != nil {
		return fmt.Errorf("初始化ASR服务失败: %w", err)
	}
	client.asrService = asrService
	client.SetActive(true)

	// 初始化TTS服务
	ttsService, err := h.serviceInitializer.InitializeTTS(client.credential, client.speaker)
	if err != nil {
		return fmt.Errorf("初始化TTS服务失败: %w", err)
	}
	client.ttsService = ttsService

	// 初始化LLM
	llmProvider, err := InitializeLLM(client.ctx, client.credential, client.systemPrompt)
	if err != nil {
		return fmt.Errorf("初始化LLM服务失败: %w", err)
	}
	client.llmHandler = llmProvider

	return nil
}

// setupASRConnection 设置ASR连接
func (h *VoiceWebSocketHandler) setupASRConnection(client *VoiceClient) {
	client.asrService.Init(
		func(text string, isLast bool, duration time.Duration, uuid string) {
			// 记录ASR使用量（当识别完成时）
			if isLast && client.db != nil && client.credential != nil && duration > 0 {
				go func() {
					// 估算音频大小（假设16kHz, 16bit, 单声道，约32KB/秒）
					audioSize := int64(duration.Seconds() * 32000)

					assistantID := (*uint)(nil)
					if client.assistantID > 0 {
						aid := uint(client.assistantID)
						assistantID = &aid
					}

					if err := models.RecordASRUsage(
						client.db,
						client.credential.UserID,
						client.credential.ID,
						assistantID,
						uuid,
						int(duration.Seconds()),
						audioSize,
					); err != nil {
						h.logger.Warn("记录ASR使用量失败", zap.Error(err))
					}
				}()
			}

			h.asrResultHandler.HandleResult(client, text, isLast, client.writer, h.textProcessor)
		},
		func(err error, isFatal bool) {
			HandleASRError(client, err, isFatal, client.writer, h.logger)
		},
	)

	// 启动ASR接收（在goroutine中，因为ConnAndReceive可能会阻塞）
	// 使用重试循环，在连接断开时自动重连
	go func() {
		defer func() {
			if r := recover(); r != nil {
				h.logger.Error("ASR连接异常", zap.Any("panic", r))
				client.SetActive(false)
			}
		}()

		retryCount := 0
		maxRetries := 10 // 最大重试次数，避免无限重连
		retryDelay := 2 * time.Second

		for {
			// 检查上下文是否已取消
			select {
			case <-client.ctx.Done():
				h.logger.Info("ASR连接goroutine退出（上下文已取消）")
				return
			default:
			}

			// 尝试连接
			err := client.asrService.ConnAndReceive("")
			if err != nil {
				// 检查是否是致命错误（额度不足等）
				if isFatalError(err) {
					h.logger.Error("ASR连接致命错误，停止重连", zap.Error(err))
					HandleFatalError(client, err, "ASR连接", client.writer, h.logger)
					return // 致命错误，不重连
				}

				retryCount++
				if retryCount > maxRetries {
					h.logger.Error("ASR连接重试次数超限，停止重连",
						zap.Int("retryCount", retryCount),
						zap.Error(err))
					client.SetActive(false)
					client.writer.SendError(fmt.Sprintf("ASR连接失败，已重试%d次: %v", maxRetries, err), true)
					return
				}

				h.logger.Warn("ASR连接失败，准备重连",
					zap.Int("retryCount", retryCount),
					zap.Int("maxRetries", maxRetries),
					zap.Error(err))
				client.SetActive(false)

				// 等待一段时间后重连（避免频繁重连）
				select {
				case <-client.ctx.Done():
					return
				case <-time.After(retryDelay):
					// 继续重连
				}
			} else {
				// ConnAndReceive 返回 nil，说明连接成功建立
				// 接收循环在后台运行，ConnAndReceive 已经返回
				h.logger.Info("ASR连接成功建立", zap.Int("retryCount", retryCount))
				client.SetActive(true)
				retryCount = 0 // 重置重试计数

				// 等待连接断开（通过定期检查 Activity() 或错误回调）
				// 使用 ticker 定期检查连接状态
				ticker := time.NewTicker(5 * time.Second)
				defer ticker.Stop() // 确保 ticker 总是被停止，避免资源泄漏
				for {
					select {
					case <-client.ctx.Done():
						return
					case <-ticker.C:
						// 定期检查连接状态
						if !client.asrService.Activity() {
							h.logger.Warn("检测到ASR连接已断开，准备重连")
							client.SetActive(false)
							// 跳出内层循环，继续外层重连循环
							goto reconnect
						}
					}
				}
			reconnect:
				// 连接断开，继续重连循环
			}
		}
	}()
}

// handleMessageLoop 处理WebSocket消息循环（优化版本：合并消息处理 goroutine）
func (h *VoiceWebSocketHandler) handleMessageLoop(client *VoiceClient) {
	queue := NewMessageQueue()
	defer close(queue.stopChan)

	// 合并音频和文本消息处理到一个 goroutine，减少 goroutine 数量
	go func() {
		for {
			select {
			case message := <-queue.audioChan:
				h.handleAudioMessage(client, message)
			case message := <-queue.textChan:
				h.handleTextMessage(client, message)
			case <-client.ctx.Done():
				return
			}
		}
	}()

	// 主循环只负责接收消息并分发到队列
	for {
		// 检查上下文是否已取消
		select {
		case <-client.ctx.Done():
			h.logger.Debug("WebSocket消息循环退出（上下文已取消）")
			return
		default:
		}

		messageType, message, err := client.conn.ReadMessage()
		if err != nil {
			h.logger.Debug("读取WebSocket消息失败", zap.Error(err))
			break
		}

		// 将消息分发到对应的channel（非阻塞）
		switch messageType {
		case websocket.BinaryMessage:
			select {
			case queue.audioChan <- message:
				// 成功入队
			case <-client.ctx.Done():
				return
			default:
				// 队列满时记录警告，但不阻塞
				h.logger.Warn("音频消息队列已满，丢弃消息", zap.Int("size", len(message)))
			}
		case websocket.TextMessage:
			select {
			case queue.textChan <- message:
				// 成功入队
			case <-client.ctx.Done():
				return
			default:
				// 队列满时记录警告，但不阻塞
				h.logger.Warn("文本消息队列已满，丢弃消息", zap.Int("size", len(message)))
			}
		}
	}
}

// 注意：processAudioMessages 和 processTextMessages 已合并到 handleMessageLoop 中
// 这两个函数已删除，以减少 goroutine 数量

// handleAudioMessage 处理音频消息
func (h *VoiceWebSocketHandler) handleAudioMessage(client *VoiceClient, message []byte) {
	// 检查是否正在处理致命错误
	if client.state != nil && client.state.IsFatalError() {
		h.logger.Debug("正在处理致命错误，忽略音频数据", zap.Int("dataSize", len(message)))
		return
	}

	if !client.GetActive() || client.asrService == nil {
		return
	}

	// 如果TTS正在播放，不处理音频数据（防止TTS音频被识别）
	if client.state.IsTTSPlaying() {
		h.logger.Debug("TTS正在播放，忽略音频数据", zap.Int("dataSize", len(message)))
		return
	}

	if err := client.asrService.SendAudioBytes(message); err != nil {
		// 如果是 "recognizer not running" 错误，尝试重启ASR服务
		errMsg := err.Error()
		if errMsg == "recognizer not running" ||
			errMsg == "recognizer is not running" ||
			strings.Contains(errMsg, "not running") {
			h.logger.Warn("ASR识别器已停止，尝试重启", zap.Error(err))
			// 使用带锁的重启，避免并发重启
			go h.restartASRService(client)
		} else {
			h.logger.Warn("发送音频数据到ASR失败", zap.Error(err))
		}
	}
}

// handleTextMessage 处理文本消息
func (h *VoiceWebSocketHandler) handleTextMessage(client *VoiceClient, message []byte) {
	var msg map[string]interface{}
	if err := json.Unmarshal(message, &msg); err != nil {
		h.logger.Warn("解析文本消息失败", zap.Error(err))
		return
	}

	h.messageHandler.HandleTextMessage(client, msg, client.writer)
}

// restartASRService 重启ASR服务（带并发保护）
// 注意：这个方法主要用于在发送音频时检测到ASR停止的情况
// 由于 setupASRConnection 中的 goroutine 会自动重连，这里只需要停止当前连接
// 让自动重连循环检测到连接断开并重新连接
func (h *VoiceWebSocketHandler) restartASRService(client *VoiceClient) {
	if client.asrService == nil {
		return
	}

	// 检查服务是否真的需要重启
	if client.asrService.Activity() {
		h.logger.Debug("ASR服务仍在运行，无需重启")
		return
	}

	// 停止当前连接，让自动重连循环检测到并重新连接
	// 不直接调用 RestartClient()，因为 setupASRConnection 中的 goroutine 会自动重连
	if err := client.asrService.StopConn(); err != nil {
		h.logger.Warn("停止ASR连接失败", zap.Error(err))
	}

	h.logger.Info("ASR服务已停止，等待自动重连循环重新连接")
	client.SetActive(false)
}

// startTTSQueueProcessor 启动TTS队列处理goroutine
func (h *VoiceWebSocketHandler) startTTSQueueProcessor(client *VoiceClient) {
	// 确保只启动一次
	if client.state.IsTTSQueueRunning() {
		return
	}
	client.state.SetTTSQueueRunning(true)

	go func() {
		defer client.state.SetTTSQueueRunning(false)
		queue := client.state.GetTTSQueue()
		taskDone := client.state.WaitTTSTaskDone() // 获取完成信号channel（接收端）

		// 第一个任务不需要等待
		firstTask := true

		for {
			select {
			case task := <-queue:
				if task == nil {
					return
				}

				// 如果不是第一个任务，等待前一个任务完成
				if !firstTask {
					// 等待前一个TTS任务完成（带超时，防止永久阻塞）
					select {
					case <-taskDone:
						// 前一个任务完成，可以开始下一个
						h.logger.Debug("前一个TTS任务完成，开始处理下一个任务")
					case <-time.After(30 * time.Second):
						// 超时：可能是任务卡住了，记录警告但继续处理
						h.logger.Warn("等待TTS任务完成超时，继续处理下一个任务",
							zap.String("currentTask", task.Text))
					case <-client.ctx.Done():
						return
					}
				}
				firstTask = false

				// 处理TTS任务
				h.textProcessor.processTTSTask(client, task)
			case <-client.ctx.Done():
				return
			}
		}
	}()
}

// cleanupClient 清理客户端资源
func (h *VoiceWebSocketHandler) cleanupClient(client *VoiceClient) {
	// 清理状态
	client.state.Clear()

	// 停止ASR服务
	if client.asrService != nil {
		client.asrService.StopConn()
	}

	// 关闭TTS服务
	if client.ttsService != nil {
		client.ttsService.Close()
	}

	// 注意：不再需要调用 cancel()，因为使用的是传入的 context
	// 当 gin 请求被取消时，context 会自动取消
}

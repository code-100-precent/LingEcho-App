package voice

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/code-100-precent/LingEcho/internal/models"
	v2 "github.com/code-100-precent/LingEcho/pkg/llm"
	"github.com/code-100-precent/LingEcho/pkg/recognizer"
	"github.com/code-100-precent/LingEcho/pkg/synthesizer"
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

// VoiceClient 语音客户端
type VoiceClient struct {
	conn         *websocket.Conn
	credential   *models.UserCredential
	asrService   recognizer.TranscribeService
	ttsService   synthesizer.SynthesisService
	llmHandler   v2.LLMProvider
	assistantID  int
	language     string
	speaker      string
	temperature  float64
	maxTokens    int
	systemPrompt string
	state        *ClientState // 使用统一的状态管理
	ctx          context.Context
	cancel       context.CancelFunc
	isActive     bool
	writer       *MessageWriter // 消息写入器

	// Knowledge base support
	knowledgeKey string   // Knowledge base identifier
	db           *gorm.DB // Database connection for knowledge base retrieval

	// LLM model (cached from assistant to avoid repeated database queries)
	llmModel string // LLM model name, queried once from assistant when client is created
}

// HandleWebSocket 处理WebSocket连接
func (h *VoiceWebSocketHandler) HandleWebSocket(
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

	ctx, cancel := context.WithCancel(context.Background())
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
		cancel:       cancel,
		isActive:     false,
		writer:       writer,
		// Knowledge base support
		knowledgeKey: knowledgeKey,
		db:           db,
		// LLM model (cached from assistant)
		llmModel: llmModel,
	}

	// 初始化服务
	if err := h.initializeServices(client); err != nil {
		h.logger.Error("初始化服务失败", zap.Error(err))
		writer.SendError(fmt.Sprintf("初始化服务失败: %v", err), true)
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
}

// initializeServices 初始化所有服务
func (h *VoiceWebSocketHandler) initializeServices(client *VoiceClient) error {
	factory := recognizer.GetGlobalFactory()

	// 初始化ASR服务
	asrService, err := h.serviceInitializer.InitializeASR(client.credential, client.language, factory)
	if err != nil {
		return fmt.Errorf("初始化ASR服务失败: %w", err)
	}
	client.asrService = asrService
	client.isActive = true

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

					sessionID := uuid
					if sessionID == "" {
						sessionID = fmt.Sprintf("voice_%d_%d", client.credential.UserID, time.Now().Unix())
					}

					// 获取组织ID（如果助手属于组织）
					var groupID *uint
					if assistantID != nil {
						var assistant models.Assistant
						if err := client.db.Where("id = ?", *assistantID).First(&assistant).Error; err == nil {
							groupID = assistant.GroupID
						}
					}

					if err := models.RecordASRUsage(
						client.db,
						client.credential.UserID,
						client.credential.ID,
						assistantID,
						groupID,
						sessionID,
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
	go func() {
		defer func() {
			if r := recover(); r != nil {
				h.logger.Error("ASR连接异常", zap.Any("panic", r))
				client.isActive = false
			}
		}()

		if err := client.asrService.ConnAndReceive(""); err != nil {
			h.logger.Error("ASR连接失败", zap.Error(err))
			client.isActive = false
			client.writer.SendError(fmt.Sprintf("ASR连接失败: %v", err), true)
		} else {
			client.isActive = true
		}
	}()
}

// MessageQueue WebSocket消息队列，用于异步处理
type MessageQueue struct {
	audioChan chan []byte
	textChan  chan []byte
	stopChan  chan struct{}
}

// NewMessageQueue 创建消息队列
func NewMessageQueue() *MessageQueue {
	return &MessageQueue{
		audioChan: make(chan []byte, 100), // 缓冲100个音频消息
		textChan:  make(chan []byte, 10),  // 缓冲10个文本消息
		stopChan:  make(chan struct{}),
	}
}

// handleMessageLoop 处理WebSocket消息循环（异步版本）
func (h *VoiceWebSocketHandler) handleMessageLoop(client *VoiceClient) {
	queue := NewMessageQueue()
	defer close(queue.stopChan)

	// 启动异步处理goroutine
	go h.processAudioMessages(client, queue.audioChan)
	go h.processTextMessages(client, queue.textChan)

	// 主循环只负责接收消息并分发到队列
	for {
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
			default:
				// 队列满时记录警告，但不阻塞
				h.logger.Warn("音频消息队列已满，丢弃消息", zap.Int("size", len(message)))
			}
		case websocket.TextMessage:
			select {
			case queue.textChan <- message:
				// 成功入队
			default:
				// 队列满时记录警告，但不阻塞
				h.logger.Warn("文本消息队列已满，丢弃消息", zap.Int("size", len(message)))
			}
		}
	}
}

// processAudioMessages 异步处理音频消息
func (h *VoiceWebSocketHandler) processAudioMessages(client *VoiceClient, audioChan chan []byte) {
	for {
		select {
		case message := <-audioChan:
			h.handleAudioMessage(client, message)
		case <-client.ctx.Done():
			return
		}
	}
}

// processTextMessages 异步处理文本消息
func (h *VoiceWebSocketHandler) processTextMessages(client *VoiceClient, textChan chan []byte) {
	for {
		select {
		case message := <-textChan:
			h.handleTextMessage(client, message)
		case <-client.ctx.Done():
			return
		}
	}
}

// handleAudioMessage 处理音频消息
func (h *VoiceWebSocketHandler) handleAudioMessage(client *VoiceClient, message []byte) {
	if !client.isActive || client.asrService == nil {
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
					// 等待前一个TTS任务完成
					select {
					case <-taskDone:
						// 前一个任务完成，可以开始下一个
						h.logger.Debug("前一个TTS任务完成，开始处理下一个任务")
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

// restartASRService 重启ASR服务（带并发保护）
func (h *VoiceWebSocketHandler) restartASRService(client *VoiceClient) {
	if client.asrService == nil {
		return
	}

	// 检查服务是否真的需要重启
	if client.asrService.Activity() {
		h.logger.Debug("ASR服务仍在运行，无需重启")
		return
	}

	// 重启服务（RestartClient没有返回值）
	client.asrService.RestartClient()
	h.logger.Info("ASR服务已重启")
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

	// 取消上下文
	if client.cancel != nil {
		client.cancel()
	}
}

package message

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/code-100-precent/LingEcho/pkg/hardware/audio"
	"github.com/code-100-precent/LingEcho/pkg/hardware/errhandler"
	"github.com/code-100-precent/LingEcho/pkg/hardware/factory"
	"github.com/code-100-precent/LingEcho/pkg/hardware/filter"
	llmv2 "github.com/code-100-precent/LingEcho/pkg/hardware/llm"
	"github.com/code-100-precent/LingEcho/pkg/hardware/speaker"
	"github.com/code-100-precent/LingEcho/pkg/hardware/state"
	"github.com/code-100-precent/LingEcho/pkg/hardware/tts"
	"github.com/code-100-precent/LingEcho/pkg/llm"
	"github.com/code-100-precent/LingEcho/pkg/media"
	"github.com/code-100-precent/LingEcho/pkg/recognizer"
	"github.com/code-100-precent/LingEcho/pkg/synthesizer"
	"go.uber.org/zap"
)

// EncoderPool OPUS编码器线程池
type EncoderPool struct {
	taskQueue chan *EncoderTask
	ctx       context.Context
	cancel    context.CancelFunc
	wg        sync.WaitGroup
	logger    *zap.Logger
}

// EncoderWorker 编码器工作者
type EncoderWorker struct {
	id      int
	encoder media.EncoderFunc
}

// EncoderTask 编码任务
type EncoderTask struct {
	data     []byte
	resultCh chan *EncoderResult
	ctx      context.Context
}

// EncoderResult 编码结果
type EncoderResult struct {
	data []byte
	err  error
}

// NewEncoderPool 创建编码器线程池
func NewEncoderPool(size int, encoder media.EncoderFunc, logger *zap.Logger) *EncoderPool {
	ctx, cancel := context.WithCancel(context.Background())

	pool := &EncoderPool{
		taskQueue: make(chan *EncoderTask, size*2), // 任务队列容量为工作者数量的2倍
		ctx:       ctx,
		cancel:    cancel,
		logger:    logger,
	}

	// 创建工作者goroutines
	for i := 0; i < size; i++ {
		worker := &EncoderWorker{
			id:      i,
			encoder: encoder,
		}

		pool.wg.Add(1)
		go pool.workerLoop(worker)
	}

	logger.Info("创建OPUS编码器线程池", zap.Int("workers", size))
	return pool
}

// workerLoop 工作者循环
func (p *EncoderPool) workerLoop(worker *EncoderWorker) {
	defer p.wg.Done()

	for {
		select {
		case <-p.ctx.Done():
			return
		case task := <-p.taskQueue:
			// 执行编码任务
			result := p.encodeTask(worker, task)

			// 发送结果
			select {
			case <-task.ctx.Done():
				// 任务已取消，不发送结果
			case task.resultCh <- result:
				// 结果已发送
			}
		}
	}
}

// encodeTask 执行编码任务
func (p *EncoderPool) encodeTask(worker *EncoderWorker, task *EncoderTask) *EncoderResult {
	defer func() {
		if r := recover(); r != nil {
			p.logger.Error("编码器工作者发生panic",
				zap.Int("workerID", worker.id),
				zap.Any("panic", r),
			)
		}
	}()

	audioFrame := &media.AudioPacket{Payload: task.data}
	frames, err := worker.encoder(audioFrame)
	if err != nil {
		return &EncoderResult{nil, err}
	}

	if len(frames) > 0 {
		if af, ok := frames[0].(*media.AudioPacket); ok {
			return &EncoderResult{af.Payload, nil}
		}
	}

	return &EncoderResult{nil, fmt.Errorf("编码结果为空")}
}

// Encode 异步编码
func (p *EncoderPool) Encode(ctx context.Context, data []byte) ([]byte, error) {
	task := &EncoderTask{
		data:     data,
		resultCh: make(chan *EncoderResult, 1),
		ctx:      ctx,
	}

	// 提交任务
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-p.ctx.Done():
		return nil, fmt.Errorf("编码器池已关闭")
	case p.taskQueue <- task:
		// 任务已提交
	default:
		// 任务队列满，直接返回错误而不是阻塞
		return nil, fmt.Errorf("编码器池繁忙")
	}

	// 等待结果
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-p.ctx.Done():
		return nil, fmt.Errorf("编码器池已关闭")
	case result := <-task.resultCh:
		return result.data, result.err
	}
}

// Close 关闭编码器池
func (p *EncoderPool) Close() {
	p.cancel()
	p.wg.Wait()
	p.logger.Info("OPUS编码器线程池已关闭")
}

// Processor 消息处理器
type Processor struct {
	stateManager   *state.Manager
	llmService     *llmv2.Service
	ttsService     *tts.Service
	writer         *Writer
	errorHandler   *errhandler.Handler
	filterManager  *filter.Manager
	audioManager   *audio.Manager
	speakerManager *speaker.Manager // 新增：发音人管理器
	logger         *zap.Logger
	mu             sync.RWMutex
	messages       []llm.Message
	synthesizer    synthesizer.SynthesisService // 用于获取音频格式
	credential     *models.UserCredential       // 新增：用于重新创建TTS服务
	serviceFactory *factory.ServiceFactory      // 新增：服务工厂
	encoderPool    *EncoderPool                 // 新增：编码器线程池

	// OPUS编码相关（用于硬件协议）
	audioFormat string
	sampleRate  int
	channels    int
	opusEncoder media.EncoderFunc // PCM -> OPUS (for TTS)

	// 录音回调
	aiResponseCallback func(text string) // 新增：AI回复回调函数
	userInputCallback  func(text string) // 新增：用户输入回调函数

	// 录音会话支持 - 新增
	recordingSession interface{} // 录音会话接口，避免循环依赖
}

// NewProcessor 创建消息处理器
func NewProcessor(
	stateManager *state.Manager,
	llmService *llmv2.Service,
	ttsService *tts.Service,
	writer *Writer,
	errorHandler *errhandler.Handler,
	logger *zap.Logger,
	synthesizer synthesizer.SynthesisService,
	filterManager *filter.Manager,
	audioManager *audio.Manager,
	credential *models.UserCredential, // 新增参数
) *Processor {
	// 创建服务工厂
	transcriberFactory := recognizer.GetGlobalFactory()
	serviceFactory := factory.NewServiceFactory(transcriberFactory, logger)

	// 创建发音人管理器
	speakerManager := speaker.NewManager(logger)

	processor := &Processor{
		stateManager:   stateManager,
		llmService:     llmService,
		ttsService:     ttsService,
		writer:         writer,
		errorHandler:   errorHandler,
		filterManager:  filterManager,
		audioManager:   audioManager,
		speakerManager: speakerManager,
		logger:         logger,
		messages:       make([]llm.Message, 0),
		synthesizer:    synthesizer,
		credential:     credential,
		serviceFactory: serviceFactory,
		audioFormat:    "opus",
		sampleRate:     16000,
		channels:       1,
	}

	// 设置LLM服务的发音人管理器和切换回调
	llmService.SetSpeakerManager(speakerManager, processor.switchSpeaker)

	processor.logger.Info("已设置LLM服务的发音人管理器",
		zap.String("speakerManagerType", fmt.Sprintf("%T", speakerManager)),
		zap.String("currentSpeaker", speakerManager.GetCurrentSpeaker()),
	)

	// 配置TTS文本分割（默认启用）
	processor.configureTTSTextSplit()

	return processor
}

// SetAudioConfig 设置音频配置（用于OPUS编码）
func (p *Processor) SetAudioConfig(audioFormat string, sampleRate, channels int, opusEncoder media.EncoderFunc) {
	p.mu.Lock()
	defer p.mu.Unlock()

	p.audioFormat = audioFormat
	p.sampleRate = sampleRate
	p.channels = channels
	p.opusEncoder = opusEncoder

	// 如果是OPUS格式，创建编码器线程池
	if audioFormat == "opus" && opusEncoder != nil {
		// 关闭旧的编码器池
		if p.encoderPool != nil {
			p.encoderPool.Close()
		}
		// 创建4个工作者的编码器池
		p.encoderPool = NewEncoderPool(4, opusEncoder, p.logger)
	}
}

// SetUserInputCallback 设置用户输入回调函数
func (p *Processor) SetUserInputCallback(callback func(text string)) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.userInputCallback = callback
}

// ProcessASRResult 处理ASR识别结果
func (p *Processor) ProcessASRResult(ctx context.Context, text string) {
	if text == "" {
		return
	}

	// 检查致命错误
	if p.stateManager.IsFatalError() {
		p.logger.Debug("致命错误状态，忽略ASR结果")
		return
	}

	// 如果 TTS 正在播放，取消 TTS 播放（用户打断）
	if p.stateManager.IsTTSPlaying() {
		p.logger.Info("ASR检测到用户说话，中断TTS播放",
			zap.String("user_text", text),
		)
		// 优雅地取消 TTS：先设置状态，再取消context，最后发送结束消息
		p.stateManager.SetTTSPlaying(false)
		p.stateManager.CancelTTS()
		// 发送 TTS 结束消息，通知前端停止播放
		if err := p.writer.SendTTSEnd(); err != nil {
			p.logger.Warn("发送TTS结束消息失败", zap.Error(err))
		}
	}

	// 提前发送ASR结果给前端，不阻塞后续处理
	if err := p.writer.SendASRResult(text); err != nil {
		p.logger.Error("发送ASR结果失败", zap.Error(err))
		// 发送失败不影响后续处理
	}

	// 检查是否在过滤词黑名单中
	if p.filterManager != nil && p.filterManager.IsFiltered(text) {
		p.filterManager.RecordFiltered(text)
		count := p.filterManager.GetFilteredCount(text)

		p.logger.Debug("ASR结果被过滤词黑名单过滤，不发送给LLM",
			zap.String("text", text),
			zap.Int("filtered_count", count),
		)
		// 已发送ASR结果，但不调用LLM和TTS
		return
	}

	// 如果正在处理 LLM，取消当前的处理，优先处理新请求
	if p.stateManager.IsProcessing() {
		p.logger.Debug("检测到新的完整句子，取消当前处理以处理新请求",
			zap.String("new_text", text),
		)
		// 重置处理状态，允许处理新请求
		p.stateManager.SetProcessing(false)
	}

	// 异步处理文本（调用LLM和TTS），不阻塞ASR结果返回
	go p.processText(ctx, text)
}

// ProcessUserInput 处理用户输入（用于录音）
func (p *Processor) ProcessUserInput(text string) {
	if text == "" {
		return
	}

	// 调用用户输入回调函数（用于录音）
	p.mu.RLock()
	callback := p.userInputCallback
	p.mu.RUnlock()
	if callback != nil {
		callback(text)
	}
}

// processText 处理文本（调用LLM和TTS）
// 注意：此方法在goroutine中异步执行，减少锁持有时间
func (p *Processor) processText(ctx context.Context, text string) {
	// 设置处理状态
	p.stateManager.SetProcessing(true)
	defer p.stateManager.SetProcessing(false)

	// 再次检查状态
	if p.stateManager.IsFatalError() {
		p.logger.Debug("致命错误状态，取消处理")
		return
	}

	// 添加用户消息（最小化锁持有时间）
	userMsg := llm.Message{
		Role:    "user",
		Content: text,
	}
	p.mu.Lock()
	p.messages = append(p.messages, userMsg)
	// 限制消息历史大小
	const maxMessageHistory = 100
	if len(p.messages) > maxMessageHistory {
		keepCount := maxMessageHistory / 2
		p.messages = p.messages[len(p.messages)-keepCount:]
		p.logger.Debug("消息历史超过限制，已清理旧消息",
			zap.Int("kept", keepCount),
		)
	}
	p.mu.Unlock()

	// 调用LLM（在锁外执行，不阻塞其他操作）
	// 先创建AI轮次，用于时间记录
	p.recordAITurnStart()

	llmStartTime := time.Now()
	response, err := p.llmService.Query(ctx, text)
	llmEndTime := time.Now()

	if err != nil {
		p.handleServiceError(err, "LLM")
		return
	}

	if response == "" {
		p.logger.Warn("LLM返回空响应")
		return
	}

	// 记录LLM处理时间
	p.recordLLMTiming(llmStartTime, llmEndTime)

	// 添加助手回复（最小化锁持有时间）
	assistantMsg := llm.Message{
		Role:    "assistant",
		Content: response,
	}
	p.mu.Lock()
	p.messages = append(p.messages, assistantMsg)
	p.mu.Unlock()

	// 发送LLM响应给前端（在锁外执行）
	if err := p.writer.SendLLMResponse(response); err != nil {
		p.logger.Error("发送LLM响应失败", zap.Error(err))
	}

	// 调用AI回复回调函数（用于录音）
	p.mu.RLock()
	callback := p.aiResponseCallback
	p.mu.RUnlock()
	if callback != nil {
		callback(response)
	}

	// 注意：发音人切换现在由LLM的Function Calling自动处理，无需手动分析

	// 合成TTS（在goroutine中异步执行，不阻塞）
	p.logger.Info("准备启动TTS合成", zap.String("text", response))
	go func() {
		defer func() {
			if r := recover(); r != nil {
				p.logger.Error("TTS合成发生panic", zap.Any("panic", r))
			}
		}()
		p.synthesizeTTS(ctx, response)
	}()
}

// synthesizeTTS 合成TTS
func (p *Processor) synthesizeTTS(ctx context.Context, text string) {
	if text == "" {
		p.logger.Warn("TTS文本为空，跳过合成")
		return
	}

	p.logger.Info("开始TTS合成", zap.String("text", text))

	// 设置TTS播放状态
	p.stateManager.SetTTSPlaying(true)
	defer func() {
		p.stateManager.SetTTSPlaying(false)
		p.logger.Info("TTS播放结束")
		// 发送TTS结束消息
		if err := p.writer.SendTTSEnd(); err != nil {
			p.logger.Error("发送TTS结束消息失败", zap.Error(err))
		}
	}()

	// 获取音频格式并发送TTS开始消息
	if p.synthesizer == nil {
		p.logger.Error("TTS合成器未初始化，无法合成语音")
		return
	}

	format := p.synthesizer.Format()
	p.logger.Info("发送TTS开始消息",
		zap.Int("sampleRate", format.SampleRate),
		zap.Int("channels", format.Channels),
		zap.Int("bitDepth", format.BitDepth),
	)
	if err := p.writer.SendTTSStart(format); err != nil {
		p.logger.Error("发送TTS开始消息失败", zap.Error(err))
		return
	}

	// 重置TTS流控状态（新的TTS会话开始）
	p.writer.ResetTTSFlowControl()

	// 创建TTS上下文
	ttsCtx, ttsCancel := context.WithCancel(ctx)
	defer ttsCancel()

	// 设置TTS上下文到状态管理器
	p.stateManager.SetTTSCtx(ttsCtx, ttsCancel)

	// 合成语音
	p.logger.Debug("TTS合成文本", zap.String("text", text))

	ttsStartTime := time.Now()
	audioChan, err := p.ttsService.Synthesize(ttsCtx, text)
	if err != nil {
		p.logger.Error("TTS合成失败", zap.Error(err))
		p.handleServiceError(err, "TTS")
		return
	}

	p.logger.Info("TTS合成已启动，等待音频数据")

	// 发送音频数据
	p.mu.RLock()
	audioFormat := p.audioFormat
	opusEncoder := p.opusEncoder
	sampleRate := p.sampleRate
	channels := p.channels
	p.mu.RUnlock()

	var pcmBuffer []byte // 累积PCM数据（用于OPUS编码）
	var totalBytesReceived int
	var frameCount int
	var firstAudioSent bool // 标记是否已发送第一个音频包

	// 使用defer确保在任何情况下都能正确清理
	defer func() {
		if r := recover(); r != nil {
			p.logger.Error("TTS合成发生panic", zap.Any("panic", r))
		}
	}()

	for {
		select {
		case <-ttsCtx.Done():
			p.logger.Info("TTS合成被取消（context done）")
			return
		case data, ok := <-audioChan:
			if !ok {
				p.logger.Info("TTS音频通道已关闭，发送剩余数据",
					zap.Int("totalBytes", totalBytesReceived),
					zap.Int("frameCount", frameCount),
					zap.Int("bufferSize", len(pcmBuffer)),
				)
				// 发送缓冲区剩余数据
				if audioFormat == "opus" && opusEncoder != nil && len(pcmBuffer) > 0 {
					// 检查context状态再发送剩余帧
					select {
					case <-ttsCtx.Done():
						p.logger.Info("TTS合成被取消，跳过发送剩余帧")
						return
					default:
						p.sendRemainingOPUSFrames(pcmBuffer, opusEncoder, sampleRate, channels)
					}
				}

				// 智能等待硬件播放完成
				// 1. 等待所有音频包发送完成（如果有流控器）
				// 2. 计算预缓冲包播放时间并等待
				waitDuration := p.calculatePlaybackWaitTime(frameCount, audioFormat, totalBytesReceived)
				p.logger.Info("等待硬件播放完缓冲区",
					zap.Duration("wait", waitDuration),
					zap.Int("frameCount", frameCount),
					zap.String("audioFormat", audioFormat),
				)

				// 在等待前检查context状态
				select {
				case <-ttsCtx.Done():
					p.logger.Info("TTS合成被取消，跳过播放等待")
					return
				default:
					time.Sleep(waitDuration)
				}

				p.logger.Info("TTS合成完成")
				return
			}
			if data == nil {
				// 错误信号
				p.logger.Warn("收到TTS错误信号（nil数据）")
				return
			}

			totalBytesReceived += len(data)

			// 如果是第一个音频数据包，记录TTS准备完成时间
			if !firstAudioSent {
				ttsFirstAudioTime := time.Now()
				// 记录TTS准备时间（从TTS开始到第一个音频包准备好的时间）
				p.recordTTSTiming(ttsStartTime, ttsFirstAudioTime, text)
				firstAudioSent = true
				p.logger.Info("TTS第一个音频包准备完成",
					zap.Duration("prepareTime", ttsFirstAudioTime.Sub(ttsStartTime)),
				)
			}

			// 记录TTS输出到音频管理器（用于回声消除）
			if p.audioManager != nil {
				p.audioManager.RecordTTSOutput(data)
			}

			// 如果是OPUS格式，需要编码PCM -> OPUS
			if audioFormat == "opus" && opusEncoder != nil {
				// 将新数据追加到缓冲区
				pcmBuffer = append(pcmBuffer, data...)

				// 计算每帧的字节数（60ms @ sampleRate, channels, 16-bit）
				frameSize := sampleRate * 60 / 1000 * channels * 2

				// 逐帧编码和发送
				for len(pcmBuffer) >= frameSize {
					// 检查 context 是否被取消
					select {
					case <-ttsCtx.Done():
						p.logger.Info("TTS合成被取消，停止发送音频")
						return
					default:
					}

					// 取出一帧数据
					frameData := pcmBuffer[:frameSize]
					pcmBuffer = pcmBuffer[frameSize:]

					// 使用编码器线程池进行异步编码
					var encodedData []byte
					var encodeErr error

					p.mu.RLock()
					encoderPool := p.encoderPool
					p.mu.RUnlock()

					if encoderPool != nil {
						// 使用线程池编码
						encodedData, encodeErr = encoderPool.Encode(ttsCtx, frameData)
					} else {
						// 回退到同步编码
						audioFrame := &media.AudioPacket{Payload: frameData}
						frames, err := opusEncoder(audioFrame)
						if err != nil {
							encodeErr = err
						} else if len(frames) > 0 {
							if af, ok := frames[0].(*media.AudioPacket); ok {
								encodedData = af.Payload
							}
						}
					}

					if encodeErr != nil {
						p.logger.Error("OPUS编码失败", zap.Error(encodeErr))
						continue
					}

					if len(encodedData) > 0 {
						// 发送编码后的OPUS数据（带流控）
						frameCount++
						// 在发送前再次检查context状态
						select {
						case <-ttsCtx.Done():
							p.logger.Info("TTS合成被取消，停止发送音频帧")
							return
						default:
						}

						// 使用安全的发送方法，避免panic
						if err := p.safeSendTTSAudio(encodedData, ttsCtx); err != nil {
							// 检查是否是因为context取消导致的错误
							select {
							case <-ttsCtx.Done():
								p.logger.Info("TTS合成被取消，发送音频失败是正常的")
								return
							default:
								p.logger.Error("发送TTS音频失败", zap.Error(err))
								return
							}
						}
						// 每10帧记录一次
						if frameCount%10 == 0 {
							p.logger.Debug("已发送TTS音频帧",
								zap.Int("frameCount", frameCount),
								zap.Int("opusSize", len(encodedData)),
								zap.Int("totalBytes", totalBytesReceived),
							)
						}
					}
				}
			} else {
				// PCM格式，直接发送（带流控）
				// 检查 context 是否被取消
				select {
				case <-ttsCtx.Done():
					p.logger.Info("TTS合成被取消，停止发送音频")
					return
				default:
				}

				// 使用安全的发送方法，避免panic
				if err := p.safeSendTTSAudio(data, ttsCtx); err != nil {
					// 检查是否是因为context取消导致的错误
					select {
					case <-ttsCtx.Done():
						p.logger.Info("TTS合成被取消，发送音频失败是正常的")
						return
					default:
						p.logger.Error("发送TTS音频失败", zap.Error(err))
						return
					}
				}
			}
		}
	}
}

// sendRemainingOPUSFrames 发送缓冲区剩余的OPUS帧
func (p *Processor) sendRemainingOPUSFrames(pcmBuffer []byte, opusEncoder media.EncoderFunc, sampleRate, channels int) {
	frameSize := sampleRate * 60 / 1000 * channels * 2

	// 获取当前TTS context
	ttsCtx := p.stateManager.GetTTSCtx()
	if ttsCtx == nil {
		p.logger.Warn("TTS context为空，跳过发送剩余帧")
		return
	}

	// 处理完整的帧
	for len(pcmBuffer) >= frameSize {
		// 检查context状态
		select {
		case <-ttsCtx.Done():
			p.logger.Info("TTS合成被取消，停止发送剩余帧")
			return
		default:
		}

		frameData := pcmBuffer[:frameSize]
		pcmBuffer = pcmBuffer[frameSize:]

		audioFrame := &media.AudioPacket{Payload: frameData}
		frames, err := opusEncoder(audioFrame)
		if err != nil {
			p.logger.Error("编码剩余帧失败", zap.Error(err))
			continue
		}

		if len(frames) > 0 {
			if af, ok := frames[0].(*media.AudioPacket); ok {
				// 使用安全发送方法，避免panic
				if err := p.safeSendTTSAudio(af.Payload, ttsCtx); err != nil {
					// 检查是否是因为context取消导致的错误
					select {
					case <-ttsCtx.Done():
						p.logger.Info("TTS合成被取消，发送剩余帧失败是正常的")
						return
					default:
						p.logger.Error("发送剩余帧失败", zap.Error(err))
						return
					}
				}
			}
		}
	}

	// 处理最后的不完整帧（如果足够大）
	if len(pcmBuffer) >= 100 {
		// 检查context状态
		select {
		case <-ttsCtx.Done():
			p.logger.Info("TTS合成被取消，跳过发送不完整帧")
			return
		default:
		}

		// 填充到完整帧
		paddedBuffer := make([]byte, frameSize)
		copy(paddedBuffer, pcmBuffer)

		// 用最后一个样本填充
		if len(pcmBuffer) >= 2 {
			lastSample := []byte{pcmBuffer[len(pcmBuffer)-2], pcmBuffer[len(pcmBuffer)-1]}
			for i := len(pcmBuffer); i < frameSize; i += 2 {
				paddedBuffer[i] = lastSample[0]
				if i+1 < frameSize {
					paddedBuffer[i+1] = lastSample[1]
				}
			}
		}

		audioFrame := &media.AudioPacket{Payload: paddedBuffer}
		frames, err := opusEncoder(audioFrame)
		if err == nil && len(frames) > 0 {
			if af, ok := frames[0].(*media.AudioPacket); ok {
				// 使用安全发送方法，避免panic
				if err := p.safeSendTTSAudio(af.Payload, ttsCtx); err != nil {
					// 检查是否是因为context取消导致的错误
					select {
					case <-ttsCtx.Done():
						p.logger.Info("TTS合成被取消，发送不完整帧失败是正常的")
					default:
						p.logger.Error("发送不完整帧失败", zap.Error(err))
					}
				}
			}
		}
	}
}

// calculatePlaybackWaitTime 计算播放等待时间
func (p *Processor) calculatePlaybackWaitTime(frameCount int, audioFormat string, totalBytesReceived int) time.Duration {
	// 基础等待时间：确保最后几帧音频播放完成
	baseWaitMs := 300 // 300ms基础等待

	if audioFormat == "opus" {
		// OPUS格式：计算预缓冲包播放时间
		// 参考xiaozhi-server的实现：(PRE_BUFFER_COUNT + 2) * frame_duration
		frameDurationMs := 60    // OPUS帧时长60ms
		preBufferCount := 5      // 预缓冲包数量
		networkJitterFrames := 2 // 网络抖动补偿帧数

		// 预缓冲包播放时间
		preBufferPlaybackMs := (preBufferCount + networkJitterFrames) * frameDurationMs

		// 根据音频数据量和帧数动态调整
		if frameCount <= preBufferCount {
			// 音频较短，主要是预缓冲包，需要等待它们播放完
			baseWaitMs = preBufferPlaybackMs
		} else {
			// 音频较长，计算基于帧数的播放时间
			estimatedPlaybackMs := frameCount * frameDurationMs

			// 使用预缓冲播放时间作为最小等待时间
			if estimatedPlaybackMs < preBufferPlaybackMs {
				baseWaitMs = preBufferPlaybackMs
			} else {
				// 对于长音频，等待时间不需要太长，使用预缓冲时间即可
				baseWaitMs = preBufferPlaybackMs
			}
		}

		p.logger.Debug("计算OPUS播放等待时间",
			zap.Int("frameCount", frameCount),
			zap.Int("totalBytes", totalBytesReceived),
			zap.Int("preBufferPlaybackMs", preBufferPlaybackMs),
			zap.Int("finalWaitMs", baseWaitMs),
		)
	} else {
		// PCM格式：基于数据量估算播放时间
		if totalBytesReceived > 0 {
			// 假设16-bit PCM, 16kHz采样率
			sampleRate := 16000
			bytesPerSecond := sampleRate * 2 // 16-bit = 2 bytes per sample
			estimatedDurationMs := (totalBytesReceived * 1000) / bytesPerSecond

			// 使用估算时间，但不超过1秒，不少于300ms
			if estimatedDurationMs > 1000 {
				baseWaitMs = 1000
			} else if estimatedDurationMs > baseWaitMs {
				baseWaitMs = estimatedDurationMs
			}
		}

		p.logger.Debug("计算PCM播放等待时间",
			zap.Int("frameCount", frameCount),
			zap.Int("totalBytes", totalBytesReceived),
			zap.Int("baseWaitMs", baseWaitMs),
		)
	}

	return time.Duration(baseWaitMs) * time.Millisecond
}

// SetRecordingSession 设置录音会话（用于时间记录）
func (p *Processor) SetRecordingSession(session interface{}) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.recordingSession = session
}

// SetAIResponseCallback 设置AI回复回调函数
func (p *Processor) SetAIResponseCallback(callback func(text string)) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.aiResponseCallback = callback
}

// HandleTextMessage 处理文本消息
func (p *Processor) HandleTextMessage(ctx context.Context, data []byte) {
	var msg map[string]interface{}
	if err := json.Unmarshal(data, &msg); err != nil {
		p.logger.Warn("解析文本消息失败", zap.Error(err))
		return
	}

	msgType, ok := msg["type"].(string)
	if !ok {
		p.logger.Warn("消息类型无效")
		return
	}

	switch msgType {
	case "new_session":
		// 新会话，清空消息历史
		p.mu.Lock()
		p.messages = make([]llm.Message, 0)
		p.mu.Unlock()
		p.logger.Info("新会话开始")

	case "ping":
		// 心跳消息，发送pong响应
		if err := p.writer.SendPong(); err != nil {
			p.logger.Warn("发送pong响应失败", zap.Error(err))
		} else {
			p.logger.Debug("收到ping，已发送pong响应")
		}

	case "hello":
		// xiaozhi协议hello消息，由session处理
		p.logger.Debug("收到hello消息，由session处理")
	}
}

// Clear 清空消息历史
func (p *Processor) Clear() {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.messages = make([]llm.Message, 0)
}

// Close 关闭处理器并清理资源
func (p *Processor) Close() error {
	p.mu.Lock()
	defer p.mu.Unlock()

	// 关闭编码器池
	if p.encoderPool != nil {
		p.encoderPool.Close()
		p.encoderPool = nil
	}

	p.logger.Info("消息处理器已关闭，资源已清理")
	return nil
}

// SetSynthesizer 设置合成器（用于重新初始化TTS服务时更新）
func (p *Processor) SetSynthesizer(synthesizer synthesizer.SynthesisService) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.synthesizer = synthesizer
}

// handleServiceError 统一处理服务错误
// 返回true表示是致命错误，调用者应该立即返回
func (p *Processor) handleServiceError(err error, serviceName string) bool {
	if err == nil {
		return false
	}

	classified := p.errorHandler.HandleError(err, serviceName)
	isFatal := false
	if classifiedErr, ok := classified.(*errhandler.Error); ok {
		isFatal = classifiedErr.Type == errhandler.ErrorTypeFatal
		if isFatal {
			p.stateManager.SetFatalError(true)
		}
	}
	p.writer.SendError(serviceName+"处理失败: "+err.Error(), isFatal)
	return isFatal
}

// switchSpeaker 切换发音人（由Function Calling调用）
func (p *Processor) switchSpeaker(speakerID string) error {
	p.mu.Lock()
	defer p.mu.Unlock()

	// 获取发音人信息
	speakerInfo := p.speakerManager.GetSpeaker(speakerID)
	if speakerInfo == nil {
		return fmt.Errorf("发音人ID不存在: %s", speakerID)
	}

	p.logger.Info("开始切换发音人",
		zap.String("speakerID", speakerID),
		zap.String("speakerName", speakerInfo.Name),
		zap.String("description", speakerInfo.Description),
	)

	// 如果TTS正在播放，先停止
	if p.stateManager.IsTTSPlaying() {
		p.logger.Info("TTS正在播放，先停止当前播放")
		p.stateManager.SetTTSPlaying(false)
		p.stateManager.CancelTTS()
	}

	// 创建新的TTS synthesizer
	synthesizer, err := p.serviceFactory.CreateTTS(p.credential, speakerID, p.sampleRate, p.channels)
	if err != nil {
		return fmt.Errorf("创建新TTS synthesizer失败: %w", err)
	}

	// 更新TTS服务
	p.ttsService.UpdateSpeaker(speakerID, synthesizer)

	// 重新配置TTS文本分割（重要：切换发音人后需要重新配置）
	config := tts.TextSplitConfig{
		Enable:         true, // 启用文本分割
		SplitRatio:     0.5,  // 一半一半分割
		MinSplitLength: 15,   // 最小15个字符才分割（适合中文）
	}
	p.ttsService.SetTextSplitConfig(config)

	// 更新processor中的synthesizer引用
	p.synthesizer = synthesizer

	// 更新发音人管理器状态
	err = p.speakerManager.SetCurrentSpeaker(speakerID)
	if err != nil {
		return fmt.Errorf("更新发音人状态失败: %w", err)
	}

	p.logger.Info("发音人切换完成，已重新配置TTS文本分割",
		zap.String("speakerID", speakerID),
		zap.Bool("textSplitEnabled", config.Enable),
		zap.Float64("splitRatio", config.SplitRatio),
		zap.Int("minSplitLength", config.MinSplitLength),
	)

	return nil
}

// safeSendTTSAudio 安全发送TTS音频，避免panic
func (p *Processor) safeSendTTSAudio(data []byte, ctx context.Context) error {
	// 检查context状态
	select {
	case <-ctx.Done():
		return ctx.Err()
	default:
	}

	// 使用defer捕获可能的panic
	defer func() {
		if r := recover(); r != nil {
			p.logger.Warn("发送TTS音频时发生panic，已恢复", zap.Any("panic", r))
		}
	}()

	// 使用固定延迟（60ms）发送，避免长时间播放时时间同步累积误差导致发送过快
	return p.writer.SendTTSAudioWithFlowControl(data, 60, 60)
}

// 录音会话相关方法

// recordLLMTiming 记录LLM处理时间
func (p *Processor) recordLLMTiming(startTime, endTime time.Time) {
	p.mu.RLock()
	session := p.recordingSession
	p.mu.RUnlock()

	if session != nil {
		if rs, ok := session.(interface{ RecordLLMTiming(time.Time, time.Time) }); ok {
			rs.RecordLLMTiming(startTime, endTime)
		}
	}
}

// recordTTSTiming 记录TTS处理时间
func (p *Processor) recordTTSTiming(startTime, endTime time.Time, text string) {
	p.mu.RLock()
	session := p.recordingSession
	p.mu.RUnlock()

	if session != nil {
		if rs, ok := session.(interface {
			RecordTTSTiming(time.Time, time.Time, string)
		}); ok {
			rs.RecordTTSTiming(startTime, endTime, text)
		}
	}
}

// RecordASRTiming 记录ASR处理时间
func (p *Processor) RecordASRTiming(startTime, endTime time.Time, text string) {
	p.recordASRTiming(startTime, endTime, text)
}
func (p *Processor) recordASRTiming(startTime, endTime time.Time, text string) {
	p.mu.RLock()
	session := p.recordingSession
	p.mu.RUnlock()

	if session != nil {
		if rs, ok := session.(interface {
			RecordASRTiming(time.Time, time.Time, string)
		}); ok {
			rs.RecordASRTiming(startTime, endTime, text)
		}
	}
}
func (p *Processor) recordUserTurnStart() {
	p.mu.RLock()
	session := p.recordingSession
	p.mu.RUnlock()

	if session != nil {
		// 使用类型断言调用方法，避免循环依赖
		if rs, ok := session.(interface{ StartUserTurn() }); ok {
			rs.StartUserTurn()
		}
	}
}

// RecordUserTurnStartIfNeeded 如果需要的话记录用户发言开始（避免重复记录）
func (p *Processor) RecordUserTurnStartIfNeeded() {
	p.mu.RLock()
	session := p.recordingSession
	p.mu.RUnlock()

	if session != nil {
		// 使用类型断言调用方法，避免循环依赖
		if rs, ok := session.(interface{ StartUserTurnIfNeeded() }); ok {
			rs.StartUserTurnIfNeeded()
		}
	}
}

// RecordUserTurnEnd 记录用户发言结束（公开方法）
func (p *Processor) RecordUserTurnEnd(content string) {
	p.recordUserTurnEnd(content)
}

// recordUserTurnEnd 记录用户发言结束
func (p *Processor) recordUserTurnEnd(content string) {
	p.mu.RLock()
	session := p.recordingSession
	p.mu.RUnlock()

	if session != nil {
		if rs, ok := session.(interface{ EndUserTurn(string) }); ok {
			rs.EndUserTurn(content)
		}
	}
}

// recordAITurnStart 记录AI回复开始
func (p *Processor) recordAITurnStart() {
	p.mu.RLock()
	session := p.recordingSession
	p.mu.RUnlock()

	if session != nil {
		if rs, ok := session.(interface{ StartAITurn() }); ok {
			rs.StartAITurn()
		}
	}
}

// recordLLMProcessingEnd 记录LLM处理结束
func (p *Processor) recordLLMProcessingEnd() {
	p.mu.RLock()
	session := p.recordingSession
	p.mu.RUnlock()

	if session != nil {
		if rs, ok := session.(interface{ EndLLMProcessing() }); ok {
			rs.EndLLMProcessing()
		}
	}
}

// recordAITurnEnd 记录AI回复结束
func (p *Processor) recordAITurnEnd(content string) {
	p.mu.RLock()
	session := p.recordingSession
	p.mu.RUnlock()

	if session != nil {
		if rs, ok := session.(interface{ EndAITurn(string) }); ok {
			rs.EndAITurn(content)
		}
	}
}

// recordTTSStart 记录TTS开始
func (p *Processor) recordTTSStart() {
	p.mu.RLock()
	session := p.recordingSession
	p.mu.RUnlock()

	if session != nil {
		if rs, ok := session.(interface{ StartTTSProcessing() }); ok {
			rs.StartTTSProcessing()
		}
	}
}

// recordTTSEnd 记录TTS结束
func (p *Processor) recordTTSEnd() {
	p.mu.RLock()
	session := p.recordingSession
	p.mu.RUnlock()

	if session != nil {
		if rs, ok := session.(interface{ EndTTSProcessing() }); ok {
			rs.EndTTSProcessing()
		}
	}
}

// recordInterruption 记录中断事件
func (p *Processor) recordInterruption() {
	p.mu.RLock()
	session := p.recordingSession
	p.mu.RUnlock()

	if session != nil {
		if rs, ok := session.(interface{ RecordInterruption() }); ok {
			rs.RecordInterruption()
		}
	}
}

// configureTTSTextSplit 配置TTS文本分割
func (p *Processor) configureTTSTextSplit() {
	if p.ttsService == nil {
		p.logger.Warn("TTS服务未初始化，无法配置文本分割")
		return
	}

	// 默认启用文本分割配置
	config := tts.TextSplitConfig{
		Enable:         true, // 启用文本分割
		SplitRatio:     0.5,  // 一半一半分割
		MinSplitLength: 15,   // 最小15个字符才分割（适合中文）
	}

	p.ttsService.SetTextSplitConfig(config)

	p.logger.Info("TTS文本分割配置已设置",
		zap.Bool("enable", config.Enable),
		zap.Float64("splitRatio", config.SplitRatio),
		zap.Int("minSplitLength", config.MinSplitLength),
	)
}

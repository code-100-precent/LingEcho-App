package message

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/code-100-precent/LingEcho/pkg/hardware/audio"
	"github.com/code-100-precent/LingEcho/pkg/hardware/errhandler"
	"github.com/code-100-precent/LingEcho/pkg/hardware/filter"
	llmv2 "github.com/code-100-precent/LingEcho/pkg/hardware/llm"
	"github.com/code-100-precent/LingEcho/pkg/hardware/state"
	"github.com/code-100-precent/LingEcho/pkg/hardware/tts"
	"github.com/code-100-precent/LingEcho/pkg/llm"
	"github.com/code-100-precent/LingEcho/pkg/media"
	"github.com/code-100-precent/LingEcho/pkg/synthesizer"
	"go.uber.org/zap"
)

// Processor 消息处理器
type Processor struct {
	stateManager  *state.Manager
	llmService    *llmv2.Service
	ttsService    *tts.Service
	writer        *Writer
	errorHandler  *errhandler.Handler
	filterManager *filter.Manager
	audioManager  *audio.Manager
	logger        *zap.Logger
	mu            sync.RWMutex
	messages      []llm.Message
	synthesizer   synthesizer.SynthesisService // 用于获取音频格式

	// OPUS编码相关（用于硬件协议）
	audioFormat string
	sampleRate  int
	channels    int
	opusEncoder media.EncoderFunc // PCM -> OPUS (for TTS)
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
) *Processor {
	return &Processor{
		stateManager:  stateManager,
		llmService:    llmService,
		ttsService:    ttsService,
		writer:        writer,
		errorHandler:  errorHandler,
		filterManager: filterManager,
		audioManager:  audioManager,
		logger:        logger,
		messages:      make([]llm.Message, 0),
		synthesizer:   synthesizer,
		audioFormat:   "opus",
		sampleRate:    16000,
		channels:      1,
	}
}

// SetAudioConfig 设置音频配置（用于OPUS编码）
func (p *Processor) SetAudioConfig(audioFormat string, sampleRate, channels int, opusEncoder media.EncoderFunc) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.audioFormat = audioFormat
	p.sampleRate = sampleRate
	p.channels = channels
	p.opusEncoder = opusEncoder
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
	response, err := p.llmService.Query(ctx, text)
	if err != nil {
		p.handleServiceError(err, "LLM")
		return
	}

	if response == "" {
		p.logger.Warn("LLM返回空响应")
		return
	}

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

					// 直接使用原始帧数据，不处理静音帧

					// 编码这一帧
					audioFrame := &media.AudioPacket{Payload: frameData}
					frames, err := opusEncoder(audioFrame)
					if err != nil {
						p.logger.Error("OPUS编码失败", zap.Error(err))
						continue
					}

					if len(frames) > 0 {
						if af, ok := frames[0].(*media.AudioPacket); ok {
							// 发送编码后的OPUS数据（带流控）
							frameCount++
							// 使用固定延迟（60ms）发送，避免长时间播放时时间同步累积误差导致发送过快
							// 在发送前再次检查context状态
							select {
							case <-ttsCtx.Done():
								p.logger.Info("TTS合成被取消，停止发送音频帧")
								return
							default:
							}

							if err := p.writer.SendTTSAudioWithFlowControl(af.Payload, 60, 60); err != nil {
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
									zap.Int("opusSize", len(af.Payload)),
									zap.Int("totalBytes", totalBytesReceived),
								)
							}
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

				// 使用固定延迟（60ms）发送，避免长时间播放时时间同步累积误差导致发送过快
				if err := p.writer.SendTTSAudioWithFlowControl(data, 60, 60); err != nil {
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
				// 使用固定延迟（60ms）发送剩余帧，确保时序正确
				if err := p.writer.SendTTSAudioWithFlowControl(af.Payload, 60, 60); err != nil {
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
				// 使用固定延迟（60ms）发送不完整帧，确保时序正确
				if err := p.writer.SendTTSAudioWithFlowControl(af.Payload, 60, 60); err != nil {
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

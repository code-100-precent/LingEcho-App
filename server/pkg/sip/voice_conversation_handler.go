package sip

import (
	"context"
	"fmt"
	"net"
	"sync"
	"time"

	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/code-100-precent/LingEcho/pkg/llm"
	"github.com/code-100-precent/LingEcho/pkg/recognizer"
	"github.com/code-100-precent/LingEcho/pkg/sip/codec"
	"github.com/code-100-precent/LingEcho/pkg/synthesizer"
	"github.com/pion/rtp"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

// VoiceConversationHandler 处理智能语音对话
type VoiceConversationHandler struct {
	// 基本信息
	callID        string
	clientRTPAddr *net.UDPAddr
	rtpConn       *net.UDPConn
	
	// 服务
	asrTranscriber recognizer.TranscribeService
	ttsService     synthesizer.SynthesisService
	llmProvider    llm.LLMProvider
	credential     *models.UserCredential
	
	// 方案配置
	sipUser        *models.SipUser
	
	// 音频缓冲
	audioBuffer    []byte
	bufferMutex    sync.Mutex
	bufferDuration time.Duration
	
	// 状态
	isProcessing   bool
	processingMu   sync.Mutex
	isFirstMessage bool // 是否是第一条消息（用于播放开场白）
	
	// 配置
	silenceTimeout time.Duration
	minAudioLength int
	
	// VAD (语音活动检测)
	lastAudioTime  time.Time
	silenceCounter int
	
	// 录音相关
	isRecording        bool      // 是否正在录音
	recordingBuffer    []byte    // 全程录音缓冲
	recordingMutex     sync.Mutex
	isInMessageMode    bool      // 是否进入留言阶段
	messageStartTime   time.Time // 留言开始时间
	conversationCount  int       // 对话轮次计数
	
	// 控制
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
	
	// RTP 发送参数
	rtpSSRC        uint32
	rtpSeqNum      uint16
	rtpTimestamp   uint32
	rtpMutex       sync.Mutex
}

// NewVoiceConversationHandler 创建语音对话处理器
func NewVoiceConversationHandler(
	callID string,
	clientRTPAddr *net.UDPAddr,
	rtpConn *net.UDPConn,
	credential *models.UserCredential,
	asrTranscriber recognizer.TranscribeService,
	ttsService synthesizer.SynthesisService,
	llmProvider llm.LLMProvider,
	sipUser *models.SipUser,
) *VoiceConversationHandler {
	ctx, cancel := context.WithCancel(context.Background())
	
	// 判断是否需要录音
	isRecording := sipUser != nil && sipUser.RecordingEnabled
	
	return &VoiceConversationHandler{
		callID:            callID,
		clientRTPAddr:     clientRTPAddr,
		rtpConn:           rtpConn,
		credential:        credential,
		asrTranscriber:    asrTranscriber,
		ttsService:        ttsService,
		llmProvider:       llmProvider,
		sipUser:           sipUser,
		audioBuffer:       make([]byte, 0, 64000), // 8秒缓冲区
		bufferDuration:    500 * time.Millisecond,
		silenceTimeout:    800 * time.Millisecond,
		minAudioLength:    8000, // 1秒 @ 8kHz PCMU
		lastAudioTime:     time.Now(),
		silenceCounter:    0,
		isFirstMessage:    true,
		isRecording:       isRecording,
		recordingBuffer:   make([]byte, 0, 240000), // 30秒缓冲区（足够容纳对话+留言）
		isInMessageMode:   false,
		conversationCount: 0,
		ctx:               ctx,
		cancel:            cancel,
		rtpSSRC:           12345678,
		rtpSeqNum:         0,
		rtpTimestamp:      0,
	}
}

// Start 启动语音对话处理
func (h *VoiceConversationHandler) Start() {
	logrus.WithFields(logrus.Fields{
		"call_id":     h.callID,
		"recording":   h.isRecording,
	}).Info("🎙️  启动智能语音对话处理器")
	
	// 启动音频处理协程
	h.wg.Add(1)
	go h.processAudioLoop()
	
	// 如果配置了开场白，立即播放
	if h.sipUser != nil && h.sipUser.OpeningMessage != "" {
		logrus.WithFields(logrus.Fields{
			"call_id": h.callID,
			"message": h.sipUser.OpeningMessage,
		}).Info("🎤 播放开场白")
		
		// 异步播放开场白，避免阻塞
		go h.playOpeningMessage()
	}
}

// UpdateClientAddress 更新客户端 RTP 地址（用于 NAT 穿透）
func (h *VoiceConversationHandler) UpdateClientAddress(newAddr *net.UDPAddr) {
	h.clientRTPAddr = newAddr
	logrus.WithFields(logrus.Fields{
		"call_id":  h.callID,
		"new_addr": newAddr.String(),
	}).Debug("Client RTP address updated for NAT")
}

// Stop 停止语音对话处理
func (h *VoiceConversationHandler) Stop() {
	logrus.WithField("call_id", h.callID).Info("🛑 停止智能语音对话处理器")
	
	// 取消 context
	h.cancel()
	
	// 清空音频缓冲区
	h.bufferMutex.Lock()
	h.audioBuffer = h.audioBuffer[:0]
	h.bufferMutex.Unlock()
	
	// 等待所有协程完成
	h.wg.Wait()
	
	logrus.WithField("call_id", h.callID).Info("✓ 智能语音对话处理器已停止")
}

// ProcessAudioPacket 处理接收到的音频包
func (h *VoiceConversationHandler) ProcessAudioPacket(audioData []byte) {
	// 如果启用了录音，收集所有音频（全程录音）
	if h.isRecording {
		h.recordingMutex.Lock()
		h.recordingBuffer = append(h.recordingBuffer, audioData...)
		h.recordingMutex.Unlock()
	}
	
	// 如果在留言阶段，检查是否超时
	if h.isInMessageMode {
		h.recordingMutex.Lock()
		duration := time.Since(h.messageStartTime)
		h.recordingMutex.Unlock()
		
		// 检查留言时长，超过15秒自动结束
		if duration >= 15*time.Second {
			logrus.WithFields(logrus.Fields{
				"call_id":  h.callID,
				"duration": duration.Seconds(),
			}).Info("📞 留言时间到，准备挂断")
			h.cancel() // 触发挂断
			return
		}
		// 在留言阶段不处理语音识别，只录音
		return
	}
	
	h.bufferMutex.Lock()
	h.audioBuffer = append(h.audioBuffer, audioData...)
	bufferLen := len(h.audioBuffer)
	
	// 简单的 VAD：检测音频能量
	hasVoice := h.detectVoiceActivity(audioData)
	if hasVoice {
		h.lastAudioTime = time.Now()
		h.silenceCounter = 0
	} else {
		h.silenceCounter++
	}
	h.bufferMutex.Unlock()
	
	// 策略1: 快速触发 - 达到 1.5 秒立即处理
	if bufferLen >= 12000 { // 约 1.5 秒 @ 8kHz PCMU
		h.tryProcessBuffer()
		return
	}
	
	// 策略2: 防止缓冲区过大 - 超过 2.5 秒强制处理（避免超过腾讯云 ASR 3秒限制）
	if bufferLen >= 20000 { // 约 2.5 秒 @ 8kHz PCMU
		logrus.WithFields(logrus.Fields{
			"call_id":   h.callID,
			"audio_sec": float64(bufferLen) / 8000.0,
		}).Info("🎤 缓冲区接近上限，强制处理")
		h.tryProcessBuffer()
		return
	}
	
	// 策略3: VAD 触发 - 检测到静音且有足够音频
	if bufferLen >= h.minAudioLength && h.silenceCounter >= 40 { // 40包 = 800ms 静音
		logrus.WithFields(logrus.Fields{
			"call_id":      h.callID,
			"audio_sec":    float64(bufferLen) / 8000.0,
			"silence_ms":   h.silenceCounter * 20,
		}).Info("🎤 检测到静音，触发处理")
		h.tryProcessBuffer()
	}
}

// detectVoiceActivity 简单的语音活动检测
func (h *VoiceConversationHandler) detectVoiceActivity(pcmuData []byte) bool {
	if len(pcmuData) == 0 {
		return false
	}
	
	// 计算音频能量
	var energy int64
	for _, sample := range pcmuData {
		val := int64(sample) - 128
		energy += val * val
	}
	
	avgEnergy := energy / int64(len(pcmuData))
	threshold := int64(500)
	
	return avgEnergy > threshold
}

// tryProcessBuffer 尝试处理缓冲区
func (h *VoiceConversationHandler) tryProcessBuffer() {
	h.processingMu.Lock()
	if h.isProcessing {
		h.processingMu.Unlock()
		return
	}
	h.isProcessing = true
	h.processingMu.Unlock()
	
	h.wg.Add(1)
	go h.processBufferedAudio()
}

// processBufferedAudio 处理缓冲的音频
func (h *VoiceConversationHandler) processBufferedAudio() {
	defer h.wg.Done()
	defer func() {
		h.processingMu.Lock()
		h.isProcessing = false
		h.processingMu.Unlock()
	}()
	
	// 获取缓冲区数据
	h.bufferMutex.Lock()
	if len(h.audioBuffer) < h.minAudioLength {
		h.bufferMutex.Unlock()
		return
	}
	pcmuData := make([]byte, len(h.audioBuffer))
	copy(pcmuData, h.audioBuffer)
	h.audioBuffer = h.audioBuffer[:0] // 清空缓冲区
	h.bufferMutex.Unlock()
	
	logrus.WithFields(logrus.Fields{
		"call_id":    h.callID,
		"bytes":      len(pcmuData),
		"duration":   float64(len(pcmuData)) / 8000.0,
	}).Info("🎤 开始处理音频")
	
	// 1. 先解码 PCMU -> PCM 8kHz，进行质量检查和放大
	pcm8k := codec.PCMUToPCM16(pcmuData)
	
	// 检查音频质量
	if len(pcm8k) < 2 {
		logrus.WithField("call_id", h.callID).Warn("⚠️  音频数据太短，跳过识别")
		return
	}
	
	// 计算 8kHz PCM 的能量并进行放大处理
	var maxAbs int16
	var totalEnergy int64
	sampleCount := len(pcm8k) / 2
	pcmSamples := make([]int16, sampleCount)
	
	for i := 0; i < sampleCount; i++ {
		low := int16(pcm8k[i*2])
		high := int16(pcm8k[i*2+1])
		sample := high<<8 | low
		pcmSamples[i] = sample
		
		abs := sample
		if abs < 0 {
			abs = -abs
		}
		if abs > maxAbs {
			maxAbs = abs
		}
		totalEnergy += int64(sample) * int64(sample)
	}
	
	avgEnergy := totalEnergy / int64(sampleCount)
	
	logrus.WithFields(logrus.Fields{
		"call_id":    h.callID,
		"max_amp":    maxAbs,
		"avg_energy": avgEnergy,
		"samples":    sampleCount,
	}).Info("🔊 8kHz PCM 音频统计")
	
	// 如果音频太小，进行放大（归一化到 -16000 ~ 16000 范围）
	if maxAbs > 0 && maxAbs < 8000 {
		amplification := float64(16000) / float64(maxAbs)
		if amplification > 4.0 {
			amplification = 4.0
		}
		
		logrus.WithFields(logrus.Fields{
			"call_id":       h.callID,
			"amplification": amplification,
		}).Info("🔊 音频太小，进行放大")
		
		for i := range pcmSamples {
			amplified := int32(float64(pcmSamples[i]) * amplification)
			if amplified > 32767 {
				amplified = 32767
			} else if amplified < -32768 {
				amplified = -32768
			}
			pcmSamples[i] = int16(amplified)
		}
		
		// 更新 pcm8k 字节数组
		for i, sample := range pcmSamples {
			pcm8k[i*2] = byte(sample & 0xFF)
			pcm8k[i*2+1] = byte((sample >> 8) & 0xFF)
		}
	}
	
	// 2. 重采样到 16kHz（腾讯云 ASR 需要 16kHz）
	pcm16k := codec.ResampleAudio(pcm8k, 8000, 16000)
	
	// 计算 16kHz PCM 的能量
	var maxAbs16k int16
	var totalEnergy16k int64
	sampleCount16k := len(pcm16k) / 2
	for i := 0; i < sampleCount16k; i++ {
		low := int16(pcm16k[i*2])
		high := int16(pcm16k[i*2+1])
		sample := high<<8 | low
		
		abs := sample
		if abs < 0 {
			abs = -abs
		}
		if abs > maxAbs16k {
			maxAbs16k = abs
		}
		totalEnergy16k += int64(sample) * int64(sample)
	}
	
	avgEnergy16k := totalEnergy16k / int64(sampleCount16k)
	
	logrus.WithFields(logrus.Fields{
		"call_id":    h.callID,
		"max_amp":    maxAbs16k,
		"avg_energy": avgEnergy16k,
		"samples":    sampleCount16k,
	}).Info("🔊 16kHz PCM 音频统计")
	
	// 如果音频能量太低，跳过
	if avgEnergy16k < 50000 {
		logrus.WithFields(logrus.Fields{
			"call_id": h.callID,
			"energy":  avgEnergy16k,
		}).Warn("⚠️  音频能量太低，可能是静音，跳过识别")
		return
	}
	
	logrus.WithField("call_id", h.callID).Info("✅ 音频质量检查通过，开始 ASR 识别")
	
	// 2. ASR 识别 - 使用独立的 context，不受通话结束影响
	// TranscribeService 使用 Init + SendAudioBytes + SendEnd 的流式接口
	var recognizedText string
	var asrErr error
	done := make(chan bool, 1) // 使用缓冲 channel
	
	h.asrTranscriber.Init(
		func(text string, isLast bool, duration time.Duration, uuid string) {
			logrus.WithFields(logrus.Fields{
				"call_id": h.callID,
				"text":    text,
				"isLast":  isLast,
			}).Debug("ASR 回调")
			
			if text != "" {
				recognizedText = text
			}
			// 无论 isLast 是否为 true，只要有文本就触发完成
			// 因为腾讯云 ASR 可能只调用 OnSentenceEnd 而不调用 OnRecognitionComplete
			if text != "" {
				select {
				case done <- true:
				default:
					// channel 已满，忽略
				}
			}
			if isLast {
				select {
				case done <- true:
				default:
					// channel 已满，忽略
				}
			}
		},
		func(err error, isFatal bool) {
			asrErr = err
			select {
			case done <- true:
			default:
				// channel 已满，忽略
			}
		},
	)
	
	// 连接并发送音频
	if err := h.asrTranscriber.ConnAndReceive(h.callID); err != nil {
		logrus.WithFields(logrus.Fields{
			"call_id": h.callID,
			"error":   err,
		}).Error("❌ ASR 连接失败")
		return
	}
	
	// 发送音频数据
	if err := h.asrTranscriber.SendAudioBytes(pcm16k); err != nil {
		logrus.WithFields(logrus.Fields{
			"call_id": h.callID,
			"error":   err,
		}).Error("❌ ASR 发送音频失败")
		return
	}
	
	// 发送结束标记
	if err := h.asrTranscriber.SendEnd(); err != nil {
		logrus.WithFields(logrus.Fields{
			"call_id": h.callID,
			"error":   err,
		}).Error("❌ ASR 发送结束标记失败")
		return
	}
	
	// 等待识别结果（带超时）
	select {
	case <-done:
		if asrErr != nil {
			logrus.WithFields(logrus.Fields{
				"call_id": h.callID,
				"error":   asrErr,
			}).Error("❌ ASR 识别失败")
			return
		}
	case <-time.After(15 * time.Second):
		logrus.WithField("call_id", h.callID).Error("❌ ASR 识别超时")
		return
	}
	
	text := recognizedText
	
	if text == "" {
		logrus.WithFields(logrus.Fields{
			"call_id":    h.callID,
			"duration":   float64(len(pcmuData)) / 8000.0,
			"energy":     avgEnergy16k,
		}).Warn("⚠️  ASR 未识别到内容")
		return
	}
	
	logrus.WithFields(logrus.Fields{
		"call_id": h.callID,
		"text":    text,
	}).Info("✓ ASR 识别结果")
	
	// 3. 检查关键词回复
	var aiResponse string
	if keywordReply, matched := h.checkKeywordReply(text); matched {
		// 使用关键词回复
		aiResponse = keywordReply
		logrus.WithFields(logrus.Fields{
			"call_id": h.callID,
			"reply":   aiResponse,
		}).Info("🎯 使用关键词回复")
	} else if h.sipUser != nil && h.sipUser.AIFreeResponse {
		// 4. 启用了AI自由回答，使用 LLM 对话
		var err error
		aiResponse, err = h.llmProvider.Query(text, "")
		if err != nil {
			logrus.WithFields(logrus.Fields{
				"call_id": h.callID,
				"error":   err,
			}).Error("❌ LLM 对话失败")
			
			// 如果配置了兜底回复，使用兜底回复
			if h.sipUser != nil && h.sipUser.FallbackMessage != "" {
				aiResponse = h.sipUser.FallbackMessage
				logrus.WithFields(logrus.Fields{
					"call_id": h.callID,
					"reply":   aiResponse,
				}).Info("🔄 使用兜底回复")
			} else {
				return
			}
		} else {
			logrus.WithFields(logrus.Fields{
				"call_id":  h.callID,
				"response": aiResponse,
			}).Info("🤖 LLM 自由回复")
		}
	} else {
		// 5. 未启用AI自由回答，使用兜底回复或跳过
		if h.sipUser != nil && h.sipUser.FallbackMessage != "" {
			aiResponse = h.sipUser.FallbackMessage
			logrus.WithFields(logrus.Fields{
				"call_id": h.callID,
				"reply":   aiResponse,
			}).Info("🔄 使用兜底回复（AI自由回答已禁用）")
		} else {
			logrus.WithField("call_id", h.callID).Info("⚠️  AI自由回答已禁用且无兜底回复，跳过")
			return
		}
	}
	
	// 增加对话轮次计数
	h.conversationCount++
	
	// 检查是否需要进入留言阶段（对话2轮后且启用了录音）
	shouldEnterMessage := false
	if h.sipUser != nil && h.sipUser.RecordingEnabled && h.conversationCount >= 2 {
		shouldEnterMessage = true
	}
	
	// 5. TTS 合成 - 使用独立的 context
	ttsCtx, ttsCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer ttsCancel()
	
	// 如果需要进入留言阶段，在AI回复后添加留言提示
	ttsText := aiResponse
	if shouldEnterMessage {
		// 固定提示语
		messagePrompt := "您有15秒的时间进行留言"
		ttsText = aiResponse + "。" + messagePrompt
		
		logrus.WithFields(logrus.Fields{
			"call_id": h.callID,
			"prompt":  messagePrompt,
		}).Info("📞 准备进入留言阶段")
	}
	
	// 创建 TTS handler 来接收音频数据
	ttsBuffer := &synthesizer.SynthesisBuffer{}
	if err := h.ttsService.Synthesize(ttsCtx, ttsBuffer, ttsText); err != nil {
		logrus.WithFields(logrus.Fields{
			"call_id": h.callID,
			"error":   err,
		}).Error("❌ TTS 合成失败")
		return
	}
	
	audioResponse := ttsBuffer.Data
	
	logrus.WithFields(logrus.Fields{
		"call_id": h.callID,
		"bytes":   len(audioResponse),
	}).Info("🔊 TTS 合成成功")
	
	// 6. 发送音频到客户端
	h.sendAudioToClient(audioResponse)
	
	// 7. 如果需要进入留言阶段，播放完后进入留言状态
	if shouldEnterMessage {
		// 等待音频播放完成（估算播放时间）
		playbackDuration := time.Duration(len(audioResponse)/32) * time.Millisecond // 16kHz PCM16 = 32000 bytes/sec
		time.Sleep(playbackDuration + 500*time.Millisecond) // 额外等待500ms
		
		h.enterMessageMode()
	} else if !h.isRecording {
		// 如果未启用录音且对话2轮后，直接挂断
		if h.conversationCount >= 2 {
			logrus.WithField("call_id", h.callID).Info("📞 对话结束，未启用录音，准备挂断")
			time.Sleep(2 * time.Second) // 等待2秒后挂断
			h.cancel()
		}
	}
}

// enterMessageMode 进入留言阶段
func (h *VoiceConversationHandler) enterMessageMode() {
	h.recordingMutex.Lock()
	h.isInMessageMode = true
	h.messageStartTime = time.Now()
	h.recordingMutex.Unlock()
	
	logrus.WithField("call_id", h.callID).Info("📞 已进入留言阶段，继续录音15秒")
	
	// 启动定时器，15秒后自动结束
	go func() {
		time.Sleep(15 * time.Second)
		h.recordingMutex.Lock()
		if h.isInMessageMode {
			h.recordingMutex.Unlock()
			logrus.WithField("call_id", h.callID).Info("📞 留言时间到，自动挂断")
			h.cancel() // 触发挂断
		} else {
			h.recordingMutex.Unlock()
		}
	}()
}

// checkKeywordReply 检查是否匹配关键词回复
func (h *VoiceConversationHandler) checkKeywordReply(text string) (string, bool) {
	if h.sipUser == nil || len(h.sipUser.KeywordReplies) == 0 {
		return "", false
	}
	
	// 遍历关键词列表，检查是否匹配
	for _, kr := range h.sipUser.KeywordReplies {
		if kr.Keyword != "" && containsKeyword(text, kr.Keyword) {
			logrus.WithFields(logrus.Fields{
				"call_id": h.callID,
				"keyword": kr.Keyword,
				"reply":   kr.Reply,
			}).Info("🎯 匹配到关键词回复")
			return kr.Reply, true
		}
	}
	
	return "", false
}

// containsKeyword 检查文本是否包含关键词（简单的子串匹配）
func containsKeyword(text, keyword string) bool {
	// 可以扩展为更复杂的匹配逻辑（如正则表达式、模糊匹配等）
	return len(text) > 0 && len(keyword) > 0 && 
		(text == keyword || 
		 len(text) >= len(keyword) && 
		 (text[:len(keyword)] == keyword || 
		  text[len(text)-len(keyword):] == keyword ||
		  findSubstring(text, keyword)))
}

// findSubstring 查找子串
func findSubstring(text, keyword string) bool {
	for i := 0; i <= len(text)-len(keyword); i++ {
		if text[i:i+len(keyword)] == keyword {
			return true
		}
	}
	return false
}

// playOpeningMessage 播放开场白
func (h *VoiceConversationHandler) playOpeningMessage() {
	if h.sipUser == nil || h.sipUser.OpeningMessage == "" {
		return
	}
	
	// TTS 合成开场白
	ttsCtx, ttsCancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer ttsCancel()
	
	ttsBuffer := &synthesizer.SynthesisBuffer{}
	err := h.ttsService.Synthesize(ttsCtx, ttsBuffer, h.sipUser.OpeningMessage)
	if err != nil {
		logrus.WithFields(logrus.Fields{
			"call_id": h.callID,
			"error":   err,
		}).Error("❌ 开场白 TTS 合成失败")
		return
	}
	
	audioData := ttsBuffer.Data
	
	logrus.WithFields(logrus.Fields{
		"call_id": h.callID,
		"bytes":   len(audioData),
	}).Info("🔊 开场白合成成功")
	
	// 发送音频到客户端
	h.sendAudioToClient(audioData)
	
	// 标记已播放开场白
	h.isFirstMessage = false
}

// sendAudioToClient 发送音频到客户端
func (h *VoiceConversationHandler) sendAudioToClient(audioData []byte) {
	logrus.WithFields(logrus.Fields{
		"call_id": h.callID,
		"bytes":   len(audioData),
	}).Info("📤 准备发送音频")
	
	// 获取 TTS 服务的实际采样率
	ttsFormat := h.ttsService.Format()
	ttsSampleRate := ttsFormat.SampleRate
	
	logrus.WithFields(logrus.Fields{
		"call_id":         h.callID,
		"tts_sample_rate": ttsSampleRate,
		"target_rate":     8000,
	}).Info("🔄 TTS 采样率信息")
	
	// 1. 重采样到 8kHz（如果需要）
	var pcm8k []byte
	if ttsSampleRate != 8000 {
		pcm8k = codec.ResampleAudio(audioData, ttsSampleRate, 8000)
		logrus.WithFields(logrus.Fields{
			"call_id":   h.callID,
			"pcm_in":    len(audioData),
			"pcm_out":   len(pcm8k),
			"from_rate": ttsSampleRate,
			"to_rate":   8000,
		}).Info("🔄 重采样完成")
	} else {
		pcm8k = audioData
		logrus.WithField("call_id", h.callID).Info("🔄 采样率已是 8kHz，跳过重采样")
	}
	
	// 2. 转换为 PCMU
	pcmuData := codec.PCM16ToPCMU(pcm8k)
	
	logrus.WithFields(logrus.Fields{
		"call_id":  h.callID,
		"pcmu_len": len(pcmuData),
	}).Info("🔄 PCM -> PCMU 转换完成")
	
	// 3. 如果启用了录音，将AI的音频也添加到录音缓冲区
	if h.isRecording {
		h.recordingMutex.Lock()
		h.recordingBuffer = append(h.recordingBuffer, pcmuData...)
		h.recordingMutex.Unlock()
		
		logrus.WithFields(logrus.Fields{
			"call_id":        h.callID,
			"ai_audio_size":  len(pcmuData),
			"total_recorded": len(h.recordingBuffer),
		}).Info("📼 AI音频已添加到录音缓冲区")
	}
	
	// 4. 分包发送
	h.sendPCMUPackets(pcmuData)
}

// sendPCMUPackets 发送 PCMU 数据包
func (h *VoiceConversationHandler) sendPCMUPackets(pcmuData []byte) {
	packetSize := 160 // 20ms @ 8kHz
	packetsCount := (len(pcmuData) + packetSize - 1) / packetSize
	
	logrus.WithFields(logrus.Fields{
		"call_id":       h.callID,
		"packets":       packetsCount,
		"client_addr":   h.clientRTPAddr.String(),
	}).Info("📦 开始发送 RTP 包")
	
	h.rtpMutex.Lock()
	seqNum := h.rtpSeqNum
	timestamp := h.rtpTimestamp
	h.rtpMutex.Unlock()
	
	for i := 0; i < packetsCount; i++ {
		start := i * packetSize
		end := start + packetSize
		if end > len(pcmuData) {
			end = len(pcmuData)
			// 填充静音
			padding := make([]byte, packetSize-(end-start))
			for j := range padding {
				padding[j] = 0xFF // PCMU 静音值
			}
			pcmuData = append(pcmuData[:end], padding...)
			end = start + packetSize
		}
		
		payload := pcmuData[start:end]
		
		packet := &rtp.Packet{
			Header: rtp.Header{
				Version:        2,
				Padding:        false,
				Extension:      false,
				Marker:         i == packetsCount-1,
				PayloadType:    0, // PCMU
				SequenceNumber: seqNum,
				Timestamp:      timestamp,
				SSRC:           h.rtpSSRC,
			},
			Payload: payload,
		}
		
		packetBytes, err := packet.Marshal()
		if err != nil {
			logrus.WithFields(logrus.Fields{
				"call_id": h.callID,
				"error":   err,
			}).Error("❌ 序列化 RTP 包失败")
			continue
		}
		
		_, err = h.rtpConn.WriteToUDP(packetBytes, h.clientRTPAddr)
		if err != nil {
			logrus.WithFields(logrus.Fields{
				"call_id": h.callID,
				"error":   err,
			}).Error("❌ 发送 RTP 包失败")
			return
		}
		
		seqNum++
		timestamp += 160
		
		time.Sleep(20 * time.Millisecond)
	}
	
	// 更新序列号和时间戳
	h.rtpMutex.Lock()
	h.rtpSeqNum = seqNum
	h.rtpTimestamp = timestamp
	h.rtpMutex.Unlock()
	
	logrus.WithField("call_id", h.callID).Info("✓ 音频发送完成")
}

// processAudioLoop 音频处理循环
func (h *VoiceConversationHandler) processAudioLoop() {
	defer h.wg.Done()
	
	ticker := time.NewTicker(h.bufferDuration)
	defer ticker.Stop()
	
	for {
		select {
		case <-h.ctx.Done():
			return
		case <-ticker.C:
			// 定期检查缓冲区
			h.bufferMutex.Lock()
			bufferLen := len(h.audioBuffer)
			h.bufferMutex.Unlock()
			
			if bufferLen >= h.minAudioLength {
				h.tryProcessBuffer()
			}
		}
	}
}

// GetRecordingAudio 获取全程录音数据
func (h *VoiceConversationHandler) GetRecordingAudio() []byte {
	h.recordingMutex.Lock()
	defer h.recordingMutex.Unlock()
	
	if len(h.recordingBuffer) == 0 {
		return nil
	}
	
	// 复制一份返回
	audio := make([]byte, len(h.recordingBuffer))
	copy(audio, h.recordingBuffer)
	return audio
}

// IsInMessageMode 检查是否在留言阶段
func (h *VoiceConversationHandler) IsInMessageMode() bool {
	h.recordingMutex.Lock()
	defer h.recordingMutex.Unlock()
	return h.isInMessageMode
}

// IsRecording 检查是否启用了录音
func (h *VoiceConversationHandler) IsRecording() bool {
	return h.isRecording
}


// SaveVoicemail 保存留言到数据库
func (h *VoiceConversationHandler) SaveVoicemail(db *gorm.DB, callerNumber string, sipCallID *uint) (*models.Voicemail, error) {
	h.recordingMutex.Lock()
	defer h.recordingMutex.Unlock()
	
	if len(h.recordingBuffer) == 0 {
		return nil, fmt.Errorf("没有录音数据")
	}
	
	// 获取用户ID
	var userID uint
	if h.sipUser != nil && h.sipUser.UserID != nil {
		userID = *h.sipUser.UserID
	} else {
		return nil, fmt.Errorf("无法确定用户ID")
	}
	
	// 创建留言记录（实际上是通话录音）
	voicemail := &models.Voicemail{
		UserID:           userID,
		CallerNumber:     callerNumber,
		AudioFormat:      "pcmu",
		AudioSize:        int64(len(h.recordingBuffer)),
		Duration:         len(h.recordingBuffer) / 8000, // 估算时长（秒）
		SampleRate:       8000,
		Channels:         1,
		Status:           models.VoicemailStatusNew,
		IsRead:           false,
		TranscribeStatus: "pending",
	}
	
	if h.sipUser != nil {
		voicemail.SipUserID = &h.sipUser.ID
	}
	
	if sipCallID != nil {
		voicemail.SipCallID = sipCallID
	}
	
	// 保存到数据库
	if err := models.CreateVoicemail(db, voicemail); err != nil {
		return nil, fmt.Errorf("创建留言记录失败: %w", err)
	}
	
	logrus.WithFields(logrus.Fields{
		"voicemail_id":  voicemail.ID,
		"caller_number": callerNumber,
		"audio_size":    len(h.recordingBuffer),
		"duration":      voicemail.Duration,
	}).Info("✅ 通话录音已保存到数据库")
	
	return voicemail, nil
}

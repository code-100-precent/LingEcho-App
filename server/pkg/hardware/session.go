package hardware

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/code-100-precent/LingEcho/pkg/hardware/asr"
	"github.com/code-100-precent/LingEcho/pkg/hardware/audio"
	"github.com/code-100-precent/LingEcho/pkg/hardware/errhandler"
	"github.com/code-100-precent/LingEcho/pkg/hardware/factory"
	"github.com/code-100-precent/LingEcho/pkg/hardware/filter"
	"github.com/code-100-precent/LingEcho/pkg/hardware/llm"
	"github.com/code-100-precent/LingEcho/pkg/hardware/message"
	"github.com/code-100-precent/LingEcho/pkg/hardware/recording"
	"github.com/code-100-precent/LingEcho/pkg/hardware/state"
	"github.com/code-100-precent/LingEcho/pkg/hardware/tts"
	"github.com/code-100-precent/LingEcho/pkg/media"
	"github.com/code-100-precent/LingEcho/pkg/media/encoder"
	"github.com/code-100-precent/LingEcho/pkg/recognizer"
	"github.com/gorilla/websocket"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// Session 语音会话实现
type Session struct {
	config        *SessionConfig
	ctx           context.Context
	cancel        context.CancelFunc
	stateManager  *state.Manager
	errorHandler  *errhandler.Handler
	asrService    *asr.Service
	ttsService    *tts.Service
	llmService    *llm.Service
	messageWriter *message.Writer
	processor     *message.Processor
	audioManager  *audio.Manager
	vadDetector   *VADDetector // VAD 检测器用于 barge-in
	mu            sync.RWMutex
	active        bool

	// 录音相关
	recordingManager *recording.RecordingManager
	recordingSession *recording.RecordingSession
	db               *gorm.DB

	// 音频格式配置（从硬件获取）
	audioFormat string // opus, pcm, etc.
	sampleRate  int    // 8000, 16000, etc.
	channels    int    // 1, 2

	// 音频编解码器
	opusDecoder media.EncoderFunc // OPUS -> PCM (for ASR)
	opusEncoder media.EncoderFunc // PCM -> OPUS (for TTS)
}

// NewSession 创建新的语音会话
func NewSession(config *SessionConfig) (*Session, error) {
	if config == nil {
		return nil, errhandler.NewRecoverableError("Session", "配置不能为空", nil)
	}

	if config.Conn == nil {
		return nil, errhandler.NewRecoverableError("Session", "WebSocket连接不能为空", nil)
	}

	if config.Logger == nil {
		config.Logger = zap.L()
	}

	if config.Context == nil {
		config.Context = context.Background()
	}

	ctx, cancel := context.WithCancel(config.Context)

	// 创建状态管理器
	stateManager := state.NewManager()

	// 创建错误处理器
	errorHandler := errhandler.NewHandler(config.Logger)

	// 创建服务工厂
	transcriberFactory := recognizer.GetGlobalFactory()
	serviceFactory := factory.NewServiceFactory(transcriberFactory, config.Logger)

	// 创建消息写入器
	messageWriter := message.NewWriter(config.Conn, config.Logger)

	// 创建ASR服务（使用默认配置，hello消息后会重新初始化）
	transcriber, err := serviceFactory.CreateASR(config.Credential, config.Language, 0, 0)
	if err != nil {
		cancel()
		return nil, errhandler.NewRecoverableError("Session", "创建ASR服务失败", err)
	}

	asrService := asr.NewService(
		ctx,
		config.Credential,
		config.Language,
		transcriber,
		errorHandler,
		config.Logger,
	)

	// 创建TTS服务（使用默认配置，hello消息后会重新初始化）
	synthesizer, err := serviceFactory.CreateTTS(config.Credential, config.Speaker, 0, 0)
	if err != nil {
		cancel()
		return nil, errhandler.NewRecoverableError("Session", "创建TTS服务失败", err)
	}

	ttsService := tts.NewService(
		ctx,
		config.Credential,
		config.Speaker,
		synthesizer,
		errorHandler,
		config.Logger,
	)

	// 创建LLM服务
	llmProvider, err := serviceFactory.CreateLLM(ctx, config.Credential, config.SystemPrompt)
	if err != nil {
		cancel()
		return nil, errhandler.NewRecoverableError("Session", "创建LLM服务失败", err)
	}

	llmService := llm.NewService(
		ctx,
		config.Credential,
		config.SystemPrompt,
		config.LLMModel,
		config.Temperature,
		config.MaxTokens,
		llmProvider,
		errorHandler,
		config.Logger,
	)

	// 创建过滤词管理器
	filterManager, err := filter.NewManager(config.Logger)
	if err != nil {
		config.Logger.Warn("创建过滤词管理器失败，将不使用过滤功能", zap.Error(err))
		filterManager = nil
	}

	// 创建音频管理器（解决TTS冲突问题）
	// 使用默认采样率，hello消息后会更新
	audioManager := audio.NewManager(16000, 1, config.Logger)

	// 创建 VAD 检测器，使用配置中的参数
	vadDetector := NewVADDetector()
	vadDetector.SetLogger(config.Logger) // 设置日志记录器
	if config.EnableVAD {
		vadDetector.SetEnabled(true)
		vadDetector.SetThreshold(config.VADThreshold)
		// 如果阈值很低（<200），自动降低连续帧数要求以提高灵敏度
		consecutiveFrames := config.VADConsecutiveFrames
		if config.VADThreshold < 200 && consecutiveFrames > 1 {
			consecutiveFrames = 1
			config.Logger.Info("VAD阈值较低，自动降低连续帧数要求以提高灵敏度",
				zap.Float64("threshold", config.VADThreshold),
				zap.Int("originalFrames", config.VADConsecutiveFrames),
				zap.Int("adjustedFrames", consecutiveFrames),
			)
		}
		vadDetector.SetConsecutiveFrames(consecutiveFrames)
	} else {
		vadDetector.SetEnabled(false)
	}

	// 创建录音管理器
	var recordingManager *recording.RecordingManager
	var db *gorm.DB
	if config.DB != nil {
		db = config.DB
		recordingManager = recording.NewRecordingManager(db, config.Logger, config.RecordingPath)
	}

	// 创建消息处理器
	processor := message.NewProcessor(
		stateManager,
		llmService,
		ttsService,
		messageWriter,
		errorHandler,
		config.Logger,
		synthesizer,
		filterManager,
		audioManager,
		config.Credential, // 新增：传入credential
	)

	session := &Session{
		config:           config,
		ctx:              ctx,
		cancel:           cancel,
		stateManager:     stateManager,
		errorHandler:     errorHandler,
		asrService:       asrService,
		ttsService:       ttsService,
		llmService:       llmService,
		messageWriter:    messageWriter,
		processor:        processor,
		audioManager:     audioManager,
		vadDetector:      vadDetector,
		recordingManager: recordingManager,
		db:               db,
		audioFormat:      "opus",
		sampleRate:       16000,
		channels:         1,
		active:           false,
	}

	// 设置默认音频配置（hello消息后会更新）
	processor.SetAudioConfig("opus", 16000, 1, nil)

	// 设置AI回复回调函数（用于录音）
	processor.SetAIResponseCallback(func(text string) {
		if session.recordingSession != nil {
			session.recordingSession.AddAIResponse(text)
		}
	})

	// 设置用户输入回调函数（用于录音）
	processor.SetUserInputCallback(func(text string) {
		if session.recordingSession != nil {
			session.recordingSession.AddUserInput(text)
		}
	})

	// 设置ASR回调
	asrService.SetCallbacks(
		func(text string, isLast bool, duration time.Duration, uuid string) {
			// 处理ASR结果
			incremental := stateManager.UpdateASRText(text, isLast)
			if incremental != "" {
				processor.ProcessASRResult(ctx, incremental)
			}

			// 记录用户输入到录音会话 - 只记录最终结果
			if isLast && text != "" {
				// 计算ASR开始和结束时间
				endTime := time.Now()
				startTime := endTime.Add(-duration)

				// 先确保有用户轮次（如果还没有的话）
				processor.RecordUserTurnStartIfNeeded()

				// 记录ASR时间到录音会话
				if session.recordingSession != nil {
					session.recordingSession.RecordASRTiming(startTime, endTime, text)
				}

				// 记录ASR时间到processor
				processor.RecordASRTiming(startTime, endTime, text)

				// 结束用户轮次
				processor.RecordUserTurnEnd(text)

				processor.ProcessUserInput(text)
			} else if incremental != "" && !isLast {
				// 如果是第一次收到ASR增量结果，创建用户轮次
				processor.RecordUserTurnStartIfNeeded()
			}
		},
		func(err error) {
			classified := errorHandler.HandleError(err, "ASR")
			if classifiedErr, ok := classified.(*errhandler.Error); ok && classifiedErr.Type == errhandler.ErrorTypeFatal {
				stateManager.SetFatalError(true)
				messageWriter.SendError("ASR错误: "+err.Error(), true)
			}
		},
	)

	return session, nil
}

// Start 启动会话
func (s *Session) Start() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.active {
		return nil
	}

	// 连接ASR服务
	if err := s.asrService.Connect(); err != nil {
		return errhandler.NewRecoverableError("Session", "连接ASR服务失败", err)
	}

	// 等待ASR连接建立
	time.Sleep(DefaultASRConnectionDelay)

	// 开始录音（如果录音管理器可用）
	if s.recordingManager != nil && s.config.UserID > 0 && s.config.AssistantID > 0 {
		recordingConfig := &recording.RecordingConfig{
			UserID:      s.config.UserID,
			AssistantID: uint(s.config.AssistantID),
			DeviceID:    s.config.DeviceID,
			MacAddress:  s.config.MacAddress,
			SessionID:   fmt.Sprintf("session_%d_%d", time.Now().Unix(), s.config.UserID),
			AudioFormat: s.audioFormat,
			SampleRate:  s.sampleRate,
			Channels:    s.channels,
			CallType:    "voice",
		}

		recordingSession, err := s.recordingManager.StartRecording(recordingConfig)
		if err != nil {
			s.config.Logger.Warn("启动录音失败", zap.Error(err))
		} else {
			s.recordingSession = recordingSession
			// 设置录音会话到processor，用于时间记录
			s.processor.SetRecordingSession(recordingSession)
			s.config.Logger.Info("录音已启动",
				zap.String("session_id", recordingConfig.SessionID),
				zap.String("mac_address", recordingConfig.MacAddress))
		}
	}

	// 更新设备在线状态（如果有MAC地址和数据库连接）
	if s.db != nil && s.config.MacAddress != "" {
		err := models.UpdateDeviceOnlineStatus(s.db, s.config.MacAddress, true)
		if err != nil {
			s.config.Logger.Warn("更新设备在线状态失败",
				zap.Error(err),
				zap.String("mac_address", s.config.MacAddress))
		} else {
			s.config.Logger.Info("设备已上线",
				zap.String("mac_address", s.config.MacAddress))
		}
	}

	// 发送连接成功消息
	if err := s.messageWriter.SendConnected(); err != nil {
		s.config.Logger.Error("发送连接成功消息失败", zap.Error(err))
	}

	s.active = true

	// 启动消息处理循环
	go s.messageLoop()

	return nil
}

// Stop 停止会话
func (s *Session) Stop() error {
	return s.stopWithReason("user_disconnect")
}

// StopWithTimeout 因超时停止会话
func (s *Session) StopWithTimeout() error {
	return s.stopWithReason("timeout")
}

// StopWithError 因错误停止会话
func (s *Session) StopWithError(err error) error {
	// 记录错误到设备错误日志
	if s.db != nil && s.config.MacAddress != "" {
		logErr := models.LogDeviceError(s.db, s.config.MacAddress, s.config.MacAddress,
			"session_error", "ERROR", "SESSION_STOP", err.Error(), "", "")
		if logErr != nil {
			s.config.Logger.Warn("记录设备错误失败", zap.Error(logErr))
		}
	}

	return s.stopWithReason("error")
}

// stopWithReason 带原因停止会话
func (s *Session) stopWithReason(reason string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if !s.active {
		return nil
	}

	// 停止录音（如果正在录音）
	if s.recordingSession != nil {
		callStatus := "completed"
		switch reason {
		case "timeout":
			callStatus = "interrupted"
		case "error":
			callStatus = "error"
		case "user_disconnect":
			callStatus = "completed"
		default:
			callStatus = "interrupted"
		}

		recording, err := s.recordingSession.StopRecording(callStatus)
		if err != nil {
			s.config.Logger.Error("停止录音失败", zap.Error(err))
		} else if recording != nil {
			s.config.Logger.Info("录音已保存",
				zap.Uint("recording_id", recording.ID),
				zap.String("audio_path", recording.AudioPath),
				zap.String("storage_url", recording.StorageURL),
				zap.Int("duration", recording.Duration),
				zap.String("call_status", callStatus),
				zap.String("stop_reason", reason))
		}
		s.recordingSession = nil
	}

	// 更新设备离线状态和性能数据（如果有MAC地址和数据库连接）
	if s.db != nil && s.config.MacAddress != "" {
		// 记录最后的性能数据
		if s.config.UserID > 0 {
			perfErr := models.LogDevicePerformance(s.db, s.config.MacAddress, s.config.MacAddress,
				0.0, 0.0, 0.0, 0) // 停止时的性能数据为0
			if perfErr != nil {
				s.config.Logger.Warn("记录设备性能数据失败", zap.Error(perfErr))
			}
		}

		// 更新设备离线状态
		err := models.UpdateDeviceOnlineStatus(s.db, s.config.MacAddress, false)
		if err != nil {
			s.config.Logger.Warn("更新设备离线状态失败",
				zap.Error(err),
				zap.String("mac_address", s.config.MacAddress))
		} else {
			s.config.Logger.Info("设备已离线",
				zap.String("mac_address", s.config.MacAddress),
				zap.String("stop_reason", reason))
		}
	}

	// 先取消所有TTS操作，避免在关闭过程中产生panic
	if s.stateManager != nil {
		s.stateManager.SetTTSPlaying(false)
		s.stateManager.CancelTTS()
	}

	// 取消session context，这会停止所有相关的goroutine
	s.cancel()

	// 断开ASR服务
	if s.asrService != nil {
		s.asrService.Disconnect()
	}

	// 关闭TTS服务
	if s.ttsService != nil {
		s.ttsService.Close()
	}

	// 关闭LLM服务
	if s.llmService != nil {
		s.llmService.Close()
	}

	// 关闭消息写入器
	if s.messageWriter != nil {
		s.messageWriter.Close()
	}

	// 清空状态
	if s.stateManager != nil {
		s.stateManager.Clear()
	}

	// 清空音频管理器
	if s.audioManager != nil {
		s.audioManager.Clear()
	}

	s.active = false

	return nil
}

// HandleAudio 处理音频数据（解决TTS冲突问题）
func (s *Session) HandleAudio(data []byte) error {
	s.mu.RLock()
	active := s.active
	audioManager := s.audioManager
	vadDetector := s.vadDetector
	ttsPlaying := s.stateManager.IsTTSPlaying()
	recordingSession := s.recordingSession
	s.mu.RUnlock()

	if !active {
		return errhandler.NewRecoverableError("Session", "会话未激活", nil)
	}

	// 检查状态
	if s.stateManager.IsFatalError() {
		return nil
	}

	// 处理音频数据：如果是OPUS格式，需要先解码为PCM
	var pcmData []byte
	if s.audioFormat == "opus" && s.opusDecoder != nil {
		audioPacket := &media.AudioPacket{Payload: data}
		frames, err := s.opusDecoder(audioPacket)
		if err != nil {
			s.config.Logger.Warn("OPUS解码失败", zap.Error(err), zap.Int("dataSize", len(data)))
			return nil
		}
		if len(frames) > 0 {
			if af, ok := frames[0].(*media.AudioPacket); ok {
				pcmData = af.Payload
			}
		}
	} else {
		// 已经是PCM格式，直接使用
		pcmData = data
	}

	// 录音PCM数据（解码后的格式，用于录音）
	if recordingSession != nil && len(pcmData) > 0 {
		if err := recordingSession.WriteAudio(pcmData); err != nil {
			s.config.Logger.Warn("写入录音数据失败", zap.Error(err))
		}
	}

	if len(pcmData) == 0 {
		return nil
	}

	// 如果 TTS 正在播放，使用 VAD 检测 barge-in
	if ttsPlaying {
		// 检测用户是否说话（barge-in）
		if vadDetector.CheckBargeIn(pcmData, true) {
			s.config.Logger.Info("检测到用户说话，中断 TTS")
			// 优雅地取消 TTS 播放：先设置状态，再取消context
			s.stateManager.SetTTSPlaying(false)
			s.stateManager.CancelTTS()

			// 发送TTS结束消息给前端
			if err := s.messageWriter.SendTTSEnd(); err != nil {
				s.config.Logger.Warn("发送TTS结束消息失败", zap.Error(err))
			}

			// 继续处理音频（用户开始说话了）
			// 使用音频管理器处理输入音频
			processedData, shouldProcess := audioManager.ProcessInputAudio(pcmData, false)
			if !shouldProcess {
				return nil
			}
			return s.asrService.SendAudio(processedData)
		}
		// TTS 播放中且未检测到用户说话，使用音频管理器过滤回音
		_, shouldProcess := audioManager.ProcessInputAudio(pcmData, true)
		if !shouldProcess {
			// 被过滤（可能是TTS回音或无效音频）
			return nil
		}
		// 即使通过过滤，也不发送到 ASR（TTS 播放中，等待 barge-in 或 TTS 结束）
		return nil
	}

	// TTS 未播放，正常处理音频
	// 使用音频管理器智能处理输入音频（解决TTS冲突）
	processedData, shouldProcess := audioManager.ProcessInputAudio(pcmData, false)
	if !shouldProcess {
		// 被过滤（可能是TTS回音或无效音频）
		return nil
	}

	// 发送到ASR服务
	return s.asrService.SendAudio(processedData)
}

// HandleText 处理文本消息
func (s *Session) HandleText(data []byte) error {
	s.mu.RLock()
	active := s.active
	processor := s.processor
	ctx := s.ctx
	s.mu.RUnlock()

	if !active {
		return errhandler.NewRecoverableError("Session", "会话未激活", nil)
	}

	var msg map[string]interface{}
	if err := json.Unmarshal(data, &msg); err != nil {
		s.config.Logger.Warn("解析文本消息失败", zap.Error(err))
		return nil
	}

	msgType, ok := msg["type"].(string)
	if !ok {
		return nil
	}

	switch msgType {
	case MessageTypeNewSession:
		// 新会话，清空消息历史
		processor.Clear()
		s.stateManager.Clear()
		s.audioManager.Clear()
		s.config.Logger.Info("新会话开始")

	case MessageTypePing:
		// 心跳消息，发送pong响应
		if err := s.messageWriter.SendPong(); err != nil {
			s.config.Logger.Warn("发送pong响应失败", zap.Error(err))
		} else {
			s.config.Logger.Debug("收到ping，已发送pong响应")
		}

	case "hello":
		// xiaozhi协议hello消息处理
		s.handleHelloMessage(msg)

	default:
		// 其他消息由processor处理
		processor.HandleTextMessage(ctx, data)
	}

	return nil
}

// handleHelloMessage 处理xiaozhi协议的hello消息
func (s *Session) handleHelloMessage(msg map[string]interface{}) {
	s.config.Logger.Info("收到hello消息", zap.Any("message", msg))

	// 提取audio_params
	audioFormat := "opus"
	sampleRate := 16000
	channels := 1
	frameDuration := "60ms"

	if audioParams, ok := msg["audio_params"].(map[string]interface{}); ok {
		if format, ok := audioParams["format"].(string); ok {
			audioFormat = format
		}
		if rate, ok := audioParams["sample_rate"].(float64); ok {
			sampleRate = int(rate)
		}
		if ch, ok := audioParams["channels"].(float64); ok {
			channels = int(ch)
		}
		if frameDur, ok := audioParams["frame_duration"].(float64); ok {
			frameDuration = fmt.Sprintf("%dms", int(frameDur))
		}
	}

	// 更新会话音频配置
	s.mu.Lock()
	s.audioFormat = audioFormat
	s.sampleRate = sampleRate
	s.channels = channels
	s.mu.Unlock()

	// 如果是OPUS格式，初始化编解码器
	if audioFormat == "opus" {
		if err := s.initializeOpusCodecs(sampleRate, channels, frameDuration); err != nil {
			s.config.Logger.Error("初始化OPUS编解码器失败", zap.Error(err))
			s.messageWriter.SendError(fmt.Sprintf("初始化OPUS编解码器失败: %v", err), true)
			return
		}

		// 更新processor的音频配置
		s.processor.SetAudioConfig(audioFormat, sampleRate, channels, s.opusEncoder)
	} else {
		// PCM格式
		s.processor.SetAudioConfig(audioFormat, sampleRate, channels, nil)
	}

	// 重新初始化ASR和TTS服务（使用正确的采样率）
	if err := s.reinitializeServices(sampleRate, channels); err != nil {
		s.config.Logger.Error("重新初始化服务失败", zap.Error(err))
		s.messageWriter.SendError(fmt.Sprintf("重新初始化服务失败: %v", err), true)
		return
	}

	// 更新音频管理器配置
	s.audioManager = audio.NewManager(sampleRate, channels, s.config.Logger)

	// 提取features
	var features map[string]interface{}
	if feat, ok := msg["features"].(map[string]interface{}); ok {
		features = feat
	}

	// 发送Welcome响应
	sessionID, err := s.messageWriter.SendWelcome(audioFormat, sampleRate, channels, features)
	if err != nil {
		s.config.Logger.Error("发送Welcome响应失败", zap.Error(err))
	} else {
		s.config.Logger.Info("已发送Welcome响应",
			zap.String("audioFormat", audioFormat),
			zap.Int("sampleRate", sampleRate),
			zap.Int("channels", channels),
			zap.String("sessionID", sessionID),
		)
	}
}

// initializeOpusCodecs 初始化OPUS编解码器
func (s *Session) initializeOpusCodecs(sampleRate, channels int, frameDuration string) error {
	// 创建OPUS解码器（OPUS -> PCM，用于ASR）
	opusDecoder, err := encoder.CreateDecode(
		media.CodecConfig{
			Codec:         "opus",
			SampleRate:    sampleRate,
			Channels:      channels,
			BitDepth:      16,
			FrameDuration: frameDuration,
		},
		media.CodecConfig{
			Codec:         "pcm",
			SampleRate:    sampleRate,
			Channels:      channels,
			BitDepth:      16,
			FrameDuration: frameDuration,
		},
	)
	if err != nil {
		return fmt.Errorf("创建OPUS解码器失败: %w", err)
	}
	s.opusDecoder = opusDecoder

	// 创建OPUS编码器（PCM -> OPUS，用于TTS）
	opusEncoder, err := encoder.CreateEncode(
		media.CodecConfig{
			Codec:         "opus",
			SampleRate:    sampleRate,
			Channels:      channels,
			BitDepth:      16,
			FrameDuration: frameDuration,
		},
		media.CodecConfig{
			Codec:         "pcm",
			SampleRate:    sampleRate,
			Channels:      channels,
			BitDepth:      16,
			FrameDuration: frameDuration,
		},
	)
	if err != nil {
		return fmt.Errorf("创建OPUS编码器失败: %w", err)
	}
	s.opusEncoder = opusEncoder

	return nil
}

// reinitializeServices 重新初始化ASR和TTS服务
func (s *Session) reinitializeServices(sampleRate, channels int) error {
	transcriberFactory := recognizer.GetGlobalFactory()
	serviceFactory := factory.NewServiceFactory(transcriberFactory, s.config.Logger)

	// 停止旧的ASR服务
	s.config.Logger.Info("停止旧的ASR服务")
	if s.asrService != nil {
		s.asrService.Disconnect()
	}

	// 重新初始化ASR服务（使用硬件的采样率）
	s.config.Logger.Info("重新初始化ASR服务",
		zap.Int("sampleRate", sampleRate),
		zap.Int("channels", channels),
	)
	transcriber, err := serviceFactory.CreateASR(s.config.Credential, s.config.Language, sampleRate, channels)
	if err != nil {
		return fmt.Errorf("重新初始化ASR服务失败: %w", err)
	}

	// 创建新的ASR服务
	newASRService := asr.NewService(
		s.ctx,
		s.config.Credential,
		s.config.Language,
		transcriber,
		s.errorHandler,
		s.config.Logger,
	)

	// 设置ASR回调
	newASRService.SetCallbacks(
		func(text string, isLast bool, duration time.Duration, uuid string) {
			incremental := s.stateManager.UpdateASRText(text, isLast)
			if incremental != "" {
				s.processor.ProcessASRResult(s.ctx, incremental)
			}

			// 记录用户输入到录音会话 - 只记录最终结果
			if isLast && text != "" {
				s.processor.ProcessUserInput(text)
			}
		},
		func(err error) {
			classified := s.errorHandler.HandleError(err, "ASR")
			if classifiedErr, ok := classified.(*errhandler.Error); ok && classifiedErr.Type == errhandler.ErrorTypeFatal {
				s.stateManager.SetFatalError(true)
				s.messageWriter.SendError("ASR错误: "+err.Error(), true)
			}
		},
	)

	// 连接ASR服务
	if err := newASRService.Connect(); err != nil {
		return fmt.Errorf("连接ASR服务失败: %w", err)
	}

	s.asrService = newASRService
	s.config.Logger.Info("ASR服务已重新初始化")

	// 等待ASR连接建立
	time.Sleep(DefaultASRConnectionDelay)

	// 重新初始化TTS服务（使用硬件的采样率）
	s.config.Logger.Info("重新初始化TTS服务",
		zap.Int("sampleRate", sampleRate),
		zap.Int("channels", channels),
	)
	synthesizer, err := serviceFactory.CreateTTS(s.config.Credential, s.config.Speaker, sampleRate, channels)
	if err != nil {
		return fmt.Errorf("重新初始化TTS服务失败: %w", err)
	}

	// 创建新的TTS服务
	newTTSService := tts.NewService(
		s.ctx,
		s.config.Credential,
		s.config.Speaker,
		synthesizer,
		s.errorHandler,
		s.config.Logger,
	)

	// 更新processor中的synthesizer引用
	s.processor.SetSynthesizer(synthesizer)

	s.ttsService = newTTSService
	s.config.Logger.Info("TTS服务已重新初始化")

	return nil
}

// IsActive 检查会话是否活跃
func (s *Session) IsActive() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.active
}

// RecordAIResponse 记录AI回复到录音会话
func (s *Session) RecordAIResponse(text string) {
	s.mu.RLock()
	recordingSession := s.recordingSession
	s.mu.RUnlock()

	if recordingSession != nil {
		recordingSession.AddAIResponse(text)
	}
}

// messageLoop 消息处理循环
func (s *Session) messageLoop() {
	defer func() {
		// 当消息循环退出时，触发优雅关闭
		s.config.Logger.Info("消息循环退出，触发会话关闭")
		// 调用Stop方法确保所有资源正确清理
		if err := s.Stop(); err != nil {
			s.config.Logger.Error("会话关闭失败", zap.Error(err))
		}
	}()

	for {
		select {
		case <-s.ctx.Done():
			s.config.Logger.Info("消息循环退出")
			return
		default:
		}

		messageType, message, err := s.config.Conn.ReadMessage()
		if err != nil {
			// 检查是否是正常的关闭错误
			if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway, websocket.CloseNoStatusReceived) {
				s.config.Logger.Debug("WebSocket连接正常关闭", zap.Error(err))
			} else {
				s.config.Logger.Debug("读取WebSocket消息失败", zap.Error(err))
			}
			// 直接返回，defer中的Stop会处理清理
			return
		}

		switch messageType {
		case websocket.BinaryMessage:
			// 音频消息
			if err := s.HandleAudio(message); err != nil {
				s.config.Logger.Warn("处理音频消息失败", zap.Error(err))
			}
		case websocket.TextMessage:
			// 文本消息
			if err := s.HandleText(message); err != nil {
				s.config.Logger.Warn("处理文本消息失败", zap.Error(err))
			}
		}
	}
}

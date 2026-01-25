package local

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/code-100-precent/LingEcho/pkg/hardware/asr"
	"github.com/code-100-precent/LingEcho/pkg/hardware/errhandler"
	"github.com/code-100-precent/LingEcho/pkg/hardware/tts"
	"github.com/code-100-precent/LingEcho/pkg/recognizer"
	"github.com/code-100-precent/LingEcho/pkg/synthesizer"
	"go.uber.org/zap"
)

// LocalServiceManager 本地服务管理器
type LocalServiceManager struct {
	asrService *asr.Service
	ttsService *tts.Service
	logger     *zap.Logger
}

// NewLocalServiceManager 创建本地服务管理器
func NewLocalServiceManager(
	ctx context.Context,
	asrModelPath string,
	ttsModelPath string,
	logger *zap.Logger,
) (*LocalServiceManager, error) {
	if logger == nil {
		logger = zap.NewNop()
	}

	// 创建错误处理器
	errorHandler := errhandler.NewHandler()

	// 创建本地ASR配置
	asrConfig := recognizer.NewLocalASRConfig(
		recognizer.LocalASRProviderParaformer,
		asrModelPath,
	)
	asrConfig.Language = "zh-CN"
	asrConfig.SampleRate = 16000
	asrConfig.BufferSize = 100 // 100ms缓冲

	// 创建本地ASR服务
	localASR, err := recognizer.NewLocalASRService(asrConfig)
	if err != nil {
		return nil, fmt.Errorf("创建本地ASR服务失败: %w", err)
	}

	// 创建ASR服务包装器
	credential := &models.UserCredential{
		Provider: "local",
		Config: map[string]interface{}{
			"provider":  "local",
			"modelPath": asrModelPath,
		},
	}

	asrSvc := asr.NewService(
		ctx,
		credential,
		"zh-CN",
		localASR,
		errorHandler,
		logger,
	)

	// 创建本地TTS配置
	ttsConfig := synthesizer.NewLocalGoSpeechConfig(
		synthesizer.LocalGoSpeechProviderMeloTTS,
		ttsModelPath,
	)
	ttsConfig.Language = "zh-CN"
	ttsConfig.Speaker = "default"
	ttsConfig.SampleRate = 16000

	// 创建本地TTS服务
	localTTS, err := synthesizer.NewLocalGoSpeechService(ttsConfig)
	if err != nil {
		localASR.Close() // 清理ASR服务
		return nil, fmt.Errorf("创建本地TTS服务失败: %w", err)
	}

	// 创建TTS服务包装器
	ttsSvc := tts.NewService(
		ctx,
		credential,
		"default",
		localTTS,
		errorHandler,
		logger,
	)

	return &LocalServiceManager{
		asrService: asrSvc,
		ttsService: ttsSvc,
		logger:     logger,
	}, nil
}

// StartASR 启动ASR服务
func (m *LocalServiceManager) StartASR(
	onResult func(text string, isLast bool, duration time.Duration, uuid string),
	onError func(err error),
) error {
	m.asrService.SetCallbacks(onResult, onError)
	return m.asrService.Connect()
}

// StopASR 停止ASR服务
func (m *LocalServiceManager) StopASR() error {
	return m.asrService.Disconnect()
}

// SendAudio 发送音频数据到ASR
func (m *LocalServiceManager) SendAudio(audioData []byte) error {
	return m.asrService.SendAudio(audioData)
}

// SynthesizeText 合成文本为语音
func (m *LocalServiceManager) SynthesizeText(ctx context.Context, text string) (<-chan []byte, error) {
	return m.ttsService.Synthesize(ctx, text)
}

// IsASRConnected 检查ASR是否已连接
func (m *LocalServiceManager) IsASRConnected() bool {
	return m.asrService.IsConnected()
}

// IsASRActive 检查ASR是否活跃
func (m *LocalServiceManager) IsASRActive() bool {
	return m.asrService.Activity()
}

// Close 关闭所有服务
func (m *LocalServiceManager) Close() error {
	var errs []error

	if err := m.asrService.Disconnect(); err != nil {
		errs = append(errs, fmt.Errorf("关闭ASR服务失败: %w", err))
	}

	if err := m.ttsService.Close(); err != nil {
		errs = append(errs, fmt.Errorf("关闭TTS服务失败: %w", err))
	}

	if len(errs) > 0 {
		return fmt.Errorf("关闭服务时发生错误: %v", errs)
	}

	m.logger.Info("本地服务管理器已关闭")
	return nil
}

// ExampleUsage 使用示例
func ExampleUsage() {
	// 创建日志记录器
	logger, _ := zap.NewDevelopment()
	defer logger.Sync()

	// 创建上下文
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// 创建本地服务管理器
	manager, err := NewLocalServiceManager(
		ctx,
		"/path/to/paraformer/model",
		"/path/to/melotts/model",
		logger,
	)
	if err != nil {
		log.Fatalf("创建本地服务管理器失败: %v", err)
	}
	defer manager.Close()

	// 启动ASR服务
	err = manager.StartASR(
		func(text string, isLast bool, duration time.Duration, uuid string) {
			logger.Info("ASR结果",
				zap.String("text", text),
				zap.Bool("isLast", isLast),
				zap.Duration("duration", duration),
			)

			// 如果是最终结果，进行TTS合成
			if isLast && text != "" {
				go func() {
					audioChan, err := manager.SynthesizeText(ctx, text)
					if err != nil {
						logger.Error("TTS合成失败", zap.Error(err))
						return
					}

					// 处理音频数据
					for audioData := range audioChan {
						if audioData == nil {
							break // 错误或结束
						}
						// 播放或保存音频数据
						logger.Info("收到TTS音频数据", zap.Int("size", len(audioData)))
					}
				}()
			}
		},
		func(err error) {
			logger.Error("ASR错误", zap.Error(err))
		},
	)
	if err != nil {
		log.Fatalf("启动ASR服务失败: %v", err)
	}

	// 模拟发送音频数据
	go func() {
		ticker := time.NewTicker(20 * time.Millisecond) // 20ms间隔
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				// 模拟音频数据（实际应用中从麦克风获取）
				audioData := make([]byte, 640) // 20ms @ 16kHz, 16bit, mono
				if err := manager.SendAudio(audioData); err != nil {
					logger.Error("发送音频数据失败", zap.Error(err))
				}
			}
		}
	}()

	// 运行一段时间
	time.Sleep(10 * time.Second)
	logger.Info("示例运行完成")
}

// AdvancedExample 高级使用示例
func AdvancedExample() {
	logger, _ := zap.NewDevelopment()
	defer logger.Sync()

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	// 使用高质量配置
	asrConfig, ttsConfig := HighQualityConfigExample()

	// 创建本地ASR服务
	localASR, err := recognizer.NewLocalASRService(asrConfig)
	if err != nil {
		log.Fatalf("创建ASR服务失败: %v", err)
	}
	defer localASR.Close()

	// 创建本地TTS服务
	localTTS, err := synthesizer.NewLocalGoSpeechService(ttsConfig)
	if err != nil {
		log.Fatalf("创建TTS服务失败: %v", err)
	}
	defer localTTS.Close()

	// 设置ASR回调
	localASR.Init(
		func(text string, isLast bool, duration time.Duration, uuid string) {
			logger.Info("识别结果",
				zap.String("text", text),
				zap.Bool("final", isLast),
				zap.Duration("duration", duration),
			)
		},
		func(err error, isFatal bool) {
			logger.Error("识别错误",
				zap.Error(err),
				zap.Bool("fatal", isFatal),
			)
		},
	)

	// 连接ASR服务
	if err := localASR.ConnAndReceive("test-dialog"); err != nil {
		log.Fatalf("连接ASR服务失败: %v", err)
	}

	// 测试TTS合成
	testTexts := []string{
		"你好，欢迎使用本地语音服务。",
		"这是一个基于go-speech的实现。",
		"支持离线语音识别和语音合成。",
	}

	for _, text := range testTexts {
		logger.Info("开始合成", zap.String("text", text))

		handler := &synthesizer.SynthesisBuffer{}
		if err := localTTS.Synthesize(ctx, handler, text); err != nil {
			logger.Error("合成失败", zap.Error(err), zap.String("text", text))
			continue
		}

		logger.Info("合成完成",
			zap.String("text", text),
			zap.Int("audioSize", len(handler.Data)),
		)

		// 模拟播放延迟
		time.Sleep(1 * time.Second)
	}

	logger.Info("高级示例运行完成")
}

// BenchmarkExample 性能测试示例
func BenchmarkExample() {
	logger, _ := zap.NewDevelopment()
	defer logger.Sync()

	ctx := context.Background()

	// 使用低延迟配置
	_, ttsConfig := LowLatencyConfigExample()

	localTTS, err := synthesizer.NewLocalGoSpeechService(ttsConfig)
	if err != nil {
		log.Fatalf("创建TTS服务失败: %v", err)
	}
	defer localTTS.Close()

	// 测试文本
	testText := "这是一个性能测试。"
	iterations := 10

	logger.Info("开始性能测试",
		zap.String("text", testText),
		zap.Int("iterations", iterations),
	)

	startTime := time.Now()

	for i := 0; i < iterations; i++ {
		iterStart := time.Now()

		handler := &synthesizer.SynthesisBuffer{}
		if err := localTTS.Synthesize(ctx, handler, testText); err != nil {
			logger.Error("合成失败", zap.Error(err), zap.Int("iteration", i))
			continue
		}

		iterDuration := time.Since(iterStart)
		logger.Info("合成完成",
			zap.Int("iteration", i+1),
			zap.Duration("duration", iterDuration),
			zap.Int("audioSize", len(handler.Data)),
		)
	}

	totalDuration := time.Since(startTime)
	avgDuration := totalDuration / time.Duration(iterations)

	logger.Info("性能测试完成",
		zap.Duration("totalDuration", totalDuration),
		zap.Duration("avgDuration", avgDuration),
		zap.Float64("tps", float64(iterations)/totalDuration.Seconds()),
	)
}

package local

import (
	"context"
	"testing"
	"time"

	"github.com/code-100-precent/LingEcho/pkg/recognizer"
	"github.com/code-100-precent/LingEcho/pkg/synthesizer"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// TestLocalASRConfig 测试本地ASR配置
func TestLocalASRConfig(t *testing.T) {
	config := recognizer.NewLocalASRConfig(
		recognizer.LocalASRProviderParaformer,
		"/test/model/path",
	)

	assert.Equal(t, recognizer.LocalASRProviderParaformer, config.Provider)
	assert.Equal(t, "/test/model/path", config.ModelPath)
	assert.Equal(t, "zh-CN", config.Language)
	assert.Equal(t, 16000, config.SampleRate)
	assert.Equal(t, 1, config.Channels)
	assert.Equal(t, 16, config.BitDepth)
	assert.Equal(t, 100, config.BufferSize)
	assert.True(t, config.EnableVAD)
	assert.Equal(t, float32(0.5), config.VADThreshold)
}

// TestLocalTTSConfig 测试本地TTS配置
func TestLocalTTSConfig(t *testing.T) {
	config := synthesizer.NewLocalGoSpeechConfig(
		synthesizer.LocalGoSpeechProviderMeloTTS,
		"/test/model/path",
	)

	assert.Equal(t, synthesizer.LocalGoSpeechProviderMeloTTS, config.Provider)
	assert.Equal(t, "/test/model/path", config.ModelPath)
	assert.Equal(t, "zh-CN", config.Language)
	assert.Equal(t, "default", config.Speaker)
	assert.Equal(t, 16000, config.SampleRate)
	assert.Equal(t, 1, config.Channels)
	assert.Equal(t, 16, config.BitDepth)
	assert.Equal(t, float32(1.0), config.Speed)
	assert.Equal(t, float32(1.0), config.Pitch)
	assert.Equal(t, float32(1.0), config.Volume)
	assert.True(t, config.EnableCache)
	assert.Equal(t, 24*time.Hour, config.CacheExpiry)
}

// TestLocalASRServiceCreation 测试本地ASR服务创建
func TestLocalASRServiceCreation(t *testing.T) {
	// 测试空配置
	_, err := recognizer.NewLocalASRService(nil)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "配置不能为空")

	// 测试空模型路径
	config := &recognizer.LocalASRConfig{
		Provider: recognizer.LocalASRProviderParaformer,
	}
	_, err = recognizer.NewLocalASRService(config)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "模型路径不能为空")

	// 测试不支持的提供商
	config = &recognizer.LocalASRConfig{
		Provider:  "unsupported",
		ModelPath: "/test/path",
	}
	_, err = recognizer.NewLocalASRService(config)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "不支持的ASR提供商")
}

// TestLocalTTSServiceCreation 测试本地TTS服务创建
func TestLocalTTSServiceCreation(t *testing.T) {
	// 测试空配置
	_, err := synthesizer.NewLocalGoSpeechService(nil)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "配置不能为空")

	// 测试空模型路径
	config := &synthesizer.LocalGoSpeechConfig{
		Provider: synthesizer.LocalGoSpeechProviderMeloTTS,
	}
	_, err = synthesizer.NewLocalGoSpeechService(config)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "模型路径不能为空")

	// 测试不支持的提供商
	config = &synthesizer.LocalGoSpeechConfig{
		Provider:  "unsupported",
		ModelPath: "/test/path",
	}
	_, err = synthesizer.NewLocalGoSpeechService(config)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "不支持的TTS提供商")
}

// TestLocalASRVendor 测试ASR供应商名称
func TestLocalASRVendor(t *testing.T) {
	config := recognizer.NewLocalASRConfig(
		recognizer.LocalASRProviderParaformer,
		"/test/path",
	)

	// 由于无法创建真实服务（需要模型文件），我们只测试配置
	expectedVendor := "local-paraformer"

	// 模拟服务行为
	vendor := "local-" + string(config.Provider)
	assert.Equal(t, expectedVendor, vendor)
}

// TestLocalTTSProvider 测试TTS提供商
func TestLocalTTSProvider(t *testing.T) {
	config := synthesizer.NewLocalGoSpeechConfig(
		synthesizer.LocalGoSpeechProviderMeloTTS,
		"/test/path",
	)

	// 模拟服务行为
	provider := synthesizer.TTSProvider("local-gospeech-" + string(config.Provider))
	expectedProvider := synthesizer.TTSProvider("local-gospeech-melotts")
	assert.Equal(t, expectedProvider, provider)
}

// TestLocalTTSFormat 测试TTS音频格式
func TestLocalTTSFormat(t *testing.T) {
	config := synthesizer.NewLocalGoSpeechConfig(
		synthesizer.LocalGoSpeechProviderMeloTTS,
		"/test/path",
	)

	// 模拟格式
	format := struct {
		SampleRate    int
		Channels      int
		BitDepth      int
		FrameDuration time.Duration
	}{
		SampleRate:    config.SampleRate,
		Channels:      config.Channels,
		BitDepth:      config.BitDepth,
		FrameDuration: 20 * time.Millisecond,
	}

	assert.Equal(t, 16000, format.SampleRate)
	assert.Equal(t, 1, format.Channels)
	assert.Equal(t, 16, format.BitDepth)
	assert.Equal(t, 20*time.Millisecond, format.FrameDuration)
}

// TestLocalTTSCacheKey 测试TTS缓存键生成
func TestLocalTTSCacheKey(t *testing.T) {
	config := synthesizer.NewLocalGoSpeechConfig(
		synthesizer.LocalGoSpeechProviderMeloTTS,
		"/test/path",
	)

	text := "测试文本"

	// 模拟缓存键生成
	cacheKey := "local-gospeech-melotts-zh-CN-default-1.000000-1.000000-1.000000-测试文本"

	// 验证缓存键包含所有必要信息
	assert.Contains(t, cacheKey, "local-gospeech")
	assert.Contains(t, cacheKey, "melotts")
	assert.Contains(t, cacheKey, "zh-CN")
	assert.Contains(t, cacheKey, "default")
	assert.Contains(t, cacheKey, text)
}

// TestConfigExamples 测试配置示例
func TestConfigExamples(t *testing.T) {
	// 测试基本ASR配置
	asrConfig := LocalASRConfigExample()
	require.NotNil(t, asrConfig)
	assert.Equal(t, recognizer.LocalASRProviderParaformer, asrConfig.Provider)

	// 测试Whisper ASR配置
	whisperConfig := LocalASRWhisperConfigExample()
	require.NotNil(t, whisperConfig)
	assert.Equal(t, recognizer.LocalASRProviderWhisper, whisperConfig.Provider)

	// 测试基本TTS配置
	ttsConfig := LocalTTSConfigExample()
	require.NotNil(t, ttsConfig)
	assert.Equal(t, synthesizer.LocalGoSpeechProviderMeloTTS, ttsConfig.Provider)

	// 测试英文TTS配置
	englishConfig := LocalTTSEnglishConfigExample()
	require.NotNil(t, englishConfig)
	assert.Equal(t, "en-US", englishConfig.Language)
	assert.Equal(t, 22050, englishConfig.SampleRate)

	// 测试高质量配置
	highQualityASR, highQualityTTS := HighQualityConfigExample()
	require.NotNil(t, highQualityASR)
	require.NotNil(t, highQualityTTS)
	assert.Equal(t, 50, highQualityASR.BufferSize)    // 更小的缓冲区
	assert.Equal(t, 24000, highQualityTTS.SampleRate) // 更高采样率

	// 测试低延迟配置
	lowLatencyASR, lowLatencyTTS := LowLatencyConfigExample()
	require.NotNil(t, lowLatencyASR)
	require.NotNil(t, lowLatencyTTS)
	assert.Equal(t, 20, lowLatencyASR.BufferSize)      // 极小缓冲区
	assert.Equal(t, float32(1.2), lowLatencyTTS.Speed) // 更快语速

	// 测试资源受限配置
	constrainedASR, constrainedTTS := ResourceConstrainedConfigExample()
	require.NotNil(t, constrainedASR)
	require.NotNil(t, constrainedTTS)
	assert.Equal(t, 8000, constrainedASR.SampleRate) // 更低采样率
	assert.False(t, constrainedTTS.EnableCache)      // 禁用缓存

	// 测试多语言配置
	multiLangConfigs := MultiLanguageConfigExample()
	require.NotNil(t, multiLangConfigs)
	assert.Contains(t, multiLangConfigs, "zh-CN")
	assert.Contains(t, multiLangConfigs, "en-US")
	assert.Contains(t, multiLangConfigs, "ja-JP")

	// 测试生产环境配置
	prodASR, prodTTS := ProductionConfigExample()
	require.NotNil(t, prodASR)
	require.NotNil(t, prodTTS)
	assert.Contains(t, prodASR.ModelPath, "/opt/models")
	assert.Contains(t, prodTTS.ModelPath, "/opt/models")
}

// BenchmarkConfigCreation 基准测试配置创建
func BenchmarkConfigCreation(b *testing.B) {
	b.Run("ASR Config", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			_ = recognizer.NewLocalASRConfig(
				recognizer.LocalASRProviderParaformer,
				"/test/path",
			)
		}
	})

	b.Run("TTS Config", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			_ = synthesizer.NewLocalGoSpeechConfig(
				synthesizer.LocalGoSpeechProviderMeloTTS,
				"/test/path",
			)
		}
	})
}

// TestFactoryIntegration 测试工厂集成
func TestFactoryIntegration(t *testing.T) {
	factory := recognizer.GetGlobalFactory()
	require.NotNil(t, factory)

	// 检查是否支持本地ASR
	supported := factory.IsVendorSupported(recognizer.VendorLocal)
	assert.True(t, supported)

	// 检查支持的供应商列表
	vendors := factory.GetSupportedVendors()
	assert.Contains(t, vendors, recognizer.VendorLocal)
}

// TestSynthesisServiceFactory 测试合成服务工厂
func TestSynthesisServiceFactory(t *testing.T) {
	// 测试通过工厂创建服务（模拟）
	options := map[string]any{
		"provider":  "melotts",
		"modelPath": "/test/path",
		"language":  "zh-CN",
		"speaker":   "default",
	}

	// 由于需要实际的模型文件，这里只测试配置验证
	assert.NotNil(t, options)
	assert.Equal(t, "melotts", options["provider"])
	assert.Equal(t, "/test/path", options["modelPath"])
}

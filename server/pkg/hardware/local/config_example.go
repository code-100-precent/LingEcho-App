package local

import (
	"time"

	"github.com/code-100-precent/LingEcho/pkg/recognizer"
	"github.com/code-100-precent/LingEcho/pkg/synthesizer"
)

// LocalASRConfigExample 本地ASR配置示例
func LocalASRConfigExample() *recognizer.LocalASRConfig {
	return &recognizer.LocalASRConfig{
		Provider:     recognizer.LocalASRProviderWhisperCpp,
		ModelPath:    "/path/to/models/whisper",
		Language:     "zh-CN",
		SampleRate:   16000,
		Channels:     1,
		BitDepth:     16,
		BufferSize:   100, // 100ms
		EnableVAD:    true,
		VADThreshold: 0.5,
		Command:      "whisper",
	}
}

// LocalASRWhisperConfigExample Whisper ASR配置示例
func LocalASRWhisperConfigExample() *recognizer.LocalASRConfig {
	return &recognizer.LocalASRConfig{
		Provider:     recognizer.LocalASRProviderLocal,
		ModelPath:    "/path/to/models/whisper/small.onnx",
		Language:     "zh-CN",
		SampleRate:   16000,
		Channels:     1,
		BitDepth:     16,
		BufferSize:   200, // 200ms，需要更大的缓冲区
		EnableVAD:    true,
		VADThreshold: 0.6,
		Command:      "whisper --model small --language zh",
	}
}

// LocalTTSConfigExample 本地TTS配置示例
func LocalTTSConfigExample() *synthesizer.LocalGoSpeechConfig {
	return &synthesizer.LocalGoSpeechConfig{
		Provider:    synthesizer.LocalGoSpeechProviderEspeak,
		ModelPath:   "", // espeak 不需要模型文件
		Language:    "zh-CN",
		Speaker:     "default",
		SampleRate:  16000,
		Channels:    1,
		BitDepth:    16,
		Speed:       1.0,
		Pitch:       1.0,
		Volume:      1.0,
		EnableCache: true,
		CacheExpiry: 24 * time.Hour,
		OutputDir:   "/tmp",
	}
}

// LocalTTSEnglishConfigExample 英文TTS配置示例
func LocalTTSEnglishConfigExample() *synthesizer.LocalGoSpeechConfig {
	return &synthesizer.LocalGoSpeechConfig{
		Provider:    synthesizer.LocalGoSpeechProviderSay, // macOS say 命令
		ModelPath:   "",
		Language:    "en-US",
		Speaker:     "Samantha",
		SampleRate:  22050, // 更高采样率
		Channels:    1,
		BitDepth:    16,
		Speed:       1.1, // 稍快语速
		Pitch:       1.0,
		Volume:      0.9, // 稍低音量
		EnableCache: true,
		CacheExpiry: 48 * time.Hour, // 英文缓存更久
		OutputDir:   "/tmp",
	}
}

// HighQualityConfigExample 高质量配置示例
func HighQualityConfigExample() (*recognizer.LocalASRConfig, *synthesizer.LocalGoSpeechConfig) {
	asrConfig := &recognizer.LocalASRConfig{
		Provider:     recognizer.LocalASRProviderWhisperCpp, // 使用 Whisper 获得更好的识别
		ModelPath:    "/path/to/models/whisper-large",
		Language:     "zh-CN",
		SampleRate:   16000,
		Channels:     1,
		BitDepth:     16,
		BufferSize:   50, // 更小的缓冲区，降低延迟
		EnableVAD:    true,
		VADThreshold: 0.4, // 更敏感的VAD
		Command:      "whisper --model large --language zh",
	}

	ttsConfig := &synthesizer.LocalGoSpeechConfig{
		Provider:    synthesizer.LocalGoSpeechProviderEspeak,
		ModelPath:   "",
		Language:    "zh-CN",
		Speaker:     "default",
		SampleRate:  24000, // 更高采样率
		Channels:    1,
		BitDepth:    16,
		Speed:       0.95, // 稍慢语速，更清晰
		Pitch:       1.0,
		Volume:      1.0,
		EnableCache: true,
		CacheExpiry: 7 * 24 * time.Hour, // 一周缓存
		OutputDir:   "/tmp",
	}

	return asrConfig, ttsConfig
}

// LowLatencyConfigExample 低延迟配置示例
func LowLatencyConfigExample() (*recognizer.LocalASRConfig, *synthesizer.LocalGoSpeechConfig) {
	asrConfig := &recognizer.LocalASRConfig{
		Provider:     recognizer.LocalASRProviderWhisper, // Whisper tiny模型延迟更低
		ModelPath:    "/path/to/models/whisper/tiny.onnx",
		Language:     "zh-CN",
		SampleRate:   16000,
		Channels:     1,
		BitDepth:     16,
		BufferSize:   20, // 极小缓冲区
		EnableVAD:    true,
		VADThreshold: 0.7, // 更严格的VAD，减少误触发
	}

	ttsConfig := &synthesizer.LocalGoSpeechConfig{
		Provider:    synthesizer.LocalGoSpeechProviderMeloTTS,
		ModelPath:   "/path/to/models/melotts/zh-cn-fast",
		Language:    "zh-CN",
		Speaker:     "fast",
		SampleRate:  16000, // 标准采样率
		Channels:    1,
		BitDepth:    16,
		Speed:       1.2, // 更快语速
		Pitch:       1.0,
		Volume:      1.0,
		EnableCache: true,
		CacheExpiry: 1 * time.Hour, // 短缓存
	}

	return asrConfig, ttsConfig
}

// ResourceConstrainedConfigExample 资源受限配置示例
func ResourceConstrainedConfigExample() (*recognizer.LocalASRConfig, *synthesizer.LocalGoSpeechConfig) {
	asrConfig := &recognizer.LocalASRConfig{
		Provider:     recognizer.LocalASRProviderWhisper,
		ModelPath:    "/path/to/models/whisper/tiny.onnx", // 最小模型
		Language:     "zh-CN",
		SampleRate:   8000, // 更低采样率
		Channels:     1,
		BitDepth:     16,
		BufferSize:   500, // 更大缓冲区，减少处理频率
		EnableVAD:    true,
		VADThreshold: 0.8, // 更严格的VAD
	}

	ttsConfig := &synthesizer.LocalGoSpeechConfig{
		Provider:    synthesizer.LocalGoSpeechProviderMeloTTS,
		ModelPath:   "/path/to/models/melotts/zh-cn-lite",
		Language:    "zh-CN",
		Speaker:     "lite",
		SampleRate:  8000, // 更低采样率
		Channels:    1,
		BitDepth:    16,
		Speed:       1.0,
		Pitch:       1.0,
		Volume:      1.0,
		EnableCache: false, // 禁用缓存节省内存
		CacheExpiry: 0,
	}

	return asrConfig, ttsConfig
}

// MultiLanguageConfigExample 多语言配置示例
func MultiLanguageConfigExample() map[string]*synthesizer.LocalGoSpeechConfig {
	configs := make(map[string]*synthesizer.LocalGoSpeechConfig)

	// 中文配置
	configs["zh-CN"] = &synthesizer.LocalGoSpeechConfig{
		Provider:    synthesizer.LocalGoSpeechProviderMeloTTS,
		ModelPath:   "/path/to/models/melotts/zh-cn",
		Language:    "zh-CN",
		Speaker:     "default",
		SampleRate:  16000,
		Channels:    1,
		BitDepth:    16,
		Speed:       1.0,
		Pitch:       1.0,
		Volume:      1.0,
		EnableCache: true,
		CacheExpiry: 24 * time.Hour,
	}

	// 英文配置
	configs["en-US"] = &synthesizer.LocalGoSpeechConfig{
		Provider:    synthesizer.LocalGoSpeechProviderMeloTTS,
		ModelPath:   "/path/to/models/melotts/en-us",
		Language:    "en-US",
		Speaker:     "default",
		SampleRate:  22050,
		Channels:    1,
		BitDepth:    16,
		Speed:       1.0,
		Pitch:       1.0,
		Volume:      1.0,
		EnableCache: true,
		CacheExpiry: 24 * time.Hour,
	}

	// 日文配置
	configs["ja-JP"] = &synthesizer.LocalGoSpeechConfig{
		Provider:    synthesizer.LocalGoSpeechProviderMeloTTS,
		ModelPath:   "/path/to/models/melotts/ja-jp",
		Language:    "ja-JP",
		Speaker:     "default",
		SampleRate:  16000,
		Channels:    1,
		BitDepth:    16,
		Speed:       0.9, // 日文稍慢
		Pitch:       1.1, // 稍高音调
		Volume:      1.0,
		EnableCache: true,
		CacheExpiry: 24 * time.Hour,
	}

	return configs
}

// ProductionConfigExample 生产环境配置示例
func ProductionConfigExample() (*recognizer.LocalASRConfig, *synthesizer.LocalGoSpeechConfig) {
	asrConfig := &recognizer.LocalASRConfig{
		Provider:     recognizer.LocalASRProviderParaformer,
		ModelPath:    "/opt/models/paraformer/zh-cn",
		Language:     "zh-CN",
		SampleRate:   16000,
		Channels:     1,
		BitDepth:     16,
		BufferSize:   100,
		EnableVAD:    true,
		VADThreshold: 0.5,
	}

	ttsConfig := &synthesizer.LocalGoSpeechConfig{
		Provider:    synthesizer.LocalGoSpeechProviderMeloTTS,
		ModelPath:   "/opt/models/melotts/zh-cn",
		Language:    "zh-CN",
		Speaker:     "professional",
		SampleRate:  16000,
		Channels:    1,
		BitDepth:    16,
		Speed:       1.0,
		Pitch:       1.0,
		Volume:      1.0,
		EnableCache: true,
		CacheExpiry: 24 * time.Hour,
	}

	return asrConfig, ttsConfig
}

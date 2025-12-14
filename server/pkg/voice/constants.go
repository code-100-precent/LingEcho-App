package voice

import "time"

// 默认配置值
const (
	DefaultSilenceDuration    = 1 * time.Second        // 默认静音持续时间
	DefaultProcessDelay       = 500 * time.Millisecond // 默认处理延迟
	DefaultASRConnectionDelay = 500 * time.Millisecond // ASR连接延迟
	DefaultLLMModel           = "deepseek-v3.1"        // 默认LLM模型
)

// WebSocket message types for generic voice protocol
// Note: These are for the generic WebSocket protocol used in pkg/voice.
// For xiaozhi hardware protocol, see pkg/hardware/constants.go which uses
// different message types: "stt", "llm", "tts" instead of "asr_result", "llm_response", "tts_start"/"tts_end"
const (
	MessageTypeConnected      = "connected"       // Connection established
	MessageTypeError          = "error"           // Error message
	MessageTypeASRResult      = "asr_result"      // ASR recognition result
	MessageTypeLLMResponse    = "llm_response"    // LLM response
	MessageTypeTTSStart       = "tts_start"       // TTS synthesis started
	MessageTypeTTSEnd         = "tts_end"         // TTS synthesis ended
	MessageTypeNewSession     = "new_session"     // New session request
	MessageTypeSessionCleared = "session_cleared" // Session cleared notification
	MessageTypePing           = "ping"            // Heartbeat request
	MessageTypePong           = "pong"            // Heartbeat response
)

// Provider名称映射
const (
	ProviderTencent = "tencent"
	ProviderQCloud  = "qcloud"
)

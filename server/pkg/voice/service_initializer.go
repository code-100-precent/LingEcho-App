package voice

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"github.com/code-100-precent/LingEcho/internal/models"
	v2 "github.com/code-100-precent/LingEcho/pkg/llm"
	"github.com/code-100-precent/LingEcho/pkg/media"
	"github.com/code-100-precent/LingEcho/pkg/recognizer"
	"github.com/code-100-precent/LingEcho/pkg/synthesizer"
	"github.com/gorilla/websocket"
)

// ServiceInitializer service initializer
type ServiceInitializer struct {
	asrParserFactory *ASRConfigParserFactory
}

// NewServiceInitializer creates a service initializer
func NewServiceInitializer() *ServiceInitializer {
	return &ServiceInitializer{
		asrParserFactory: NewASRConfigParserFactory(),
	}
}

// InitializeASR initializes ASR service
func (si *ServiceInitializer) InitializeASR(
	credential *models.UserCredential,
	language string,
	factory *recognizer.DefaultTranscriberFactory,
) (recognizer.TranscribeService, error) {
	asrProvider := credential.GetASRProvider()
	if asrProvider == "" {
		return nil, fmt.Errorf("ASR provider not configured")
	}

	normalizedProvider := normalizeProvider(asrProvider)

	// Build configuration
	asrConfig := make(map[string]interface{})
	asrConfig["provider"] = normalizedProvider
	asrConfig["language"] = language

	if credential.AsrConfig != nil {
		for key, value := range credential.AsrConfig {
			asrConfig[key] = value
		}
	}

	// Validate vendor support
	vendor := getVendor(normalizedProvider)
	if !factory.IsVendorSupported(vendor) {
		supported := factory.GetSupportedVendors()
		return nil, fmt.Errorf("unsupported ASR provider: %s, supported vendors: %v", asrProvider, supported)
	}

	// Parse configuration
	config, err := si.asrParserFactory.Parse(normalizedProvider, asrConfig, language)
	if err != nil {
		return nil, fmt.Errorf("failed to parse ASR configuration: %w", err)
	}

	// Create service
	asrService, err := factory.CreateTranscriber(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create ASR service: %w", err)
	}

	return asrService, nil
}

// InitializeTTS initializes TTS service
func (si *ServiceInitializer) InitializeTTS(
	credential *models.UserCredential,
	speaker string,
) (synthesizer.SynthesisService, error) {
	ttsProvider := credential.GetTTSProvider()
	if ttsProvider == "" {
		return nil, fmt.Errorf("TTS provider not configured")
	}

	normalizedProvider := normalizeProvider(ttsProvider)

	ttsConfig := make(synthesizer.TTSCredentialConfig)
	ttsConfig["provider"] = normalizedProvider

	if credential.TtsConfig != nil {
		for key, value := range credential.TtsConfig {
			ttsConfig[key] = value
		}
	}

	if _, exists := ttsConfig["voiceType"]; !exists && speaker != "" {
		ttsConfig["voiceType"] = speaker
	}
	if _, exists := ttsConfig["voice_type"]; !exists && speaker != "" {
		ttsConfig["voice_type"] = speaker
	}

	// Set default speech rate (if not configured): speed up, default 1.2 (20% speed increase)
	if _, exists := ttsConfig["speedRatio"]; !exists {
		if _, exists = ttsConfig["speed_ratio"]; !exists {
			if _, exists = ttsConfig["speed"]; !exists {
				// Set default speech rate based on provider
				switch normalizedProvider {
				case "tencent", "qcloud":
					ttsConfig["speedRatio"] = 1.2
				case "minimax":
					ttsConfig["speedRatio"] = 1.2
				case "volcengine":
					ttsConfig["speedRatio"] = 1.2
				case "openai":
					ttsConfig["speed"] = 1.2
				default:
					ttsConfig["speedRatio"] = 1.2 // Default 20% speed increase
				}
			}
		}
	}

	ttsService, err := synthesizer.NewSynthesisServiceFromCredential(ttsConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create TTS service: %w", err)
	}

	return ttsService, nil
}

// InitializeLLM initializes LLM processor
// 现在支持多种 LLM 提供者（OpenAI、Coze 等）
func InitializeLLM(ctx context.Context, credential *models.UserCredential, systemPrompt string) (v2.LLMProvider, error) {
	return v2.NewLLMProvider(ctx, credential, systemPrompt)
}

// MessageWriter WebSocket message writer - unified message sending interface
type MessageWriter struct {
	conn      *websocket.Conn
	isXiaozhi bool       // 是否使用xiaozhi协议格式
	sessionID string     // 会话ID（用于xiaozhi协议）
	mu        sync.Mutex // 保护 WebSocket 写入操作的互斥锁
}

// NewMessageWriter creates a message writer
func NewMessageWriter(conn *websocket.Conn) *MessageWriter {
	return &MessageWriter{
		conn:      conn,
		isXiaozhi: false, // 默认不使用xiaozhi格式
		sessionID: fmt.Sprintf("%d", time.Now().UnixNano()),
	}
}

// SetXiaozhiMode 设置为xiaozhi协议模式
func (w *MessageWriter) SetXiaozhiMode(sessionID string) {
	w.isXiaozhi = true
	if sessionID != "" {
		w.sessionID = sessionID
	}
}

// SendJSON sends JSON message (thread-safe)
func (w *MessageWriter) SendJSON(msgType string, data map[string]interface{}) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	msg := map[string]interface{}{
		"type": msgType,
	}
	for k, v := range data {
		msg[k] = v
	}
	return w.conn.WriteJSON(msg)
}

// SendText sends text message
func (w *MessageWriter) SendText(msgType string, message string) error {
	return w.SendJSON(msgType, map[string]interface{}{
		"message": message,
	})
}

// SendError sends error message
func (w *MessageWriter) SendError(message string, fatal bool) error {
	return w.SendJSON(MessageTypeError, map[string]interface{}{
		"message": message,
		"fatal":   fatal,
	})
}

// SendConnected sends connection success message
func (w *MessageWriter) SendConnected() error {
	return w.SendText(MessageTypeConnected, "WebSocket voice connection established")
}

// SendASRResult sends ASR recognition result (thread-safe)
func (w *MessageWriter) SendASRResult(text string) error {
	if w.isXiaozhi {
		// xiaozhi协议格式：{"type": "stt", "text": "...", "session_id": "..."}
		w.mu.Lock()
		defer w.mu.Unlock()
		msg := map[string]interface{}{
			"type":       "stt",
			"text":       text,
			"session_id": w.sessionID,
		}
		return w.conn.WriteJSON(msg)
	}
	// 通用格式
	return w.SendJSON(MessageTypeASRResult, map[string]interface{}{
		"text": text,
	})
}

// SendLLMResponse sends LLM response
func (w *MessageWriter) SendLLMResponse(text string) error {
	return w.SendJSON(MessageTypeLLMResponse, map[string]interface{}{
		"text": text,
	})
}

// SendTTSStart sends TTS start message (thread-safe)
func (w *MessageWriter) SendTTSStart(format media.StreamFormat) error {
	if w.isXiaozhi {
		// xiaozhi协议格式：{"type": "tts", "state": "start", "session_id": "..."}
		w.mu.Lock()
		defer w.mu.Unlock()
		msg := map[string]interface{}{
			"type":       "tts",
			"state":      "start",
			"session_id": w.sessionID,
		}
		return w.conn.WriteJSON(msg)
	}
	// 通用格式
	return w.SendJSON(MessageTypeTTSStart, map[string]interface{}{
		"sampleRate": format.SampleRate,
		"channels":   format.Channels,
		"bitDepth":   format.BitDepth,
	})
}

// SendTTSEnd sends TTS end message (thread-safe)
func (w *MessageWriter) SendTTSEnd() error {
	if w.isXiaozhi {
		// xiaozhi协议格式：{"type": "tts", "state": "stop", "session_id": "..."}
		w.mu.Lock()
		defer w.mu.Unlock()
		msg := map[string]interface{}{
			"type":       "tts",
			"state":      "stop",
			"session_id": w.sessionID,
		}
		return w.conn.WriteJSON(msg)
	}
	// 通用格式
	return w.SendJSON(MessageTypeTTSEnd, map[string]interface{}{})
}

// SendSessionCleared sends session cleared message
func (w *MessageWriter) SendSessionCleared() error {
	return w.SendText(MessageTypeSessionCleared, "Conversation history and ASR status cleared")
}

// SendPong sends heartbeat response
func (w *MessageWriter) SendPong() error {
	return w.SendJSON(MessageTypePong, map[string]interface{}{})
}

// SendBinary sends binary message
func (w *MessageWriter) SendBinary(data []byte) error {
	return w.conn.WriteMessage(websocket.BinaryMessage, data)
}

// SendWelcome sends xiaozhi protocol hello response message
// 响应格式应该与原版xiaozhi-esp32一致：type: "hello" (不是 "server")
// 返回sessionID用于后续消息
func (w *MessageWriter) SendWelcome(audioFormat string, sampleRate, channels int, features map[string]interface{}) (string, error) {
	// 生成会话ID（使用时间戳）
	sessionID := fmt.Sprintf("%d", time.Now().UnixNano())

	// 构建audio_params，包含frame_duration（原版配置中有这个字段）
	audioParams := map[string]interface{}{
		"format":         audioFormat,
		"sample_rate":    sampleRate,
		"channels":       channels,
		"frame_duration": 60, // 默认帧时长（毫秒）
	}

	// 构建响应消息（格式与原版xiaozhi-esp32一致）
	welcomeMsg := map[string]interface{}{
		"type":         "hello", // 注意：是 "hello" 不是 "server"
		"version":      1,
		"transport":    "websocket",
		"session_id":   sessionID,
		"audio_params": audioParams,
	}

	// 如果有features，添加到响应中
	if features != nil && len(features) > 0 {
		welcomeMsg["features"] = features
	}

	// 使用WriteMessage而不是WriteJSON，确保格式正确
	message, err := json.Marshal(welcomeMsg)
	if err != nil {
		return "", fmt.Errorf("序列化Welcome消息失败: %w", err)
	}

	w.mu.Lock()
	defer w.mu.Unlock()
	if err := w.conn.WriteMessage(websocket.TextMessage, message); err != nil {
		return "", err
	}

	return sessionID, nil
}

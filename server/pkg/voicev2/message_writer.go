package voicev2

import (
	"sync"

	"github.com/code-100-precent/LingEcho/pkg/media"
	"github.com/gorilla/websocket"
)

// MessageWriter WebSocket消息写入器 - 统一的消息发送接口
type MessageWriter struct {
	conn *websocket.Conn
	mu   sync.Mutex // 保护 WebSocket 写入操作的互斥锁
}

// NewMessageWriter 创建消息写入器
func NewMessageWriter(conn *websocket.Conn) *MessageWriter {
	return &MessageWriter{
		conn: conn,
	}
}

// SendJSON 发送JSON消息（线程安全）
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

// SendText 发送文本消息
func (w *MessageWriter) SendText(msgType string, message string) error {
	return w.SendJSON(msgType, map[string]interface{}{
		"message": message,
	})
}

// SendError 发送错误消息
func (w *MessageWriter) SendError(message string, fatal bool) error {
	return w.SendJSON(MessageTypeError, map[string]interface{}{
		"message": message,
		"fatal":   fatal,
	})
}

// SendConnected 发送连接成功消息
func (w *MessageWriter) SendConnected() error {
	return w.SendText(MessageTypeConnected, "WebSocket voice connection established")
}

// SendASRResult 发送ASR识别结果（线程安全）
func (w *MessageWriter) SendASRResult(text string) error {
	return w.SendJSON(MessageTypeASRResult, map[string]interface{}{
		"text": text,
	})
}

// SendLLMResponse 发送LLM响应
func (w *MessageWriter) SendLLMResponse(text string) error {
	return w.SendJSON(MessageTypeLLMResponse, map[string]interface{}{
		"text": text,
	})
}

// SendTTSStart 发送TTS开始消息（线程安全）
func (w *MessageWriter) SendTTSStart(format media.StreamFormat) error {
	return w.SendJSON(MessageTypeTTSStart, map[string]interface{}{
		"sampleRate": format.SampleRate,
		"channels":   format.Channels,
		"bitDepth":   format.BitDepth,
	})
}

// SendTTSEnd 发送TTS结束消息（线程安全）
func (w *MessageWriter) SendTTSEnd() error {
	return w.SendJSON(MessageTypeTTSEnd, map[string]interface{}{})
}

// SendSessionCleared 发送会话已清除消息
func (w *MessageWriter) SendSessionCleared() error {
	return w.SendText(MessageTypeSessionCleared, "Conversation history and ASR status cleared")
}

// SendPong 发送心跳响应
func (w *MessageWriter) SendPong() error {
	return w.SendJSON(MessageTypePong, map[string]interface{}{})
}

// SendBinary 发送二进制消息（线程安全）
func (w *MessageWriter) SendBinary(data []byte) error {
	w.mu.Lock()
	defer w.mu.Unlock()
	return w.conn.WriteMessage(websocket.BinaryMessage, data)
}

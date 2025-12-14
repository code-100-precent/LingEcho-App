package voicev2

import (
	"go.uber.org/zap"
)

// MessageHandler 消息处理器
type MessageHandler struct {
	logger *zap.Logger
}

// NewMessageHandler 创建消息处理器
func NewMessageHandler(logger *zap.Logger) *MessageHandler {
	return &MessageHandler{
		logger: logger,
	}
}

// HandleTextMessage 处理文本消息
func (mh *MessageHandler) HandleTextMessage(
	client *VoiceClient,
	msg map[string]interface{},
	writer *MessageWriter,
) {
	msgType, ok := msg["type"].(string)
	if !ok {
		return
	}

	switch msgType {
	case MessageTypeNewSession:
		mh.handleNewSession(client, writer)
	case MessageTypePing:
		writer.SendPong()
	default:
		mh.logger.Warn("未知的消息类型", zap.String("type", msgType))
	}
}

// handleNewSession 处理新会话请求
func (mh *MessageHandler) handleNewSession(client *VoiceClient, writer *MessageWriter) {
	// 清理对话历史和ASR状态
	client.state.Clear()

	// 重新初始化ASR连接
	if client.asrService != nil {
		client.asrService.RestartClient()
	}

	writer.SendSessionCleared()
}

package voicev2

import (
	"context"

	"github.com/code-100-precent/LingEcho/internal/models"
	v2 "github.com/code-100-precent/LingEcho/pkg/llm"
	"github.com/code-100-precent/LingEcho/pkg/recognizer"
	"github.com/code-100-precent/LingEcho/pkg/synthesizer"
	"github.com/gorilla/websocket"
	"gorm.io/gorm"
)

// VoiceClient 语音客户端 - 封装单个WebSocket连接的所有状态和服务
type VoiceClient struct {
	conn         *websocket.Conn
	credential   *models.UserCredential
	asrService   recognizer.TranscribeService
	ttsService   synthesizer.SynthesisService
	llmHandler   v2.LLMProvider
	assistantID  int
	language     string
	speaker      string
	temperature  float64
	maxTokens    int
	systemPrompt string
	state        *ClientState // 使用统一的状态管理
	ctx          context.Context
	cancel       context.CancelFunc
	isActive     int32          // 使用原子操作保证并发安全（0=false, 1=true）
	writer       *MessageWriter // 消息写入器

	// Knowledge base support
	knowledgeKey string   // Knowledge base identifier
	db           *gorm.DB // Database connection for knowledge base retrieval

	// LLM model (cached from assistant to avoid repeated database queries)
	llmModel string // LLM model name, queried once from assistant when client is created
}

// MessageQueue WebSocket消息队列 - 用于异步处理WebSocket消息
type MessageQueue struct {
	audioChan chan []byte
	textChan  chan []byte
	stopChan  chan struct{}
}

// NewMessageQueue 创建消息队列
func NewMessageQueue() *MessageQueue {
	return &MessageQueue{
		audioChan: make(chan []byte, 100), // 缓冲100个音频消息
		textChan:  make(chan []byte, 10),  // 缓冲10个文本消息
		stopChan:  make(chan struct{}),
	}
}

package graph

// ConversationSummary 对话总结
type ConversationSummary struct {
	AssistantID   int64       `json:"assistantId"`
	AssistantName string      `json:"assistantName"`
	UserID        uint        `json:"userId"`
	SessionID     string      `json:"sessionId"`
	Summary       string      `json:"summary"`   // 对话总结
	Topics        []string    `json:"topics"`    // 讨论的主题列表
	Intents       []string    `json:"intents"`   // 用户意图列表
	Turns         []Turn      `json:"turns"`     // 对话轮次
	Knowledge     []Knowledge `json:"knowledge"` // 提取的知识点
}

// Turn 对话轮次
type Turn struct {
	UserMessage  string `json:"userMessage"`
	AgentMessage string `json:"agentMessage"`
	Sequence     int    `json:"sequence"`
}

// Knowledge 知识点
type Knowledge struct {
	Content       string   `json:"content"`       // 知识内容
	Category      string   `json:"category"`      // 知识类别
	Source        string   `json:"source"`        // 来源（如 "conversation"）
	RelatedTopics []string `json:"relatedTopics"` // 相关主题
}

// UserContext 用户上下文
type UserContext struct {
	UserID      uint     `json:"userId"`
	AssistantID int64    `json:"assistantId"`
	Topics      []string `json:"topics"` // 用户偏好的主题
}

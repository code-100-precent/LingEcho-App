package agent

import (
	"context"
	"fmt"
	"time"

	"github.com/code-100-precent/LingEcho/pkg/llm"
	"go.uber.org/zap"
)

// LLMAgent LLM Agent，负责调用大语言模型生成回答
type LLMAgent struct {
	id          string
	name        string
	description string
	llmProvider llm.LLMProvider
	logger      *zap.Logger
}

// NewLLMAgent 创建新的LLM Agent
func NewLLMAgent(llmProvider llm.LLMProvider, logger *zap.Logger) *LLMAgent {
	return &LLMAgent{
		id:          "llm_agent",
		name:        "LLM Agent",
		description: "大语言模型Agent，负责调用LLM生成回答",
		llmProvider: llmProvider,
		logger:      logger,
	}
}

// ID 返回agent ID
func (a *LLMAgent) ID() string {
	return a.id
}

// Name 返回agent名称
func (a *LLMAgent) Name() string {
	return a.name
}

// Description 返回agent描述
func (a *LLMAgent) Description() string {
	return a.description
}

// Capabilities 返回agent能力
func (a *LLMAgent) Capabilities() []Capability {
	return []Capability{
		{
			Name:        "text_generation",
			Description: "生成文本回答",
			Type:        "llm",
		},
		{
			Name:        "conversation",
			Description: "进行对话",
			Type:        "llm",
		},
	}
}

// CanHandle 判断是否能处理任务
func (a *LLMAgent) CanHandle(request *TaskRequest) bool {
	return request.Type == TaskTypeLLM || request.Type == TaskTypeGeneral
}

// Process 处理任务
func (a *LLMAgent) Process(ctx context.Context, request *TaskRequest) (*TaskResponse, error) {
	startTime := time.Now()

	// 构建消息列表
	messages := make([]llm.Message, 0)

	// 添加系统提示词（如果有）
	if request.Context != nil && request.Context.AdditionalContext != nil {
		if systemPrompt, ok := request.Context.AdditionalContext["systemPrompt"].(string); ok && systemPrompt != "" {
			messages = append(messages, llm.Message{
				Role:    "system",
				Content: systemPrompt,
			})
		}
	}

	// 添加对话历史
	if request.Context != nil && len(request.Context.ConversationHistory) > 0 {
		for _, msg := range request.Context.ConversationHistory {
			messages = append(messages, llm.Message{
				Role:    msg.Role,
				Content: msg.Content,
			})
		}
	}

	// 添加当前用户消息
	messages = append(messages, llm.Message{
		Role:    "user",
		Content: request.Content,
	})

	// 获取模型参数
	model := "gpt-4o"
	if modelVal, ok := request.Parameters["model"].(string); ok {
		model = modelVal
	}

	temperature := float32(0.7)
	if tempVal, ok := request.Parameters["temperature"].(float64); ok {
		temperature = float32(tempVal)
	}

	maxTokens := 0
	if maxTokensVal, ok := request.Parameters["maxTokens"].(float64); ok {
		maxTokens = int(maxTokensVal)
	}

	// 调用LLM
	options := llm.QueryOptions{
		Model:       model,
		Temperature: &temperature,
		MaxTokens:   maxTokens,
	}

	response, err := a.llmProvider.Query(ctx, messages, options)
	if err != nil {
		a.logger.Error("LLM query failed",
			zap.String("taskID", request.ID),
			zap.Error(err),
		)
		return &TaskResponse{
			ID:        request.ID,
			Success:   false,
			Error:     fmt.Sprintf("LLM query failed: %v", err),
			CreatedAt: time.Now(),
		}, nil
	}

	// 提取响应内容
	content := response.Content
	if content == "" && len(response.Choices) > 0 {
		content = response.Choices[0].Message.Content
	}

	a.logger.Info("LLM query completed",
		zap.String("taskID", request.ID),
		zap.String("model", model),
		zap.Int("tokens", response.Usage.TotalTokens),
		zap.Duration("processingTime", time.Since(startTime)),
	)

	return &TaskResponse{
		ID:      request.ID,
		Success: true,
		Content: content,
		Data: map[string]interface{}{
			"model":        model,
			"usage":        response.Usage,
			"finishReason": response.FinishReason,
		},
		AgentID:        a.id,
		ProcessingTime: time.Since(startTime),
		CreatedAt:      time.Now(),
	}, nil
}

// Health 健康检查
func (a *LLMAgent) Health(ctx context.Context) error {
	if a.llmProvider == nil {
		return fmt.Errorf("LLM provider is nil")
	}

	// 尝试一个简单的健康检查查询
	testMessages := []llm.Message{
		{
			Role:    "user",
			Content: "test",
		},
	}

	_, err := a.llmProvider.Query(ctx, testMessages, llm.QueryOptions{
		Model:       "gpt-4o",
		MaxTokens:   5,
		Temperature: func() *float32 { t := float32(0.1); return &t }(),
	})

	if err != nil {
		return fmt.Errorf("LLM health check failed: %w", err)
	}

	return nil
}

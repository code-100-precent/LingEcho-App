package streaming

import (
	"bytes"
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/code-100-precent/LingEcho/pkg/hardware/errhandler"
	"github.com/code-100-precent/LingEcho/pkg/llm"
	"go.uber.org/zap"
)

// StreamingLLMService 流式LLM服务
type StreamingLLMService struct {
	ctx            context.Context
	credential     *models.UserCredential
	systemPrompt   string
	model          string
	temperature    float64
	maxTokens      int
	provider       llm.LLMProvider
	errorHandler   *errhandler.Handler
	logger         *zap.Logger
	mu             sync.RWMutex
	closed         bool
}

// LLMStreamResponse 流式响应结构
type LLMStreamResponse struct {
	Text      string    `json:"text"`
	IsStart   bool      `json:"is_start"`
	IsEnd     bool      `json:"is_end"`
	ToolCalls []ToolCall `json:"tool_calls,omitempty"`
	Error     error     `json:"error,omitempty"`
}

// ToolCall 工具调用结构
type ToolCall struct {
	ID       string                 `json:"id"`
	Function ToolCallFunction       `json:"function"`
	Type     string                 `json:"type"`
}

type ToolCallFunction struct {
	Name      string                 `json:"name"`
	Arguments map[string]interface{} `json:"arguments"`
}

// NewStreamingLLMService 创建流式LLM服务
func NewStreamingLLMService(
	ctx context.Context,
	credential *models.UserCredential,
	systemPrompt string,
	model string,
	temperature float64,
	maxTokens int,
	provider llm.LLMProvider,
	errorHandler *errhandler.Handler,
	logger *zap.Logger,
) *StreamingLLMService {
	return &StreamingLLMService{
		ctx:          ctx,
		credential:   credential,
		systemPrompt: systemPrompt,
		model:        model,
		temperature:  temperature,
		maxTokens:    maxTokens,
		provider:     provider,
		errorHandler: errorHandler,
		logger:       logger,
	}
}

// QueryStream 流式查询
func (s *StreamingLLMService) QueryStream(ctx context.Context, text string, onChunk func(chunk LLMStreamResponse)) error {
	s.mu.RLock()
	closed := s.closed
	provider := s.provider
	s.mu.RUnlock()

	if closed || provider == nil {
		return errhandler.NewRecoverableError("LLM", "服务已关闭", nil)
	}

	if text == "" {
		return errhandler.NewRecoverableError("LLM", "消息为空", nil)
	}

	// 设置系统提示
	if s.systemPrompt != "" {
		provider.SetSystemPrompt(s.systemPrompt)
	}

	// 构建流式查询选项
	options := llm.QueryOptions{
		Model:       s.model,
		MaxTokens:   intPtr(s.maxTokens),
		Temperature: float32Ptr(s.temperature),
		Stream:      true, // 关键：启用流式
	}

	// 创建带超时的上下文
	queryCtx, cancel := context.WithTimeout(ctx, 30*time.Second) // 流式处理需要更长超时
	defer cancel()

	s.logger.Info("开始流式LLM查询",
		zap.String("text", text),
		zap.String("model", s.model),
	)

	// 尝试流式查询
	if streamProvider, ok := provider.(llm.StreamProvider); ok {
		return s.handleStreamResponse(queryCtx, streamProvider, text, options, onChunk)
	}

	// 降级到普通查询
	s.logger.Warn("LLM提供商不支持流式，降级到普通查询")
	return s.handleNonStreamResponse(queryCtx, provider, text, options, onChunk)
}

// handleStreamResponse 处理流式响应
func (s *StreamingLLMService) handleStreamResponse(
	ctx context.Context,
	streamProvider llm.StreamProvider,
	text string,
	options llm.QueryOptions,
	onChunk func(chunk LLMStreamResponse),
) error {
	// 获取流式响应通道
	streamChan, err := streamProvider.QueryStreamWithOptions(text, options)
	if err != nil {
		return errhandler.NewRecoverableError("LLM", "流式查询失败", err)
	}

	var buffer bytes.Buffer
	var fullText strings.Builder
	isFirst := true
	startTime := time.Now()

	for {
		select {
		case <-ctx.Done():
			s.logger.Info("流式LLM查询被取消")
			return ctx.Err()

		case chunk, ok := <-streamChan:
			if !ok {
				// 处理剩余内容
				remaining := buffer.String()
				if remaining != "" {
					s.logger.Debug("处理剩余内容", zap.String("remaining", remaining))
					onChunk(LLMStreamResponse{
						Text:    remaining,
						IsStart: false,
						IsEnd:   true,
					})
				} else {
					onChunk(LLMStreamResponse{
						Text:    "",
						IsStart: false,
						IsEnd:   true,
					})
				}
				
				s.logger.Info("流式LLM查询完成",
					zap.String("fullText", fullText.String()),
					zap.Duration("duration", time.Since(startTime)),
				)
				return nil
			}

			if chunk.Error != nil {
				s.logger.Error("流式响应错误", zap.Error(chunk.Error))
				onChunk(LLMStreamResponse{
					Error: chunk.Error,
					IsEnd: true,
				})
				return chunk.Error
			}

			if chunk.Content != "" {
				fullText.WriteString(chunk.Content)
				buffer.WriteString(chunk.Content)

				// 智能分句处理
				if s.containsSentenceSeparator(chunk.Content, isFirst) {
					sentences, remaining := s.extractSmartSentences(buffer.String(), 2, 100, isFirst)
					
					for _, sentence := range sentences {
						if sentence != "" {
							if isFirst {
								s.logger.Info("LLM首句响应",
									zap.String("sentence", sentence),
									zap.Duration("firstResponseTime", time.Since(startTime)),
								)
							}

							onChunk(LLMStreamResponse{
								Text:    sentence,
								IsStart: isFirst,
								IsEnd:   false,
							})

							if isFirst {
								isFirst = false
							}
						}
					}

					buffer.Reset()
					buffer.WriteString(remaining)
				}
			}

			// 处理工具调用
			if len(chunk.ToolCalls) > 0 {
				s.logger.Info("收到工具调用", zap.Int("count", len(chunk.ToolCalls)))
				
				// 转换工具调用格式
				toolCalls := make([]ToolCall, len(chunk.ToolCalls))
				for i, tc := range chunk.ToolCalls {
					toolCalls[i] = ToolCall{
						ID:   tc.ID,
						Type: tc.Type,
						Function: ToolCallFunction{
							Name:      tc.Function.Name,
							Arguments: tc.Function.Arguments,
						},
					}
				}

				onChunk(LLMStreamResponse{
					ToolCalls: toolCalls,
					IsStart:   isFirst,
					IsEnd:     false,
				})
			}
		}
	}
}

// handleNonStreamResponse 处理非流式响应（降级方案）
func (s *StreamingLLMService) handleNonStreamResponse(
	ctx context.Context,
	provider llm.LLMProvider,
	text string,
	options llm.QueryOptions,
	onChunk func(chunk LLMStreamResponse),
) error {
	// 修改为非流式
	options.Stream = false

	response, err := provider.QueryWithOptions(text, options)
	if err != nil {
		classified := s.errorHandler.Classify(err, "LLM")
		s.logger.Error("LLM查询失败", zap.Error(classified))
		onChunk(LLMStreamResponse{
			Error: classified,
			IsEnd: true,
		})
		return classified
	}

	// 模拟流式响应，按句子分割
	sentences := s.splitIntoSentences(response)
	for i, sentence := range sentences {
		if sentence != "" {
			onChunk(LLMStreamResponse{
				Text:    sentence,
				IsStart: i == 0,
				IsEnd:   i == len(sentences)-1,
			})
		}
	}

	return nil
}

// containsSentenceSeparator 检查是否包含句子分隔符
func (s *StreamingLLMService) containsSentenceSeparator(text string, isFirst bool) bool {
	separators := []string{"。", "！", "？", ".", "!", "?", "\n"}
	if isFirst {
		// 首句更敏感，包含逗号也分割
		separators = append(separators, "，", ",", "；", ";")
	}
	
	for _, sep := range separators {
		if strings.Contains(text, sep) {
			return true
		}
	}
	return false
}

// extractSmartSentences 智能提取句子
func (s *StreamingLLMService) extractSmartSentences(text string, minSentences, maxLength int, isFirst bool) ([]string, string) {
	if len(text) == 0 {
		return nil, ""
	}

	// 定义分隔符优先级
	primarySeps := []string{"。", "！", "？", ".", "!", "?"}
	secondarySeps := []string{"，", ",", "；", ";", "\n"}
	
	var sentences []string
	var remaining string
	
	// 首先尝试主要分隔符
	for _, sep := range primarySeps {
		if strings.Contains(text, sep) {
			parts := strings.Split(text, sep)
			for i, part := range parts {
				if i < len(parts)-1 { // 不是最后一部分
					sentence := strings.TrimSpace(part + sep)
					if sentence != "" {
						sentences = append(sentences, sentence)
					}
				} else {
					remaining = strings.TrimSpace(part)
				}
			}
			break
		}
	}
	
	// 如果没有主要分隔符，且是首句，尝试次要分隔符
	if len(sentences) == 0 && isFirst {
		for _, sep := range secondarySeps {
			if strings.Contains(text, sep) {
				parts := strings.Split(text, sep)
				if len(parts) > 1 && len(parts[0]) >= 10 { // 确保有足够内容
					sentence := strings.TrimSpace(parts[0] + sep)
					sentences = append(sentences, sentence)
					remaining = strings.TrimSpace(strings.Join(parts[1:], sep))
					break
				}
			}
		}
	}
	
	// 如果文本过长，强制分割
	if len(sentences) == 0 && len(text) > maxLength {
		cutPoint := maxLength
		// 尝试在空格处分割
		if spaceIdx := strings.LastIndex(text[:cutPoint], " "); spaceIdx > maxLength/2 {
			cutPoint = spaceIdx
		}
		sentences = append(sentences, strings.TrimSpace(text[:cutPoint]))
		remaining = strings.TrimSpace(text[cutPoint:])
	}
	
	// 如果还是没有分割，返回原文本作为剩余
	if len(sentences) == 
0 {
		remaining = text
	}
	
	return sentences, remaining
}

// splitIntoSentences 将文本分割为句子（降级方案）
func (s *StreamingLLMService) splitIntoSentences(text string) []string {
	if text == "" {
		return nil
	}

	separators := []string{"。", "！", "？", ".", "!", "?", "\n"}
	sentences := []string{text}

	for _, sep := range separators {
		var newSentences []string
		for _, sentence := range sentences {
			parts := strings.Split(sentence, sep)
			for i, part := range parts {
				part = strings.TrimSpace(part)
				if part != "" {
					if i < len(parts)-1 {
						newSentences = append(newSentences, part+sep)
					} else {
						newSentences = append(newSentences, part)
					}
				}
			}
		}
		sentences = newSentences
	}

	// 过滤空句子
	var result []string
	for _, sentence := range sentences {
		if strings.TrimSpace(sentence) != "" {
			result = append(result, strings.TrimSpace(sentence))
		}
	}

	return result
}

// Close 关闭服务
func (s *StreamingLLMService) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.closed = true
	return nil
}

// 辅助函数
func intPtr(i int) *int {
	return &i
}

func float32Ptr(f float64) *float32 {
	f32 := float32(f)
	return &f32
}
package voicev2

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/code-100-precent/LingEcho/internal/models"
	v2 "github.com/code-100-precent/LingEcho/pkg/llm"
	"go.uber.org/zap"
)

// TextProcessor 文本处理器 - 处理LLM查询和TTS合成
type TextProcessor struct {
	logger *zap.Logger
}

// NewTextProcessor 创建文本处理器
func NewTextProcessor(logger *zap.Logger) *TextProcessor {
	return &TextProcessor{
		logger: logger,
	}
}

// Process 处理文本（调用LLM和TTS）
func (tp *TextProcessor) Process(
	client *VoiceClient,
	text string,
	writer *MessageWriter,
) {
	// 检查是否正在处理致命错误
	if client.state.IsFatalError() {
		tp.logger.Debug("正在处理致命错误，跳过文本处理", zap.String("text", text))
		return
	}

	// 使用状态机的锁来保护处理流程
	// 检查是否正在处理
	if client.state.IsProcessing() {
		tp.logger.Debug("正在处理中，跳过", zap.String("text", text))
		return
	}

	// 检查是否已处理
	if client.state.IsProcessed(text) {
		tp.logger.Debug("文本已处理，跳过", zap.String("text", text))
		return
	}

	// 标记为已处理
	client.state.MarkProcessed(text)
	client.state.SetProcessing(true)
	defer client.state.SetProcessing(false)

	tp.logger.Info("开始处理文本", zap.String("text", text))

	// 停止并取消之前的TTS合成（实现打断功能）
	client.state.CancelTTS()

	// 创建新的TTS context
	ttsCtx, ttsCancel := context.WithCancel(client.ctx)
	client.state.SetTTSCtx(ttsCtx, ttsCancel)

	// 使用流式LLM查询（双向流：LLM流式响应 -> TTS流式合成）
	if err := tp.callLLMStream(client, text, ttsCtx, writer); err != nil {
		// 检查是否是致命错误（额度不足等）
		if isFatalError(err) {
			// 致命错误：断开连接
			HandleFatalError(client, err, "LLM", writer, tp.logger)
			client.state.CancelTTS()
			return
		}
		// 非致命错误：只发送错误消息
		tp.logger.Error("调用LLM流式查询失败", zap.Error(err))
		writer.SendError("LLM处理失败: "+err.Error(), false)
		client.state.CancelTTS()
		return
	}
}

// callLLMStream 调用LLM流式查询（双向流：LLM流式响应 -> TTS流式合成）
func (tp *TextProcessor) callLLMStream(
	client *VoiceClient,
	text string,
	ctx context.Context,
	writer *MessageWriter,
) error {
	// Build query text (if knowledge base is provided, search knowledge base first)
	queryText := text
	if client.knowledgeKey != "" && client.db != nil {
		// Search knowledge base
		knowledgeResults, err := models.SearchKnowledgeBase(client.db, client.knowledgeKey, text, 5)
		if err != nil {
			tp.logger.Warn("Failed to search knowledge base", zap.Error(err))
			queryText = text
		} else if len(knowledgeResults) > 0 {
			var contextBuilder strings.Builder
			contextBuilder.WriteString(fmt.Sprintf("用户问题: %s\n\n", text))
			for i, result := range knowledgeResults {
				if i > 0 {
					contextBuilder.WriteString("\n\n")
				}
				contextBuilder.WriteString(result.Content)
			}
			contextBuilder.WriteString("\n\n请基于以上信息回答用户问题，回答要自然流畅，不要提及信息来源。")
			queryText = contextBuilder.String()
			tp.logger.Info("Retrieved relevant documents from knowledge base",
				zap.Int("count", len(knowledgeResults)),
				zap.String("key", client.knowledgeKey))
		} else {
			queryText = text
		}
	}

	// 构建系统提示词
	enhancedSystemPrompt := client.systemPrompt
	if client.maxTokens > 0 {
		estimatedChars := client.maxTokens * 3 / 2
		lengthGuidance := fmt.Sprintf("\n\n重要提示：你的回复有长度限制（约 %d 个字符），请确保在限制内完整回答。", estimatedChars)
		if enhancedSystemPrompt != "" {
			enhancedSystemPrompt = enhancedSystemPrompt + lengthGuidance
		} else {
			enhancedSystemPrompt = "请用中文回复用户的问题。" + lengthGuidance
		}
		client.llmHandler.SetSystemPrompt(enhancedSystemPrompt)
	}

	query := queryText
	if enhancedSystemPrompt != "" {
		query = fmt.Sprintf("%s\n\n问题: %s", enhancedSystemPrompt, queryText)
	}

	model := client.llmModel
	if model == "" {
		model = DefaultLLMModel
	}

	var temp *float32
	var maxTokens *int
	if client.temperature > 0 {
		tempVal := float32(client.temperature)
		temp = &tempVal
	}
	if client.maxTokens > 0 {
		maxTokens = &client.maxTokens
	}

	userID := uint(client.credential.UserID)
	assistantID := int64(client.assistantID)
	credentialID := client.credential.ID

	// 用于累积LLM响应文本
	var fullResponse strings.Builder
	var sentenceBuffer strings.Builder // 句子缓冲区，用于TTS流式合成
	var hasReceivedAnySegment bool     // 标记是否收到任何片段
	var callbackInvoked bool           // 标记回调是否被调用

	tp.logger.Info("开始LLM流式查询",
		zap.String("query", query),
		zap.String("model", model))

	// 使用流式查询，实现双向流
	finalResponse, err := client.llmHandler.QueryStream(query, v2.QueryOptions{
		Model:        model,
		Temperature:  temp,
		MaxTokens:    maxTokens,
		UserID:       &userID,
		AssistantID:  &assistantID,
		CredentialID: &credentialID,
		ChatType:     models.ChatTypeRealtime,
	}, func(segment string, isComplete bool) error {
		// 检查是否被取消
		if ctx.Err() != nil {
			return ctx.Err()
		}

		callbackInvoked = true
		tp.logger.Info("收到LLM流式片段",
			zap.String("segment", segment),
			zap.Bool("isComplete", isComplete),
			zap.Int("segmentLength", len(segment)))

		hasReceivedAnySegment = true

		// 累积完整响应
		fullResponse.WriteString(segment)

		// 发送LLM增量响应到前端
		if err := writer.SendLLMResponse(segment); err != nil {
			tp.logger.Error("发送LLM增量响应失败", zap.Error(err))
			return err
		}

		// 将segment添加到句子缓冲区并处理完整句子
		sentenceBuffer.WriteString(segment)
		tp.processSentenceBuffer(client, &sentenceBuffer, ctx, writer)

		// 如果LLM响应完成，处理剩余的文本
		if isComplete {
			remaining := sentenceBuffer.String()
			tp.logger.Info("LLM流式响应完成，处理剩余文本",
				zap.String("remaining", remaining),
				zap.String("fullResponse", fullResponse.String()))

			if remaining != "" {
				// 过滤 emoji
				filteredRemaining := filterEmojiText(remaining)
				if filteredRemaining != "" {
					if !tp.enqueueTTSTaskWithRetry(client, filteredRemaining, ctx, writer, 3, 100*time.Millisecond) {
						tp.logger.Error("剩余文本入队失败（已重试），可能无法播放", zap.String("text", filteredRemaining))
					} else {
						tp.logger.Info("剩余文本加入TTS队列", zap.String("text", filteredRemaining))
					}
				} else {
					tp.logger.Debug("剩余文本过滤后为空，跳过TTS合成", zap.String("original", remaining))
				}
			} else {
				// 如果没有剩余文本，但也没有触发句子检测，可能是响应很短或没有标点
				// 使用完整响应进行TTS合成
				fullText := fullResponse.String()
				if fullText != "" {
					// 过滤 emoji
					filteredFullText := filterEmojiText(fullText)
					if filteredFullText != "" {
						tp.logger.Info("完整响应加入TTS队列", zap.String("text", filteredFullText))
						if !tp.enqueueTTSTaskWithRetry(client, filteredFullText, ctx, writer, 3, 100*time.Millisecond) {
							tp.logger.Error("完整响应入队失败（已重试），可能无法播放", zap.String("text", filteredFullText))
						}
					} else {
						tp.logger.Debug("完整响应过滤后为空，跳过TTS合成", zap.String("original", fullText))
					}
				}
			}
		}

		return nil
	})

	if err != nil {
		tp.logger.Error("LLM流式查询失败", zap.Error(err))
		return fmt.Errorf("LLM流式查询失败: %w", err)
	}

	tp.logger.Info("LLM流式查询完成",
		zap.String("finalResponse", finalResponse),
		zap.String("accumulatedResponse", fullResponse.String()),
		zap.Bool("callbackInvoked", callbackInvoked),
		zap.Bool("hasReceivedAnySegment", hasReceivedAnySegment))

	// 如果流式回调没有被调用（可能因为标点符号检测问题），使用最终响应
	// 或者如果最终响应和累积响应不一致，使用最终响应
	finalText := finalResponse
	if !callbackInvoked || (!hasReceivedAnySegment && finalText != "") {
		tp.logger.Warn("流式回调未被调用，使用最终响应进行TTS合成",
			zap.String("finalResponse", finalText),
			zap.String("accumulatedResponse", fullResponse.String()),
			zap.Bool("callbackInvoked", callbackInvoked),
			zap.Bool("hasReceivedAnySegment", hasReceivedAnySegment))

		// 检查是否已经有文本在缓冲区中
		remaining := sentenceBuffer.String()
		if remaining != "" {
			// 如果缓冲区有内容，合并
			finalText = remaining + finalText
		}

		// 如果最终响应不为空且没有被处理过，进行TTS合成
		if finalText != "" {
			// 过滤 emoji
			filteredFinalText := filterEmojiText(finalText)
			if filteredFinalText != "" {
				if !tp.enqueueTTSTaskWithRetry(client, filteredFinalText, ctx, writer, 3, 100*time.Millisecond) {
					tp.logger.Error("最终响应入队失败（已重试），可能无法播放", zap.String("text", filteredFinalText))
				} else {
					tp.logger.Info("最终响应加入TTS队列（备用方案）", zap.String("text", filteredFinalText))
				}
			} else {
				tp.logger.Debug("最终响应过滤后为空，跳过TTS合成", zap.String("original", finalText))
			}
		}
	} else if hasReceivedAnySegment && sentenceBuffer.Len() > 0 {
		// 如果回调被调用了，但还有剩余文本在缓冲区中
		remaining := sentenceBuffer.String()
		if remaining != "" {
			// 过滤 emoji
			filteredRemaining := filterEmojiText(remaining)
			if filteredRemaining != "" {
				tp.logger.Info("处理缓冲区中的剩余文本", zap.String("remaining", filteredRemaining))
				if !tp.enqueueTTSTaskWithRetry(client, filteredRemaining, ctx, writer, 3, 100*time.Millisecond) {
					tp.logger.Error("缓冲区剩余文本入队失败（已重试），可能无法播放", zap.String("text", filteredRemaining))
				}
			} else {
				tp.logger.Debug("剩余文本过滤后为空，跳过TTS合成", zap.String("original", remaining))
			}
		}
	}

	return nil
}

// processSentenceBuffer 处理句子缓冲区，提取并处理所有完整句子
func (tp *TextProcessor) processSentenceBuffer(
	client *VoiceClient,
	sentenceBuffer *strings.Builder,
	ctx context.Context,
	writer *MessageWriter,
) {
	// 优化：只在循环开始时获取一次字符串，减少String()调用
	for {
		// 检查缓冲区长度，避免不必要的String()调用
		if sentenceBuffer.Len() == 0 {
			break
		}

		currentBuffer := sentenceBuffer.String()
		if currentBuffer == "" {
			break
		}

		// 提取第一个完整句子
		sentence := extractCompleteSentence(currentBuffer)
		if sentence == "" {
			tp.logger.Debug("缓冲区中没有完整句子，等待更多数据", zap.String("buffer", currentBuffer))
			break
		}

		// 过滤 emoji 并处理句子
		filteredSentence := filterEmojiText(sentence)
		if filteredSentence == "" {
			tp.logger.Debug("句子过滤后为空，跳过TTS合成", zap.String("original", sentence))
			// 移除已处理的句子，继续处理下一个
			tp.removeProcessedSentence(sentenceBuffer, sentence, currentBuffer)
			continue
		}

		// 将TTS任务加入队列（带重试，确保每句话都能播放）
		if !tp.enqueueTTSTaskWithRetry(client, filteredSentence, ctx, writer, 3, 100*time.Millisecond) {
			// 重试失败，记录错误但继续处理（避免阻塞）
			tp.logger.Error("TTS任务入队失败（已重试），跳过该句子",
				zap.String("sentence", filteredSentence),
				zap.String("pendingBuffer", currentBuffer))
			// 移除已处理的句子，继续处理下一个
			tp.removeProcessedSentence(sentenceBuffer, sentence, currentBuffer)
			continue
		}

		tp.logger.Info("检测到完整句子，加入TTS队列",
			zap.String("sentence", filteredSentence),
			zap.String("original", sentence))

		// 移除已处理的句子，保留剩余部分
		tp.removeProcessedSentence(sentenceBuffer, sentence, currentBuffer)
	}
}

// enqueueTTSTask 将TTS任务加入队列（统一方法）
func (tp *TextProcessor) enqueueTTSTask(
	client *VoiceClient,
	text string,
	ctx context.Context,
	writer *MessageWriter,
) bool {
	ttsCtx, ttsCancel := context.WithCancel(ctx)
	task := &TTSTask{
		Text:   text,
		Ctx:    ttsCtx,
		Writer: writer,
	}

	if !client.state.EnqueueTTS(task) {
		ttsCancel()
		return false
	}
	return true
}

// enqueueTTSTaskWithRetry 将TTS任务加入队列（带重试机制，确保每句话都能播放）
func (tp *TextProcessor) enqueueTTSTaskWithRetry(
	client *VoiceClient,
	text string,
	ctx context.Context,
	writer *MessageWriter,
	maxRetries int,
	retryDelay time.Duration,
) bool {
	for i := 0; i < maxRetries; i++ {
		if tp.enqueueTTSTask(client, text, ctx, writer) {
			if i > 0 {
				tp.logger.Info("TTS任务入队成功（重试后）",
					zap.String("text", text),
					zap.Int("retryCount", i))
			}
			return true
		}

		// 检查上下文是否已取消
		if ctx.Err() != nil {
			tp.logger.Debug("TTS任务入队时上下文已取消", zap.String("text", text))
			return false
		}

		// 等待后重试
		if i < maxRetries-1 {
			tp.logger.Debug("TTS队列已满，等待后重试",
				zap.String("text", text),
				zap.Int("retry", i+1),
				zap.Int("maxRetries", maxRetries),
				zap.Duration("retryDelay", retryDelay))
			select {
			case <-ctx.Done():
				return false
			case <-time.After(retryDelay):
				// 继续重试
			}
		}
	}

	tp.logger.Warn("TTS任务入队失败（已重试所有次数）",
		zap.String("text", text),
		zap.Int("maxRetries", maxRetries))
	return false
}

// removeProcessedSentence 从缓冲区中移除已处理的句子（UTF-8安全）
func (tp *TextProcessor) removeProcessedSentence(
	sentenceBuffer *strings.Builder,
	sentence string,
	currentBuffer string,
) {
	// 使用 []rune 进行UTF-8安全的字符串切片
	sentenceRunes := []rune(sentence)
	currentRunes := []rune(currentBuffer)

	if len(sentenceRunes) >= len(currentRunes) {
		// 如果句子长度大于等于缓冲区，清空缓冲区
		sentenceBuffer.Reset()
		return
	}

	// 提取剩余部分
	remainingRunes := currentRunes[len(sentenceRunes):]
	sentenceBuffer.Reset()
	for _, r := range remainingRunes {
		sentenceBuffer.WriteRune(r)
	}
}

package voice

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/code-100-precent/LingEcho/internal/models"
	v2 "github.com/code-100-precent/LingEcho/pkg/llm"
	"github.com/code-100-precent/LingEcho/pkg/media"
	"github.com/code-100-precent/LingEcho/pkg/synthesizer"
	"github.com/gorilla/websocket"
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
	case "hello":
		// xiaozhi协议hello消息处理
		mh.handleHelloMessage(client, msg, writer)
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

// handleHelloMessage 处理xiaozhi协议的hello消息
func (mh *MessageHandler) handleHelloMessage(client *VoiceClient, msg map[string]interface{}, writer *MessageWriter) {
	mh.logger.Info("收到hello消息", zap.Any("message", msg))

	// 提取audio_params（音频参数）
	audioFormat := "opus" // 默认格式
	sampleRate := 16000   // 默认采样率
	channels := 1         // 默认声道数

	if audioParams, ok := msg["audio_params"].(map[string]interface{}); ok {
		if format, ok := audioParams["format"].(string); ok {
			audioFormat = format
			mh.logger.Info("客户端音频格式", zap.String("format", format))
		}
		if rate, ok := audioParams["sample_rate"].(float64); ok {
			sampleRate = int(rate)
			mh.logger.Info("客户端采样率", zap.Int("sample_rate", sampleRate))
		}
		if ch, ok := audioParams["channels"].(float64); ok {
			channels = int(ch)
			mh.logger.Info("客户端声道数", zap.Int("channels", channels))
		}
	}

	// 提取features（特性，如MCP支持）
	var features map[string]interface{}
	if feat, ok := msg["features"].(map[string]interface{}); ok {
		features = feat
		if mcp, ok := feat["mcp"].(bool); ok && mcp {
			mh.logger.Info("客户端支持MCP功能")
			// TODO: 如果需要，可以在这里初始化MCP客户端
		}
	}

	// 发送Welcome响应（xiaozhi协议的hello响应）
	sessionID, err := writer.SendWelcome(audioFormat, sampleRate, channels, features)
	if err != nil {
		mh.logger.Error("发送Welcome响应失败", zap.Error(err))
	} else {
		// 设置xiaozhi协议模式，使用返回的sessionID
		writer.SetXiaozhiMode(sessionID)
		mh.logger.Info("已发送Welcome响应，启用xiaozhi协议模式",
			zap.String("audioFormat", audioFormat),
			zap.Int("sampleRate", sampleRate),
			zap.Int("channels", channels),
			zap.String("sessionID", sessionID))
	}
}

// ASRResultHandler ASR结果处理器
type ASRResultHandler struct {
	logger *zap.Logger
}

// NewASRResultHandler 创建ASR结果处理器
func NewASRResultHandler(logger *zap.Logger) *ASRResultHandler {
	return &ASRResultHandler{
		logger: logger,
	}
}

// isCompleteSentence 判断是否是完整句子（包含句号、问号、感叹号等结束标记）
func isCompleteSentence(text string) bool {
	if text == "" {
		return false
	}
	// 检查是否包含句子结束标记
	endMarkers := []string{"。", "？", "！", ".", "?", "!"}
	for _, marker := range endMarkers {
		if strings.Contains(text, marker) {
			return true
		}
	}
	return false
}

// isMeaninglessText 判断文本是否是无意义的（应该被过滤）
// 过滤单字语气词、无意义的短词等
func isMeaninglessText(text string) bool {
	if text == "" {
		return true
	}

	// 去除标点符号和空白字符后检查
	cleanedText := strings.TrimSpace(text)
	cleanedText = strings.Trim(cleanedText, "。，、；：？！\"\"''（）【】《》")

	// 如果清理后为空，认为是无意义的
	if cleanedText == "" {
		return true
	}

	// 定义无意义的词列表（常见的语气词、单字等）
	meaninglessWords := []string{
		"嗯", "啊", "呃", "额", "哦", "噢", "哦", "呀", "哈", "嘿",
		"喂", "哼", "唉", "哎", "唉", "诶", "诶", "欸",
		"嗯嗯", "啊啊", "呃呃", "哦哦", "呵呵", "哈哈",
		"什么", "啥", "咋", "哪", "那个", "这个",
		"额", "额额", "呃呃", "啊这", "啊这这",
	}

	// 检查是否完全匹配无意义词
	for _, word := range meaninglessWords {
		if cleanedText == word {
			return true
		}
	}

	// 检查文本长度（如果只有1-2个字符，且不是常见有意义的词，则认为是无意义的）
	if len([]rune(cleanedText)) <= 2 {
		// 检查是否是常见的有意义单字词（可根据需要扩展）
		meaningfulSingleChars := []string{"行", "可", "不", "否", "要"}
		isMeaningful := false
		for _, char := range meaningfulSingleChars {
			if cleanedText == char {
				isMeaningful = true
				break
			}
		}
		if !isMeaningful {
			return true
		}
	}

	return false
}

// filterText 过滤文本，去除无意义内容
func filterText(text string) string {
	if text == "" {
		return ""
	}

	// 如果整个文本都是无意义的，返回空字符串
	if isMeaninglessText(text) {
		return ""
	}

	// 去除首尾的常见语气词
	cleaned := strings.TrimSpace(text)

	// 定义需要去除的前缀和后缀语气词
	prefixes := []string{"嗯", "啊", "呃", "额", "哦", "噢", "呀", "哈", "嘿", "喂", "哼", "唉", "哎", "诶", "欸"}
	suffixes := []string{"嗯", "啊", "呃", "额", "哦", "噢", "呀", "哈", "嘿", "哼", "唉", "哎", "诶", "欸"}

	for _, prefix := range prefixes {
		if strings.HasPrefix(cleaned, prefix) {
			cleaned = strings.TrimPrefix(cleaned, prefix)
			cleaned = strings.TrimSpace(cleaned)
		}
	}

	for _, suffix := range suffixes {
		if strings.HasSuffix(cleaned, suffix) {
			cleaned = strings.TrimSuffix(cleaned, suffix)
			cleaned = strings.TrimSpace(cleaned)
		}
	}

	return cleaned
}

// HandleResult 处理ASR识别结果
func (h *ASRResultHandler) HandleResult(
	client *VoiceClient,
	text string,
	isLast bool,
	writer *MessageWriter,
	processor *TextProcessor,
) {
	if text == "" {
		return
	}

	// 对于isLast=false的情况，可能是两种回调：
	// 1. OnRecognitionResultChange: 实时累积更新（你 -> 你好 -> 你好你是谁），不应该发送
	// 2. OnSentenceEnd: 句子结束，文本是累积的完整句子（喂，说话。你好。），需要提取增量部分
	if !isLast {
		// 更新累积文本
		client.state.SetLastText(text)

		// 检查是否是完整句子（包含句号等结束标记）
		if isCompleteSentence(text) {
			// 是完整句子（OnSentenceEnd），从累积文本中提取增量句子
			incrementalSentence := client.state.ExtractIncrementalSentence(text)

			if incrementalSentence == "" {
				// 没有增量文本，可能是重复的句子结束回调
				h.logger.Debug("ASR完整句子无增量，跳过", zap.String("cumulativeText", text))
				return
			}

			// 过滤无意义的文本
			filteredSentence := filterText(incrementalSentence)
			if filteredSentence == "" || isMeaninglessText(filteredSentence) {
				// 过滤后为空或仍是无意义的，跳过处理
				h.logger.Debug("ASR完整句子被过滤（无意义），跳过",
					zap.String("original", incrementalSentence),
					zap.String("filtered", filteredSentence),
				)
				// 仍然更新累积文本，避免重复处理
				client.state.SetLastProcessedCumulativeText(text)
				return
			}

			// 更新上次处理的累积文本
			client.state.SetLastProcessedCumulativeText(text)

			// 发送过滤后的句子给前端
			if err := writer.SendASRResult(filteredSentence); err != nil {
				h.logger.Error("发送ASR增量句子失败", zap.Error(err))
				return
			}
			client.state.SetLastSentText(filteredSentence)

			h.logger.Info("收到ASR完整句子（OnSentenceEnd），提取增量并处理",
				zap.String("cumulativeText", text),
				zap.String("incrementalSentence", incrementalSentence),
				zap.String("filteredSentence", filteredSentence),
			)
			// 立即处理过滤后的句子（调用LLM和TTS）
			processor.Process(client, filteredSentence, writer)
		} else {
			// 不是完整句子（OnRecognitionResultChange），只累积，不发送，不处理
			h.logger.Debug("ASR中间结果，只累积不发送不处理",
				zap.String("text", text),
				zap.Bool("isLast", isLast),
			)
		}
		return
	}

	// 对于isLast=true的情况（OnRecognitionComplete），这是最终结果
	// 检查是否已处理过（防止重复处理）
	if client.state.IsProcessed(text) {
		h.logger.Debug("最终结果已处理，跳过", zap.String("text", text))
		return
	}

	// 停止之前的静音计时器（如果有）
	client.state.StopSilenceTimer()

	// 从最终累积文本中提取增量部分（如果有）
	incrementalSentence := client.state.ExtractIncrementalSentence(text)
	finalSentence := incrementalSentence
	if finalSentence == "" {
		// 如果没有增量，使用完整文本
		finalSentence = text
	}

	// 过滤无意义的文本
	filteredSentence := filterText(finalSentence)
	if filteredSentence == "" || isMeaninglessText(filteredSentence) {
		// 过滤后为空或仍是无意义的，跳过处理
		h.logger.Debug("ASR最终结果被过滤（无意义），跳过",
			zap.String("original", finalSentence),
			zap.String("filtered", filteredSentence),
		)
		// 仍然更新累积文本，避免重复处理
		client.state.SetLastProcessedCumulativeText(text)
		return
	}

	// 发送过滤后的最终结果给前端
	if err := writer.SendASRResult(filteredSentence); err != nil {
		h.logger.Error("发送ASR最终结果失败", zap.Error(err))
		return
	}

	// 更新已发送的文本和累积文本
	client.state.SetLastSentText(filteredSentence)
	client.state.SetLastProcessedCumulativeText(text)

	h.logger.Info("收到ASR最终识别结果（OnRecognitionComplete），发送给前端并立即处理",
		zap.String("cumulativeText", text),
		zap.String("finalSentence", finalSentence),
		zap.String("filteredSentence", filteredSentence),
	)
	// 立即处理过滤后的最终结果（调用LLM和TTS）
	processor.Process(client, filteredSentence, writer)

	// 清空累积文本，准备下次识别
	client.state.SetLastProcessedCumulativeText("")
}

// handleDelayedProcess 处理延迟处理的文本
func (h *ASRResultHandler) handleDelayedProcess(
	client *VoiceClient,
	writer *MessageWriter,
	processor *TextProcessor,
) {
	text := client.state.GetLastText()

	// 检查文本是否已被处理
	if client.state.IsProcessed(text) {
		h.logger.Debug("延迟处理时文本已处理，跳过", zap.String("text", text))
		return
	}

	// 检查文本是否为空
	if text == "" {
		h.logger.Debug("延迟处理时文本为空，跳过")
		return
	}

	h.logger.Debug("延迟处理计时器触发，开始处理", zap.String("text", text))
	processor.Process(client, text, writer)
}

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
		tp.logger.Error("调用LLM流式查询失败", zap.Error(err))
		writer.SendError("LLM处理失败", false)
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
		SessionID:    fmt.Sprintf("voice_%d_%d", client.credential.UserID, time.Now().Unix()),
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
					ttsCtx, ttsCancel := context.WithCancel(ctx)
					task := &TTSTask{
						Text:   filteredRemaining,
						Ctx:    ttsCtx,
						Writer: writer,
					}
					if !client.state.EnqueueTTS(task) {
						ttsCancel()
						tp.logger.Warn("TTS队列已满，丢弃剩余文本任务", zap.String("text", filteredRemaining))
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
						ttsCtx, ttsCancel := context.WithCancel(ctx)
						task := &TTSTask{
							Text:   filteredFullText,
							Ctx:    ttsCtx,
							Writer: writer,
						}
						if !client.state.EnqueueTTS(task) {
							ttsCancel()
							tp.logger.Warn("TTS队列已满，丢弃完整响应任务", zap.String("text", filteredFullText))
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
				ttsCtx, ttsCancel := context.WithCancel(ctx)
				task := &TTSTask{
					Text:   filteredFinalText,
					Ctx:    ttsCtx,
					Writer: writer,
				}
				if !client.state.EnqueueTTS(task) {
					ttsCancel()
					tp.logger.Warn("TTS队列已满，丢弃最终响应任务", zap.String("text", filteredFinalText))
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
				ttsCtx, ttsCancel := context.WithCancel(ctx)
				task := &TTSTask{
					Text:   filteredRemaining,
					Ctx:    ttsCtx,
					Writer: writer,
				}
				if !client.state.EnqueueTTS(task) {
					ttsCancel()
					tp.logger.Warn("TTS队列已满，丢弃剩余文本任务", zap.String("text", filteredRemaining))
				}
			} else {
				tp.logger.Debug("剩余文本过滤后为空，跳过TTS合成", zap.String("original", remaining))
			}
		}
	}

	return nil
}

// isCompleteSentenceForStream 检查是否是完整句子（用于流式处理）
func isCompleteSentenceForStream(text string) bool {
	if len(text) == 0 {
		return false
	}
	// 检查是否以句号、问号、感叹号等结尾（使用rune处理中文）
	runes := []rune(text)
	if len(runes) == 0 {
		return false
	}
	lastChar := runes[len(runes)-1]
	return lastChar == '。' || lastChar == '！' || lastChar == '？' ||
		lastChar == '.' || lastChar == '!' || lastChar == '?'
}

// processSentenceBuffer 处理句子缓冲区，提取并处理所有完整句子
func (tp *TextProcessor) processSentenceBuffer(
	client *VoiceClient,
	sentenceBuffer *strings.Builder,
	ctx context.Context,
	writer *MessageWriter,
) {
	for {
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

		// 将TTS任务加入队列
		if !tp.enqueueTTSTask(client, filteredSentence, ctx, writer) {
			// 队列满时停止处理，避免乱序
			break
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
		tp.logger.Warn("TTS队列已满，丢弃任务", zap.String("text", text))
		return false
	}
	return true
}

// removeProcessedSentence 从缓冲区中移除已处理的句子
func (tp *TextProcessor) removeProcessedSentence(
	sentenceBuffer *strings.Builder,
	sentence string,
	currentBuffer string,
) {
	remaining := currentBuffer[len(sentence):]
	sentenceBuffer.Reset()
	sentenceBuffer.WriteString(remaining)
}

// extractCompleteSentence 提取完整句子（从开头到第一个句子结束符）
func extractCompleteSentence(text string) string {
	runes := []rune(text)
	for i, char := range runes {
		if char == '。' || char == '！' || char == '？' ||
			char == '.' || char == '!' || char == '?' {
			return string(runes[:i+1])
		}
	}
	return ""
}

// filterEmojiText 过滤文本中的 emoji，只移除 emoji 但保留文本内容
func filterEmojiText(text string) string {
	if text == "" {
		return ""
	}
	// 移除文本中的 emoji，只保留文字部分
	var result strings.Builder
	for _, char := range text {
		// 检查是否是 emoji 范围
		isEmoji := (char >= 0x1F300 && char <= 0x1F9FF) || // Emoticons, Symbols, Pictographs
			(char >= 0x2600 && char <= 0x26FF) || // Miscellaneous Symbols
			(char >= 0x2700 && char <= 0x27BF) || // Dingbats
			(char >= 0xFE00 && char <= 0xFE0F) || // Variation Selectors
			(char == 0x200D) // Zero Width Joiner

		// 保留非 emoji 字符
		if !isEmoji {
			result.WriteRune(char)
		}
	}
	filtered := strings.TrimSpace(result.String())
	return filtered
}

// processTTSTask 处理TTS任务（从队列中调用）
func (tp *TextProcessor) processTTSTask(client *VoiceClient, task *TTSTask) {
	if task == nil || task.Text == "" {
		return
	}

	// 检查是否被取消
	if task.Ctx.Err() != nil {
		tp.logger.Debug("TTS任务已被取消", zap.String("text", task.Text))
		return
	}

	// 执行TTS合成
	tp.synthesizeTTSStream(client, task.Text, task.Ctx, task.Writer)
}

// synthesizeTTSStream 流式合成TTS（用于双向流）
func (tp *TextProcessor) synthesizeTTSStream(
	client *VoiceClient,
	text string,
	ttsCtx context.Context,
	writer *MessageWriter,
) {
	if text == "" {
		return
	}

	// 检查是否被取消
	if ttsCtx.Err() != nil {
		return
	}

	// 获取音频格式信息
	format := client.ttsService.Format()

	// 立即标记TTS开始播放（暂停ASR识别）- 在发送任何音频之前就暂停
	client.state.SetTTSPlaying(true)
	tp.logger.Debug("TTS开始，暂停ASR识别")

	// 发送TTS开始消息
	if err := writer.SendTTSStart(format); err != nil {
		tp.logger.Error("发送TTS开始消息失败", zap.Error(err))
		client.state.SetTTSPlaying(false)
		return
	}

	// 检查是否被取消
	if ttsCtx.Err() != nil {
		client.state.SetTTSPlaying(false)
		return
	}

	// 跟踪发送的音频数据总量（用于计算播放时长）
	var totalAudioBytes int64
	audioStartTime := time.Now()
	var firstTTSAudioReceived bool // 标记是否已收到第一个TTS音频数据

	// 创建音频流处理器
	ttsHandler := &TTSStreamHandler{
		conn: client.conn,
		onMessage: func(data []byte) {
			if ttsCtx.Err() != nil {
				tp.logger.Debug("TTS音频数据回调时上下文已取消")
				return
			}
			// 确保在发送音频数据时，ASR已经暂停
			if !client.state.IsTTSPlaying() {
				client.state.SetTTSPlaying(true)
				tp.logger.Debug("TTS音频发送时，确保ASR已暂停")
			}
			if len(data) > 0 {
				// 累加音频数据总量
				totalAudioBytes += int64(len(data))

				// 统计从ASR完成到第一个TTS音频生成的延迟
				if !firstTTSAudioReceived {
					firstTTSAudioReceived = true
					asrCompleteTime := client.state.GetASRCompleteTime()
					if !asrCompleteTime.IsZero() {
						latency := time.Since(asrCompleteTime)
						tp.logger.Info("📊 TTS延迟统计",
							zap.String("text", text),
							zap.Duration("asrToFirstTTSLatency", latency),
							zap.String("latencyMs", fmt.Sprintf("%.2fms", float64(latency.Nanoseconds())/1e6)),
							zap.Time("asrCompleteTime", asrCompleteTime),
							zap.Time("firstTTSAudioTime", time.Now()))
					}
				}

				tp.logger.Info("收到TTS音频数据，准备发送",
					zap.Int("size", len(data)),
					zap.String("provider", string(client.ttsService.Provider())))

				// 直接发送音频数据（已优化分块逻辑）
				chunkSize := 8192
				if len(data) > chunkSize {
					totalChunks := (len(data) + chunkSize - 1) / chunkSize
					tp.logger.Debug("TTS音频数据较大，分块发送",
						zap.Int("totalSize", len(data)),
						zap.Int("chunkSize", chunkSize),
						zap.Int("totalChunks", totalChunks))

					for i := 0; i < len(data); i += chunkSize {
						end := i + chunkSize
						if end > len(data) {
							end = len(data)
						}
						chunk := data[i:end]
						if err := writer.SendBinary(chunk); err != nil {
							tp.logger.Error("发送TTS音频流块失败",
								zap.Error(err),
								zap.Int("chunkIndex", i/chunkSize+1),
								zap.Int("chunkSize", len(chunk)))
							return
						}
						tp.logger.Debug("TTS音频块发送成功",
							zap.Int("chunkIndex", i/chunkSize+1),
							zap.Int("chunkSize", len(chunk)))
					}
				} else {
					if err := writer.SendBinary(data); err != nil {
						tp.logger.Error("发送TTS音频流失败",
							zap.Error(err),
							zap.Int("size", len(data)))
					} else {
						tp.logger.Debug("TTS音频数据发送成功", zap.Int("size", len(data)))
					}
				}
			}
		},
	}

	// 在goroutine中合成，避免阻塞
	go func() {
		defer func() {
			tp.logger.Info("TTS合成goroutine结束，清理状态")

			// 先发送TTS结束消息
			if err := writer.SendTTSEnd(); err != nil {
				tp.logger.Error("发送TTS结束消息失败", zap.Error(err))
			}

			// 计算音频播放时长
			estimatedPlayDuration := tp.calculatePlayDuration(totalAudioBytes, format, text)

			tp.logger.Info("等待TTS音频播放完成",
				zap.String("text", text),
				zap.Int64("totalAudioBytes", totalAudioBytes),
				zap.Duration("estimatedPlayDuration", estimatedPlayDuration),
				zap.Duration("audioSendDuration", time.Since(audioStartTime)))

			// 等待估算的播放时长，确保前端播放完成
			time.Sleep(estimatedPlayDuration)

			// 恢复ASR识别
			client.state.SetTTSPlaying(false)

			// 检查并恢复ASR服务（如果需要）
			if client.asrService != nil && !client.asrService.Activity() {
				tp.logger.Warn("ASR服务已停止，正在重启", zap.String("text", text))
				client.asrService.RestartClient()
				tp.logger.Info("ASR服务已成功重启", zap.String("text", text))
			}

			tp.logger.Debug("TTS结束，恢复ASR识别", zap.String("text", text))

			// 发送完成信号，通知队列可以处理下一个任务（非阻塞）
			select {
			case client.state.GetTTSTaskDone() <- struct{}{}:
				// 成功发送信号
				tp.logger.Debug("TTS任务完成信号已发送")
			default:
				// 没有接收者等待，忽略（可能是最后一个任务）
			}
		}()

		tp.logger.Info("开始TTS合成",
			zap.String("text", text),
			zap.String("provider", string(client.ttsService.Provider())),
			zap.Int("textLength", len(text)))

		if err := client.ttsService.Synthesize(ttsCtx, ttsHandler, text); err != nil {
			if ttsCtx.Err() == context.Canceled {
				tp.logger.Debug("TTS合成已被取消")
				return
			}
			tp.logger.Error("调用TTS失败", zap.Error(err))
			writer.SendError("TTS合成失败", false)
			return
		}

		tp.logger.Info("TTS合成完成",
			zap.String("text", text),
			zap.Int64("totalAudioBytes", totalAudioBytes),
			zap.Duration("audioSendDuration", time.Since(audioStartTime)))
	}()
}

// synthesizeTTS 合成TTS（保留用于兼容）
func (tp *TextProcessor) synthesizeTTS(
	client *VoiceClient,
	llmResponse string,
	ttsCtx context.Context,
	writer *MessageWriter,
) {
	tp.synthesizeTTSStream(client, llmResponse, ttsCtx, writer)
}

// TTSStreamHandler TTS音频流处理器
type TTSStreamHandler struct {
	conn      *websocket.Conn
	onMessage func([]byte)
}

func (h *TTSStreamHandler) OnMessage(data []byte) {
	if h.onMessage != nil {
		h.onMessage(data)
	}
}

func (h *TTSStreamHandler) OnTimestamp(timestamp synthesizer.SentenceTimestamp) {
	// 可以处理时间戳信息，如果需要可以发送到前端
}

// processRemainingText 处理剩余文本（LLM响应完成后的剩余部分）
func (tp *TextProcessor) processRemainingText(
	client *VoiceClient,
	remaining string,
	ctx context.Context,
	writer *MessageWriter,
) {
	// 过滤 emoji
	filteredRemaining := filterEmojiText(remaining)
	if filteredRemaining == "" {
		tp.logger.Debug("剩余文本过滤后为空，跳过TTS合成", zap.String("original", remaining))
		return
	}

	// 将剩余文本加入TTS队列
	if tp.enqueueTTSTask(client, filteredRemaining, ctx, writer) {
		tp.logger.Info("剩余文本加入TTS队列", zap.String("text", filteredRemaining))
	}
}

// sendTTSAudioData 发送TTS音频数据（自动分块处理）
func (tp *TextProcessor) sendTTSAudioData(writer *MessageWriter, data []byte) error {
	const chunkSize = 8192

	if len(data) <= chunkSize {
		// 小数据直接发送
		return writer.SendBinary(data)
	}

	// 大数据分块发送
	totalChunks := (len(data) + chunkSize - 1) / chunkSize
	tp.logger.Debug("TTS音频数据较大，分块发送",
		zap.Int("totalSize", len(data)),
		zap.Int("chunkSize", chunkSize),
		zap.Int("totalChunks", totalChunks))

	for i := 0; i < len(data); i += chunkSize {
		end := i + chunkSize
		if end > len(data) {
			end = len(data)
		}

		if err := writer.SendBinary(data[i:end]); err != nil {
			return fmt.Errorf("发送TTS音频块失败 (chunk %d/%d): %w", i/chunkSize+1, totalChunks, err)
		}
	}

	return nil
}

// calculatePlayDuration 计算音频播放时长
func (tp *TextProcessor) calculatePlayDuration(
	totalAudioBytes int64,
	format media.StreamFormat,
	text string,
) time.Duration {
	var estimatedPlayDuration time.Duration

	// 基于音频数据量计算播放时长
	// 对于PCM音频：播放时长 = 字节数 / (采样率 * 声道数 * 位深度/8)
	if format.SampleRate > 0 && format.Channels > 0 && format.BitDepth > 0 {
		bytesPerSecond := int64(format.SampleRate * format.Channels * format.BitDepth / 8)
		if bytesPerSecond > 0 {
			estimatedPlayDuration = time.Duration(totalAudioBytes*1000/bytesPerSecond) * time.Millisecond
			// 增加5%的缓冲时间，确保播放完成
			estimatedPlayDuration = time.Duration(float64(estimatedPlayDuration) * 1.05)
		}
	}

	// 如果无法计算播放时长，使用默认延迟（基于文本长度估算）
	if estimatedPlayDuration == 0 {
		// 假设平均语速：150字/分钟 = 2.5字/秒
		// 每个字符约0.45秒
		estimatedPlayDuration = time.Duration(len([]rune(text))*450) * time.Millisecond
	}

	// 确保最小延迟为250ms，最大延迟为8秒
	if estimatedPlayDuration < 250*time.Millisecond {
		estimatedPlayDuration = 250 * time.Millisecond
	}
	if estimatedPlayDuration > 8*time.Second {
		estimatedPlayDuration = 8 * time.Second
	}

	return estimatedPlayDuration
}

// HandleASRError 处理ASR错误
func HandleASRError(client *VoiceClient, err error, isFatal bool, writer *MessageWriter, logger *zap.Logger) {
	logger.Error("ASR错误", zap.Error(err), zap.Bool("fatal", isFatal))

	if err := writer.SendError(fmt.Sprintf("ASR错误: %v", err), isFatal); err != nil {
		logger.Error("发送ASR错误消息失败", zap.Error(err))
	}

	if isFatal {
		client.isActive = false
	}
}

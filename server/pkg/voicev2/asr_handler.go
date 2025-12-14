package voicev2

import (
	"go.uber.org/zap"
)

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

// HandleResult 处理ASR识别结果
func (h *ASRResultHandler) HandleResult(
	client *VoiceClient,
	text string,
	isLast bool,
	writer *MessageWriter,
	processor *TextProcessor,
) {
	// 检查是否正在处理致命错误
	if client.state != nil && client.state.IsFatalError() {
		h.logger.Debug("正在处理致命错误，忽略ASR结果", zap.String("text", text))
		return
	}

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
			if filteredSentence == "" {
				// 过滤后为空，跳过处理
				h.logger.Debug("ASR完整句子被过滤（无意义），跳过",
					zap.String("original", incrementalSentence),
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

	// 从最终累积文本中提取增量部分（如果有）
	// 这里会检查相似度，如果高度相似会返回空字符串
	incrementalSentence := client.state.ExtractIncrementalSentence(text)
	if incrementalSentence == "" {
		// 如果没有增量或高度相似，跳过处理
		h.logger.Debug("ASR最终结果无增量或高度相似，跳过",
			zap.String("cumulativeText", text),
			zap.String("lastProcessed", client.state.GetLastProcessedCumulativeText()),
		)
		// 仍然更新累积文本，避免重复处理
		client.state.SetLastProcessedCumulativeText(text)
		return
	}

	finalSentence := incrementalSentence

	// 发送过滤后的最终结果给前端
	if err := writer.SendASRResult(text); err != nil {
		h.logger.Error("发送ASR最终结果失败", zap.Error(err))
		return
	}

	// 过滤无意义的文本
	filteredSentence := filterText(finalSentence)
	if filteredSentence == "" {
		// 过滤后为空，跳过处理
		h.logger.Debug("ASR最终结果被过滤（无意义），跳过",
			zap.String("original", finalSentence),
		)
		// 仍然更新累积文本，避免重复处理
		client.state.SetLastProcessedCumulativeText(text)
		return
	}

	// 更新已发送的文本和累积文本
	client.state.SetLastSentText(filteredSentence)
	client.state.SetLastProcessedCumulativeText(text)

	h.logger.Info("收到ASR最终识别结果（OnRecognitionComplete），发送给前端并立即处理",
		zap.String("cumulativeText", text),
		zap.String("incrementalSentence", incrementalSentence),
		zap.String("filteredSentence", filteredSentence),
	)
	// 立即处理过滤后的最终结果（调用LLM和TTS）
	// 注意：使用 filteredSentence 而不是原始 text
	processor.Process(client, filteredSentence, writer)

	// 不要清空累积文本！保留它用于后续的相似度比较
	// 只有在真正开始新的对话时才清空（例如收到 new_session 消息）
}

// HandleASRError 处理ASR错误
func HandleASRError(client *VoiceClient, err error, isFatal bool, writer *MessageWriter, logger *zap.Logger) {
	if err == nil {
		return
	}

	// 检查是否是致命错误（额度不足等）
	if isFatalError(err) {
		isFatal = true
	}

	// 使用统一的致命错误处理
	HandleFatalError(client, err, "ASR", writer, logger)

	if isFatal {
		client.SetActive(false)
	}
}

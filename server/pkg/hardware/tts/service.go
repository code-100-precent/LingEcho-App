package tts

import (
	"context"
	"strings"
	"sync"
	"unicode"

	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/code-100-precent/LingEcho/pkg/hardware/errhandler"
	"github.com/code-100-precent/LingEcho/pkg/synthesizer"
	"go.uber.org/zap"
)

// Service TTS服务实现
type Service struct {
	ctx          context.Context
	credential   *models.UserCredential
	speaker      string
	synthesizer  synthesizer.SynthesisService
	errorHandler *errhandler.Handler
	logger       *zap.Logger
	mu           sync.RWMutex
	closed       bool

	// 文本分割配置
	enableTextSplit    bool // 是否启用文本分割
	firstSegmentMinLen int  // 第一段最小长度
	firstSegmentMaxLen int  // 第一段最大长度
	minSplitLength     int  // 最小分割长度

	// TTS队列管理（确保顺序播放）
	ttsQueue *TTSQueue
}

// TTSQueue TTS队列管理器（确保顺序播放）
type TTSQueue struct {
	segments  map[int]*TTSSegment // 按segmentIndex存储
	nextIndex int                 // 下一个应该播放的索引
	callback  StreamingTTSCallback
	mu        sync.Mutex
	logger    *zap.Logger
}

// TTSSegment TTS片段
type TTSSegment struct {
	Index     int
	AudioData []byte
	IsFirst   bool
	IsLast    bool
	Ready     bool
}

// NewTTSQueue 创建TTS队列
func NewTTSQueue(callback StreamingTTSCallback, logger *zap.Logger) *TTSQueue {
	return &TTSQueue{
		segments:  make(map[int]*TTSSegment),
		nextIndex: 0,
		callback:  callback,
		logger:    logger,
	}
}

// AddSegment 添加TTS片段（可能乱序到达）
func (q *TTSQueue) AddSegment(index int, audioData []byte, isFirst, isLast bool) {
	q.mu.Lock()
	defer q.mu.Unlock()

	// 检查是否已有占位符
	if existingSegment, exists := q.segments[index]; exists && !existingSegment.Ready {
		// 更新占位符片段
		existingSegment.AudioData = audioData
		existingSegment.IsFirst = isFirst
		existingSegment.Ready = true
		// 保持IsLast标记（可能已经被MarkLastSegment设置为true）
		if !existingSegment.IsLast {
			existingSegment.IsLast = isLast
		}

		q.logger.Debug("TTS片段已更新（从占位符）",
			zap.Int("index", index),
			zap.Int("audioSize", len(audioData)),
			zap.Bool("isFirst", isFirst),
			zap.Bool("isLast", existingSegment.IsLast),
		)
	} else {
		// 创建新片段
		q.segments[index] = &TTSSegment{
			Index:     index,
			AudioData: audioData,
			IsFirst:   isFirst,
			IsLast:    isLast,
			Ready:     true,
		}

		q.logger.Debug("TTS片段已添加到队列",
			zap.Int("index", index),
			zap.Int("audioSize", len(audioData)),
			zap.Bool("isFirst", isFirst),
			zap.Bool("isLast", isLast),
		)
	}

	// 尝试播放连续的片段
	q.tryPlayNext()
}

// tryPlayNext 尝试播放下一个连续的片段
func (q *TTSQueue) tryPlayNext() {
	for {
		segment, exists := q.segments[q.nextIndex]
		if !exists || !segment.Ready {
			break // 下一个片段还没准备好
		}

		// 播放片段
		if len(segment.AudioData) > 0 {
			err := q.callback(segment.AudioData, segment.IsFirst, segment.IsLast, segment.Index)
			if err != nil {
				q.logger.Error("TTS片段播放失败", zap.Error(err), zap.Int("index", segment.Index))
			} else {
				q.logger.Debug("TTS片段播放成功", zap.Int("index", segment.Index))
			}
		}

		// 移除已播放的片段
		delete(q.segments, q.nextIndex)
		q.nextIndex++

		if segment.IsLast {
			q.logger.Info("TTS队列播放完成")
			break
		}
	}
}

// MarkLastSegment 标记指定片段为最后一个片段
func (q *TTSQueue) MarkLastSegment(index int) {
	q.mu.Lock()
	defer q.mu.Unlock()

	if segment, exists := q.segments[index]; exists {
		// 片段已存在，直接标记
		segment.IsLast = true
		q.logger.Info("标记片段为最后片段", zap.Int("index", index))

		// 如果这个片段已经播放过了，需要重新触发结束回调
		if index < q.nextIndex {
			q.logger.Info("最后片段已播放，触发结束回调")
			// 发送一个空的结束信号
			if err := q.callback([]byte{}, false, true, index); err != nil {
				q.logger.Error("发送TTS结束信号失败", zap.Error(err))
			}
		}
	} else {
		// 片段还不存在，创建一个占位符
		q.segments[index] = &TTSSegment{
			Index:     index,
			AudioData: nil,
			IsFirst:   false,
			IsLast:    true,
			Ready:     false, // 标记为未准备好
		}
		q.logger.Info("预标记片段为最后片段（占位符）", zap.Int("index", index))
	}
}

// StreamingTTSCallback 流式TTS回调函数
type StreamingTTSCallback func(audioData []byte, isFirst bool, isLast bool, segmentIndex int) error

// TextSplitConfig 文本分割配置
type TextSplitConfig struct {
	Enable             bool `json:"enable"`                // 是否启用文本分割
	FirstSegmentMinLen int  `json:"first_segment_min_len"` // 第一段最小长度，默认3个字符
	FirstSegmentMaxLen int  `json:"first_segment_max_len"` // 第一段最大长度，默认8个字符（约5个中文字）
	MinSplitLength     int  `json:"min_split_length"`      // 总体最小分割长度，默认8个字符
}

// TextSegment 文本片段
type TextSegment struct {
	Text     string `json:"text"`     // 文本内容
	Index    int    `json:"index"`    // 片段索引（0表示第一部分，1表示第二部分）
	IsLast   bool   `json:"is_last"`  // 是否是最后一个片段
	Priority int    `json:"priority"` // 优先级（数字越小优先级越高）
}

// NewService 创建TTS服务
func NewService(
	ctx context.Context,
	credential *models.UserCredential,
	speaker string,
	synthesizer synthesizer.SynthesisService,
	errorHandler *errhandler.Handler,
	logger *zap.Logger,
) *Service {
	service := &Service{
		ctx:                ctx,
		credential:         credential,
		speaker:            speaker,
		synthesizer:        synthesizer,
		errorHandler:       errorHandler,
		logger:             logger,
		enableTextSplit:    true, // 默认启用文本分割
		firstSegmentMinLen: 3,    // 第一段最小3个字符
		firstSegmentMaxLen: 5,    // 第一段最大5个字符（真正的5字策略）
		minSplitLength:     6,    // 总体最小6个字符才分割（降低门槛）
	}
	return service
}

// SetTextSplitConfig 设置文本分割配置
func (s *Service) SetTextSplitConfig(config TextSplitConfig) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.enableTextSplit = config.Enable
	if config.FirstSegmentMinLen > 0 {
		s.firstSegmentMinLen = config.FirstSegmentMinLen
	}
	if config.FirstSegmentMaxLen > 0 {
		s.firstSegmentMaxLen = config.FirstSegmentMaxLen
	}
	if config.MinSplitLength > 0 {
		s.minSplitLength = config.MinSplitLength
	}

	s.logger.Info("TTS文本分割配置已更新",
		zap.Bool("enable", s.enableTextSplit),
		zap.Int("firstSegmentMinLen", s.firstSegmentMinLen),
		zap.Int("firstSegmentMaxLen", s.firstSegmentMaxLen),
		zap.Int("minSplitLength", s.minSplitLength),
	)
}

// SynthesizeStream 流式合成语音（接收LLM流式输出）
func (s *Service) SynthesizeStream(ctx context.Context, textChan <-chan string, callback StreamingTTSCallback, waitGroup *sync.WaitGroup) error {
	s.mu.RLock()
	closed := s.closed
	synthesizer := s.synthesizer
	enableTextSplit := s.enableTextSplit
	s.mu.RUnlock()

	if closed || synthesizer == nil {
		s.logger.Error("TTS服务不可用")
		return errhandler.NewRecoverableError("TTS", "服务已关闭", nil)
	}

	s.logger.Info("开始流式TTS合成")

	// 创建TTS队列管理器
	ttsQueue := NewTTSQueue(callback, s.logger)

	var textBuffer strings.Builder
	var segmentIndex int
	var firstSegmentSent bool

	for {
		select {
		case <-ctx.Done():
			s.logger.Info("流式TTS合成被取消")
			return ctx.Err()

		case text, ok := <-textChan:
			if !ok {
				// 通道关闭，处理剩余文本
				remaining := textBuffer.String()
				s.logger.Info("LLM流式输出完成，处理剩余文本",
					zap.String("remaining", remaining),
					zap.Int("remainingLen", len([]rune(remaining))),
					zap.Int("segmentIndex", segmentIndex),
					zap.Bool("firstSegmentSent", firstSegmentSent),
				)

				if remaining != "" {
					// 尝试分割剩余文本
					if firstSegmentSent {
						// 已经发送过第一段，尝试提取完整句子
						if segment := s.tryExtractCompleteSentence(remaining); segment != "" {
							s.logger.Info("从剩余文本提取句子", zap.String("segment", segment))
							go s.synthesizeTextSegmentAsync(ctx, segment, segmentIndex, false, false, ttsQueue, waitGroup)
							segmentIndex++

							// 更新剩余文本
							remaining = strings.TrimSpace(remaining[len(segment):])
						}
					}

					// 处理最后的剩余文本
					if remaining != "" {
						// 检查剩余文本是否有意义（不只是标点符号）
						remainingRunes := []rune(strings.TrimSpace(remaining))
						if len(remainingRunes) >= 2 { // 至少2个字符才值得合成
							s.logger.Info("处理最后剩余文本", zap.String("text", remaining))
							go s.synthesizeTextSegmentAsync(ctx, remaining, segmentIndex, true, !firstSegmentSent, ttsQueue, waitGroup)
						} else {
							// 剩余文本太短（如单个标点），直接标记最后片段结束
							s.logger.Info("剩余文本太短，忽略并标记最后片段为结束",
								zap.String("remaining", remaining),
								zap.Int("lastSegmentIndex", segmentIndex-1))
							if segmentIndex > 0 {
								ttsQueue.MarkLastSegment(segmentIndex - 1)
							}
						}
					} else if segmentIndex > 0 {
						// 剩余文本处理完了，标记最后一个片段为结束
						s.logger.Info("剩余文本处理完毕，标记最后片段为结束", zap.Int("lastSegmentIndex", segmentIndex-1))
						ttsQueue.MarkLastSegment(segmentIndex - 1)
					}
				} else if segmentIndex > 0 {
					// 没有剩余文本，但需要标记最后一个片段为结束
					s.logger.Info("没有剩余文本，标记最后片段为结束", zap.Int("lastSegmentIndex", segmentIndex-1))
					// 通过队列标记最后一个片段
					ttsQueue.MarkLastSegment(segmentIndex - 1)
				}
				s.logger.Info("流式TTS合成完成")
				return nil
			}

			if text == "" {
				continue
			}

			// 将新文本添加到缓冲区
			textBuffer.WriteString(text)
			currentText := textBuffer.String()

			s.logger.Debug("收到流式文本",
				zap.String("newText", text),
				zap.String("currentBuffer", currentText),
				zap.Int("bufferLen", len([]rune(currentText))),
			)

			// 立即检查是否可以提取第一段进行合成（更激进的策略）
			if !firstSegmentSent && enableTextSplit {
				if segment := s.tryExtractFirstSegmentAggressive(currentText); segment != "" {
					s.logger.Info("立即提取第一段进行合成",
						zap.String("segment", segment),
						zap.Int("segmentLen", len([]rune(segment))),
					)

					// 立即合成第一段（异步）
					go s.synthesizeTextSegmentAsync(ctx, segment, segmentIndex, false, true, ttsQueue, waitGroup)

					// 从缓冲区移除已处理的文本
					remaining := strings.TrimSpace(currentText[len(segment):])
					textBuffer.Reset()
					textBuffer.WriteString(remaining)

					segmentIndex++
					firstSegmentSent = true
				}
			}

			// 检查是否有完整的句子可以合成（第一段之后）
			if firstSegmentSent {
				currentBuffer := textBuffer.String()
				s.logger.Debug("检查第二段分割",
					zap.String("currentBuffer", currentBuffer),
					zap.Int("bufferLen", len([]rune(currentBuffer))),
				)

				if segment := s.tryExtractCompleteSentence(currentBuffer); segment != "" {
					s.logger.Info("提取完整句子进行合成",
						zap.String("segment", segment),
						zap.Int("segmentLen", len([]rune(segment))),
					)

					// 合成句子（异步）
					go s.synthesizeTextSegmentAsync(ctx, segment, segmentIndex, false, false, ttsQueue, waitGroup)

					// 从缓冲区移除已处理的文本
					remaining := strings.TrimSpace(currentBuffer[len(segment):])
					textBuffer.Reset()
					textBuffer.WriteString(remaining)

					segmentIndex++
				} else {
					s.logger.Debug("未找到可分割的第二段",
						zap.String("buffer", currentBuffer),
						zap.Int("bufferLen", len([]rune(currentBuffer))),
					)
				}
			}
		}
	}
}

// tryExtractFirstSegmentAggressive 更激进的第一段提取策略（立即响应）
func (s *Service) tryExtractFirstSegmentAggressive(text string) string {
	s.mu.RLock()
	firstSegmentMinLen := s.firstSegmentMinLen
	firstSegmentMaxLen := s.firstSegmentMaxLen
	s.mu.RUnlock()

	textRunes := []rune(strings.TrimSpace(text))
	textLength := len(textRunes)

	// 超激进：只要达到最小长度就开始寻找分割点
	if textLength < firstSegmentMinLen {
		return "" // 文本太短，等待更多内容
	}

	// 第一段分割符（优先使用弱分割符，更容易触发）
	weakSeparators := []rune{'～', '~', '，', ',', '、', '；', ';', '：', ':'}
	strongSeparators := []rune{'。', '！', '？', '.', '!', '?', '\n'}

	// 超激进策略1：在最小长度处立即寻找弱分割符
	for i := firstSegmentMinLen; i <= min(textLength, firstSegmentMaxLen); i++ {
		if i >= textLength {
			break
		}

		char := textRunes[i-1] // 检查当前位置的字符

		// 优先检查弱分割符
		for _, sep := range weakSeparators {
			if char == sep {
				segment := strings.TrimSpace(string(textRunes[:i]))
				if len([]rune(segment)) >= firstSegmentMinLen {
					return segment
				}
			}
		}
	}

	// 超激进策略2：检查强分割符
	for i := firstSegmentMinLen; i <= min(textLength, firstSegmentMaxLen); i++ {
		if i >= textLength {
			break
		}

		char := textRunes[i-1]
		for _, sep := range strongSeparators {
			if char == sep {
				segment := strings.TrimSpace(string(textRunes[:i]))
				if len([]rune(segment)) >= firstSegmentMinLen {
					return segment
				}
			}
		}
	}

	// 超激进策略3：词汇边界立即分割（最关键的优化）
	if textLength >= firstSegmentMinLen {
		// 寻找词汇边界（中文常见的词汇分割点）
		wordBoundaries := []string{"哦", "啊", "呢", "吧", "的", "了", "在", "是", "有", "我", "你", "他", "她", "它"}

		for i := firstSegmentMinLen; i <= min(textLength, firstSegmentMinLen+2); i++ {
			for _, boundary := range wordBoundaries {
				if i >= len(boundary) && strings.HasSuffix(string(textRunes[:i]), boundary) {
					segment := strings.TrimSpace(string(textRunes[:i]))
					if len([]rune(segment)) >= firstSegmentMinLen {
						s.logger.Debug("通过词汇边界提取第一段",
							zap.String("boundary", boundary),
							zap.String("segment", segment),
						)
						return segment
					}
				}
			}
		}
	}

	// 超激进策略4：如果文本已经比较长，在空格处分割
	if textLength >= firstSegmentMaxLen {
		for i := firstSegmentMaxLen; i >= firstSegmentMinLen; i-- {
			if i < textLength && unicode.IsSpace(textRunes[i]) {
				return strings.TrimSpace(string(textRunes[:i]))
			}
		}
		// 最激进：强制在最大长度处分割
		return strings.TrimSpace(string(textRunes[:firstSegmentMaxLen]))
	}

	// 超激进策略5：如果文本长度达到5个字符，立即分割（最激进的策略）
	if textLength >= 5 {
		segment := strings.TrimSpace(string(textRunes[:5]))
		s.logger.Debug("超激进5字符分割",
			zap.String("segment", segment),
			zap.Int("textLength", textLength),
		)
		return segment
	}

	return "" // 等待更多内容
}

// min 辅助函数
func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// tryExtractFirstSegment 尝试提取第一段（最小化策略）
func (s *Service) tryExtractFirstSegment(text string) string {
	s.mu.RLock()
	firstSegmentMinLen := s.firstSegmentMinLen
	firstSegmentMaxLen := s.firstSegmentMaxLen
	s.mu.RUnlock()

	textRunes := []rune(strings.TrimSpace(text))
	textLength := len(textRunes)

	if textLength < firstSegmentMinLen {
		return "" // 文本太短，等待更多内容
	}

	// 在最小长度到最大长度范围内寻找分割点
	maxSearchLen := firstSegmentMaxLen
	if maxSearchLen > textLength {
		maxSearchLen = textLength
	}

	// 第一段分割符（优先使用弱分割符）
	separators := []rune{'，', ',', '、', '；', ';', '：', ':', '。', '！', '？', '.', '!', '?', '\n'}

	// 从最小长度开始寻找分割符
	for i := firstSegmentMinLen; i <= maxSearchLen; i++ {
		if i >= textLength {
			break
		}

		char := textRunes[i]
		for _, sep := range separators {
			if char == sep {
				segment := strings.TrimSpace(string(textRunes[:i+1]))
				if len([]rune(segment)) >= firstSegmentMinLen {
					return segment
				}
			}
		}
	}

	// 如果达到最大长度还没找到分割符，且文本足够长，强制分割
	if textLength > firstSegmentMaxLen+5 { // 给一些缓冲
		// 尝试在空格处分割
		for i := firstSegmentMaxLen; i >= firstSegmentMinLen; i-- {
			if i < textLength && unicode.IsSpace(textRunes[i]) {
				return strings.TrimSpace(string(textRunes[:i]))
			}
		}
		// 强制在最大长度处分割
		return strings.TrimSpace(string(textRunes[:firstSegmentMaxLen]))
	}

	return "" // 等待更多内容
}

// tryExtractCompleteSentence 尝试提取完整句子
func (s *Service) tryExtractCompleteSentence(text string) string {
	textRunes := []rune(strings.TrimSpace(text))
	textLength := len(textRunes)

	if textLength < 3 { // 最小长度要求
		return "" // 文本太短
	}

	// 句子结束符（扩展列表，包含中文常用符号）
	sentenceEnders := []rune{'。', '！', '？', '.', '!', '?', '～', '~', '，', ',', '；', ';', '：', ':'}

	// 寻找句子结束符（从第3个字符开始）
	for i := 3; i < textLength; i++ {
		char := textRunes[i]
		for _, ender := range sentenceEnders {
			if char == ender {
				sentence := strings.TrimSpace(string(textRunes[:i+1]))
				if len([]rune(sentence)) >= 3 {
					return sentence
				}
			}
		}
	}

	// 如果文本较长但没有结束符，按长度分割
	if textLength > 15 {
		// 寻找逗号或分号进行分割
		for i := 8; i < textLength && i < 15; i++ {
			char := textRunes[i]
			if char == '，' || char == ',' || char == '；' || char == ';' || char == '：' || char == ':' {
				return strings.TrimSpace(string(textRunes[:i+1]))
			}
		}
		// 强制分割
		return strings.TrimSpace(string(textRunes[:15]))
	}

	// 关键改进：如果没有找到分割点，但文本不为空且长度合理，直接返回整个文本
	if textLength >= 3 {
		s.logger.Debug("没有找到分割点，直接合成整个文本",
			zap.String("text", text),
			zap.Int("textLen", textLength),
		)
		return strings.TrimSpace(text)
	}

	return "" // 文本太短，等待更多内容
}

// synthesizeTextSegmentAsync 异步合成文本片段
func (s *Service) synthesizeTextSegmentAsync(ctx context.Context, text string, segmentIndex int, isLast bool, isFirst bool, ttsQueue *TTSQueue, waitGroup *sync.WaitGroup) {
	if text == "" {
		return
	}

	// 增加等待组计数
	waitGroup.Add(1)
	defer waitGroup.Done()

	s.logger.Info("开始异步合成文本片段",
		zap.String("text", text),
		zap.Int("segmentIndex", segmentIndex),
		zap.Bool("isFirst", isFirst),
		zap.Bool("isLast", isLast),
	)

	// 创建片段处理器
	handler := &asyncSegmentHandler{
		ttsQueue:     ttsQueue,
		ctx:          ctx,
		logger:       s.logger,
		text:         text,
		segmentIndex: segmentIndex,
		isFirst:      isFirst,
		isLast:       isLast,
	}

	// 合成当前片段
	err := s.synthesizer.Synthesize(ctx, handler, text)
	if err != nil {
		classified := s.errorHandler.Classify(err, "TTS")
		s.logger.Error("异步TTS片段合成失败",
			zap.Error(classified),
			zap.Int("segmentIndex", segmentIndex),
			zap.String("text", text),
		)
		return
	}

	// 合成完成，将音频数据添加到队列
	if len(handler.audioBuffer) > 0 {
		handler.ttsQueue.AddSegment(handler.segmentIndex, handler.audioBuffer, handler.isFirst, handler.isLast)
	}

	s.logger.Info("异步文本片段合成完成",
		zap.Int("segmentIndex", segmentIndex),
		zap.String("text", text),
	)
}

// asyncSegmentHandler 异步片段处理器
type asyncSegmentHandler struct {
	ttsQueue     *TTSQueue
	ctx          context.Context
	logger       *zap.Logger
	text         string
	segmentIndex int
	isFirst      bool
	isLast       bool
	audioBuffer  []byte
}

func (h *asyncSegmentHandler) OnMessage(data []byte) {
	if len(data) > 0 {
		h.audioBuffer = append(h.audioBuffer, data...)

		h.logger.Debug("异步TTS音频数据接收中",
			zap.Int("segmentIndex", h.segmentIndex),
			zap.Int("chunkSize", len(data)),
			zap.Int("totalBytes", len(h.audioBuffer)),
			zap.Bool("isFirst", h.isFirst),
		)
	}
}

func (h *asyncSegmentHandler) OnTimestamp(timestamp synthesizer.SentenceTimestamp) {
	// 处理时间戳信息（如果需要）
}

// synthesizeTextSegment 合成文本片段
func (s *Service) synthesizeTextSegment(ctx context.Context, text string, segmentIndex int, isLast bool, isFirst bool, callback StreamingTTSCallback) error {
	if text == "" {
		return nil
	}

	s.logger.Info("开始合成文本片段",
		zap.String("text", text),
		zap.Int("segmentIndex", segmentIndex),
		zap.Bool("isFirst", isFirst),
		zap.Bool("isLast", isLast),
	)

	// 创建片段处理器
	handler := &streamingSegmentHandler{
		callback:     callback,
		ctx:          ctx,
		logger:       s.logger,
		text:         text,
		segmentIndex: segmentIndex,
		isFirst:      isFirst,
		isLast:       isLast,
	}

	// 合成当前片段
	err := s.synthesizer.Synthesize(ctx, handler, text)
	if err != nil {
		classified := s.errorHandler.Classify(err, "TTS")
		s.logger.Error("TTS片段合成失败",
			zap.Error(classified),
			zap.Int("segmentIndex", segmentIndex),
			zap.String("text", text),
		)
		return classified
	}

	s.logger.Info("文本片段合成完成",
		zap.Int("segmentIndex", segmentIndex),
		zap.String("text", text),
	)

	return nil
}

// streamingSegmentHandler 流式片段处理器
type streamingSegmentHandler struct {
	callback     StreamingTTSCallback
	ctx          context.Context
	logger       *zap.Logger
	text         string
	segmentIndex int
	isFirst      bool
	isLast       bool
	chunkCount   int
	totalBytes   int
}

func (h *streamingSegmentHandler) OnMessage(data []byte) {
	if len(data) > 0 {
		h.chunkCount++
		h.totalBytes += len(data)

		// 每10个chunk记录一次进度
		if h.chunkCount%10 == 1 {
			h.logger.Debug("流式TTS音频数据接收中",
				zap.Int("segmentIndex", h.segmentIndex),
				zap.Int("chunkCount", h.chunkCount),
				zap.Int("chunkSize", len(data)),
				zap.Int("totalBytes", h.totalBytes),
				zap.Bool("isFirst", h.isFirst),
			)
		}
	}

	select {
	case <-h.ctx.Done():
		// Context已取消，不再发送数据
		return
	default:
		// 调用回调函数发送音频数据
		if err := h.callback(data, h.isFirst && h.chunkCount == 1, h.isLast && len(data) == 0, h.segmentIndex); err != nil {
			h.logger.Warn("流式TTS回调失败",
				zap.Error(err),
				zap.Int("segmentIndex", h.segmentIndex),
				zap.Int("chunkSize", len(data)),
			)
		}
	}
}

func (h *streamingSegmentHandler) OnTimestamp(timestamp synthesizer.SentenceTimestamp) {
	// 暂时不处理时间戳
}
func (s *Service) Synthesize(ctx context.Context, text string) (<-chan []byte, error) {
	s.mu.RLock()
	closed := s.closed
	synthesizer := s.synthesizer
	enableTextSplit := s.enableTextSplit
	s.mu.RUnlock()

	if closed || synthesizer == nil {
		s.logger.Error("TTS服务不可用",
			zap.Bool("closed", closed),
			zap.Bool("synthesizerNil", synthesizer == nil),
		)
		return nil, errhandler.NewRecoverableError("TTS", "服务已关闭", nil)
	}

	if text == "" {
		s.logger.Warn("TTS文本为空")
		return nil, errhandler.NewRecoverableError("TTS", "文本为空", nil)
	}

	s.logger.Info("准备TTS合成",
		zap.String("text", text),
		zap.String("speaker", s.speaker),
		zap.Bool("enableTextSplit", enableTextSplit),
	)

	// 检查是否需要分割文本
	if enableTextSplit {
		return s.synthesizeWithSplit(ctx, text)
	} else {
		return s.synthesizeSingle(ctx, text)
	}
}

// synthesizeWithSplit 分割文本进行合成
func (s *Service) synthesizeWithSplit(ctx context.Context, text string) (<-chan []byte, error) {
	// 分割文本
	segments := s.splitText(text)

	if len(segments) <= 1 {
		// 文本太短，不需要分割，使用单一合成
		s.logger.Info("文本长度不足，使用单一合成", zap.String("text", text))
		return s.synthesizeSingle(ctx, text)
	}

	s.logger.Info("文本已分割",
		zap.Int("segmentCount", len(segments)),
		zap.String("firstSegment", segments[0].Text),
		zap.String("secondSegment", segments[1].Text),
	)

	// 创建合并的音频通道
	audioChan := make(chan []byte, 400) // 增大缓冲区以容纳多个片段

	// 在goroutine中处理分割合成
	go func() {
		defer func() {
			if r := recover(); r != nil {
				s.logger.Error("TTS分割合成goroutine发生panic", zap.Any("panic", r))
			}
			close(audioChan)
		}()

		s.synthesizeSegments(ctx, segments, audioChan)
	}()

	return audioChan, nil
}

// synthesizeSegments 合成多个文本片段
func (s *Service) synthesizeSegments(ctx context.Context, segments []TextSegment, audioChan chan<- []byte) {
	s.mu.RLock()
	synthesizer := s.synthesizer
	s.mu.RUnlock()

	if synthesizer == nil {
		s.logger.Error("合成器不可用")
		return
	}

	// 按优先级顺序合成片段
	for _, segment := range segments {
		select {
		case <-ctx.Done():
			s.logger.Info("TTS分割合成被取消")
			return
		default:
		}

		s.logger.Info("开始合成片段",
			zap.Int("index", segment.Index),
			zap.String("text", segment.Text),
			zap.Bool("isLast", segment.IsLast),
		)

		// 创建片段处理器
		handler := &segmentHandler{
			audioChan:    audioChan,
			ctx:          ctx,
			logger:       s.logger,
			text:         segment.Text,
			segmentIndex: segment.Index,
			isLast:       segment.IsLast,
		}

		// 合成当前片段
		err := synthesizer.Synthesize(ctx, handler, segment.Text)
		if err != nil {
			select {
			case <-ctx.Done():
				s.logger.Info("TTS片段合成被取消", zap.Int("segmentIndex", segment.Index))
				return
			default:
				classified := s.errorHandler.Classify(err, "TTS")
				s.logger.Error("TTS片段合成失败",
					zap.Error(classified),
					zap.Int("segmentIndex", segment.Index),
					zap.String("text", segment.Text),
				)
				// 发送错误信号
				select {
				case <-ctx.Done():
				case audioChan <- nil:
				default:
				}
				return
			}
		}

		s.logger.Info("片段合成完成",
			zap.Int("segmentIndex", segment.Index),
			zap.String("text", segment.Text),
		)
	}

	s.logger.Info("所有片段合成完成", zap.Int("totalSegments", len(segments)))
}

// synthesizeSingle 单一文本合成（原有逻辑）
func (s *Service) synthesizeSingle(ctx context.Context, text string) (<-chan []byte, error) {
	s.mu.RLock()
	synthesizer := s.synthesizer
	s.mu.RUnlock()

	// 创建音频通道（大幅增大缓冲区，适应快速TTS合成）
	audioChan := make(chan []byte, 200)

	// 创建SynthesisHandler
	handler := &synthesisHandler{
		audioChan: audioChan,
		ctx:       ctx,
		logger:    s.logger,
		text:      text,
	}

	// 在goroutine中合成
	go func() {
		defer func() {
			// 安全关闭channel，避免panic
			if r := recover(); r != nil {
				s.logger.Error("TTS合成goroutine发生panic", zap.Any("panic", r))
			}
			// 使用select确保安全关闭channel
			select {
			case <-ctx.Done():
				// Context已取消，可能channel已被关闭，不再关闭
				s.logger.Debug("TTS合成context已取消，跳过channel关闭")
			default:
				// 正常情况下关闭channel
				close(audioChan)
			}
		}()

		s.logger.Info("开始TTS合成", zap.String("text", text))
		err := synthesizer.Synthesize(ctx, handler, text)
		if err != nil {
			// 检查是否是因为context取消导致的错误
			select {
			case <-ctx.Done():
				s.logger.Info("TTS合成被取消", zap.String("text", text))
				return
			default:
				classified := s.errorHandler.Classify(err, "TTS")
				s.logger.Error("TTS合成失败", zap.Error(classified), zap.String("text", text))
				// 发送错误信号
				select {
				case <-ctx.Done():
				case audioChan <- nil: // nil表示错误
				default:
					// channel可能已满或关闭，不阻塞
				}
			}
		} else {
			s.logger.Info("TTS合成成功完成",
				zap.String("text", text),
				zap.Int("totalChunks", handler.chunkCount),
				zap.Int("totalBytes", handler.totalBytes),
			)
		}
	}()

	return audioChan, nil
}

// synthesisHandler 实现 SynthesisHandler 接口
type synthesisHandler struct {
	audioChan  chan []byte
	ctx        context.Context
	logger     *zap.Logger
	text       string
	chunkCount int
	totalBytes int
}

func (h *synthesisHandler) OnMessage(data []byte) {
	if len(data) > 0 {
		h.chunkCount++
		h.totalBytes += len(data)

		// 每10个chunk记录一次进度
		if h.chunkCount%10 == 1 {
			h.logger.Debug("TTS音频数据接收中",
				zap.Int("chunkCount", h.chunkCount),
				zap.Int("chunkSize", len(data)),
				zap.Int("totalBytes", h.totalBytes),
			)
		}
	}

	select {
	case <-h.ctx.Done():
		// Context已取消，不再发送数据
		return
	case h.audioChan <- data:
		// 成功发送音频数据
	default:
		// 通道满了或已关闭，记录警告但不阻塞（避免TTS合成被阻塞）
		h.logger.Warn("TTS音频通道满或已关闭，丢弃数据",
			zap.Int("chunkSize", len(data)),
			zap.Int("chunkCount", h.chunkCount),
		)
	}
}

func (h *synthesisHandler) OnTimestamp(timestamp synthesizer.SentenceTimestamp) {
	// 暂时不处理时间戳
}

// segmentHandler 片段处理器
type segmentHandler struct {
	audioChan    chan<- []byte
	ctx          context.Context
	logger       *zap.Logger
	text         string
	segmentIndex int
	isLast       bool
	chunkCount   int
	totalBytes   int
}

func (h *segmentHandler) OnMessage(data []byte) {
	if len(data) > 0 {
		h.chunkCount++
		h.totalBytes += len(data)

		// 每10个chunk记录一次进度
		if h.chunkCount%10 == 1 {
			h.logger.Debug("TTS片段音频数据接收中",
				zap.Int("segmentIndex", h.segmentIndex),
				zap.Int("chunkCount", h.chunkCount),
				zap.Int("chunkSize", len(data)),
				zap.Int("totalBytes", h.totalBytes),
			)
		}
	}

	select {
	case <-h.ctx.Done():
		// Context已取消，不再发送数据
		return
	case h.audioChan <- data:
		// 成功发送音频数据
	default:
		// 通道满了或已关闭，记录警告但不阻塞
		h.logger.Warn("TTS片段音频通道满或已关闭，丢弃数据",
			zap.Int("segmentIndex", h.segmentIndex),
			zap.Int("chunkSize", len(data)),
			zap.Int("chunkCount", h.chunkCount),
		)
	}
}

func (h *segmentHandler) OnTimestamp(timestamp synthesizer.SentenceTimestamp) {
	// 暂时不处理时间戳
}

// splitText 智能分割文本（第一段最小化策略）
func (s *Service) splitText(text string) []TextSegment {
	s.mu.RLock()
	firstSegmentMinLen := s.firstSegmentMinLen
	firstSegmentMaxLen := s.firstSegmentMaxLen
	minSplitLength := s.minSplitLength
	s.mu.RUnlock()

	// 清理文本
	text = strings.TrimSpace(text)
	if len(text) < minSplitLength {
		// 文本太短，不分割
		return []TextSegment{
			{
				Text:     text,
				Index:    0,
				IsLast:   true,
				Priority: 0,
			},
		}
	}

	textRunes := []rune(text)
	textLength := len(textRunes)

	// 第一段最小化分割策略
	firstSegmentEnd := s.findFirstSegmentEnd(textRunes, firstSegmentMinLen, firstSegmentMaxLen)

	if firstSegmentEnd <= 0 || firstSegmentEnd >= textLength {
		// 找不到合适的分割点，不分割
		return []TextSegment{
			{
				Text:     text,
				Index:    0,
				IsLast:   true,
				Priority: 0,
			},
		}
	}

	// 分割文本
	firstPart := strings.TrimSpace(string(textRunes[:firstSegmentEnd]))
	remainingPart := strings.TrimSpace(string(textRunes[firstSegmentEnd:]))

	// 检查分割后的部分是否有效
	if len(firstPart) < 2 || len(remainingPart) < 2 {
		// 分割后的部分太短，不分割
		return []TextSegment{
			{
				Text:     text,
				Index:    0,
				IsLast:   true,
				Priority: 0,
			},
		}
	}

	s.logger.Info("TTS文本分割完成（第一段最小化）",
		zap.String("originalText", text),
		zap.String("firstPart", firstPart),
		zap.String("remainingPart", remainingPart),
		zap.Int("firstPartLen", len([]rune(firstPart))),
		zap.Int("remainingPartLen", len([]rune(remainingPart))),
	)

	// 检查剩余部分是否需要进一步分割
	segments := []TextSegment{
		{
			Text:     firstPart,
			Index:    0,
			IsLast:   false,
			Priority: 0, // 第一部分优先级最高
		},
	}

	// 对剩余部分进行进一步分割（如果需要）
	remainingSegments := s.splitRemainingText(remainingPart, 1)
	segments = append(segments, remainingSegments...)

	return segments
}

// findFirstSegmentEnd 寻找第一段的结束位置（最小化策略）
func (s *Service) findFirstSegmentEnd(textRunes []rune, minLen, maxLen int) int {
	textLength := len(textRunes)

	// 确保不超过文本长度
	if maxLen > textLength {
		maxLen = textLength
	}
	if minLen > textLength {
		minLen = textLength
	}

	// 第一段分割符优先级（优先使用弱分割符，实现最小化）
	firstSegmentSeparators := []struct {
		chars    []rune
		priority int
	}{
		// 最高优先级：逗号、顿号（实现最小化分割）
		{[]rune{'，', ',', '、'}, 1},
		// 中等优先级：分号、冒号
		{[]rune{'；', ';', '：', ':'}, 2},
		// 较低优先级：句号、感叹号、问号（避免过早结束）
		{[]rune{'。', '！', '？', '.', '!', '?'}, 3},
		// 最低优先级：换行符
		{[]rune{'\n'}, 4},
	}

	bestEnd := -1
	bestPriority := 999

	// 在最小长度到最大长度范围内寻找分割点
	for i := minLen; i <= maxLen && i < textLength; i++ {
		char := textRunes[i]

		for _, sep := range firstSegmentSeparators {
			for _, sepChar := range sep.chars {
				if char == sepChar {
					// 计算距离权重（越靠近最小长度越好）
					distanceFromMin := i - minLen
					adjustedPriority := sep.priority + distanceFromMin/5 // 距离权重较小

					if adjustedPriority < bestPriority {
						bestPriority = adjustedPriority
						bestEnd = i + 1 // 在分割符后分割
					}
				}
			}
		}
	}

	// 如果找到了分割符，使用它
	if bestEnd > 0 {
		return bestEnd
	}

	// 没找到分割符，寻找空格（在最小长度附近）
	for i := minLen; i <= maxLen && i < textLength; i++ {
		if unicode.IsSpace(textRunes[i]) {
			return i + 1 // 在空格后分割
		}
	}

	// 都没找到，使用最大长度作为分割点
	if maxLen < textLength {
		return maxLen
	}

	return -1 // 无法分割
}

// splitRemainingText 分割剩余文本（使用传统策略）
func (s *Service) splitRemainingText(text string, startIndex int) []TextSegment {
	// 对于剩余部分，使用传统的完整句子分割策略
	textRunes := []rune(text)
	textLength := len(textRunes)

	// 如果剩余文本较短，直接返回
	if textLength < 30 { // 剩余部分小于30个字符，不再分割
		return []TextSegment{
			{
				Text:     text,
				Index:    startIndex,
				IsLast:   true,
				Priority: startIndex,
			},
		}
	}

	// 寻找完整句子的分割点
	sentenceEnd := s.findSentenceEnd(textRunes, textLength/2) // 在中间位置寻找句子结束

	if sentenceEnd > 0 && sentenceEnd < textLength {
		firstPart := strings.TrimSpace(string(textRunes[:sentenceEnd]))
		secondPart := strings.TrimSpace(string(textRunes[sentenceEnd:]))

		if len(firstPart) >= 5 && len(secondPart) >= 5 {
			return []TextSegment{
				{
					Text:     firstPart,
					Index:    startIndex,
					IsLast:   false,
					Priority: startIndex,
				},
				{
					Text:     secondPart,
					Index:    startIndex + 1,
					IsLast:   true,
					Priority: startIndex + 1,
				},
			}
		}
	}

	// 无法进一步分割，返回整个剩余部分
	return []TextSegment{
		{
			Text:     text,
			Index:    startIndex,
			IsLast:   true,
			Priority: startIndex,
		},
	}
}

// findSentenceEnd 寻找句子结束位置（用于剩余文本分割）
func (s *Service) findSentenceEnd(textRunes []rune, preferredPos int) int {
	textLength := len(textRunes)
	searchRange := textLength / 4 // 搜索范围为文本长度的1/4

	minPos := preferredPos - searchRange
	maxPos := preferredPos + searchRange

	if minPos < 0 {
		minPos = 0
	}
	if maxPos >= textLength {
		maxPos = textLength - 1
	}

	// 句子结束符（强分割符）
	sentenceEnders := []rune{'。', '！', '？', '.', '!', '?'}

	bestPos := -1
	bestDistance := textLength

	// 寻找最接近首选位置的句子结束符
	for i := minPos; i <= maxPos; i++ {
		char := textRunes[i]
		for _, ender := range sentenceEnders {
			if char == ender {
				distance := abs(i - preferredPos)
				if distance < bestDistance {
					bestDistance = distance
					bestPos = i + 1 // 在句子结束符后分割
				}
			}
		}
	}

	return bestPos
}

// findBestSplitPoint 寻找最佳分割点（保留用于兼容性，但不再使用）
func (s *Service) findBestSplitPoint(textRunes []rune, initialPoint int) int {
	// 这个方法保留用于兼容性，但新的分割逻辑不再使用
	return initialPoint
}

// abs 计算绝对值
func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}

// UpdateSpeaker 更新发音人和合成器
func (s *Service) UpdateSpeaker(speakerID string, synthesizer synthesizer.SynthesisService) {
	s.mu.Lock()
	defer s.mu.Unlock()

	// 关闭旧的合成器
	if s.synthesizer != nil {
		s.synthesizer.Close()
	}

	// 更新发音人和合成器
	s.speaker = speakerID
	s.synthesizer = synthesizer

	s.logger.Info("TTS发音人已更新",
		zap.String("speakerID", speakerID),
		zap.Bool("enableTextSplit", s.enableTextSplit),
		zap.Int("firstSegmentMinLen", s.firstSegmentMinLen),
		zap.Int("firstSegmentMaxLen", s.firstSegmentMaxLen),
		zap.Int("minSplitLength", s.minSplitLength),
	)
}

// Close 关闭服务
func (s *Service) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.closed {
		return nil
	}

	if s.synthesizer != nil {
		s.synthesizer.Close()
	}

	s.closed = true
	return nil
}

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
	enableTextSplit bool    // 是否启用文本分割
	splitRatio      float64 // 分割比例 (0.0-1.0)
	minSplitLength  int     // 最小分割长度
}

// TextSplitConfig 文本分割配置
type TextSplitConfig struct {
	Enable         bool    `json:"enable"`           // 是否启用文本分割
	SplitRatio     float64 `json:"split_ratio"`      // 分割比例，默认0.5（一半一半）
	MinSplitLength int     `json:"min_split_length"` // 最小分割长度，默认10个字符
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
	return &Service{
		ctx:             ctx,
		credential:      credential,
		speaker:         speaker,
		synthesizer:     synthesizer,
		errorHandler:    errorHandler,
		logger:          logger,
		enableTextSplit: true, // 默认启用文本分割
		splitRatio:      0.5,  // 默认一半一半分割
		minSplitLength:  15,   // 最小15个字符才分割（与configureTTSTextSplit保持一致）
	}
}

// SetTextSplitConfig 设置文本分割配置
func (s *Service) SetTextSplitConfig(config TextSplitConfig) {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.enableTextSplit = config.Enable
	if config.SplitRatio > 0 && config.SplitRatio <= 1.0 {
		s.splitRatio = config.SplitRatio
	}
	if config.MinSplitLength > 0 {
		s.minSplitLength = config.MinSplitLength
	}

	s.logger.Info("TTS文本分割配置已更新",
		zap.Bool("enable", s.enableTextSplit),
		zap.Float64("splitRatio", s.splitRatio),
		zap.Int("minSplitLength", s.minSplitLength),
	)
}

// Synthesize 合成语音
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

// splitText 智能分割文本
func (s *Service) splitText(text string) []TextSegment {
	s.mu.RLock()
	splitRatio := s.splitRatio
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

	// 计算分割点
	textRunes := []rune(text)
	textLength := len(textRunes)

	// 根据比例计算初始分割点
	initialSplitPoint := int(float64(textLength) * splitRatio)

	// 智能调整分割点，寻找合适的断句位置
	splitPoint := s.findBestSplitPoint(textRunes, initialSplitPoint)

	if splitPoint <= 0 || splitPoint >= textLength {
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
	firstPart := strings.TrimSpace(string(textRunes[:splitPoint]))
	secondPart := strings.TrimSpace(string(textRunes[splitPoint:]))

	// 检查分割后的部分是否太短
	if len(firstPart) < 3 || len(secondPart) < 3 {
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

	s.logger.Info("文本分割完成",
		zap.String("originalText", text),
		zap.String("firstPart", firstPart),
		zap.String("secondPart", secondPart),
		zap.Int("splitPoint", splitPoint),
		zap.Float64("actualRatio", float64(splitPoint)/float64(textLength)),
	)

	return []TextSegment{
		{
			Text:     firstPart,
			Index:    0,
			IsLast:   false,
			Priority: 0, // 第一部分优先级最高
		},
		{
			Text:     secondPart,
			Index:    1,
			IsLast:   true,
			Priority: 1, // 第二部分优先级较低
		},
	}
}

// findBestSplitPoint 寻找最佳分割点
func (s *Service) findBestSplitPoint(textRunes []rune, initialPoint int) int {
	textLength := len(textRunes)

	// 定义断句标点符号的优先级（数字越小优先级越高）
	punctuationPriority := map[rune]int{
		'。': 1, '！': 1, '？': 1, // 句号、感叹号、问号 - 最高优先级
		'.': 1, '!': 1, '?': 1, // 英文句号、感叹号、问号
		'；': 2, ';': 2, // 分号 - 高优先级
		'，': 3, ',': 3, // 逗号 - 中等优先级
		'：': 4, ':': 4, // 冒号 - 较低优先级
		'、': 5, // 顿号 - 低优先级
	}

	// 搜索范围：初始点前后20%的范围
	searchRange := textLength / 5
	if searchRange < 5 {
		searchRange = 5
	}

	minPoint := initialPoint - searchRange
	maxPoint := initialPoint + searchRange

	if minPoint < 0 {
		minPoint = 0
	}
	if maxPoint >= textLength {
		maxPoint = textLength - 1
	}

	bestPoint := initialPoint
	bestPriority := 999 // 最低优先级

	// 在搜索范围内寻找最佳断句点
	for i := minPoint; i <= maxPoint; i++ {
		if i >= textLength {
			break
		}

		char := textRunes[i]
		if priority, exists := punctuationPriority[char]; exists {
			// 计算距离初始点的权重（距离越近越好）
			distance := abs(i - initialPoint)
			adjustedPriority := priority + distance/10 // 距离权重

			if adjustedPriority < bestPriority {
				bestPriority = adjustedPriority
				bestPoint = i + 1 // 在标点符号后分割
			}
		}
	}

	// 如果找到了标点符号，使用它；否则寻找空格
	if bestPriority < 999 {
		return bestPoint
	}

	// 没找到标点符号，寻找空格或其他空白字符
	for i := minPoint; i <= maxPoint; i++ {
		if i >= textLength {
			break
		}

		char := textRunes[i]
		if unicode.IsSpace(char) {
			distance := abs(i - initialPoint)
			if distance < abs(bestPoint-initialPoint) {
				bestPoint = i + 1 // 在空格后分割
			}
		}
	}

	return bestPoint
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
		zap.Float64("splitRatio", s.splitRatio),
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

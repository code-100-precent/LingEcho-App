package tts

import (
	"context"
	"sync"

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
		ctx:          ctx,
		credential:   credential,
		speaker:      speaker,
		synthesizer:  synthesizer,
		errorHandler: errorHandler,
		logger:       logger,
	}
}

// Synthesize 合成语音
func (s *Service) Synthesize(ctx context.Context, text string) (<-chan []byte, error) {
	s.mu.RLock()
	closed := s.closed
	synthesizer := s.synthesizer
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
	)

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

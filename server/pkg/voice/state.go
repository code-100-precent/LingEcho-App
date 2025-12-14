package voice

import (
	"context"
	"strings"
	"sync"
	"time"
)

// TTSTask TTS任务
type TTSTask struct {
	Text   string
	Ctx    context.Context
	Writer *MessageWriter
}

// ClientState 客户端状态管理 - 封装所有状态相关的操作
type ClientState struct {
	mu                          sync.RWMutex
	lastText                    string
	lastProcessedText           string
	lastSentText                string // 上次发送给前端的文本（用于增量更新）
	lastProcessedCumulativeText string // 上次处理的累积文本（用于提取增量）
	isProcessing                bool
	isTTSPlaying                bool // TTS是否正在播放（用于暂停ASR识别）
	silenceTimer                *time.Timer
	ttsCtx                      context.Context
	ttsCancel                   context.CancelFunc
	ttsQueue                    chan *TTSTask // TTS任务队列
	ttsQueueRunning             bool          // TTS队列是否正在运行
	ttsTaskDone                 chan struct{} // TTS任务完成信号（用于等待前一个任务完成）
	asrCompleteTime             time.Time     // ASR识别完成时间（用于统计延迟）
}

// NewClientState 创建新的客户端状态
func NewClientState() *ClientState {
	return &ClientState{
		ttsQueue:    make(chan *TTSTask, 100), // 缓冲100个TTS任务
		ttsTaskDone: make(chan struct{}, 1),   // 缓冲1个信号，避免阻塞
	}
}

// SetLastText 设置最后识别的文本
func (s *ClientState) SetLastText(text string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.lastText = text
}

// GetLastText 获取最后识别的文本
func (s *ClientState) GetLastText() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.lastText
}

// IsProcessed 检查文本是否已处理
func (s *ClientState) IsProcessed(text string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return text == s.lastProcessedText
}

// MarkProcessed 标记文本为已处理
func (s *ClientState) MarkProcessed(text string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.lastText = text
	s.lastProcessedText = text
	s.isProcessing = true
	// 记录ASR完成时间，用于统计延迟
	s.asrCompleteTime = time.Now()
}

// GetASRCompleteTime 获取ASR完成时间
func (s *ClientState) GetASRCompleteTime() time.Time {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.asrCompleteTime
}

// IsProcessing 检查是否正在处理
func (s *ClientState) IsProcessing() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.isProcessing
}

// SetProcessing 设置处理状态
func (s *ClientState) SetProcessing(processing bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.isProcessing = processing
}

// SetSilenceTimer 设置静音计时器（会自动停止旧的计时器）
func (s *ClientState) SetSilenceTimer(timer *time.Timer) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.silenceTimer != nil {
		s.silenceTimer.Stop()
	}
	s.silenceTimer = timer
}

// StopSilenceTimer 停止静音计时器
func (s *ClientState) StopSilenceTimer() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.silenceTimer != nil {
		s.silenceTimer.Stop()
		s.silenceTimer = nil
	}
}

// SetTTSCtx 设置TTS上下文（会自动取消旧的上下文）
func (s *ClientState) SetTTSCtx(ctx context.Context, cancel context.CancelFunc) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.ttsCancel != nil {
		s.ttsCancel()
	}
	s.ttsCtx = ctx
	s.ttsCancel = cancel
}

// CancelTTS 取消TTS合成
func (s *ClientState) CancelTTS() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.ttsCancel != nil {
		s.ttsCancel()
		s.ttsCancel = nil
		s.ttsCtx = nil
	}
}

// GetTTSCtx 获取TTS上下文
func (s *ClientState) GetTTSCtx() context.Context {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.ttsCtx
}

// GetLastSentText 获取上次发送给前端的文本
func (s *ClientState) GetLastSentText() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.lastSentText
}

// SetLastSentText 设置上次发送给前端的文本
func (s *ClientState) SetLastSentText(text string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.lastSentText = text
}

// GetIncrementalText 获取增量文本（新文本相对于上次发送的增量部分）
func (s *ClientState) GetIncrementalText(newText string) string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.lastSentText == "" {
		return newText
	}

	// 如果新文本是上次发送文本的前缀，说明是累积的，返回增量部分
	if len(newText) > len(s.lastSentText) && strings.HasPrefix(newText, s.lastSentText) {
		return newText[len(s.lastSentText):]
	}

	// 如果新文本完全不同，返回完整新文本
	return newText
}

// SetTTSPlaying 设置TTS播放状态
func (s *ClientState) SetTTSPlaying(playing bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.isTTSPlaying = playing
}

// IsTTSPlaying 检查TTS是否正在播放
func (s *ClientState) IsTTSPlaying() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.isTTSPlaying
}

// SetLastProcessedCumulativeText 设置上次处理的累积文本
func (s *ClientState) SetLastProcessedCumulativeText(text string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.lastProcessedCumulativeText = text
}

// GetLastProcessedCumulativeText 获取上次处理的累积文本
func (s *ClientState) GetLastProcessedCumulativeText() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.lastProcessedCumulativeText
}

// ExtractIncrementalSentence 从累积文本中提取增量句子
// 如果当前累积文本包含上次处理的累积文本，返回增量部分
// 否则返回完整的当前文本
func (s *ClientState) ExtractIncrementalSentence(currentCumulativeText string) string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.lastProcessedCumulativeText == "" {
		// 没有上次处理的文本，返回完整文本
		return currentCumulativeText
	}

	// 如果当前文本包含上次的文本，提取增量部分
	if len(currentCumulativeText) > len(s.lastProcessedCumulativeText) {
		if strings.HasPrefix(currentCumulativeText, s.lastProcessedCumulativeText) {
			// 提取增量部分
			incremental := currentCumulativeText[len(s.lastProcessedCumulativeText):]
			return strings.TrimSpace(incremental)
		}
	}

	// 如果当前文本和上次文本不同，可能是新的句子（清空了之前的），返回完整文本
	return currentCumulativeText
}

// EnqueueTTS 将TTS任务加入队列
func (s *ClientState) EnqueueTTS(task *TTSTask) bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	select {
	case s.ttsQueue <- task:
		return true
	default:
		// 队列满时返回false
		return false
	}
}

// GetTTSQueue 获取TTS队列
func (s *ClientState) GetTTSQueue() <-chan *TTSTask {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.ttsQueue
}

// GetTTSTaskDone 获取TTS任务完成信号channel（发送端）
func (s *ClientState) GetTTSTaskDone() chan<- struct{} {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.ttsTaskDone
}

// WaitTTSTaskDone 等待TTS任务完成信号（接收端）
func (s *ClientState) WaitTTSTaskDone() <-chan struct{} {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.ttsTaskDone
}

// SetTTSQueueRunning 设置TTS队列运行状态
func (s *ClientState) SetTTSQueueRunning(running bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.ttsQueueRunning = running
}

// IsTTSQueueRunning 检查TTS队列是否正在运行
func (s *ClientState) IsTTSQueueRunning() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.ttsQueueRunning
}

// Clear 清空所有状态
func (s *ClientState) Clear() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.lastText = ""
	s.lastProcessedText = ""
	s.lastSentText = ""
	s.lastProcessedCumulativeText = ""
	s.isProcessing = false
	s.isTTSPlaying = false
	if s.silenceTimer != nil {
		s.silenceTimer.Stop()
		s.silenceTimer = nil
	}
	if s.ttsCancel != nil {
		s.ttsCancel()
		s.ttsCancel = nil
		s.ttsCtx = nil
	}
	// 清空TTS队列
	for {
		select {
		case <-s.ttsQueue:
			// 移除队列中的任务
		default:
			// 队列已空
			return
		}
	}
}

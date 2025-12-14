package voicev2

import (
	"context"
	"strings"
	"sync"
	"time"
	"unicode"
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
	isFatalError                bool // 是否正在处理致命错误（用于阻止新处理）
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

// SetLastSentText 设置上次发送给前端的文本
func (s *ClientState) SetLastSentText(text string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.lastSentText = text
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
// 优化版本：考虑文本相似度，避免重复处理同一句话
// 如果当前文本与已处理文本高度相似，返回空字符串（表示没有增量）
func (s *ClientState) ExtractIncrementalSentence(currentCumulativeText string) string {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.lastProcessedCumulativeText == "" {
		// 没有上次处理的文本，返回完整文本
		return currentCumulativeText
	}

	// 归一化已处理文本用于比较
	normalizedLast := normalizeTextForComparison(s.lastProcessedCumulativeText)

	// 如果当前文本包含上次的文本（前缀匹配），提取增量部分
	if len(currentCumulativeText) > len(s.lastProcessedCumulativeText) {
		if strings.HasPrefix(currentCumulativeText, s.lastProcessedCumulativeText) {
			// 提取增量部分
			incremental := currentCumulativeText[len(s.lastProcessedCumulativeText):]
			normalizedIncremental := normalizeTextForComparison(incremental)
			// 如果增量部分归一化后为空（只有标点或空格），返回空
			if normalizedIncremental == "" {
				return ""
			}
			// 检查增量部分是否只是已处理文本的重复（相似度很高）
			// 注意：只有当增量部分本身很短且与已处理文本相似时，才认为是重复
			// 例如："喂喂可以听到吗" -> "喂喂喂可以听到吗"，增量"喂"与已处理文本相似
			if len(normalizedIncremental) > 0 && len(normalizedLast) > 0 {
				// 如果增量部分长度明显小于已处理文本，且相似度很高，可能是重复
				// 但如果增量部分长度接近或大于已处理文本，说明是新内容
				if len(normalizedIncremental) < len(normalizedLast)/2 {
					similarity := calculateTextSimilarity(normalizedIncremental, normalizedLast)
					if similarity > 0.85 {
						return ""
					}
				}
			}
			return strings.TrimSpace(incremental)
		}
	}

	// 归一化当前文本用于相似度比较
	normalizedCurrent := normalizeTextForComparison(currentCumulativeText)

	// 如果归一化后的文本相同或高度相似，认为是同一句话，返回空字符串
	if normalizedCurrent == normalizedLast {
		return ""
	}

	// 计算相似度
	similarity := calculateTextSimilarity(normalizedCurrent, normalizedLast)
	// 相似度阈值：如果超过85%，认为是同一句话的变体
	if similarity > 0.85 {
		return ""
	}

	// 如果当前文本和上次文本不同且不相似，可能是新的句子，返回完整文本
	return currentCumulativeText
}

// normalizeTextForComparison 归一化文本用于相似度比较
// 去除标点符号、空格、重复字符等，只保留核心文字内容
func normalizeTextForComparison(text string) string {
	if text == "" {
		return ""
	}

	// 转换为rune数组以便正确处理中文
	runes := []rune(strings.TrimSpace(text))
	var result strings.Builder

	// 定义需要保留的字符类型
	for _, r := range runes {
		// 保留中文字符、英文字母、数字
		if unicode.Is(unicode.Han, r) || unicode.IsLetter(r) || unicode.IsNumber(r) {
			result.WriteRune(r)
		}
		// 忽略标点、空格、其他符号
	}

	normalized := result.String()

	// 去除重复的连续字符（例如："喂喂喂" -> "喂"）
	normalized = removeRepeatedChars(normalized)

	return normalized
}

// removeRepeatedChars 去除重复的连续字符
// 例如："喂喂喂可以听到吗" -> "喂可以听到吗"
func removeRepeatedChars(text string) string {
	if text == "" {
		return ""
	}

	runes := []rune(text)
	if len(runes) == 0 {
		return ""
	}

	var result strings.Builder
	lastChar := runes[0]
	result.WriteRune(lastChar)

	// 跳过重复的连续字符
	for i := 1; i < len(runes); i++ {
		if runes[i] != lastChar {
			result.WriteRune(runes[i])
			lastChar = runes[i]
		}
	}

	return result.String()
}

// calculateTextSimilarity 计算两个文本的相似度（0-1之间）
// 使用编辑距离（Levenshtein距离）算法
func calculateTextSimilarity(text1, text2 string) float64 {
	if text1 == "" && text2 == "" {
		return 1.0
	}
	if text1 == "" || text2 == "" {
		return 0.0
	}

	// 如果完全相同，相似度为1
	if text1 == text2 {
		return 1.0
	}

	// 计算编辑距离
	distance := levenshteinDistance(text1, text2)
	maxLen := len(text1)
	if len(text2) > maxLen {
		maxLen = len(text2)
	}

	if maxLen == 0 {
		return 1.0
	}

	// 相似度 = 1 - (编辑距离 / 最大长度)
	similarity := 1.0 - float64(distance)/float64(maxLen)
	return similarity
}

// levenshteinDistance 计算两个字符串的编辑距离（Levenshtein距离）
func levenshteinDistance(s1, s2 string) int {
	runes1 := []rune(s1)
	runes2 := []rune(s2)

	// 创建动态规划表
	rows := len(runes1) + 1
	cols := len(runes2) + 1
	dp := make([][]int, rows)
	for i := range dp {
		dp[i] = make([]int, cols)
	}

	// 初始化第一行和第一列
	for i := 0; i < rows; i++ {
		dp[i][0] = i
	}
	for j := 0; j < cols; j++ {
		dp[0][j] = j
	}

	// 填充动态规划表
	for i := 1; i < rows; i++ {
		for j := 1; j < cols; j++ {
			if runes1[i-1] == runes2[j-1] {
				dp[i][j] = dp[i-1][j-1]
			} else {
				// 取插入、删除、替换的最小值
				dp[i][j] = min(
					dp[i-1][j]+1,   // 删除
					dp[i][j-1]+1,   // 插入
					dp[i-1][j-1]+1, // 替换
				)
			}
		}
	}

	return dp[rows-1][cols-1]
}

// min 返回三个整数中的最小值
func min(a, b, c int) int {
	if a < b {
		if a < c {
			return a
		}
		return c
	}
	if b < c {
		return b
	}
	return c
}

// EnqueueTTS 将TTS任务加入队列
// 注意：channel操作本身是并发安全的，不需要锁
func (s *ClientState) EnqueueTTS(task *TTSTask) bool {
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

// SetFatalError 设置致命错误状态
func (s *ClientState) SetFatalError(fatal bool) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.isFatalError = fatal
}

// IsFatalError 检查是否正在处理致命错误
func (s *ClientState) IsFatalError() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.isFatalError
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
	s.isFatalError = false
	if s.ttsCancel != nil {
		s.ttsCancel()
		s.ttsCancel = nil
		s.ttsCtx = nil
	}
	// 清空TTS队列（添加最大清理次数限制，避免无限循环）
	maxClearCount := 200 // 最多清理200个任务（队列缓冲100个，加上一些额外的）
	clearedCount := 0
	for clearedCount < maxClearCount {
		select {
		case <-s.ttsQueue:
			// 移除队列中的任务
			clearedCount++
		default:
			// 队列已空
			return
		}
	}
}

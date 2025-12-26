package voice

import (
	"math"
	"sync"
)

// VADDetector 语音活动检测器
type VADDetector struct {
	mu                      sync.RWMutex
	enabled                 bool
	threshold               float64 // RMS 阈值
	consecutiveFramesNeeded int     // 需要连续超过阈值的帧数
	frameCounter            int     // 当前连续帧计数
}

// NewVADDetector 创建新的 VAD 检测器
func NewVADDetector() *VADDetector {
	return &VADDetector{
		enabled:                 true,
		threshold:               500.0, // 降低阈值以提高灵敏度
		consecutiveFramesNeeded: 2,     // 只需要2帧（约40ms）即可触发
		frameCounter:            0,
	}
}

// CheckBargeIn 检查是否应该中断 TTS（barge-in 检测）
// 返回 true 如果检测到用户说话
func (v *VADDetector) CheckBargeIn(pcmData []byte, ttsPlaying bool) bool {
	if len(pcmData) < 2 {
		return false
	}

	v.mu.Lock()
	defer v.mu.Unlock()

	// 只在 TTS 播放时检测
	if !v.enabled || !ttsPlaying {
		v.frameCounter = 0
		return false
	}

	// 计算音频能量 (RMS)
	rms := calculateRMS(pcmData)

	// 检查能量是否超过阈值
	if rms > v.threshold {
		v.frameCounter++
		// 达到连续帧数要求，触发 barge-in
		if v.frameCounter >= v.consecutiveFramesNeeded {
			v.frameCounter = 0 // 重置计数器
			return true
		}
	} else {
		// 能量低于阈值，重置计数器
		v.frameCounter = 0
	}

	return false
}

// SetEnabled 设置 VAD 是否启用
func (v *VADDetector) SetEnabled(enabled bool) {
	v.mu.Lock()
	defer v.mu.Unlock()
	v.enabled = enabled
	if !enabled {
		v.frameCounter = 0
	}
}

// SetThreshold 设置 RMS 阈值
func (v *VADDetector) SetThreshold(threshold float64) {
	v.mu.Lock()
	defer v.mu.Unlock()
	v.threshold = threshold
}

// SetConsecutiveFrames 设置需要连续超过阈值的帧数
func (v *VADDetector) SetConsecutiveFrames(frames int) {
	v.mu.Lock()
	defer v.mu.Unlock()
	v.consecutiveFramesNeeded = frames
}

// calculateRMS 计算 16-bit PCM 音频数据的 RMS (Root Mean Square)
func calculateRMS(pcmData []byte) float64 {
	if len(pcmData) < 2 {
		return 0
	}

	var sumSquares float64
	sampleCount := len(pcmData) / 2

	if sampleCount == 0 {
		return 0
	}

	for i := 0; i < len(pcmData)-1; i += 2 {
		// 转换为 int16 (little-endian)
		sample := int16(pcmData[i]) | int16(pcmData[i+1])<<8
		// 使用绝对值
		absSample := math.Abs(float64(sample))
		sumSquares += absSample * absSample
	}

	return math.Sqrt(sumSquares / float64(sampleCount))
}

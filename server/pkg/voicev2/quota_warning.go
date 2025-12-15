package voicev2

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"time"

	"github.com/code-100-precent/LingEcho/pkg/media"
	"github.com/youpy/go-wav"
	"go.uber.org/zap"
)

// playQuotaWarning 播放配额警告音频
// 返回播放时长（用于等待）
func playQuotaWarning(writer *MessageWriter, logger *zap.Logger) (time.Duration, error) {
	// 查找警告音频文件
	warningFile := "scripts/QuotaWarning.wav"

	// 尝试多个可能的路径
	possiblePaths := []string{
		warningFile,
		filepath.Join(".", warningFile),
		filepath.Join("..", warningFile),
		filepath.Join("../..", warningFile),
	}

	var file *os.File
	var err error
	for _, path := range possiblePaths {
		file, err = os.Open(path)
		if err == nil {
			warningFile = path
			break
		}
	}

	if file == nil {
		logger.Warn("无法找到配额警告音频文件", zap.Strings("triedPaths", possiblePaths))
		return 0, fmt.Errorf("无法找到配额警告音频文件: %v", err)
	}
	defer file.Close()

	// 读取WAV文件
	w := wav.NewReader(file)
	format, err := w.Format()
	if err != nil {
		return 0, fmt.Errorf("无法读取WAV格式: %w", err)
	}

	logger.Info("开始播放配额警告音频",
		zap.String("file", warningFile),
		zap.Int("sampleRate", int(format.SampleRate)),
		zap.Int("channels", int(format.NumChannels)),
		zap.Int("bitDepth", int(format.BitsPerSample)))

	// 发送TTS开始消息（使用WAV文件的格式信息）
	audioFormat := media.StreamFormat{
		SampleRate: int(format.SampleRate),
		Channels:   int(format.NumChannels),
		BitDepth:   int(format.BitsPerSample),
	}
	logger.Info("准备发送配额警告音频TTS开始消息",
		zap.Int("sampleRate", audioFormat.SampleRate),
		zap.Int("channels", audioFormat.Channels),
		zap.Int("bitDepth", audioFormat.BitDepth))
	if err := writer.SendTTSStart(audioFormat); err != nil {
		logger.Error("发送TTS开始消息失败", zap.Error(err))
		return 0, err
	}
	logger.Info("配额警告音频TTS开始消息已发送")

	// 读取并发送音频数据（wav.NewReader会自动跳过WAV头，只返回PCM数据）
	var totalBytes int64
	chunkSize := 8192
	buffer := make([]byte, chunkSize)

	for {
		n, err := w.Read(buffer)
		if err == io.EOF {
			break
		}
		if err != nil {
			logger.Error("读取音频文件失败", zap.Error(err))
			return 0, err
		}

		if n > 0 {
			// 发送音频数据（纯PCM数据，不包含WAV头）
			if err := writer.SendBinary(buffer[:n]); err != nil {
				logger.Error("发送警告音频数据失败", zap.Error(err))
				return 0, err
			}
			totalBytes += int64(n)
			logger.Debug("发送警告音频数据块",
				zap.Int("size", n),
				zap.Int64("totalBytes", totalBytes))
		}
	}

	// 发送TTS结束消息
	logger.Info("准备发送配额警告音频TTS结束消息", zap.Int64("totalBytes", totalBytes))
	if err := writer.SendTTSEnd(); err != nil {
		logger.Error("发送TTS结束消息失败", zap.Error(err))
	} else {
		logger.Info("配额警告音频TTS结束消息已发送")
	}

	// 计算播放时长
	var playDuration time.Duration
	if format.SampleRate > 0 && format.NumChannels > 0 && format.BitsPerSample > 0 {
		sampleRate := int64(format.SampleRate)
		channels := int64(format.NumChannels)
		bitDepth := int64(format.BitsPerSample)
		bytesPerSecond := sampleRate * channels * bitDepth / 8
		if bytesPerSecond > 0 {
			playDuration = time.Duration(totalBytes*1000/bytesPerSecond) * time.Millisecond
			// 增加10%的缓冲时间
			playDuration = time.Duration(float64(playDuration) * 1.1)
		}
	}

	// 如果无法计算，使用默认值（假设3秒）
	if playDuration == 0 {
		playDuration = 3 * time.Second
	}

	// 确保最小1秒，最大10秒
	if playDuration < 1*time.Second {
		playDuration = 1 * time.Second
	}
	if playDuration > 10*time.Second {
		playDuration = 10 * time.Second
	}

	logger.Info("配额警告音频播放完成",
		zap.Int64("totalBytes", totalBytes),
		zap.Duration("playDuration", playDuration))

	return playDuration, nil
}

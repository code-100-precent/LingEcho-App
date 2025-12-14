package voicev2

import (
	"strings"
	"time"

	"go.uber.org/zap"
)

// isFatalError 判断是否是致命错误（需要断开连接）
// 包括：额度不足、配额用完、认证失败等
func isFatalError(err error) bool {
	if err == nil {
		return false
	}

	errMsg := strings.ToLower(err.Error())

	// 额度/配额相关错误
	fatalKeywords := []string{
		"quota exceeded",               // 配额超限
		"quota exhausted",              // 配额用完
		"pkg exhausted",                // 资源包用完
		"allowance has been exhausted", // 配额已用完
		"insufficient quota",           // 配额不足
		"quota limit",                  // 配额限制
		"unauthorized",                 // 未授权
		"authentication failed",        // 认证失败
		"invalid credentials",          // 无效凭证
		"api key invalid",              // API密钥无效
		"api key expired",              // API密钥过期
		"account suspended",            // 账户暂停
		"account disabled",             // 账户禁用
	}

	for _, keyword := range fatalKeywords {
		if strings.Contains(errMsg, keyword) {
			return true
		}
	}

	return false
}

// HandleFatalError 处理致命错误：发送错误消息并断开连接
// 注意：这个函数会检查错误是否是致命的，如果是则断开连接
func HandleFatalError(
	client *VoiceClient,
	err error,
	serviceType string, // "ASR", "TTS", "LLM", "服务初始化", "ASR连接"
	writer *MessageWriter,
	logger *zap.Logger,
) {
	if err == nil {
		return
	}

	isFatal := isFatalError(err)
	errorMsg := serviceType + "错误: " + err.Error()

	logger.Error("检测到服务错误",
		zap.String("service", serviceType),
		zap.Error(err),
		zap.Bool("isFatal", isFatal))

	// 如果是致命错误，需要先播放警告音频，然后再发送错误消息
	if isFatal {
		logger.Warn("检测到致命错误，准备播放警告音频并断开连接",
			zap.String("service", serviceType),
			zap.Error(err))

		// 立即标记为致命错误状态，阻止新的处理
		if client.state != nil {
			client.state.SetFatalError(true)
			client.state.SetTTSPlaying(true) // 暂停ASR识别
		}

		// 标记为非活跃，阻止新的ASR处理
		client.SetActive(false)

		// 在goroutine中播放警告音频，等待完成后再发送错误消息并断开连接
		go func() {
			// 先播放配额警告音频（不发送错误消息，避免前端停止播放）
			playDuration, playErr := playQuotaWarning(writer, logger)
			if playErr != nil {
				logger.Warn("播放配额警告音频失败", zap.Error(playErr))
				// 如果播放失败，立即发送错误消息
				writer.SendError(errorMsg, true)
			} else {
				// 等待警告音频播放完成
				logger.Info("等待配额警告音频播放完成", zap.Duration("duration", playDuration))
				time.Sleep(playDuration)
				logger.Info("配额警告音频播放完成，发送错误消息并准备断开连接")

				// 音频播放完成后再发送错误消息
				if sendErr := writer.SendError(errorMsg, true); sendErr != nil {
					logger.Error("发送错误消息失败", zap.Error(sendErr))
				}
			}

			// 取消上下文，这会触发handleMessageLoop退出，然后执行cleanupClient关闭连接
			// 注意：不再需要手动清理资源，cleanupClient 会统一处理
			// 只需要取消 context，让主循环退出并触发清理
			// 由于使用的是传入的 context，这里不需要手动取消
			// 但可以通过关闭连接来触发清理
			if client.conn != nil {
				client.conn.Close()
			}

			logger.Info("已触发连接关闭", zap.String("service", serviceType))
		}()
	} else {
		// 非致命错误：只发送错误消息
		if sendErr := writer.SendError(errorMsg, false); sendErr != nil {
			logger.Error("发送错误消息失败", zap.Error(sendErr))
		}
	}
}

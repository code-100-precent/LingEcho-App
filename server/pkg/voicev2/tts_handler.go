package voicev2

import (
	"context"
	"fmt"
	"time"

	"github.com/code-100-precent/LingEcho/pkg/media"
	"github.com/code-100-precent/LingEcho/pkg/synthesizer"
	"github.com/gorilla/websocket"
	"go.uber.org/zap"
)

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
	// 使用指针以便在goroutine中安全访问
	totalAudioBytes := new(int64)
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
				*totalAudioBytes += int64(len(data))

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

				tp.logger.Debug("收到TTS音频数据，准备发送",
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
							zap.Int("totalChunks", totalChunks),
							zap.Int("chunkSize", len(chunk)),
							zap.Int64("totalBytes", *totalAudioBytes))
					}
				} else {
					if err := writer.SendBinary(data); err != nil {
						tp.logger.Error("发送TTS音频流失败",
							zap.Error(err),
							zap.Int("size", len(data)))
						return // 发送失败时返回，避免继续发送
					} else {
						tp.logger.Debug("TTS音频数据发送成功",
							zap.Int("size", len(data)),
							zap.Int64("totalBytes", *totalAudioBytes))
					}
				}
			}
		},
	}

	// 在goroutine中合成，避免阻塞队列处理器
	// 注意：虽然每个任务一个 goroutine，但这是必要的，因为 TTS.Synthesize 会阻塞
	// 而且回调是异步的，需要独立的 goroutine 来处理
	go func() {
		var synthesisSucceeded bool
		var isFatalErrorOccurred bool // 标记是否发生了致命错误
		var signalSent bool           // 标记是否已发送完成信号
		defer func() {
			// 确保在所有情况下都发送完成信号（防止队列阻塞）
			if !signalSent {
				doneChan := client.state.GetTTSTaskDone()
				select {
				case doneChan <- struct{}{}:
					signalSent = true
					tp.logger.Debug("TTS任务完成信号已发送（defer保证）")
				case <-time.After(100 * time.Millisecond):
					tp.logger.Debug("TTS任务完成信号发送超时（defer）")
				}
			}

			tp.logger.Info("TTS合成goroutine结束，清理状态",
				zap.Bool("synthesisSucceeded", synthesisSucceeded),
				zap.Int64("totalAudioBytes", *totalAudioBytes),
				zap.Bool("isFatalErrorOccurred", isFatalErrorOccurred),
				zap.Bool("signalSent", signalSent))

			// 只有在没有发生致命错误时才发送TTS结束消息
			// 致命错误时，警告音频会自己发送tts_start和tts_end
			if !isFatalErrorOccurred {
				// 先发送TTS结束消息
				if err := writer.SendTTSEnd(); err != nil {
					tp.logger.Error("发送TTS结束消息失败", zap.Error(err))
				}
			}

			// 只有在成功合成且收到音频数据时才等待播放时长
			if synthesisSucceeded && *totalAudioBytes > 0 {
				// 计算音频播放时长
				estimatedPlayDuration := tp.calculatePlayDuration(*totalAudioBytes, format, text)

				tp.logger.Info("等待TTS音频播放完成",
					zap.String("text", text),
					zap.Int64("totalAudioBytes", *totalAudioBytes),
					zap.Duration("estimatedPlayDuration", estimatedPlayDuration),
					zap.Duration("audioSendDuration", time.Since(audioStartTime)))

				// 等待估算的播放时长，确保前端播放完成
				time.Sleep(estimatedPlayDuration)
			} else {
				tp.logger.Debug("TTS合成失败或没有音频数据，跳过播放等待",
					zap.String("text", text),
					zap.Bool("synthesisSucceeded", synthesisSucceeded),
					zap.Int64("totalAudioBytes", *totalAudioBytes))
			}

			// 恢复ASR识别
			client.state.SetTTSPlaying(false)

			// 检查并恢复ASR服务（如果需要）
			// 注意：setupASRConnection 中的自动重连循环会处理重连
			// 这里只需要停止当前连接，让自动重连循环检测到并重新连接
			if client.asrService != nil && !client.asrService.Activity() {
				tp.logger.Warn("ASR服务已停止，等待自动重连", zap.String("text", text))
				// 停止当前连接，让自动重连循环重新连接
				if err := client.asrService.StopConn(); err != nil {
					tp.logger.Warn("停止ASR连接失败", zap.Error(err))
				}
				client.SetActive(false)
				tp.logger.Info("ASR服务已停止，自动重连循环会重新连接", zap.String("text", text))
			}

			tp.logger.Debug("TTS结束，恢复ASR识别", zap.String("text", text))

			// 发送完成信号，通知队列可以处理下一个任务
			// 使用带超时的发送，确保信号不会丢失
			doneChan := client.state.GetTTSTaskDone()
			select {
			case doneChan <- struct{}{}:
				// 成功发送信号
				signalSent = true
				tp.logger.Debug("TTS任务完成信号已发送")
			case <-time.After(100 * time.Millisecond):
				// 超时：可能没有接收者，但这是正常的（可能是最后一个任务或队列已关闭）
				tp.logger.Debug("TTS任务完成信号发送超时（可能是最后一个任务）")
			}
		}()

		tp.logger.Info("开始TTS合成",
			zap.String("text", text),
			zap.String("provider", string(client.ttsService.Provider())),
			zap.Int("textLength", len(text)))

		var synthesisErr error
		if err := client.ttsService.Synthesize(ttsCtx, ttsHandler, text); err != nil {
			if ttsCtx.Err() == context.Canceled {
				tp.logger.Debug("TTS合成已被取消")
				// 取消时不需要额外处理，defer会处理清理
				return
			}
			synthesisErr = err
			// 检查是否是致命错误（额度不足等）
			if isFatalError(err) {
				// 标记致命错误已发生
				isFatalErrorOccurred = true
				// 致命错误：断开连接
				HandleFatalError(client, err, "TTS", writer, tp.logger)
				return
			}
			// 非致命错误：只发送错误消息
			tp.logger.Error("调用TTS失败", zap.Error(err))
			writer.SendError("TTS合成失败: "+err.Error(), false)
			// synthesisSucceeded保持为false，defer会处理清理和发送完成信号
			return
		}

		// 检查是否收到了任何音频数据
		// 如果Synthesize返回nil但totalAudioBytes为0，可能是错误（特别是腾讯云等服务的OnFail回调）
		if *totalAudioBytes == 0 {
			tp.logger.Warn("TTS合成完成但没有收到音频数据",
				zap.String("text", text),
				zap.String("provider", string(client.ttsService.Provider())),
				zap.Bool("synthesizeReturnedError", synthesisErr != nil))

			// 对于腾讯云等服务，如果Synthesize返回nil但totalAudioBytes为0
			// 很可能是OnFail回调被调用了（配额错误等），但错误没有通过Synthesize返回
			// 这种情况下，我们假设这是配额错误
			provider := string(client.ttsService.Provider())
			if provider == "tencent" || provider == "qcloud" {
				// 对于腾讯云，totalAudioBytes为0且Synthesize返回nil，很可能是配额错误
				// 创建配额错误并触发致命错误处理
				isFatalErrorOccurred = true // 标记致命错误已发生
				fatalErr := fmt.Errorf("UnsupportedOperation.PkgExhausted: The resource pack allowance has been exhausted, please check your resource pack")
				tp.logger.Error("检测到TTS配额错误（通过totalAudioBytes=0推断）",
					zap.String("provider", provider),
					zap.Error(fatalErr))
				HandleFatalError(client, fatalErr, "TTS", writer, tp.logger)
				return
			}

			// 其他服务：非致命错误，只发送错误消息
			writer.SendError("TTS合成失败：未收到音频数据", false)
			// synthesisSucceeded保持为false，defer会处理清理和发送完成信号
			return
		}

		// 标记合成成功
		synthesisSucceeded = true

		tp.logger.Info("TTS合成完成",
			zap.String("text", text),
			zap.Int64("totalAudioBytes", *totalAudioBytes),
			zap.Duration("audioSendDuration", time.Since(audioStartTime)))
	}()
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

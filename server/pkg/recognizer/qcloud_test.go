package recognizer

import (
	"os"
	"testing"
	"time"

	"github.com/code-100-precent/LingEcho/pkg/media"
	"github.com/code-100-precent/LingEcho/pkg/utils"
	"github.com/stretchr/testify/assert"
)

func TestQCloudASR(t *testing.T) {
	secretId := utils.GetEnv("QCLOUD_SECRET_ID")
	secretKey := utils.GetEnv("QCLOUD_SECRET")
	appId := utils.GetEnv("QCLOUD_APP_ID")
	if secretId == "" || secretKey == "" {
		t.Skip("missing QCLOUD_SECRET_ID or QCLOUD_SECRET")
	}

	session := media.NewDefaultSession()
	session.Pipeline(WithQCloudASR(NewQcloudASROption(appId, secretId, secretKey)))
	defer session.Close()

	result := ""

	session.Pipeline(func(h media.SessionHandler, data media.SessionData) {
		if data.Type == media.SessionDataFrame {
			textFrame, ok := data.Frame.(*media.TextFrame)
			if ok && textFrame.IsTranscribed {
				result = textFrame.Text
			}
		}
	})

	session.On(media.Begin, func(event media.StateEvent) {
		audioData, err := os.ReadFile("synthesized_signal.wav")
		assert.Nil(t, err)
		frameSize := media.ComputeSampleByteCount(16000, 16, 1) * 200

		for i := 0; i < len(audioData); i += frameSize {
			end := i + frameSize
			if end > len(audioData) {
				end = len(audioData)
			}
			session.EmitFrame(session, &media.AudioFrame{
				Payload: audioData[i:end],
			})
		}
	})

	session.On(media.Completed, func(event media.StateEvent) {
		session.Close()
	})

	go func() {
		time.Sleep(5 * time.Second)
		session.EmitState(session, media.Hangup)
	}()

	session.Serve()

	// "腾讯云智能语音欢迎您。"
	assert.Contains(t, result, "腾讯")
}

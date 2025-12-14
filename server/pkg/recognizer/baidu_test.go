package recognizer

import (
	"os"
	"strconv"
	"testing"
	"time"

	"github.com/code-100-precent/LingEcho/pkg/media"
	"github.com/stretchr/testify/assert"
)

func TestBaiduASR(t *testing.T) {
	appIdStr := os.Getenv("BAIDU_APPID")
	appKey := os.Getenv("BAIDU_APPKEY")
	devPidStr := os.Getenv("BAIDU_DEVPID")
	if devPidStr == "" {
		t.Skip("Missing aliyun asr param.")
	}

	appId, _ := strconv.Atoi(appIdStr)
	devPid, _ := strconv.Atoi(devPidStr)

	session := media.NewDefaultSession()

	session.Pipeline(WithBaiduASR(NewBaiduASROption(appId, appKey, devPid, "pcm", 16000)))

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
		audioData, err := os.ReadFile("../../testdata/asr_demo_zh.pcm")
		assert.Nil(t, err)

		frameSize := media.ComputeSampleByteCount(16000, 16, 1) * 500

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

	go func() {
		time.Sleep(1 * time.Second)
		session.EmitState(session, media.Hangup)
	}()

	session.On(media.Completed, func(event media.StateEvent) {
		session.Close()
	})

	session.Serve()

	assert.Contains(t, result, "腾讯")
}

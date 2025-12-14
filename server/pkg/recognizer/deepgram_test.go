package recognizer

import (
	"os"
	"testing"
	"time"

	"github.com/code-100-precent/LingEcho/pkg/media"
	"github.com/stretchr/testify/assert"
)

func TestDeepgramASR(t *testing.T) {
	apiKey := os.Getenv("DEEPGRAM_API_KEY")
	if apiKey == "" {
		t.Skip("missing DEEPGRAM_API_KEY")
	}

	session := media.NewDefaultSession()

	opt := NewDeepgramASROption(apiKey, "nova-2", "en-US")
	opt.ReqChanSize = 256
	session.Pipeline(WithDeepgramASR(opt))

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
		audioData, err := os.ReadFile("../../testdata/asr_demo_en.pcm")
		assert.Nil(t, err)

		frameSize := media.ComputeSampleByteCount(16000, 16, 1) * 1000
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
		time.Sleep(15 * time.Second)
		session.EmitState(session, media.Hangup)
	}()

	session.On(media.Hangup, func(event media.StateEvent) {
		session.Close()
	})

	session.Serve()

	assert.True(t, len(result) > 0)
}

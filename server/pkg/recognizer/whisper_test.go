package recognizer

import (
	"os"
	"testing"

	"github.com/code-100-precent/LingEcho/pkg/media"
	"github.com/stretchr/testify/assert"
)

func TestWhisperASR(t *testing.T) {
	whisperUrl := os.Getenv("WHISPER_URL")
	if whisperUrl == "" {
		t.Skip("missing WHISPER_URL")
	}
	opt := NewWhisperASROption(whisperUrl, "medium.en")

	session := media.NewDefaultSession()
	session.Pipeline(WithWhisperASR(opt))
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
		audioData, err := os.ReadFile("../../testdata/asr_demo_en.pcm")
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

	session.Serve()

	assert.Contains(t, result, "The  stale")
}

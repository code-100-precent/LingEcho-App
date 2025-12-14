package recognizer

import (
	"os"
	"testing"
	"time"

	"github.com/code-100-precent/LingEcho/pkg/media"
	"github.com/stretchr/testify/assert"
)

func TestWithVoiceapiASR(t *testing.T) {
	url := os.Getenv("ASR_VOICEAPI_URL")
	if url == "" {
		t.Skip("ASR_VOICEAPI_URL not set")
	}

	session := media.NewDefaultSession()
	session.Pipeline(WithVoiceapiASR(NewVoiceapiASROption(url)))

	session.On(media.Begin, func(event media.StateEvent) {
		audioData, err := os.ReadFile("../../testdata/asr_demo_zh.pcm")
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

	result := ""
	session.On(media.Transcribing, func(event media.StateEvent) {
		data := event.Params[0].(*media.TranscribingData)
		result = data.Result.(string)
	})

	session.On(media.Completed, func(event media.StateEvent) {
		session.Close()
	})
	go func() {
		time.Sleep(2 * time.Second)
		session.Close()
	}()

	session.Serve()
	assert.Contains(t, result, "腾讯")
}

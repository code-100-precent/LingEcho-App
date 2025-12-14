package recognizer

import (
	"os"
	"testing"

	"github.com/code-100-precent/LingEcho/pkg/media"
	"github.com/stretchr/testify/assert"
)

func TestVolcEngine(t *testing.T) {

	appId := os.Getenv("VOLC_APPID")
	token := os.Getenv("VOLC_TOKEN")
	cluster := os.Getenv("VOLC_CLUSTER")
	format := os.Getenv("VOLC_FORMAT")

	if appId == "" {
		t.Skip("missing VolcEngine args")
	}

	session := media.NewDefaultSession()
	session.Pipeline(WithVolcengineASR(NewVolcengineOption(appId, token, cluster, format)))

	session.On(media.Begin, func(event media.StateEvent) {
		audioData, err := os.ReadFile("../../testdata/asr_demo_zh.pcm")
		assert.Nil(t, err)
		frameSize := media.ComputeSampleByteCount(16000, 16, 1) * 200
		for i := 0; i < len(audioData); i += frameSize {
			end := i + frameSize
			if end > len(audioData) {
				end = len(audioData)
				session.EmitFrame(session, &media.AudioFrame{
					Payload: audioData[i:end],
				})
				session.EmitFrame(session, &media.AudioFrame{
					Payload: audioData[i:end],
				})
				break
			}
			session.EmitFrame(session, &media.AudioFrame{
				Payload: audioData[i:end],
			})
		}
	})

	session.On(media.Transcribing, func(event media.StateEvent) {
		if s, ok := event.Params[0].(string); ok && s != "" {
			assert.Contains(t, s, "腾")
		}
	})

	session.Serve()
}

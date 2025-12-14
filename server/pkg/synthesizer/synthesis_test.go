package synthesizer

import (
	"context"
	"os"
	"testing"
	"time"

	devices "github.com/code-100-precent/LingEcho/pkg/devices"
	"github.com/code-100-precent/LingEcho/pkg/media"
	"github.com/gen2brain/malgo"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
)

func TestWithSynthesis(t *testing.T) {
	appID := os.Getenv("QCLOUD_APP_ID")
	secretID := os.Getenv("QCLOUD_SECRET_ID")
	secretKey := os.Getenv("QCLOUD_SECRET")
	if appID == "" {
		t.Skip("missing parameters")
	}

	media.MediaCache().Disabled = true
	defer func() {
		media.MediaCache().Disabled = false
	}()

	opt := NewQcloudTTSConfig(appID, secretID, secretKey, 1005, "", 8000)
	opt.FrameDuration = "10ms"
	svc := NewQCloudService(opt)

	session := media.NewDefaultSession()
	defer session.Close()

	started := false
	stoped := false

	malgoCtx, err := malgo.InitContext(nil, malgo.ContextConfig{}, func(message string) {
	})
	if err != nil {
		panic(err)
	}
	defer func() {
		_ = malgoCtx.Uninit()
		malgoCtx.Free()
	}()

	deviceOpt := devices.NewDefaultOption(malgoCtx)
	playback := devices.NewSpeaker(deviceOpt)
	err = playback.StartPlayblack()
	if err != nil {
		panic(err)
	}

	var completedData *media.CompletedData
	session.Pipeline(WithSynthesis(svc)).
		Output(playback).
		On(media.Begin, func(event media.StateEvent) {
			session.EmitFrame(session, &media.TextFrame{
				Text: "Say a simple, google, Hello world",
			})
		}).
		On(media.StartPlay, func(event media.StateEvent) {
			started = true
		}).
		On(media.StopPlay, func(event media.StateEvent) {
			stoped = true
			time.AfterFunc(50*time.Millisecond, func() {
				session.Close()
			})
		}).
		On(media.Completed, func(event media.StateEvent) {
			completedData = event.Params[0].(*media.CompletedData)
		})
	session.Serve()

	assert.True(t, started)
	assert.True(t, stoped)
	assert.NotNil(t, completedData)
}

type testSynthesisPlayerHandler struct {
	started       bool
	frameChan     chan *media.AudioFrame
	completedData *media.CompletedData
}

// AddMetric implements pipeline.SessionHandler.
func (t *testSynthesisPlayerHandler) AddMetric(key string, duration time.Duration) {
	panic("unimplemented")
}

// CauseError implements pipeline.SessionHandler.
func (t *testSynthesisPlayerHandler) CauseError(sender any, err error) {
	panic("unimplemented")
}

// EmitFrame implements pipeline.SessionHandler.
func (t *testSynthesisPlayerHandler) EmitFrame(sender any, frame media.Frame) {
	logrus.WithFields(logrus.Fields{
		"sender": sender,
		"frame":  frame,
	}).Info("testSynthesisPlayerHandler: EmitFrame")
	t.frameChan <- frame.(*media.AudioFrame)
}

// EmitState implements pipeline.SessionHandler.
func (t *testSynthesisPlayerHandler) EmitState(sender any, state string, params ...any) {
	logrus.WithFields(logrus.Fields{
		"sender": sender,
		"state":  state,
		"params": params,
	}).Info("testSynthesisPlayerHandler: emit state")
	switch state {
	case media.StartPlay:
		t.started = true
	case media.Completed:
		t.completedData = params[0].(*media.CompletedData)
	}
}

// GetContext implements pipeline.SessionHandler.
func (t *testSynthesisPlayerHandler) GetContext() context.Context {
	//panic("unimplemented")
	return nil
}

// GetSession implements pipeline.SessionHandler.
func (t *testSynthesisPlayerHandler) GetSession() *media.Session {
	//panic("unimplemented")
	return nil
}

// InjectFrame implements pipeline.SessionHandler.
func (t *testSynthesisPlayerHandler) InjectFrame(f media.FilterFunc) {
	//panic("unimplemented")
}

// SendToOutput implements pipeline.SessionHandler.
func (t *testSynthesisPlayerHandler) SendToOutput(sender any, frame media.Frame) {
	//panic("unimplemented")
}

// Metrics functionality removed
func TestSynthesisPlayer(t *testing.T) {
	format := media.StreamFormat{
		SampleRate:    16000,
		BitDepth:      16,
		Channels:      1,
		FrameDuration: 10 * time.Millisecond,
	}
	player := NewSynthesisPlayer("tts.mock", format)

	frameChan := make(chan *media.AudioFrame, 10)
	h := &testSynthesisPlayerHandler{frameChan: frameChan}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go player.Run(h, ctx)
	st := time.Now()
	frame := &media.AudioFrame{
		Payload:      make([]byte, 1024),
		IsFirstFrame: true,
		IsEndFrame:   true,
	}
	player.Emit(h, frame, format.SampleRate)
	frames := make([]*media.AudioFrame, 0)
	tm := time.After(3 * time.Second)

outloop:
	for {
		select {
		case <-tm:
			assert.Fail(t, "timeout")
			break outloop
		case f := <-frameChan:
			frames = append(frames, f)
			if len(frames) >= 4 {
				break outloop
			}
		}
	}

	assert.Equal(t, len(frames), 4)
	assert.Equal(t, len(frames[3].Payload), 64)
	assert.GreaterOrEqual(t, time.Since(st), 4*player.Format.FrameDuration)
	assert.True(t, h.started)
}

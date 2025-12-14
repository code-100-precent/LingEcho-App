package recognizer

import (
	"os"
	"testing"
	"time"

	"github.com/code-100-precent/LingEcho/pkg/media"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
)

func TestQiniuASR_Basic(t *testing.T) {
	apiKey := os.Getenv("QINIU_ASR_API_KEY")
	if apiKey == "" {
		t.Skip("missing QINIU_ASR_API_KEY")
	}

	opt := NewQiniuASROption(apiKey)
	asr := NewQiniuASR(opt)

	asr.Init(func(text string, isLast bool, duration time.Duration, dialogID string) {

	}, func(err error, isFatal bool) {
		logrus.WithError(err).Error("qiniu asr error")
	})

	err := asr.ConnAndReceive("")
	assert.Nil(t, err)
	assert.True(t, asr.Activity())

	// 发送测试音频数据
	testAudio := make([]byte, 640) // 20ms at 16kHz, 16bit, 1ch
	err = asr.SendAudioBytes(testAudio)
	assert.Nil(t, err)

	// 等待识别结果
	time.Sleep(2 * time.Second)

	_ = asr.SendEnd()
	_ = asr.StopConn()

	assert.False(t, asr.Activity())
}

func TestQiniuASR_WithSession(t *testing.T) {
	apiKey := os.Getenv("QINIU_ASR_API_KEY")
	if apiKey == "" {
		t.Skip("missing QINIU_ASR_API_KEY")
	}

	opt := NewQiniuASROption(apiKey)
	opt.SampleRate = 16000
	opt.Channels = 1
	opt.Bits = 16

	session := media.NewDefaultSession()
	defer session.Close()

	result := ""

	// 创建七牛云ASR实例
	asr := NewQiniuASR(opt)
	asr.Init(func(text string, isLast bool, duration time.Duration, dialogID string) {
		logrus.WithFields(logrus.Fields{
			"text":     text,
			"isLast":   isLast,
			"duration": duration,
			"dialogID": dialogID,
		}).Info("qiniu asr result")
		if text != "" && isLast {
			result = text
		}
	}, func(err error, isFatal bool) {
		logrus.WithError(err).Error("qiniu asr error")
	})

	session.On(media.Begin, func(event media.StateEvent) {
		// 读取测试音频文件
		audioData, err := os.ReadFile("../../testdata/asr_demo_zh.pcm")
		if err != nil {
			// 如果没有测试文件，使用模拟音频数据
			audioData = make([]byte, 32000) // 1 second at 16kHz, 16bit, 1ch
		}

		frameSize := media.ComputeSampleByteCount(16000, 16, 1) * 200 // 200ms frames

		for i := 0; i < len(audioData); i += frameSize {
			end := i + frameSize
			if end > len(audioData) {
				end = len(audioData)
			}
			session.EmitFrame(session, &media.AudioFrame{
				Payload: audioData[i:end],
			})
			time.Sleep(50 * time.Millisecond)
		}
	})

	session.On(media.Completed, func(event media.StateEvent) {
		session.Close()
	})

	go func() {
		time.Sleep(10 * time.Second)
		session.Close()
	}()

	session.Serve()

	// 验证识别结果
	assert.NotEmpty(t, result, "应该得到识别结果")
}

func TestQiniuASR_Reconnect(t *testing.T) {
	apiKey := os.Getenv("QINIU_ASR_API_KEY")
	if apiKey == "" {
		t.Skip("missing QINIU_ASR_API_KEY")
	}

	opt := NewQiniuASROption(apiKey)
	asr := NewQiniuASR(opt)

	asr.Init(func(text string, isLast bool, duration time.Duration, dialogID string) {
		logrus.WithFields(logrus.Fields{
			"text":     text,
			"isLast":   isLast,
			"dialogID": dialogID,
		}).Info("qiniu asr result")
	}, func(err error, isFatal bool) {
		logrus.WithError(err).Error("qiniu asr error")
	})

	// 第一次连接
	err := asr.ConnAndReceive("dialog1")
	assert.Nil(t, err)
	assert.True(t, asr.Activity())

	// 发送一些数据
	_ = asr.SendAudioBytes(make([]byte, 640))

	// 断开连接
	_ = asr.StopConn()
	assert.False(t, asr.Activity())

	// 重新连接
	err = asr.ConnAndReceive("dialog2")
	assert.Nil(t, err)
	assert.True(t, asr.Activity())

	// 再次发送数据
	_ = asr.SendAudioBytes(make([]byte, 640))

	_ = asr.StopConn()
}

func TestQiniuASROption_Defaults(t *testing.T) {
	apiKey := "test-api-key"
	opt := NewQiniuASROption(apiKey)

	assert.Equal(t, apiKey, opt.APIKey)
	assert.Equal(t, 16000, opt.SampleRate)
	assert.Equal(t, 1, opt.Channels)
	assert.Equal(t, 16, opt.Bits)
	assert.True(t, opt.EnablePunc)
	assert.Equal(t, 128, opt.ReqChanSize)
}

func TestQiniuASR_WithHotWords(t *testing.T) {
	apiKey := os.Getenv("QINIU_ASR_API_KEY")
	if apiKey == "" {
		t.Skip("missing QINIU_ASR_API_KEY")
	}

	opt := NewQiniuASROption(apiKey)
	opt.HotWords = []HotWord{
		{Word: "测试", Weight: 10},
		{Word: "智能", Weight: 8},
	}

	asr := NewQiniuASR(opt)
	asr.Init(func(text string, isLast bool, duration time.Duration, dialogID string) {
		logrus.WithFields(logrus.Fields{
			"text":     text,
			"isLast":   isLast,
			"duration": duration,
			"dialogID": dialogID,
		}).Info("qiniu asr result with hot words")
	}, func(err error, isFatal bool) {
		logrus.WithError(err).Error("qiniu asr error")
	})

	err := asr.ConnAndReceive("")
	assert.Nil(t, err)

	testAudio := make([]byte, 640)
	_ = asr.SendAudioBytes(testAudio)

	time.Sleep(2 * time.Second)

	_ = asr.StopConn()
}

package emergency

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

type CallTracker struct {
	db *gorm.DB
}

func NewCallTracker(db *gorm.DB) *CallTracker {
	return &CallTracker{db: db}
}

// TrackIncomingCall 追踪来电
func (ct *CallTracker) TrackIncomingCall(callID, callerPhone, callerIP, callerURI string, answered bool) error {
	plans, err := models.GetEnabledEmergencyCallPlans(ct.db)
	if err != nil {
		logrus.WithError(err).Error("获取启用的紧急呼叫方案失败")
		return err
	}

	if len(plans) == 0 {
		return nil
	}

	now := time.Now()
	callerIdentifier := callerPhone
	if callerIdentifier == "" {
		callerIdentifier = callerIP
	}

	for _, plan := range plans {
		if err := ct.trackCallForPlan(&plan, callID, callerPhone, callerIP, callerURI, answered, now, callerIdentifier); err != nil {
			logrus.WithError(err).WithField("plan_id", plan.ID).Error("追踪呼叫失败")
		}
	}

	return nil
}

func (ct *CallTracker) trackCallForPlan(plan *models.EmergencyCallPlan, callID, callerPhone, callerIP, callerURI string, answered bool, now time.Time, callerIdentifier string) error {
	windowStart := now.Add(-time.Duration(plan.TimeWindow) * time.Second)
	
	recentTracks, err := models.GetRecentEmergencyCallTracks(ct.db, plan.ID, callerIdentifier, windowStart)
	if err != nil {
		return err
	}

	missedCount := 0
	if !answered {
		missedCount = 1
	}

	for _, track := range recentTracks {
		if !track.CallAnswered {
			missedCount++
		}
	}

	track := &models.EmergencyCallTrack{
		PlanID:       plan.ID,
		CallerPhone:  callerPhone,
		CallerIP:     callerIP,
		CallerURI:    callerURI,
		CallID:       callID,
		CallTime:     now,
		CallAnswered: answered,
		MissedCount:  missedCount,
	}

	if missedCount == 1 && !answered {
		track.TrackWindowStart = &now
	} else if len(recentTracks) > 0 && recentTracks[0].TrackWindowStart != nil {
		track.TrackWindowStart = recentTracks[0].TrackWindowStart
	}

	if err := models.CreateEmergencyCallTrack(ct.db, track); err != nil {
		return err
	}

	if !answered && missedCount >= plan.MissedCallThreshold {
		logrus.WithFields(logrus.Fields{
			"plan_id":      plan.ID,
			"caller":       callerIdentifier,
			"missed_count": missedCount,
			"threshold":    plan.MissedCallThreshold,
		}).Warn("触发紧急呼叫告警")

		if err := ct.triggerAlarm(plan, track, callerPhone, callerIP, callerURI, missedCount, now); err != nil {
			logrus.WithError(err).Error("触发告警失败")
		}
	}

	return nil
}

func (ct *CallTracker) triggerAlarm(plan *models.EmergencyCallPlan, track *models.EmergencyCallTrack, callerPhone, callerIP, callerURI string, missedCount int, now time.Time) error {
	alarm := &models.EmergencyCallAlarm{
		PlanID:            plan.ID,
		TrackID:           &track.ID,
		CallerPhone:       callerPhone,
		CallerIP:          callerIP,
		CallerURI:         callerURI,
		TriggeredAt:       now,
		MissedCallCount:   missedCount,
		TimeWindowSeconds: plan.TimeWindow,
		Status:            "active",
	}

	if err := models.CreateEmergencyCallAlarm(ct.db, alarm); err != nil {
		return err
	}

	track.AlarmTriggered = true
	track.AlarmTriggeredAt = &now
	if err := models.UpdateEmergencyCallTrack(ct.db, track); err != nil {
		logrus.WithError(err).Error("更新追踪记录失败")
	}

	go ct.playAlarmSound(plan)

	if plan.NotifyWebhook && plan.WebhookURL != "" {
		go ct.sendWebhookNotification(plan, alarm)
	}

	return nil
}

func (ct *CallTracker) playAlarmSound(plan *models.EmergencyCallPlan) {
	if plan.AlarmSoundURL == "" {
		logrus.WithField("plan_id", plan.ID).Warn("未设置闹铃音频")
		return
	}

	soundPath := plan.AlarmSoundURL
	if soundPath[:4] != "http" {
		soundPath = soundPath[len("/api/files/"):]
	}

	if _, err := os.Stat(soundPath); os.IsNotExist(err) {
		logrus.WithError(err).WithField("path", soundPath).Error("闹铃音频文件不存在")
		return
	}

	logrus.WithFields(logrus.Fields{
		"plan_id":  plan.ID,
		"sound":    soundPath,
		"volume":   plan.AlarmVolume,
		"duration": plan.AlarmDuration,
	}).Info("播放紧急呼叫闹铃")

	ext := filepath.Ext(soundPath)
	var player string
	var args []string

	switch ext {
	case ".mp3", ".wav", ".ogg", ".m4a":
		player = "afplay"
		args = []string{soundPath}
	default:
		logrus.WithField("ext", ext).Warn("不支持的音频格式")
		return
	}

	duration := time.Duration(plan.AlarmDuration) * time.Second
	timeout := time.After(duration)

	done := make(chan bool, 1)
	go func() {
		if err := executeCommand(player, args...); err != nil {
			logrus.WithError(err).Error("播放闹铃失败")
		}
		done <- true
	}()

	select {
	case <-done:
		logrus.Info("闹铃播放完成")
	case <-timeout:
		logrus.Info("闹铃播放超时")
	}
}

func (ct *CallTracker) sendWebhookNotification(plan *models.EmergencyCallPlan, alarm *models.EmergencyCallAlarm) {
	payload := map[string]interface{}{
		"event":             "emergency_call_alarm",
		"plan_id":           plan.ID,
		"plan_name":         plan.Name,
		"alarm_id":          alarm.ID,
		"caller_phone":      alarm.CallerPhone,
		"caller_ip":         alarm.CallerIP,
		"caller_uri":        alarm.CallerURI,
		"missed_call_count": alarm.MissedCallCount,
		"time_window":       alarm.TimeWindowSeconds,
		"triggered_at":      alarm.TriggeredAt.Format(time.RFC3339),
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		logrus.WithError(err).Error("序列化webhook数据失败")
		return
	}

	req, err := http.NewRequest("POST", plan.WebhookURL, bytes.NewBuffer(jsonData))
	if err != nil {
		logrus.WithError(err).Error("创建webhook请求失败")
		return
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("User-Agent", "LingEcho-EmergencyCall/1.0")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		logrus.WithError(err).Error("发送webhook失败")
		alarm.WebhookSent = false
		models.UpdateEmergencyCallAlarm(ct.db, alarm)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		logrus.WithField("status", resp.StatusCode).Info("Webhook发送成功")
		alarm.WebhookSent = true
		models.UpdateEmergencyCallAlarm(ct.db, alarm)
	} else {
		logrus.WithField("status", resp.StatusCode).Warn("Webhook返回非成功状态")
		alarm.WebhookSent = false
		models.UpdateEmergencyCallAlarm(ct.db, alarm)
	}
}

func executeCommand(name string, args ...string) error {
	return fmt.Errorf("音频播放功能需要在实际环境中实现")
}

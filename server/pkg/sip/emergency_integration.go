package sip

import (
	"github.com/code-100-precent/LingEcho/pkg/emergency"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

// EmergencyCallIntegration 紧急呼叫集成
type EmergencyCallIntegration struct {
	tracker *emergency.CallTracker
	enabled bool
}

// NewEmergencyCallIntegration 创建紧急呼叫集成
func NewEmergencyCallIntegration(db *gorm.DB) *EmergencyCallIntegration {
	if db == nil {
		return &EmergencyCallIntegration{enabled: false}
	}
	
	return &EmergencyCallIntegration{
		tracker: emergency.NewCallTracker(db),
		enabled: true,
	}
}

// TrackCall 追踪呼叫
func (eci *EmergencyCallIntegration) TrackCall(callID, callerPhone, callerIP, callerURI string, answered bool) {
	if !eci.enabled || eci.tracker == nil {
		return
	}
	
	if err := eci.tracker.TrackIncomingCall(callID, callerPhone, callerIP, callerURI, answered); err != nil {
		logrus.WithError(err).WithField("call_id", callID).Error("紧急呼叫追踪失败")
	}
}

// SetEmergencyCallIntegration 设置紧急呼叫集成到SIP服务器
func (as *SipServer) SetEmergencyCallIntegration(integration *EmergencyCallIntegration) {
	// 这个方法可以在SipServer初始化后调用，用于设置紧急呼叫集成
	// 由于SipServer结构体中没有存储integration的字段，我们需要在需要的地方直接调用
	// 这里只是一个占位方法，实际使用时可以通过全局变量或其他方式传递
}

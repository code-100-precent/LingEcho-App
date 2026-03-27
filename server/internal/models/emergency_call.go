package models

import (
	"time"

	"gorm.io/gorm"
)

// EmergencyCallPlan 紧急呼叫方案
type EmergencyCallPlan struct {
	ID        uint           `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time      `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt time.Time      `json:"updatedAt" gorm:"autoUpdateTime"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`

	Name        string `json:"name" gorm:"size:255;not null"`
	Description string `json:"description,omitempty" gorm:"type:text"`
	Enabled     bool   `json:"enabled" gorm:"default:true"`

	UserID  *uint `json:"userId,omitempty" gorm:"index"`
	User    User  `json:"user,omitempty" gorm:"foreignKey:UserID"`
	GroupID *uint `json:"groupId,omitempty" gorm:"index"`
	Group   Group `json:"group,omitempty" gorm:"foreignKey:GroupID"`

	TimeWindow           int  `json:"timeWindow" gorm:"not null;default:300"`
	MissedCallThreshold  int  `json:"missedCallThreshold" gorm:"not null;default:3"`
	AlarmSoundURL        string `json:"alarmSoundUrl,omitempty" gorm:"size:500"`
	AlarmVolume          int  `json:"alarmVolume" gorm:"default:80"`
	AlarmDuration        int  `json:"alarmDuration" gorm:"default:30"`

	NotifyEmail   bool   `json:"notifyEmail" gorm:"default:false"`
	NotifySMS     bool   `json:"notifySms" gorm:"default:false"`
	NotifyWebhook bool   `json:"notifyWebhook" gorm:"default:false"`
	WebhookURL    string `json:"webhookUrl,omitempty" gorm:"size:500"`

	Metadata string `json:"metadata,omitempty" gorm:"type:text"`
}

// TableName 指定表名
func (EmergencyCallPlan) TableName() string {
	return "emergency_call_plans"
}

// EmergencyCallTrack 紧急呼叫追踪
type EmergencyCallTrack struct {
	ID        uint           `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time      `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt time.Time      `json:"updatedAt" gorm:"autoUpdateTime"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`

	PlanID uint              `json:"planId" gorm:"not null;index"`
	Plan   EmergencyCallPlan `json:"plan,omitempty" gorm:"foreignKey:PlanID"`

	CallerPhone string `json:"callerPhone,omitempty" gorm:"size:128;index"`
	CallerIP    string `json:"callerIp,omitempty" gorm:"size:64;index"`
	CallerURI   string `json:"callerUri,omitempty" gorm:"size:256"`

	CallID       string    `json:"callId,omitempty" gorm:"size:128"`
	CallTime     time.Time `json:"callTime" gorm:"not null;index"`
	CallAnswered bool      `json:"callAnswered" gorm:"default:false"`

	TrackWindowStart *time.Time `json:"trackWindowStart,omitempty"`
	MissedCount      int        `json:"missedCount" gorm:"default:0"`

	AlarmTriggered   bool       `json:"alarmTriggered" gorm:"default:false;index"`
	AlarmTriggeredAt *time.Time `json:"alarmTriggeredAt,omitempty"`

	Metadata string `json:"metadata,omitempty" gorm:"type:text"`
}

// TableName 指定表名
func (EmergencyCallTrack) TableName() string {
	return "emergency_call_tracks"
}

// EmergencyCallAlarm 紧急呼叫告警记录
type EmergencyCallAlarm struct {
	ID        uint           `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time      `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt time.Time      `json:"updatedAt" gorm:"autoUpdateTime"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`

	PlanID  uint              `json:"planId" gorm:"not null;index"`
	Plan    EmergencyCallPlan `json:"plan,omitempty" gorm:"foreignKey:PlanID"`
	TrackID *uint             `json:"trackId,omitempty"`
	Track   EmergencyCallTrack `json:"track,omitempty" gorm:"foreignKey:TrackID"`

	CallerPhone string `json:"callerPhone,omitempty" gorm:"size:128"`
	CallerIP    string `json:"callerIp,omitempty" gorm:"size:64"`
	CallerURI   string `json:"callerUri,omitempty" gorm:"size:256"`

	TriggeredAt       time.Time `json:"triggeredAt" gorm:"not null;index"`
	MissedCallCount   int       `json:"missedCallCount" gorm:"not null"`
	TimeWindowSeconds int       `json:"timeWindowSeconds" gorm:"not null"`

	Status          string     `json:"status" gorm:"size:20;default:'active';index"`
	AcknowledgedAt  *time.Time `json:"acknowledgedAt,omitempty"`
	AcknowledgedBy  *uint      `json:"acknowledgedBy,omitempty"`
	ResolvedAt      *time.Time `json:"resolvedAt,omitempty"`
	ResolvedBy      *uint      `json:"resolvedBy,omitempty"`

	EmailSent   bool `json:"emailSent" gorm:"default:false"`
	SMSSent     bool `json:"smsSent" gorm:"default:false"`
	WebhookSent bool `json:"webhookSent" gorm:"default:false"`

	Notes string `json:"notes,omitempty" gorm:"type:text"`
}

// TableName 指定表名
func (EmergencyCallAlarm) TableName() string {
	return "emergency_call_alarms"
}

// CreateEmergencyCallPlan 创建紧急呼叫方案
func CreateEmergencyCallPlan(db *gorm.DB, plan *EmergencyCallPlan) error {
	return db.Create(plan).Error
}

// GetEmergencyCallPlanByID 根据ID获取紧急呼叫方案
func GetEmergencyCallPlanByID(db *gorm.DB, id uint) (*EmergencyCallPlan, error) {
	var plan EmergencyCallPlan
	err := db.First(&plan, id).Error
	if err != nil {
		return nil, err
	}
	return &plan, nil
}

// GetEmergencyCallPlansByUserID 根据用户ID获取紧急呼叫方案列表
func GetEmergencyCallPlansByUserID(db *gorm.DB, userID uint) ([]EmergencyCallPlan, error) {
	var plans []EmergencyCallPlan
	err := db.Where("user_id = ?", userID).Order("created_at DESC").Find(&plans).Error
	return plans, err
}

// GetEnabledEmergencyCallPlans 获取所有启用的紧急呼叫方案
func GetEnabledEmergencyCallPlans(db *gorm.DB) ([]EmergencyCallPlan, error) {
	var plans []EmergencyCallPlan
	err := db.Where("enabled = ?", true).Find(&plans).Error
	return plans, err
}

// UpdateEmergencyCallPlan 更新紧急呼叫方案
func UpdateEmergencyCallPlan(db *gorm.DB, plan *EmergencyCallPlan) error {
	return db.Save(plan).Error
}

// DeleteEmergencyCallPlan 删除紧急呼叫方案
func DeleteEmergencyCallPlan(db *gorm.DB, id uint) error {
	return db.Delete(&EmergencyCallPlan{}, id).Error
}

// CreateEmergencyCallTrack 创建紧急呼叫追踪记录
func CreateEmergencyCallTrack(db *gorm.DB, track *EmergencyCallTrack) error {
	return db.Create(track).Error
}

// GetRecentEmergencyCallTracks 获取最近的紧急呼叫追踪记录
func GetRecentEmergencyCallTracks(db *gorm.DB, planID uint, callerIdentifier string, since time.Time) ([]EmergencyCallTrack, error) {
	var tracks []EmergencyCallTrack
	query := db.Where("plan_id = ? AND call_time >= ?", planID, since)
	
	if callerIdentifier != "" {
		query = query.Where("caller_phone = ? OR caller_ip = ?", callerIdentifier, callerIdentifier)
	}
	
	err := query.Order("call_time DESC").Find(&tracks).Error
	return tracks, err
}

// UpdateEmergencyCallTrack 更新紧急呼叫追踪记录
func UpdateEmergencyCallTrack(db *gorm.DB, track *EmergencyCallTrack) error {
	return db.Save(track).Error
}

// CreateEmergencyCallAlarm 创建紧急呼叫告警记录
func CreateEmergencyCallAlarm(db *gorm.DB, alarm *EmergencyCallAlarm) error {
	return db.Create(alarm).Error
}

// GetEmergencyCallAlarms 获取紧急呼叫告警记录列表
func GetEmergencyCallAlarms(db *gorm.DB, planID *uint, status string, limit int) ([]EmergencyCallAlarm, error) {
	var alarms []EmergencyCallAlarm
	query := db.Preload("Plan")
	
	if planID != nil {
		query = query.Where("plan_id = ?", *planID)
	}
	
	if status != "" {
		query = query.Where("status = ?", status)
	}
	
	if limit > 0 {
		query = query.Limit(limit)
	}
	
	err := query.Order("triggered_at DESC").Find(&alarms).Error
	return alarms, err
}

// UpdateEmergencyCallAlarm 更新紧急呼叫告警记录
func UpdateEmergencyCallAlarm(db *gorm.DB, alarm *EmergencyCallAlarm) error {
	return db.Save(alarm).Error
}

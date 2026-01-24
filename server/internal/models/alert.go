<<<<<<< HEAD
package models

import (
	"encoding/json"
	"time"
)

// AlertType 告警类型
type AlertType string

const (
	AlertTypeSystemError   AlertType = "system_error"   // 系统异常告警
	AlertTypeQuotaExceeded AlertType = "quota_exceeded" // 配额不足告警
	AlertTypeServiceError  AlertType = "service_error"  // 服务异常告警
	AlertTypeCustom        AlertType = "custom"         // 自定义告警
)

// AlertSeverity 告警严重程度
type AlertSeverity string

const (
	AlertSeverityCritical AlertSeverity = "critical" // 严重
	AlertSeverityHigh     AlertSeverity = "high"     // 高
	AlertSeverityMedium   AlertSeverity = "medium"   // 中
	AlertSeverityLow      AlertSeverity = "low"      // 低
)

// AlertStatus 告警状态
type AlertStatus string

const (
	AlertStatusActive   AlertStatus = "active"   // 活跃
	AlertStatusResolved AlertStatus = "resolved" // 已解决
	AlertStatusMuted    AlertStatus = "muted"    // 已静音
)

// NotificationChannel 通知渠道
type NotificationChannel string

const (
	NotificationChannelEmail    NotificationChannel = "email"    // 邮件
	NotificationChannelInternal NotificationChannel = "internal" // 站内通知
	NotificationChannelWebhook  NotificationChannel = "webhook"  // Webhook
	NotificationChannelSMS      NotificationChannel = "sms"      // 短信（预留）
)

// AlertRule 告警规则
type AlertRule struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt time.Time `json:"updatedAt" gorm:"autoUpdateTime"`

	UserID      uint   `json:"userId" gorm:"index"`                    // 用户ID，0表示系统级规则
	Name        string `json:"name" gorm:"size:200"`                   // 规则名称
	Description string `json:"description,omitempty" gorm:"type:text"` // 规则描述

	// 告警类型和条件
	AlertType AlertType     `json:"alertType" gorm:"size:50;index"` // 告警类型
	Severity  AlertSeverity `json:"severity" gorm:"size:20"`        // 严重程度

	// 触发条件（JSON格式）
	Conditions string `json:"conditions" gorm:"type:text"` // 触发条件，JSON格式

	// 通知配置
	Channels      string `json:"channels" gorm:"type:text"`                             // 通知渠道，JSON数组格式：["email", "internal", "webhook"]
	WebhookURL    string `json:"webhookUrl,omitempty" gorm:"size:500"`                  // Webhook URL
	WebhookMethod string `json:"webhookMethod,omitempty" gorm:"size:10;default:'POST'"` // Webhook 请求方法

	// 状态
	Enabled  bool `json:"enabled" gorm:"default:true"` // 是否启用
	Cooldown int  `json:"cooldown" gorm:"default:300"` // 冷却时间（秒），防止重复告警

	// 统计
	TriggerCount  int64      `json:"triggerCount" gorm:"default:0"` // 触发次数
	LastTriggerAt *time.Time `json:"lastTriggerAt,omitempty"`       // 最后触发时间
}

func (AlertRule) TableName() string {
	return "alert_rules"
}

// AlertCondition 告警条件（用于解析Conditions JSON）
type AlertCondition struct {
	// 配额相关条件
	QuotaType      string  `json:"quotaType,omitempty"`      // 配额类型：storage, llm_tokens, api_calls等
	QuotaThreshold float64 `json:"quotaThreshold,omitempty"` // 配额阈值（百分比，0-100）

	// 系统错误相关条件
	ErrorCount  int `json:"errorCount,omitempty"`  // 错误数量阈值
	ErrorWindow int `json:"errorWindow,omitempty"` // 时间窗口（秒）

	// 服务异常相关条件
	ServiceName  string  `json:"serviceName,omitempty"`  // 服务名称
	FailureRate  float64 `json:"failureRate,omitempty"`  // 失败率阈值（百分比）
	ResponseTime int     `json:"responseTime,omitempty"` // 响应时间阈值（毫秒）

	// 自定义条件
	CustomExpression string `json:"customExpression,omitempty"` // 自定义表达式（预留）
}

// Alert 告警记录
type Alert struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt time.Time `json:"updatedAt" gorm:"autoUpdateTime"`

	UserID uint      `json:"userId" gorm:"index"` // 用户ID
	RuleID uint      `json:"ruleId" gorm:"index"` // 规则ID
	Rule   AlertRule `json:"rule,omitempty" gorm:"foreignKey:RuleID"`

	// 告警信息
	AlertType AlertType     `json:"alertType" gorm:"size:50;index"`
	Severity  AlertSeverity `json:"severity" gorm:"size:20"`
	Title     string        `json:"title" gorm:"size:200"`    // 告警标题
	Message   string        `json:"message" gorm:"type:text"` // 告警消息

	// 告警数据（JSON格式）
	Data string `json:"data,omitempty" gorm:"type:text"` // 告警相关数据，JSON格式

	// 状态
	Status     AlertStatus `json:"status" gorm:"size:20;index;default:'active'"`
	ResolvedAt *time.Time  `json:"resolvedAt,omitempty"` // 解决时间
	ResolvedBy *uint       `json:"resolvedBy,omitempty"` // 解决人ID

	// 通知状态
	Notified   bool       `json:"notified" gorm:"default:false"` // 是否已通知
	NotifiedAt *time.Time `json:"notifiedAt,omitempty"`          // 通知时间
}

func (Alert) TableName() string {
	return "alerts"
}

// AlertNotification 告警通知记录
type AlertNotification struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`

	AlertID uint  `json:"alertId" gorm:"index"` // 告警ID
	Alert   Alert `json:"alert,omitempty" gorm:"foreignKey:AlertID"`

	Channel NotificationChannel `json:"channel" gorm:"size:20"`             // 通知渠道
	Status  string              `json:"status" gorm:"size:20"`              // 通知状态：success, failed
	Message string              `json:"message,omitempty" gorm:"type:text"` // 通知消息或错误信息

	SentAt *time.Time `json:"sentAt,omitempty"` // 发送时间
}

func (AlertNotification) TableName() string {
	return "alert_notifications"
}

// ParseConditions 解析条件JSON
func (r *AlertRule) ParseConditions() (*AlertCondition, error) {
	if r.Conditions == "" {
		return &AlertCondition{}, nil
	}
	var cond AlertCondition
	err := json.Unmarshal([]byte(r.Conditions), &cond)
	return &cond, err
}

// SetConditions 设置条件JSON
func (r *AlertRule) SetConditions(cond *AlertCondition) error {
	data, err := json.Marshal(cond)
	if err != nil {
		return err
	}
	r.Conditions = string(data)
	return nil
}

// GetChannels 获取通知渠道列表
func (r *AlertRule) GetChannels() []NotificationChannel {
	if r.Channels == "" {
		return []NotificationChannel{}
	}
	var channels []NotificationChannel
	json.Unmarshal([]byte(r.Channels), &channels)
	return channels
}

// SetChannels 设置通知渠道列表
func (r *AlertRule) SetChannels(channels []NotificationChannel) error {
	data, err := json.Marshal(channels)
	if err != nil {
		return err
	}
	r.Channels = string(data)
	return nil
}
=======
package models

import (
	"encoding/json"
	"time"
)

// AlertType defines the type of alert
type AlertType string

const (
	AlertTypeSystemError   AlertType = "system_error"   // System error alert
	AlertTypeQuotaExceeded AlertType = "quota_exceeded" // Quota exceeded alert
	AlertTypeServiceError  AlertType = "service_error"  // Service error alert
	AlertTypeCustom        AlertType = "custom"         // Custom alert
)

// AlertSeverity defines the severity level of alert
type AlertSeverity string

const (
	AlertSeverityCritical AlertSeverity = "critical" // Critical
	AlertSeverityHigh     AlertSeverity = "high"     // High
	AlertSeverityMedium   AlertSeverity = "medium"   // Medium
	AlertSeverityLow      AlertSeverity = "low"      // Low
)

// AlertStatus defines the status of alert
type AlertStatus string

const (
	AlertStatusActive   AlertStatus = "active"   // Active
	AlertStatusResolved AlertStatus = "resolved" // Resolved
	AlertStatusMuted    AlertStatus = "muted"    // Muted
)

// NotificationChannel defines the notification channel type
type NotificationChannel string

const (
	NotificationChannelEmail    NotificationChannel = "email"    // Email
	NotificationChannelInternal NotificationChannel = "internal" // Internal notification
	NotificationChannelWebhook  NotificationChannel = "webhook"  // Webhook
	NotificationChannelSMS      NotificationChannel = "sms"      // SMS (reserved)
)

// AlertRule defines alert rule configuration
type AlertRule struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt time.Time `json:"updatedAt" gorm:"autoUpdateTime"`

	UserID      uint   `json:"userId" gorm:"index"`                    // User ID, 0 means system-level rule
	Name        string `json:"name" gorm:"size:200"`                   // Rule name
	Description string `json:"description,omitempty" gorm:"type:text"` // Rule description

	// Alert type and conditions
	AlertType AlertType     `json:"alertType" gorm:"size:50;index"` // Alert type
	Severity  AlertSeverity `json:"severity" gorm:"size:20"`        // Severity level

	// Trigger conditions (JSON format)
	Conditions string `json:"conditions" gorm:"type:text"` // Trigger conditions in JSON format

	// Notification configuration
	Channels      string `json:"channels" gorm:"type:text"`                             // Notification channels in JSON array format: ["email", "internal", "webhook"]
	WebhookURL    string `json:"webhookUrl,omitempty" gorm:"size:500"`                  // Webhook URL
	WebhookMethod string `json:"webhookMethod,omitempty" gorm:"size:10;default:'POST'"` // Webhook request method

	// Status
	Enabled  bool `json:"enabled" gorm:"default:true"` // Whether enabled
	Cooldown int  `json:"cooldown" gorm:"default:300"` // Cooldown time in seconds to prevent duplicate alerts

	// Statistics
	TriggerCount  int64      `json:"triggerCount" gorm:"default:0"` // Trigger count
	LastTriggerAt *time.Time `json:"lastTriggerAt,omitempty"`       // Last trigger time
}

func (AlertRule) TableName() string {
	return "alert_rules"
}

// AlertCondition defines alert condition structure (for parsing Conditions JSON)
type AlertCondition struct {
	// Quota-related conditions
	QuotaType      string  `json:"quotaType,omitempty"`      // Quota type: storage, llm_tokens, api_calls, etc.
	QuotaThreshold float64 `json:"quotaThreshold,omitempty"` // Quota threshold (percentage, 0-100)

	// System error-related conditions
	ErrorCount  int `json:"errorCount,omitempty"`  // Error count threshold
	ErrorWindow int `json:"errorWindow,omitempty"` // Time window in seconds

	// Service error-related conditions
	ServiceName  string  `json:"serviceName,omitempty"`  // Service name
	FailureRate  float64 `json:"failureRate,omitempty"`  // Failure rate threshold (percentage)
	ResponseTime int     `json:"responseTime,omitempty"` // Response time threshold in milliseconds

	// Custom conditions
	CustomExpression string `json:"customExpression,omitempty"` // Custom expression (reserved)
}

// Alert defines alert record
type Alert struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt time.Time `json:"updatedAt" gorm:"autoUpdateTime"`

	UserID uint      `json:"userId" gorm:"index"` // User ID
	RuleID uint      `json:"ruleId" gorm:"index"` // Rule ID
	Rule   AlertRule `json:"rule,omitempty" gorm:"foreignKey:RuleID"`

	// Alert information
	AlertType AlertType     `json:"alertType" gorm:"size:50;index"`
	Severity  AlertSeverity `json:"severity" gorm:"size:20"`
	Title     string        `json:"title" gorm:"size:200"`    // Alert title
	Message   string        `json:"message" gorm:"type:text"` // Alert message

	// Alert data (JSON format)
	Data string `json:"data,omitempty" gorm:"type:text"` // Alert-related data in JSON format

	// Status
	Status     AlertStatus `json:"status" gorm:"size:20;index;default:'active'"`
	ResolvedAt *time.Time  `json:"resolvedAt,omitempty"` // Resolution time
	ResolvedBy *uint       `json:"resolvedBy,omitempty"` // Resolver user ID

	// Notification status
	Notified   bool       `json:"notified" gorm:"default:false"` // Whether notified
	NotifiedAt *time.Time `json:"notifiedAt,omitempty"`          // Notification time
}

func (Alert) TableName() string {
	return "alerts"
}

// AlertNotification defines alert notification record
type AlertNotification struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`

	AlertID uint  `json:"alertId" gorm:"index"` // Alert ID
	Alert   Alert `json:"alert,omitempty" gorm:"foreignKey:AlertID"`

	Channel NotificationChannel `json:"channel" gorm:"size:20"`             // Notification channel
	Status  string              `json:"status" gorm:"size:20"`              // Notification status: success, failed
	Message string              `json:"message,omitempty" gorm:"type:text"` // Notification message or error message

	SentAt *time.Time `json:"sentAt,omitempty"` // Send time
}

func (AlertNotification) TableName() string {
	return "alert_notifications"
}

// ParseConditions parses condition JSON
func (r *AlertRule) ParseConditions() (*AlertCondition, error) {
	if r.Conditions == "" {
		return &AlertCondition{}, nil
	}
	var cond AlertCondition
	err := json.Unmarshal([]byte(r.Conditions), &cond)
	return &cond, err
}

// SetConditions sets condition JSON
func (r *AlertRule) SetConditions(cond *AlertCondition) error {
	data, err := json.Marshal(cond)
	if err != nil {
		return err
	}
	r.Conditions = string(data)
	return nil
}

// GetChannels gets notification channel list
func (r *AlertRule) GetChannels() []NotificationChannel {
	if r.Channels == "" {
		return []NotificationChannel{}
	}
	var channels []NotificationChannel
	json.Unmarshal([]byte(r.Channels), &channels)
	return channels
}

// SetChannels sets notification channel list
func (r *AlertRule) SetChannels(channels []NotificationChannel) error {
	data, err := json.Marshal(channels)
	if err != nil {
		return err
	}
	r.Channels = string(data)
	return nil
}
>>>>>>> 3dfadd85bd518bde3e99c3d51af6bb1fe0a2141c

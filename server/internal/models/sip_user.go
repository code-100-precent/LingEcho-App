package models

import (
	"database/sql/driver"
	"encoding/json"
	"time"

	"gorm.io/gorm"
)

// SipUserStatus SIP用户状态
type SipUserStatus string

const (
	SipUserStatusRegistered   SipUserStatus = "registered"   // 已注册
	SipUserStatusUnregistered SipUserStatus = "unregistered" // 未注册
	SipUserStatusExpired      SipUserStatus = "expired"      // 已过期
)

// RecordingMode 录音模式
type RecordingMode string

const (
	RecordingModeDisabled RecordingMode = "disabled" // 不录音
	RecordingModeFull     RecordingMode = "full"     // 全程录音
	RecordingModeMessage  RecordingMode = "message"  // 仅留言阶段录音
)

// ActivationMode 方案激活模式
type ActivationMode string

const (
	ActivationModeManual ActivationMode = "manual" // 手动激活
	ActivationModeAuto   ActivationMode = "auto"   // 自动根据时间激活
)

// DayType 日期类型
type DayType string

const (
	DayTypeWeekday DayType = "weekday" // 工作日（周一到周五）
	DayTypeWeekend DayType = "weekend" // 休息日（周六周日）
	DayTypeAll     DayType = "all"     // 所有天
)

// TimeSlot 时间段配置
type TimeSlot struct {
	DayType   DayType `json:"dayType"`   // 日期类型：weekday/weekend/all
	StartTime string  `json:"startTime"` // 开始时间，格式 HH:MM，如 "09:00"
	EndTime   string  `json:"endTime"`   // 结束时间，格式 HH:MM，如 "18:00"
}

// TimeSlots 时间段列表（用于 JSON 存储）
type TimeSlots []TimeSlot

// Value 实现 driver.Valuer 接口
func (ts TimeSlots) Value() (driver.Value, error) {
	if ts == nil || len(ts) == 0 {
		return nil, nil
	}
	return json.Marshal(ts)
}

// Scan 实现 sql.Scanner 接口
func (ts *TimeSlots) Scan(value interface{}) error {
	if value == nil {
		*ts = make(TimeSlots, 0)
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return nil
	}
	if len(bytes) == 0 {
		*ts = make(TimeSlots, 0)
		return nil
	}
	return json.Unmarshal(bytes, ts)
}

// KeywordReply 关键词回复配置
type KeywordReply struct {
	Keyword string `json:"keyword"` // 关键词
	Reply   string `json:"reply"`   // 回复内容
}

// KeywordReplies 关键词回复列表（用于 JSON 存储）
type KeywordReplies []KeywordReply

// Value 实现 driver.Valuer 接口
func (kr KeywordReplies) Value() (driver.Value, error) {
	if kr == nil || len(kr) == 0 {
		return nil, nil
	}
	return json.Marshal(kr)
}

// Scan 实现 sql.Scanner 接口
func (kr *KeywordReplies) Scan(value interface{}) error {
	if value == nil {
		*kr = make(KeywordReplies, 0)
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return nil
	}
	if len(bytes) == 0 {
		*kr = make(KeywordReplies, 0)
		return nil
	}
	return json.Unmarshal(bytes, kr)
}

// SipUser SIP用户表（代接方案）
type SipUser struct {
	ID        uint       `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time  `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt time.Time  `json:"updatedAt" gorm:"autoUpdateTime"`
	DeletedAt *time.Time `json:"-" gorm:"index"`

	// ========== 方案基本信息 ==========
	SchemeName  string `json:"schemeName" gorm:"size:128;not null"` // 方案名称（如"工作模式"、"会议中"）
	Description string `json:"description,omitempty" gorm:"type:text"` // 方案描述

	// ========== SIP认证信息 ==========
	Username string `json:"username" gorm:"size:128;uniqueIndex;not null"` // SIP用户名（唯一）
	Password string `json:"-" gorm:"size:128"`                             // SIP密码（可选，用于认证）

	// ========== SIP注册信息 ==========
	Contact     string     `json:"contact,omitempty" gorm:"size:256"`  // Contact地址（完整URI）
	ContactIP   string     `json:"contactIp,omitempty" gorm:"size:64"` // Contact IP地址
	ContactPort int        `json:"contactPort,omitempty"`              // Contact端口
	Expires     int        `json:"expires" gorm:"default:3600"`        // 过期时间（秒）
	ExpiresAt   *time.Time `json:"expiresAt,omitempty"`                // 过期时间点

	// ========== 注册状态 ==========
	Status         SipUserStatus `json:"status" gorm:"size:20;default:'unregistered';index"` // 注册状态
	LastRegister   *time.Time    `json:"lastRegister,omitempty"`                             // 最后注册时间
	LastUnregister *time.Time    `json:"lastUnregister,omitempty"`                           // 最后注销时间

	// ========== 客户端信息 ==========
	UserAgent string `json:"userAgent,omitempty" gorm:"size:256"` // 用户代理（User-Agent）
	RemoteIP  string `json:"remoteIp,omitempty" gorm:"size:64"`   // 远程IP地址

	// ========== 关联信息 ==========
	UserID  *uint `json:"userId,omitempty" gorm:"index"` // 关联到系统用户（可选）
	User    User  `json:"user,omitempty" gorm:"foreignKey:UserID"`
	GroupID *uint `json:"groupId,omitempty" gorm:"index"` // 关联到组织（可选）
	Group   Group `json:"group,omitempty" gorm:"foreignKey:GroupID"`

	// ========== AI 代接配置 ==========
	AssistantID     *uint     `json:"assistantId,omitempty" gorm:"index"`  // 绑定的 AI 助手 ID
	Assistant       Assistant `json:"assistant,omitempty" gorm:"foreignKey:AssistantID"`
	AutoAnswer      bool      `json:"autoAnswer" gorm:"default:false"`     // 是否启用自动接听
	AutoAnswerDelay int       `json:"autoAnswerDelay" gorm:"default:0"`    // 自动接听延迟（秒）

	// ========== AI 回复配置 ==========
	OpeningMessage  string         `json:"openingMessage,omitempty" gorm:"type:text"`  // 开场白（接通后的第一句话）
	KeywordReplies  KeywordReplies `json:"keywordReplies,omitempty" gorm:"type:json"`  // 关键词回复配置
	FallbackMessage string         `json:"fallbackMessage,omitempty" gorm:"type:text"` // 兜底回复（未配置时由AI自由生成）
	AIFreeResponse  bool           `json:"aiFreeResponse" gorm:"default:true"`         // 是否启用AI自由回答

	// ========== 录音配置 ==========
	RecordingEnabled bool          `json:"recordingEnabled" gorm:"default:true"`           // 是否开启录音
	RecordingMode    RecordingMode `json:"recordingMode" gorm:"size:20;default:'full'"`    // 录音模式：full(全程) / message(仅留言)
	RecordingPath    string        `json:"recordingPath,omitempty" gorm:"size:512"`        // 录音文件存储路径模板

	// ========== 留言配置 ==========
	MessageEnabled  bool `json:"messageEnabled" gorm:"default:true"`  // 是否启用留言功能
	MessageDuration int  `json:"messageDuration" gorm:"default:20"`   // 留言时长（秒，默认20秒）
	MessagePrompt   string `json:"messagePrompt,omitempty" gorm:"type:text"` // 留言提示语（如"请在嘀声后留言"）

	// ========== 代接号码 ==========
	BoundPhoneNumber string `json:"boundPhoneNumber,omitempty" gorm:"size:20;index"` // 绑定的手机号（被叫号码）

	// ========== 显示信息 ==========
	DisplayName string `json:"displayName,omitempty" gorm:"size:128"` // 显示名称
	Alias       string `json:"alias,omitempty" gorm:"size:128"`       // 别名

	// ========== 统计信息 ==========
	RegisterCount     int `json:"registerCount" gorm:"default:0"`     // 注册次数
	CallCount         int `json:"callCount" gorm:"default:0"`         // 通话次数
	TotalCallDuration int `json:"totalCallDuration" gorm:"default:0"` // 总通话时长（秒）
	MessageCount      int `json:"messageCount" gorm:"default:0"`      // 留言次数

	// ========== 配置信息 ==========
	Enabled   bool   `json:"enabled" gorm:"default:true"`      // 是否启用
	IsActive  bool   `json:"isActive" gorm:"default:false"`    // 是否为当前激活方案（同一用户只能有一个激活方案）
	Notes     string `json:"notes,omitempty" gorm:"type:text"` // 备注

	// ========== 时间调度配置 ==========
	ActivationMode ActivationMode `json:"activationMode" gorm:"size:20;default:'manual'"` // 激活模式：manual(手动) / auto(自动)
	TimeSlots      TimeSlots      `json:"timeSlots,omitempty" gorm:"type:json"`           // 时间段配置（最多3个）
	Priority       int            `json:"priority" gorm:"default:0"`                      // 优先级（当多个方案时间重叠时使用，数字越大优先级越高）

	// ========== 接通前方案选择 ==========
	EnablePreSelection bool `json:"enablePreSelection" gorm:"default:false"` // 是否启用接通前方案选择（启用后来电时弹窗选择方案，8秒内选择）
}

// TableName 指定表名
func (SipUser) TableName() string {
	return "sip_users"
}

// IsRegistered 检查用户是否已注册
func (su *SipUser) IsRegistered() bool {
	return su.Status == SipUserStatusRegistered
}

// IsExpired 检查注册是否已过期
func (su *SipUser) IsExpired() bool {
	if su.ExpiresAt == nil {
		return false
	}
	return time.Now().After(*su.ExpiresAt)
}

// UpdateExpiresAt 根据Expires字段更新过期时间
func (su *SipUser) UpdateExpiresAt() {
	if su.Expires > 0 {
		expiresAt := time.Now().Add(time.Duration(su.Expires) * time.Second)
		su.ExpiresAt = &expiresAt
	}
}

// IsInTimeSlot 检查当前时间是否在方案的时间段内
func (su *SipUser) IsInTimeSlot(now time.Time) bool {
	if su.ActivationMode != ActivationModeAuto {
		return false
	}

	if len(su.TimeSlots) == 0 {
		return false
	}

	weekday := now.Weekday()
	isWeekday := weekday >= time.Monday && weekday <= time.Friday
	currentTime := now.Format("15:04")

	for _, slot := range su.TimeSlots {
		// 检查日期类型是否匹配
		dayMatch := false
		switch slot.DayType {
		case DayTypeAll:
			dayMatch = true
		case DayTypeWeekday:
			dayMatch = isWeekday
		case DayTypeWeekend:
			dayMatch = !isWeekday
		}

		if !dayMatch {
			continue
		}

		// 检查时间是否在范围内
		if slot.StartTime <= currentTime && currentTime < slot.EndTime {
			return true
		}

		// 处理跨天的情况（如 22:00 - 09:00）
		if slot.StartTime > slot.EndTime {
			if currentTime >= slot.StartTime || currentTime < slot.EndTime {
				return true
			}
		}
	}

	return false
}

// CreateSipUser 创建SIP用户（代接方案）
func CreateSipUser(db *gorm.DB, sipUser *SipUser) error {
	return db.Create(sipUser).Error
}

// GetSipUserByUsername 根据用户名获取SIP用户
func GetSipUserByUsername(db *gorm.DB, username string) (*SipUser, error) {
	var sipUser SipUser
	err := db.Where("username = ?", username).First(&sipUser).Error
	if err != nil {
		return nil, err
	}
	return &sipUser, nil
}

// GetSipUserByID 根据ID获取SIP用户
func GetSipUserByID(db *gorm.DB, id uint) (*SipUser, error) {
	var sipUser SipUser
	err := db.First(&sipUser, id).Error
	if err != nil {
		return nil, err
	}
	return &sipUser, nil
}

// UpdateSipUser 更新SIP用户
func UpdateSipUser(db *gorm.DB, sipUser *SipUser) error {
	return db.Save(sipUser).Error
}

// DeleteSipUser 删除SIP用户（软删除）
func DeleteSipUser(db *gorm.DB, id uint) error {
	return db.Delete(&SipUser{}, id).Error
}

// GetRegisteredSipUsers 获取所有已注册的SIP用户
func GetRegisteredSipUsers(db *gorm.DB) ([]SipUser, error) {
	var sipUsers []SipUser
	err := db.Where("status = ?", SipUserStatusRegistered).Find(&sipUsers).Error
	return sipUsers, err
}

// GetSipUsersByUserID 根据系统用户ID获取SIP用户列表（代接方案列表）
func GetSipUsersByUserID(db *gorm.DB, userID uint) ([]SipUser, error) {
	var sipUsers []SipUser
	err := db.Where("user_id = ?", userID).Find(&sipUsers).Error
	return sipUsers, err
}

// GetActiveSipUserByUserID 获取用户当前激活的代接方案
func GetActiveSipUserByUserID(db *gorm.DB, userID uint) (*SipUser, error) {
	var sipUser SipUser
	err := db.Where("user_id = ? AND is_active = ?", userID, true).First(&sipUser).Error
	if err != nil {
		return nil, err
	}
	return &sipUser, nil
}

// ActivateSipUser 激活指定的代接方案（同时取消其他方案的激活状态）
func ActivateSipUser(db *gorm.DB, userID uint, sipUserID uint) error {
	return db.Transaction(func(tx *gorm.DB) error {
		// 1. 取消该用户所有方案的激活状态
		if err := tx.Model(&SipUser{}).
			Where("user_id = ?", userID).
			Update("is_active", false).Error; err != nil {
			return err
		}

		// 2. 激活指定方案
		if err := tx.Model(&SipUser{}).
			Where("id = ? AND user_id = ?", sipUserID, userID).
			Update("is_active", true).Error; err != nil {
			return err
		}

		return nil
	})
}

// GetSipUsersByGroupID 根据组织ID获取SIP用户列表
func GetSipUsersByGroupID(db *gorm.DB, groupID uint) ([]SipUser, error) {
	var sipUsers []SipUser
	err := db.Where("group_id = ?", groupID).Find(&sipUsers).Error
	return sipUsers, err
}

// GetSipUserByPhoneNumber 根据手机号获取代接方案
func GetSipUserByPhoneNumber(db *gorm.DB, phoneNumber string) (*SipUser, error) {
	var sipUser SipUser
	// 必须同时满足：enabled = true（启用）AND is_active = true（激活）
	err := db.Where("bound_phone_number = ? AND enabled = ? AND is_active = ?", phoneNumber, true, true).First(&sipUser).Error
	if err != nil {
		return nil, err
	}
	return &sipUser, nil
}

// GetAutoActivatableSipUser 根据当前时间获取应该自动激活的方案
// 返回优先级最高且时间匹配的方案
func GetAutoActivatableSipUser(db *gorm.DB, userID uint, now time.Time) (*SipUser, error) {
	var sipUsers []SipUser
	// 获取所有启用的自动激活方案
	err := db.Where("user_id = ? AND enabled = ? AND activation_mode = ?", 
		userID, true, ActivationModeAuto).
		Order("priority DESC").
		Find(&sipUsers).Error
	
	if err != nil {
		return nil, err
	}

	// 找到第一个时间匹配的方案（已按优先级排序）
	for i := range sipUsers {
		if sipUsers[i].IsInTimeSlot(now) {
			return &sipUsers[i], nil
		}
	}

	return nil, gorm.ErrRecordNotFound
}

// AutoSwitchScheme 自动切换方案（根据时间）
func AutoSwitchScheme(db *gorm.DB, userID uint) error {
	now := time.Now()
	
	// 获取当前应该激活的方案
	targetScheme, err := GetAutoActivatableSipUser(db, userID, now)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			// 没有匹配的自动方案，检查是否需要停用当前方案
			currentScheme, err := GetActiveSipUserByUserID(db, userID)
			if err == nil && currentScheme.ActivationMode == ActivationModeAuto {
				// 当前激活的是自动方案，但已不在时间段内，应该停用
				return db.Model(&SipUser{}).
					Where("id = ?", currentScheme.ID).
					Update("is_active", false).Error
			}
			return nil
		}
		return err
	}

	// 获取当前激活的方案
	currentScheme, err := GetActiveSipUserByUserID(db, userID)
	if err != nil && err != gorm.ErrRecordNotFound {
		return err
	}

	// 如果目标方案已经是激活状态，无需切换
	if currentScheme != nil && currentScheme.ID == targetScheme.ID {
		return nil
	}

	// 执行切换
	return ActivateSipUser(db, userID, targetScheme.ID)
}

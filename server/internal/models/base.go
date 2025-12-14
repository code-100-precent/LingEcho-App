package models

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

const (
	GroupRoleAdmin      = "admin"
	GroupRoleMember     = "member"
	SigInitSystemConfig = "system.init"
)

type BaseModel struct {
	ID       uint `gorm:"primaryKey"`
	CreateAt time.Time
	UpdateAt time.Time
	CreateBy string
	UpdateBy string
	Version  int16
	isDel    int8 `gorm:"index"`
}

type UserBasicInfoUpdate struct {
	FatherCallName string `json:"fatherCallName"`
	MotherCallName string `json:"motherCallName"`
	WifiName       string `json:"wifiName"`
	WifiPassword   string `json:"wifiPassword"`
}

type User struct {
	ID        uint       `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time  `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt time.Time  `json:"-" gorm:"autoUpdateTime"`
	DeletedAt *time.Time `json:"-" gorm:"index"`

	Email              string `json:"email" gorm:"size:128;uniqueIndex"`
	EmailNotifications bool   `json:"emailNotifications"`

	Password    string     `json:"-" gorm:"size:128"`
	Phone       string     `json:"phone,omitempty" gorm:"size:64;index"`
	FirstName   string     `json:"firstName,omitempty" gorm:"size:128"`
	LastName    string     `json:"lastName,omitempty" gorm:"size:128"`
	DisplayName string     `json:"displayName,omitempty" gorm:"size:128"`
	IsSuperUser bool       `json:"-"`
	IsStaff     bool       `json:"isStaff,omitempty"`
	Enabled     bool       `json:"-"`
	Activated   bool       `json:"-"`
	LastLogin   *time.Time `json:"lastLogin,omitempty"`
	LastLoginIP string     `json:"-" gorm:"size:128"`

	Source    string `json:"-" gorm:"size:64;index"`
	Locale    string `json:"locale,omitempty" gorm:"size:20"`
	Timezone  string `json:"timezone,omitempty" gorm:"size:200"`
	AuthToken string `json:"token,omitempty" gorm:"-"`

	Avatar       string `json:"avatar,omitempty"`
	Gender       string `json:"gender,omitempty"`
	City         string `json:"city,omitempty"`
	Region       string `json:"region,omitempty"`
	Country      string `json:"country,omitempty"`
	Extra        string `json:"extra,omitempty"`
	PrivateExtra string `json:"privateExtra,omitempty"`

	// New fields for basic information input
	FatherCallName   string `json:"fatherCallName,omitempty" gorm:"size:128"`
	MotherCallName   string `json:"motherCallName,omitempty" gorm:"size:128"`
	WiFiName         string `json:"wifiName,omitempty" gorm:"size:128"`
	WiFiPassword     string `json:"wifiPassword,omitempty" gorm:"size:128"`
	HasFilledDetails bool   `json:"hasFilledDetails"`

	// 新增推送和通知相关字段
	PushNotifications     bool `json:"pushNotifications" gorm:"default:true"`      // 推送通知
	SMSNotifications      bool `json:"smsNotifications" gorm:"default:false"`      // 短信通知
	MarketingEmails       bool `json:"marketingEmails" gorm:"default:false"`       // 营销邮件
	SystemNotifications   bool `json:"systemNotifications" gorm:"default:true"`    // 系统通知
	SecurityAlerts        bool `json:"securityAlerts" gorm:"default:true"`         // 安全警报
	AutoCleanUnreadEmails bool `json:"autoCleanUnreadEmails" gorm:"default:false"` // 自动清理七天未读邮件

	// 新增用户状态和验证相关字段
	EmailVerified        bool       `json:"emailVerified" gorm:"default:false"`    // 邮箱已验证
	PhoneVerified        bool       `json:"phoneVerified" gorm:"default:false"`    // 手机已验证
	TwoFactorEnabled     bool       `json:"twoFactorEnabled" gorm:"default:false"` // 双因素认证
	TwoFactorSecret      string     `json:"-" gorm:"size:128"`                     // 双因素认证密钥
	EmailVerifyToken     string     `json:"-" gorm:"size:128"`                     // 邮箱验证令牌
	PhoneVerifyToken     string     `json:"-" gorm:"size:128"`                     // 手机验证令牌
	PasswordResetToken   string     `json:"-" gorm:"size:128"`                     // 密码重置令牌
	PasswordResetExpires *time.Time `json:"-"`                                     // 密码重置过期时间
	EmailVerifyExpires   *time.Time `json:"-"`                                     // 邮箱验证过期时间

	// 新增用户偏好设置
	Theme      string `json:"theme,omitempty" gorm:"size:20;default:'light'"` // 主题偏好
	Language   string `json:"language,omitempty" gorm:"size:10;default:'zh'"` // 语言偏好
	DateFormat string `json:"dateFormat,omitempty" gorm:"size:20"`            // 日期格式
	TimeFormat string `json:"timeFormat,omitempty" gorm:"size:20"`            // 时间格式
	Currency   string `json:"currency,omitempty" gorm:"size:10"`              // 货币偏好

	// 新增用户统计信息
	LoginCount         int        `json:"loginCount" gorm:"default:0"`      // 登录次数
	LastPasswordChange *time.Time `json:"lastPasswordChange,omitempty"`     // 最后密码修改时间
	ProfileComplete    int        `json:"profileComplete" gorm:"default:0"` // 资料完整度百分比

	// 新增用户角色和权限
	Role        string `json:"role,omitempty" gorm:"size:50;default:'user'"` // 用户角色
	Permissions string `json:"permissions,omitempty" gorm:"type:text"`       // 用户权限JSON
}

// Check BasicInfo
func (u *User) HasBasicInfo() bool {
	return u.HasFilledDetails
}

// ProviderConfig 提供商的灵活配置,支持任意键值对
type ProviderConfig map[string]interface{}

// Value 实现 driver.Valuer 接口
func (pc ProviderConfig) Value() (driver.Value, error) {
	if pc == nil || len(pc) == 0 {
		return nil, nil
	}
	return json.Marshal(pc)
}

// Scan 实现 sql.Scanner 接口
func (pc *ProviderConfig) Scan(value interface{}) error {
	if value == nil {
		*pc = make(ProviderConfig)
		return nil
	}
	bytes, ok := value.([]byte)
	if !ok {
		return fmt.Errorf("failed to convert value to []byte")
	}
	if len(bytes) == 0 {
		*pc = make(ProviderConfig)
		return nil
	}
	return json.Unmarshal(bytes, pc)
}

type UserCredential struct {
	ID        uint   `gorm:"primaryKey" json:"id"`
	UserID    uint   `gorm:"index;" json:"userId"`                                      // 关联到用户
	Name      string `json:"name"`                                                      // 应用名称 or 用途备注
	APIKey    string `gorm:"uniqueIndex:idx_api_key,length:100;not null" json:"apiKey"` // 用于认证
	APISecret string `gorm:"not null" json:"apiSecret"`                                 // 用于签名校验

	// LLM配置 (保持简单,因为OpenAI规范基本通用)
	LLMProvider string `json:"llmProvider"`
	LLMApiKey   string `json:"llmApiKey"`
	LLMApiURL   string `json:"llmApiUrl"`

	// ASR配置 - 使用JSON字段存储灵活的配置
	AsrConfig ProviderConfig `json:"asrConfig" gorm:"type:json"`

	// TTS配置 - 使用JSON字段存储灵活的配置
	TtsConfig ProviderConfig `json:"ttsConfig" gorm:"type:json"`

	CreatedAt time.Time `gorm:"autoCreateTime" json:"created_at"`
	UpdatedAt time.Time `gorm:"autoUpdateTime" json:"updated_at"`
}

// GetASRProvider 从AsrConfig获取provider
func (uc *UserCredential) GetASRProvider() string {
	if uc.AsrConfig != nil {
		if provider, ok := uc.AsrConfig["provider"].(string); ok {
			return provider
		}
	}
	return ""
}

// GetASRConfig 获取ASR配置值
func (uc *UserCredential) GetASRConfig(key string) interface{} {
	if uc.AsrConfig != nil {
		return uc.AsrConfig[key]
	}
	return nil
}

// GetASRConfigString 获取ASR配置字符串值
func (uc *UserCredential) GetASRConfigString(key string) string {
	if uc.AsrConfig != nil {
		if val, ok := uc.AsrConfig[key].(string); ok {
			return val
		}
	}
	return ""
}

// GetTTSProvider 从TtsConfig获取provider
func (uc *UserCredential) GetTTSProvider() string {
	if uc.TtsConfig != nil {
		if provider, ok := uc.TtsConfig["provider"].(string); ok {
			return provider
		}
	}
	return ""
}

// GetTTSConfig 获取TTS配置值
func (uc *UserCredential) GetTTSConfig(key string) interface{} {
	if uc.TtsConfig != nil {
		return uc.TtsConfig[key]
	}
	return nil
}

// GetTTSConfigString 获取TTS配置字符串值
func (uc *UserCredential) GetTTSConfigString(key string) string {
	if uc.TtsConfig != nil {
		if val, ok := uc.TtsConfig[key].(string); ok {
			return val
		}
	}
	return ""
}

type GroupPermission struct {
	Permissions []string
}

type Group struct {
	ID         uint            `json:"id" gorm:"primaryKey"`
	CreatedAt  time.Time       `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt  time.Time       `json:"updatedAt" gorm:"autoUpdateTime"`
	Name       string          `json:"name" gorm:"size:200"`
	Type       string          `json:"type" gorm:"size:24;index"`
	Extra      string          `json:"extra,omitempty"`
	Avatar     string          `json:"avatar,omitempty" gorm:"size:500"` // 组织头像URL
	Permission GroupPermission `json:"permission,omitempty" gorm:"type:json"`
	CreatorID  uint            `json:"creatorId" gorm:"index"`
	Creator    User            `json:"creator,omitempty" gorm:"foreignKey:CreatorID"`
}

// 实现 driver.Valuer 接口
func (gp GroupPermission) Value() (driver.Value, error) {
	return json.Marshal(gp)
}

// 实现 sql.Scanner 接口
func (gp *GroupPermission) Scan(value interface{}) error {
	bytes, ok := value.([]byte)
	if !ok {
		return fmt.Errorf("failed to convert value to []byte")
	}
	return json.Unmarshal(bytes, gp)
}

type GroupMember struct {
	ID        uint      `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time `json:"createdAt" gorm:"autoCreateTime"`
	UserID    uint      `json:"userId" gorm:"index"`
	User      User      `json:"user" gorm:"foreignKey:UserID"`
	GroupID   uint      `json:"groupId" gorm:"index"`
	Group     Group     `json:"group,omitempty" gorm:"foreignKey:GroupID"`
	Role      string    `json:"role" gorm:"size:60;index"`
}

// GroupInvitation 组织邀请
type GroupInvitation struct {
	ID        uint       `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time  `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt time.Time  `json:"updatedAt" gorm:"autoUpdateTime"`
	GroupID   uint       `json:"groupId" gorm:"index"`
	Group     Group      `json:"group,omitempty" gorm:"foreignKey:GroupID"`
	InviterID uint       `json:"inviterId" gorm:"index"`
	Inviter   User       `json:"inviter,omitempty" gorm:"foreignKey:InviterID"`
	InviteeID uint       `json:"inviteeId" gorm:"index"`
	Invitee   User       `json:"invitee,omitempty" gorm:"foreignKey:InviteeID"`
	Status    string     `json:"status" gorm:"size:20;index;default:'pending'"` // pending, accepted, rejected
	ExpiresAt *time.Time `json:"expiresAt,omitempty"`
}

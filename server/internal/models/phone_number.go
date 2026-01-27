package models

import (
	"time"

	"gorm.io/gorm"
)

// PhoneNumberStatus 号码状态
type PhoneNumberStatus string

const (
	PhoneNumberStatusActive   PhoneNumberStatus = "active"   // 激活
	PhoneNumberStatusInactive PhoneNumberStatus = "inactive" // 未激活
	PhoneNumberStatusVerifying PhoneNumberStatus = "verifying" // 验证中
	PhoneNumberStatusSuspended PhoneNumberStatus = "suspended" // 暂停
)

// CallForwardStatus 呼叫转移状态
type CallForwardStatus string

const (
	CallForwardStatusEnabled  CallForwardStatus = "enabled"  // 已启用
	CallForwardStatusDisabled CallForwardStatus = "disabled" // 未启用
	CallForwardStatusUnknown  CallForwardStatus = "unknown"  // 未知
)

// PhoneNumber 号码管理表
type PhoneNumber struct {
	ID        uint       `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time  `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt time.Time  `json:"updatedAt" gorm:"autoUpdateTime"`
	DeletedAt *time.Time `json:"-" gorm:"index"`

	// 关联信息
	UserID  uint `json:"userId" gorm:"index;not null"`           // 用户ID
	User    User `json:"user,omitempty" gorm:"foreignKey:UserID"`
	GroupID *uint `json:"groupId,omitempty" gorm:"index"`         // 组织ID（可选）
	Group   Group `json:"group,omitempty" gorm:"foreignKey:GroupID"`

	// 号码信息
	PhoneNumber string `json:"phoneNumber" gorm:"size:20;index;not null"` // 手机号码
	CountryCode string `json:"countryCode" gorm:"size:10;default:'+86'"`  // 国家代码
	Carrier     string `json:"carrier,omitempty" gorm:"size:64"`          // 运营商（移动、联通、电信）
	Location    string `json:"location,omitempty" gorm:"size:256"`        // 归属地

	// 号码别名和备注
	Alias       string `json:"alias,omitempty" gorm:"size:128"`    // 别名
	Description string `json:"description,omitempty" gorm:"type:text"` // 描述

	// 状态信息
	Status       PhoneNumberStatus `json:"status" gorm:"size:20;default:'inactive';index"` // 号码状态
	IsVerified   bool              `json:"isVerified" gorm:"default:false"`                 // 是否已验证
	VerifiedAt   *time.Time        `json:"verifiedAt,omitempty"`                            // 验证时间
	IsPrimary    bool              `json:"isPrimary" gorm:"default:false;index"`            // 是否为主号码

	// 呼叫转移配置
	CallForwardEnabled bool              `json:"callForwardEnabled" gorm:"default:false"`        // 是否启用呼叫转移
	CallForwardStatus  CallForwardStatus `json:"callForwardStatus" gorm:"size:20;default:'unknown'"` // 呼叫转移状态
	CallForwardNumber  string            `json:"callForwardNumber,omitempty" gorm:"size:20"`     // 转移目标号码
	CallForwardSetAt   *time.Time        `json:"callForwardSetAt,omitempty"`                     // 转移设置时间

	// 绑定的代接方案
	ActiveSchemeID *uint    `json:"activeSchemeId,omitempty" gorm:"index"` // 当前激活的代接方案ID
	ActiveScheme   *SipUser `json:"activeScheme,omitempty" gorm:"foreignKey:ActiveSchemeID"`

	// 统计信息
	TotalCalls     int `json:"totalCalls" gorm:"default:0"`     // 总通话次数
	TotalVoicemails int `json:"totalVoicemails" gorm:"default:0"` // 总留言次数
	LastCallAt     *time.Time `json:"lastCallAt,omitempty"`      // 最后通话时间

	// 元数据
	Metadata string `json:"metadata,omitempty" gorm:"type:text"` // JSON格式的额外信息
	Notes    string `json:"notes,omitempty" gorm:"type:text"`    // 备注
}

// TableName 指定表名
func (PhoneNumber) TableName() string {
	return "phone_numbers"
}

// CreatePhoneNumber 创建号码记录
func CreatePhoneNumber(db *gorm.DB, phoneNumber *PhoneNumber) error {
	return db.Create(phoneNumber).Error
}

// GetPhoneNumberByID 根据ID获取号码
func GetPhoneNumberByID(db *gorm.DB, id uint) (*PhoneNumber, error) {
	var phoneNumber PhoneNumber
	err := db.Preload("User").Preload("ActiveScheme").First(&phoneNumber, id).Error
	if err != nil {
		return nil, err
	}
	return &phoneNumber, nil
}

// GetPhoneNumberByNumber 根据号码获取记录
func GetPhoneNumberByNumber(db *gorm.DB, userID uint, number string) (*PhoneNumber, error) {
	var phoneNumber PhoneNumber
	err := db.Where("user_id = ? AND phone_number = ?", userID, number).
		Preload("ActiveScheme").
		First(&phoneNumber).Error
	if err != nil {
		return nil, err
	}
	return &phoneNumber, nil
}

// GetPhoneNumbersByUserID 获取用户的号码列表
func GetPhoneNumbersByUserID(db *gorm.DB, userID uint) ([]PhoneNumber, error) {
	var phoneNumbers []PhoneNumber
	err := db.Where("user_id = ?", userID).
		Order("is_primary DESC, created_at DESC").
		Preload("ActiveScheme").
		Find(&phoneNumbers).Error
	return phoneNumbers, err
}

// GetPrimaryPhoneNumber 获取用户的主号码
func GetPrimaryPhoneNumber(db *gorm.DB, userID uint) (*PhoneNumber, error) {
	var phoneNumber PhoneNumber
	err := db.Where("user_id = ? AND is_primary = ?", userID, true).
		Preload("ActiveScheme").
		First(&phoneNumber).Error
	if err != nil {
		return nil, err
	}
	return &phoneNumber, nil
}

// UpdatePhoneNumber 更新号码
func UpdatePhoneNumber(db *gorm.DB, phoneNumber *PhoneNumber) error {
	return db.Save(phoneNumber).Error
}

// DeletePhoneNumber 删除号码（软删除）
func DeletePhoneNumber(db *gorm.DB, id uint) error {
	return db.Delete(&PhoneNumber{}, id).Error
}

// SetPrimaryPhoneNumber 设置主号码（同时取消其他号码的主号码状态）
func SetPrimaryPhoneNumber(db *gorm.DB, userID uint, phoneNumberID uint) error {
	return db.Transaction(func(tx *gorm.DB) error {
		// 1. 取消该用户所有号码的主号码状态
		if err := tx.Model(&PhoneNumber{}).
			Where("user_id = ?", userID).
			Update("is_primary", false).Error; err != nil {
			return err
		}

		// 2. 设置指定号码为主号码
		if err := tx.Model(&PhoneNumber{}).
			Where("id = ? AND user_id = ?", phoneNumberID, userID).
			Update("is_primary", true).Error; err != nil {
			return err
		}

		return nil
	})
}

// BindSchemeToPhoneNumber 绑定代接方案到号码
func BindSchemeToPhoneNumber(db *gorm.DB, phoneNumberID uint, schemeID uint) error {
	return db.Model(&PhoneNumber{}).
		Where("id = ?", phoneNumberID).
		Update("active_scheme_id", schemeID).Error
}

// UnbindSchemeFromPhoneNumber 解绑号码的代接方案
func UnbindSchemeFromPhoneNumber(db *gorm.DB, phoneNumberID uint) error {
	return db.Model(&PhoneNumber{}).
		Where("id = ?", phoneNumberID).
		Update("active_scheme_id", nil).Error
}

// UpdateCallForwardStatus 更新呼叫转移状态
func UpdateCallForwardStatus(db *gorm.DB, phoneNumberID uint, enabled bool, status CallForwardStatus) error {
	now := time.Now()
	updates := map[string]interface{}{
		"call_forward_enabled": enabled,
		"call_forward_status":  status,
	}
	if enabled {
		updates["call_forward_set_at"] = now
	}
	return db.Model(&PhoneNumber{}).
		Where("id = ?", phoneNumberID).
		Updates(updates).Error
}

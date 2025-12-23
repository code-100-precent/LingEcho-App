package models

import (
	"time"

	"gorm.io/gorm"
)

// 注意：此文件中的函数不应导入 utils 包，以避免循环导入

// UserDevice 用户设备表
type UserDevice struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	UserID     uint      `gorm:"index;not null" json:"userId"`
	DeviceID   string    `gorm:"size:128;index;not null" json:"deviceId"` // 设备唯一标识
	DeviceName string    `gorm:"size:128" json:"deviceName"`              // 设备名称
	DeviceType string    `gorm:"size:64" json:"deviceType"`               // 设备类型：desktop, mobile, tablet, web
	OS         string    `gorm:"size:64" json:"os"`                       // 操作系统
	Browser    string    `gorm:"size:64" json:"browser"`                  // 浏览器
	UserAgent  string    `gorm:"type:text" json:"userAgent"`              // 完整User-Agent
	IPAddress  string    `gorm:"size:128;index" json:"ipAddress"`         // IP地址
	Location   string    `gorm:"size:256" json:"location"`                // 地理位置（城市、国家）
	IsTrusted  bool      `gorm:"default:false" json:"isTrusted"`          // 是否信任设备
	IsActive   bool      `gorm:"default:true" json:"isActive"`            // 是否激活
	LastUsedAt time.Time `gorm:"index" json:"lastUsedAt"`                 // 最后使用时间
	CreatedAt  time.Time `json:"createdAt"`
	UpdatedAt  time.Time `json:"updatedAt"`
}

// TableName 指定表名
func (UserDevice) TableName() string {
	return "user_devices"
}

// LoginHistory 登录历史记录表（用于异地登录检测）
type LoginHistory struct {
	ID            uint      `gorm:"primaryKey" json:"id"`
	UserID        uint      `gorm:"index;not null" json:"userId"`
	Email         string    `gorm:"size:128;index" json:"email"`             // 登录邮箱
	IPAddress     string    `gorm:"size:128;index" json:"ipAddress"`         // IP地址
	Location      string    `gorm:"size:256" json:"location"`                // 地理位置
	Country       string    `gorm:"size:64" json:"country"`                  // 国家
	City          string    `gorm:"size:128" json:"city"`                    // 城市
	UserAgent     string    `gorm:"type:text" json:"userAgent"`              // User-Agent
	DeviceID      string    `gorm:"size:128;index" json:"deviceId"`          // 设备ID
	LoginType     string    `gorm:"size:32" json:"loginType"`                // 登录类型：password, email, token
	Success       bool      `gorm:"index" json:"success"`                    // 是否成功
	FailureReason string    `gorm:"size:256" json:"failureReason"`           // 失败原因
	IsSuspicious  bool      `gorm:"default:false;index" json:"isSuspicious"` // 是否可疑（异地登录等）
	CreatedAt     time.Time `gorm:"index" json:"createdAt"`
}

// TableName 指定表名
func (LoginHistory) TableName() string {
	return "login_histories"
}

// AccountLock 账号锁定记录
type AccountLock struct {
	ID             uint      `gorm:"primaryKey" json:"id"`
	UserID         uint      `gorm:"index;not null" json:"userId"`
	Email          string    `gorm:"size:128;index;not null" json:"email"` // 邮箱（用于未登录时的锁定）
	IPAddress      string    `gorm:"size:128;index" json:"ipAddress"`      // 锁定IP
	LockedAt       time.Time `gorm:"index" json:"lockedAt"`                // 锁定时间
	UnlockAt       time.Time `gorm:"index" json:"unlockAt"`                // 解锁时间
	Reason         string    `gorm:"size:256" json:"reason"`               // 锁定原因
	FailedAttempts int       `gorm:"default:0" json:"failedAttempts"`      // 失败次数
	IsActive       bool      `gorm:"default:true;index" json:"isActive"`   // 是否激活
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

// TableName 指定表名
func (AccountLock) TableName() string {
	return "account_locks"
}

// IsLocked 检查账号是否被锁定
func (al *AccountLock) IsLocked() bool {
	if !al.IsActive {
		return false
	}
	return time.Now().Before(al.UnlockAt)
}

// CreateOrUpdateAccountLock 创建或更新账号锁定记录
func CreateOrUpdateAccountLock(db *gorm.DB, email string, userID uint, ipAddress string, failedAttempts int) (*AccountLock, error) {
	var lock AccountLock

	// 查找现有锁定记录
	query := db.Where("email = ? AND is_active = ?", email, true)
	if userID > 0 {
		query = query.Or("user_id = ? AND is_active = ?", userID, true)
	}

	err := query.First(&lock).Error

	lockTime := 30 * time.Minute // 锁定30分钟

	if err == gorm.ErrRecordNotFound {
		// 创建新锁定记录
		lock = AccountLock{
			Email:          email,
			UserID:         userID,
			IPAddress:      ipAddress,
			LockedAt:       time.Now(),
			UnlockAt:       time.Now().Add(lockTime),
			FailedAttempts: failedAttempts,
			Reason:         "Too many failed login attempts",
			IsActive:       true,
		}
		err = db.Create(&lock).Error
	} else if err == nil {
		// 更新现有锁定记录
		lock.FailedAttempts = failedAttempts
		lock.UnlockAt = time.Now().Add(lockTime)
		lock.IPAddress = ipAddress
		lock.UpdatedAt = time.Now()
		err = db.Save(&lock).Error
	}

	return &lock, err
}

// GetAccountLock 获取账号锁定记录
func GetAccountLock(db *gorm.DB, email string, userID uint) (*AccountLock, error) {
	var lock AccountLock

	query := db.Where("is_active = ?", true)
	if email != "" {
		query = query.Where("email = ?", email)
	}
	if userID > 0 {
		query = query.Where("user_id = ?", userID)
	}

	err := query.First(&lock).Error
	if err == gorm.ErrRecordNotFound {
		return nil, nil
	}

	return &lock, err
}

// UnlockAccount 解锁账号
func UnlockAccount(db *gorm.DB, email string, userID uint) error {
	query := db.Model(&AccountLock{}).Where("is_active = ?", true)
	if email != "" {
		query = query.Where("email = ?", email)
	}
	if userID > 0 {
		query = query.Where("user_id = ?", userID)
	}

	return query.Update("is_active", false).Error
}

// RecordLoginHistory 记录登录历史
func RecordLoginHistory(db *gorm.DB, userID uint, email, ipAddress, location, country, city, userAgent, deviceID, loginType string, success bool, failureReason string, isSuspicious bool) error {
	history := LoginHistory{
		UserID:        userID,
		Email:         email,
		IPAddress:     ipAddress,
		Location:      location,
		Country:       country,
		City:          city,
		UserAgent:     userAgent,
		DeviceID:      deviceID,
		LoginType:     loginType,
		Success:       success,
		FailureReason: failureReason,
		IsSuspicious:  isSuspicious,
	}

	return db.Create(&history).Error
}

// GetRecentLoginLocations 获取最近的登录位置（用于异地登录检测）
func GetRecentLoginLocations(db *gorm.DB, userID uint, limit int) ([]LoginHistory, error) {
	var histories []LoginHistory
	err := db.Where("user_id = ? AND success = ?", userID, true).
		Order("created_at DESC").
		Limit(limit).
		Find(&histories).Error
	return histories, err
}

// CreateOrUpdateUserDevice 创建或更新用户设备
func CreateOrUpdateUserDevice(db *gorm.DB, userID uint, deviceID, deviceName, deviceType, os, browser, userAgent, ipAddress, location string) (*UserDevice, error) {
	var device UserDevice

	err := db.Where("user_id = ? AND device_id = ?", userID, deviceID).First(&device).Error

	if err == gorm.ErrRecordNotFound {
		// 创建新设备
		device = UserDevice{
			UserID:     userID,
			DeviceID:   deviceID,
			DeviceName: deviceName,
			DeviceType: deviceType,
			OS:         os,
			Browser:    browser,
			UserAgent:  userAgent,
			IPAddress:  ipAddress,
			Location:   location,
			IsTrusted:  false, // 新设备默认不信任
			IsActive:   true,
			LastUsedAt: time.Now(),
		}
		err = db.Create(&device).Error
	} else if err == nil {
		// 更新现有设备
		device.DeviceName = deviceName
		device.OS = os
		device.Browser = browser
		device.UserAgent = userAgent
		device.IPAddress = ipAddress
		device.Location = location
		device.LastUsedAt = time.Now()
		device.UpdatedAt = time.Now()
		err = db.Save(&device).Error
	}

	return &device, err
}

// GetUserDevices 获取用户的所有设备
func GetUserDevices(db *gorm.DB, userID uint) ([]UserDevice, error) {
	var devices []UserDevice
	err := db.Where("user_id = ? AND is_active = ?", userID, true).
		Order("last_used_at DESC").
		Find(&devices).Error
	return devices, err
}

// DeleteUserDevice 删除用户设备
func DeleteUserDevice(db *gorm.DB, userID uint, deviceID string) error {
	return db.Where("user_id = ? AND device_id = ?", userID, deviceID).
		Update("is_active", false).Error
}

// TrustUserDevice 信任设备
func TrustUserDevice(db *gorm.DB, userID uint, deviceID string) error {
	return db.Model(&UserDevice{}).
		Where("user_id = ? AND device_id = ?", userID, deviceID).
		Update("is_trusted", true).Error
}

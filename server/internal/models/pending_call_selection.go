package models

import (
	"time"

	"gorm.io/gorm"
)

// PendingCallSelection 待选择方案的来电记录
type PendingCallSelection struct {
	ID        uint       `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time  `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt time.Time  `json:"updatedAt" gorm:"autoUpdateTime"`
	DeletedAt *time.Time `json:"-" gorm:"index"`

	// 来电信息
	CallID       string `json:"callId" gorm:"size:128;uniqueIndex;not null"` // SIP Call-ID
	CallerNumber string `json:"callerNumber" gorm:"size:64"`                 // 主叫号码
	CalledNumber string `json:"calledNumber" gorm:"size:64;index"`           // 被叫号码
	CallerIP     string `json:"callerIp,omitempty" gorm:"size:64"`           // 主叫IP
	CallerURI    string `json:"callerUri,omitempty" gorm:"size:256"`         // 主叫URI

	// 用户信息
	UserID uint `json:"userId" gorm:"index;not null"` // 用户ID
	User   User `json:"user,omitempty" gorm:"foreignKey:UserID"`

	// 选择状态
	Status         string     `json:"status" gorm:"size:20;default:'pending';index"` // pending(等待选择) / selected(已选择) / timeout(超时) / cancelled(已取消)
	SelectedSchemeID *uint    `json:"selectedSchemeId,omitempty" gorm:"index"`       // 选择的方案ID
	SelectedScheme   *SipUser `json:"selectedScheme,omitempty" gorm:"foreignKey:SelectedSchemeID"`
	SelectTimeout    time.Time `json:"selectTimeout" gorm:"not null"` // 选择超时时间（8秒后）
	SelectedAt       *time.Time `json:"selectedAt,omitempty"`          // 选择时间

	// 可用方案列表（JSON格式存储方案ID列表）
	AvailableSchemeIDs string `json:"availableSchemeIds,omitempty" gorm:"type:text"` // 可选方案ID列表，JSON数组格式

	// 元数据
	Metadata string `json:"metadata,omitempty" gorm:"type:text"` // JSON格式的额外信息
}

// TableName 指定表名
func (PendingCallSelection) TableName() string {
	return "pending_call_selections"
}

// IsTimeout 检查是否已超时
func (pcs *PendingCallSelection) IsTimeout() bool {
	return time.Now().After(pcs.SelectTimeout)
}

// CreatePendingCallSelection 创建待选择记录
func CreatePendingCallSelection(db *gorm.DB, selection *PendingCallSelection) error {
	return db.Create(selection).Error
}

// GetPendingCallSelectionByCallID 根据CallID获取待选择记录
func GetPendingCallSelectionByCallID(db *gorm.DB, callID string) (*PendingCallSelection, error) {
	var selection PendingCallSelection
	err := db.Where("call_id = ?", callID).
		Preload("User").
		Preload("SelectedScheme").
		First(&selection).Error
	if err != nil {
		return nil, err
	}
	return &selection, nil
}

// GetPendingCallSelectionsByUserID 获取用户的待选择记录列表
func GetPendingCallSelectionsByUserID(db *gorm.DB, userID uint, status string) ([]PendingCallSelection, error) {
	var selections []PendingCallSelection
	query := db.Where("user_id = ?", userID)
	if status != "" {
		query = query.Where("status = ?", status)
	}
	err := query.Order("created_at DESC").
		Preload("SelectedScheme").
		Find(&selections).Error
	return selections, err
}

// GetPendingCallSelectionByID 根据ID获取待选择记录
func GetPendingCallSelectionByID(db *gorm.DB, id uint) (*PendingCallSelection, error) {
	var selection PendingCallSelection
	err := db.First(&selection, id).Error
	if err != nil {
		return nil, err
	}
	return &selection, nil
}

// UpdatePendingCallSelection 更新待选择记录
func UpdatePendingCallSelection(db *gorm.DB, selection *PendingCallSelection) error {
	return db.Save(selection).Error
}

// UpdatePendingCallSelectionStatus 更新待选择记录状态
func UpdatePendingCallSelectionStatus(db *gorm.DB, id uint, status string) error {
	return db.Model(&PendingCallSelection{}).
		Where("id = ?", id).
		Update("status", status).Error
}

// SelectSchemeForCall 为来电选择方案
func SelectSchemeForCall(db *gorm.DB, callID string, schemeID uint) error {
	now := time.Now()
	return db.Model(&PendingCallSelection{}).
		Where("call_id = ? AND status = ?", callID, "pending").
		Updates(map[string]interface{}{
			"selected_scheme_id": schemeID,
			"status":             "selected",
			"selected_at":        now,
		}).Error
}

// TimeoutPendingCallSelection 超时处理
func TimeoutPendingCallSelection(db *gorm.DB, callID string) error {
	return db.Model(&PendingCallSelection{}).
		Where("call_id = ? AND status = ?", callID, "pending").
		Update("status", "timeout").Error
}

// CancelPendingCallSelection 取消待选择
func CancelPendingCallSelection(db *gorm.DB, callID string) error {
	return db.Model(&PendingCallSelection{}).
		Where("call_id = ? AND status = ?", callID, "pending").
		Update("status", "cancelled").Error
}

// CleanupExpiredPendingSelections 清理过期的待选择记录（超过1小时的）
func CleanupExpiredPendingSelections(db *gorm.DB) error {
	oneHourAgo := time.Now().Add(-1 * time.Hour)
	return db.Where("created_at < ? AND status IN (?)", oneHourAgo, []string{"pending", "timeout", "cancelled"}).
		Delete(&PendingCallSelection{}).Error
}

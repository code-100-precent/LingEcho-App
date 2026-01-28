package models

import (
	"time"

	"gorm.io/gorm"
)

// VoicemailStatus 留言状态
type VoicemailStatus string

const (
	VoicemailStatusNew       VoicemailStatus = "new"        // 新留言（未读）
	VoicemailStatusRead      VoicemailStatus = "read"       // 已读
	VoicemailStatusArchived  VoicemailStatus = "archived"   // 已归档
	VoicemailStatusDeleted   VoicemailStatus = "deleted"    // 已删除
)

// Voicemail 留言表
type Voicemail struct {
	ID        uint       `json:"id" gorm:"primaryKey"`
	CreatedAt time.Time  `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt time.Time  `json:"updatedAt" gorm:"autoUpdateTime"`
	DeletedAt *time.Time `json:"-" gorm:"index"`

	// 关联信息
	UserID      uint     `json:"userId" gorm:"index;not null"`                // 用户ID
	User        User     `json:"user,omitempty" gorm:"foreignKey:UserID"`
	SipUserID   *uint    `json:"sipUserId,omitempty" gorm:"index"`            // 代接方案ID
	SipUser     SipUser  `json:"sipUser,omitempty" gorm:"foreignKey:SipUserID"`
	SipCallID   *uint    `json:"sipCallId,omitempty" gorm:"index"`            // 通话记录ID
	SipCall     SipCall  `json:"sipCall,omitempty" gorm:"foreignKey:SipCallID"`

	// 来电信息
	CallerNumber   string `json:"callerNumber" gorm:"size:20;index"`          // 来电号码
	CallerName     string `json:"callerName,omitempty" gorm:"size:128"`       // 来电人姓名（如果有）
	CallerLocation string `json:"callerLocation,omitempty" gorm:"size:256"`   // 来电归属地

	// 留言音频信息
	AudioPath      string `json:"audioPath" gorm:"size:512;not null"`         // 音频文件路径
	AudioURL       string `json:"audioUrl,omitempty" gorm:"size:1024"`        // 音频URL（用于播放）
	AudioFormat    string `json:"audioFormat" gorm:"size:16;default:'wav'"`   // 音频格式
	AudioSize      int64  `json:"audioSize" gorm:"default:0"`                 // 文件大小（字节）
	Duration       int    `json:"duration" gorm:"default:0"`                  // 留言时长（秒）
	SampleRate     int    `json:"sampleRate" gorm:"default:8000"`             // 采样率
	Channels       int    `json:"channels" gorm:"default:1"`                  // 声道数

	// 留言内容
	TranscribedText string `json:"transcribedText,omitempty" gorm:"type:text"` // 语音转文字结果
	Summary         string `json:"summary,omitempty" gorm:"type:text"`         // AI生成的摘要
	Keywords        string `json:"keywords,omitempty" gorm:"type:text"`        // 关键词（JSON数组）

	// 状态信息
	Status         VoicemailStatus `json:"status" gorm:"size:20;default:'new';index"` // 留言状态
	IsRead         bool            `json:"isRead" gorm:"default:false;index"`          // 是否已读
	IsImportant    bool            `json:"isImportant" gorm:"default:false;index"`     // 是否重要
	ReadAt         *time.Time      `json:"readAt,omitempty"`                           // 阅读时间

	// 转录和分析状态
	TranscribeStatus string     `json:"transcribeStatus" gorm:"size:32;default:'pending';index"` // 转录状态: pending, processing, completed, failed
	TranscribeError  string     `json:"transcribeError,omitempty" gorm:"type:text"`              // 转录错误信息
	TranscribedAt    *time.Time `json:"transcribedAt,omitempty"`                                 // 转录完成时间

	// 元数据
	Metadata string `json:"metadata,omitempty" gorm:"type:text"` // JSON格式的额外信息
	Notes    string `json:"notes,omitempty" gorm:"type:text"`    // 备注
}

// TableName 指定表名
func (Voicemail) TableName() string {
	return "voicemails"
}

// CreateVoicemail 创建留言记录
func CreateVoicemail(db *gorm.DB, voicemail *Voicemail) error {
	return db.Create(voicemail).Error
}

// GetVoicemailByID 根据ID获取留言
func GetVoicemailByID(db *gorm.DB, id uint) (*Voicemail, error) {
	var voicemail Voicemail
	err := db.Preload("User").Preload("SipUser").Preload("SipCall").First(&voicemail, id).Error
	if err != nil {
		return nil, err
	}
	return &voicemail, nil
}

// GetVoicemailsByUserID 获取用户的留言列表
func GetVoicemailsByUserID(db *gorm.DB, userID uint, limit, offset int) ([]Voicemail, int64, error) {
	var voicemails []Voicemail
	var total int64

	query := db.Where("user_id = ?", userID)
	query.Model(&Voicemail{}).Count(&total)

	err := query.Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Preload("SipUser").
		Preload("SipCall").
		Find(&voicemails).Error

	return voicemails, total, err
}

// GetUnreadVoicemailsCount 获取未读留言数量
func GetUnreadVoicemailsCount(db *gorm.DB, userID uint) (int64, error) {
	var count int64
	err := db.Model(&Voicemail{}).
		Where("user_id = ? AND is_read = ?", userID, false).
		Count(&count).Error
	return count, err
}

// MarkVoicemailAsRead 标记留言为已读
func MarkVoicemailAsRead(db *gorm.DB, id uint) error {
	now := time.Now()
	return db.Model(&Voicemail{}).
		Where("id = ?", id).
		Updates(map[string]interface{}{
			"is_read":  true,
			"status":   VoicemailStatusRead,
			"read_at":  now,
		}).Error
}

// UpdateVoicemail 更新留言
func UpdateVoicemail(db *gorm.DB, voicemail *Voicemail) error {
	return db.Save(voicemail).Error
}

// DeleteVoicemail 删除留言（软删除）
func DeleteVoicemail(db *gorm.DB, id uint) error {
	return db.Delete(&Voicemail{}, id).Error
}

// GetVoicemailsByStatus 根据状态获取留言列表
func GetVoicemailsByStatus(db *gorm.DB, userID uint, status VoicemailStatus, limit, offset int) ([]Voicemail, int64, error) {
	var voicemails []Voicemail
	var total int64

	query := db.Where("user_id = ? AND status = ?", userID, status)
	query.Model(&Voicemail{}).Count(&total)

	err := query.Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Preload("SipUser").
		Preload("SipCall").
		Find(&voicemails).Error

	return voicemails, total, err
}

// GetVoicemailsByCallerNumber 根据来电号码获取留言列表
func GetVoicemailsByCallerNumber(db *gorm.DB, userID uint, callerNumber string, limit, offset int) ([]Voicemail, int64, error) {
	var voicemails []Voicemail
	var total int64

	query := db.Where("user_id = ? AND caller_number = ?", userID, callerNumber)
	query.Model(&Voicemail{}).Count(&total)

	err := query.Order("created_at DESC").
		Limit(limit).
		Offset(offset).
		Preload("SipUser").
		Preload("SipCall").
		Find(&voicemails).Error

	return voicemails, total, err
}

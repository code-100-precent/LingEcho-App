package models

import "gorm.io/gorm"

// GetCallRecordingsByUser 获取用户的所有通话录音列表
func GetCallRecordingsByUser(db *gorm.DB, userID uint, limit, offset int) ([]CallRecording, int64, error) {
	var recordings []CallRecording
	var total int64

	query := db.Where("user_id = ?", userID)

	// 获取总数
	if err := query.Model(&CallRecording{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	// 获取分页数据
	err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&recordings).Error

	return recordings, total, err
}

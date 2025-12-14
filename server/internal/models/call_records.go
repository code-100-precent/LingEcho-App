package models

import (
	"time"

	"gorm.io/gorm"
)

// CallRecord 通话记录模型（用于 SIP/Voice Server）
type CallRecord struct {
	ID           int64          `json:"id" gorm:"primaryKey;autoIncrement"`
	SessionID    string         `json:"sessionId" gorm:"uniqueIndex;size:200"`
	Caller       string         `json:"caller" gorm:"size:200"`
	Callee       string         `json:"callee" gorm:"size:200"`
	ProjectID    string         `json:"projectId" gorm:"size:100;index"`
	ScriptID     string         `json:"scriptId" gorm:"size:200;index"`
	StartedAt    time.Time      `json:"startedAt" gorm:"index"`
	EndedAt      *time.Time     `json:"endedAt,omitempty"`
	DurationSec  int64          `json:"durationSec,omitempty"`
	Status       string         `json:"status" gorm:"size:50;index"`
	HangupReason string         `json:"hangupReason,omitempty" gorm:"size:500"`
	CreatedAt    time.Time      `json:"createdAt"`
	UpdatedAt    time.Time      `json:"updatedAt"`
	DeletedAt    gorm.DeletedAt `json:"deletedAt,omitempty" gorm:"index"`
}

func (CallRecord) TableName() string {
	return "call_records"
}

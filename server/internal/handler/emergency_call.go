package handlers

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/code-100-precent/LingEcho/pkg/response"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

type EmergencyCallHandler struct {
	db *gorm.DB
}

func NewEmergencyCallHandler(db *gorm.DB) *EmergencyCallHandler {
	return &EmergencyCallHandler{db: db}
}

// CreateEmergencyCallPlanRequest 创建紧急呼叫方案请求
type CreateEmergencyCallPlanRequest struct {
	Name                string `json:"name" binding:"required"`
	Description         string `json:"description"`
	Enabled             *bool  `json:"enabled"`
	TimeWindow          int    `json:"timeWindow" binding:"required,min=60"`
	MissedCallThreshold int    `json:"missedCallThreshold" binding:"required,min=1"`
	AlarmVolume         int    `json:"alarmVolume" binding:"min=0,max=100"`
	AlarmDuration       int    `json:"alarmDuration" binding:"min=1"`
	NotifyEmail         bool   `json:"notifyEmail"`
	NotifySMS           bool   `json:"notifySms"`
	NotifyWebhook       bool   `json:"notifyWebhook"`
	WebhookURL          string `json:"webhookUrl"`
}

// UpdateEmergencyCallPlanRequest 更新紧急呼叫方案请求
type UpdateEmergencyCallPlanRequest struct {
	Name                *string `json:"name"`
	Description         *string `json:"description"`
	Enabled             *bool   `json:"enabled"`
	TimeWindow          *int    `json:"timeWindow"`
	MissedCallThreshold *int    `json:"missedCallThreshold"`
	AlarmVolume         *int    `json:"alarmVolume"`
	AlarmDuration       *int    `json:"alarmDuration"`
	NotifyEmail         *bool   `json:"notifyEmail"`
	NotifySMS           *bool   `json:"notifySms"`
	NotifyWebhook       *bool   `json:"notifyWebhook"`
	WebhookURL          *string `json:"webhookUrl"`
}

// CreateEmergencyCallPlan 创建紧急呼叫方案
func (h *EmergencyCallHandler) CreateEmergencyCallPlan(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", nil)
		return
	}

	var req CreateEmergencyCallPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "请求参数错误: "+err.Error(), nil)
		return
	}

	enabled := true
	if req.Enabled != nil {
		enabled = *req.Enabled
	}

	if req.AlarmVolume == 0 {
		req.AlarmVolume = 80
	}
	if req.AlarmDuration == 0 {
		req.AlarmDuration = 30
	}

	plan := &models.EmergencyCallPlan{
		Name:                req.Name,
		Description:         req.Description,
		Enabled:             enabled,
		UserID:              &user.ID,
		TimeWindow:          req.TimeWindow,
		MissedCallThreshold: req.MissedCallThreshold,
		AlarmVolume:         req.AlarmVolume,
		AlarmDuration:       req.AlarmDuration,
		NotifyEmail:         req.NotifyEmail,
		NotifySMS:           req.NotifySMS,
		NotifyWebhook:       req.NotifyWebhook,
		WebhookURL:          req.WebhookURL,
	}

	if err := models.CreateEmergencyCallPlan(h.db, plan); err != nil {
		logrus.WithError(err).Error("创建紧急呼叫方案失败")
		response.Fail(c, "创建失败: "+err.Error(), nil)
		return
	}

	response.Success(c, "创建成功", plan)
}

// ListEmergencyCallPlans 获取紧急呼叫方案列表
func (h *EmergencyCallHandler) ListEmergencyCallPlans(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", nil)
		return
	}

	plans, err := models.GetEmergencyCallPlansByUserID(h.db, user.ID)
	if err != nil {
		logrus.WithError(err).Error("获取紧急呼叫方案列表失败")
		response.Fail(c, "获取失败: "+err.Error(), nil)
		return
	}

	response.Success(c, "获取成功", plans)
}

// GetEmergencyCallPlan 获取紧急呼叫方案详情
func (h *EmergencyCallHandler) GetEmergencyCallPlan(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", nil)
		return
	}

	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.Fail(c, "无效的ID", nil)
		return
	}

	plan, err := models.GetEmergencyCallPlanByID(h.db, uint(id))
	if err != nil {
		response.Fail(c, "方案不存在", nil)
		return
	}

	if plan.UserID == nil || *plan.UserID != user.ID {
		response.Fail(c, "无权访问此方案", nil)
		return
	}

	response.Success(c, "获取成功", plan)
}

// UpdateEmergencyCallPlan 更新紧急呼叫方案
func (h *EmergencyCallHandler) UpdateEmergencyCallPlan(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", nil)
		return
	}

	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.Fail(c, "无效的ID", nil)
		return
	}

	plan, err := models.GetEmergencyCallPlanByID(h.db, uint(id))
	if err != nil {
		response.Fail(c, "方案不存在", nil)
		return
	}

	if plan.UserID == nil || *plan.UserID != user.ID {
		response.Fail(c, "无权访问此方案", nil)
		return
	}

	var req UpdateEmergencyCallPlanRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "请求参数错误: "+err.Error(), nil)
		return
	}

	if req.Name != nil {
		plan.Name = *req.Name
	}
	if req.Description != nil {
		plan.Description = *req.Description
	}
	if req.Enabled != nil {
		plan.Enabled = *req.Enabled
	}
	if req.TimeWindow != nil {
		plan.TimeWindow = *req.TimeWindow
	}
	if req.MissedCallThreshold != nil {
		plan.MissedCallThreshold = *req.MissedCallThreshold
	}
	if req.AlarmVolume != nil {
		plan.AlarmVolume = *req.AlarmVolume
	}
	if req.AlarmDuration != nil {
		plan.AlarmDuration = *req.AlarmDuration
	}
	if req.NotifyEmail != nil {
		plan.NotifyEmail = *req.NotifyEmail
	}
	if req.NotifySMS != nil {
		plan.NotifySMS = *req.NotifySMS
	}
	if req.NotifyWebhook != nil {
		plan.NotifyWebhook = *req.NotifyWebhook
	}
	if req.WebhookURL != nil {
		plan.WebhookURL = *req.WebhookURL
	}

	if err := models.UpdateEmergencyCallPlan(h.db, plan); err != nil {
		logrus.WithError(err).Error("更新紧急呼叫方案失败")
		response.Fail(c, "更新失败: "+err.Error(), nil)
		return
	}

	response.Success(c, "更新成功", plan)
}

// DeleteEmergencyCallPlan 删除紧急呼叫方案
func (h *EmergencyCallHandler) DeleteEmergencyCallPlan(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", nil)
		return
	}

	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.Fail(c, "无效的ID", nil)
		return
	}

	plan, err := models.GetEmergencyCallPlanByID(h.db, uint(id))
	if err != nil {
		response.Fail(c, "方案不存在", nil)
		return
	}

	if plan.UserID == nil || *plan.UserID != user.ID {
		response.Fail(c, "无权访问此方案", nil)
		return
	}

	if err := models.DeleteEmergencyCallPlan(h.db, uint(id)); err != nil {
		logrus.WithError(err).Error("删除紧急呼叫方案失败")
		response.Fail(c, "删除失败: "+err.Error(), nil)
		return
	}

	response.Success(c, "删除成功", nil)
}

// UploadAlarmSound 上传闹铃音频文件
func (h *EmergencyCallHandler) UploadAlarmSound(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", nil)
		return
	}

	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.Fail(c, "无效的ID", nil)
		return
	}

	plan, err := models.GetEmergencyCallPlanByID(h.db, uint(id))
	if err != nil {
		response.Fail(c, "方案不存在", nil)
		return
	}

	if plan.UserID == nil || *plan.UserID != user.ID {
		response.Fail(c, "无权访问此方案", nil)
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		response.Fail(c, "文件上传失败: "+err.Error(), nil)
		return
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	allowedExts := map[string]bool{".mp3": true, ".wav": true, ".ogg": true, ".m4a": true}
	if !allowedExts[ext] {
		response.Fail(c, "不支持的文件格式，仅支持 mp3, wav, ogg, m4a", nil)
		return
	}

	if file.Size > 10*1024*1024 {
		response.Fail(c, "文件大小不能超过10MB", nil)
		return
	}

	uploadDir := "uploads/emergency_alarms"
	if err := os.MkdirAll(uploadDir, 0755); err != nil {
		logrus.WithError(err).Error("创建上传目录失败")
		response.Fail(c, "创建上传目录失败", nil)
		return
	}

	filename := fmt.Sprintf("alarm_%d_%d%s", plan.ID, time.Now().Unix(), ext)
	filepath := filepath.Join(uploadDir, filename)

	if err := c.SaveUploadedFile(file, filepath); err != nil {
		logrus.WithError(err).Error("保存文件失败")
		response.Fail(c, "保存文件失败: "+err.Error(), nil)
		return
	}

	oldSoundURL := plan.AlarmSoundURL
	plan.AlarmSoundURL = "/api/files/" + filepath

	if err := models.UpdateEmergencyCallPlan(h.db, plan); err != nil {
		logrus.WithError(err).Error("更新方案失败")
		os.Remove(filepath)
		response.Fail(c, "更新方案失败: "+err.Error(), nil)
		return
	}

	if oldSoundURL != "" {
		oldPath := strings.TrimPrefix(oldSoundURL, "/api/files/")
		if _, err := os.Stat(oldPath); err == nil {
			os.Remove(oldPath)
		}
	}

	response.Success(c, "上传成功", gin.H{
		"url": plan.AlarmSoundURL,
	})
}

// GetEmergencyCallAlarms 获取紧急呼叫告警列表
func (h *EmergencyCallHandler) GetEmergencyCallAlarms(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", nil)
		return
	}

	status := c.Query("status")
	limitStr := c.DefaultQuery("limit", "50")
	limit, _ := strconv.Atoi(limitStr)

	var planID *uint
	if planIDStr := c.Query("planId"); planIDStr != "" {
		if id, err := strconv.ParseUint(planIDStr, 10, 32); err == nil {
			planIDUint := uint(id)
			planID = &planIDUint
		}
	}

	alarms, err := models.GetEmergencyCallAlarms(h.db, planID, status, limit)
	if err != nil {
		logrus.WithError(err).Error("获取告警列表失败")
		response.Fail(c, "获取失败: "+err.Error(), nil)
		return
	}

	filteredAlarms := []models.EmergencyCallAlarm{}
	for _, alarm := range alarms {
		if alarm.Plan.UserID != nil && *alarm.Plan.UserID == user.ID {
			filteredAlarms = append(filteredAlarms, alarm)
		}
	}

	response.Success(c, "获取成功", filteredAlarms)
}

// AcknowledgeEmergencyCallAlarm 确认紧急呼叫告警
func (h *EmergencyCallHandler) AcknowledgeEmergencyCallAlarm(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", nil)
		return
	}

	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.Fail(c, "无效的ID", nil)
		return
	}

	var alarm models.EmergencyCallAlarm
	if err := h.db.Preload("Plan").First(&alarm, id).Error; err != nil {
		response.Fail(c, "告警不存在", nil)
		return
	}

	if alarm.Plan.UserID == nil || *alarm.Plan.UserID != user.ID {
		response.Fail(c, "无权访问此告警", nil)
		return
	}

	now := time.Now()
	alarm.Status = "acknowledged"
	alarm.AcknowledgedAt = &now
	alarm.AcknowledgedBy = &user.ID

	if err := models.UpdateEmergencyCallAlarm(h.db, &alarm); err != nil {
		logrus.WithError(err).Error("确认告警失败")
		response.Fail(c, "确认失败: "+err.Error(), nil)
		return
	}

	response.Success(c, "确认成功", alarm)
}

// ResolveEmergencyCallAlarm 解决紧急呼叫告警
func (h *EmergencyCallHandler) ResolveEmergencyCallAlarm(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", nil)
		return
	}

	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		response.Fail(c, "无效的ID", nil)
		return
	}

	var alarm models.EmergencyCallAlarm
	if err := h.db.Preload("Plan").First(&alarm, id).Error; err != nil {
		response.Fail(c, "告警不存在", nil)
		return
	}

	if alarm.Plan.UserID == nil || *alarm.Plan.UserID != user.ID {
		response.Fail(c, "无权访问此告警", nil)
		return
	}

	now := time.Now()
	alarm.Status = "resolved"
	alarm.ResolvedAt = &now
	alarm.ResolvedBy = &user.ID

	if err := models.UpdateEmergencyCallAlarm(h.db, &alarm); err != nil {
		logrus.WithError(err).Error("解决告警失败")
		response.Fail(c, "解决失败: "+err.Error(), nil)
		return
	}

	response.Success(c, "解决成功", alarm)
}

// ServeAlarmSound 提供闹铃音频文件
func (h *EmergencyCallHandler) ServeAlarmSound(c *gin.Context) {
	filepath := c.Param("filepath")
	filepath = strings.TrimPrefix(filepath, "/")
	
	fullPath := "uploads/emergency_alarms/" + filepath
	
	if _, err := os.Stat(fullPath); os.IsNotExist(err) {
		c.Status(404)
		return
	}

	file, err := os.Open(fullPath)
	if err != nil {
		c.Status(500)
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath[strings.LastIndex(filepath, "."):])
	contentType := "audio/mpeg"
	switch ext {
	case ".wav":
		contentType = "audio/wav"
	case ".ogg":
		contentType = "audio/ogg"
	case ".m4a":
		contentType = "audio/mp4"
	}

	c.Header("Content-Type", contentType)
	c.Header("Content-Disposition", "inline")
	
	io.Copy(c.Writer, file)
}

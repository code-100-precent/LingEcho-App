package handlers

import (
	"errors"
	"strconv"
	"time"

	"github.com/code-100-precent/LingEcho/internal/models"
	apperrors "github.com/code-100-precent/LingEcho/pkg/errors"
	"github.com/code-100-precent/LingEcho/pkg/response"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// CreateAlertRuleRequest Create alert rule request
type CreateAlertRuleRequest struct {
	Name          string                       `json:"name" binding:"required"`
	Description   string                       `json:"description"`
	AlertType     models.AlertType             `json:"alertType" binding:"required"`
	Severity      models.AlertSeverity         `json:"severity" binding:"required"`
	Conditions    *models.AlertCondition       `json:"conditions" binding:"required"`
	Channels      []models.NotificationChannel `json:"channels" binding:"required"`
	WebhookURL    string                       `json:"webhookUrl"`
	WebhookMethod string                       `json:"webhookMethod"`
	Cooldown      int                          `json:"cooldown"`
	Enabled       bool                         `json:"enabled"`
}

// UpdateAlertRuleRequest Update alert rule request
type UpdateAlertRuleRequest struct {
	Name          *string                       `json:"name"`
	Description   *string                       `json:"description"`
	Severity      *models.AlertSeverity         `json:"severity"`
	Conditions    *models.AlertCondition        `json:"conditions"`
	Channels      *[]models.NotificationChannel `json:"channels"`
	WebhookURL    *string                       `json:"webhookUrl"`
	WebhookMethod *string                       `json:"webhookMethod"`
	Cooldown      *int                          `json:"cooldown"`
	Enabled       *bool                         `json:"enabled"`
}

// CreateAlertRule Create alert rule
func (h *Handlers) CreateAlertRule(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		apperrors.HandleError(c, apperrors.NewUnauthorizedError("user_not_logged_in"))
		return
	}

	var req CreateAlertRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apperrors.HandleError(c, apperrors.NewParameterError("request_body", "invalid_json").WithCause(err))
		return
	}

	// Validate alert type
	switch req.AlertType {
	case models.AlertTypeSystemError, models.AlertTypeQuotaExceeded, models.AlertTypeServiceError, models.AlertTypeCustom:
		// Valid type
	default:
		apperrors.HandleError(c, apperrors.NewParameterError("alert_type", "invalid_value"))
		return
	}

	// Validate severity
	switch req.Severity {
	case models.AlertSeverityCritical, models.AlertSeverityHigh, models.AlertSeverityMedium, models.AlertSeverityLow:
		// Valid severity
	default:
		apperrors.HandleError(c, apperrors.NewParameterError("severity", "invalid_value"))
		return
	}

	// Validate notification channels
	if len(req.Channels) == 0 {
		apperrors.HandleError(c, apperrors.NewParameterError("channels", "at_least_one_required"))
		return
	}

	for _, channel := range req.Channels {
		switch channel {
		case models.NotificationChannelEmail, models.NotificationChannelInternal, models.NotificationChannelWebhook, models.NotificationChannelSMS:
			// Valid channel
		default:
			apperrors.HandleError(c, apperrors.NewParameterError("channel", "invalid_value"))
			return
		}
	}

	// If using webhook, URL must be provided
	hasWebhook := false
	for _, ch := range req.Channels {
		if ch == models.NotificationChannelWebhook {
			hasWebhook = true
			break
		}
	}
	if hasWebhook && req.WebhookURL == "" {
		apperrors.HandleError(c, apperrors.NewParameterError("webhook_url", "required_when_using_webhook"))
		return
	}

	// Set default values
	if req.Cooldown <= 0 {
		req.Cooldown = 300 // Default 5 minutes
	}
	if req.WebhookMethod == "" {
		req.WebhookMethod = "POST"
	}

	// Create alert rule
	rule := models.AlertRule{
		UserID:        user.ID,
		Name:          req.Name,
		Description:   req.Description,
		AlertType:     req.AlertType,
		Severity:      req.Severity,
		WebhookURL:    req.WebhookURL,
		WebhookMethod: req.WebhookMethod,
		Cooldown:      req.Cooldown,
		Enabled:       req.Enabled,
	}

	// Set conditions
	if err := rule.SetConditions(req.Conditions); err != nil {
		apperrors.HandleError(c, apperrors.NewParameterError("conditions", "invalid_format").WithCause(err))
		return
	}

	// Set notification channels
	if err := rule.SetChannels(req.Channels); err != nil {
		apperrors.HandleError(c, apperrors.NewParameterError("channels", "invalid_format").WithCause(err))
		return
	}

	if err := h.db.Create(&rule).Error; err != nil {
		apperrors.HandleError(c, apperrors.ErrCreateFailedError.WithCause(err))
		return
	}

	response.Success(c, "Alert rule created successfully", rule)
}

// ListAlertRules List alert rules
func (h *Handlers) ListAlertRules(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		apperrors.HandleError(c, apperrors.NewUnauthorizedError("user_not_logged_in"))
		return
	}

	var rules []models.AlertRule
	query := h.db.Where("user_id = ?", user.ID)

	// Optional: Filter by type
	if alertType := c.Query("alertType"); alertType != "" {
		query = query.Where("alert_type = ?", alertType)
	}

	// Optional: Filter by enabled status
	if enabled := c.Query("enabled"); enabled != "" {
		enabledBool := enabled == "true"
		query = query.Where("enabled = ?", enabledBool)
	}

	if err := query.Order("created_at DESC").Find(&rules).Error; err != nil {
		apperrors.HandleError(c, apperrors.ErrQueryFailedError.WithCause(err))
		return
	}

	response.Success(c, "Query successful", rules)
}

// GetAlertRule Get alert rule details
func (h *Handlers) GetAlertRule(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		apperrors.HandleError(c, apperrors.NewUnauthorizedError("user_not_logged_in"))
		return
	}

	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		apperrors.HandleError(c, apperrors.NewParameterError("id", "invalid_format").WithCause(err))
		return
	}

	var rule models.AlertRule
	if err := h.db.Where("id = ? AND user_id = ?", id, user.ID).First(&rule).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			apperrors.HandleError(c, apperrors.NewResourceNotFoundError("alert_rule", strconv.FormatUint(id, 10)))
		} else {
			apperrors.HandleError(c, apperrors.ErrQueryFailedError.WithCause(err))
		}
		return
	}

	response.Success(c, "Query successful", rule)
}

// UpdateAlertRule Update alert rule
func (h *Handlers) UpdateAlertRule(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		apperrors.HandleError(c, apperrors.NewUnauthorizedError("user_not_logged_in"))
		return
	}

	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		apperrors.HandleError(c, apperrors.NewParameterError("id", "invalid_format").WithCause(err))
		return
	}

	var rule models.AlertRule
	if err := h.db.Where("id = ? AND user_id = ?", id, user.ID).First(&rule).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			apperrors.HandleError(c, apperrors.NewResourceNotFoundError("alert_rule", strconv.FormatUint(id, 10)))
		} else {
			apperrors.HandleError(c, apperrors.ErrQueryFailedError.WithCause(err))
		}
		return
	}

	var req UpdateAlertRuleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apperrors.HandleError(c, apperrors.NewParameterError("request_body", "invalid_json").WithCause(err))
		return
	}

	// Update fields
	if req.Name != nil {
		rule.Name = *req.Name
	}
	if req.Description != nil {
		rule.Description = *req.Description
	}
	if req.Severity != nil {
		// Validate severity
		switch *req.Severity {
		case models.AlertSeverityCritical, models.AlertSeverityHigh, models.AlertSeverityMedium, models.AlertSeverityLow:
			rule.Severity = *req.Severity
		default:
			apperrors.HandleError(c, apperrors.NewParameterError("severity", "invalid_value"))
			return
		}
	}
	if req.Conditions != nil {
		if err := rule.SetConditions(req.Conditions); err != nil {
			apperrors.HandleError(c, apperrors.NewParameterError("conditions", "invalid_format").WithCause(err))
			return
		}
	}
	if req.Channels != nil {
		// Validate notification channels
		if len(*req.Channels) == 0 {
			apperrors.HandleError(c, apperrors.NewParameterError("channels", "at_least_one_required"))
			return
		}
		hasWebhook := false
		for _, ch := range *req.Channels {
			if ch == models.NotificationChannelWebhook {
				hasWebhook = true
				break
			}
		}
		if hasWebhook {
			webhookURL := req.WebhookURL
			if webhookURL == nil {
				webhookURL = &rule.WebhookURL
			}
			if webhookURL == nil || *webhookURL == "" {
				apperrors.HandleError(c, apperrors.NewParameterError("webhook_url", "required_when_using_webhook"))
				return
			}
		}
		if err := rule.SetChannels(*req.Channels); err != nil {
			apperrors.HandleError(c, apperrors.NewParameterError("channels", "invalid_format").WithCause(err))
			return
		}
	}
	if req.WebhookURL != nil {
		rule.WebhookURL = *req.WebhookURL
	}
	if req.WebhookMethod != nil {
		rule.WebhookMethod = *req.WebhookMethod
	}
	if req.Cooldown != nil {
		if *req.Cooldown <= 0 {
			apperrors.HandleError(c, apperrors.NewParameterError("cooldown", "must_be_greater_than_zero"))
			return
		}
		rule.Cooldown = *req.Cooldown
	}
	if req.Enabled != nil {
		rule.Enabled = *req.Enabled
	}

	if err := h.db.Save(&rule).Error; err != nil {
		apperrors.HandleError(c, apperrors.ErrUpdateFailedError.WithCause(err))
		return
	}

	response.Success(c, "Update successful", rule)
}

// DeleteAlertRule Delete alert rule
func (h *Handlers) DeleteAlertRule(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		apperrors.HandleError(c, apperrors.NewUnauthorizedError("user_not_logged_in"))
		return
	}

	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		apperrors.HandleError(c, apperrors.NewParameterError("id", "invalid_format").WithCause(err))
		return
	}

	// Check if rule exists and belongs to current user
	var rule models.AlertRule
	if err := h.db.Where("id = ? AND user_id = ?", id, user.ID).First(&rule).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			apperrors.HandleError(c, apperrors.NewResourceNotFoundError("alert_rule", strconv.FormatUint(id, 10)))
		} else {
			apperrors.HandleError(c, apperrors.ErrQueryFailedError.WithCause(err))
		}
		return
	}

	// Delete rule
	if err := h.db.Delete(&rule).Error; err != nil {
		apperrors.HandleError(c, apperrors.ErrDeleteFailedError.WithCause(err))
		return
	}

	response.Success(c, "Delete successful", nil)
}

// ListAlerts List alerts
func (h *Handlers) ListAlerts(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		apperrors.HandleError(c, apperrors.NewUnauthorizedError("user_not_logged_in"))
		return
	}

	var alerts []models.Alert
	query := h.db.Where("user_id = ?", user.ID).Preload("Rule")

	// Optional: Filter by status
	if status := c.Query("status"); status != "" {
		query = query.Where("status = ?", status)
	}

	// Optional: Filter by type
	if alertType := c.Query("alertType"); alertType != "" {
		query = query.Where("alert_type = ?", alertType)
	}

	// Pagination
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("pageSize", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	var total int64
	query.Model(&models.Alert{}).Count(&total)

	if err := query.Offset((page - 1) * pageSize).Limit(pageSize).Order("created_at DESC").Find(&alerts).Error; err != nil {
		apperrors.HandleError(c, apperrors.ErrQueryFailedError.WithCause(err))
		return
	}

	response.Success(c, "Query successful", gin.H{
		"list":     alerts,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

// GetAlert Get alert details
func (h *Handlers) GetAlert(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		apperrors.HandleError(c, apperrors.NewUnauthorizedError("user_not_logged_in"))
		return
	}

	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		apperrors.HandleError(c, apperrors.NewParameterError("id", "invalid_format").WithCause(err))
		return
	}

	var alert models.Alert
	if err := h.db.Where("id = ? AND user_id = ?", id, user.ID).Preload("Rule").First(&alert).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			apperrors.HandleError(c, apperrors.NewResourceNotFoundError("alert", strconv.FormatUint(id, 10)))
		} else {
			apperrors.HandleError(c, apperrors.ErrQueryFailedError.WithCause(err))
		}
		return
	}

	// Load notification records
	var notifications []models.AlertNotification
	h.db.Where("alert_id = ?", alert.ID).Order("created_at DESC").Find(&notifications)
	alertData := gin.H{
		"alert":         alert,
		"notifications": notifications,
	}

	response.Success(c, "Query successful", alertData)
}

// ResolveAlert Resolve alert
func (h *Handlers) ResolveAlert(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		apperrors.HandleError(c, apperrors.NewUnauthorizedError("user_not_logged_in"))
		return
	}

	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		apperrors.HandleError(c, apperrors.NewParameterError("id", "invalid_format").WithCause(err))
		return
	}

	var alert models.Alert
	if err := h.db.Where("id = ? AND user_id = ?", id, user.ID).First(&alert).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			apperrors.HandleError(c, apperrors.NewResourceNotFoundError("alert", strconv.FormatUint(id, 10)))
		} else {
			apperrors.HandleError(c, apperrors.ErrQueryFailedError.WithCause(err))
		}
		return
	}

	now := time.Now()
	alert.Status = models.AlertStatusResolved
	alert.ResolvedAt = &now
	alert.ResolvedBy = &user.ID

	if err := h.db.Save(&alert).Error; err != nil {
		apperrors.HandleError(c, apperrors.ErrUpdateFailedError.WithCause(err))
		return
	}

	response.Success(c, "Alert resolved", alert)
}

// MuteAlert Mute alert
func (h *Handlers) MuteAlert(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		apperrors.HandleError(c, apperrors.NewUnauthorizedError("user_not_logged_in"))
		return
	}

	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		apperrors.HandleError(c, apperrors.NewParameterError("id", "invalid_format").WithCause(err))
		return
	}

	var alert models.Alert
	if err := h.db.Where("id = ? AND user_id = ?", id, user.ID).First(&alert).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			apperrors.HandleError(c, apperrors.NewResourceNotFoundError("alert", strconv.FormatUint(id, 10)))
		} else {
			apperrors.HandleError(c, apperrors.ErrQueryFailedError.WithCause(err))
		}
		return
	}

	alert.Status = models.AlertStatusMuted
	if err := h.db.Save(&alert).Error; err != nil {
		apperrors.HandleError(c, apperrors.ErrUpdateFailedError.WithCause(err))
		return
	}

	response.Success(c, "Alert muted", alert)
}

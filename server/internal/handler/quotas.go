package handlers

import (
	"strconv"

	apperrors "github.com/code-100-precent/LingEcho/pkg/errors"

	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// CreateUserQuotaRequest creates user quota request
type CreateUserQuotaRequest struct {
	QuotaType   models.QuotaType   `json:"quotaType" binding:"required"`
	TotalQuota  int64              `json:"totalQuota" binding:"required,min=0"`
	Period      models.QuotaPeriod `json:"period"`
	Description string             `json:"description"`
}

// UpdateUserQuotaRequest updates user quota request
type UpdateUserQuotaRequest struct {
	TotalQuota  *int64              `json:"totalQuota"`
	Period      *models.QuotaPeriod `json:"period"`
	Description *string             `json:"description"`
}

// CreateGroupQuotaRequest creates group quota request
type CreateGroupQuotaRequest struct {
	QuotaType   models.QuotaType   `json:"quotaType" binding:"required"`
	TotalQuota  int64              `json:"totalQuota" binding:"required,min=0"`
	Period      models.QuotaPeriod `json:"period"`
	Description string             `json:"description"`
}

// UpdateGroupQuotaRequest updates group quota request
type UpdateGroupQuotaRequest struct {
	TotalQuota  *int64              `json:"totalQuota"`
	Period      *models.QuotaPeriod `json:"period"`
	Description *string             `json:"description"`
}

// ListUserQuotas gets user quota list
func (h *Handlers) ListUserQuotas(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Unauthorized"))
		return
	}

	var quotas []models.UserQuota
	if err := h.db.Where("user_id = ?", user.ID).Find(&quotas).Error; err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Query failed"))
		return
	}

	// Update usage of all quotas (real-time statistics from UsageRecord table)
	for i := range quotas {
		models.UpdateUserQuotaUsage(h.db, user.ID, quotas[i].QuotaType)
		// Re-fetch updated quota
		updatedQuota, _ := models.GetUserQuota(h.db, user.ID, quotas[i].QuotaType)
		if updatedQuota != nil {
			quotas[i] = *updatedQuota
		}
	}

	apperrors.RespondSuccess(c, quotas)
}

// GetUserQuota gets user quota details
func (h *Handlers) GetUserQuota(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Unauthorized"))
		return
	}

	quotaType := models.QuotaType(c.Param("type"))
	quota, err := models.GetUserQuota(h.db, user.ID, quotaType)
	if err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Query failed"))
		return
	}

	// 更新实际使用量
	models.UpdateUserQuotaUsage(h.db, user.ID, quotaType)
	quota, _ = models.GetUserQuota(h.db, user.ID, quotaType)

	apperrors.RespondSuccess(c, quota)
}

// CreateUserQuota creates user quota
func (h *Handlers) CreateUserQuota(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Unauthorized"))
		return
	}

	var req CreateUserQuotaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Invalid parameters"))
		return
	}

	// 检查是否已存在
	var existing models.UserQuota
	if err := h.db.Where("user_id = ? AND quota_type = ?", user.ID, req.QuotaType).First(&existing).Error; err == nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "配额已存在"))
		return
	}

	quota := models.UserQuota{
		UserID:      user.ID,
		QuotaType:   req.QuotaType,
		TotalQuota:  req.TotalQuota,
		Period:      req.Period,
		Description: req.Description,
	}

	if req.Period == "" {
		quota.Period = models.QuotaPeriodLifetime
	}

	if err := h.db.Create(&quota).Error; err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Creation failed"))
		return
	}

	apperrors.RespondSuccess(c, quota)
}

// UpdateUserQuota updates user quota
func (h *Handlers) UpdateUserQuota(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Unauthorized"))
		return
	}

	quotaType := models.QuotaType(c.Param("type"))
	var quota models.UserQuota
	if err := h.db.Where("user_id = ? AND quota_type = ?", user.ID, quotaType).First(&quota).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "配额不存在"))
		} else {
			apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Query failed"))
		}
		return
	}

	var req UpdateUserQuotaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Invalid parameters"))
		return
	}

	if req.TotalQuota != nil {
		quota.TotalQuota = *req.TotalQuota
	}
	if req.Period != nil {
		quota.Period = *req.Period
	}
	if req.Description != nil {
		quota.Description = *req.Description
	}

	if err := h.db.Save(&quota).Error; err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Update failed"))
		return
	}

	apperrors.RespondSuccess(c, quota)
}

// DeleteUserQuota deletes user quota
func (h *Handlers) DeleteUserQuota(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Unauthorized"))
		return
	}

	quotaType := models.QuotaType(c.Param("type"))
	if err := h.db.Where("user_id = ? AND quota_type = ?", user.ID, quotaType).Delete(&models.UserQuota{}).Error; err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Deletion failed"))
		return
	}

	apperrors.RespondSuccess(c, nil)
}

// ListGroupQuotas gets group quota list
func (h *Handlers) ListGroupQuotas(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Unauthorized"))
		return
	}

	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "参数错误"))
		return
	}

	// 检查权限：只有创建者或管理员可以查看
	var group models.Group
	if err := h.db.First(&group, id).Error; err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "组织不存在"))
		return
	}

	if group.CreatorID != user.ID {
		var member models.GroupMember
		if err := h.db.Where("group_id = ? AND user_id = ? AND role = ?", group.ID, user.ID, models.GroupRoleAdmin).First(&member).Error; err != nil {
			apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "权限不足"))
			return
		}
	}

	var quotas []models.GroupQuota
	if err := h.db.Where("group_id = ?", id).Find(&quotas).Error; err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Query failed"))
		return
	}

	// 更新所有配额的使用量（从 UsageRecord 表实时统计）
	for i := range quotas {
		models.UpdateGroupQuotaUsage(h.db, uint(id), quotas[i].QuotaType)
		// 重新获取更新后的配额
		updatedQuota, _ := models.GetGroupQuota(h.db, uint(id), quotas[i].QuotaType)
		if updatedQuota != nil {
			quotas[i] = *updatedQuota
		}
	}

	apperrors.RespondSuccess(c, quotas)
}

// GetGroupQuota 获取组织配额详情
func (h *Handlers) GetGroupQuota(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Unauthorized"))
		return
	}

	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "参数错误"))
		return
	}

	quotaType := models.QuotaType(c.Param("type"))

	// 检查权限
	var group models.Group
	if err := h.db.First(&group, id).Error; err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "组织不存在"))
		return
	}

	if group.CreatorID != user.ID {
		var member models.GroupMember
		if err := h.db.Where("group_id = ? AND user_id = ? AND role = ?", group.ID, user.ID, models.GroupRoleAdmin).First(&member).Error; err != nil {
			apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "权限不足"))
			return
		}
	}

	quota, err := models.GetGroupQuota(h.db, uint(id), quotaType)
	if err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Query failed"))
		return
	}

	// 更新实际使用量
	models.UpdateGroupQuotaUsage(h.db, uint(id), quotaType)
	quota, _ = models.GetGroupQuota(h.db, uint(id), quotaType)

	apperrors.RespondSuccess(c, quota)
}

// CreateGroupQuota 创建组织配额
func (h *Handlers) CreateGroupQuota(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Unauthorized"))
		return
	}

	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "参数错误"))
		return
	}

	// 检查权限：只有创建者可以创建配额
	var group models.Group
	if err := h.db.First(&group, id).Error; err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "组织不存在"))
		return
	}

	if group.CreatorID != user.ID {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "权限不足"))
		return
	}

	var req CreateGroupQuotaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Invalid parameters"))
		return
	}

	// 检查是否已存在
	var existing models.GroupQuota
	if err := h.db.Where("group_id = ? AND quota_type = ?", id, req.QuotaType).First(&existing).Error; err == nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "配额已存在"))
		return
	}

	quota := models.GroupQuota{
		GroupID:     uint(id),
		QuotaType:   req.QuotaType,
		TotalQuota:  req.TotalQuota,
		Period:      req.Period,
		Description: req.Description,
	}

	if req.Period == "" {
		quota.Period = models.QuotaPeriodLifetime
	}

	if err := h.db.Create(&quota).Error; err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Creation failed"))
		return
	}

	apperrors.RespondSuccess(c, quota)
}

// UpdateGroupQuota 更新组织配额
func (h *Handlers) UpdateGroupQuota(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Unauthorized"))
		return
	}

	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "参数错误"))
		return
	}

	quotaType := models.QuotaType(c.Param("type"))

	// 检查权限
	var group models.Group
	if err := h.db.First(&group, id).Error; err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "组织不存在"))
		return
	}

	if group.CreatorID != user.ID {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "权限不足"))
		return
	}

	var quota models.GroupQuota
	if err := h.db.Where("group_id = ? AND quota_type = ?", id, quotaType).First(&quota).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "配额不存在"))
		} else {
			apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Query failed"))
		}
		return
	}

	var req UpdateGroupQuotaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Invalid parameters"))
		return
	}

	if req.TotalQuota != nil {
		quota.TotalQuota = *req.TotalQuota
	}
	if req.Period != nil {
		quota.Period = *req.Period
	}
	if req.Description != nil {
		quota.Description = *req.Description
	}

	if err := h.db.Save(&quota).Error; err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Update failed"))
		return
	}

	apperrors.RespondSuccess(c, quota)
}

// DeleteGroupQuota 删除组织配额
func (h *Handlers) DeleteGroupQuota(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Unauthorized"))
		return
	}

	id, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "参数错误"))
		return
	}

	quotaType := models.QuotaType(c.Param("type"))

	// 检查权限
	var group models.Group
	if err := h.db.First(&group, id).Error; err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "组织不存在"))
		return
	}

	if group.CreatorID != user.ID {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "权限不足"))
		return
	}

	if err := h.db.Where("group_id = ? AND quota_type = ?", id, quotaType).Delete(&models.GroupQuota{}).Error; err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Deletion failed"))
		return
	}

	apperrors.RespondSuccess(c, nil)
}

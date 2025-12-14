package handlers

import (
	_ "net/http"
	"strconv"

	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/code-100-precent/LingEcho/pkg/constants"
	"github.com/code-100-precent/LingEcho/pkg/response"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// CreateJSTemplate creates JS template
func (h *Handlers) CreateJSTemplate(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "User not logged in", nil)
		return
	}

	var template models.JSTemplate
	if err := c.ShouldBindJSON(&template); err != nil {
		response.Fail(c, "Invalid parameters: "+err.Error(), nil)
		return
	}

	// If it's a custom template, set the user ID
	if template.Type == "custom" {
		template.UserID = user.ID
	}

	// 如果设置了 GroupID，验证用户是否有权限共享到该组织
	if template.GroupID != nil {
		var group models.Group
		if err := h.db.Where("id = ?", *template.GroupID).First(&group).Error; err != nil {
			response.Fail(c, "Organization not found", nil)
			return
		}
		// 检查用户是否是组织成员或创建者
		if group.CreatorID != user.ID {
			var member models.GroupMember
			if err := h.db.Where("group_id = ? AND user_id = ?", *template.GroupID, user.ID).First(&member).Error; err != nil {
				response.Fail(c, "Insufficient permissions", "You are not a member of this organization")
				return
			}
		}
	}

	db := c.MustGet(constants.DbField).(*gorm.DB)
	if err := models.CreateJSTemplate(db, &template); err != nil {
		response.Fail(c, "Failed to create template: "+err.Error(), nil)
		return
	}

	response.Success(c, "Template created successfully", template)
}

// GetJSTemplate gets a single JS template
func (h *Handlers) GetJSTemplate(c *gin.Context) {
	id := c.Param("id")
	db := c.MustGet(constants.DbField).(*gorm.DB)

	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "User not logged in", nil)
		return
	}

	template, err := models.GetJSTemplateByID(db, id)
	if err != nil {
		response.Fail(c, "Template not found", nil)
		return
	}

	// 检查权限：用户自己的模板或组织共享的模板（用户是组织成员）
	if template.UserID != user.ID {
		if template.GroupID == nil {
			response.Fail(c, "Insufficient permissions", nil)
			return
		}
		// 检查用户是否是组织成员
		var group models.Group
		if err := h.db.Where("id = ?", *template.GroupID).First(&group).Error; err != nil {
			response.Fail(c, "Organization not found", nil)
			return
		}
		if group.CreatorID != user.ID {
			var member models.GroupMember
			if err := h.db.Where("group_id = ? AND user_id = ?", *template.GroupID, user.ID).First(&member).Error; err != nil {
				response.Fail(c, "Insufficient permissions", "You are not a member of this organization")
				return
			}
		}
	}

	response.Success(c, "Template retrieved successfully", template)
}

// GetJSTemplateByName gets JS template list by name (because names may be duplicated)
func (h *Handlers) GetJSTemplateByName(c *gin.Context) {
	name := c.Param("name")
	db := c.MustGet(constants.DbField).(*gorm.DB)

	templates, err := models.GetJSTemplatesByName(db, name)
	if err != nil {
		response.Fail(c, "Template not found", nil)
		return
	}

	response.Success(c, "Templates retrieved successfully", templates)
}

// ListJSTemplates gets JS template list
func (h *Handlers) ListJSTemplates(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "User not logged in", nil)
		return
	}
	userId := user.ID

	// Pagination parameters
	page := c.DefaultQuery("page", "1")
	limit := c.DefaultQuery("limit", "10")

	pageInt, err := strconv.Atoi(page)
	if err != nil || pageInt < 1 {
		pageInt = 1
	}

	limitInt, err := strconv.Atoi(limit)
	if err != nil || limitInt < 1 || limitInt > 100 {
		limitInt = 10
	}

	offset := (pageInt - 1) * limitInt

	// 获取用户所属的组织ID列表
	var groupIDs []uint
	var groupMembers []models.GroupMember
	if err := h.db.Where("user_id = ?", userId).Find(&groupMembers).Error; err == nil {
		for _, member := range groupMembers {
			groupIDs = append(groupIDs, member.GroupID)
		}
	}
	// 获取用户创建的组织ID
	var userGroups []models.Group
	if err := h.db.Where("creator_id = ?", userId).Find(&userGroups).Error; err == nil {
		for _, group := range userGroups {
			groupIDs = append(groupIDs, group.ID)
		}
	}

	// 查询：用户自己的模板 + 组织共享的模板
	var templates []models.JSTemplate
	query := db.Offset(offset).Limit(limitInt).Order("created_at DESC")

	// 构建查询条件：用户自己的模板 OR 组织共享的模板（用户是成员）
	if len(groupIDs) > 0 {
		query = query.Where("user_id = ? OR (group_id IS NOT NULL AND group_id IN (?))", userId, groupIDs)
	} else {
		query = query.Where("user_id = ?", userId)
	}

	if err := query.Find(&templates).Error; err != nil {
		response.Fail(c, "Failed to get template list: "+err.Error(), nil)
		return
	}

	// 获取总数
	var total int64
	countQuery := db.Model(&models.JSTemplate{})
	if len(groupIDs) > 0 {
		countQuery = countQuery.Where("user_id = ? OR (group_id IS NOT NULL AND group_id IN (?))", userId, groupIDs)
	} else {
		countQuery = countQuery.Where("user_id = ?", userId)
	}
	if err := countQuery.Count(&total).Error; err != nil {
		response.Fail(c, "Failed to get total template count: "+err.Error(), nil)
		return
	}

	response.Success(c, "Template list retrieved successfully", gin.H{
		"data":  templates,
		"page":  pageInt,
		"limit": limitInt,
		"total": total,
	})
}

// UpdateJSTemplate updates JS template
func (h *Handlers) UpdateJSTemplate(c *gin.Context) {
	id := c.Param("id")
	db := c.MustGet(constants.DbField).(*gorm.DB)

	// 检查模板是否存在
	template, err := models.GetJSTemplateByID(db, id)
	if err != nil {
		response.Fail(c, "Template not found", nil)
		return
	}

	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "User not logged in", nil)
		return
	}
	userId := user.ID

	// 检查权限：只有创建者或组织管理员可以更新
	if template.UserID != userId {
		if template.GroupID == nil {
			response.Fail(c, "Insufficient permissions", nil)
			return
		}
		// 检查用户是否是组织创建者或管理员
		var group models.Group
		if err := h.db.Where("id = ?", *template.GroupID).First(&group).Error; err != nil {
			response.Fail(c, "Organization not found", nil)
			return
		}
		if group.CreatorID != userId {
			var member models.GroupMember
			if err := h.db.Where("group_id = ? AND user_id = ? AND role = ?", *template.GroupID, userId, models.GroupRoleAdmin).First(&member).Error; err != nil {
				response.Fail(c, "Insufficient permissions", "Only creator or admin can update organization-shared templates")
				return
			}
		}
	}

	var updates map[string]interface{}
	if err := c.ShouldBindJSON(&updates); err != nil {
		response.Fail(c, "Invalid parameters: "+err.Error(), nil)
		return
	}

	// 如果更新了 GroupID，验证权限
	if groupIDVal, ok := updates["group_id"]; ok {
		if groupIDVal != nil {
			groupID := uint(groupIDVal.(float64))
			var group models.Group
			if err := h.db.Where("id = ?", groupID).First(&group).Error; err != nil {
				response.Fail(c, "Organization not found", nil)
				return
			}
			if group.CreatorID != userId {
				var member models.GroupMember
				if err := h.db.Where("group_id = ? AND user_id = ?", groupID, userId).First(&member).Error; err != nil {
					response.Fail(c, "Insufficient permissions", "You are not a member of this organization")
					return
				}
			}
		}
	}

	// Avoid updating certain key fields
	delete(updates, "id")
	delete(updates, "user_id")
	delete(updates, "created_at")

	if err := models.UpdateJSTemplate(db, id, updates); err != nil {
		response.Fail(c, "Failed to update template: "+err.Error(), nil)
		return
	}

	// Get updated template
	updatedTemplate, err := models.GetJSTemplateByID(db, id)
	if err != nil {
		response.Fail(c, "Failed to get updated template: "+err.Error(), nil)
		return
	}

	response.Success(c, "Template updated successfully", updatedTemplate)
}

// DeleteJSTemplate deletes JS template
func (h *Handlers) DeleteJSTemplate(c *gin.Context) {
	id := c.Param("id")
	db := c.MustGet(constants.DbField).(*gorm.DB)

	// 检查模板是否存在
	template, err := models.GetJSTemplateByID(db, id)
	if err != nil {
		response.Fail(c, "Template not found", nil)
		return
	}

	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "User not logged in", nil)
		return
	}
	userId := user.ID
	if template.Type == "default" {
		response.Fail(c, "Cannot delete default template", nil)
		return
	}

	// 检查权限：只有创建者或组织管理员可以删除
	if template.UserID != userId {
		if template.GroupID == nil {
			response.Fail(c, "Insufficient permissions", nil)
			return
		}
		// 检查用户是否是组织创建者或管理员
		var group models.Group
		if err := h.db.Where("id = ?", *template.GroupID).First(&group).Error; err != nil {
			response.Fail(c, "Organization not found", nil)
			return
		}
		if group.CreatorID != userId {
			var member models.GroupMember
			if err := h.db.Where("group_id = ? AND user_id = ? AND role = ?", *template.GroupID, userId, models.GroupRoleAdmin).First(&member).Error; err != nil {
				response.Fail(c, "Insufficient permissions", "Only creator or admin can delete organization-shared templates")
				return
			}
		}
	}

	if err := models.DeleteJSTemplate(db, id); err != nil {
		response.Fail(c, "Failed to delete template: "+err.Error(), nil)
		return
	}

	response.Success(c, "Template deleted successfully", nil)
}

// ListDefaultJSTemplates gets default template list
func (h *Handlers) ListDefaultJSTemplates(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)

	page := c.DefaultQuery("page", "1")
	limit := c.DefaultQuery("limit", "10")

	pageInt, err := strconv.Atoi(page)
	if err != nil || pageInt < 1 {
		pageInt = 1
	}

	limitInt, err := strconv.Atoi(limit)
	if err != nil || limitInt < 1 || limitInt > 100 {
		limitInt = 10
	}

	offset := (pageInt - 1) * limitInt

	templates, err := models.ListJSTemplatesByType(db, "default", 0, offset, limitInt)
	if err != nil {
		response.Fail(c, "Failed to get default templates: "+err.Error(), nil)
		return
	}

	// Get total count for pagination
	total, err := models.GetJSTemplatesCount(db, "default", 0)
	if err != nil {
		response.Fail(c, "Failed to get total default templates count: "+err.Error(), nil)
		return
	}

	response.Success(c, "Get default templates successfully", gin.H{
		"data":  templates,
		"page":  pageInt,
		"limit": limitInt,
		"total": total,
	})
}

// ListCustomJSTemplates gets user custom template list
func (h *Handlers) ListCustomJSTemplates(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "User not logged in", nil)
		return
	}
	userId := user.ID

	page := c.DefaultQuery("page", "1")
	limit := c.DefaultQuery("limit", "10")

	pageInt, err := strconv.Atoi(page)
	if err != nil || pageInt < 1 {
		pageInt = 1
	}

	limitInt, err := strconv.Atoi(limit)
	if err != nil || limitInt < 1 || limitInt > 100 {
		limitInt = 10
	}

	offset := (pageInt - 1) * limitInt

	templates, err := models.ListJSTemplatesByType(db, "custom", userId, offset, limitInt)
	if err != nil {
		response.Fail(c, "Failed to get custom templates: "+err.Error(), nil)
		return
	}

	// Get total count for pagination
	total, err := models.GetJSTemplatesCount(db, "custom", userId)
	if err != nil {
		response.Fail(c, "Failed to get total custom templates count: "+err.Error(), nil)
		return
	}

	response.Success(c, "Get custom templates successfully", gin.H{
		"data":  templates,
		"page":  pageInt,
		"limit": limitInt,
		"total": total,
	})
}

// SearchJSTemplates search JS templates
func (h *Handlers) SearchJSTemplates(c *gin.Context) {
	db := c.MustGet(constants.DbField).(*gorm.DB)
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "User not logged in", nil)
		return
	}
	userId := user.ID

	keyword := c.Query("keyword")
	page := c.DefaultQuery("page", "1")
	limit := c.DefaultQuery("limit", "10")

	pageInt, err := strconv.Atoi(page)
	if err != nil || pageInt < 1 {
		pageInt = 1
	}

	limitInt, err := strconv.Atoi(limit)
	if err != nil || limitInt < 1 || limitInt > 100 {
		limitInt = 10
	}

	offset := (pageInt - 1) * limitInt

	templates, err := models.SearchJSTemplates(db, keyword, userId, offset, limitInt)
	if err != nil {
		response.Fail(c, "Failed to search templates: "+err.Error(), nil)
		return
	}

	// Get total count for pagination
	total, err := models.GetJSTemplatesCount(db, "", userId)
	if err != nil {
		response.Fail(c, "Failed to get search results total count: "+err.Error(), nil)
		return
	}

	response.Success(c, "Search templates successfully", gin.H{
		"data":  templates,
		"page":  pageInt,
		"limit": limitInt,
		"total": total,
	})
}

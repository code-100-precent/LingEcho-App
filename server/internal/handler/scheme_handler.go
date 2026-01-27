package handlers

import (
	"fmt"
	"strconv"
	"time"

	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/code-100-precent/LingEcho/pkg/response"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// SchemeHandler 代接方案处理器
type SchemeHandler struct {
	db *gorm.DB
}

// NewSchemeHandler 创建代接方案处理器
func NewSchemeHandler(db *gorm.DB) *SchemeHandler {
	return &SchemeHandler{db: db}
}

// CreateSchemeRequest 创建方案请求
type CreateSchemeRequest struct {
	SchemeName       string                    `json:"schemeName" validate:"required"`
	Description      string                    `json:"description"`
	AssistantID      *uint                     `json:"assistantId" validate:"required"`
	AutoAnswer       bool                      `json:"autoAnswer"`
	AutoAnswerDelay  int                       `json:"autoAnswerDelay"`
	OpeningMessage   string                    `json:"openingMessage"`
	KeywordReplies   models.KeywordReplies     `json:"keywordReplies"`
	FallbackMessage  string                    `json:"fallbackMessage"`
	RecordingEnabled bool                      `json:"recordingEnabled"`
	RecordingMode    models.RecordingMode      `json:"recordingMode"`
	MessageEnabled   bool                      `json:"messageEnabled"`
	MessageDuration  int                       `json:"messageDuration"`
	MessagePrompt    string                    `json:"messagePrompt"`
	BoundPhoneNumber string                    `json:"boundPhoneNumber"`
}

// UpdateSchemeRequest 更新方案请求
type UpdateSchemeRequest struct {
	SchemeName       *string                   `json:"schemeName"`
	Description      *string                   `json:"description"`
	AssistantID      *uint                     `json:"assistantId"`
	AutoAnswer       *bool                     `json:"autoAnswer"`
	AutoAnswerDelay  *int                      `json:"autoAnswerDelay"`
	OpeningMessage   *string                   `json:"openingMessage"`
	KeywordReplies   *models.KeywordReplies    `json:"keywordReplies"`
	FallbackMessage  *string                   `json:"fallbackMessage"`
	RecordingEnabled *bool                     `json:"recordingEnabled"`
	RecordingMode    *models.RecordingMode     `json:"recordingMode"`
	MessageEnabled   *bool                     `json:"messageEnabled"`
	MessageDuration  *int                      `json:"messageDuration"`
	MessagePrompt    *string                   `json:"messagePrompt"`
	BoundPhoneNumber *string                   `json:"boundPhoneNumber"`
	Enabled          *bool                     `json:"enabled"`
}

// ListSchemes 获取方案列表
// @Summary 获取代接方案列表
// @Tags Scheme
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} response.Response{data=[]models.SipUser}
// @Router /api/schemes [get]
func (h *SchemeHandler) ListSchemes(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", "请先登录")
		return
	}

	schemes, err := models.GetSipUsersByUserID(h.db, user.ID)
	if err != nil {
		response.Fail(c, "获取方案列表失败", err.Error())
		return
	}

	response.Success(c, "success", schemes)
}

// GetScheme 获取方案详情
// @Summary 获取代接方案详情
// @Tags Scheme
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "方案ID"
// @Success 200 {object} response.Response{data=models.SipUser}
// @Router /api/schemes/{id} [get]
func (h *SchemeHandler) GetScheme(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", "请先登录")
		return
	}

	schemeID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Fail(c, "无效的方案ID", err.Error())
		return
	}

	scheme, err := models.GetSipUserByID(h.db, uint(schemeID))
	if err != nil {
		response.Fail(c, "方案不存在", err.Error())
		return
	}

	// 检查权限
	if scheme.UserID == nil || *scheme.UserID != user.ID {
		response.Fail(c, "无权访问此方案", nil)
		return
	}

	response.Success(c, "success", scheme)
}

// CreateScheme 创建方案
// @Summary 创建代接方案
// @Tags Scheme
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body CreateSchemeRequest true "方案信息"
// @Success 200 {object} response.Response{data=models.SipUser}
// @Router /api/schemes [post]
func (h *SchemeHandler) CreateScheme(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", "请先登录")
		return
	}

	var req CreateSchemeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "请求参数错误", err.Error())
		return
	}

	// 生成唯一的 username
	username := generateSchemeUsername(user.ID)

	scheme := &models.SipUser{
		SchemeName:       req.SchemeName,
		Description:      req.Description,
		Username:         username,
		UserID:           &user.ID,
		AssistantID:      req.AssistantID,
		AutoAnswer:       req.AutoAnswer,
		AutoAnswerDelay:  req.AutoAnswerDelay,
		OpeningMessage:   req.OpeningMessage,
		KeywordReplies:   req.KeywordReplies,
		FallbackMessage:  req.FallbackMessage,
		RecordingEnabled: req.RecordingEnabled,
		RecordingMode:    req.RecordingMode,
		MessageEnabled:   req.MessageEnabled,
		MessageDuration:  req.MessageDuration,
		MessagePrompt:    req.MessagePrompt,
		BoundPhoneNumber: req.BoundPhoneNumber,
		Enabled:          true,
	}

	// 设置默认值
	if scheme.MessageDuration == 0 {
		scheme.MessageDuration = 20
	}
	if scheme.RecordingMode == "" {
		scheme.RecordingMode = models.RecordingModeFull
	}

	if err := models.CreateSipUser(h.db, scheme); err != nil {
		response.Fail(c, "创建方案失败", err.Error())
		return
	}

	response.Success(c, "创建成功", scheme)
}

// UpdateScheme 更新方案
// @Summary 更新代接方案
// @Tags Scheme
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "方案ID"
// @Param request body UpdateSchemeRequest true "方案信息"
// @Success 200 {object} response.Response{data=models.SipUser}
// @Router /api/schemes/{id} [put]
func (h *SchemeHandler) UpdateScheme(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", "请先登录")
		return
	}

	schemeID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Fail(c, "无效的方案ID", err.Error())
		return
	}

	var req UpdateSchemeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "请求参数错误", err.Error())
		return
	}

	scheme, err := models.GetSipUserByID(h.db, uint(schemeID))
	if err != nil {
		response.Fail(c, "方案不存在", err.Error())
		return
	}

	// 检查权限
	if scheme.UserID == nil || *scheme.UserID != user.ID {
		response.Fail(c, "无权修改此方案", nil)
		return
	}

	// 更新字段
	if req.SchemeName != nil {
		scheme.SchemeName = *req.SchemeName
	}
	if req.Description != nil {
		scheme.Description = *req.Description
	}
	if req.AssistantID != nil {
		scheme.AssistantID = req.AssistantID
	}
	if req.AutoAnswer != nil {
		scheme.AutoAnswer = *req.AutoAnswer
	}
	if req.AutoAnswerDelay != nil {
		scheme.AutoAnswerDelay = *req.AutoAnswerDelay
	}
	if req.OpeningMessage != nil {
		scheme.OpeningMessage = *req.OpeningMessage
	}
	if req.KeywordReplies != nil {
		scheme.KeywordReplies = *req.KeywordReplies
	}
	if req.FallbackMessage != nil {
		scheme.FallbackMessage = *req.FallbackMessage
	}
	if req.RecordingEnabled != nil {
		scheme.RecordingEnabled = *req.RecordingEnabled
	}
	if req.RecordingMode != nil {
		scheme.RecordingMode = *req.RecordingMode
	}
	if req.MessageEnabled != nil {
		scheme.MessageEnabled = *req.MessageEnabled
	}
	if req.MessageDuration != nil {
		scheme.MessageDuration = *req.MessageDuration
	}
	if req.MessagePrompt != nil {
		scheme.MessagePrompt = *req.MessagePrompt
	}
	if req.BoundPhoneNumber != nil {
		scheme.BoundPhoneNumber = *req.BoundPhoneNumber
	}
	if req.Enabled != nil {
		scheme.Enabled = *req.Enabled
	}

	if err := models.UpdateSipUser(h.db, scheme); err != nil {
		response.Fail(c, "更新方案失败", err.Error())
		return
	}

	response.Success(c, "更新成功", scheme)
}

// DeleteScheme 删除方案
// @Summary 删除代接方案
// @Tags Scheme
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "方案ID"
// @Success 200 {object} response.Response
// @Router /api/schemes/{id} [delete]
func (h *SchemeHandler) DeleteScheme(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", "请先登录")
		return
	}

	schemeID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Fail(c, "无效的方案ID", err.Error())
		return
	}

	scheme, err := models.GetSipUserByID(h.db, uint(schemeID))
	if err != nil {
		response.Fail(c, "方案不存在", err.Error())
		return
	}

	// 检查权限
	if scheme.UserID == nil || *scheme.UserID != user.ID {
		response.Fail(c, "无权删除此方案", nil)
		return
	}

	if err := models.DeleteSipUser(h.db, uint(schemeID)); err != nil {
		response.Fail(c, "删除方案失败", err.Error())
		return
	}

	response.Success(c, "删除成功", nil)
}

// ActivateScheme 激活方案
// @Summary 激活代接方案
// @Tags Scheme
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "方案ID"
// @Success 200 {object} response.Response
// @Router /api/schemes/{id}/activate [post]
func (h *SchemeHandler) ActivateScheme(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", "请先登录")
		return
	}

	schemeID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Fail(c, "无效的方案ID", err.Error())
		return
	}

	scheme, err := models.GetSipUserByID(h.db, uint(schemeID))
	if err != nil {
		response.Fail(c, "方案不存在", err.Error())
		return
	}

	// 检查权限
	if scheme.UserID == nil || *scheme.UserID != user.ID {
		response.Fail(c, "无权激活此方案", nil)
		return
	}

	if err := models.ActivateSipUser(h.db, user.ID, uint(schemeID)); err != nil {
		response.Fail(c, "激活方案失败", err.Error())
		return
	}

	response.Success(c, "方案已激活", map[string]interface{}{
		"id": schemeID,
	})
}

// DeactivateScheme 停用方案
// @Summary 停用代接方案
// @Tags Scheme
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "方案ID"
// @Success 200 {object} response.Response
// @Router /api/schemes/{id}/deactivate [post]
func (h *SchemeHandler) DeactivateScheme(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", "请先登录")
		return
	}

	schemeID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Fail(c, "无效的方案ID", err.Error())
		return
	}

	scheme, err := models.GetSipUserByID(h.db, uint(schemeID))
	if err != nil {
		response.Fail(c, "方案不存在", err.Error())
		return
	}

	// 检查权限
	if scheme.UserID == nil || *scheme.UserID != user.ID {
		response.Fail(c, "无权停用此方案", nil)
		return
	}

	// 停用方案（将 is_active 设为 false）
	if err := h.db.Model(&models.SipUser{}).
		Where("id = ?", schemeID).
		Update("is_active", false).Error; err != nil {
		response.Fail(c, "停用方案失败", err.Error())
		return
	}

	response.Success(c, "方案已停用", map[string]interface{}{
		"id": schemeID,
	})
}

// GetActiveScheme 获取当前激活的方案
// @Summary 获取当前激活的代接方案
// @Tags Scheme
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} response.Response{data=models.SipUser}
// @Router /api/schemes/active [get]
func (h *SchemeHandler) GetActiveScheme(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", "请先登录")
		return
	}

	scheme, err := models.GetActiveSipUserByUserID(h.db, user.ID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			response.Success(c, "success", nil)
			return
		}
		response.Fail(c, "获取激活方案失败", err.Error())
		return
	}

	response.Success(c, "success", scheme)
}

// generateSchemeUsername 生成方案的唯一用户名
func generateSchemeUsername(userID uint) string {
	return fmt.Sprintf("scheme_%d_%d", userID, time.Now().UnixNano())
}

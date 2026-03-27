package handlers

import (
	"encoding/json"
	"time"

	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/code-100-precent/LingEcho/pkg/response"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

// CallSelectionHandler 来电方案选择处理器
type CallSelectionHandler struct {
	db *gorm.DB
}

// NewCallSelectionHandler 创建来电方案选择处理器
func NewCallSelectionHandler(db *gorm.DB) *CallSelectionHandler {
	return &CallSelectionHandler{db: db}
}

// GetPendingCallSelections 获取待选择的来电列表
// @Summary 获取待选择的来电列表
// @Tags CallSelection
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param status query string false "状态过滤: pending/selected/timeout/cancelled"
// @Success 200 {object} response.Response{data=[]models.PendingCallSelection}
// @Router /api/call-selections/pending [get]
func (h *CallSelectionHandler) GetPendingCallSelections(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", "请先登录")
		return
	}

	status := c.Query("status")
	selections, err := models.GetPendingCallSelectionsByUserID(h.db, user.ID, status)
	if err != nil {
		logrus.WithError(err).Error("获取待选择来电列表失败")
		response.Fail(c, "获取失败", err.Error())
		return
	}

	response.Success(c, "success", selections)
}

// GetPendingCallSelection 获取待选择来电详情
// @Summary 获取待选择来电详情
// @Tags CallSelection
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param callId path string true "Call ID"
// @Success 200 {object} response.Response{data=models.PendingCallSelection}
// @Router /api/call-selections/{callId} [get]
func (h *CallSelectionHandler) GetPendingCallSelection(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", "请先登录")
		return
	}

	callID := c.Param("callId")
	selection, err := models.GetPendingCallSelectionByCallID(h.db, callID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			response.Fail(c, "来电记录不存在", nil)
			return
		}
		logrus.WithError(err).Error("获取待选择来电详情失败")
		response.Fail(c, "获取失败", err.Error())
		return
	}

	// 检查权限
	if selection.UserID != user.ID {
		response.Fail(c, "无权访问此来电记录", nil)
		return
	}

	response.Success(c, "success", selection)
}

// SelectSchemeRequest 选择方案请求
type SelectSchemeRequest struct {
	SchemeID uint `json:"schemeId" binding:"required"`
}

// SelectSchemeForCall 为来电选择方案
// @Summary 为来电选择方案
// @Tags CallSelection
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param callId path string true "Call ID"
// @Param request body SelectSchemeRequest true "选择的方案ID"
// @Success 200 {object} response.Response
// @Router /api/call-selections/{callId}/select [post]
func (h *CallSelectionHandler) SelectSchemeForCall(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", "请先登录")
		return
	}

	callID := c.Param("callId")
	
	var req SelectSchemeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "请求参数错误", err.Error())
		return
	}

	// 获取待选择记录
	selection, err := models.GetPendingCallSelectionByCallID(h.db, callID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			response.Fail(c, "来电记录不存在", nil)
			return
		}
		response.Fail(c, "获取来电记录失败", err.Error())
		return
	}

	// 检查权限
	if selection.UserID != user.ID {
		response.Fail(c, "无权操作此来电记录", nil)
		return
	}

	// 检查状态
	if selection.Status != "pending" {
		response.Fail(c, "来电已处理，无法再次选择", map[string]interface{}{
			"currentStatus": selection.Status,
		})
		return
	}

	// 检查是否超时
	if selection.IsTimeout() {
		// 更新为超时状态
		models.TimeoutPendingCallSelection(h.db, callID)
		response.Fail(c, "选择已超时", nil)
		return
	}

	// 验证方案是否属于该用户
	scheme, err := models.GetSipUserByID(h.db, req.SchemeID)
	if err != nil {
		response.Fail(c, "方案不存在", err.Error())
		return
	}

	if scheme.UserID == nil || *scheme.UserID != user.ID {
		response.Fail(c, "无权使用此方案", nil)
		return
	}

	// 验证方案是否在可用列表中
	var availableSchemeIDs []uint
	if selection.AvailableSchemeIDs != "" {
		if err := json.Unmarshal([]byte(selection.AvailableSchemeIDs), &availableSchemeIDs); err == nil {
			found := false
			for _, id := range availableSchemeIDs {
				if id == req.SchemeID {
					found = true
					break
				}
			}
			if !found {
				response.Fail(c, "所选方案不在可用列表中", nil)
				return
			}
		}
	}

	// 执行选择
	if err := models.SelectSchemeForCall(h.db, callID, req.SchemeID); err != nil {
		logrus.WithError(err).Error("选择方案失败")
		response.Fail(c, "选择方案失败", err.Error())
		return
	}

	// 激活选中的方案
	if err := models.ActivateSipUser(h.db, user.ID, req.SchemeID); err != nil {
		logrus.WithError(err).Error("激活方案失败")
		response.Fail(c, "激活方案失败", err.Error())
		return
	}

	response.Success(c, "方案已选择并激活", map[string]interface{}{
		"callId":   callID,
		"schemeId": req.SchemeID,
	})
}

// GetAvailableSchemesForCall 获取来电可用的方案列表
// @Summary 获取来电可用的方案列表
// @Tags CallSelection
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param callId path string true "Call ID"
// @Success 200 {object} response.Response{data=[]models.SipUser}
// @Router /api/call-selections/{callId}/available-schemes [get]
func (h *CallSelectionHandler) GetAvailableSchemesForCall(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", "请先登录")
		return
	}

	callID := c.Param("callId")
	
	// 获取待选择记录
	selection, err := models.GetPendingCallSelectionByCallID(h.db, callID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			response.Fail(c, "来电记录不存在", nil)
			return
		}
		response.Fail(c, "获取来电记录失败", err.Error())
		return
	}

	// 检查权限
	if selection.UserID != user.ID {
		response.Fail(c, "无权访问此来电记录", nil)
		return
	}

	// 解析可用方案ID列表
	var availableSchemeIDs []uint
	if selection.AvailableSchemeIDs != "" {
		if err := json.Unmarshal([]byte(selection.AvailableSchemeIDs), &availableSchemeIDs); err != nil {
			logrus.WithError(err).Error("解析可用方案ID列表失败")
			response.Fail(c, "解析可用方案列表失败", err.Error())
			return
		}
	}

	// 如果没有指定可用方案，返回用户所有启用的方案
	if len(availableSchemeIDs) == 0 {
		schemes, err := models.GetSipUsersByUserID(h.db, user.ID)
		if err != nil {
			response.Fail(c, "获取方案列表失败", err.Error())
			return
		}
		
		// 过滤出启用的方案
		var enabledSchemes []models.SipUser
		for _, scheme := range schemes {
			if scheme.Enabled {
				enabledSchemes = append(enabledSchemes, scheme)
			}
		}
		
		response.Success(c, "success", enabledSchemes)
		return
	}

	// 根据ID列表获取方案详情
	var schemes []models.SipUser
	if err := h.db.Where("id IN (?) AND user_id = ? AND enabled = ?", availableSchemeIDs, user.ID, true).
		Find(&schemes).Error; err != nil {
		response.Fail(c, "获取方案列表失败", err.Error())
		return
	}

	response.Success(c, "success", schemes)
}

// CancelCallSelection 取消来电选择
// @Summary 取消来电选择
// @Tags CallSelection
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param callId path string true "Call ID"
// @Success 200 {object} response.Response
// @Router /api/call-selections/{callId}/cancel [post]
func (h *CallSelectionHandler) CancelCallSelection(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", "请先登录")
		return
	}

	callID := c.Param("callId")
	
	// 获取待选择记录
	selection, err := models.GetPendingCallSelectionByCallID(h.db, callID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			response.Fail(c, "来电记录不存在", nil)
			return
		}
		response.Fail(c, "获取来电记录失败", err.Error())
		return
	}

	// 检查权限
	if selection.UserID != user.ID {
		response.Fail(c, "无权操作此来电记录", nil)
		return
	}

	// 取消选择
	if err := models.CancelPendingCallSelection(h.db, callID); err != nil {
		logrus.WithError(err).Error("取消来电选择失败")
		response.Fail(c, "取消失败", err.Error())
		return
	}

	response.Success(c, "已取消来电选择", nil)
}

// CleanupExpiredSelections 清理过期的待选择记录（定时任务调用）
func (h *CallSelectionHandler) CleanupExpiredSelections(c *gin.Context) {
	// 这个接口应该只允许管理员或定时任务调用
	if err := models.CleanupExpiredPendingSelections(h.db); err != nil {
		logrus.WithError(err).Error("清理过期待选择记录失败")
		response.Fail(c, "清理失败", err.Error())
		return
	}

	response.Success(c, "清理成功", nil)
}

// GetCallSelectionStatus 获取来电选择状态（用于轮询）
// @Summary 获取来电选择状态
// @Tags CallSelection
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param callId path string true "Call ID"
// @Success 200 {object} response.Response
// @Router /api/call-selections/{callId}/status [get]
func (h *CallSelectionHandler) GetCallSelectionStatus(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", "请先登录")
		return
	}

	callID := c.Param("callId")
	
	selection, err := models.GetPendingCallSelectionByCallID(h.db, callID)
	if err != nil {
		if err == gorm.ErrRecordNotFound {
			response.Fail(c, "来电记录不存在", nil)
			return
		}
		response.Fail(c, "获取来电记录失败", err.Error())
		return
	}

	// 检查权限
	if selection.UserID != user.ID {
		response.Fail(c, "无权访问此来电记录", nil)
		return
	}

	// 检查是否超时
	isTimeout := selection.IsTimeout()
	if isTimeout && selection.Status == "pending" {
		// 自动更新为超时状态
		models.TimeoutPendingCallSelection(h.db, callID)
		selection.Status = "timeout"
	}

	// 计算剩余时间
	remainingSeconds := int(time.Until(selection.SelectTimeout).Seconds())
	if remainingSeconds < 0 {
		remainingSeconds = 0
	}

	response.Success(c, "success", map[string]interface{}{
		"callId":           callID,
		"status":           selection.Status,
		"selectedSchemeId": selection.SelectedSchemeID,
		"remainingSeconds": remainingSeconds,
		"isTimeout":        isTimeout,
	})
}

// GetUserCallSelectionSettings 获取用户的来电选择设置
// @Summary 获取用户的来电选择设置
// @Tags CallSelection
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} response.Response
// @Router /api/call-selections/settings [get]
func (h *CallSelectionHandler) GetUserCallSelectionSettings(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", "请先登录")
		return
	}

	// 获取用户所有方案
	schemes, err := models.GetSipUsersByUserID(h.db, user.ID)
	if err != nil {
		response.Fail(c, "获取方案列表失败", err.Error())
		return
	}

	// 统计启用了接通前选择的方案数量
	var preSelectionEnabledCount int
	var preSelectionEnabledSchemes []map[string]interface{}
	
	for _, scheme := range schemes {
		if scheme.EnablePreSelection && scheme.Enabled {
			preSelectionEnabledCount++
			preSelectionEnabledSchemes = append(preSelectionEnabledSchemes, map[string]interface{}{
				"id":                 scheme.ID,
				"schemeName":         scheme.SchemeName,
				"boundPhoneNumber":   scheme.BoundPhoneNumber,
				"enablePreSelection": scheme.EnablePreSelection,
			})
		}
	}

	response.Success(c, "success", map[string]interface{}{
		"totalSchemes":               len(schemes),
		"preSelectionEnabledCount":   preSelectionEnabledCount,
		"preSelectionEnabledSchemes": preSelectionEnabledSchemes,
		"hasPreSelectionEnabled":     preSelectionEnabledCount > 0,
	})
}

// UpdateCallSelectionSettings 更新来电选择设置
type UpdateCallSelectionSettingsRequest struct {
	SchemeID           uint `json:"schemeId" binding:"required"`
	EnablePreSelection bool `json:"enablePreSelection"`
}

// UpdateCallSelectionSettings 更新方案的来电选择设置
// @Summary 更新方案的来电选择设置
// @Tags CallSelection
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param request body UpdateCallSelectionSettingsRequest true "设置信息"
// @Success 200 {object} response.Response
// @Router /api/call-selections/settings [put]
func (h *CallSelectionHandler) UpdateCallSelectionSettings(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", "请先登录")
		return
	}

	var req UpdateCallSelectionSettingsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "请求参数错误", err.Error())
		return
	}

	// 获取方案
	scheme, err := models.GetSipUserByID(h.db, req.SchemeID)
	if err != nil {
		response.Fail(c, "方案不存在", err.Error())
		return
	}

	// 检查权限
	if scheme.UserID == nil || *scheme.UserID != user.ID {
		response.Fail(c, "无权修改此方案", nil)
		return
	}

	// 更新设置
	scheme.EnablePreSelection = req.EnablePreSelection
	if err := models.UpdateSipUser(h.db, scheme); err != nil {
		logrus.WithError(err).Error("更新方案设置失败")
		response.Fail(c, "更新失败", err.Error())
		return
	}

	response.Success(c, "设置已更新", scheme)
}

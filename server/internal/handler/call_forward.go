package handlers

import (
	"strconv"

	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/code-100-precent/LingEcho/pkg/callforward"
	"github.com/code-100-precent/LingEcho/pkg/response"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

// CallForwardHandler 呼叫转移处理器
type CallForwardHandler struct {
	db      *gorm.DB
	service *callforward.Service
	logger  *logrus.Logger
}

// NewCallForwardHandler 创建呼叫转移处理器
func NewCallForwardHandler(db *gorm.DB, logger *logrus.Logger) *CallForwardHandler {
	return &CallForwardHandler{
		db:      db,
		service: callforward.NewService(db, logger),
		logger:  logger,
	}
}

// GetSetupInstructions 获取呼叫转移设置指引
// @Summary 获取呼叫转移设置指引
// @Tags CallForward
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param body body callforward.SetupRequest true "设置请求"
// @Success 200 {object} response.Response{data=callforward.SetupResponse}
// @Router /api/call-forward/setup-instructions [post]
func (h *CallForwardHandler) GetSetupInstructions(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", "请先登录")
		return
	}

	var req callforward.SetupRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "请求参数错误", err.Error())
		return
	}

	// 验证号码所有权
	phoneNumber, err := models.GetPhoneNumberByID(h.db, req.PhoneNumberID)
	if err != nil {
		response.Fail(c, "号码不存在", err.Error())
		return
	}

	if phoneNumber.UserID != user.ID {
		response.Fail(c, "无权操作此号码", nil)
		return
	}

	instructions, err := h.service.GetSetupInstructions(req)
	if err != nil {
		response.Fail(c, "获取指引失败", err.Error())
		return
	}

	response.Success(c, "success", instructions)
}

// GetDisableInstructions 获取取消呼叫转移指引
// @Summary 获取取消呼叫转移指引
// @Tags CallForward
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "号码ID"
// @Success 200 {object} response.Response{data=callforward.SetupResponse}
// @Router /api/call-forward/{id}/disable-instructions [get]
func (h *CallForwardHandler) GetDisableInstructions(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", "请先登录")
		return
	}

	phoneNumberID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Fail(c, "无效的号码ID", err.Error())
		return
	}

	// 验证号码所有权
	phoneNumber, err := models.GetPhoneNumberByID(h.db, uint(phoneNumberID))
	if err != nil {
		response.Fail(c, "号码不存在", err.Error())
		return
	}

	if phoneNumber.UserID != user.ID {
		response.Fail(c, "无权操作此号码", nil)
		return
	}

	instructions, err := h.service.DisableInstructions(uint(phoneNumberID))
	if err != nil {
		response.Fail(c, "获取指引失败", err.Error())
		return
	}

	response.Success(c, "success", instructions)
}

// UpdateStatus 更新呼叫转移状态
// @Summary 更新呼叫转移状态
// @Tags CallForward
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "号码ID"
// @Param body body object true "状态更新"
// @Success 200 {object} response.Response
// @Router /api/call-forward/{id}/status [post]
func (h *CallForwardHandler) UpdateStatus(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", "请先登录")
		return
	}

	phoneNumberID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Fail(c, "无效的号码ID", err.Error())
		return
	}

	var req struct {
		Enabled      bool   `json:"enabled"`
		TargetNumber string `json:"targetNumber"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "请求参数错误", err.Error())
		return
	}

	// 验证号码所有权
	phoneNumber, err := models.GetPhoneNumberByID(h.db, uint(phoneNumberID))
	if err != nil {
		response.Fail(c, "号码不存在", err.Error())
		return
	}

	if phoneNumber.UserID != user.ID {
		response.Fail(c, "无权操作此号码", nil)
		return
	}

	if err := h.service.UpdateStatus(c.Request.Context(), uint(phoneNumberID), req.Enabled, req.TargetNumber); err != nil {
		response.Fail(c, "更新失败", err.Error())
		return
	}

	response.Success(c, "更新成功", nil)
}

// VerifyStatus 验证呼叫转移状态
// @Summary 验证呼叫转移状态
// @Tags CallForward
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "号码ID"
// @Success 200 {object} response.Response{data=callforward.VerifyResponse}
// @Router /api/call-forward/{id}/verify [post]
func (h *CallForwardHandler) VerifyStatus(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", "请先登录")
		return
	}

	phoneNumberID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Fail(c, "无效的号码ID", err.Error())
		return
	}

	// 验证号码所有权
	phoneNumber, err := models.GetPhoneNumberByID(h.db, uint(phoneNumberID))
	if err != nil {
		response.Fail(c, "号码不存在", err.Error())
		return
	}

	if phoneNumber.UserID != user.ID {
		response.Fail(c, "无权操作此号码", nil)
		return
	}

	result, err := h.service.VerifyStatus(c.Request.Context(), callforward.VerifyRequest{
		PhoneNumberID: uint(phoneNumberID),
	})

	if err != nil {
		response.Fail(c, "验证失败", err.Error())
		return
	}

	response.Success(c, "success", result)
}

// TestCallForward 测试呼叫转移
// @Summary 测试呼叫转移
// @Tags CallForward
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "号码ID"
// @Success 200 {object} response.Response
// @Router /api/call-forward/{id}/test [post]
func (h *CallForwardHandler) TestCallForward(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", "请先登录")
		return
	}

	phoneNumberID, err := strconv.ParseUint(c.Param("id"), 10, 32)
	if err != nil {
		response.Fail(c, "无效的号码ID", err.Error())
		return
	}

	// 验证号码所有权
	phoneNumber, err := models.GetPhoneNumberByID(h.db, uint(phoneNumberID))
	if err != nil {
		response.Fail(c, "号码不存在", err.Error())
		return
	}

	if phoneNumber.UserID != user.ID {
		response.Fail(c, "无权操作此号码", nil)
		return
	}

	if err := h.service.TestCallForward(c.Request.Context(), uint(phoneNumberID)); err != nil {
		response.Fail(c, "测试失败", err.Error())
		return
	}

	response.Success(c, "测试呼叫已发起，请注意接听", nil)
}

// GetCarrierCodes 获取运营商代码
// @Summary 获取运营商代码
// @Tags CallForward
// @Accept json
// @Produce json
// @Param carrier query string false "运营商" Enums(移动, 联通, 电信)
// @Success 200 {object} response.Response
// @Router /api/call-forward/carrier-codes [get]
func (h *CallForwardHandler) GetCarrierCodes(c *gin.Context) {
	carrier := c.DefaultQuery("carrier", "移动")
	codes := h.service.GetCarrierCodes(carrier)
	response.Success(c, "success", codes)
}

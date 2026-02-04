package handlers

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/code-100-precent/LingEcho/pkg/response"
	"github.com/gin-gonic/gin"
	"github.com/sirupsen/logrus"
	"gorm.io/gorm"
)

// CallForwardService 呼叫转移服务
type CallForwardService struct {
	db     *gorm.DB
	logger *logrus.Logger
}

// NewCallForwardService 创建呼叫转移服务
func NewCallForwardService(db *gorm.DB, logger *logrus.Logger) *CallForwardService {
	return &CallForwardService{
		db:     db,
		logger: logger,
	}
}

// SetupRequest 设置呼叫转移请求
type SetupRequest struct {
	PhoneNumberID uint   `json:"phoneNumberId" binding:"required"`
	TargetNumber  string `json:"targetNumber" binding:"required"` // 转移目标号码（虚拟号码）
	Carrier       string `json:"carrier"`                         // 运营商：移动/联通/电信
}

// SetupResponse 设置呼叫转移响应
type SetupResponse struct {
	Code        string `json:"code"`        // 拨号代码，如 **21*13800138000#
	Description string `json:"description"` // 说明
	Steps       []Step `json:"steps"`       // 操作步骤
}

// Step 操作步骤
type Step struct {
	Order       int    `json:"order"`
	Description string `json:"description"`
	Action      string `json:"action,omitempty"` // 可选的操作代码
}

// VerifyRequest 验证呼叫转移请求
type VerifyRequest struct {
	PhoneNumberID uint `json:"phoneNumberId" binding:"required"`
}

// VerifyResponse 验证呼叫转移响应
type VerifyResponse struct {
	IsEnabled    bool      `json:"isEnabled"`    // 是否已启用
	Status       string    `json:"status"`       // 状态：enabled/disabled/unknown
	TargetNumber string    `json:"targetNumber"` // 转移目标号码
	VerifiedAt   time.Time `json:"verifiedAt"`   // 验证时间
	Message      string    `json:"message"`      // 提示信息
}

// ForwardingRecord 呼叫转移记录
type ForwardingRecord struct {
	ID           uint      `json:"id"`
	PhoneNumber  string    `json:"phoneNumber"`
	TargetNumber string    `json:"targetNumber"`
	Action       string    `json:"action"` // enable/disable/test
	Status       string    `json:"status"` // success/failed
	Message      string    `json:"message"`
	CreatedAt    time.Time `json:"createdAt"`
}

// GetSetupInstructions 获取呼叫转移设置指引
func (s *CallForwardService) GetSetupInstructions(req SetupRequest) (*SetupResponse, error) {
	// 获取号码信息
	phoneNumber, err := models.GetPhoneNumberByID(s.db, req.PhoneNumberID)
	if err != nil {
		return nil, fmt.Errorf("号码不存在: %w", err)
	}

	// 确定运营商
	carrier := req.Carrier
	if carrier == "" {
		carrier = phoneNumber.Carrier
	}
	if carrier == "" {
		carrier = "移动" // 默认
	}

	// 生成拨号代码
	code := fmt.Sprintf("**21*%s#", req.TargetNumber)

	// 生成操作步骤
	steps := []Step{
		{
			Order:       1,
			Description: "打开手机拨号界面",
		},
		{
			Order:       2,
			Description: fmt.Sprintf("输入代码：%s", code),
			Action:      code,
		},
		{
			Order:       3,
			Description: "按拨号键，等待运营商确认",
		},
		{
			Order:       4,
			Description: "收到成功提示后，呼叫转移即生效",
		},
		{
			Order:       5,
			Description: "可拨打 *#21# 查询转移状态",
			Action:      "*#21#",
		},
	}

	// 添加运营商特定说明
	description := s.getCarrierDescription(carrier, req.TargetNumber)

	return &SetupResponse{
		Code:        code,
		Description: description,
		Steps:       steps,
	}, nil
}

// DisableInstructions 获取取消呼叫转移指引
func (s *CallForwardService) DisableInstructions(phoneNumberID uint) (*SetupResponse, error) {
	phoneNumber, err := models.GetPhoneNumberByID(s.db, phoneNumberID)
	if err != nil {
		return nil, fmt.Errorf("号码不存在: %w", err)
	}

	carrier := phoneNumber.Carrier
	if carrier == "" {
		carrier = "移动"
	}

	code := "##21#"

	steps := []Step{
		{
			Order:       1,
			Description: "打开手机拨号界面",
		},
		{
			Order:       2,
			Description: fmt.Sprintf("输入代码：%s", code),
			Action:      code,
		},
		{
			Order:       3,
			Description: "按拨号键，等待运营商确认",
		},
		{
			Order:       4,
			Description: "收到成功提示后，呼叫转移已取消",
		},
	}

	description := fmt.Sprintf("取消%s呼叫转移", carrier)

	return &SetupResponse{
		Code:        code,
		Description: description,
		Steps:       steps,
	}, nil
}

// UpdateStatus 更新呼叫转移状态
func (s *CallForwardService) UpdateStatus(ctx context.Context, phoneNumberID uint, enabled bool, targetNumber string) error {
	var status models.CallForwardStatus
	if enabled {
		status = models.CallForwardStatusEnabled
	} else {
		status = models.CallForwardStatusDisabled
	}

	// 更新数据库
	updates := map[string]interface{}{
		"call_forward_enabled": enabled,
		"call_forward_status":  status,
		"call_forward_number":  targetNumber,
	}

	if enabled {
		now := time.Now()
		updates["call_forward_set_at"] = now
	}

	err := s.db.Model(&models.PhoneNumber{}).
		Where("id = ?", phoneNumberID).
		Updates(updates).Error

	if err != nil {
		s.logger.WithError(err).Error("更新呼叫转移状态失败")
		return err
	}

	s.logger.WithFields(logrus.Fields{
		"phone_number_id": phoneNumberID,
		"enabled":         enabled,
		"target_number":   targetNumber,
	}).Info("呼叫转移状态已更新")

	return nil
}

// VerifyStatus 验证呼叫转移状态（通过测试呼叫）
func (s *CallForwardService) VerifyStatus(ctx context.Context, req VerifyRequest) (*VerifyResponse, error) {
	phoneNumber, err := models.GetPhoneNumberByID(s.db, req.PhoneNumberID)
	if err != nil {
		return nil, fmt.Errorf("号码不存在: %w", err)
	}

	// TODO: 实现真实的验证逻辑
	// 1. 可以通过拨打测试电话来验证
	// 2. 或者通过运营商 API 查询（如果有）
	// 3. 或者让用户手动确认

	response := &VerifyResponse{
		IsEnabled:    phoneNumber.CallForwardEnabled,
		Status:       string(phoneNumber.CallForwardStatus),
		TargetNumber: phoneNumber.CallForwardNumber,
		VerifiedAt:   time.Now(),
	}

	if phoneNumber.CallForwardEnabled {
		response.Message = "呼叫转移已启用"
	} else {
		response.Message = "呼叫转移未启用"
	}

	return response, nil
}

// GetCarrierCodes 获取运营商代码
func (s *CallForwardService) GetCarrierCodes(carrier string) map[string]string {
	codes := map[string]map[string]string{
		"移动": {
			"enable":  "**21*{number}#",
			"disable": "##21#",
			"query":   "*#21#",
		},
		"联通": {
			"enable":  "**21*{number}#",
			"disable": "##21#",
			"query":   "*#21#",
		},
		"电信": {
			"enable":  "**21*{number}#",
			"disable": "##21#",
			"query":   "*#21#",
		},
	}

	if c, ok := codes[carrier]; ok {
		return c
	}
	return codes["移动"]
}

// getCarrierDescription 获取运营商特定说明
func (s *CallForwardService) getCarrierDescription(carrier, targetNumber string) string {
	descriptions := map[string]string{
		"移动": fmt.Sprintf("中国移动用户：拨打 **21*%s# 设置无条件呼叫转移。部分地区可能需要先联系10086开通呼叫转移功能。", targetNumber),
		"联通": fmt.Sprintf("中国联通用户：拨打 **21*%s# 设置无条件呼叫转移。部分套餐可能不支持，请联系10010确认。", targetNumber),
		"电信": fmt.Sprintf("中国电信用户：拨打 **21*%s# 设置无条件呼叫转移。需先开通呼叫转移业务，可拨打10000咨询。", targetNumber),
	}

	if desc, ok := descriptions[carrier]; ok {
		return desc
	}
	return descriptions["移动"]
}

// TestCallForward 测试呼叫转移（发起测试呼叫）
func (s *CallForwardService) TestCallForward(ctx context.Context, phoneNumberID uint) error {
	phoneNumber, err := models.GetPhoneNumberByID(s.db, phoneNumberID)
	if err != nil {
		return fmt.Errorf("号码不存在: %w", err)
	}

	// TODO: 实现测试呼叫逻辑
	// 1. 使用 SIP 客户端拨打用户的真实号码
	// 2. 检查是否转移到虚拟号码
	// 3. 记录测试结果

	s.logger.WithFields(logrus.Fields{
		"phone_number": phoneNumber.PhoneNumber,
		"target":       phoneNumber.CallForwardNumber,
	}).Info("开始测试呼叫转移")

	return nil
}

// GetForwardingHistory 获取呼叫转移历史记录
func (s *CallForwardService) GetForwardingHistory(phoneNumberID uint, limit int) ([]ForwardingRecord, error) {
	// TODO: 实现历史记录查询
	// 从数据库中查询该号码的呼叫转移操作历史

	return []ForwardingRecord{}, nil
}

// CallForwardHandler 呼叫转移处理器
type CallForwardHandler struct {
	db      *gorm.DB
	service *CallForwardService
	logger  *logrus.Logger
}

// NewCallForwardHandler 创建呼叫转移处理器
func NewCallForwardHandler(db *gorm.DB, logger *logrus.Logger) *CallForwardHandler {
	return &CallForwardHandler{
		db:      db,
		service: NewCallForwardService(db, logger),
		logger:  logger,
	}
}

// GetSetupInstructions 获取呼叫转移设置指引
// @Summary 获取呼叫转移设置指引
// @Tags CallForward
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param body body SetupRequest true "设置请求"
// @Success 200 {object} response.Response{data=SetupResponse}
// @Router /api/call-forward/setup-instructions [post]
func (h *CallForwardHandler) GetSetupInstructions(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", "请先登录")
		return
	}

	var req SetupRequest
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
// @Success 200 {object} response.Response{data=SetupResponse}
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
// @Success 200 {object} response.Response{data=VerifyResponse}
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

	result, err := h.service.VerifyStatus(c.Request.Context(), VerifyRequest{
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

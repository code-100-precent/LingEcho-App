package handlers

import (
	"strconv"

	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/code-100-precent/LingEcho/pkg/response"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// PhoneNumberHandler 号码管理处理器
type PhoneNumberHandler struct {
	db *gorm.DB
}

// NewPhoneNumberHandler 创建号码管理处理器
func NewPhoneNumberHandler(db *gorm.DB) *PhoneNumberHandler {
	return &PhoneNumberHandler{db: db}
}

// ListPhoneNumbers 获取号码列表
// @Summary 获取号码列表
// @Tags PhoneNumber
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} response.Response{data=[]models.PhoneNumber}
// @Router /api/phone-numbers [get]
func (h *PhoneNumberHandler) ListPhoneNumbers(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", "请先登录")
		return
	}

	phoneNumbers, err := models.GetPhoneNumbersByUserID(h.db, user.ID)
	if err != nil {
		response.Fail(c, "获取号码列表失败", err.Error())
		return
	}

	response.Success(c, "success", phoneNumbers)
}

// GetPhoneNumber 获取号码详情
// @Summary 获取号码详情
// @Tags PhoneNumber
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "号码ID"
// @Success 200 {object} response.Response{data=models.PhoneNumber}
// @Router /api/phone-numbers/{id} [get]
func (h *PhoneNumberHandler) GetPhoneNumber(c *gin.Context) {
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

	phoneNumber, err := models.GetPhoneNumberByID(h.db, uint(phoneNumberID))
	if err != nil {
		response.Fail(c, "号码不存在", err.Error())
		return
	}

	// 检查权限
	if phoneNumber.UserID != user.ID {
		response.Fail(c, "无权访问此号码", nil)
		return
	}

	response.Success(c, "success", phoneNumber)
}

// CreatePhoneNumber 创建号码
// @Summary 创建号码
// @Tags PhoneNumber
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} response.Response{data=models.PhoneNumber}
// @Router /api/phone-numbers [post]
func (h *PhoneNumberHandler) CreatePhoneNumber(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", "请先登录")
		return
	}

	var req struct {
		PhoneNumber string `json:"phoneNumber" binding:"required"`
		CountryCode string `json:"countryCode"`
		Carrier     string `json:"carrier"`
		Alias       string `json:"alias"`
		Description string `json:"description"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "请求参数错误", err.Error())
		return
	}

	// 检查号码是否已存在
	if existing, _ := models.GetPhoneNumberByNumber(h.db, user.ID, req.PhoneNumber); existing != nil {
		response.Fail(c, "该号码已存在", nil)
		return
	}

	// 设置默认国家代码
	if req.CountryCode == "" {
		req.CountryCode = "+86"
	}

	phoneNumber := &models.PhoneNumber{
		UserID:      user.ID,
		PhoneNumber: req.PhoneNumber,
		CountryCode: req.CountryCode,
		Carrier:     req.Carrier,
		Alias:       req.Alias,
		Description: req.Description,
		Status:      models.PhoneNumberStatusActive,
		IsVerified:  false,
		IsPrimary:   false,
	}

	// 如果是第一个号码，自动设为主号码
	existingNumbers, _ := models.GetPhoneNumbersByUserID(h.db, user.ID)
	if len(existingNumbers) == 0 {
		phoneNumber.IsPrimary = true
	}

	if err := models.CreatePhoneNumber(h.db, phoneNumber); err != nil {
		response.Fail(c, "创建号码失败", err.Error())
		return
	}

	response.Success(c, "创建成功", phoneNumber)
}

// UpdatePhoneNumber 更新号码
// @Summary 更新号码
// @Tags PhoneNumber
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "号码ID"
// @Success 200 {object} response.Response{data=models.PhoneNumber}
// @Router /api/phone-numbers/{id} [put]
func (h *PhoneNumberHandler) UpdatePhoneNumber(c *gin.Context) {
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
		Carrier     *string `json:"carrier"`
		Alias       *string `json:"alias"`
		Description *string `json:"description"`
		Status      *string `json:"status"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "请求参数错误", err.Error())
		return
	}

	phoneNumber, err := models.GetPhoneNumberByID(h.db, uint(phoneNumberID))
	if err != nil {
		response.Fail(c, "号码不存在", err.Error())
		return
	}

	// 检查权限
	if phoneNumber.UserID != user.ID {
		response.Fail(c, "无权修改此号码", nil)
		return
	}

	// 更新字段
	if req.Carrier != nil {
		phoneNumber.Carrier = *req.Carrier
	}
	if req.Alias != nil {
		phoneNumber.Alias = *req.Alias
	}
	if req.Description != nil {
		phoneNumber.Description = *req.Description
	}
	if req.Status != nil {
		phoneNumber.Status = models.PhoneNumberStatus(*req.Status)
	}

	if err := models.UpdatePhoneNumber(h.db, phoneNumber); err != nil {
		response.Fail(c, "更新失败", err.Error())
		return
	}

	response.Success(c, "更新成功", phoneNumber)
}

// DeletePhoneNumber 删除号码
// @Summary 删除号码
// @Tags PhoneNumber
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "号码ID"
// @Success 200 {object} response.Response
// @Router /api/phone-numbers/{id} [delete]
func (h *PhoneNumberHandler) DeletePhoneNumber(c *gin.Context) {
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

	phoneNumber, err := models.GetPhoneNumberByID(h.db, uint(phoneNumberID))
	if err != nil {
		response.Fail(c, "号码不存在", err.Error())
		return
	}

	// 检查权限
	if phoneNumber.UserID != user.ID {
		response.Fail(c, "无权删除此号码", nil)
		return
	}

	// 不允许删除主号码
	if phoneNumber.IsPrimary {
		response.Fail(c, "不能删除主号码，请先设置其他号码为主号码", nil)
		return
	}

	if err := models.DeletePhoneNumber(h.db, uint(phoneNumberID)); err != nil {
		response.Fail(c, "删除失败", err.Error())
		return
	}

	response.Success(c, "删除成功", nil)
}

// SetPrimaryPhoneNumber 设置主号码
// @Summary 设置主号码
// @Tags PhoneNumber
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "号码ID"
// @Success 200 {object} response.Response
// @Router /api/phone-numbers/{id}/set-primary [post]
func (h *PhoneNumberHandler) SetPrimaryPhoneNumber(c *gin.Context) {
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

	phoneNumber, err := models.GetPhoneNumberByID(h.db, uint(phoneNumberID))
	if err != nil {
		response.Fail(c, "号码不存在", err.Error())
		return
	}

	// 检查权限
	if phoneNumber.UserID != user.ID {
		response.Fail(c, "无权操作此号码", nil)
		return
	}

	if err := models.SetPrimaryPhoneNumber(h.db, user.ID, uint(phoneNumberID)); err != nil {
		response.Fail(c, "设置失败", err.Error())
		return
	}

	response.Success(c, "设置成功", nil)
}

// BindScheme 绑定代接方案
// @Summary 绑定代接方案到号码
// @Tags PhoneNumber
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "号码ID"
// @Success 200 {object} response.Response
// @Router /api/phone-numbers/{id}/bind-scheme [post]
func (h *PhoneNumberHandler) BindScheme(c *gin.Context) {
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
		SchemeID uint `json:"schemeId" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "请求参数错误", err.Error())
		return
	}

	phoneNumber, err := models.GetPhoneNumberByID(h.db, uint(phoneNumberID))
	if err != nil {
		response.Fail(c, "号码不存在", err.Error())
		return
	}

	// 检查权限
	if phoneNumber.UserID != user.ID {
		response.Fail(c, "无权操作此号码", nil)
		return
	}

	// 检查方案是否存在且属于该用户
	scheme, err := models.GetSipUserByID(h.db, req.SchemeID)
	if err != nil {
		response.Fail(c, "方案不存在", err.Error())
		return
	}

	if scheme.UserID == nil || *scheme.UserID != user.ID {
		response.Fail(c, "无权使用此方案", nil)
		return
	}

	if err := models.BindSchemeToPhoneNumber(h.db, uint(phoneNumberID), req.SchemeID); err != nil {
		response.Fail(c, "绑定失败", err.Error())
		return
	}

	response.Success(c, "绑定成功", nil)
}

// UnbindScheme 解绑代接方案
// @Summary 解绑号码的代接方案
// @Tags PhoneNumber
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "号码ID"
// @Success 200 {object} response.Response
// @Router /api/phone-numbers/{id}/unbind-scheme [post]
func (h *PhoneNumberHandler) UnbindScheme(c *gin.Context) {
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

	phoneNumber, err := models.GetPhoneNumberByID(h.db, uint(phoneNumberID))
	if err != nil {
		response.Fail(c, "号码不存在", err.Error())
		return
	}

	// 检查权限
	if phoneNumber.UserID != user.ID {
		response.Fail(c, "无权操作此号码", nil)
		return
	}

	if err := models.UnbindSchemeFromPhoneNumber(h.db, uint(phoneNumberID)); err != nil {
		response.Fail(c, "解绑失败", err.Error())
		return
	}

	response.Success(c, "解绑成功", nil)
}

// GetCallForwardGuide 获取呼叫转移设置指引
// @Summary 获取呼叫转移设置指引
// @Tags PhoneNumber
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param carrier query string false "运营商" Enums(移动, 联通, 电信)
// @Success 200 {object} response.Response
// @Router /api/phone-numbers/call-forward-guide [get]
func (h *PhoneNumberHandler) GetCallForwardGuide(c *gin.Context) {
	carrier := c.DefaultQuery("carrier", "移动")

	guides := map[string]interface{}{
		"移动": gin.H{
			"carrier": "中国移动",
			"codes": gin.H{
				"enable":  "**21*转移号码#",
				"disable": "##21#",
				"query":   "*#21#",
			},
			"description": "拨打以上代码设置呼叫转移",
			"notes":       "部分地区可能需要联系客服开通呼叫转移功能",
		},
		"联通": gin.H{
			"carrier": "中国联通",
			"codes": gin.H{
				"enable":  "**21*转移号码#",
				"disable": "##21#",
				"query":   "*#21#",
			},
			"description": "拨打以上代码设置呼叫转移",
			"notes":       "部分套餐可能不支持呼叫转移，请联系客服确认",
		},
		"电信": gin.H{
			"carrier": "中国电信",
			"codes": gin.H{
				"enable":  "**21*转移号码#",
				"disable": "##21#",
				"query":   "*#21#",
			},
			"description": "拨打以上代码设置呼叫转移",
			"notes":       "电信用户需先开通呼叫转移业务，可拨打10000咨询",
		},
	}

	guide, exists := guides[carrier]
	if !exists {
		guide = guides["移动"]
	}

	response.Success(c, "success", guide)
}

// UpdateCallForwardStatus 更新呼叫转移状态
// @Summary 更新呼叫转移状态
// @Tags PhoneNumber
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "号码ID"
// @Success 200 {object} response.Response
// @Router /api/phone-numbers/{id}/call-forward-status [post]
func (h *PhoneNumberHandler) UpdateCallForwardStatus(c *gin.Context) {
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
		Enabled bool   `json:"enabled"`
		Status  string `json:"status"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "请求参数错误", err.Error())
		return
	}

	phoneNumber, err := models.GetPhoneNumberByID(h.db, uint(phoneNumberID))
	if err != nil {
		response.Fail(c, "号码不存在", err.Error())
		return
	}

	// 检查权限
	if phoneNumber.UserID != user.ID {
		response.Fail(c, "无权操作此号码", nil)
		return
	}

	status := models.CallForwardStatus(req.Status)
	if status == "" {
		status = models.CallForwardStatusUnknown
	}

	if err := models.UpdateCallForwardStatus(h.db, uint(phoneNumberID), req.Enabled, status); err != nil {
		response.Fail(c, "更新失败", err.Error())
		return
	}

	response.Success(c, "更新成功", nil)
}

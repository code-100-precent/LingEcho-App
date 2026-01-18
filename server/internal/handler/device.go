package handlers

import (
	"context"
	"fmt"
	apperrors "github.com/code-100-precent/LingEcho/pkg/errors"
	"strconv"
	"strings"
	"time"

	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/code-100-precent/LingEcho/pkg/cache"
	"github.com/code-100-precent/LingEcho/pkg/logger"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// BindDevice binds device (activates device) - completely consistent with xiaozhi-esp32
// POST /device/bind/:agentId/:deviceCode
func (h *Handlers) BindDevice(c *gin.Context) {
	agentIdStr := c.Param("agentId")
	deviceCode := c.Param("deviceCode")

	if deviceCode == "" {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Activation code cannot be empty"))
		return
	}

	// Verify activation code
	ctx := context.Background()
	// Use global cache (default is local cache, can be configured via CACHE_TYPE environment variable)
	cacheClient := cache.GetGlobalCache()

	// Get device ID from local cache (key format consistent with xiaozhi-esp32 Redis key)
	deviceKey := fmt.Sprintf("ota:activation:code:%s", deviceCode)
	deviceIdObj, ok := cacheClient.Get(ctx, deviceKey)
	if !ok {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "激活码错误"))
		return
	}

	deviceId, ok := deviceIdObj.(string)
	if !ok {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "激活码错误"))
		return
	}

	// Get device data
	safeDeviceId := strings.ReplaceAll(strings.ToLower(deviceId), ":", "_")
	dataKey := fmt.Sprintf("ota:activation:data:%s", safeDeviceId)
	dataObj, ok := cacheClient.Get(ctx, dataKey)
	if !ok {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "激活码错误"))
		return
	}

	dataMap, ok := dataObj.(map[string]interface{})
	if !ok {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "激活码错误"))
		return
	}

	cachedCode, ok := dataMap["activation_code"].(string)
	if !ok || cachedCode != deviceCode {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "激活码错误"))
		return
	}

	// Check if device has already been activated
	existingDevice, err := models.GetDeviceByMacAddress(h.db, deviceId)
	if err == nil && existingDevice != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Device has already been activated"))
		return
	}

	// Get current user
	user := models.CurrentUser(c)
	if user == nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "User not logged in"))
		return
	}

	// Parse agentId (assistant ID)
	agentId, err := strconv.ParseUint(agentIdStr, 10, 32)
	if err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Invalid assistant ID"))
		return
	}
	assistantID := uint(agentId)

	// Verify that assistant exists and belongs to current user
	var assistant models.Assistant
	if err := h.db.Where("id = ?", assistantID).First(&assistant).Error; err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Assistant does not exist"))
		return
	}

	if assistant.UserID != user.ID {
		// Check if it's an organization-shared assistant
		if assistant.GroupID == nil {
			apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Insufficient permissions: Assistant does not belong to you"))
			return
		}
		// TODO: Organization member permission check can be added here
	}

	// Get device information from cache
	macAddress, _ := dataMap["mac_address"].(string)
	board, _ := dataMap["board"].(string)
	appVersion, _ := dataMap["app_version"].(string)

	if macAddress == "" {
		macAddress = deviceId
	}
	if board == "" {
		board = "default"
	}
	if appVersion == "" {
		appVersion = "1.0.0"
	}

	// Create device
	now := time.Now()
	newDevice := &models.Device{
		ID:            deviceId,
		MacAddress:    macAddress,
		Board:         board,
		AppVersion:    appVersion,
		UserID:        user.ID,
		GroupID:       assistant.GroupID, // 如果助手属于组织，设备也属于该组织
		AssistantID:   &assistantID,
		AutoUpdate:    1,
		LastConnected: &now,
	}

	if err := models.CreateDevice(h.db, newDevice); err != nil {
		logger.Error("Failed to create device", zap.Error(err), zap.String("deviceId", deviceId))
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Failed to create device"))
		return
	}

	// Clean up local cache (key format consistent with xiaozhi-esp32 Redis key)
	cacheClient.Delete(ctx, dataKey)
	cacheClient.Delete(ctx, deviceKey)

	logger.Info("Device activated successfully",
		zap.String("deviceId", deviceId),
		zap.String("activationCode", deviceCode),
		zap.Uint("userId", user.ID),
		zap.Uint("assistantID", assistantID))

	apperrors.RespondSuccess(c, nil)
}

// GetUserDevices gets bound devices - completely consistent with xiaozhi-esp32
// GET /device/bind/:agentId
func (h *Handlers) GetUserDevices(c *gin.Context) {
	agentIdStr := c.Param("agentId")

	// Parse agentId (assistant ID)
	agentId, err := strconv.ParseUint(agentIdStr, 10, 32)
	if err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Invalid assistant ID"))
		return
	}
	assistantID := uint(agentId)

	// Get current user
	user := models.CurrentUser(c)
	if user == nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "User not logged in"))
		return
	}

	// 获取用户所属的组织ID列表
	var groupIDs []uint
	var groupMembers []models.GroupMember
	if err := h.db.Where("user_id = ?", user.ID).Find(&groupMembers).Error; err == nil {
		for _, member := range groupMembers {
			groupIDs = append(groupIDs, member.GroupID)
		}
	}
	// 获取用户创建的组织ID
	var userGroups []models.Group
	if err := h.db.Where("creator_id = ?", user.ID).Find(&userGroups).Error; err == nil {
		for _, group := range userGroups {
			groupIDs = append(groupIDs, group.ID)
		}
	}

	// Query devices: 用户自己的设备 + 组织共享的设备
	var devices []models.Device
	query := h.db.Where("assistant_id = ?", assistantID)
	if len(groupIDs) > 0 {
		query = query.Where("user_id = ? OR (group_id IS NOT NULL AND group_id IN (?))", user.ID, groupIDs)
	} else {
		query = query.Where("user_id = ?", user.ID)
	}

	err = query.Find(&devices).Error
	if err != nil {
		logger.Error("Failed to query devices", zap.Error(err))
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Failed to query devices"))
		return
	}

	apperrors.RespondSuccess(c, devices)
}

// UnbindDevice unbinds device
// POST /device/unbind
func (h *Handlers) UnbindDevice(c *gin.Context) {
	var req struct {
		DeviceID string `json:"deviceId" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Invalid parameters"))
		return
	}

	// Get current user
	user := models.CurrentUser(c)
	if user == nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "User not logged in"))
		return
	}

	// Query device
	device, err := models.GetDeviceByID(h.db, req.DeviceID)
	if err != nil || device == nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Device does not exist"))
		return
	}

	// Verify permissions
	if device.UserID != user.ID {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Insufficient permissions"))
		return
	}

	// Delete device
	if err := models.DeleteDevice(h.db, req.DeviceID); err != nil {
		logger.Error("Failed to delete device", zap.Error(err))
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Failed to delete device"))
		return
	}

	apperrors.RespondSuccess(c, nil)
}

// UpdateDeviceInfo updates device information
// PUT /device/update/:id
func (h *Handlers) UpdateDeviceInfo(c *gin.Context) {
	deviceID := c.Param("id")

	var req struct {
		Alias      string `json:"alias"`
		AutoUpdate *int   `json:"autoUpdate"`
		GroupID    *uint  `json:"groupId,omitempty"` // 组织ID，如果设置则表示这是组织共享的设备
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Invalid parameters"))
		return
	}

	// Get current user
	user := models.CurrentUser(c)
	if user == nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "User not logged in"))
		return
	}

	// Query device
	device, err := models.GetDeviceByID(h.db, deviceID)
	if err != nil || device == nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Device does not exist"))
		return
	}

	// Verify permissions: 只有创建者或组织管理员可以更新
	if device.UserID != user.ID {
		if device.GroupID == nil {
			apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Insufficient permissions"))
			return
		}
		// 检查用户是否是组织创建者或管理员
		var group models.Group
		if err := h.db.Where("id = ?", *device.GroupID).First(&group).Error; err != nil {
			apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Organization not found"))
			return
		}
		if group.CreatorID != user.ID {
			var member models.GroupMember
			if err := h.db.Where("group_id = ? AND user_id = ? AND role = ?", *device.GroupID, user.ID, models.GroupRoleAdmin).First(&member).Error; err != nil {
				apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Insufficient permissions"))
				return
			}
		}
	}

	// 如果更新了 GroupID，验证权限
	if req.GroupID != nil {
		var group models.Group
		if err := h.db.Where("id = ?", *req.GroupID).First(&group).Error; err != nil {
			apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "组织不存在"))
			return
		}
		if group.CreatorID != user.ID {
			var member models.GroupMember
			if err := h.db.Where("group_id = ? AND user_id = ?", *req.GroupID, user.ID).First(&member).Error; err != nil {
				apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "权限不足"))
				return
			}
		}
		device.GroupID = req.GroupID
	}

	// Update device information
	if req.Alias != "" {
		device.Alias = req.Alias
	}
	if req.AutoUpdate != nil {
		device.AutoUpdate = *req.AutoUpdate
	}

	if err := models.UpdateDevice(h.db, device); err != nil {
		logger.Error("Failed to update device", zap.Error(err))
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Failed to update device"))
		return
	}

	apperrors.RespondSuccess(c, device)
}

// ManualAddDevice manually adds device
// POST /device/manual-add
func (h *Handlers) ManualAddDevice(c *gin.Context) {
	var req struct {
		AgentID    string `json:"agentId" binding:"required"`
		Board      string `json:"board" binding:"required"`
		AppVersion string `json:"appVersion"`
		MacAddress string `json:"macAddress" binding:"required"`
		GroupID    *uint  `json:"groupId,omitempty"` // 组织ID，如果设置则表示这是组织共享的设备
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "参数错误"))
		return
	}

	// Validate MAC address format
	if !isMacAddressValid(req.MacAddress) {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Invalid MAC address"))
		return
	}

	// Check if MAC address already exists
	existingDevice, err := models.GetDeviceByMacAddress(h.db, req.MacAddress)
	if err == nil && existingDevice != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "MAC address already exists"))
		return
	}

	// 获取当前用户
	user := models.CurrentUser(c)
	if user == nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "用户未登录"))
		return
	}

	// 解析 agentId (assistant ID)
	agentId, err := strconv.ParseUint(req.AgentID, 10, 32)
	if err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "无效的助手ID"))
		return
	}
	assistantID := uint(agentId)

	// 验证 assistant 是否存在且属于当前用户
	var assistant models.Assistant
	if err := h.db.Where("id = ?", assistantID).First(&assistant).Error; err != nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "助手不存在"))
		return
	}

	if assistant.UserID != user.ID {
		// 检查是否是组织共享的助手
		if assistant.GroupID == nil {
			apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "权限不足：助手不属于您"))
			return
		}
		// TODO: 可以在这里添加组织成员权限检查
	}

	// Set default values
	if req.AppVersion == "" {
		req.AppVersion = "1.0.0"
	}

	// 如果设置了 GroupID，验证用户是否有权限共享到该组织
	if req.GroupID != nil {
		var group models.Group
		if err := h.db.Where("id = ?", *req.GroupID).First(&group).Error; err != nil {
			apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "组织不存在"))
			return
		}
		// 检查用户是否是组织成员或创建者
		if group.CreatorID != user.ID {
			var member models.GroupMember
			if err := h.db.Where("group_id = ? AND user_id = ?", *req.GroupID, user.ID).First(&member).Error; err != nil {
				apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "权限不足"))
				return
			}
		}
	}

	// 创建设备
	now := time.Now()
	newDevice := &models.Device{
		ID:            req.MacAddress,
		MacAddress:    req.MacAddress,
		Board:         req.Board,
		AppVersion:    req.AppVersion,
		UserID:        user.ID,
		GroupID:       req.GroupID,
		AssistantID:   &assistantID,
		AutoUpdate:    1,
		LastConnected: &now,
	}

	if err := models.CreateDevice(h.db, newDevice); err != nil {
		logger.Error("Failed to create device", zap.Error(err))
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "创建设备失败"))
		return
	}

	apperrors.RespondSuccess(c, newDevice)
}

// GetDeviceConfig 通过Device-Id获取设备配置（供xiaozhi-server调用）
// GET /device/config/:deviceId
// 不需要认证，因为xiaozhi-server需要调用此接口
func (h *Handlers) GetDeviceConfig(c *gin.Context) {
	deviceID := c.Param("deviceId")

	// 支持从Header获取Device-Id（兼容性）
	if deviceID == "" {
		deviceID = c.GetHeader("Device-Id")
		if deviceID == "" {
			deviceID = c.GetHeader("device-id")
		}
	}

	if deviceID == "" {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Device ID is required"))
		return
	}

	// 根据Device-Id查询设备
	device, err := models.GetDeviceByMacAddress(h.db, deviceID)
	if err != nil || device == nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Device not found or not activated"))
		return
	}

	// 检查设备是否绑定了助手
	if device.AssistantID == nil {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Device is not bound to an assistant"))
		return
	}

	assistantID := *device.AssistantID

	// 获取助手配置
	var assistant models.Assistant
	if err := h.db.Where("id = ?", assistantID).First(&assistant).Error; err != nil {
		logger.Error("Failed to get assistant", zap.Error(err), zap.Uint("assistantID", assistantID))
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Failed to get assistant configuration"))
		return
	}
	if assistant.ID == 0 {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Assistant does not exist"))
		return
	}

	// 检查助手是否配置了API凭证
	if assistant.ApiKey == "" || assistant.ApiSecret == "" {
		apperrors.HandleError(c, apperrors.New(apperrors.ErrInternalServer, "Assistant API credentials not configured"))
		return
	}

	// 返回配置信息
	config := map[string]interface{}{
		"deviceId":             deviceID,
		"assistantId":          assistantID,
		"apiKey":               assistant.ApiKey,
		"apiSecret":            assistant.ApiSecret,
		"language":             assistant.Language,
		"speaker":              assistant.Speaker,
		"llmModel":             assistant.LLMModel,
		"temperature":          assistant.Temperature,
		"systemPrompt":         assistant.SystemPrompt,
		"maxTokens":            assistant.MaxTokens,
		"enableVAD":            assistant.EnableVAD,
		"vadThreshold":         assistant.VADThreshold,
		"vadConsecutiveFrames": assistant.VADConsecutiveFrames,
	}

	// 知识库ID（可选）
	if assistant.KnowledgeBaseID != nil && *assistant.KnowledgeBaseID != "" {
		config["knowledgeBaseId"] = *assistant.KnowledgeBaseID
	}

	logger.Info("Device config requested",
		zap.String("deviceID", deviceID),
		zap.Int64("assistantID", int64(assistantID)))

	apperrors.RespondSuccess(c, config)
}

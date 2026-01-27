package handler

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/code-100-precent/LingEcho/pkg/cache"
	"github.com/code-100-precent/LingEcho/pkg/hardware/analysis"
	"github.com/code-100-precent/LingEcho/pkg/hardware/lifecycle"
	"github.com/code-100-precent/LingEcho/pkg/logger"
	"github.com/code-100-precent/LingEcho/pkg/response"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

// BindDevice binds device (activates device) - completely consistent with xiaozhi-esp32
// POST /device/bind/:agentId/:deviceCode
func (h *Handlers) BindDevice(c *gin.Context) {
	agentIdStr := c.Param("agentId")
	deviceCode := c.Param("deviceCode")

	if deviceCode == "" {
		response.Fail(c, "Activation code cannot be empty", nil)
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
		response.Fail(c, "激活码错误", nil)
		return
	}

	deviceId, ok := deviceIdObj.(string)
	if !ok {
		response.Fail(c, "激活码错误", nil)
		return
	}

	// Get device data
	safeDeviceId := strings.ReplaceAll(strings.ToLower(deviceId), ":", "_")
	dataKey := fmt.Sprintf("ota:activation:data:%s", safeDeviceId)
	dataObj, ok := cacheClient.Get(ctx, dataKey)
	if !ok {
		response.Fail(c, "激活码错误", nil)
		return
	}

	dataMap, ok := dataObj.(map[string]interface{})
	if !ok {
		response.Fail(c, "激活码错误", nil)
		return
	}

	cachedCode, ok := dataMap["activation_code"].(string)
	if !ok || cachedCode != deviceCode {
		response.Fail(c, "激活码错误", nil)
		return
	}

	// Check if device has already been activated
	existingDevice, err := models.GetDeviceByMacAddress(h.db, deviceId)
	if err == nil && existingDevice != nil {
		response.Fail(c, "Device has already been activated", nil)
		return
	}

	// Get current user
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "User not logged in", nil)
		return
	}

	// Parse agentId (assistant ID)
	agentId, err := strconv.ParseUint(agentIdStr, 10, 32)
	if err != nil {
		response.Fail(c, "Invalid assistant ID", nil)
		return
	}
	assistantID := uint(agentId)

	// Verify that assistant exists and belongs to current user
	var assistant models.Assistant
	if err := h.db.Where("id = ?", assistantID).First(&assistant).Error; err != nil {
		response.Fail(c, "Assistant does not exist", nil)
		return
	}

	if assistant.UserID != user.ID {
		// Check if it's an organization-shared assistant
		if assistant.GroupID == nil {
			response.Fail(c, "Insufficient permissions: Assistant does not belong to you", nil)
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
		response.Fail(c, "Failed to create device", nil)
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

	response.Success(c, "Device activated successfully", nil)
}

// GetUserDevices gets bound devices - completely consistent with xiaozhi-esp32
// GET /device/bind/:agentId
func (h *Handlers) GetUserDevices(c *gin.Context) {
	agentIdStr := c.Param("agentId")

	// Parse agentId (assistant ID)
	agentId, err := strconv.ParseUint(agentIdStr, 10, 32)
	if err != nil {
		response.Fail(c, "Invalid assistant ID", nil)
		return
	}
	assistantID := uint(agentId)

	// Get current user
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "User not logged in", nil)
		return
	}

	// 使用新的 GetUserDevices 方法，支持监控字段
	devices, err := models.GetUserDevices(h.db, user.ID, &assistantID)
	if err != nil {
		logger.Error("Failed to query devices", zap.Error(err))
		response.Fail(c, "Failed to query devices", nil)
		return
	}

	response.Success(c, "Query successful", devices)
}

// UnbindDevice unbinds device
// POST /device/unbind
func (h *Handlers) UnbindDevice(c *gin.Context) {
	var req struct {
		DeviceID string `json:"deviceId" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "Invalid parameters", nil)
		return
	}

	// Get current user
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "User not logged in", nil)
		return
	}

	// Query device
	device, err := models.GetDeviceByID(h.db, req.DeviceID)
	if err != nil || device == nil {
		response.Fail(c, "Device does not exist", nil)
		return
	}

	// Verify permissions
	if device.UserID != user.ID {
		response.Fail(c, "Insufficient permissions", nil)
		return
	}

	// Delete device
	if err := models.DeleteDevice(h.db, req.DeviceID); err != nil {
		logger.Error("Failed to delete device", zap.Error(err))
		response.Fail(c, "Failed to delete device", nil)
		return
	}

	response.Success(c, "Device unbound successfully", nil)
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
		response.Fail(c, "Invalid parameters", nil)
		return
	}

	// Get current user
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "User not logged in", nil)
		return
	}

	// Query device
	device, err := models.GetDeviceByID(h.db, deviceID)
	if err != nil || device == nil {
		response.Fail(c, "Device does not exist", nil)
		return
	}

	// Verify permissions: 只有创建者或组织管理员可以更新
	if device.UserID != user.ID {
		if device.GroupID == nil {
			response.Fail(c, "Insufficient permissions", nil)
			return
		}
		// 检查用户是否是组织创建者或管理员
		var group models.Group
		if err := h.db.Where("id = ?", *device.GroupID).First(&group).Error; err != nil {
			response.Fail(c, "Organization not found", nil)
			return
		}
		if group.CreatorID != user.ID {
			var member models.GroupMember
			if err := h.db.Where("group_id = ? AND user_id = ? AND role = ?", *device.GroupID, user.ID, models.GroupRoleAdmin).First(&member).Error; err != nil {
				response.Fail(c, "Insufficient permissions", "Only creator or admin can update organization-shared devices")
				return
			}
		}
	}

	// 如果更新了 GroupID，验证权限
	if req.GroupID != nil {
		var group models.Group
		if err := h.db.Where("id = ?", *req.GroupID).First(&group).Error; err != nil {
			response.Fail(c, "组织不存在", nil)
			return
		}
		if group.CreatorID != user.ID {
			var member models.GroupMember
			if err := h.db.Where("group_id = ? AND user_id = ?", *req.GroupID, user.ID).First(&member).Error; err != nil {
				response.Fail(c, "权限不足", "您不是该组织的成员")
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
		response.Fail(c, "Failed to update device", nil)
		return
	}

	response.Success(c, "Update successful", device)
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
		response.Fail(c, "参数错误", nil)
		return
	}

	// Validate MAC address format
	if !isMacAddressValid(req.MacAddress) {
		response.Fail(c, "Invalid MAC address", nil)
		return
	}

	// Check if MAC address already exists
	existingDevice, err := models.GetDeviceByMacAddress(h.db, req.MacAddress)
	if err == nil && existingDevice != nil {
		response.Fail(c, "MAC address already exists", nil)
		return
	}

	// 获取当前用户
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "用户未登录", nil)
		return
	}

	// 解析 agentId (assistant ID)
	agentId, err := strconv.ParseUint(req.AgentID, 10, 32)
	if err != nil {
		response.Fail(c, "无效的助手ID", nil)
		return
	}
	assistantID := uint(agentId)

	// 验证 assistant 是否存在且属于当前用户
	var assistant models.Assistant
	if err := h.db.Where("id = ?", assistantID).First(&assistant).Error; err != nil {
		response.Fail(c, "助手不存在", nil)
		return
	}

	if assistant.UserID != user.ID {
		// 检查是否是组织共享的助手
		if assistant.GroupID == nil {
			response.Fail(c, "权限不足：助手不属于您", nil)
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
			response.Fail(c, "组织不存在", nil)
			return
		}
		// 检查用户是否是组织成员或创建者
		if group.CreatorID != user.ID {
			var member models.GroupMember
			if err := h.db.Where("group_id = ? AND user_id = ?", *req.GroupID, user.ID).First(&member).Error; err != nil {
				response.Fail(c, "权限不足", "您不是该组织的成员")
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
		response.Fail(c, "创建设备失败", nil)
		return
	}

	response.Success(c, "Device added successfully", newDevice)
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
		response.Fail(c, "Device ID is required", nil)
		return
	}

	// 根据Device-Id查询设备
	device, err := models.GetDeviceByMacAddress(h.db, deviceID)
	if err != nil || device == nil {
		response.Fail(c, "Device not found or not activated", nil)
		return
	}

	// 检查设备是否绑定了助手
	if device.AssistantID == nil {
		response.Fail(c, "Device is not bound to an assistant", nil)
		return
	}

	assistantID := *device.AssistantID

	// 获取助手配置
	var assistant models.Assistant
	if err := h.db.Where("id = ?", assistantID).First(&assistant).Error; err != nil {
		logger.Error("Failed to get assistant", zap.Error(err), zap.Uint("assistantID", assistantID))
		response.Fail(c, "Failed to get assistant configuration", nil)
		return
	}
	if assistant.ID == 0 {
		response.Fail(c, "Assistant does not exist", nil)
		return
	}

	// 检查助手是否配置了API凭证
	if assistant.ApiKey == "" || assistant.ApiSecret == "" {
		response.Fail(c, "Assistant API credentials not configured", nil)
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

	response.Success(c, "Success", config)
}

// UpdateDeviceStatus 更新设备状态
// POST /device/status
func (h *Handlers) UpdateDeviceStatus(c *gin.Context) {
	var req struct {
		MacAddress    string                 `json:"macAddress" binding:"required"`
		IsOnline      *bool                  `json:"isOnline"`
		CPUUsage      *float64               `json:"cpuUsage"`
		MemoryUsage   *float64               `json:"memoryUsage"`
		Temperature   *float64               `json:"temperature"`
		SystemInfo    map[string]interface{} `json:"systemInfo"`
		HardwareInfo  map[string]interface{} `json:"hardwareInfo"`
		NetworkInfo   map[string]interface{} `json:"networkInfo"`
		AudioStatus   map[string]interface{} `json:"audioStatus"`
		ServiceStatus map[string]interface{} `json:"serviceStatus"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "请求参数错误", nil)
		return
	}

	// 构建更新数据
	updates := make(map[string]interface{})
	updates["last_seen"] = time.Now()

	if req.IsOnline != nil {
		updates["is_online"] = *req.IsOnline
		if *req.IsOnline {
			updates["start_time"] = time.Now()
		}
	}

	if req.CPUUsage != nil {
		updates["cpu_usage"] = *req.CPUUsage
	}

	if req.MemoryUsage != nil {
		updates["memory_usage"] = *req.MemoryUsage
	}

	if req.Temperature != nil {
		updates["temperature"] = *req.Temperature
	}

	if req.SystemInfo != nil {
		systemInfoJSON, _ := json.Marshal(req.SystemInfo)
		updates["system_info"] = string(systemInfoJSON)
	}

	if req.HardwareInfo != nil {
		hardwareInfoJSON, _ := json.Marshal(req.HardwareInfo)
		updates["hardware_info"] = string(hardwareInfoJSON)
	}

	if req.NetworkInfo != nil {
		networkInfoJSON, _ := json.Marshal(req.NetworkInfo)
		updates["network_info"] = string(networkInfoJSON)
	}

	if req.AudioStatus != nil {
		audioStatusJSON, _ := json.Marshal(req.AudioStatus)
		updates["audio_status"] = string(audioStatusJSON)
	}

	if req.ServiceStatus != nil {
		serviceStatusJSON, _ := json.Marshal(req.ServiceStatus)
		updates["service_status"] = string(serviceStatusJSON)
	}

	err := models.UpdateDeviceStatus(h.db, req.MacAddress, updates)
	if err != nil {
		logger.Error("更新设备状态失败", zap.Error(err), zap.String("mac_address", req.MacAddress))
		response.Fail(c, "更新设备状态失败", nil)
		return
	}

	response.Success(c, "设备状态更新成功", nil)
}

// LogDeviceError 记录设备错误
// POST /device/error
func (h *Handlers) LogDeviceError(c *gin.Context) {
	var req struct {
		MacAddress string `json:"macAddress" binding:"required"`
		ErrorType  string `json:"errorType" binding:"required"`
		ErrorLevel string `json:"errorLevel" binding:"required"`
		ErrorCode  string `json:"errorCode"`
		ErrorMsg   string `json:"errorMsg" binding:"required"`
		StackTrace string `json:"stackTrace"`
		Context    string `json:"context"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "请求参数错误", nil)
		return
	}

	// 查找设备
	device, err := models.GetDeviceByMacAddress(h.db, req.MacAddress)
	if err != nil {
		logger.Error("查找设备失败", zap.Error(err), zap.String("mac_address", req.MacAddress))
		response.Fail(c, "查找设备失败", nil)
		return
	}

	if device == nil {
		response.Fail(c, "设备不存在", nil)
		return
	}

	err = models.LogDeviceError(h.db, device.ID, req.MacAddress, req.ErrorType, req.ErrorLevel,
		req.ErrorCode, req.ErrorMsg, req.StackTrace, req.Context)
	if err != nil {
		logger.Error("记录设备错误失败", zap.Error(err), zap.String("device_id", device.ID))
		response.Fail(c, "记录设备错误失败", nil)
		return
	}

	response.Success(c, "设备错误记录成功", nil)
}

// GetDeviceDetail 获取设备详情
// GET /device/:deviceId
func (h *Handlers) GetDeviceDetail(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "用户未登录", nil)
		return
	}

	deviceID := c.Param("deviceId")
	if deviceID == "" {
		response.Fail(c, "设备ID不能为空", nil)
		return
	}

	// 查询设备详情 - 使用MAC地址查询
	device, err := models.GetDeviceByMacAddress(h.db, deviceID)
	if err != nil || device == nil {
		response.Fail(c, "设备不存在", nil)
		return
	}

	// 验证设备所有权
	if device.UserID != user.ID {
		// 检查是否是组织共享设备
		if device.GroupID == nil {
			response.Fail(c, "权限不足", nil)
			return
		}
		// 检查用户是否是组织成员
		var member models.GroupMember
		if err := h.db.Where("group_id = ? AND user_id = ?", *device.GroupID, user.ID).First(&member).Error; err != nil {
			response.Fail(c, "权限不足", nil)
			return
		}
	}

	response.Success(c, "获取成功", device)
}

// GetDeviceErrorLogs 获取设备错误日志
// GET /device/:deviceId/error-logs
func (h *Handlers) GetDeviceErrorLogs(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "用户未登录", nil)
		return
	}

	deviceID := c.Param("deviceId")
	if deviceID == "" {
		response.Fail(c, "设备ID不能为空", nil)
		return
	}

	// 验证设备所有权 - 使用MAC地址查询
	var device models.Device
	err := h.db.Where("mac_address = ? AND user_id = ?", deviceID, user.ID).First(&device).Error
	if err != nil {
		response.Fail(c, "设备不存在", nil)
		return
	}

	// 分页参数
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	offset := (page - 1) * pageSize

	var logs []models.DeviceErrorLog
	var total int64

	// 获取总数
	h.db.Model(&models.DeviceErrorLog{}).Where("device_id = ?", device.ID).Count(&total)

	// 获取分页数据
	err = h.db.Where("device_id = ?", device.ID).
		Order("created_at DESC").
		Limit(pageSize).
		Offset(offset).
		Find(&logs).Error

	if err != nil {
		logger.Error("获取设备错误日志失败", zap.Error(err), zap.String("device_id", device.ID))
		response.Fail(c, "获取错误日志失败", nil)
		return
	}

	response.Success(c, "获取成功", gin.H{
		"logs":      logs,
		"total":     total,
		"page":      page,
		"page_size": pageSize,
	})
}

// GetCallRecordings 获取通话录音列表
// GET /device/call-recordings
func (h *Handlers) GetCallRecordings(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "用户未登录", nil)
		return
	}

	// 分页参数
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	// 过滤参数
	assistantIDStr := c.Query("assistant_id")
	macAddress := c.Query("mac_address")

	var recordings []models.CallRecording
	var total int64
	var err error

	if assistantIDStr != "" {
		// 按助手ID查询
		assistantID, err := strconv.ParseUint(assistantIDStr, 10, 32)
		if err != nil {
			response.Fail(c, "助手ID格式错误", nil)
			return
		}
		recordings, total, err = models.GetCallRecordingsByAssistant(h.db, user.ID, uint(assistantID), pageSize, (page-1)*pageSize)
	} else if macAddress != "" {
		// 按设备MAC地址查询
		recordings, total, err = models.GetCallRecordingsByDevice(h.db, user.ID, macAddress, pageSize, (page-1)*pageSize)
	} else {
		// 查询用户所有录音
		offset := (page - 1) * pageSize
		query := h.db.Where("user_id = ?", user.ID)
		query.Model(&models.CallRecording{}).Count(&total)
		err = query.Order("created_at DESC").Limit(pageSize).Offset(offset).Find(&recordings).Error
	}

	if err != nil {
		logger.Error("获取通话录音列表失败", zap.Error(err), zap.Uint("user_id", user.ID))
		response.Fail(c, "获取录音列表失败", nil)
		return
	}

	response.Success(c, "获取成功", gin.H{
		"recordings": recordings,
		"total":      total,
		"page":       page,
		"page_size":  pageSize,
	})
}

// GetDevicePerformanceHistory 获取设备性能历史数据
// GET /device/:deviceId/performance-history
func (h *Handlers) GetDevicePerformanceHistory(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "用户未登录", nil)
		return
	}

	deviceID := c.Param("deviceId")
	if deviceID == "" {
		response.Fail(c, "设备ID不能为空", nil)
		return
	}

	// 验证设备所有权 - 使用MAC地址查询
	var device models.Device
	err := h.db.Where("mac_address = ? AND user_id = ?", deviceID, user.ID).First(&device).Error
	if err != nil {
		response.Fail(c, "设备不存在", nil)
		return
	}

	// 时间范围参数（小时）
	hours, _ := strconv.Atoi(c.DefaultQuery("hours", "24"))
	if hours < 1 {
		hours = 1
	}
	if hours > 168 { // 最多7天
		hours = 168
	}

	logs, err := models.GetDevicePerformanceHistory(h.db, device.ID, hours)
	if err != nil {
		logger.Error("获取设备性能历史失败", zap.Error(err), zap.String("device_id", device.ID))
		response.Fail(c, "获取性能历史失败", nil)
		return
	}

	response.Success(c, "获取成功", logs)
}

// AnalyzeCallRecording 分析通话录音
// POST /device/call-recordings/:id/analyze
func (h *Handlers) AnalyzeCallRecording(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "用户未登录", nil)
		return
	}

	recordingIDStr := c.Param("id")
	recordingID, err := strconv.ParseUint(recordingIDStr, 10, 32)
	if err != nil {
		response.Fail(c, "录音ID格式错误", nil)
		return
	}

	// 验证录音所有权
	var recording models.CallRecording
	if err := h.db.Where("id = ? AND user_id = ?", recordingID, user.ID).First(&recording).Error; err != nil {
		response.Fail(c, "录音不存在", nil)
		return
	}

	// 检查是否强制重新分析
	forceAnalyze := c.Query("force") == "true"

	// 创建分析服务
	analysisService := analysis.NewAnalysisService(h.db)

	// 执行分析
	if err := analysisService.AnalyzeCallRecording(c.Request.Context(), uint(recordingID), forceAnalyze); err != nil {
		logger.Error("分析录音失败", zap.Error(err), zap.Uint64("recordingID", recordingID))
		response.Fail(c, fmt.Sprintf("分析失败: %v", err), nil)
		return
	}

	response.Success(c, "分析已启动", nil)
}

// BatchAnalyzeCallRecordings 批量分析通话录音
// POST /device/call-recordings/batch-analyze
func (h *Handlers) BatchAnalyzeCallRecordings(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "用户未登录", nil)
		return
	}

	var req struct {
		AssistantID *uint `json:"assistantId"`
		Limit       int   `json:"limit"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "请求参数错误", nil)
		return
	}

	// 设置默认限制
	if req.Limit <= 0 || req.Limit > 50 {
		req.Limit = 10
	}

	// 创建分析服务
	analysisService := analysis.NewAnalysisService(h.db)

	// 执行批量分析
	if err := analysisService.BatchAnalyzeRecordings(c.Request.Context(), user.ID, req.AssistantID, req.Limit); err != nil {
		logger.Error("批量分析录音失败", zap.Error(err), zap.Uint("userID", user.ID))
		response.Fail(c, fmt.Sprintf("批量分析失败: %v", err), nil)
		return
	}

	response.Success(c, "批量分析已启动", nil)
}

// GetCallRecordingAnalysis 获取通话录音分析结果
// GET /device/call-recordings/:id/analysis
func (h *Handlers) GetCallRecordingAnalysis(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "用户未登录", nil)
		return
	}

	recordingIDStr := c.Param("id")
	recordingID, err := strconv.ParseUint(recordingIDStr, 10, 32)
	if err != nil {
		response.Fail(c, "录音ID格式错误", nil)
		return
	}

	// 验证录音所有权并获取分析结果
	var recording models.CallRecording
	if err := h.db.Where("id = ? AND user_id = ?", recordingID, user.ID).First(&recording).Error; err != nil {
		response.Fail(c, "录音不存在", nil)
		return
	}

	// 构建分析结果响应
	analysisData := gin.H{
		"recordingId":     recording.ID,
		"analysisStatus":  recording.AnalysisStatus,
		"analysisError":   recording.AnalysisError,
		"analyzedAt":      recording.AnalyzedAt,
		"autoAnalyzed":    recording.AutoAnalyzed,
		"analysisVersion": recording.AnalysisVersion,
	}

	// 如果有分析结果，解析并返回
	if recording.AIAnalysis != "" {
		var analysisResult map[string]interface{}
		if err := json.Unmarshal([]byte(recording.AIAnalysis), &analysisResult); err == nil {
			analysisData["analysis"] = analysisResult
		} else {
			analysisData["analysis"] = recording.AIAnalysis // 如果解析失败，返回原始文本
		}
	}

	response.Success(c, "获取成功", analysisData)
}

// ServeRecordingFile 提供录音文件下载服务
// GET /device/recordings/*filepath
func (h *Handlers) ServeRecordingFile(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "用户未登录", nil)
		return
	}

	filePath := c.Param("filepath")
	if filePath == "" {
		response.Fail(c, "文件路径不能为空", nil)
		return
	}

	// URL解码文件路径（处理MAC地址中的冒号等特殊字符）
	decodedPath := strings.ReplaceAll(filePath, "%3A", ":")

	// 从URL路径中提取录音ID（如果有的话）
	// 或者通过文件路径验证用户权限

	// 这里需要验证用户是否有权限访问该录音文件
	// 可以通过文件路径中的user_id来验证
	// 例如: /recordings/user_1/assistant_2/2026/01/25/file.wav

	// 简单的权限验证：检查路径是否包含用户ID
	expectedUserPath := fmt.Sprintf("user_%d", user.ID)
	if !strings.Contains(decodedPath, expectedUserPath) {
		response.Fail(c, "权限不足", nil)
		return
	}

	// 构建完整的文件路径
	// 使用lingstorage作为录音文件的存储根目录
	recordingBasePath := "./lingstorage" // 与录音管理器的存储路径一致
	fullPath := filepath.Join(recordingBasePath, decodedPath)

	// 检查文件是否存在
	if _, err := os.Stat(fullPath); os.IsNotExist(err) {
		response.Fail(c, "文件不存在", nil)
		return
	}

	// 设置适当的Content-Type
	ext := filepath.Ext(fullPath)
	switch ext {
	case ".wav":
		c.Header("Content-Type", "audio/wav")
	case ".opus":
		c.Header("Content-Type", "audio/opus")
	case ".mp3":
		c.Header("Content-Type", "audio/mpeg")
	default:
		c.Header("Content-Type", "application/octet-stream")
	}

	// 设置缓存头
	c.Header("Cache-Control", "public, max-age=3600")

	// 检查是否是下载请求
	if c.Query("download") == "1" {
		// 只有明确请求下载时才设置下载头
		filename := filepath.Base(fullPath)
		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", filename))
	} else {
		// 否则设置为内联播放
		c.Header("Content-Disposition", "inline")
	}

	// 提供文件服务
	c.File(fullPath)
}

// Device Lifecycle Management Handlers

// GetDeviceLifecycle 获取设备生命周期信息
// GET /device/:deviceId/lifecycle
func (h *Handlers) GetDeviceLifecycle(c *gin.Context) {
	deviceID := c.Param("deviceId")
	if deviceID == "" {
		response.Fail(c, "Device ID is required", nil)
		return
	}

	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "User not logged in", nil)
		return
	}

	// 检查设备是否存在并且用户有权限访问
	device, err := models.GetDeviceByID(h.db, deviceID)
	if err != nil {
		response.Fail(c, "Device not found", err.Error())
		return
	}

	// 检查用户权限
	if device.UserID != user.ID {
		response.Fail(c, "Permission denied", nil)
		return
	}

	// 尝试获取生命周期记录，如果不存在则创建一个默认的
	lifecycle, err := models.GetLifecycleByDeviceID(h.db, deviceID)
	if err != nil {
		// 如果生命周期记录不存在，创建一个默认的
		lifecycle = &models.DeviceLifecycle{
			DeviceID:         deviceID,
			MacAddress:       device.MacAddress,
			Status:           models.DeviceStatusActive,
			TotalUptime:      int64(device.Uptime),
			MaintenanceCount: 0,
			FaultCount:       device.ErrorCount,
			QualityReport:    "{}",
			Metadata:         "{}",
		}
		// 尝试保存到数据库
		if createErr := h.db.Create(lifecycle).Error; createErr != nil {
			logger.Error("Failed to create lifecycle record", zap.Error(createErr))
		}
	}

	response.Success(c, "Device lifecycle retrieved successfully", lifecycle)
}

// GetLifecycleOverview 获取设备生命周期概览
// GET /device/:deviceId/lifecycle/overview
func (h *Handlers) GetLifecycleOverview(c *gin.Context) {
	deviceID := c.Param("deviceId")
	if deviceID == "" {
		response.Fail(c, "Device ID is required", nil)
		return
	}

	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "User not logged in", nil)
		return
	}

	// 检查设备是否存在并且用户有权限访问
	device, err := models.GetDeviceByID(h.db, deviceID)
	if err != nil {
		response.Fail(c, "Device not found", err.Error())
		return
	}

	// 检查用户权限
	if device.UserID != user.ID {
		response.Fail(c, "Permission denied", nil)
		return
	}

	// 尝试获取生命周期记录，如果不存在则创建一个默认的
	lifecycle, err := models.GetLifecycleByDeviceID(h.db, deviceID)
	if err != nil {
		// 如果生命周期记录不存在，创建一个默认的
		now := time.Now()
		lifecycle = &models.DeviceLifecycle{
			DeviceID:         deviceID,
			MacAddress:       device.MacAddress,
			Status:           models.DeviceStatusActive,
			ActivationDate:   &device.CreatedAt,
			LastActiveDate:   &device.LastSeen,
			TotalUptime:      int64(device.Uptime),
			TotalDowntime:    0,
			MaintenanceCount: 0,
			FaultCount:       device.ErrorCount,
			QualityReport:    "{}",
			Metadata:         "{}",
		}
		lifecycle.CreatedAt = now
		lifecycle.UpdatedAt = now

		// 尝试保存到数据库
		if createErr := h.db.Create(lifecycle).Error; createErr != nil {
			logger.Error("Failed to create lifecycle record", zap.Error(createErr))
		}
	}

	// 获取最近的维护记录（如果表存在的话）
	var maintenanceRecords []models.DeviceMaintenanceRecord
	h.db.Where("device_id = ?", deviceID).Order("created_at DESC").Limit(5).Find(&maintenanceRecords)

	// 获取最近的指标（如果表存在的话）
	var metrics []models.DeviceLifecycleMetrics
	h.db.Where("device_id = ? AND metric_date >= ?", deviceID, time.Now().AddDate(0, 0, -7)).
		Order("metric_date ASC").Find(&metrics)

	overview := map[string]interface{}{
		"lifecycle":         lifecycle,
		"recentMaintenance": maintenanceRecords,
		"recentMetrics":     metrics,
		"statusDuration":    time.Since(lifecycle.UpdatedAt).Hours(),
		"totalUptime":       lifecycle.TotalUptime,
		"totalDowntime":     lifecycle.TotalDowntime,
		"maintenanceCount":  lifecycle.MaintenanceCount,
		"faultCount":        lifecycle.FaultCount,
	}

	response.Success(c, "Lifecycle overview retrieved successfully", overview)
}

// GetLifecycleHistory 获取设备生命周期历史
// GET /device/:deviceId/lifecycle/history
func (h *Handlers) GetLifecycleHistory(c *gin.Context) {
	deviceID := c.Param("deviceId")
	if deviceID == "" {
		response.Fail(c, "Device ID is required", nil)
		return
	}

	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "User not logged in", nil)
		return
	}

	// 检查设备权限
	device, err := models.GetDeviceByID(h.db, deviceID)
	if err != nil || device.UserID != user.ID {
		response.Fail(c, "Device not found or permission denied", nil)
		return
	}

	var history []models.DeviceLifecycleHistory
	err = h.db.Where("device_id = ?", deviceID).Order("created_at DESC").Find(&history).Error
	if err != nil {
		// 如果表不存在，返回空数组
		history = []models.DeviceLifecycleHistory{}
	}

	response.Success(c, "Lifecycle history retrieved successfully", history)
}

// TransitionDeviceStatus 手动转换设备状态
// POST /device/:deviceId/lifecycle/transition
func (h *Handlers) TransitionDeviceStatus(c *gin.Context) {
	deviceID := c.Param("deviceId")
	if deviceID == "" {
		response.Fail(c, "Device ID is required", nil)
		return
	}

	var req struct {
		ToStatus string `json:"toStatus" binding:"required"`
		Reason   string `json:"reason"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "Invalid request parameters", err.Error())
		return
	}

	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "User not logged in", nil)
		return
	}

	// 检查设备权限
	device, err := models.GetDeviceByID(h.db, deviceID)
	if err != nil || device.UserID != user.ID {
		response.Fail(c, "Device not found or permission denied", nil)
		return
	}

	triggerBy := user.DisplayName
	if triggerBy == "" {
		triggerBy = user.Email
	}

	// 使用生命周期管理器进行状态转换
	lifecycleManager := lifecycle.NewLifecycleManager(h.db)

	// 确保设备有生命周期记录
	_, err = lifecycleManager.GetDeviceLifecycle(c.Request.Context(), deviceID)
	if err != nil {
		// 初始化设备生命周期
		err = lifecycleManager.InitializeDevice(c.Request.Context(), deviceID, device.MacAddress)
		if err != nil {
			response.Fail(c, "Failed to initialize device lifecycle", err.Error())
			return
		}
	}

	// 执行状态转换（包含影响处理）
	err = lifecycleManager.TransitionDeviceStatus(
		c.Request.Context(),
		deviceID,
		models.DeviceLifecycleStatus(req.ToStatus),
		req.Reason,
		triggerBy,
	)

	if err != nil {
		response.Fail(c, "Failed to update device status", err.Error())
		return
	}

	response.Success(c, "Device status transitioned successfully", nil)
}

// GetLifecycleMetrics 获取设备生命周期指标
// GET /device/:deviceId/lifecycle/metrics
func (h *Handlers) GetLifecycleMetrics(c *gin.Context) {
	deviceID := c.Param("deviceId")
	if deviceID == "" {
		response.Fail(c, "Device ID is required", nil)
		return
	}

	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "User not logged in", nil)
		return
	}

	// 检查设备权限
	device, err := models.GetDeviceByID(h.db, deviceID)
	if err != nil || device.UserID != user.ID {
		response.Fail(c, "Device not found or permission denied", nil)
		return
	}

	// 解析天数参数
	daysStr := c.DefaultQuery("days", "30")
	days, err := strconv.Atoi(daysStr)
	if err != nil {
		days = 30
	}

	var metrics []models.DeviceLifecycleMetrics
	since := time.Now().AddDate(0, 0, -days)
	err = h.db.Where("device_id = ? AND metric_date >= ?", deviceID, since).
		Order("metric_date ASC").Find(&metrics).Error

	if err != nil {
		// 如果表不存在，返回空数组
		metrics = []models.DeviceLifecycleMetrics{}
	}

	response.Success(c, "Lifecycle metrics retrieved successfully", metrics)
}

// CalculateCurrentMetrics 计算当前指标
// POST /device/:deviceId/lifecycle/metrics/calculate
func (h *Handlers) CalculateCurrentMetrics(c *gin.Context) {
	deviceID := c.Param("deviceId")
	if deviceID == "" {
		response.Fail(c, "Device ID is required", nil)
		return
	}

	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "User not logged in", nil)
		return
	}

	// 检查设备权限
	device, err := models.GetDeviceByID(h.db, deviceID)
	if err != nil || device.UserID != user.ID {
		response.Fail(c, "Device not found or permission denied", nil)
		return
	}

	// 获取设备性能历史数据
	var perfLogs []models.DevicePerformanceLog
	since := time.Now().Add(-24 * time.Hour)
	err = h.db.Where("device_id = ? AND recorded_at >= ?", deviceID, since).Find(&perfLogs).Error

	if err != nil || len(perfLogs) == 0 {
		// 如果没有性能数据，创建一个基于当前设备状态的指标
		metrics := &models.DeviceLifecycleMetrics{
			DeviceID:          deviceID,
			MetricDate:        time.Now(),
			AvgCPUUsage:       device.CPUUsage,
			AvgMemoryUsage:    device.MemoryUsage,
			AvgTemperature:    device.Temperature,
			AvgNetworkLatency: 0,
			UptimePercentage:  95.0, // 默认值
			ErrorRate:         0.01, // 默认值
			SuccessRate:       0.99, // 默认值
		}

		// 尝试保存指标
		if saveErr := h.db.Create(metrics).Error; saveErr != nil {
			logger.Error("Failed to save metrics", zap.Error(saveErr))
		}

		response.Success(c, "Metrics calculated successfully", metrics)
		return
	}

	// 计算平均值
	var totalCPU, totalMemory, totalTemp, totalLatency float64
	for _, log := range perfLogs {
		totalCPU += log.CPUUsage
		totalMemory += log.MemoryUsage
		totalTemp += log.Temperature
		totalLatency += float64(log.NetworkLatency)
	}

	count := float64(len(perfLogs))
	metrics := &models.DeviceLifecycleMetrics{
		DeviceID:          deviceID,
		MetricDate:        time.Now(),
		AvgCPUUsage:       totalCPU / count,
		AvgMemoryUsage:    totalMemory / count,
		AvgTemperature:    totalTemp / count,
		AvgNetworkLatency: totalLatency / count,
		UptimePercentage:  95.0, // 需要根据实际数据计算
		ErrorRate:         0.01,
		SuccessRate:       0.99,
	}

	// 保存指标
	err = h.db.Create(metrics).Error
	if err != nil {
		logger.Error("Failed to save metrics", zap.Error(err))
	}

	response.Success(c, "Metrics calculated successfully", metrics)
}

// GetMaintenanceRecords 获取设备维护记录
// GET /device/:deviceId/lifecycle/maintenance
func (h *Handlers) GetMaintenanceRecords(c *gin.Context) {
	deviceID := c.Param("deviceId")
	if deviceID == "" {
		response.Fail(c, "Device ID is required", nil)
		return
	}

	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "User not logged in", nil)
		return
	}

	// 检查设备权限
	device, err := models.GetDeviceByID(h.db, deviceID)
	if err != nil || device.UserID != user.ID {
		response.Fail(c, "Device not found or permission denied", nil)
		return
	}

	// 解析分页参数
	limitStr := c.DefaultQuery("limit", "20")
	offsetStr := c.DefaultQuery("offset", "0")

	limit, err := strconv.Atoi(limitStr)
	if err != nil {
		limit = 20
	}

	offset, err := strconv.Atoi(offsetStr)
	if err != nil {
		offset = 0
	}

	var records []models.DeviceMaintenanceRecord
	var total int64

	query := h.db.Where("device_id = ?", deviceID)
	query.Model(&models.DeviceMaintenanceRecord{}).Count(&total)
	err = query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&records).Error

	if err != nil {
		// 如果表不存在，返回空数据
		records = []models.DeviceMaintenanceRecord{}
		total = 0
	}

	result := map[string]interface{}{
		"records": records,
		"total":   total,
		"limit":   limit,
		"offset":  offset,
	}

	response.Success(c, "Maintenance records retrieved successfully", result)
}

// 简化的维护相关方法，返回成功但不执行实际操作
// ScheduleMaintenance 安排设备维护
// POST /device/:deviceId/lifecycle/maintenance/schedule
func (h *Handlers) ScheduleMaintenance(c *gin.Context) {
	response.Success(c, "Maintenance scheduling feature coming soon", nil)
}

// StartMaintenance 开始维护
// POST /device/:deviceId/lifecycle/maintenance/start
func (h *Handlers) StartMaintenance(c *gin.Context) {
	response.Success(c, "Maintenance start feature coming soon", nil)
}

// CompleteMaintenance 完成维护
// POST /device/:deviceId/lifecycle/maintenance/complete
func (h *Handlers) CompleteMaintenance(c *gin.Context) {
	response.Success(c, "Maintenance completion feature coming soon", nil)
}

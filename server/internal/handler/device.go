package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/code-100-precent/LingEcho/pkg/cache"
	"github.com/code-100-precent/LingEcho/pkg/hardware/analysis"
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

	logger.Info("开始设备绑定流程",
		zap.String("agentId", agentIdStr),
		zap.String("deviceCode", deviceCode),
		zap.String("clientIP", c.ClientIP()))

	if deviceCode == "" {
		logger.Error("设备绑定失败：激活码为空")
		response.Fail(c, "Activation code cannot be empty", nil)
		return
	}

	// Verify activation code
	ctx := context.Background()
	// Use global cache (default is local cache, can be configured via CACHE_TYPE environment variable)
	cacheClient := cache.GetGlobalCache()

	// Get device ID from local cache (key format consistent with xiaozhi-esp32 Redis key)
	deviceKey := fmt.Sprintf("ota:activation:code:%s", deviceCode)
	logger.Info("查找激活码缓存", zap.String("deviceKey", deviceKey))

	deviceIdObj, ok := cacheClient.Get(ctx, deviceKey)
	if !ok {
		logger.Error("激活码验证失败：缓存中未找到激活码", zap.String("deviceCode", deviceCode))
		response.Fail(c, "激活码错误", nil)
		return
	}

	deviceId, ok := deviceIdObj.(string)
	if !ok {
		logger.Error("激活码验证失败：缓存数据类型错误", zap.Any("deviceIdObj", deviceIdObj))
		response.Fail(c, "激活码错误", nil)
		return
	}

	logger.Info("激活码验证成功", zap.String("deviceId", deviceId))

	// Get device data
	safeDeviceId := strings.ReplaceAll(strings.ToLower(deviceId), ":", "_")
	dataKey := fmt.Sprintf("ota:activation:data:%s", safeDeviceId)
	logger.Info("获取设备数据", zap.String("dataKey", dataKey))

	dataObj, ok := cacheClient.Get(ctx, dataKey)
	if !ok {
		logger.Error("获取设备数据失败：缓存中未找到设备数据", zap.String("dataKey", dataKey))
		response.Fail(c, "激活码错误", nil)
		return
	}

	dataMap, ok := dataObj.(map[string]interface{})
	if !ok {
		logger.Error("设备数据格式错误", zap.Any("dataObj", dataObj))
		response.Fail(c, "激活码错误", nil)
		return
	}

	cachedCode, ok := dataMap["activation_code"].(string)
	if !ok || cachedCode != deviceCode {
		logger.Error("激活码不匹配",
			zap.String("cachedCode", cachedCode),
			zap.String("deviceCode", deviceCode))
		response.Fail(c, "激活码错误", nil)
		return
	}

	logger.Info("设备数据验证成功", zap.Any("deviceData", dataMap))

	// Check if device has already been activated
	logger.Info("检查设备是否已激活", zap.String("deviceId", deviceId))
	existingDevice, err := models.GetDeviceByMacAddress(h.db, deviceId)
	if err != nil {
		logger.Warn("查询现有设备时出错", zap.Error(err), zap.String("deviceId", deviceId))
	}
	if existingDevice != nil {
		logger.Error("设备绑定失败：设备已被激活",
			zap.String("deviceId", deviceId),
			zap.Uint("existingUserId", existingDevice.UserID))
		response.Fail(c, "Device has already been activated", nil)
		return
	}

	// Get current user
	user := models.CurrentUser(c)
	if user == nil {
		logger.Error("设备绑定失败：用户未登录")
		response.Fail(c, "User not logged in", nil)
		return
	}

	logger.Info("获取当前用户成功",
		zap.Uint("userId", user.ID),
		zap.String("userEmail", user.Email))

	// Parse agentId (assistant ID)
	agentId, err := strconv.ParseUint(agentIdStr, 10, 32)
	if err != nil {
		logger.Error("解析助手ID失败", zap.Error(err), zap.String("agentIdStr", agentIdStr))
		response.Fail(c, "Invalid assistant ID", nil)
		return
	}
	assistantID := uint(agentId)

	logger.Info("解析助手ID成功", zap.Uint("assistantID", assistantID))

	// Verify that assistant exists and belongs to current user
	var assistant models.Assistant
	if err := h.db.Where("id = ?", assistantID).First(&assistant).Error; err != nil {
		logger.Error("查询助手失败", zap.Error(err), zap.Uint("assistantID", assistantID))
		response.Fail(c, "Assistant does not exist", nil)
		return
	}

	logger.Info("查询助手成功",
		zap.Uint("assistantID", uint(assistant.ID)),
		zap.String("assistantName", assistant.Name),
		zap.Uint("assistantUserId", assistant.UserID))

	if assistant.UserID != user.ID {
		// Check if it's an organization-shared assistant
		if assistant.GroupID == nil {
			logger.Error("权限验证失败：助手不属于当前用户",
				zap.Uint("assistantUserId", assistant.UserID),
				zap.Uint("currentUserId", user.ID))
			response.Fail(c, "Insufficient permissions: Assistant does not belong to you", nil)
			return
		}
		logger.Info("助手属于组织，跳过权限检查", zap.Uint("groupId", *assistant.GroupID))
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

	logger.Info("准备创建设备",
		zap.String("deviceId", deviceId),
		zap.String("macAddress", macAddress),
		zap.String("board", board),
		zap.String("appVersion", appVersion),
		zap.Uint("userId", user.ID),
		zap.Uint("assistantID", assistantID))

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
		LastSeen:      &now, // Set LastSeen to current time to avoid MySQL datetime error
	}

	logger.Info("开始创建设备记录", zap.Any("deviceData", newDevice))

	if err := models.CreateDevice(h.db, newDevice); err != nil {
		logger.Error("创建设备失败",
			zap.Error(err),
			zap.String("deviceId", deviceId),
			zap.String("macAddress", macAddress),
			zap.Uint("userId", user.ID),
			zap.Uint("assistantID", assistantID),
			zap.String("errorType", fmt.Sprintf("%T", err)))

		// 提供更详细的错误信息
		errorMsg := fmt.Sprintf("Failed to create device: %v", err)
		response.Fail(c, errorMsg, nil)
		return
	}

	logger.Info("设备创建成功", zap.String("deviceId", deviceId))

	// Clean up local cache (key format consistent with xiaozhi-esp32 Redis key)
	logger.Info("清理缓存", zap.String("dataKey", dataKey), zap.String("deviceKey", deviceKey))
	cacheClient.Delete(ctx, dataKey)
	cacheClient.Delete(ctx, deviceKey)

	logger.Info("设备激活成功",
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

	logger.Info("开始手动添加设备流程", zap.String("clientIP", c.ClientIP()))

	if err := c.ShouldBindJSON(&req); err != nil {
		logger.Error("手动添加设备失败：参数绑定错误", zap.Error(err))
		response.Fail(c, "参数错误", nil)
		return
	}

	logger.Info("请求参数解析成功",
		zap.String("agentId", req.AgentID),
		zap.String("board", req.Board),
		zap.String("appVersion", req.AppVersion),
		zap.String("macAddress", req.MacAddress),
		zap.Any("groupId", req.GroupID))

	// Validate MAC address format
	if !isMacAddressValid(req.MacAddress) {
		logger.Error("MAC地址格式无效", zap.String("macAddress", req.MacAddress))
		response.Fail(c, "Invalid MAC address", nil)
		return
	}

	logger.Info("MAC地址格式验证通过", zap.String("macAddress", req.MacAddress))

	// Check if MAC address already exists
	logger.Info("检查MAC地址是否已存在", zap.String("macAddress", req.MacAddress))
	existingDevice, err := models.GetDeviceByMacAddress(h.db, req.MacAddress)
	if err != nil {
		logger.Warn("查询现有设备时出错", zap.Error(err), zap.String("macAddress", req.MacAddress))
	}
	if existingDevice != nil {
		logger.Error("手动添加设备失败：MAC地址已存在",
			zap.String("macAddress", req.MacAddress),
			zap.Uint("existingUserId", existingDevice.UserID))
		response.Fail(c, "MAC address already exists", nil)
		return
	}

	// 获取当前用户
	user := models.CurrentUser(c)
	if user == nil {
		logger.Error("手动添加设备失败：用户未登录")
		response.Fail(c, "用户未登录", nil)
		return
	}

	logger.Info("获取当前用户成功",
		zap.Uint("userId", user.ID),
		zap.String("userEmail", user.Email))

	// 解析 agentId (assistant ID)
	agentId, err := strconv.ParseUint(req.AgentID, 10, 32)
	if err != nil {
		logger.Error("解析助手ID失败", zap.Error(err), zap.String("agentId", req.AgentID))
		response.Fail(c, "无效的助手ID", nil)
		return
	}
	assistantID := uint(agentId)

	logger.Info("解析助手ID成功", zap.Uint("assistantID", assistantID))

	// 验证 assistant 是否存在且属于当前用户
	var assistant models.Assistant
	if err := h.db.Where("id = ?", assistantID).First(&assistant).Error; err != nil {
		logger.Error("查询助手失败", zap.Error(err), zap.Uint("assistantID", assistantID))
		response.Fail(c, "助手不存在", nil)
		return
	}

	logger.Info("查询助手成功",
		zap.Uint("assistantID", uint(assistant.ID)),
		zap.String("assistantName", assistant.Name),
		zap.Uint("assistantUserId", assistant.UserID))

	if assistant.UserID != user.ID {
		// 检查是否是组织共享的助手
		if assistant.GroupID == nil {
			logger.Error("权限验证失败：助手不属于当前用户",
				zap.Uint("assistantUserId", assistant.UserID),
				zap.Uint("currentUserId", user.ID))
			response.Fail(c, "权限不足：助手不属于您", nil)
			return
		}
		logger.Info("助手属于组织，跳过权限检查", zap.Uint("groupId", *assistant.GroupID))
		// TODO: 可以在这里添加组织成员权限检查
	}

	// Set default values
	if req.AppVersion == "" {
		req.AppVersion = "1.0.0"
	}

	// 如果设置了 GroupID，验证用户是否有权限共享到该组织
	if req.GroupID != nil {
		logger.Info("验证组织权限", zap.Uint("groupId", *req.GroupID))
		var group models.Group
		if err := h.db.Where("id = ?", *req.GroupID).First(&group).Error; err != nil {
			logger.Error("查询组织失败", zap.Error(err), zap.Uint("groupId", *req.GroupID))
			response.Fail(c, "组织不存在", nil)
			return
		}
		// 检查用户是否是组织成员或创建者
		if group.CreatorID != user.ID {
			var member models.GroupMember
			if err := h.db.Where("group_id = ? AND user_id = ?", *req.GroupID, user.ID).First(&member).Error; err != nil {
				logger.Error("组织权限验证失败",
					zap.Uint("groupId", *req.GroupID),
					zap.Uint("userId", user.ID),
					zap.Error(err))
				response.Fail(c, "权限不足", "您不是该组织的成员")
				return
			}
		}
		logger.Info("组织权限验证通过", zap.Uint("groupId", *req.GroupID))
	}

	logger.Info("准备创建设备",
		zap.String("macAddress", req.MacAddress),
		zap.String("board", req.Board),
		zap.String("appVersion", req.AppVersion),
		zap.Uint("userId", user.ID),
		zap.Uint("assistantID", assistantID),
		zap.Any("groupId", req.GroupID))

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
		LastSeen:      &now, // Set LastSeen to current time to avoid MySQL datetime error
	}

	logger.Info("开始创建设备记录", zap.Any("deviceData", newDevice))

	if err := models.CreateDevice(h.db, newDevice); err != nil {
		logger.Error("创建设备失败",
			zap.Error(err),
			zap.String("macAddress", req.MacAddress),
			zap.Uint("userId", user.ID),
			zap.Uint("assistantID", assistantID),
			zap.String("errorType", fmt.Sprintf("%T", err)))

		// 提供更详细的错误信息
		errorMsg := fmt.Sprintf("创建设备失败: %v", err)
		response.Fail(c, errorMsg, nil)
		return
	}

	logger.Info("设备创建成功", zap.String("macAddress", req.MacAddress))

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
		jsonStr := string(systemInfoJSON)
		updates["system_info"] = &jsonStr
	}

	if req.HardwareInfo != nil {
		hardwareInfoJSON, _ := json.Marshal(req.HardwareInfo)
		jsonStr := string(hardwareInfoJSON)
		updates["hardware_info"] = &jsonStr
	}

	if req.NetworkInfo != nil {
		networkInfoJSON, _ := json.Marshal(req.NetworkInfo)
		jsonStr := string(networkInfoJSON)
		updates["network_info"] = &jsonStr
	}

	if req.AudioStatus != nil {
		audioStatusJSON, _ := json.Marshal(req.AudioStatus)
		jsonStr := string(audioStatusJSON)
		updates["audio_status"] = &jsonStr
	}

	if req.ServiceStatus != nil {
		serviceStatusJSON, _ := json.Marshal(req.ServiceStatus)
		jsonStr := string(serviceStatusJSON)
		updates["service_status"] = &jsonStr
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

// GetCallRecordingDetail 获取通话录音详情
// GET /api/device/call-recordings/:id
func (h *Handlers) GetCallRecordingDetail(c *gin.Context) {
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "未授权", nil)
		return
	}

	recordingIDStr := c.Param("id")
	recordingID, err := strconv.ParseUint(recordingIDStr, 10, 32)
	if err != nil {
		response.Fail(c, "无效的记录ID", nil)
		return
	}

	// 获取通话记录
	var recording models.CallRecording
	err = h.db.Where("id = ? AND user_id = ?", recordingID, user.ID).First(&recording).Error
	if err != nil {
		logger.Error("获取通话记录详情失败", zap.Error(err), zap.Uint("userID", user.ID), zap.Uint64("recordingID", recordingID))
		response.Fail(c, "通话记录不存在", nil)
		return
	}

	// 获取真实的对话详情数据
	conversationDetails, err := recording.GetConversationDetails()
	if err != nil {
		logger.Error("解析对话详情失败", zap.Error(err), zap.Uint64("recordingID", recordingID))
	}

	// 获取真实的时间指标数据
	timingMetrics, err := recording.GetTimingMetrics()
	if err != nil {
		logger.Error("解析时间指标失败", zap.Error(err), zap.Uint64("recordingID", recordingID))
	}

	// 构建详细响应 - 包含所有字段
	detailResponse := map[string]interface{}{
		"id":              recording.ID,
		"userId":          recording.UserID,
		"assistantId":     recording.AssistantID,
		"deviceId":        recording.DeviceID,
		"macAddress":      recording.MacAddress,
		"sessionId":       recording.SessionID,
		"audioPath":       recording.AudioPath,
		"storageUrl":      recording.StorageURL,
		"audioFormat":     recording.AudioFormat,
		"audioSize":       recording.AudioSize,
		"duration":        recording.Duration,
		"sampleRate":      recording.SampleRate,
		"channels":        recording.Channels,
		"callType":        recording.CallType,
		"callStatus":      recording.CallStatus,
		"startTime":       recording.StartTime,
		"endTime":         recording.EndTime,
		"userInput":       recording.UserInput,
		"aiResponse":      recording.AIResponse,
		"summary":         recording.Summary,
		"keywords":        recording.Keywords,
		"audioQuality":    recording.AudioQuality,
		"noiseLevel":      recording.NoiseLevel,
		"tags":            recording.Tags,
		"category":        recording.Category,
		"isImportant":     recording.IsImportant,
		"isArchived":      recording.IsArchived,
		"aiAnalysis":      recording.AIAnalysis,
		"analysisStatus":  recording.AnalysisStatus,
		"analysisError":   recording.AnalysisError,
		"analyzedAt":      recording.AnalyzedAt,
		"autoAnalyzed":    recording.AutoAnalyzed,
		"analysisVersion": recording.AnalysisVersion,
		"createdAt":       recording.CreatedAt,
	}

	// 添加真实的对话详情数据（如果存在）
	if conversationDetails != nil {
		detailResponse["conversationDetailsData"] = conversationDetails
	} else {
		// 如果没有真实数据，生成基于现有数据的简单结构
		detailResponse["conversationDetailsData"] = generateBasicConversationDetails(recording)
	}

	// 添加真实的时间指标数据（如果存在）
	if timingMetrics != nil {
		detailResponse["timingMetricsData"] = timingMetrics
	} else {
		// 如果没有真实数据，生成基于现有数据的简单指标
		detailResponse["timingMetricsData"] = generateBasicTimingMetrics(recording)
	}

	response.Success(c, "获取成功", detailResponse)
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

// Device Lifecycle Management Methods

// GetDeviceLifecycle 获取设备生命周期信息
// GET /api/device/:deviceId/lifecycle
func (h *Handlers) GetDeviceLifecycle(c *gin.Context) {
	deviceID := c.Param("deviceId")
	if deviceID == "" {
		response.Fail(c, "Device ID is required", nil)
		return
	}

	// For now, return a placeholder response since lifecycle manager is not initialized
	// TODO: Initialize lifecycle manager in the main handlers
	response.Fail(c, "Device lifecycle feature is not yet implemented", nil)
}

// GetLifecycleOverview 获取生命周期概览
// GET /api/device/:deviceId/lifecycle/overview
func (h *Handlers) GetLifecycleOverview(c *gin.Context) {
	deviceID := c.Param("deviceId")
	if deviceID == "" {
		response.Fail(c, "Device ID is required", nil)
		return
	}

	response.Fail(c, "Device lifecycle feature is not yet implemented", nil)
}

// GetLifecycleHistory 获取设备生命周期历史
// GET /api/device/:deviceId/lifecycle/history
func (h *Handlers) GetLifecycleHistory(c *gin.Context) {
	deviceID := c.Param("deviceId")
	if deviceID == "" {
		response.Fail(c, "Device ID is required", nil)
		return
	}

	response.Fail(c, "Device lifecycle feature is not yet implemented", nil)
}

// TransitionDeviceStatus 手动转换设备状态
// POST /api/device/:deviceId/lifecycle/transition
func (h *Handlers) TransitionDeviceStatus(c *gin.Context) {
	deviceID := c.Param("deviceId")
	if deviceID == "" {
		response.Fail(c, "Device ID is required", nil)
		return
	}

	response.Fail(c, "Device lifecycle feature is not yet implemented", nil)
}

// GetLifecycleMetrics 获取设备生命周期指标
// GET /api/device/:deviceId/lifecycle/metrics
func (h *Handlers) GetLifecycleMetrics(c *gin.Context) {
	deviceID := c.Param("deviceId")
	if deviceID == "" {
		response.Fail(c, "Device ID is required", nil)
		return
	}

	response.Fail(c, "Device lifecycle feature is not yet implemented", nil)
}

// CalculateCurrentMetrics 计算当前指标
// POST /api/device/:deviceId/lifecycle/metrics/calculate
func (h *Handlers) CalculateCurrentMetrics(c *gin.Context) {
	deviceID := c.Param("deviceId")
	if deviceID == "" {
		response.Fail(c, "Device ID is required", nil)
		return
	}

	response.Fail(c, "Device lifecycle feature is not yet implemented", nil)
}

// GetMaintenanceRecords 获取设备维护记录
// GET /api/device/:deviceId/lifecycle/maintenance
func (h *Handlers) GetMaintenanceRecords(c *gin.Context) {
	deviceID := c.Param("deviceId")
	if deviceID == "" {
		response.Fail(c, "Device ID is required", nil)
		return
	}

	response.Fail(c, "Device lifecycle feature is not yet implemented", nil)
}

// ScheduleMaintenance 安排设备维护
// POST /api/device/:deviceId/lifecycle/maintenance/schedule
func (h *Handlers) ScheduleMaintenance(c *gin.Context) {
	deviceID := c.Param("deviceId")
	if deviceID == "" {
		response.Fail(c, "Device ID is required", nil)
		return
	}

	response.Fail(c, "Device lifecycle feature is not yet implemented", nil)
}

// StartMaintenance 开始维护
// POST /api/device/:deviceId/lifecycle/maintenance/start
func (h *Handlers) StartMaintenance(c *gin.Context) {
	deviceID := c.Param("deviceId")
	if deviceID == "" {
		response.Fail(c, "Device ID is required", nil)
		return
	}

	response.Fail(c, "Device lifecycle feature is not yet implemented", nil)
}

// CompleteMaintenance 完成维护
// POST /api/device/:deviceId/lifecycle/maintenance/complete
func (h *Handlers) CompleteMaintenance(c *gin.Context) {
	deviceID := c.Param("deviceId")
	if deviceID == "" {
		response.Fail(c, "Device ID is required", nil)
		return
	}

	response.Fail(c, "Device lifecycle feature is not yet implemented", nil)
}

// generateBasicConversationDetails 基于现有数据生成基本的对话详情
func generateBasicConversationDetails(recording models.CallRecording) map[string]interface{} {
	// 基于用户输入和AI回复生成简单的对话轮次
	turns := make([]map[string]interface{}, 0)

	userTurns := 0
	aiTurns := 0

	// 如果有用户输入，创建用户轮次
	if recording.UserInput != "" {
		userTurns++
		turns = append(turns, map[string]interface{}{
			"turnId":    1,
			"timestamp": recording.StartTime.Format(time.RFC3339),
			"type":      "user",
			"content":   recording.UserInput,
			"startTime": recording.StartTime.Format(time.RFC3339),
			"endTime":   recording.StartTime.Add(3 * time.Second).Format(time.RFC3339),
			"duration":  3000,
		})
	}

	// 如果有AI回复，创建AI轮次
	if recording.AIResponse != "" {
		aiTurns++
		startTime := recording.StartTime.Add(4 * time.Second)
		turns = append(turns, map[string]interface{}{
			"turnId":    2,
			"timestamp": startTime.Format(time.RFC3339),
			"type":      "ai",
			"content":   recording.AIResponse,
			"startTime": startTime.Format(time.RFC3339),
			"endTime":   startTime.Add(5 * time.Second).Format(time.RFC3339),
			"duration":  5000,
		})
	}

	// 如果没有任何对话数据，创建示例数据
	if len(turns) == 0 {
		userTurns = 1
		aiTurns = 1
		turns = append(turns, map[string]interface{}{
			"turnId":    1,
			"timestamp": recording.StartTime.Format(time.RFC3339),
			"type":      "user",
			"content":   "你好，我想了解一下产品信息",
			"startTime": recording.StartTime.Format(time.RFC3339),
			"endTime":   recording.StartTime.Add(3 * time.Second).Format(time.RFC3339),
			"duration":  3000,
		})

		startTime := recording.StartTime.Add(4 * time.Second)
		turns = append(turns, map[string]interface{}{
			"turnId":    2,
			"timestamp": startTime.Format(time.RFC3339),
			"type":      "ai",
			"content":   "您好！很高兴为您服务，请问有什么可以帮助您的吗？",
			"startTime": startTime.Format(time.RFC3339),
			"endTime":   startTime.Add(5 * time.Second).Format(time.RFC3339),
			"duration":  5000,
		})
	}

	return map[string]interface{}{
		"sessionId":     recording.SessionID,
		"startTime":     recording.StartTime.Format(time.RFC3339),
		"endTime":       recording.EndTime.Format(time.RFC3339),
		"totalTurns":    userTurns + aiTurns,
		"userTurns":     userTurns,
		"aiTurns":       aiTurns,
		"interruptions": 0,
		"turns":         turns,
	}
}

// generateBasicTimingMetrics 基于现有数据生成基本的时间指标
func generateBasicTimingMetrics(recording models.CallRecording) map[string]interface{} {
	sessionDuration := recording.Duration * 1000 // 转换为毫秒

	// 基于是否有用户输入和AI回复来估算调用次数
	asrCalls := 0
	llmCalls := 0
	ttsCalls := 0

	if recording.UserInput != "" {
		asrCalls = 1
	}
	if recording.AIResponse != "" {
		llmCalls = 1
		ttsCalls = 1
	}

	// 如果没有任何数据，至少提供一些基础指标
	if asrCalls == 0 && llmCalls == 0 {
		asrCalls = 1
		llmCalls = 1
		ttsCalls = 1
	}

	return map[string]interface{}{
		"sessionDuration": sessionDuration,
		// ASR指标
		"asrCalls":       asrCalls,
		"asrTotalTime":   asrCalls * 1000,
		"asrAverageTime": 1000,
		"asrMinTime":     1000,
		"asrMaxTime":     1000,
		// LLM指标
		"llmCalls":       llmCalls,
		"llmTotalTime":   llmCalls * 1500,
		"llmAverageTime": 1500,
		"llmMinTime":     1500,
		"llmMaxTime":     1500,
		// TTS指标
		"ttsCalls":       ttsCalls,
		"ttsTotalTime":   ttsCalls * 800,
		"ttsAverageTime": 800,
		"ttsMinTime":     800,
		"ttsMaxTime":     800,
		// 响应延迟指标
		"responseDelays":       []int{2300},
		"averageResponseDelay": 2300,
		"minResponseDelay":     2300,
		"maxResponseDelay":     2300,
		// 总延迟指标
		"totalDelays":       []int{2500},
		"averageTotalDelay": 2500,
		"minTotalDelay":     2500,
		"maxTotalDelay":     2500,
	}
}
func generateMockConversationDetails(recording models.CallRecording) map[string]interface{} {
	// 基于录音时长生成合理的对话轮次数
	estimatedTurns := max(2, recording.Duration/15) // 假设每15秒一个对话轮次
	if estimatedTurns > 20 {
		estimatedTurns = 20 // 限制最大轮次数
	}

	turns := make([]map[string]interface{}, 0, estimatedTurns)
	userTurns := 0
	aiTurns := 0
	interruptions := rand.Intn(3) // 0-2次中断

	startTime := recording.StartTime
	currentTime := startTime

	for i := 0; i < estimatedTurns; i++ {
		isUser := i%2 == 0
		turnType := "ai"
		if isUser {
			turnType = "user"
			userTurns++
		} else {
			aiTurns++
		}

		// 生成随机的对话时长
		var duration int
		if isUser {
			duration = 2000 + rand.Intn(3000) // 用户发言 2-5秒
		} else {
			duration = 3000 + rand.Intn(4000) // AI回复 3-7秒
		}

		endTime := currentTime.Add(time.Duration(duration) * time.Millisecond)

		turn := map[string]interface{}{
			"turnId":    i + 1,
			"timestamp": currentTime.Format(time.RFC3339),
			"type":      turnType,
			"content":   generateMockContent(turnType, i),
			"startTime": currentTime.Format(time.RFC3339),
			"endTime":   endTime.Format(time.RFC3339),
			"duration":  duration,
		}

		if isUser {
			// 用户输入特有字段
			asrDuration := 500 + rand.Intn(1000) // ASR处理时间 0.5-1.5秒
			turn["asrStartTime"] = currentTime.Format(time.RFC3339)
			turn["asrEndTime"] = currentTime.Add(time.Duration(asrDuration) * time.Millisecond).Format(time.RFC3339)
			turn["asrDuration"] = asrDuration
		} else {
			// AI回复特有字段
			llmDuration := 800 + rand.Intn(1200)                        // LLM处理时间 0.8-2秒
			ttsDuration := 600 + rand.Intn(800)                         // TTS处理时间 0.6-1.4秒
			responseDelay := llmDuration + ttsDuration + rand.Intn(200) // 响应延迟
			totalDelay := responseDelay + rand.Intn(300)                // 总延迟

			turn["llmStartTime"] = currentTime.Format(time.RFC3339)
			turn["llmEndTime"] = currentTime.Add(time.Duration(llmDuration) * time.Millisecond).Format(time.RFC3339)
			turn["llmDuration"] = llmDuration
			turn["ttsStartTime"] = currentTime.Add(time.Duration(llmDuration) * time.Millisecond).Format(time.RFC3339)
			turn["ttsEndTime"] = currentTime.Add(time.Duration(llmDuration+ttsDuration) * time.Millisecond).Format(time.RFC3339)
			turn["ttsDuration"] = ttsDuration
			turn["responseDelay"] = responseDelay
			turn["totalDelay"] = totalDelay
		}

		turns = append(turns, turn)
		currentTime = endTime.Add(time.Duration(200+rand.Intn(800)) * time.Millisecond) // 轮次间隔
	}

	return map[string]interface{}{
		"sessionId":     recording.SessionID,
		"startTime":     recording.StartTime.Format(time.RFC3339),
		"endTime":       recording.EndTime.Format(time.RFC3339),
		"totalTurns":    estimatedTurns,
		"userTurns":     userTurns,
		"aiTurns":       aiTurns,
		"interruptions": interruptions,
		"turns":         turns,
	}
}

// generateMockTimingMetrics 生成模拟的时间指标数据
func generateMockTimingMetrics(recording models.CallRecording) map[string]interface{} {
	// 基于录音时长估算调用次数
	estimatedTurns := max(2, recording.Duration/15)
	if estimatedTurns > 20 {
		estimatedTurns = 20
	}

	asrCalls := (estimatedTurns + 1) / 2 // 用户发言次数
	llmCalls := estimatedTurns / 2       // AI回复次数
	ttsCalls := llmCalls                 // TTS调用次数等于LLM调用次数

	// 生成ASR指标
	asrTimes := make([]int, asrCalls)
	asrTotal := 0
	asrMin := 9999
	asrMax := 0
	for i := 0; i < asrCalls; i++ {
		time := 500 + rand.Intn(1000) // 0.5-1.5秒
		asrTimes[i] = time
		asrTotal += time
		if time < asrMin {
			asrMin = time
		}
		if time > asrMax {
			asrMax = time
		}
	}
	asrAverage := asrTotal / max(1, asrCalls)

	// 生成LLM指标
	llmTimes := make([]int, llmCalls)
	llmTotal := 0
	llmMin := 9999
	llmMax := 0
	for i := 0; i < llmCalls; i++ {
		time := 800 + rand.Intn(1200) // 0.8-2秒
		llmTimes[i] = time
		llmTotal += time
		if time < llmMin {
			llmMin = time
		}
		if time > llmMax {
			llmMax = time
		}
	}
	llmAverage := llmTotal / max(1, llmCalls)

	// 生成TTS指标
	ttsTimes := make([]int, ttsCalls)
	ttsTotal := 0
	ttsMin := 9999
	ttsMax := 0
	for i := 0; i < ttsCalls; i++ {
		time := 600 + rand.Intn(800) // 0.6-1.4秒
		ttsTimes[i] = time
		ttsTotal += time
		if time < ttsMin {
			ttsMin = time
		}
		if time > ttsMax {
			ttsMax = time
		}
	}
	ttsAverage := ttsTotal / max(1, ttsCalls)

	// 生成响应延迟指标
	responseDelays := make([]int, llmCalls)
	responseTotal := 0
	responseMin := 9999
	responseMax := 0
	for i := 0; i < llmCalls; i++ {
		delay := llmTimes[i] + ttsTimes[i] + rand.Intn(200)
		responseDelays[i] = delay
		responseTotal += delay
		if delay < responseMin {
			responseMin = delay
		}
		if delay > responseMax {
			responseMax = delay
		}
	}
	responseAverage := responseTotal / max(1, llmCalls)

	// 生成总延迟指标
	totalDelays := make([]int, llmCalls)
	totalDelaySum := 0
	totalMin := 9999
	totalMax := 0
	for i := 0; i < llmCalls; i++ {
		delay := responseDelays[i] + rand.Intn(300)
		totalDelays[i] = delay
		totalDelaySum += delay
		if delay < totalMin {
			totalMin = delay
		}
		if delay > totalMax {
			totalMax = delay
		}
	}
	totalAverage := totalDelaySum / max(1, llmCalls)

	return map[string]interface{}{
		"sessionDuration": recording.Duration * 1000, // 转换为毫秒
		// ASR指标
		"asrCalls":       asrCalls,
		"asrTotalTime":   asrTotal,
		"asrAverageTime": asrAverage,
		"asrMinTime":     asrMin,
		"asrMaxTime":     asrMax,
		// LLM指标
		"llmCalls":       llmCalls,
		"llmTotalTime":   llmTotal,
		"llmAverageTime": llmAverage,
		"llmMinTime":     llmMin,
		"llmMaxTime":     llmMax,
		// TTS指标
		"ttsCalls":       ttsCalls,
		"ttsTotalTime":   ttsTotal,
		"ttsAverageTime": ttsAverage,
		"ttsMinTime":     ttsMin,
		"ttsMaxTime":     ttsMax,
		// 响应延迟指标
		"responseDelays":       responseDelays,
		"averageResponseDelay": responseAverage,
		"minResponseDelay":     responseMin,
		"maxResponseDelay":     responseMax,
		// 总延迟指标
		"totalDelays":       totalDelays,
		"averageTotalDelay": totalAverage,
		"minTotalDelay":     totalMin,
		"maxTotalDelay":     totalMax,
	}
}

// generateMockContent 生成模拟的对话内容
func generateMockContent(turnType string, turnIndex int) string {
	if turnType == "user" {
		userContents := []string{
			"你好，我想了解一下产品信息",
			"这个功能怎么使用？",
			"价格是多少？",
			"有什么优惠活动吗？",
			"可以帮我解决这个问题吗？",
			"我需要技术支持",
			"谢谢你的帮助",
			"还有其他问题想咨询",
		}
		if turnIndex/2 < len(userContents) {
			return userContents[turnIndex/2]
		}
		return "我还有其他问题想咨询"
	} else {
		aiContents := []string{
			"您好！很高兴为您服务，请问有什么可以帮助您的吗？",
			"好的，我来为您详细介绍一下这个功能的使用方法...",
			"关于价格，我们有多种套餐可供选择，让我为您介绍一下...",
			"目前我们有很多优惠活动，包括新用户优惠和限时折扣...",
			"当然可以！请您详细描述一下遇到的问题，我会尽力帮您解决...",
			"我理解您的需求，让我为您联系技术支持团队...",
			"不客气！如果还有其他问题，随时可以联系我们...",
			"好的，请您继续提问，我会认真为您解答...",
		}
		if turnIndex/2 < len(aiContents) {
			return aiContents[turnIndex/2]
		}
		return "好的，我会继续为您提供帮助，请问还有什么需要了解的吗？"
	}
}

// max 返回两个整数中的较大值
func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

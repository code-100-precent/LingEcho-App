package handlers

import (
	"strconv"
	"time"

	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/code-100-precent/LingEcho/pkg/hardware/lifecycle"
	"github.com/code-100-precent/LingEcho/pkg/response"
	"github.com/gin-gonic/gin"
)

// DeviceLifecycleHandler 设备生命周期处理器
type DeviceLifecycleHandler struct {
	lifecycleManager *lifecycle.LifecycleManager
}

// NewDeviceLifecycleHandler 创建设备生命周期处理器
func NewDeviceLifecycleHandler(lifecycleManager *lifecycle.LifecycleManager) *DeviceLifecycleHandler {
	return &DeviceLifecycleHandler{
		lifecycleManager: lifecycleManager,
	}
}

// GetDeviceLifecycle 获取设备生命周期信息
// GET /api/device/:deviceId/lifecycle
func (h *DeviceLifecycleHandler) GetDeviceLifecycle(c *gin.Context) {
	deviceID := c.Param("deviceId")
	if deviceID == "" {
		response.Fail(c, "Device ID is required", nil)
		return
	}

	lifecycle, err := h.lifecycleManager.GetDeviceLifecycle(c.Request.Context(), deviceID)
	if err != nil {
		response.Fail(c, "Failed to get device lifecycle", err.Error())
		return
	}

	response.Success(c, "Device lifecycle retrieved successfully", lifecycle)
}

// GetLifecycleHistory 获取设备生命周期历史
// GET /api/device/:deviceId/lifecycle/history
func (h *DeviceLifecycleHandler) GetLifecycleHistory(c *gin.Context) {
	deviceID := c.Param("deviceId")
	if deviceID == "" {
		response.Fail(c, "Device ID is required", nil)
		return
	}

	history, err := h.lifecycleManager.GetLifecycleHistory(c.Request.Context(), deviceID)
	if err != nil {
		response.Fail(c, "Failed to get lifecycle history", err.Error())
		return
	}

	response.Success(c, "Lifecycle history retrieved successfully", history)
}

// TransitionDeviceStatus 手动转换设备状态
// POST /api/device/:deviceId/lifecycle/transition
func (h *DeviceLifecycleHandler) TransitionDeviceStatus(c *gin.Context) {
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

	// 获取当前用户
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "User not logged in", nil)
		return
	}

	triggerBy := user.DisplayName
	if triggerBy == "" {
		triggerBy = user.Email
	}

	// 根据目标状态调用相应的方法
	var err error
	switch models.DeviceLifecycleStatus(req.ToStatus) {
	case models.DeviceStatusMaintenance:
		err = h.lifecycleManager.StartMaintenance(c.Request.Context(), deviceID, "manual", triggerBy)
	default:
		// 对于其他状态转换，直接更新数据库
		lifecycle, getErr := h.lifecycleManager.GetDeviceLifecycle(c.Request.Context(), deviceID)
		if getErr != nil {
			response.Fail(c, "Device lifecycle not found", getErr.Error())
			return
		}

		err = lifecycle.TransitionStatus(h.lifecycleManager.GetDB(), models.DeviceLifecycleStatus(req.ToStatus), req.Reason, triggerBy)
	}

	if err != nil {
		response.Fail(c, "Failed to transition device status", err.Error())
		return
	}

	response.Success(c, "Device status transitioned successfully", nil)
}

// ScheduleMaintenance 安排设备维护
// POST /api/device/:deviceId/lifecycle/maintenance/schedule
func (h *DeviceLifecycleHandler) ScheduleMaintenance(c *gin.Context) {
	deviceID := c.Param("deviceId")
	if deviceID == "" {
		response.Fail(c, "Device ID is required", nil)
		return
	}

	var req struct {
		MaintenanceType string    `json:"maintenanceType" binding:"required"`
		ScheduledDate   time.Time `json:"scheduledDate" binding:"required"`
		Title           string    `json:"title" binding:"required"`
		Description     string    `json:"description"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "Invalid request parameters", err.Error())
		return
	}

	err := h.lifecycleManager.ScheduleMaintenance(
		c.Request.Context(),
		deviceID,
		models.DeviceMaintenanceType(req.MaintenanceType),
		req.ScheduledDate,
		req.Title,
		req.Description,
	)

	if err != nil {
		response.Fail(c, "Failed to schedule maintenance", err.Error())
		return
	}

	response.Success(c, "Maintenance scheduled successfully", nil)
}

// GetMaintenanceRecords 获取设备维护记录
// GET /api/device/:deviceId/lifecycle/maintenance
func (h *DeviceLifecycleHandler) GetMaintenanceRecords(c *gin.Context) {
	deviceID := c.Param("deviceId")
	if deviceID == "" {
		response.Fail(c, "Device ID is required", nil)
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

	records, total, err := h.lifecycleManager.GetMaintenanceRecords(c.Request.Context(), deviceID, limit, offset)
	if err != nil {
		response.Fail(c, "Failed to get maintenance records", err.Error())
		return
	}

	result := map[string]interface{}{
		"records": records,
		"total":   total,
		"limit":   limit,
		"offset":  offset,
	}

	response.Success(c, "Maintenance records retrieved successfully", result)
}

// StartMaintenance 开始维护
// POST /api/device/:deviceId/lifecycle/maintenance/start
func (h *DeviceLifecycleHandler) StartMaintenance(c *gin.Context) {
	deviceID := c.Param("deviceId")
	if deviceID == "" {
		response.Fail(c, "Device ID is required", nil)
		return
	}

	var req struct {
		MaintenanceType string `json:"maintenanceType" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "Invalid request parameters", err.Error())
		return
	}

	// 获取当前用户
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "User not logged in", nil)
		return
	}

	triggerBy := user.DisplayName
	if triggerBy == "" {
		triggerBy = user.Email
	}

	err := h.lifecycleManager.StartMaintenance(c.Request.Context(), deviceID, req.MaintenanceType, triggerBy)
	if err != nil {
		response.Fail(c, "Failed to start maintenance", err.Error())
		return
	}

	response.Success(c, "Maintenance started successfully", nil)
}

// CompleteMaintenance 完成维护
// POST /api/device/:deviceId/lifecycle/maintenance/complete
func (h *DeviceLifecycleHandler) CompleteMaintenance(c *gin.Context) {
	deviceID := c.Param("deviceId")
	if deviceID == "" {
		response.Fail(c, "Device ID is required", nil)
		return
	}

	var req struct {
		Result string `json:"result" binding:"required"` // success, failed
		Notes  string `json:"notes"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		response.Fail(c, "Invalid request parameters", err.Error())
		return
	}

	// 获取当前用户
	user := models.CurrentUser(c)
	if user == nil {
		response.Fail(c, "User not logged in", nil)
		return
	}

	triggerBy := user.DisplayName
	if triggerBy == "" {
		triggerBy = user.Email
	}

	err := h.lifecycleManager.CompleteMaintenance(c.Request.Context(), deviceID, req.Result, triggerBy)
	if err != nil {
		response.Fail(c, "Failed to complete maintenance", err.Error())
		return
	}

	response.Success(c, "Maintenance completed successfully", nil)
}

// GetLifecycleMetrics 获取设备生命周期指标
// GET /api/device/:deviceId/lifecycle/metrics
func (h *DeviceLifecycleHandler) GetLifecycleMetrics(c *gin.Context) {
	deviceID := c.Param("deviceId")
	if deviceID == "" {
		response.Fail(c, "Device ID is required", nil)
		return
	}

	// 解析天数参数
	daysStr := c.DefaultQuery("days", "30")
	days, err := strconv.Atoi(daysStr)
	if err != nil {
		days = 30
	}

	metrics, err := models.GetLifecycleMetrics(h.lifecycleManager.GetDB(), deviceID, days)
	if err != nil {
		response.Fail(c, "Failed to get lifecycle metrics", err.Error())
		return
	}

	response.Success(c, "Lifecycle metrics retrieved successfully", metrics)
}

// CalculateCurrentMetrics 计算当前指标
// POST /api/device/:deviceId/lifecycle/metrics/calculate
func (h *DeviceLifecycleHandler) CalculateCurrentMetrics(c *gin.Context) {
	deviceID := c.Param("deviceId")
	if deviceID == "" {
		response.Fail(c, "Device ID is required", nil)
		return
	}

	metrics, err := h.lifecycleManager.CalculateMetrics(c.Request.Context(), deviceID)
	if err != nil {
		response.Fail(c, "Failed to calculate metrics", err.Error())
		return
	}

	response.Success(c, "Metrics calculated successfully", metrics)
}

// GetLifecycleOverview 获取生命周期概览
// GET /api/device/:deviceId/lifecycle/overview
func (h *DeviceLifecycleHandler) GetLifecycleOverview(c *gin.Context) {
	deviceID := c.Param("deviceId")
	if deviceID == "" {
		response.Fail(c, "Device ID is required", nil)
		return
	}

	// 获取生命周期信息
	lifecycle, err := h.lifecycleManager.GetDeviceLifecycle(c.Request.Context(), deviceID)
	if err != nil {
		response.Fail(c, "Failed to get device lifecycle", err.Error())
		return
	}

	// 获取最近的维护记录
	maintenanceRecords, _, err := h.lifecycleManager.GetMaintenanceRecords(c.Request.Context(), deviceID, 5, 0)
	if err != nil {
		response.Fail(c, "Failed to get maintenance records", err.Error())
		return
	}

	// 获取最近的指标
	metrics, err := models.GetLifecycleMetrics(h.lifecycleManager.GetDB(), deviceID, 7)
	if err != nil {
		// 指标获取失败不影响整体结果
		metrics = []models.DeviceLifecycleMetrics{}
	}

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

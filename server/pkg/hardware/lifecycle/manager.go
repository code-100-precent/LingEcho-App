package lifecycle

import (
	"context"
	"fmt"
	"time"

	"github.com/code-100-precent/LingEcho/internal/models"
	"github.com/code-100-precent/LingEcho/pkg/logger"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// StatusChangeHandler 状态变化处理器接口
type StatusChangeHandler interface {
	HandleStatusChange(ctx context.Context, deviceID string, fromStatus, toStatus models.DeviceLifecycleStatus, reason string) error
}

// StatusChangeEffect 状态变化影响
type StatusChangeEffect struct {
	FromStatus models.DeviceLifecycleStatus
	ToStatus   models.DeviceLifecycleStatus
	Handler    StatusChangeHandler
}

// LifecycleManager 设备生命周期管理器
type LifecycleManager struct {
	db             *gorm.DB
	logger         *zap.Logger
	statusHandlers map[string]StatusChangeHandler
	statusEffects  []StatusChangeEffect
}

// NewLifecycleManager 创建生命周期管理器
func NewLifecycleManager(db *gorm.DB) *LifecycleManager {
	lm := &LifecycleManager{
		db:             db,
		logger:         logger.Lg,
		statusHandlers: make(map[string]StatusChangeHandler),
		statusEffects:  make([]StatusChangeEffect, 0),
	}
	lm.registerDefaultHandlers()
	return lm
}

// RegisterStatusHandler 注册状态变化处理器
func (lm *LifecycleManager) RegisterStatusHandler(name string, handler StatusChangeHandler) {
	lm.statusHandlers[name] = handler
	lm.logger.Info("Status change handler registered", zap.String("name", name))
}

// RegisterStatusEffect 注册状态变化影响
func (lm *LifecycleManager) RegisterStatusEffect(fromStatus, toStatus models.DeviceLifecycleStatus, handler StatusChangeHandler) {
	effect := StatusChangeEffect{
		FromStatus: fromStatus,
		ToStatus:   toStatus,
		Handler:    handler,
	}
	lm.statusEffects = append(lm.statusEffects, effect)
	lm.logger.Info("Status effect registered",
		zap.String("from", string(fromStatus)),
		zap.String("to", string(toStatus)))
}

// registerDefaultHandlers 注册默认的状态变化处理器
func (lm *LifecycleManager) registerDefaultHandlers() {
	// 设备激活处理器
	lm.RegisterStatusHandler("device_activation", &DeviceActivationHandler{db: lm.db, logger: lm.logger})

	// 设备维护处理器
	lm.RegisterStatusHandler("device_maintenance", &DeviceMaintenanceHandler{db: lm.db, logger: lm.logger})

	// 设备故障处理器
	lm.RegisterStatusHandler("device_fault", &DeviceFaultHandler{db: lm.db, logger: lm.logger})

	// 设备停用处理器
	lm.RegisterStatusHandler("device_deactivation", &DeviceDeactivationHandler{db: lm.db, logger: lm.logger})

	// 注册状态变化影响
	lm.RegisterStatusEffect(models.DeviceStatusActivationReady, models.DeviceStatusActive, lm.statusHandlers["device_activation"])
	lm.RegisterStatusEffect(models.DeviceStatusActive, models.DeviceStatusMaintenance, lm.statusHandlers["device_maintenance"])
	lm.RegisterStatusEffect(models.DeviceStatusActive, models.DeviceStatusFaulty, lm.statusHandlers["device_fault"])
	lm.RegisterStatusEffect(models.DeviceStatusActive, models.DeviceStatusDeactivated, lm.statusHandlers["device_deactivation"])
	lm.RegisterStatusEffect(models.DeviceStatusMaintenance, models.DeviceStatusActive, lm.statusHandlers["device_activation"])
	lm.RegisterStatusEffect(models.DeviceStatusFaulty, models.DeviceStatusActive, lm.statusHandlers["device_activation"])
}

// processStatusChangeEffects 处理状态变化影响
func (lm *LifecycleManager) processStatusChangeEffects(ctx context.Context, deviceID string, fromStatus, toStatus models.DeviceLifecycleStatus, reason string) error {
	for _, effect := range lm.statusEffects {
		if effect.FromStatus == fromStatus && effect.ToStatus == toStatus {
			err := effect.Handler.HandleStatusChange(ctx, deviceID, fromStatus, toStatus, reason)
			if err != nil {
				lm.logger.Error("Status change effect failed",
					zap.String("deviceId", deviceID),
					zap.String("from", string(fromStatus)),
					zap.String("to", string(toStatus)),
					zap.Error(err))
				return err
			}
		}
	}
	return nil
}

// GetDB returns the database instance
func (lm *LifecycleManager) GetDB() *gorm.DB {
	return lm.db
}

// InitializeDevice 初始化设备生命周期
func (lm *LifecycleManager) InitializeDevice(ctx context.Context, deviceID, macAddress string) error {
	// 检查是否已存在生命周期记录
	existing, err := models.GetLifecycleByDeviceID(lm.db, deviceID)
	if err == nil && existing != nil {
		lm.logger.Info("Device lifecycle already exists", zap.String("deviceId", deviceID))
		return nil
	}

	// 创建生命周期记录
	lifecycle, err := models.CreateDeviceLifecycle(lm.db, deviceID, macAddress)
	if err != nil {
		lm.logger.Error("Failed to create device lifecycle", zap.Error(err), zap.String("deviceId", deviceID))
		return err
	}

	lm.logger.Info("Device lifecycle initialized",
		zap.String("deviceId", deviceID),
		zap.String("status", string(lifecycle.Status)))

	return nil
}

// GetDeviceLifecycle 获取设备生命周期信息
func (lm *LifecycleManager) GetDeviceLifecycle(ctx context.Context, deviceID string) (*models.DeviceLifecycle, error) {
	return models.GetLifecycleByDeviceID(lm.db, deviceID)
}

// GetLifecycleHistory 获取生命周期历史
func (lm *LifecycleManager) GetLifecycleHistory(ctx context.Context, deviceID string) ([]models.DeviceLifecycleHistory, error) {
	var history []models.DeviceLifecycleHistory
	err := lm.db.Where("device_id = ?", deviceID).Order("created_at DESC").Find(&history).Error
	return history, err
}

// GetMaintenanceRecords 获取维护记录
func (lm *LifecycleManager) GetMaintenanceRecords(ctx context.Context, deviceID string, limit, offset int) ([]models.DeviceMaintenanceRecord, int64, error) {
	return models.GetMaintenanceRecords(lm.db, deviceID, limit, offset)
}

// CalculateMetrics 计算生命周期指标
func (lm *LifecycleManager) CalculateMetrics(ctx context.Context, deviceID string) (*models.DeviceLifecycleMetrics, error) {
	// 获取设备信息
	device, err := models.GetDeviceByID(lm.db, deviceID)
	if err != nil {
		return nil, fmt.Errorf("device not found: %w", err)
	}

	// 创建基于当前设备状态的指标
	metrics := &models.DeviceLifecycleMetrics{
		DeviceID:              deviceID,
		MetricDate:            time.Now(),
		AvgCPUUsage:           device.CPUUsage,
		AvgMemoryUsage:        device.MemoryUsage,
		AvgTemperature:        device.Temperature,
		AvgNetworkLatency:     0,
		UptimePercentage:      95.0,  // 默认值
		MTBF:                  720.0, // 默认30天
		MTTR:                  2.0,   // 默认2小时
		ErrorRate:             0.01,  // 默认值
		SuccessRate:           0.99,  // 默认值
		ActiveHours:           float64(device.Uptime) / 3600,
		IdleHours:             0,
		InteractionCount:      0,
		MaintenanceHours:      0,
		MaintenanceCost:       0,
		UserSatisfactionScore: 0.85,
	}

	// 保存指标
	err = lm.db.Create(metrics).Error
	if err != nil {
		return nil, err
	}

	return metrics, nil
}

// StartMaintenance 开始维护
func (lm *LifecycleManager) StartMaintenance(ctx context.Context, deviceID, maintenanceType, triggerBy string) error {
	lifecycle, err := models.GetLifecycleByDeviceID(lm.db, deviceID)
	if err != nil {
		return fmt.Errorf("device lifecycle not found: %w", err)
	}

	// 检查当前状态是否允许维护
	if lifecycle.Status != models.DeviceStatusActive && lifecycle.Status != models.DeviceStatusFaulty {
		return fmt.Errorf("device status %s does not allow maintenance", lifecycle.Status)
	}

	err = lifecycle.TransitionStatus(lm.db, models.DeviceStatusMaintenance,
		fmt.Sprintf("Maintenance started: %s", maintenanceType), triggerBy)
	if err != nil {
		return fmt.Errorf("failed to transition to maintenance status: %w", err)
	}

	return nil
}

// CompleteMaintenance 完成维护
func (lm *LifecycleManager) CompleteMaintenance(ctx context.Context, deviceID, result, triggerBy string) error {
	lifecycle, err := models.GetLifecycleByDeviceID(lm.db, deviceID)
	if err != nil {
		return fmt.Errorf("device lifecycle not found: %w", err)
	}

	if lifecycle.Status != models.DeviceStatusMaintenance {
		return fmt.Errorf("device is not in maintenance status")
	}

	// 根据维护结果决定下一个状态
	var nextStatus models.DeviceLifecycleStatus
	if result == "success" {
		nextStatus = models.DeviceStatusActive
	} else {
		nextStatus = models.DeviceStatusFaulty
	}

	err = lifecycle.TransitionStatus(lm.db, nextStatus,
		fmt.Sprintf("Maintenance completed: %s", result), triggerBy)
	if err != nil {
		return fmt.Errorf("failed to transition after maintenance: %w", err)
	}

	return nil
}

// ScheduleMaintenance 安排维护
func (lm *LifecycleManager) ScheduleMaintenance(ctx context.Context, deviceID string,
	maintenanceType models.DeviceMaintenanceType, scheduledDate time.Time,
	title, description string) error {

	lifecycle, err := models.GetLifecycleByDeviceID(lm.db, deviceID)
	if err != nil {
		return fmt.Errorf("device lifecycle not found: %w", err)
	}

	err = lifecycle.ScheduleMaintenance(lm.db, maintenanceType, scheduledDate, title, description)
	if err != nil {
		return fmt.Errorf("failed to schedule maintenance: %w", err)
	}

	lm.logger.Info("Maintenance scheduled",
		zap.String("deviceId", deviceID),
		zap.String("type", string(maintenanceType)),
		zap.Time("scheduledDate", scheduledDate))

	return nil
}

// TransitionDeviceStatus 转换设备状态
func (lm *LifecycleManager) TransitionDeviceStatus(ctx context.Context, deviceID string, toStatus models.DeviceLifecycleStatus, reason, triggerBy string) error {
	lifecycle, err := models.GetLifecycleByDeviceID(lm.db, deviceID)
	if err != nil {
		return fmt.Errorf("device lifecycle not found: %w", err)
	}

	fromStatus := lifecycle.Status

	// 验证状态转换是否有效
	if !lm.isValidTransition(fromStatus, toStatus) {
		return fmt.Errorf("invalid status transition from %s to %s", fromStatus, toStatus)
	}

	// 处理状态变化影响
	err = lm.processStatusChangeEffects(ctx, deviceID, fromStatus, toStatus, reason)
	if err != nil {
		return fmt.Errorf("failed to process status change effects: %w", err)
	}

	// 执行状态转换
	err = lifecycle.TransitionStatus(lm.db, toStatus, reason, triggerBy)
	if err != nil {
		return fmt.Errorf("failed to transition device status: %w", err)
	}

	lm.logger.Info("Device status transitioned",
		zap.String("deviceId", deviceID),
		zap.String("from", string(fromStatus)),
		zap.String("to", string(toStatus)),
		zap.String("reason", reason),
		zap.String("triggerBy", triggerBy))

	return nil
}

// isValidTransition 验证状态转换是否有效
func (lm *LifecycleManager) isValidTransition(from, to models.DeviceLifecycleStatus) bool {
	validTransitions := map[models.DeviceLifecycleStatus][]models.DeviceLifecycleStatus{
		models.DeviceStatusManufacturing:   {models.DeviceStatusInventory},
		models.DeviceStatusInventory:       {models.DeviceStatusActivationReady},
		models.DeviceStatusActivationReady: {models.DeviceStatusActivating},
		models.DeviceStatusActivating:      {models.DeviceStatusConfiguring, models.DeviceStatusFaulty},
		models.DeviceStatusConfiguring:     {models.DeviceStatusActive, models.DeviceStatusFaulty},
		models.DeviceStatusActive:          {models.DeviceStatusMaintenance, models.DeviceStatusFaulty, models.DeviceStatusOffline, models.DeviceStatusDeactivated},
		models.DeviceStatusMaintenance:     {models.DeviceStatusActive, models.DeviceStatusFaulty},
		models.DeviceStatusFaulty:          {models.DeviceStatusMaintenance, models.DeviceStatusActive, models.DeviceStatusDeactivated},
		models.DeviceStatusOffline:         {models.DeviceStatusActive, models.DeviceStatusFaulty, models.DeviceStatusDeactivated},
		models.DeviceStatusDeactivated:     {models.DeviceStatusRetired},
		models.DeviceStatusRetired:         {}, // 终态，不能转换
	}

	allowedTransitions, exists := validTransitions[from]
	if !exists {
		return false
	}

	for _, allowed := range allowedTransitions {
		if allowed == to {
			return true
		}
	}
	return false
}

// 状态变化处理器实现

// DeviceActivationHandler 设备激活处理器
type DeviceActivationHandler struct {
	db     *gorm.DB
	logger *zap.Logger
}

func (h *DeviceActivationHandler) HandleStatusChange(ctx context.Context, deviceID string, fromStatus, toStatus models.DeviceLifecycleStatus, reason string) error {
	h.logger.Info("Processing device activation",
		zap.String("deviceId", deviceID),
		zap.String("from", string(fromStatus)),
		zap.String("to", string(toStatus)))

	// 更新设备最后活跃时间
	now := time.Now()
	err := h.db.Model(&models.DeviceLifecycle{}).
		Where("device_id = ?", deviceID).
		Update("last_active_date", now).Error

	if err != nil {
		return fmt.Errorf("failed to update last active date: %w", err)
	}

	// 如果是从故障状态恢复，重置故障计数器
	if fromStatus == models.DeviceStatusFaulty {
		h.logger.Info("Device recovered from fault", zap.String("deviceId", deviceID))
	}

	return nil
}

// DeviceMaintenanceHandler 设备维护处理器
type DeviceMaintenanceHandler struct {
	db     *gorm.DB
	logger *zap.Logger
}

func (h *DeviceMaintenanceHandler) HandleStatusChange(ctx context.Context, deviceID string, fromStatus, toStatus models.DeviceLifecycleStatus, reason string) error {
	h.logger.Info("Processing device maintenance",
		zap.String("deviceId", deviceID),
		zap.String("from", string(fromStatus)),
		zap.String("to", string(toStatus)))

	// 更新维护相关字段
	now := time.Now()
	updates := map[string]interface{}{
		"last_maintenance_date": now,
	}

	// 如果是进入维护状态，增加维护计数
	if toStatus == models.DeviceStatusMaintenance {
		err := h.db.Model(&models.DeviceLifecycle{}).
			Where("device_id = ?", deviceID).
			UpdateColumn("maintenance_count", gorm.Expr("maintenance_count + 1")).Error
		if err != nil {
			return fmt.Errorf("failed to increment maintenance count: %w", err)
		}
	}

	err := h.db.Model(&models.DeviceLifecycle{}).
		Where("device_id = ?", deviceID).
		Updates(updates).Error

	if err != nil {
		return fmt.Errorf("failed to update maintenance fields: %w", err)
	}

	return nil
}

// DeviceFaultHandler 设备故障处理器
type DeviceFaultHandler struct {
	db     *gorm.DB
	logger *zap.Logger
}

func (h *DeviceFaultHandler) HandleStatusChange(ctx context.Context, deviceID string, fromStatus, toStatus models.DeviceLifecycleStatus, reason string) error {
	h.logger.Info("Processing device fault",
		zap.String("deviceId", deviceID),
		zap.String("from", string(fromStatus)),
		zap.String("to", string(toStatus)),
		zap.String("reason", reason))

	// 如果是进入故障状态
	if toStatus == models.DeviceStatusFaulty {
		now := time.Now()
		updates := map[string]interface{}{
			"last_fault_date": now,
		}

		// 增加故障计数
		err := h.db.Model(&models.DeviceLifecycle{}).
			Where("device_id = ?", deviceID).
			UpdateColumn("fault_count", gorm.Expr("fault_count + 1")).Error
		if err != nil {
			return fmt.Errorf("failed to increment fault count: %w", err)
		}

		err = h.db.Model(&models.DeviceLifecycle{}).
			Where("device_id = ?", deviceID).
			Updates(updates).Error

		if err != nil {
			return fmt.Errorf("failed to update fault fields: %w", err)
		}

		// 可以在这里添加故障通知逻辑
		h.logger.Warn("Device entered fault state",
			zap.String("deviceId", deviceID),
			zap.String("reason", reason))
	}

	return nil
}

// DeviceDeactivationHandler 设备停用处理器
type DeviceDeactivationHandler struct {
	db     *gorm.DB
	logger *zap.Logger
}

func (h *DeviceDeactivationHandler) HandleStatusChange(ctx context.Context, deviceID string, fromStatus, toStatus models.DeviceLifecycleStatus, reason string) error {
	h.logger.Info("Processing device deactivation",
		zap.String("deviceId", deviceID),
		zap.String("from", string(fromStatus)),
		zap.String("to", string(toStatus)),
		zap.String("reason", reason))

	// 如果是进入停用状态
	if toStatus == models.DeviceStatusDeactivated {
		now := time.Now()
		updates := map[string]interface{}{
			"deactivation_date":   now,
			"deactivation_reason": reason,
		}

		err := h.db.Model(&models.DeviceLifecycle{}).
			Where("device_id = ?", deviceID).
			Updates(updates).Error

		if err != nil {
			return fmt.Errorf("failed to update deactivation fields: %w", err)
		}

		// 可以在这里添加设备清理逻辑
		h.logger.Info("Device deactivated",
			zap.String("deviceId", deviceID),
			zap.String("reason", reason))
	}

	return nil
}

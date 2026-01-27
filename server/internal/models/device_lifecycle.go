package models

import (
	"time"

	"gorm.io/gorm"
)

// DeviceLifecycleStatus 设备生命周期状态
type DeviceLifecycleStatus string

const (
	DeviceStatusManufacturing   DeviceLifecycleStatus = "manufacturing"    // 制造中
	DeviceStatusInventory       DeviceLifecycleStatus = "inventory"        // 库存中
	DeviceStatusActivationReady DeviceLifecycleStatus = "activation_ready" // 等待激活
	DeviceStatusActivating      DeviceLifecycleStatus = "activating"       // 激活中
	DeviceStatusConfiguring     DeviceLifecycleStatus = "configuring"      // 配置中
	DeviceStatusActive          DeviceLifecycleStatus = "active"           // 运行中
	DeviceStatusMaintenance     DeviceLifecycleStatus = "maintenance"      // 维护中
	DeviceStatusFaulty          DeviceLifecycleStatus = "faulty"           // 故障
	DeviceStatusOffline         DeviceLifecycleStatus = "offline"          // 离线
	DeviceStatusDeactivated     DeviceLifecycleStatus = "deactivated"      // 已停用
	DeviceStatusRetired         DeviceLifecycleStatus = "retired"          // 已退役
)

// DeviceLifecycle 设备生命周期管理
type DeviceLifecycle struct {
	BaseModel
	DeviceID   string                `json:"deviceId" gorm:"size:64;uniqueIndex;not null"` // 设备ID
	MacAddress string                `json:"macAddress" gorm:"size:64;index"`              // MAC地址
	Status     DeviceLifecycleStatus `json:"status" gorm:"size:32;index;not null"`         // 当前状态
	PrevStatus DeviceLifecycleStatus `json:"prevStatus" gorm:"size:32"`                    // 前一个状态

	// 制造信息
	ManufactureDate *time.Time `json:"manufactureDate"`                // 制造日期
	BatchNumber     string     `json:"batchNumber" gorm:"size:64"`     // 批次号
	HardwareVersion string     `json:"hardwareVersion" gorm:"size:32"` // 硬件版本
	InitialFirmware string     `json:"initialFirmware" gorm:"size:64"` // 初始固件版本
	QualityReport   string     `json:"qualityReport" gorm:"type:json"` // 质检报告

	// 激活信息
	ActivationCode     string     `json:"activationCode" gorm:"size:128"`      // 激活码
	ActivationDate     *time.Time `json:"activationDate"`                      // 激活日期
	ActivationAttempts int        `json:"activationAttempts" gorm:"default:0"` // 激活尝试次数
	FirstPowerOn       *time.Time `json:"firstPowerOn"`                        // 首次上电时间

	// 配置信息
	ConfigurationDate *time.Time `json:"configurationDate"`            // 配置完成日期
	ConfigVersion     string     `json:"configVersion" gorm:"size:32"` // 配置版本
	ConfigStatus      string     `json:"configStatus" gorm:"size:32"`  // 配置状态

	// 运行信息
	LastActiveDate *time.Time `json:"lastActiveDate"`                 // 最后活跃时间
	TotalUptime    int64      `json:"totalUptime" gorm:"default:0"`   // 总运行时长(秒)
	TotalDowntime  int64      `json:"totalDowntime" gorm:"default:0"` // 总停机时长(秒)

	// 维护信息
	LastMaintenanceDate *time.Time `json:"lastMaintenanceDate"`               // 最后维护时间
	MaintenanceCount    int        `json:"maintenanceCount" gorm:"default:0"` // 维护次数
	NextMaintenanceDate *time.Time `json:"nextMaintenanceDate"`               // 下次维护时间

	// 故障信息
	FaultCount     int        `json:"faultCount" gorm:"default:0"`     // 故障次数
	LastFaultDate  *time.Time `json:"lastFaultDate"`                   // 最后故障时间
	TotalFaultTime int64      `json:"totalFaultTime" gorm:"default:0"` // 总故障时长(秒)

	// 生命周期结束信息
	DeactivationDate   *time.Time `json:"deactivationDate"`                    // 停用日期
	DeactivationReason string     `json:"deactivationReason" gorm:"type:text"` // 停用原因
	RetirementDate     *time.Time `json:"retirementDate"`                      // 退役日期
	RetirementReason   string     `json:"retirementReason" gorm:"type:text"`   // 退役原因

	// 元数据
	Metadata string `json:"metadata" gorm:"type:json"` // 扩展元数据
	Notes    string `json:"notes" gorm:"type:text"`    // 备注

	// 关联
	Device             *Device                   `json:"device,omitempty" gorm:"foreignKey:DeviceID;references:ID"`
	StatusHistory      []DeviceLifecycleHistory  `json:"statusHistory,omitempty" gorm:"foreignKey:DeviceID;references:DeviceID"`
	MaintenanceRecords []DeviceMaintenanceRecord `json:"maintenanceRecords,omitempty" gorm:"foreignKey:DeviceID;references:DeviceID"`
}

func (DeviceLifecycle) TableName() string {
	return "device_lifecycles"
}

// DeviceLifecycleHistory 设备生命周期状态变更历史
type DeviceLifecycleHistory struct {
	BaseModel
	DeviceID    string                `json:"deviceId" gorm:"size:64;index;not null"`
	FromStatus  DeviceLifecycleStatus `json:"fromStatus" gorm:"size:32"`
	ToStatus    DeviceLifecycleStatus `json:"toStatus" gorm:"size:32;not null"`
	Reason      string                `json:"reason" gorm:"type:text"`    // 状态变更原因
	TriggerType string                `json:"triggerType" gorm:"size:32"` // 触发类型: manual, automatic, system
	TriggerBy   string                `json:"triggerBy" gorm:"size:128"`  // 触发者
	Duration    int64                 `json:"duration" gorm:"default:0"`  // 在前一状态的持续时间(秒)
	Metadata    string                `json:"metadata" gorm:"type:json"`  // 变更相关的元数据

	// 关联
	Device *Device `json:"device,omitempty" gorm:"foreignKey:DeviceID;references:ID"`
}

func (DeviceLifecycleHistory) TableName() string {
	return "device_lifecycle_histories"
}

// DeviceMaintenanceRecord 设备维护记录
type DeviceMaintenanceRecord struct {
	BaseModel
	DeviceID        string                `json:"deviceId" gorm:"size:64;index;not null"`
	MaintenanceType DeviceMaintenanceType `json:"maintenanceType" gorm:"size:32;not null"`
	Status          MaintenanceStatus     `json:"status" gorm:"size:32;not null"`
	Priority        MaintenancePriority   `json:"priority" gorm:"size:16;default:'medium'"`

	// 维护计划
	ScheduledDate     *time.Time `json:"scheduledDate"`                      // 计划维护时间
	StartDate         *time.Time `json:"startDate"`                          // 开始时间
	EndDate           *time.Time `json:"endDate"`                            // 结束时间
	EstimatedDuration int        `json:"estimatedDuration" gorm:"default:0"` // 预计时长(分钟)
	ActualDuration    int        `json:"actualDuration" gorm:"default:0"`    // 实际时长(分钟)

	// 维护内容
	Title       string `json:"title" gorm:"size:256;not null"` // 维护标题
	Description string `json:"description" gorm:"type:text"`   // 维护描述
	Checklist   string `json:"checklist" gorm:"type:json"`     // 维护检查清单

	// 维护结果
	Result          string `json:"result" gorm:"type:text"`          // 维护结果
	Issues          string `json:"issues" gorm:"type:text"`          // 发现的问题
	Recommendations string `json:"recommendations" gorm:"type:text"` // 建议

	// 固件/配置更新
	FirmwareBefore string `json:"firmwareBefore" gorm:"size:64"` // 维护前固件版本
	FirmwareAfter  string `json:"firmwareAfter" gorm:"size:64"`  // 维护后固件版本
	ConfigBefore   string `json:"configBefore" gorm:"type:json"` // 维护前配置
	ConfigAfter    string `json:"configAfter" gorm:"type:json"`  // 维护后配置

	// 性能对比
	PerformanceBefore string `json:"performanceBefore" gorm:"type:json"` // 维护前性能指标
	PerformanceAfter  string `json:"performanceAfter" gorm:"type:json"`  // 维护后性能指标

	// 维护人员
	AssignedTo  string `json:"assignedTo" gorm:"size:128"`  // 分配给
	CompletedBy string `json:"completedBy" gorm:"size:128"` // 完成人

	// 成本
	EstimatedCost float64 `json:"estimatedCost" gorm:"default:0"` // 预计成本
	ActualCost    float64 `json:"actualCost" gorm:"default:0"`    // 实际成本

	// 元数据
	Tags        string `json:"tags" gorm:"type:json"`        // 标签
	Attachments string `json:"attachments" gorm:"type:json"` // 附件

	// 关联
	Device *Device `json:"device,omitempty" gorm:"foreignKey:DeviceID;references:ID"`
}

func (DeviceMaintenanceRecord) TableName() string {
	return "device_maintenance_records"
}

// DeviceMaintenanceType 维护类型
type DeviceMaintenanceType string

const (
	MaintenanceTypePreventive    DeviceMaintenanceType = "preventive"    // 预防性维护
	MaintenanceTypeCorrective    DeviceMaintenanceType = "corrective"    // 纠正性维护
	MaintenanceTypePredictive    DeviceMaintenanceType = "predictive"    // 预测性维护
	MaintenanceTypeEmergency     DeviceMaintenanceType = "emergency"     // 紧急维护
	MaintenanceTypeFirmware      DeviceMaintenanceType = "firmware"      // 固件更新
	MaintenanceTypeConfiguration DeviceMaintenanceType = "configuration" // 配置更新
	MaintenanceTypeInspection    DeviceMaintenanceType = "inspection"    // 检查
	MaintenanceTypeCalibration   DeviceMaintenanceType = "calibration"   // 校准
)

// MaintenanceStatus 维护状态
type MaintenanceStatus string

const (
	MaintenanceStatusScheduled  MaintenanceStatus = "scheduled"   // 已计划
	MaintenanceStatusInProgress MaintenanceStatus = "in_progress" // 进行中
	MaintenanceStatusCompleted  MaintenanceStatus = "completed"   // 已完成
	MaintenanceStatusCancelled  MaintenanceStatus = "cancelled"   // 已取消
	MaintenanceStatusFailed     MaintenanceStatus = "failed"      // 失败
	MaintenanceStatusPostponed  MaintenanceStatus = "postponed"   // 延期
)

// MaintenancePriority 维护优先级
type MaintenancePriority string

const (
	MaintenancePriorityLow      MaintenancePriority = "low"      // 低
	MaintenancePriorityMedium   MaintenancePriority = "medium"   // 中
	MaintenancePriorityHigh     MaintenancePriority = "high"     // 高
	MaintenancePriorityCritical MaintenancePriority = "critical" // 紧急
)

// DeviceLifecycleMetrics 设备生命周期指标
type DeviceLifecycleMetrics struct {
	BaseModel
	DeviceID   string    `json:"deviceId" gorm:"size:64;index;not null"`
	MetricDate time.Time `json:"metricDate" gorm:"index"` // 指标日期

	// 可用性指标
	UptimePercentage float64 `json:"uptimePercentage"` // 可用性百分比
	MTBF             float64 `json:"mtbf"`             // 平均故障间隔时间(小时)
	MTTR             float64 `json:"mttr"`             // 平均修复时间(小时)

	// 性能指标
	AvgCPUUsage       float64 `json:"avgCpuUsage"`       // 平均CPU使用率
	AvgMemoryUsage    float64 `json:"avgMemoryUsage"`    // 平均内存使用率
	AvgTemperature    float64 `json:"avgTemperature"`    // 平均温度
	AvgNetworkLatency float64 `json:"avgNetworkLatency"` // 平均网络延迟

	// 使用指标
	ActiveHours      float64 `json:"activeHours"`      // 活跃小时数
	IdleHours        float64 `json:"idleHours"`        // 空闲小时数
	InteractionCount int     `json:"interactionCount"` // 交互次数

	// 维护指标
	MaintenanceHours float64 `json:"maintenanceHours"` // 维护小时数
	MaintenanceCost  float64 `json:"maintenanceCost"`  // 维护成本

	// 质量指标
	ErrorRate             float64 `json:"errorRate"`             // 错误率
	SuccessRate           float64 `json:"successRate"`           // 成功率
	UserSatisfactionScore float64 `json:"userSatisfactionScore"` // 用户满意度评分

	// 关联
	Device *Device `json:"device,omitempty" gorm:"foreignKey:DeviceID;references:ID"`
}

func (DeviceLifecycleMetrics) TableName() string {
	return "device_lifecycle_metrics"
}

// 生命周期管理方法

// TransitionStatus 状态转换
func (dl *DeviceLifecycle) TransitionStatus(db *gorm.DB, toStatus DeviceLifecycleStatus, reason, triggerBy string) error {
	// 记录状态变更历史
	history := DeviceLifecycleHistory{
		DeviceID:    dl.DeviceID,
		FromStatus:  dl.Status,
		ToStatus:    toStatus,
		Reason:      reason,
		TriggerType: "manual",
		TriggerBy:   triggerBy,
		Metadata:    "{}", // 手动设置JSON字段默认值
	}

	// 确保metadata不为空
	if history.Metadata == "" || history.Metadata == "null" {
		history.Metadata = "{}"
	}

	// 计算在前一状态的持续时间
	if !dl.UpdatedAt.IsZero() {
		history.Duration = int64(time.Since(dl.UpdatedAt).Seconds())
	}

	// 更新设备生命周期状态
	dl.PrevStatus = dl.Status
	dl.Status = toStatus

	// 根据新状态更新相关字段
	now := time.Now()
	switch toStatus {
	case DeviceStatusActivating:
		if dl.ActivationDate == nil {
			dl.ActivationDate = &now
		}
	case DeviceStatusActive:
		dl.LastActiveDate = &now
	case DeviceStatusMaintenance:
		dl.LastMaintenanceDate = &now
		dl.MaintenanceCount++
	case DeviceStatusFaulty:
		dl.LastFaultDate = &now
		dl.FaultCount++
	case DeviceStatusDeactivated:
		dl.DeactivationDate = &now
		dl.DeactivationReason = reason
	case DeviceStatusRetired:
		dl.RetirementDate = &now
		dl.RetirementReason = reason
	}

	// 开启事务
	tx := db.Begin()

	// 保存历史记录
	if err := tx.Create(&history).Error; err != nil {
		tx.Rollback()
		return err
	}

	// 更新生命周期记录
	if err := tx.Save(dl).Error; err != nil {
		tx.Rollback()
		return err
	}

	tx.Commit()
	return nil
}

// ScheduleMaintenance 安排维护
func (dl *DeviceLifecycle) ScheduleMaintenance(db *gorm.DB, maintenanceType DeviceMaintenanceType, scheduledDate time.Time, title, description string) error {
	maintenance := DeviceMaintenanceRecord{
		DeviceID:        dl.DeviceID,
		MaintenanceType: maintenanceType,
		Status:          MaintenanceStatusScheduled,
		Priority:        MaintenancePriorityMedium,
		ScheduledDate:   &scheduledDate,
		Title:           title,
		Description:     description,
		// 手动设置JSON字段默认值
		Checklist:         "[]",
		ConfigBefore:      "{}",
		ConfigAfter:       "{}",
		PerformanceBefore: "{}",
		PerformanceAfter:  "{}",
		Tags:              "[]",
		Attachments:       "[]",
	}

	return db.Create(&maintenance).Error
}

// GetLifecycleByDeviceID 根据设备ID获取生命周期信息
func GetLifecycleByDeviceID(db *gorm.DB, deviceID string) (*DeviceLifecycle, error) {
	var lifecycle DeviceLifecycle
	err := db.Where("device_id = ?", deviceID).First(&lifecycle).Error
	if err != nil {
		return nil, err
	}
	return &lifecycle, nil
}

// CreateDeviceLifecycle 创建设备生命周期记录
func CreateDeviceLifecycle(db *gorm.DB, deviceID, macAddress string) (*DeviceLifecycle, error) {
	lifecycle := DeviceLifecycle{
		DeviceID:      deviceID,
		MacAddress:    macAddress,
		Status:        DeviceStatusActivationReady,
		QualityReport: "{}", // 手动设置JSON默认值
		Metadata:      "{}", // 手动设置JSON默认值
	}

	// 确保JSON字段不为空
	if lifecycle.QualityReport == "" || lifecycle.QualityReport == "null" {
		lifecycle.QualityReport = "{}"
	}
	if lifecycle.Metadata == "" || lifecycle.Metadata == "null" {
		lifecycle.Metadata = "{}"
	}

	err := db.Create(&lifecycle).Error
	if err != nil {
		return nil, err
	}

	return &lifecycle, nil
}

// GetMaintenanceRecords 获取设备维护记录
func GetMaintenanceRecords(db *gorm.DB, deviceID string, limit, offset int) ([]DeviceMaintenanceRecord, int64, error) {
	var records []DeviceMaintenanceRecord
	var total int64

	query := db.Where("device_id = ?", deviceID)

	// 获取总数
	query.Model(&DeviceMaintenanceRecord{}).Count(&total)

	// 获取分页数据
	err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&records).Error

	return records, total, err
}

// GetLifecycleMetrics 获取设备生命周期指标
func GetLifecycleMetrics(db *gorm.DB, deviceID string, days int) ([]DeviceLifecycleMetrics, error) {
	var metrics []DeviceLifecycleMetrics
	since := time.Now().AddDate(0, 0, -days)

	err := db.Where("device_id = ? AND metric_date >= ?", deviceID, since).
		Order("metric_date ASC").
		Find(&metrics).Error

	return metrics, err
}

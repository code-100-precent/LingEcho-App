package models

import (
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/code-100-precent/LingEcho/pkg/hardware/conversation"
	"github.com/code-100-precent/LingEcho/pkg/logger"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// FlexibleInt integer type that can accept both string and number formats
type FlexibleInt int

// UnmarshalJSON implements custom JSON parsing, supporting both string and number formats
func (fi *FlexibleInt) UnmarshalJSON(data []byte) error {
	// Handle null values
	if string(data) == "null" {
		return nil
	}

	// Try parsing as string
	var str string
	if err := json.Unmarshal(data, &str); err == nil {
		// If it's a string, try converting to integer
		if str == "" {
			return nil
		}
		val, err := strconv.Atoi(str)
		if err != nil {
			return err
		}
		*fi = FlexibleInt(val)
		return nil
	}

	// 尝试解析为数字
	var num int
	if err := json.Unmarshal(data, &num); err != nil {
		return err
	}
	*fi = FlexibleInt(num)
	return nil
}

// Int 转换为int指针
func (fi FlexibleInt) Int() *int {
	val := int(fi)
	return &val
}

// Device represents an IoT device
type Device struct {
	ID          string `json:"id" gorm:"primaryKey;size:64"` // MAC address as ID
	UserID      uint   `json:"userId" gorm:"index"`
	GroupID     *uint  `json:"groupId,omitempty" gorm:"index"` // 组织ID，如果设置则表示这是组织共享的设备
	MacAddress  string `json:"macAddress" gorm:"size:64;uniqueIndex"`
	DeviceName  string `json:"deviceName,omitempty" gorm:"size:128"` // 设备名称/别名
	Board       string `json:"board,omitempty" gorm:"size:128"`      // Board type
	AppVersion  string `json:"appVersion,omitempty" gorm:"size:64"`  // Application version
	AutoUpdate  int    `json:"autoUpdate" gorm:"default:1"`          // 0 = disabled, 1 = enabled
	AssistantID *uint  `json:"assistantId,omitempty" gorm:"index"`   // Assistant ID (对应 xiaozhi-esp32 的 agentId)
	Alias       string `json:"alias,omitempty" gorm:"size:128"`      // Device alias

	// 运行状态监控
	IsOnline    bool       `json:"isOnline" gorm:"default:false;index"`  // 在线状态
	LastSeen    *time.Time `json:"lastSeen,omitempty" gorm:"index"`      // 最后在线时间
	StartTime   *time.Time `json:"startTime,omitempty"`                  // 启动时间
	Uptime      int64      `json:"uptime" gorm:"default:0"`              // 运行时长(秒)
	ErrorCount  int        `json:"errorCount" gorm:"default:0"`          // 错误计数
	LastError   string     `json:"lastError,omitempty" gorm:"type:text"` // 最后错误信息
	LastErrorAt *time.Time `json:"lastErrorAt,omitempty"`                // 最后错误时间

	// 系统信息
	SystemInfo   *string `json:"systemInfo,omitempty" gorm:"type:json"`   // 系统信息JSON
	HardwareInfo *string `json:"hardwareInfo,omitempty" gorm:"type:json"` // 硬件信息JSON
	NetworkInfo  *string `json:"networkInfo,omitempty" gorm:"type:json"`  // 网络信息JSON

	// 性能状态
	CPUUsage    float64 `json:"cpuUsage"`    // CPU使用率
	MemoryUsage float64 `json:"memoryUsage"` // 内存使用率
	Temperature float64 `json:"temperature"` // 设备温度

	// 音频设备状态
	AudioStatus *string `json:"audioStatus,omitempty" gorm:"type:json"` // 音频设备状态JSON

	// 服务状态
	ServiceStatus *string `json:"serviceStatus,omitempty" gorm:"type:json"` // 服务状态JSON

	LastConnected *time.Time `json:"lastConnected,omitempty"`
	CreatedAt     time.Time  `json:"createdAt" gorm:"autoCreateTime"`
	UpdatedAt     time.Time  `json:"updatedAt" gorm:"autoUpdateTime"`
}

// TableName specifies the table name
func (Device) TableName() string {
	return "devices"
}

// GetDeviceByMacAddress gets device by MAC address
func GetDeviceByMacAddress(db *gorm.DB, macAddress string) (*Device, error) {
	var device Device
	err := db.Where("mac_address = ?", macAddress).First(&device).Error
	if err != nil {
		return nil, err
	}
	return &device, nil
}

// CreateDevice creates a new device
func CreateDevice(db *gorm.DB, device *Device) error {
	if db == nil {
		return fmt.Errorf("database connection is nil")
	}

	if device == nil {
		return fmt.Errorf("device is nil")
	}

	// 记录即将创建的设备信息
	logger.Info("准备创建设备数据库记录",
		zap.String("deviceId", device.ID),
		zap.String("macAddress", device.MacAddress),
		zap.Uint("userId", device.UserID),
		zap.Any("assistantId", device.AssistantID),
		zap.Any("groupId", device.GroupID),
		zap.String("board", device.Board),
		zap.String("appVersion", device.AppVersion),
		zap.Any("lastSeen", device.LastSeen),
		zap.Any("lastConnected", device.LastConnected))

	// 检查必填字段
	if device.ID == "" {
		return fmt.Errorf("device ID cannot be empty")
	}
	if device.MacAddress == "" {
		return fmt.Errorf("device MAC address cannot be empty")
	}
	if device.UserID == 0 {
		return fmt.Errorf("device user ID cannot be zero")
	}

	// 执行数据库创建操作
	result := db.Create(device)
	if result.Error != nil {
		logger.Error("数据库创建设备记录失败",
			zap.Error(result.Error),
			zap.String("deviceId", device.ID),
			zap.String("macAddress", device.MacAddress),
			zap.Int64("rowsAffected", result.RowsAffected))
		return result.Error
	}

	logger.Info("设备数据库记录创建成功",
		zap.String("deviceId", device.ID),
		zap.String("macAddress", device.MacAddress),
		zap.Int64("rowsAffected", result.RowsAffected))

	return nil
}

// UpdateDevice updates device information
func UpdateDevice(db *gorm.DB, device *Device) error {
	return db.Save(device).Error
}

// GetDeviceByID gets device by ID
func GetDeviceByID(db *gorm.DB, id string) (*Device, error) {
	var device Device
	err := db.Where("id = ?", id).First(&device).Error
	if err != nil {
		return nil, err
	}
	return &device, nil
}

// DeleteDevice deletes a device
func DeleteDevice(db *gorm.DB, id string) error {
	return db.Delete(&Device{}, "id = ?", id).Error
}

// GetUserDevices 获取用户的设备列表（支持组织权限）
func GetUserDevices(db *gorm.DB, userID uint, assistantID *uint) ([]Device, error) {
	var devices []Device

	// 获取用户所属的组织ID列表
	var groupIDs []uint
	var groupMembers []GroupMember
	if err := db.Where("user_id = ?", userID).Find(&groupMembers).Error; err == nil {
		for _, member := range groupMembers {
			groupIDs = append(groupIDs, member.GroupID)
		}
	}
	// 获取用户创建的组织ID
	var userGroups []Group
	if err := db.Where("creator_id = ?", userID).Find(&userGroups).Error; err == nil {
		for _, group := range userGroups {
			groupIDs = append(groupIDs, group.ID)
		}
	}

	// 构建查询
	query := db.Model(&Device{})
	if assistantID != nil {
		query = query.Where("assistant_id = ?", *assistantID)
	}

	// 权限过滤：用户自己的设备 + 组织共享的设备
	if len(groupIDs) > 0 {
		query = query.Where("user_id = ? OR (group_id IS NOT NULL AND group_id IN (?))", userID, groupIDs)
	} else {
		query = query.Where("user_id = ?", userID)
	}

	err := query.Order("last_seen DESC").Find(&devices).Error
	return devices, err
}

// UpdateDeviceStatus 更新设备状态
func UpdateDeviceStatus(db *gorm.DB, macAddress string, status map[string]interface{}) error {
	return db.Model(&Device{}).Where("mac_address = ?", macAddress).Updates(status).Error
}

// UpdateDeviceOnlineStatus 更新设备在线状态
func UpdateDeviceOnlineStatus(db *gorm.DB, macAddress string, isOnline bool) error {
	now := time.Now()
	updates := map[string]interface{}{
		"is_online": isOnline,
		"last_seen": &now,
	}
	if isOnline {
		updates["start_time"] = &now
	}
	return UpdateDeviceStatus(db, macAddress, updates)
}

// LogDeviceError 记录设备错误
func LogDeviceError(db *gorm.DB, deviceID, macAddress, errorType, errorLevel, errorCode, errorMsg, stackTrace, context string) error {
	errorLog := DeviceErrorLog{
		DeviceID:   deviceID,
		MacAddress: macAddress,
		ErrorType:  errorType,
		ErrorLevel: errorLevel,
		ErrorCode:  errorCode,
		ErrorMsg:   errorMsg,
		StackTrace: stackTrace,
		Context:    context,
	}

	// 同时更新设备的错误计数和最后错误信息
	now := time.Now()
	db.Model(&Device{}).Where("mac_address = ?", macAddress).Updates(map[string]interface{}{
		"error_count":   gorm.Expr("error_count + 1"),
		"last_error":    errorMsg,
		"last_error_at": &now,
	})

	return db.Create(&errorLog).Error
}

// CreateCallRecording 创建通话录音记录
func CreateCallRecording(db *gorm.DB, recording *CallRecording) error {
	return db.Create(recording).Error
}

// GetCallRecordingsByAssistant 获取助手的通话录音列表
func GetCallRecordingsByAssistant(db *gorm.DB, userID, assistantID uint, limit, offset int) ([]CallRecording, int64, error) {
	var recordings []CallRecording
	var total int64

	query := db.Where("user_id = ? AND assistant_id = ?", userID, assistantID)

	// 获取总数
	query.Model(&CallRecording{}).Count(&total)

	// 获取分页数据
	err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&recordings).Error

	return recordings, total, err
}

// GetCallRecordingsByDevice 获取设备的通话录音列表
func GetCallRecordingsByDevice(db *gorm.DB, userID uint, macAddress string, limit, offset int) ([]CallRecording, int64, error) {
	var recordings []CallRecording
	var total int64

	query := db.Where("user_id = ? AND mac_address = ?", userID, macAddress)

	// 获取总数
	query.Model(&CallRecording{}).Count(&total)

	// 获取分页数据
	err := query.Order("created_at DESC").Limit(limit).Offset(offset).Find(&recordings).Error

	return recordings, total, err
}

// LogDevicePerformance 记录设备性能数据
func LogDevicePerformance(db *gorm.DB, deviceID, macAddress string, cpuUsage, memoryUsage, temperature float64, networkLatency int) error {
	perfLog := DevicePerformanceLog{
		DeviceID:       deviceID,
		MacAddress:     macAddress,
		CPUUsage:       cpuUsage,
		MemoryUsage:    memoryUsage,
		Temperature:    temperature,
		NetworkLatency: networkLatency,
		RecordedAt:     time.Now(),
	}

	// 同时更新设备的当前性能状态
	db.Model(&Device{}).Where("mac_address = ?", macAddress).Updates(map[string]interface{}{
		"cpu_usage":    cpuUsage,
		"memory_usage": memoryUsage,
		"temperature":  temperature,
	})

	return db.Create(&perfLog).Error
}

// GetDevicePerformanceHistory 获取设备性能历史数据
func GetDevicePerformanceHistory(db *gorm.DB, deviceID string, hours int) ([]DevicePerformanceLog, error) {
	var logs []DevicePerformanceLog
	since := time.Now().Add(-time.Duration(hours) * time.Hour)

	err := db.Where("device_id = ? AND recorded_at >= ?", deviceID, since).
		Order("recorded_at ASC").
		Find(&logs).Error

	return logs, err
}

// DeviceReportReq represents device report request
type DeviceReportReq struct {
	Version             *FlexibleInt           `json:"version,omitempty"`
	FlashSize           *FlexibleInt           `json:"flash_size,omitempty"`
	MinimumFreeHeapSize *FlexibleInt           `json:"minimum_free_heap_size,omitempty"`
	MacAddress          string                 `json:"mac_address,omitempty"`
	UUID                string                 `json:"uuid,omitempty"`
	ChipModelName       string                 `json:"chip_model_name,omitempty"`
	ChipInfo            *ChipInfo              `json:"chip_info,omitempty"`
	Application         *Application           `json:"application,omitempty"`
	PartitionTable      []Partition            `json:"partition_table,omitempty"`
	Ota                 *OtaInfo               `json:"ota,omitempty"`
	Board               *BoardInfo             `json:"board,omitempty"`
	Device              map[string]interface{} `json:"device,omitempty"`
	Model               string                 `json:"model,omitempty"`
}

type ChipInfo struct {
	Model    *FlexibleInt `json:"model,omitempty"`
	Cores    *FlexibleInt `json:"cores,omitempty"`
	Revision *FlexibleInt `json:"revision,omitempty"`
	Features *FlexibleInt `json:"features,omitempty"`
}

type Application struct {
	Name        string `json:"name,omitempty"`
	Version     string `json:"version,omitempty"`
	CompileTime string `json:"compile_time,omitempty"`
	IdfVersion  string `json:"idf_version,omitempty"`
	ElfSha256   string `json:"elf_sha256,omitempty"`
}

type Partition struct {
	Label   string       `json:"label,omitempty"`
	Type    *FlexibleInt `json:"type,omitempty"`
	Subtype *FlexibleInt `json:"subtype,omitempty"`
	Address *FlexibleInt `json:"address,omitempty"`
	Size    *FlexibleInt `json:"size,omitempty"`
}

type OtaInfo struct {
	Label string `json:"label,omitempty"`
}

type BoardInfo struct {
	Type    string       `json:"type,omitempty"`
	SSID    string       `json:"ssid,omitempty"`
	RSSI    *FlexibleInt `json:"rssi,omitempty"`
	Channel *FlexibleInt `json:"channel,omitempty"`
	IP      string       `json:"ip,omitempty"`
	MAC     string       `json:"mac,omitempty"`
}

// DeviceReportResp represents device report response
type DeviceReportResp struct {
	ServerTime *ServerTime `json:"server_time,omitempty"`
	Activation *Activation `json:"activation,omitempty"`
	Error      string      `json:"error,omitempty"`
	Firmware   *Firmware   `json:"firmware,omitempty"`
	Websocket  *Websocket  `json:"websocket,omitempty"`
	MQTT       *MQTT       `json:"mqtt,omitempty"`
}

type ServerTime struct {
	Timestamp      int64 `json:"timestamp"`
	TimezoneOffset int   `json:"timezone_offset"`
}

type Activation struct {
	Code      string `json:"code,omitempty"`
	Message   string `json:"message,omitempty"`
	Challenge string `json:"challenge,omitempty"`
}

type Firmware struct {
	Version string `json:"version"`
	URL     string `json:"url,omitempty"`
}

type Websocket struct {
	URL   string `json:"url"`
	Token string `json:"token,omitempty"`
}

type MQTT struct {
	Endpoint       string `json:"endpoint"`
	ClientID       string `json:"client_id"`
	Username       string `json:"username"`
	Password       string `json:"password"`
	PublishTopic   string `json:"publish_topic"`
	SubscribeTopic string `json:"subscribe_topic"`
}

// DeviceErrorLog 设备错误日志表
type DeviceErrorLog struct {
	BaseModel
	DeviceID   string    `json:"deviceId" gorm:"size:64;index;not null"` // 设备ID (MAC地址)
	MacAddress string    `json:"macAddress" gorm:"size:64;index"`        // MAC地址
	ErrorType  string    `json:"errorType" gorm:"size:64;index"`         // 错误类型
	ErrorLevel string    `json:"errorLevel" gorm:"size:16;index"`        // 错误级别 (INFO, WARN, ERROR, FATAL)
	ErrorCode  string    `json:"errorCode" gorm:"size:32"`               // 错误代码
	ErrorMsg   string    `json:"errorMsg" gorm:"type:text"`              // 错误消息
	StackTrace string    `json:"stackTrace" gorm:"type:text"`            // 堆栈跟踪
	Context    string    `json:"context" gorm:"type:json"`               // 错误上下文
	Resolved   bool      `json:"resolved" gorm:"default:false;index"`    // 是否已解决
	ResolvedAt time.Time `json:"resolvedAt,omitempty"`                   // 解决时间
	ResolvedBy string    `json:"resolvedBy" gorm:"size:128"`             // 解决人
}

func (DeviceErrorLog) TableName() string {
	return "device_error_logs"
}

// CallRecording 通话录音表
type CallRecording struct {
	BaseModel
	UserID      uint   `json:"userId" gorm:"index;not null"`
	AssistantID uint   `json:"assistantId" gorm:"index;not null"`
	DeviceID    string `json:"deviceId" gorm:"size:64;index"`   // 设备ID (MAC地址)
	MacAddress  string `json:"macAddress" gorm:"size:64;index"` // MAC地址
	SessionID   string `json:"sessionId" gorm:"size:128;index"` // 会话ID

	// 录音文件信息
	AudioPath   string `json:"audioPath" gorm:"size:512;not null"` // 音频文件路径
	StorageURL  string `json:"storageUrl" gorm:"size:1024"`        // 存储音频的URL
	AudioFormat string `json:"audioFormat" gorm:"size:16"`         // 音频格式 (wav, mp3, opus)
	AudioSize   int64  `json:"audioSize" gorm:"default:0"`         // 文件大小(字节)
	Duration    int    `json:"duration" gorm:"default:0"`          // 录音时长(秒)
	SampleRate  int    `json:"sampleRate" gorm:"default:16000"`    // 采样率
	Channels    int    `json:"channels" gorm:"default:1"`          // 声道数

	// 通话信息
	CallType   string    `json:"callType" gorm:"size:32;index"`   // 通话类型 (voice, text)
	CallStatus string    `json:"callStatus" gorm:"size:32;index"` // 通话状态 (completed, interrupted, error)
	StartTime  time.Time `json:"startTime" gorm:"index"`          // 开始时间
	EndTime    time.Time `json:"endTime" gorm:"index"`            // 结束时间

	// 内容摘要
	UserInput  string `json:"userInput" gorm:"type:text"`  // 用户输入文本
	AIResponse string `json:"aiResponse" gorm:"type:text"` // AI回复文本
	Summary    string `json:"summary" gorm:"type:text"`    // 对话摘要
	Keywords   string `json:"keywords" gorm:"type:text"`   // 关键词JSON数组（存储为文本）

	// 质量评估
	AudioQuality float64 `json:"audioQuality"` // 音频质量评分 (0-1)
	NoiseLevel   float64 `json:"noiseLevel"`   // 噪音水平

	// 标签和分类
	Tags        string `json:"tags" gorm:"type:text"`                  // 标签JSON数组（存储为文本）
	Category    string `json:"category" gorm:"size:64;index"`          // 分类
	IsImportant bool   `json:"isImportant" gorm:"default:false;index"` // 是否重要
	IsArchived  bool   `json:"isArchived" gorm:"default:false;index"`  // 是否归档

	// AI分析相关字段
	AIAnalysis      string     `json:"aiAnalysis" gorm:"type:text"`                           // AI分析结果
	AnalysisStatus  string     `json:"analysisStatus" gorm:"size:32;default:'pending';index"` // 分析状态: pending, analyzing, completed, failed
	AnalysisError   string     `json:"analysisError" gorm:"type:text"`                        // 分析错误信息
	AnalyzedAt      *time.Time `json:"analyzedAt"`                                            // 分析完成时间
	AutoAnalyzed    bool       `json:"autoAnalyzed" gorm:"default:false"`                     // 是否自动分析
	AnalysisVersion int        `json:"analysisVersion" gorm:"default:1"`                      // 分析版本号

	// 对话详情数据 (JSON格式存储)
	ConversationDetailsJSON string `json:"-" gorm:"type:longtext;column:conversation_details"` // 对话详情JSON数据
	TimingMetricsJSON       string `json:"-" gorm:"type:longtext;column:timing_metrics"`       // 时间指标JSON数据
}

func (CallRecording) TableName() string {
	return "call_recordings"
}

// SetConversationDetails 设置对话详情数据
func (cr *CallRecording) SetConversationDetails(details *conversation.ConversationDetails) error {
	if details == nil {
		cr.ConversationDetailsJSON = ""
		return nil
	}

	data, err := json.Marshal(details)
	if err != nil {
		return err
	}
	cr.ConversationDetailsJSON = string(data)
	return nil
}

// GetConversationDetails 获取对话详情数据
func (cr *CallRecording) GetConversationDetails() (*conversation.ConversationDetails, error) {
	if cr.ConversationDetailsJSON == "" {
		return nil, nil
	}

	var details conversation.ConversationDetails
	err := json.Unmarshal([]byte(cr.ConversationDetailsJSON), &details)
	if err != nil {
		return nil, err
	}
	return &details, nil
}

// SetTimingMetrics 设置时间指标数据
func (cr *CallRecording) SetTimingMetrics(metrics *conversation.TimingMetrics) error {
	if metrics == nil {
		cr.TimingMetricsJSON = ""
		return nil
	}

	data, err := json.Marshal(metrics)
	if err != nil {
		return err
	}
	cr.TimingMetricsJSON = string(data)
	return nil
}

// GetTimingMetrics 获取时间指标数据
func (cr *CallRecording) GetTimingMetrics() (*conversation.TimingMetrics, error) {
	if cr.TimingMetricsJSON == "" {
		return nil, nil
	}

	var metrics conversation.TimingMetrics
	err := json.Unmarshal([]byte(cr.TimingMetricsJSON), &metrics)
	if err != nil {
		return nil, err
	}
	return &metrics, nil
}

// DevicePerformanceLog 设备性能日志表（用于历史趋势分析）
type DevicePerformanceLog struct {
	BaseModel
	DeviceID       string    `json:"deviceId" gorm:"size:64;index;not null"` // 设备ID (MAC地址)
	MacAddress     string    `json:"macAddress" gorm:"size:64;index"`        // MAC地址
	CPUUsage       float64   `json:"cpuUsage"`                               // CPU使用率
	MemoryUsage    float64   `json:"memoryUsage"`                            // 内存使用率
	Temperature    float64   `json:"temperature"`                            // 设备温度
	NetworkLatency int       `json:"networkLatency"`                         // 网络延迟(ms)
	RecordedAt     time.Time `json:"recordedAt" gorm:"index"`                // 记录时间
}

func (DevicePerformanceLog) TableName() string {
	return "device_performance_logs"
}

// 系统信息结构体
type SystemInfo struct {
	OS            string `json:"os"`
	OSVersion     string `json:"osVersion"`
	Architecture  string `json:"architecture"`
	KernelVersion string `json:"kernelVersion"`
	Hostname      string `json:"hostname"`
}

// 硬件信息结构体
type HardwareInfo struct {
	CPUModel     string `json:"cpuModel"`
	CPUCores     int    `json:"cpuCores"`
	TotalMemory  int64  `json:"totalMemory"`  // MB
	TotalStorage int64  `json:"totalStorage"` // MB
	DeviceModel  string `json:"deviceModel"`
}

// 网络信息结构体
type NetworkInfo struct {
	IPAddress      string `json:"ipAddress"`
	NetworkType    string `json:"networkType"`    // WiFi, Ethernet, 4G, 5G
	SignalStrength int    `json:"signalStrength"` // 信号强度 (0-100)
	Bandwidth      int    `json:"bandwidth"`      // 带宽 (Mbps)
}

// 音频设备状态结构体
type AudioStatus struct {
	Microphone struct {
		IsAvailable bool    `json:"isAvailable"`
		SampleRate  int     `json:"sampleRate"`
		Channels    int     `json:"channels"`
		Volume      float64 `json:"volume"`
		IsMuted     bool    `json:"isMuted"`
	} `json:"microphone"`
	Speaker struct {
		IsAvailable bool    `json:"isAvailable"`
		Volume      float64 `json:"volume"`
		IsMuted     bool    `json:"isMuted"`
	} `json:"speaker"`
}

// 服务状态结构体
type ServiceStatus struct {
	ASRService string    `json:"asrService"` // running, stopped, error
	TTSService string    `json:"ttsService"`
	LLMService string    `json:"llmService"`
	LastCheck  time.Time `json:"lastCheck"`
}

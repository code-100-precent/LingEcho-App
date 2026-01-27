import { get, post } from '@/utils/request';

export interface DeviceLifecycle {
  id: string;
  deviceId: string;
  macAddress: string;
  status: string;
  prevStatus: string;
  manufactureDate?: string;
  activationDate?: string;
  configurationDate?: string;
  lastActiveDate?: string;
  totalUptime: number;
  totalDowntime: number;
  maintenanceCount: number;
  faultCount: number;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  lastFaultDate?: string;
  deactivationDate?: string;
  deactivationReason?: string;
  retirementDate?: string;
  retirementReason?: string;
  metadata?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceLifecycleHistory {
  id: string;
  deviceId: string;
  fromStatus: string;
  toStatus: string;
  reason: string;
  triggerType: string;
  triggerBy: string;
  duration: number;
  metadata?: string;
  createdAt: string;
}

export interface DeviceMaintenanceRecord {
  id: string;
  deviceId: string;
  maintenanceType: string;
  status: string;
  priority: string;
  scheduledDate?: string;
  startDate?: string;
  endDate?: string;
  estimatedDuration: number;
  actualDuration: number;
  title: string;
  description?: string;
  checklist?: string;
  result?: string;
  issues?: string;
  recommendations?: string;
  firmwareBefore?: string;
  firmwareAfter?: string;
  configBefore?: string;
  configAfter?: string;
  performanceBefore?: string;
  performanceAfter?: string;
  assignedTo?: string;
  completedBy?: string;
  estimatedCost: number;
  actualCost: number;
  tags?: string;
  attachments?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceLifecycleMetrics {
  id: string;
  deviceId: string;
  metricDate: string;
  uptimePercentage: number;
  mtbf: number;
  mttr: number;
  avgCpuUsage: number;
  avgMemoryUsage: number;
  avgTemperature: number;
  avgNetworkLatency: number;
  activeHours: number;
  idleHours: number;
  interactionCount: number;
  maintenanceHours: number;
  maintenanceCost: number;
  errorRate: number;
  successRate: number;
  userSatisfactionScore: number;
  createdAt: string;
  updatedAt: string;
}

export interface LifecycleOverview {
  lifecycle: DeviceLifecycle;
  recentMaintenance: DeviceMaintenanceRecord[];
  recentMetrics: DeviceLifecycleMetrics[];
  statusDuration: number;
  totalUptime: number;
  totalDowntime: number;
  maintenanceCount: number;
  faultCount: number;
}

export interface MaintenanceRecordsResponse {
  records: DeviceMaintenanceRecord[];
  total: number;
  limit: number;
  offset: number;
}

// 获取设备生命周期信息
export const getDeviceLifecycle = (deviceId: string) => {
  return get<DeviceLifecycle>(`/device/${deviceId}/lifecycle`);
};

// 获取设备生命周期概览
export const getLifecycleOverview = (deviceId: string) => {
  return get<LifecycleOverview>(`/device/${deviceId}/lifecycle/overview`);
};

// 获取设备生命周期历史
export const getLifecycleHistory = (deviceId: string) => {
  return get<DeviceLifecycleHistory[]>(`/device/${deviceId}/lifecycle/history`);
};

// 手动转换设备状态
export const transitionDeviceStatus = (deviceId: string, toStatus: string, reason?: string) => {
  return post(`/device/${deviceId}/lifecycle/transition`, {
    toStatus,
    reason,
  });
};

// 获取设备生命周期指标
export const getLifecycleMetrics = (deviceId: string, days: number = 30) => {
  return get<DeviceLifecycleMetrics[]>(`/device/${deviceId}/lifecycle/metrics`, {
    params: { days },
  });
};

// 计算当前指标
export const calculateCurrentMetrics = (deviceId: string) => {
  return post<DeviceLifecycleMetrics>(`/device/${deviceId}/lifecycle/metrics/calculate`);
};

// 获取设备维护记录
export const getMaintenanceRecords = (deviceId: string, limit: number = 20, offset: number = 0) => {
  return get<MaintenanceRecordsResponse>(`/device/${deviceId}/lifecycle/maintenance`, {
    params: { limit, offset },
  });
};

// 以下维护相关功能已移除：
// - scheduleMaintenance (安排设备维护)
// - startMaintenance (开始维护)  
// - completeMaintenance (完成维护)

// 维护类型选项
export const MAINTENANCE_TYPES = [
  { value: 'preventive', label: '预防性维护' },
  { value: 'corrective', label: '纠正性维护' },
  { value: 'predictive', label: '预测性维护' },
  { value: 'emergency', label: '紧急维护' },
  { value: 'firmware', label: '固件更新' },
  { value: 'configuration', label: '配置更新' },
  { value: 'inspection', label: '检查' },
  { value: 'calibration', label: '校准' },
];

// 维护优先级选项
export const MAINTENANCE_PRIORITIES = [
  { value: 'low', label: '低' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高' },
  { value: 'critical', label: '紧急' },
];

// 设备状态选项
export const DEVICE_STATUSES = [
  { value: 'manufacturing', label: '制造中' },
  { value: 'inventory', label: '库存中' },
  { value: 'activation_ready', label: '等待激活' },
  { value: 'activating', label: '激活中' },
  { value: 'configuring', label: '配置中' },
  { value: 'active', label: '运行中' },
  { value: 'maintenance', label: '维护中' },
  { value: 'faulty', label: '故障' },
  { value: 'offline', label: '离线' },
  { value: 'deactivated', label: '已停用' },
  { value: 'retired', label: '已退役' },
];

// 获取状态显示名称
export const getStatusLabel = (status: string) => {
  const statusOption = DEVICE_STATUSES.find(s => s.value === status);
  return statusOption ? statusOption.label : status;
};

// 获取维护类型显示名称
export const getMaintenanceTypeLabel = (type: string) => {
  const typeOption = MAINTENANCE_TYPES.find(t => t.value === type);
  return typeOption ? typeOption.label : type;
};

// 获取维护优先级显示名称
export const getMaintenancePriorityLabel = (priority: string) => {
  const priorityOption = MAINTENANCE_PRIORITIES.find(p => p.value === priority);
  return priorityOption ? priorityOption.label : priority;
};
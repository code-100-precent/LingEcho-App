import { BaseApiService } from './base.service'

// 告警类型
export type AlertType = 'system_error' | 'quota_exceeded' | 'service_error' | 'custom'

// 告警严重程度
export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low'

// 告警状态
export type AlertStatus = 'active' | 'resolved' | 'muted'

// 通知渠道
export type NotificationChannel = 'email' | 'internal' | 'webhook' | 'sms'

// 告警条件
export interface AlertCondition {
  quotaType?: string
  quotaThreshold?: number
  errorCount?: number
  errorWindow?: number
  serviceName?: string
  failureRate?: number
  responseTime?: number
  customExpression?: string
}

// 告警规则
export interface AlertRule {
  id: number
  userId: number
  name: string
  description?: string
  alertType: AlertType
  severity: AlertSeverity
  conditions: string // JSON string
  channels: string // JSON array string
  webhookUrl?: string
  webhookMethod?: string
  cooldown: number
  enabled: boolean
  triggerCount: number
  lastTriggerAt?: string
  createdAt: string
  updatedAt: string
}

// 告警记录
export interface Alert {
  id: number
  userId: number
  ruleId: number
  rule?: AlertRule
  alertType: AlertType
  severity: AlertSeverity
  title: string
  message: string
  data?: string // JSON string
  status: AlertStatus
  resolvedAt?: string
  resolvedBy?: number
  notified: boolean
  notifiedAt?: string
  createdAt: string
  updatedAt: string
}

// 告警通知记录
export interface AlertNotification {
  id: number
  alertId: number
  alert?: Alert
  channel: NotificationChannel
  status: string
  message?: string
  sentAt?: string
  createdAt: string
}

// 创建告警规则请求
export interface CreateAlertRuleRequest {
  name: string
  description?: string
  alertType: AlertType
  severity: AlertSeverity
  conditions: AlertCondition
  channels: NotificationChannel[]
  webhookUrl?: string
  webhookMethod?: string
  cooldown?: number
  enabled?: boolean
}

// 更新告警规则请求
export interface UpdateAlertRuleRequest {
  name?: string
  description?: string
  severity?: AlertSeverity
  conditions?: AlertCondition
  channels?: NotificationChannel[]
  webhookUrl?: string
  webhookMethod?: string
  cooldown?: number
  enabled?: boolean
}

// 告警列表响应
export interface AlertListResponse {
  list: Alert[]
  total: number
  page: number
  pageSize: number
}

class AlertService extends BaseApiService {
  constructor() {
    super('/alert')
  }

  // 创建告警规则
  async createAlertRule(data: CreateAlertRuleRequest): Promise<AlertRule> {
    const response = await this.post<AlertRule>('/rules', data)
    this.invalidateCache()
    return this.handleResponse(response)
  }

  // 获取告警规则列表
  async getAlertRules(params?: {
    alertType?: AlertType
    enabled?: boolean
  }): Promise<AlertRule[]> {
    const response = await this.get<AlertRule[]>('/rules', { params }, { enabled: true, ttl: 60000 })
    return this.handleResponse(response)
  }

  // 获取告警规则详情
  async getAlertRule(id: number): Promise<AlertRule> {
    const response = await this.get<AlertRule>(`/rules/${id}`, {}, { enabled: true, ttl: 300000 })
    return this.handleResponse(response)
  }

  // 更新告警规则
  async updateAlertRule(id: number, data: UpdateAlertRuleRequest): Promise<AlertRule> {
    const response = await this.put<AlertRule>(`/rules/${id}`, data)
    this.invalidateCache()
    return this.handleResponse(response)
  }

  // 删除告警规则
  async deleteAlertRule(id: number): Promise<null> {
    const response = await this.delete<null>(`/rules/${id}`)
    this.invalidateCache()
    return this.handleResponse(response)
  }

  // 获取告警列表
  async getAlerts(params?: {
    status?: AlertStatus
    alertType?: AlertType
    page?: number
    pageSize?: number
  }): Promise<AlertListResponse> {
    const response = await this.get<AlertListResponse>('', { params })
    return this.handleResponse(response)
  }

  // 获取告警详情
  async getAlert(id: number): Promise<{
    alert: Alert
    notifications: AlertNotification[]
  }> {
    const response = await this.get<{
      alert: Alert
      notifications: AlertNotification[]
    }>(`/${id}`, {}, { enabled: true, ttl: 30000 })
    return this.handleResponse(response)
  }

  // 解决告警
  async resolveAlert(id: number): Promise<Alert> {
    const response = await this.post<Alert>(`/${id}/resolve`)
    this.invalidateCache()
    return this.handleResponse(response)
  }

  // 静音告警
  async muteAlert(id: number): Promise<Alert> {
    const response = await this.post<Alert>(`/${id}/mute`)
    this.invalidateCache()
    return this.handleResponse(response)
  }
}

// 导出单例
export const alertService = new AlertService()

// 兼容性导出
export const createAlertRule = alertService.createAlertRule.bind(alertService)
export const getAlertRules = alertService.getAlertRules.bind(alertService)
export const getAlertRule = alertService.getAlertRule.bind(alertService)
export const updateAlertRule = alertService.updateAlertRule.bind(alertService)
export const deleteAlertRule = alertService.deleteAlertRule.bind(alertService)
export const getAlerts = alertService.getAlerts.bind(alertService)
export const getAlert = alertService.getAlert.bind(alertService)
export const resolveAlert = alertService.resolveAlert.bind(alertService)
export const muteAlert = alertService.muteAlert.bind(alertService)


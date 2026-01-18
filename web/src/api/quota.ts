import { BaseApiService } from './base.service'

// 配额类型
export type QuotaType = 
  | 'storage'
  | 'llm_tokens'
  | 'llm_calls'
  | 'api_calls'
  | 'call_duration'
  | 'call_count'
  | 'asr_duration'
  | 'asr_count'
  | 'tts_duration'
  | 'tts_count'

// 配额周期
export type QuotaPeriod = 'lifetime' | 'monthly' | 'yearly'

// 用户配额
export interface UserQuota {
  id: number
  userId: number
  quotaType: QuotaType
  totalQuota: number
  usedQuota: number
  period: QuotaPeriod
  resetAt?: string
  description?: string
  createdAt: string
  updatedAt: string
}

// 组织配额
export interface GroupQuota {
  id: number
  groupId: number
  quotaType: QuotaType
  totalQuota: number
  usedQuota: number
  period: QuotaPeriod
  resetAt?: string
  description?: string
  createdAt: string
  updatedAt: string
}

// 创建用户配额请求
export interface CreateUserQuotaRequest {
  quotaType: QuotaType
  totalQuota: number
  period?: QuotaPeriod
  description?: string
}

// 更新用户配额请求
export interface UpdateUserQuotaRequest {
  totalQuota?: number
  period?: QuotaPeriod
  description?: string
}

// 创建组织配额请求
export interface CreateGroupQuotaRequest {
  quotaType: QuotaType
  totalQuota: number
  period?: QuotaPeriod
  description?: string
}

// 更新组织配额请求
export interface UpdateGroupQuotaRequest {
  totalQuota?: number
  period?: QuotaPeriod
  description?: string
}

class QuotaService extends BaseApiService {
  constructor() {
    super('/quota')
  }

  // 获取用户配额列表
  async getUserQuotas(): Promise<UserQuota[]> {
    const response = await this.get<UserQuota[]>('/user', {}, { enabled: true, ttl: 60000 })
    return this.handleResponse(response)
  }

  // 获取用户配额详情
  async getUserQuota(type: QuotaType): Promise<UserQuota> {
    const response = await this.get<UserQuota>(`/user/${type}`, {}, { enabled: true, ttl: 30000 })
    return this.handleResponse(response)
  }

  // 创建用户配额
  async createUserQuota(data: CreateUserQuotaRequest): Promise<UserQuota> {
    const response = await this.post<UserQuota>('/user', data)
    this.invalidateCache()
    return this.handleResponse(response)
  }

  // 更新用户配额
  async updateUserQuota(type: QuotaType, data: UpdateUserQuotaRequest): Promise<UserQuota> {
    const response = await this.put<UserQuota>(`/user/${type}`, data)
    this.invalidateCache()
    return this.handleResponse(response)
  }

  // 删除用户配额
  async deleteUserQuota(type: QuotaType): Promise<null> {
    const response = await this.delete<null>(`/user/${type}`)
    this.invalidateCache()
    return this.handleResponse(response)
  }

  // 获取组织配额列表
  async getGroupQuotas(groupId: number): Promise<GroupQuota[]> {
    const response = await this.get<GroupQuota[]>(`/group/${groupId}`, {}, { enabled: true, ttl: 60000 })
    return this.handleResponse(response)
  }

  // 获取组织配额详情
  async getGroupQuota(groupId: number, type: QuotaType): Promise<GroupQuota> {
    const response = await this.get<GroupQuota>(`/group/${groupId}/${type}`, {}, { enabled: true, ttl: 30000 })
    return this.handleResponse(response)
  }

  // 创建组织配额
  async createGroupQuota(groupId: number, data: CreateGroupQuotaRequest): Promise<GroupQuota> {
    const response = await this.post<GroupQuota>(`/group/${groupId}`, data)
    this.invalidateCache()
    return this.handleResponse(response)
  }

  // 更新组织配额
  async updateGroupQuota(groupId: number, type: QuotaType, data: UpdateGroupQuotaRequest): Promise<GroupQuota> {
    const response = await this.put<GroupQuota>(`/group/${groupId}/${type}`, data)
    this.invalidateCache()
    return this.handleResponse(response)
  }

  // 删除组织配额
  async deleteGroupQuota(groupId: number, type: QuotaType): Promise<null> {
    const response = await this.delete<null>(`/group/${groupId}/${type}`)
    this.invalidateCache()
    return this.handleResponse(response)
  }
}

// 导出单例
export const quotaService = new QuotaService()

// 兼容性导出
export const getUserQuotas = quotaService.getUserQuotas.bind(quotaService)
export const getUserQuota = quotaService.getUserQuota.bind(quotaService)
export const createUserQuota = quotaService.createUserQuota.bind(quotaService)
export const updateUserQuota = quotaService.updateUserQuota.bind(quotaService)
export const deleteUserQuota = quotaService.deleteUserQuota.bind(quotaService)
export const getGroupQuotas = quotaService.getGroupQuotas.bind(quotaService)
export const getGroupQuota = quotaService.getGroupQuota.bind(quotaService)
export const createGroupQuota = quotaService.createGroupQuota.bind(quotaService)
export const updateGroupQuota = quotaService.updateGroupQuota.bind(quotaService)
export const deleteGroupQuota = quotaService.deleteGroupQuota.bind(quotaService)

// 获取配额类型标签
export const getQuotaTypeLabel = (type: QuotaType): string => {
  const labels: Record<QuotaType, string> = {
    storage: '存储空间',
    llm_tokens: 'LLM Token',
    llm_calls: 'LLM 调用次数',
    api_calls: 'API 调用次数',
    call_duration: '通话时长',
    call_count: '通话次数',
    asr_duration: '语音识别时长',
    asr_count: '语音识别次数',
    tts_duration: '语音合成时长',
    tts_count: '语音合成次数',
  }
  return labels[type] || type
}

// 格式化配额值
export const formatQuotaValue = (type: QuotaType, value: number): string => {
  switch (type) {
    case 'storage':
      return formatBytes(value)
    case 'llm_tokens':
    case 'llm_calls':
    case 'api_calls':
    case 'call_count':
    case 'asr_count':
    case 'tts_count':
      return formatNumber(value)
    case 'call_duration':
    case 'asr_duration':
    case 'tts_duration':
      return formatDuration(value)
    default:
      return value.toString()
  }
}

// 格式化字节
const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`
}

// 格式化数字
const formatNumber = (n: number): string => {
  if (n < 1000) return n.toString()
  if (n < 1000000) return `${(n / 1000).toFixed(2)}K`
  return `${(n / 1000000).toFixed(2)}M`
}

// 格式化时长（秒）
const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}秒`
  if (seconds < 3600) return `${(seconds / 60).toFixed(1)}分钟`
  return `${(seconds / 3600).toFixed(1)}小时`
}


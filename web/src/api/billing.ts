import { BaseApiService, CacheConfig } from './base.service'

// 使用量类型
export type UsageType = 'llm' | 'call' | 'asr' | 'tts' | 'api'

// 使用量记录
export interface UsageRecord {
  id: number
  userId: number
  credentialId: number
  assistantId?: number
  sessionId?: string
  callLogId?: number
  usageType: UsageType
  model?: string
  promptTokens: number
  completionTokens: number
  totalTokens: number
  callDuration: number
  callCount: number
  audioDuration: number
  audioSize: number
  apiCallCount: number
  metadata?: string
  description?: string
  usageTime: string
  createdAt: string
  updatedAt: string
}

// 使用量统计
export interface UsageStatistics {
  startTime: string
  endTime: string
  llmCalls: number
  llmTokens: number
  promptTokens: number
  completionTokens: number
  callDuration: number
  callCount: number
  avgCallDuration: number
  asrDuration: number
  asrCount: number
  ttsDuration: number
  ttsCount: number
  apiCalls: number
}

// 每日使用量数据
export interface DailyUsageData {
  date: string // YYYY-MM-DD
  llmCalls: number
  llmTokens: number
  callCount: number
  callDuration: number
  asrCount: number
  asrDuration: number
  ttsCount: number
  ttsDuration: number
  apiCalls: number
}

// 账单状态
export type BillStatus = 'draft' | 'generated' | 'exported' | 'archived'

// 账单
export interface Bill {
  id: number
  userId: number
  credentialId?: number
  billNo: string
  title: string
  status: BillStatus
  startTime: string
  endTime: string
  totalLLMCalls: number
  totalLLMTokens: number
  totalPromptTokens: number
  totalCompletionTokens: number
  totalCallDuration: number
  totalCallCount: number
  totalASRDuration: number
  totalASRCount: number
  totalTTSDuration: number
  totalTTSCount: number
  totalAPICalls: number
  exportFormat?: string
  exportPath?: string
  exportedAt?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

// 生成账单请求
export interface GenerateBillRequest {
  credentialId?: number
  groupId?: number
  startTime: string
  endTime: string
  title?: string
}

class BillingService extends BaseApiService {
  constructor() {
    super('/billing')
  }

  // 获取使用量统计
  async getUsageStatistics(params?: {
    startTime?: string
    endTime?: string
    credentialId?: number
    groupId?: number
  }): Promise<UsageStatistics> {
    const response = await this.get<UsageStatistics>('/statistics', { params }, { enabled: true, ttl: 60000 })
    return this.handleResponse(response)
  }

  // 获取每日使用量数据（用于图表）
  async getDailyUsageData(params?: {
    startTime?: string
    endTime?: string
    credentialId?: number
    groupId?: number
  }): Promise<DailyUsageData[]> {
    const response = await this.get<DailyUsageData[]>('/daily-usage', { params }, { enabled: true, ttl: 60000 })
    return this.handleResponse(response)
  }

  // 获取使用量记录列表
  async getUsageRecords(params?: {
    page?: number
    size?: number
    credentialId?: number
    assistantId?: number
    groupId?: number
    usageType?: UsageType
    startTime?: string
    endTime?: string
    orderBy?: string
  }): Promise<{
    list: UsageRecord[]
    total: number
    page: number
    size: number
  }> {
    const response = await this.get<{
      list: UsageRecord[]
      total: number
      page: number
      size: number
    }>('/usage-records', { params })
    return this.handleResponse(response)
  }

  // 导出使用量记录
  async exportUsageRecords(params?: {
    credentialId?: number
    assistantId?: number
    usageType?: UsageType
    startTime?: string
    endTime?: string
    format?: 'csv' | 'excel'
  }): Promise<void> {
    const queryParams = new URLSearchParams()
    if (params?.credentialId) queryParams.append('credentialId', params.credentialId.toString())
    if (params?.assistantId) queryParams.append('assistantId', params.assistantId.toString())
    if (params?.usageType) queryParams.append('usageType', params.usageType)
    if (params?.startTime) queryParams.append('startTime', params.startTime)
    if (params?.endTime) queryParams.append('endTime', params.endTime)
    if (params?.format) queryParams.append('format', params.format)
    
    // 使用 axios 下载文件（携带认证信息）
    const axiosInstance = (await import('@/utils/axios')).default
    
    try {
      const response = await axiosInstance({
        url: `${this.baseUrl}/usage-records/export?${queryParams.toString()}`,
        method: 'GET',
        responseType: 'blob',
      })
      
      // 创建 blob URL 并触发下载
      const isExcel = params?.format === 'excel'
      const blobType = isExcel 
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv;charset=utf-8'
      const fileExt = isExcel ? 'xlsx' : 'csv'
      const blob = new Blob([response.data], { type: blobType })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `usage_records_${new Date().toISOString().split('T')[0]}.${fileExt}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error: any) {
      throw new Error(error?.response?.data?.msg || error?.message || '导出失败')
    }
  }

  // 生成账单
  async generateBill(data: GenerateBillRequest): Promise<Bill> {
    const response = await this.post<Bill>('/bills', data)
    return this.handleResponse(response)
  }

  // 获取账单列表
  async getBills(params?: {
    page?: number
    size?: number
    credentialId?: number
    groupId?: number
    status?: BillStatus
    startTime?: string
    endTime?: string
    orderBy?: string
  }): Promise<{
    list: Bill[]
    total: number
    page: number
    size: number
  }> {
    const response = await this.get<{
      list: Bill[]
      total: number
      page: number
      size: number
    }>('/bills', { params })
    return this.handleResponse(response)
  }

  // 获取单个账单
  async getBill(id: number): Promise<Bill> {
    const response = await this.get<Bill>(`/bills/${id}`, {}, { enabled: true, ttl: 300000 })
    return this.handleResponse(response)
  }

  // 导出账单
  async exportBill(id: number, format?: 'csv' | 'excel'): Promise<void> {
    const queryParams = new URLSearchParams()
    if (format) queryParams.append('format', format)
    
    // 使用 axios 下载文件（携带认证信息）
    const axiosInstance = (await import('@/utils/axios')).default
    
    try {
      const response = await axiosInstance({
        url: `${this.baseUrl}/bills/${id}/export?${queryParams.toString()}`,
        method: 'GET',
        responseType: 'blob',
      })
      
      // 创建 blob URL 并触发下载
      const isExcel = format === 'excel'
      const blobType = isExcel 
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'text/csv;charset=utf-8'
      const fileExt = isExcel ? 'xlsx' : 'csv'
      const blob = new Blob([response.data], { type: blobType })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `bill_${id}_${new Date().toISOString().split('T')[0]}.${fileExt}`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error: any) {
      throw new Error(error?.response?.data?.msg || error?.message || '导出失败')
    }
  }
}

// 导出单例
export const billingService = new BillingService()

// 兼容性导出
export const getUsageStatistics = billingService.getUsageStatistics.bind(billingService)
export const getDailyUsageData = billingService.getDailyUsageData.bind(billingService)
export const getUsageRecords = billingService.getUsageRecords.bind(billingService)
export const exportUsageRecords = billingService.exportUsageRecords.bind(billingService)
export const generateBill = billingService.generateBill.bind(billingService)
export const getBills = billingService.getBills.bind(billingService)
export const getBill = billingService.getBill.bind(billingService)
export const exportBill = billingService.exportBill.bind(billingService)



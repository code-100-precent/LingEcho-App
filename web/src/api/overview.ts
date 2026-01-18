import { BaseApiService } from './base.service'
import type { OverviewConfig } from '@/types/overview'

class OverviewService extends BaseApiService {
  constructor() {
    super('/group')
  }

  // 获取组织的概览配置
  async getOverviewConfig(organizationId: number): Promise<OverviewConfig | null> {
    const response = await this.get<OverviewConfig | null>(`/${organizationId}/overview/config`, {}, { enabled: true, ttl: 300000 })
    return this.handleResponse(response)
  }

  // 保存概览配置
  async saveOverviewConfig(config: OverviewConfig): Promise<OverviewConfig> {
    // 将配置转换为后端期望的格式
    const payload = {
      name: config.name,
      description: config.description || '',
      layout: config.layout,
      widgets: config.widgets,
      theme: config.theme || {},
      header: config.header,
      footer: config.footer
    }
    const response = await this.post<OverviewConfig>(`/${config.organizationId}/overview/config`, payload)
    this.invalidateCache()
    return this.handleResponse(response)
  }

  // 更新概览配置
  async updateOverviewConfig(config: OverviewConfig): Promise<OverviewConfig> {
    // 将配置转换为后端期望的格式
    const payload = {
      name: config.name,
      description: config.description || '',
      layout: config.layout,
      widgets: config.widgets,
      theme: config.theme || {}
    }
    const response = await this.put<OverviewConfig>(`/${config.organizationId}/overview/config`, payload)
    this.invalidateCache()
    return this.handleResponse(response)
  }

  // 删除概览配置
  async deleteOverviewConfig(organizationId: number): Promise<null> {
    const response = await this.delete<null>(`/${organizationId}/overview/config`)
    this.invalidateCache()
    return this.handleResponse(response)
  }

  // 获取组织统计数据（用于Widget）
  async getOrganizationStats(organizationId: number): Promise<any> {
    const response = await this.get<any>(`/${organizationId}/statistics`, {}, { enabled: true, ttl: 60000 })
    return this.handleResponse(response)
  }
}

// 导出单例
export const overviewService = new OverviewService()

// 兼容性导出
export const getOverviewConfig = overviewService.getOverviewConfig.bind(overviewService)
export const saveOverviewConfig = overviewService.saveOverviewConfig.bind(overviewService)
export const updateOverviewConfig = overviewService.updateOverviewConfig.bind(overviewService)
export const deleteOverviewConfig = overviewService.deleteOverviewConfig.bind(overviewService)
export const getOrganizationStats = overviewService.getOrganizationStats.bind(overviewService)


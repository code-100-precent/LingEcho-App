import { BaseApiService } from './base.service'

// JS模板接口定义
export interface JSTemplate {
  id: string
  jsSourceId: string
  name: string
  type: 'default' | 'custom'
  content: string
  usage?: string
  user_id?: number
  created_at: string
  updated_at: string
}

// 创建JS模板表单
export interface CreateJSTemplateForm {
  name: string
  type: 'default' | 'custom'
  content: string
  usage?: string
}

// 更新JS模板表单
export interface UpdateJSTemplateForm {
  name?: string
  content?: string
  usage?: string
}

// JS模板列表响应
export interface JSTemplateListResponse {
  data: JSTemplate[]
  page: number
  limit: number
  total: number
}

class JSTemplateService extends BaseApiService {
  constructor() {
    super('/js-templates')
  }

  // 创建JS模板
  async createTemplate(data: CreateJSTemplateForm): Promise<JSTemplate> {
    const response = await this.post<JSTemplate>('', data)
    this.invalidateCache()
    return this.handleResponse(response)
  }

  // 获取JS模板列表
  async getTemplates(params?: {
    page?: number
    limit?: number
  }): Promise<JSTemplateListResponse> {
    const response = await this.get<JSTemplateListResponse>('', { params }, { enabled: true, ttl: 60000 })
    return this.handleResponse(response)
  }

  // 获取单个JS模板
  async getTemplate(id: string): Promise<JSTemplate> {
    const response = await this.get<JSTemplate>(`/${id}`, {}, { enabled: true, ttl: 300000 })
    return this.handleResponse(response)
  }

  // 根据名称获取JS模板
  async getTemplatesByName(name: string): Promise<JSTemplate[]> {
    const response = await this.get<JSTemplate[]>(`/name/${name}`, {}, { enabled: true, ttl: 300000 })
    return this.handleResponse(response)
  }

  // 更新JS模板
  async updateTemplate(id: string, data: UpdateJSTemplateForm): Promise<JSTemplate> {
    const response = await this.put<JSTemplate>(`/${id}`, data)
    this.invalidateCache()
    return this.handleResponse(response)
  }

  // 删除JS模板
  async deleteTemplate(id: string): Promise<{ message: string }> {
    const response = await this.delete<{ message: string }>(`/${id}`)
    this.invalidateCache()
    return this.handleResponse(response)
  }

  // 获取默认模板列表
  async getDefaultTemplates(params?: {
    page?: number
    limit?: number
  }): Promise<JSTemplateListResponse> {
    const response = await this.get<JSTemplateListResponse>('/default', { params }, { enabled: true, ttl: 300000 })
    return this.handleResponse(response)
  }

  // 获取自定义模板列表
  async getCustomTemplates(params?: {
    page?: number
    limit?: number
  }): Promise<JSTemplateListResponse> {
    const response = await this.get<JSTemplateListResponse>('/custom', { params }, { enabled: true, ttl: 60000 })
    return this.handleResponse(response)
  }

  // 搜索JS模板
  async searchTemplates(params: {
    keyword: string
    page?: number
    limit?: number
  }): Promise<JSTemplateListResponse> {
    const response = await this.get<JSTemplateListResponse>('/search', { params })
    return this.handleResponse(response)
  }
}

// 导出单例
export const jsTemplateService = new JSTemplateService()

// 兼容性导出
export const createTemplate = jsTemplateService.createTemplate.bind(jsTemplateService)
export const getTemplates = jsTemplateService.getTemplates.bind(jsTemplateService)
export const getTemplate = jsTemplateService.getTemplate.bind(jsTemplateService)
export const getTemplatesByName = jsTemplateService.getTemplatesByName.bind(jsTemplateService)
export const updateTemplate = jsTemplateService.updateTemplate.bind(jsTemplateService)
export const deleteTemplate = jsTemplateService.deleteTemplate.bind(jsTemplateService)
export const getDefaultTemplates = jsTemplateService.getDefaultTemplates.bind(jsTemplateService)
export const getCustomTemplates = jsTemplateService.getCustomTemplates.bind(jsTemplateService)
export const searchTemplates = jsTemplateService.searchTemplates.bind(jsTemplateService)

export default jsTemplateService
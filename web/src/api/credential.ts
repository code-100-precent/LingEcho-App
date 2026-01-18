import { BaseApiService } from './base.service'

// 提供商的灵活配置类型
export interface ProviderConfig {
  provider: string
  [key: string]: any // 支持任意其他字段
}

// 密钥创建表单
export interface CreateCredentialForm {
  name: string
  llmProvider: string
  llmApiKey: string
  llmApiUrl: string
  
  // JSON格式配置
  asrConfig?: ProviderConfig // ASR配置,例如: {provider: "qiniu", apiKey: "...", baseUrl: "..."} 或 {provider: "qcloud", appId: "...", secretId: "...", secretKey: "..."}
  ttsConfig?: ProviderConfig // TTS配置
}

// 密钥信息
export interface Credential {
  id: number
  name: string
  apiKey: string
  apiSecret: string
  llmProvider: string
  llmApiKey: string
  llmApiUrl: string
  
  // JSON格式配置
  asrConfig?: ProviderConfig
  ttsConfig?: ProviderConfig
  created_at: string
  updated_at: string
}

// 创建密钥响应
export interface CreateCredentialResponse {
  id: number
  name: string
  apiKey: string
  apiSecret: string
}

class CredentialService extends BaseApiService {
  constructor() {
    super('/credentials')
  }

  // 获取用户密钥列表
  async fetchUserCredentials(): Promise<Credential[]> {
    const response = await this.get<Credential[]>('/', {}, { enabled: true, ttl: 60000 })
    return this.handleResponse(response)
  }

  // 创建密钥
  async createCredential(data: CreateCredentialForm): Promise<CreateCredentialResponse> {
    const response = await this.post<CreateCredentialResponse>('/', data)
    // 创建后清除缓存
    this.invalidateCache()
    return this.handleResponse(response)
  }

  // 删除密钥
  async deleteCredential(id: number): Promise<null> {
    const response = await this.delete<null>(`/${id}`)
    // 删除后清除缓存
    this.invalidateCache()
    return this.handleResponse(response)
  }
}

// 导出单例
export const credentialService = new CredentialService()

// 兼容性导出
export const fetchUserCredentials = credentialService.fetchUserCredentials.bind(credentialService)
export const createCredential = credentialService.createCredential.bind(credentialService)
export const deleteCredential = credentialService.deleteCredential.bind(credentialService)

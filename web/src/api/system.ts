import { BaseApiService } from './base.service'

// 搜索配置接口
export interface SearchConfig {
  enabled: boolean
  searchPath: string
  batchSize: number
  schedule: string
}

// 系统初始化信息
export interface SystemInitInfo {
  database: {
    driver: string
    isMemoryDB: boolean
  }
  email: {
    configured: boolean
  }
  voiceClone: {
    xunfei: {
      configured: boolean
      config?: {
        app_id?: string
        api_key?: string
        base_url?: string
        ws_app_id?: string
        ws_api_key?: string
        ws_api_secret?: string
      }
    }
    volcengine: {
      configured: boolean
      config?: {
        app_id?: string
        token?: string
        cluster?: string
        voice_type?: string
        encoding?: string
        frame_duration?: string
        sample_rate?: number
        bit_depth?: number
        channels?: number
        speed_ratio?: number
        training_times?: number
      }
    }
  }
}

// 保存音色克隆配置
export interface SaveVoiceCloneConfigRequest {
  provider: 'xunfei' | 'volcengine'
  config: Record<string, any>
}

class SystemService extends BaseApiService {
  constructor() {
    super('/system')
  }

  // 获取搜索状态
  async getSearchStatus(): Promise<SearchConfig> {
    const response = await this.get<SearchConfig>('/search/status', {}, { enabled: true, ttl: 30000 })
    return this.handleResponse(response)
  }

  // 更新搜索配置
  async updateSearchConfig(config: Partial<SearchConfig>): Promise<void> {
    const response = await this.put<void>('/search/config', config)
    this.invalidateCache()
    return this.handleResponse(response)
  }

  // 启用搜索
  async enableSearch(): Promise<void> {
    const response = await this.post<void>('/search/enable')
    this.invalidateCache()
    return this.handleResponse(response)
  }

  // 禁用搜索
  async disableSearch(): Promise<void> {
    const response = await this.post<void>('/search/disable')
    this.invalidateCache()
    return this.handleResponse(response)
  }

  // 获取系统初始化信息
  async getSystemInit(): Promise<SystemInitInfo> {
    const response = await this.get<SystemInitInfo>('/init', {}, { enabled: true, ttl: 300000 })
    return this.handleResponse(response)
  }

  // 保存音色克隆配置
  async saveVoiceCloneConfig(data: SaveVoiceCloneConfigRequest): Promise<void> {
    const response = await this.post<void>('/voice-clone/config', data)
    this.invalidateCache()
    return this.handleResponse(response)
  }
}

// 导出单例
export const systemService = new SystemService()

// 兼容性导出
export const getSearchStatus = systemService.getSearchStatus.bind(systemService)
export const updateSearchConfig = systemService.updateSearchConfig.bind(systemService)
export const enableSearch = systemService.enableSearch.bind(systemService)
export const disableSearch = systemService.disableSearch.bind(systemService)
export const getSystemInit = systemService.getSystemInit.bind(systemService)
export const saveVoiceCloneConfig = systemService.saveVoiceCloneConfig.bind(systemService)


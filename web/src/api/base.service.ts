import { httpClient, ApiResponse } from '@/utils/http'
import { apiCache } from '@/utils/cache'

export interface CacheConfig {
  enabled?: boolean
  ttl?: number // Time to live in milliseconds
  key?: string // Custom cache key
}

export abstract class BaseApiService {
  protected baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl
  }

  protected async get<T = any>(url: string, config?: any, cacheConfig?: CacheConfig): Promise<ApiResponse<T>> {
    const fullUrl = `${this.baseUrl}${url}`
    
    // Check cache first if enabled
    if (cacheConfig?.enabled !== false) {
      const cacheKey = cacheConfig?.key || apiCache.generateKey(fullUrl, config?.params)
      const cached = apiCache.get<T>(cacheKey)
      if (cached) {
        return {
          code: 200,
          msg: 'success',
          data: cached
        }
      }
    }

    const response = await httpClient.get<T>(fullUrl, config)
    
    // Cache successful responses
    if (cacheConfig?.enabled !== false && response.code === 200) {
      const cacheKey = cacheConfig?.key || apiCache.generateKey(fullUrl, config?.params)
      const ttl = cacheConfig?.ttl || 5 * 60 * 1000 // 5 minutes default
      apiCache.set(cacheKey, response.data, ttl)
    }
    
    return response
  }

  protected async post<T = any>(url: string, data?: any, config?: any): Promise<ApiResponse<T>> {
    return httpClient.post<T>(`${this.baseUrl}${url}`, data, config)
  }

  protected async put<T = any>(url: string, data?: any, config?: any): Promise<ApiResponse<T>> {
    return httpClient.put<T>(`${this.baseUrl}${url}`, data, config)
  }

  protected async delete<T = any>(url: string, config?: any): Promise<ApiResponse<T>> {
    return httpClient.delete<T>(`${this.baseUrl}${url}`, config)
  }

  // 通用错误处理
  protected handleError(error: any): never {
    if (error.code && error.msg) {
      throw error
    }
    throw {
      code: -1,
      msg: error.message || '请求失败',
      data: null
    }
  }

  // 通用成功响应处理
  protected handleResponse<T>(response: ApiResponse<T>): T {
    if (response.code === 200) {
      return response.data
    }
    throw {
      code: response.code,
      msg: response.msg,
      data: response.data
    }
  }

  // 缓存失效方法
  protected invalidateCache(pattern?: RegExp | string): void {
    if (typeof pattern === 'string') {
      apiCache.delete(pattern)
    } else if (pattern instanceof RegExp) {
      const keys = Array.from((apiCache as any).cache.keys())
      keys.forEach(key => {
        if (pattern.test(key)) {
          apiCache.delete(key)
        }
      })
    } else {
      // Invalidate all cache for this service
      const servicePattern = new RegExp(`api:${this.baseUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
      const keys = Array.from((apiCache as any).cache.keys())
      keys.forEach(key => {
        if (servicePattern.test(key)) {
          apiCache.delete(key)
        }
      })
    }
  }
}
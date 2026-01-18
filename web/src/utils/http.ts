import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios'
import { useAuthStore } from '../stores/authStore'
import { getApiBaseURL } from '../config/apiConfig'

// 通用响应类型
export interface ApiResponse<T = any> {
  code: number
  msg: string
  data: T
}

// HTTP 客户端类
export class HttpClient {
  private instance: AxiosInstance
  private baseURL: string

  constructor(baseURL: string = getApiBaseURL()) {
    this.baseURL = baseURL
    this.instance = axios.create({
      baseURL,
      timeout: 100000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    this.setupInterceptors()
  }

  private setupInterceptors() {
    // 请求拦截器
    this.instance.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem('auth_token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }

        if (config.data instanceof FormData) {
          delete config.headers['Content-Type']
        }

        // 添加时间戳防止缓存
        if (config.params) {
          config.params._t = Date.now()
        } else {
          config.params = { _t: Date.now() }
        }

        return config
      },
      (error) => Promise.reject(error)
    )

    // 响应拦截器
    this.instance.interceptors.response.use(
      (response: AxiosResponse) => response,
      (error) => {
        if (error.response?.status === 401) {
          useAuthStore.getState().clearUser()
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }
    )
  }

  async get<T = any>(url: string, config?: any): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...config, method: 'GET' })
  }

  async post<T = any>(url: string, data?: any, config?: any): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...config, method: 'POST', data })
  }

  async put<T = any>(url: string, data?: any, config?: any): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...config, method: 'PUT', data })
  }

  async delete<T = any>(url: string, config?: any): Promise<ApiResponse<T>> {
    return this.request<T>(url, { ...config, method: 'DELETE' })
  }

  private async request<T = any>(url: string, config: any): Promise<ApiResponse<T>> {
    try {
      const response = await this.instance({ url, ...config })
      return response.data
    } catch (error: any) {
      if (error.response?.data) {
        const errorData = error.response.data
        if (errorData.error) {
          throw {
            code: error.response.status || 500,
            msg: errorData.error,
            data: null
          }
        } else if (errorData.code !== undefined) {
          throw errorData
        }
      }
      throw {
        code: -1,
        msg: error.message || '网络请求失败',
        data: null
      }
    }
  }
}

// 导出单例
export const httpClient = new HttpClient()

// 兼容性导出（保持向后兼容）
export const { get, post, put, delete: del } = httpClient
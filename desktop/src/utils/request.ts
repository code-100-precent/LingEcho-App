import axiosInstance from '@/utils/axios'
import { InternalAxiosRequestConfig, AxiosResponse } from 'axios'

// 通用响应类型
export interface ApiResponse<T = any> {
  code: number
  msg: string
  data: T
}

// 请求函数 - 返回完整的响应结构
const request = async <T = any>(
  url: string,
  options: Partial<InternalAxiosRequestConfig> = {}
): Promise<ApiResponse<T>> => {
  try {
    const response: AxiosResponse<ApiResponse<T>> = await axiosInstance({
      url,
      ...options,
    })
    
    // 返回完整的响应结构，让业务层处理
    return response.data
  } catch (error: any) {
    // 如果是axios错误，尝试从响应中获取错误信息
    if (error.response?.data) {
      throw error.response.data
    }
    
    // 网络错误处理
    let errorMessage = '网络请求失败'
    if (error.code === 'ERR_CONNECTION_REFUSED') {
      errorMessage = '无法连接到服务器，请检查后端服务是否已启动'
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = '请求超时，请稍后重试'
    } else if (error.message) {
      errorMessage = error.message
    }
    
    throw {
      code: -1,
      msg: errorMessage,
      data: null
    }
  }
}

// GET 请求
export const get = <T = any>(url: string, config?: Partial<InternalAxiosRequestConfig>): Promise<ApiResponse<T>> => {
  return request<T>(url, { ...config, method: 'GET' })
}

// POST 请求
export const post = <T = any>(url: string, data?: any, config?: Partial<InternalAxiosRequestConfig>): Promise<ApiResponse<T>> => {
  return request<T>(url, {
    ...config,
    method: 'POST',
    data,
  })
}

// PUT 请求
export const put = <T = any>(url: string, data?: any, config?: Partial<InternalAxiosRequestConfig>): Promise<ApiResponse<T>> => {
  return request<T>(url, {
    ...config,
    method: 'PUT',
    data,
  })
}

// DELETE 请求
export const del = <T = any>(url: string, config?: Partial<InternalAxiosRequestConfig>): Promise<ApiResponse<T>> => {
  console.log('del function called with url:', url, 'config:', config)
  return request<T>(url, { ...config, method: 'DELETE' })
}

// PATCH 请求
export const patch = <T = any>(url: string, data?: any, config?: Partial<InternalAxiosRequestConfig>): Promise<ApiResponse<T>> => {
  return request<T>(url, {
    ...config,
    method: 'PATCH',
    data,
  })
}

// 导出 request 对象和类型
export { request }
export default request

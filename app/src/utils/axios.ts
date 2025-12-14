/**
 * Axios实例配置 - React Native版本
 */
import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseURL } from '../config/apiConfig';
import { authEvents } from './authEvents';

// 创建axios实例
const axiosInstance: AxiosInstance = axios.create({
  baseURL: getApiBaseURL(),
  timeout: 100000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器
axiosInstance.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    // 添加认证token
    try {
      const token = await AsyncStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error getting token from storage:', error);
    }
    
    // 如果是FormData，让系统自动设置Content-Type（包含boundary）
    if (config.data instanceof FormData) {
      // React Native 中需要删除 Content-Type，让系统自动添加 boundary
      delete config.headers['Content-Type'];
      // 确保 Accept 头不会干扰
      config.headers['Accept'] = 'application/json, text/plain, */*';
    }
    
    // 添加请求时间戳
    if (config.params) {
      config.params._t = Date.now();
    } else {
      config.params = { _t: Date.now() };
    }
    
    // 添加调试信息
    console.log('Making request to:', config.baseURL + config.url, {
      method: config.method,
      headers: config.headers,
      params: config.params,
    });
    
    return config;
  },
  (error) => {
    console.error('Request interceptor error:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
axiosInstance.interceptors.response.use(
  (response: AxiosResponse) => {
    // 直接返回完整响应，让业务层处理
    return response;
  },
  async (error) => {
    console.error('Response interceptor error:', error);
    // 处理网络错误和HTTP状态码错误
    if (error.response) {
      // 服务器返回了错误状态码
      const status = error.response.status;
      console.log('Response status:', status);

      switch (status) {
        case 401:
          // 检查是否是 logout 请求，如果是 logout 返回 401，说明 token 已经失效，不需要触发 unauthorized 事件
          // 因为用户已经在主动退出登录了
          const isLogoutRequest = error.config?.url?.includes('/auth/logout');
          
          if (isLogoutRequest) {
            console.log('Unauthorized - logout 请求返回 401，token 已失效，仅清除本地存储');
            // 只清除本地存储，不触发 unauthorized 事件（避免循环）
            try {
              await AsyncStorage.removeItem('auth_token');
              await AsyncStorage.removeItem('user_info');
            } catch (storageError) {
              console.error('Error clearing storage:', storageError);
            }
          } else {
            console.log('Unauthorized - 检测到 401 错误，清除认证信息并跳转到登录页');
            // 清除token和用户信息
            try {
              await AsyncStorage.removeItem('auth_token');
              await AsyncStorage.removeItem('user_info');
              // 触发未授权事件，通知 AuthContext 清除用户状态
              authEvents.emitUnauthorized();
            } catch (storageError) {
              console.error('Error clearing storage:', storageError);
            }
          }
          break;
        case 403:
          console.error('Forbidden: Access denied');
          break;
        case 404:
          console.error('Not Found: API endpoint not found');
          break;
        case 500:
          console.error('Internal Server Error');
          break;
        default:
          console.error(`HTTP Error ${status}:`, error.response.data);
      }
    } else if (error.request) {
      // 网络错误 - 连接被拒绝或超时
      console.error('Network Error:', error.message);
    } else {
      // 其他错误
      console.error('Error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

export default axiosInstance;


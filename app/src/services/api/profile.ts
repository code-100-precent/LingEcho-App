/**
 * 用户资料API服务
 */
import { get, put, post, ApiResponse } from '../../utils/request';

// 用户资料更新表单
export interface UpdateProfileForm {
  email?: string;
  phone?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  locale?: string;
  timezone?: string;
  gender?: string;
  extra?: string;
  avatar?: string;
}

// 用户偏好设置表单
export interface UpdatePreferencesForm {
  emailNotifications?: boolean;
  pushNotifications?: boolean;
  systemNotifications?: boolean;
  autoCleanUnreadEmails?: boolean;
}

// 密码修改表单
export interface ChangePasswordForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// 头像上传响应
export interface AvatarUploadResponse {
  avatar: string;
  url: string;
}

// 两步验证相关接口
export interface TwoFactorSetupResponse {
  secret: string;
  qrCode: string;
  url: string;
}

export interface TwoFactorCodeRequest {
  code: string;
}

// 活动记录相关接口
export interface ActivityLog {
  id: number;
  action: string;
  target: string;
  details: string;
  ipAddress: string;
  userAgent: string;
  device: string;
  browser: string;
  os: string;
  location: string;
  createdAt: string;
}

export interface ActivityLogResponse {
  activities: ActivityLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// 获取用户资料
export const getProfile = async (): Promise<ApiResponse<any>> => {
  return get('/auth/info');
};

// 更新用户资料
export const updateProfile = async (data: UpdateProfileForm): Promise<ApiResponse<null>> => {
  return put('/auth/update', data);
};

// 更新用户偏好设置
export const updatePreferences = async (data: UpdatePreferencesForm): Promise<ApiResponse<null>> => {
  return put('/auth/update/preferences', data);
};

// 修改密码
export const changePassword = async (data: ChangePasswordForm): Promise<ApiResponse<null>> => {
  return post('/auth/change-password', data);
};

// 上传头像
export const uploadAvatar = async (file: any): Promise<ApiResponse<AvatarUploadResponse>> => {
  // 直接使用 fetch，因为 React Native 中 fetch 对 FormData 的支持更好
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  const { getApiBaseURL } = require('../../config/apiConfig');
  
  const formData = new FormData();
  // React Native 中 FormData 需要特殊格式
  // uri 必须是本地文件路径（file:// 或 content://）
  formData.append('avatar', {
    uri: file.uri,
    type: file.type || 'image/jpeg',
    name: file.name || 'avatar.jpg',
  } as any);
  
  try {
    const token = await AsyncStorage.getItem('auth_token');
    const baseURL = getApiBaseURL();
    
    console.log('Uploading avatar:', {
      uri: file.uri,
      type: file.type,
      name: file.name,
      baseURL: `${baseURL}/auth/avatar/upload`,
    });
    
    const response = await fetch(`${baseURL}/auth/avatar/upload`, {
      method: 'POST',
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
        'Accept': 'application/json',
        // 不设置 Content-Type，让系统自动添加 boundary
      },
      body: formData,
    });
    
    if (!response.ok) {
      // 如果是 401，需要清除认证信息并触发跳转
      if (response.status === 401) {
        const { authEvents } = require('../../utils/authEvents');
        try {
          await AsyncStorage.removeItem('auth_token');
          await AsyncStorage.removeItem('user_info');
          authEvents.emitUnauthorized();
        } catch (storageError) {
          console.error('Error clearing storage:', storageError);
        }
      }
      
      let errorData;
      try {
        errorData = await response.json();
      } catch {
        errorData = { msg: `HTTP ${response.status}: ${response.statusText}` };
      }
      throw {
        code: response.status,
        msg: errorData.msg || errorData.message || '上传失败',
        data: null,
      };
    }
    
    const data = await response.json();
    return data;
  } catch (error: any) {
    console.error('Upload avatar error:', error);
    // 如果已经是 ApiResponse 格式，直接返回
    if (error.code !== undefined) {
      throw error;
    }
    // 否则包装成 ApiResponse 格式
    throw {
      code: -1,
      msg: error.msg || error.message || '网络请求失败',
      data: null,
    };
  }
};

// 设置两步验证（生成密钥和QR码）
export const setupTwoFactor = async (): Promise<ApiResponse<TwoFactorSetupResponse>> => {
  return post('/auth/two-factor/setup', {});
};

// 启用两步验证
export const enableTwoFactor = async (code: string): Promise<ApiResponse<null>> => {
  return post('/auth/two-factor/enable', { code });
};

// 禁用两步验证
export const disableTwoFactor = async (code: string): Promise<ApiResponse<null>> => {
  return post('/auth/two-factor/disable', { code });
};

// 获取两步验证状态
export interface TwoFactorStatusResponse {
  enabled: boolean;
  hasSecret: boolean;
}

export const getTwoFactorStatus = async (): Promise<ApiResponse<TwoFactorStatusResponse>> => {
  return get('/auth/two-factor/status');
};

// 获取用户活动记录
export const getUserActivity = async (params?: {
  page?: number;
  limit?: number;
  action?: string;
}): Promise<ApiResponse<ActivityLogResponse>> => {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.limit) queryParams.append('limit', params.limit.toString());
  if (params?.action) queryParams.append('action', params.action);
  
  const queryString = queryParams.toString();
  const url = queryString ? `/auth/activity?${queryString}` : '/auth/activity';
  return get(url);
};


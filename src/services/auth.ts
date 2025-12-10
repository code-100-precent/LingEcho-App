/**
 * 认证服务 - 使用 Mock 数据
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mockAuthService, User } from './mockData';

// 导出 User 类型供其他模块使用
export type { User };

export interface LoginForm {
  email: string;
  password: string;
  twoFactorCode?: string;
}

export interface RegisterForm {
  email: string;
  password: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export const authService = {
  // 登录
  async login(form: LoginForm) {
    const response = await mockAuthService.login(form.email, form.password);
    if (response.code === 0 && response.data) {
      await AsyncStorage.setItem('auth_token', response.data.token);
      await AsyncStorage.setItem('user_info', JSON.stringify(response.data.user));
    }
    return response;
  },

  // 注册
  async register(form: RegisterForm) {
    const response = await mockAuthService.register(form.email, form.password, form.displayName);
    if (response.code === 0 && response.data) {
      await AsyncStorage.setItem('auth_token', response.data.token);
      await AsyncStorage.setItem('user_info', JSON.stringify(response.data.user));
    }
    return response;
  },

  // 登出
  async logout() {
    await AsyncStorage.removeItem('auth_token');
    await AsyncStorage.removeItem('user_info');
  },

  // 获取当前用户信息
  async getCurrentUser(): Promise<User | null> {
    try {
      const userStr = await AsyncStorage.getItem('user_info');
      if (userStr) {
        return JSON.parse(userStr);
      }
      const user = await mockAuthService.getCurrentUser();
      if (user) {
        await AsyncStorage.setItem('user_info', JSON.stringify(user));
        return user;
      }
    } catch (error) {
      console.error('Error getting current user:', error);
    }
    return null;
  },

  // 检查是否已登录
  async isAuthenticated(): Promise<boolean> {
    const token = await AsyncStorage.getItem('auth_token');
    return !!token;
  },

  // 获取token
  async getToken(): Promise<string | null> {
    return await AsyncStorage.getItem('auth_token');
  },
};


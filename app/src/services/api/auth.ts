/**
 * 认证API服务
 */
import { post, get, ApiResponse } from '../../utils/request';

// 用户注册表单类型
export interface RegisterUserForm {
  email: string;
  password: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  locale?: string;
  timezone?: string;
  source?: string;
}

// 邮箱验证码注册表单类型
export interface EmailRegisterForm {
  email: string;
  password: string;
  userName: string;
  displayName: string;
  code: string;
  firstName?: string;
  lastName?: string;
  locale?: string;
  timezone?: string;
  source?: string;
}

// 发送邮箱验证码请求类型
export interface SendEmailCodeRequest {
  email: string;
  clientIp?: string;
  userAgent?: string;
}

// 用户登录表单类型
export interface LoginForm {
  email: string;
  password: string;
  twoFactorCode?: string;
  timezone?: string;
  remember?: boolean;
  authToken?: boolean;
}

// 邮箱验证码登录表单类型
export interface EmailCodeLoginForm {
  email: string;
  code: string;
  timezone?: string;
  remember?: boolean;
  authToken?: boolean;
}

// 登录响应数据类型
export interface LoginResponseData {
  createdAt: string;
  updatedAt: string;
  displayName: string;
  email: string;
  emailNotifications: boolean;
  firstName: string;
  hasFilledDetails: boolean;
  lastLogin: string;
  lastName: string;
  timezone: string;
  token: string;
  requiresTwoFactor: boolean;
}

// 用户信息类型
export interface User {
  id?: string;
  email: string;
  displayName: string;
  firstName: string;
  lastName: string;
  phone?: string;
  gender?: string;
  extra?: string;
  locale?: string;
  timezone: string;
  avatar?: string;
  role?: 'user' | 'admin';
  createdAt: string;
  updatedAt: string;
  lastLogin: string;
  hasFilledDetails: boolean;
  emailNotifications: boolean;
  pushNotifications?: boolean;
  systemNotifications?: boolean;
  autoCleanUnreadEmails?: boolean;
  twoFactorEnabled?: boolean;
}

// 用户注册
export const registerUser = async (data: RegisterUserForm): Promise<ApiResponse<any>> => {
  return post('/auth/register', data);
};

// 邮箱验证码注册
export const registerUserByEmail = async (data: EmailRegisterForm): Promise<ApiResponse<any>> => {
  return post('/auth/register/email', data);
};

// 发送邮箱验证码
export const sendEmailCode = async (data: SendEmailCodeRequest): Promise<ApiResponse<null>> => {
  return post<null>('/auth/send/email', data);
};

// 用户登录（密码登录）
export const loginUser = async (data: LoginForm): Promise<ApiResponse<LoginResponseData>> => {
  return post('/auth/login/password', data);
};

// 邮箱验证码登录
export const loginWithEmailCode = async (data: EmailCodeLoginForm): Promise<ApiResponse<LoginResponseData>> => {
  return post<LoginResponseData>('/auth/login/email', data);
};

// 获取用户信息
export const getUserInfo = async (): Promise<ApiResponse<User>> => {
  return get<User>('/auth/info');
};

// 刷新token
export const refreshToken = async (): Promise<ApiResponse<{ token: string }>> => {
  return post<{ token: string }>('/auth/refresh');
};

// 登出
export const logoutUser = async (next?: string): Promise<ApiResponse<null>> => {
  const params = next ? { next } : undefined;
  return get<null>('/auth/logout', { params });
};


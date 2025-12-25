import { post, get, ApiResponse } from '@/utils/request'

// 用户注册表单类型
export interface RegisterUserForm {
  email: string
  password: string
  displayName?: string
  firstName?: string
  lastName?: string
  locale?: string
  timezone?: string
  source?: string
  captchaId?: string
  captchaCode?: string
}

// 邮箱验证码注册表单类型
export interface EmailRegisterForm {
  email: string
  password: string
  userName: string
  displayName: string
  code: string
  firstName?: string
  lastName?: string
  locale?: string
  timezone?: string
  source?: string
  captchaId?: string
  captchaCode?: string
}

// 验证码响应类型
export interface CaptchaResponse {
  id: string
  image: string
}

// 发送邮箱验证码请求类型
export interface SendEmailCodeRequest {
  email: string
  clientIp?: string
  userAgent?: string
}

// 用户登录表单类型
export interface LoginForm {
  email: string
  password: string
  twoFactorCode?: string
}

// 密码登录表单类型
export interface PasswordLoginForm {
  email: string
  password: string
  timezone?: string
  remember?: boolean
  authToken?: boolean
  twoFactorCode?: string
  captchaId?: string
  captchaCode?: string
}

// 邮箱验证码登录表单类型
export interface EmailCodeLoginForm {
  email: string
  code: string
  timezone?: string
  remember?: boolean
  authToken?: boolean
  captchaId?: string
  captchaCode?: string
}

// 登录响应数据类型
export interface LoginResponseData {
  token?: string
  user?: {
    id?: number | string
    createdAt?: string
    updatedAt?: string
    displayName?: string
    DisplayName?: string
    email?: string
    emailNotifications?: boolean
    firstName?: string
    hasFilledDetails?: boolean
    lastLogin?: string
    lastName?: string
    timezone?: string
    token?: string
    authToken?: string
    AuthToken?: string
    requiresTwoFactor?: boolean
    [key: string]: any
  }
  createdAt?: string
  updatedAt?: string
  displayName?: string
  DisplayName?: string
  email?: string
  emailNotifications?: boolean
  firstName?: string
  hasFilledDetails?: boolean
  lastLogin?: string
  lastName?: string
  timezone?: string
  requiresTwoFactor?: boolean
  message?: string
  suspiciousLogin?: boolean
  [key: string]: any
}

// 注册响应数据类型
export interface RegisterResponseData {
  createdAt?: string
  updatedAt?: string
  email: string
  emailNotifications?: boolean
  firstName?: string
  lastName?: string
  displayName?: string
  timezone?: string
  hasFilledDetails?: boolean
  activation?: boolean
  expired?: string
}

// 用户信息类型
export interface User {
  id?: string | number
  ID?: number
  email: string
  displayName?: string
  firstName?: string
  lastName?: string
  phone?: string
  gender?: string
  extra?: string
  locale?: string
  timezone: string
  avatar?: string
  role?: 'user' | 'admin'
  createdAt: string
  updatedAt: string
  lastLogin: string
  hasFilledDetails: boolean
  emailNotifications: boolean
  pushNotifications?: boolean
  systemNotifications?: boolean
  autoCleanUnreadEmails?: boolean
  twoFactorEnabled?: boolean
}

// 用户注册
export const registerUser = async (data: RegisterUserForm): Promise<ApiResponse<RegisterResponseData>> => {
  return post<RegisterResponseData>('/auth/register', data)
}

// 邮箱验证码注册
export const registerUserByEmail = async (data: EmailRegisterForm): Promise<ApiResponse<RegisterResponseData>> => {
  return post<RegisterResponseData>('/auth/register/email', data)
}

// 发送邮箱验证码
export const sendEmailCode = async (data: SendEmailCodeRequest): Promise<ApiResponse<null>> => {
  return post<null>('/auth/send/email', data)
}

// 用户登录
export const loginUser = async (data: LoginForm): Promise<ApiResponse<LoginResponseData>> => {
  return post<LoginResponseData>('/auth/login/password', data)
}

// 密码登录
export const loginWithPassword = async (data: PasswordLoginForm): Promise<ApiResponse<LoginResponseData>> => {
  return post<LoginResponseData>('/auth/login/password', data)
}

// 邮箱验证码登录
export const loginWithEmailCode = async (data: EmailCodeLoginForm): Promise<ApiResponse<LoginResponseData>> => {
  return post<LoginResponseData>('/auth/login/email', data)
}

// 获取用户信息
export const getUserInfo = async (): Promise<ApiResponse<User>> => {
  return get<User>('/auth/info')
}

// 刷新token
export const refreshToken = async (): Promise<ApiResponse<{ token: string }>> => {
  return post<{ token: string }>('/auth/refresh')
}

// 登出 - 对应 GET /auth/logout
export const logoutUser = async (next?: string): Promise<ApiResponse<null>> => {
  const params = next ? { next } : undefined
  return get<null>('/auth/logout', { params })
}

// 获取图形验证码
export const getCaptcha = async (): Promise<ApiResponse<CaptchaResponse>> => {
  return get<CaptchaResponse>('/auth/captcha')
}

// 验证图形验证码
export const verifyCaptcha = async (id: string, code: string): Promise<ApiResponse<{ valid: boolean }>> => {
  return post<{ valid: boolean }>('/auth/captcha/verify', { id, code })
}

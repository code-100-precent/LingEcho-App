import { BaseApiService } from './base.service'
import { ApiResponse } from '@/utils/http'

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
  // 智能风控字段
  mouseTrack?: string       // 鼠标轨迹数据（JSON字符串）
  formFillTime?: number     // 表单填写时间（毫秒）
  keystrokePattern?: string // 按键模式数据（JSON字符串）
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
  // 智能风控字段
  mouseTrack?: string       // 鼠标轨迹数据（JSON字符串）
  formFillTime?: number     // 表单填写时间（毫秒）
  keystrokePattern?: string // 按键模式数据（JSON字符串）
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
  requiresDeviceVerification?: boolean
  deviceId?: string
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
  city?: string
  region?: string
  extra?: string
  locale?: string
  timezone: string
  avatar?: string
  role?: 'user' | 'admin'
  createdAt: string
  updatedAt: string
  lastLogin: string
  loginCount?: number
  lastPasswordChange?: string
  profileComplete?: number
  hasFilledDetails: boolean
  emailNotifications: boolean
  pushNotifications?: boolean
  systemNotifications?: boolean
  autoCleanUnreadEmails?: boolean
  twoFactorEnabled?: boolean
  emailVerified?: boolean
}

// Auth Service 类
export class AuthService extends BaseApiService {
  constructor() {
    super('/auth')
  }

  // 用户注册
  async register(data: RegisterUserForm): Promise<ApiResponse<RegisterResponseData>> {
    return this.post<RegisterResponseData>('/register', data)
  }

  // 邮箱验证码注册
  async registerByEmail(data: EmailRegisterForm): Promise<ApiResponse<RegisterResponseData>> {
    return this.post<RegisterResponseData>('/register/email', data)
  }

  // 发送邮箱验证码
  async sendEmailCode(data: SendEmailCodeRequest): Promise<ApiResponse<null>> {
    return this.post<null>('/send/email', data)
  }

  // 用户登录
  async login(data: LoginForm): Promise<ApiResponse<LoginResponseData>> {
    return this.post<LoginResponseData>('/login/password', data)
  }

  // 密码登录
  async loginWithPassword(data: PasswordLoginForm): Promise<ApiResponse<LoginResponseData>> {
    return this.post<LoginResponseData>('/login/password', data)
  }

  // 邮箱验证码登录
  async loginWithEmailCode(data: EmailCodeLoginForm): Promise<ApiResponse<LoginResponseData>> {
    return this.post<LoginResponseData>('/login/email', data)
  }

  // 发送设备验证码
  async sendDeviceVerificationCode(data: { email: string; deviceId: string }): Promise<ApiResponse<null>> {
    return this.post('/devices/send-verification', data)
  }

  // 验证设备
  async verifyDevice(data: { email: string; deviceId: string; verifyCode: string }): Promise<ApiResponse<null>> {
    return this.post('/devices/verify', data)
  }

  // 获取用户信息
  async getUserInfo(): Promise<ApiResponse<User>> {
    return this.get<User>('/info')
  }

  // 刷新token
  async refreshToken(): Promise<ApiResponse<{ token: string }>> {
    return this.post<{ token: string }>('/refresh')
  }

  // 发送邮箱验证邮件
  async sendEmailVerification(): Promise<ApiResponse<null>> {
    return this.post<null>('/send-email-verification')
  }

  // 验证邮箱（通过URL中的token）
  async verifyEmail(token: string): Promise<ApiResponse<User>> {
    return this.get<User>(`/verify-email?token=${token}`)
  }

  // 登出
  async logout(next?: string): Promise<ApiResponse<null>> {
    const params = next ? { next } : undefined
    return this.get<null>('/logout', { params })
  }

  // 获取图形验证码
  async getCaptcha(): Promise<ApiResponse<CaptchaResponse>> {
    return this.get<CaptchaResponse>('/captcha')
  }

  // 验证图形验证码
  async verifyCaptcha(id: string, code: string): Promise<ApiResponse<{ valid: boolean }>> {
    return this.post<{ valid: boolean }>('/captcha/verify', { id, code })
  }
}

// 导出单例
export const authService = new AuthService()

// 兼容性导出（保持向后兼容）
export const registerUser = (data: RegisterUserForm) => authService.register(data)
export const registerUserByEmail = (data: EmailRegisterForm) => authService.registerByEmail(data)
export const sendEmailCode = (data: SendEmailCodeRequest) => authService.sendEmailCode(data)
export const loginUser = (data: LoginForm) => authService.login(data)
export const loginWithPassword = (data: PasswordLoginForm) => authService.loginWithPassword(data)
export const loginWithEmailCode = (data: EmailCodeLoginForm) => authService.loginWithEmailCode(data)
export const sendDeviceVerificationCode = (data: { email: string; deviceId: string }) => authService.sendDeviceVerificationCode(data)
export const verifyDevice = (data: { email: string; deviceId: string; verifyCode: string }) => authService.verifyDevice(data)
export const getUserInfo = () => authService.getUserInfo()
export const refreshToken = () => authService.refreshToken()
export const sendEmailVerification = () => authService.sendEmailVerification()
export const verifyEmail = (token: string) => authService.verifyEmail(token)
export const logoutUser = (next?: string) => authService.logout(next)
export const getCaptcha = () => authService.getCaptcha()
export const verifyCaptcha = (id: string, code: string) => authService.verifyCaptcha(id, code)

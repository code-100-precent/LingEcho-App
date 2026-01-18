import { BaseApiService } from './base.service'
import { ApiResponse } from '@/utils/http'

// 用户资料更新表单 - 对应后端 UpdateUserRequest
export interface UpdateProfileForm {
  email?: string
  phone?: string
  displayName?: string
  firstName?: string
  lastName?: string
  locale?: string
  timezone?: string
  gender?: string
  city?: string
  region?: string
  extra?: string
  avatar?: string
}

// 用户基本信息更新表单 - 对应后端 UserBasicInfoUpdate
export interface UpdateBasicInfoForm {
  fatherCallName?: string
  motherCallName?: string
  wifiName?: string
  wifiPassword?: string
}

// 用户偏好设置表单
export interface UpdatePreferencesForm {
  emailNotifications?: boolean
  pushNotifications?: boolean
  systemNotifications?: boolean
  autoCleanUnreadEmails?: boolean
}

// 密码修改表单
export interface ChangePasswordForm {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

// 通过邮箱验证码修改密码
export interface ChangePasswordByEmailForm {
  emailCode: string
  newPassword: string
  confirmPassword: string
}

// 头像上传响应
export interface AvatarUploadResponse {
  avatar: string
  url: string
}

// 两步验证相关接口
export interface TwoFactorSetupResponse {
  secret: string
  qrCode: string
  url: string
}

export interface TwoFactorStatusResponse {
  enabled: boolean
  hasSecret: boolean
}

export interface TwoFactorCodeRequest {
  code: string
}

// 活动记录相关接口
export interface ActivityLog {
  id: number
  action: string
  target: string
  details: string
  ipAddress: string
  userAgent: string
  device: string
  browser: string
  os: string
  location: string
  createdAt: string
}

export interface ActivityLogResponse {
  activities: ActivityLog[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// 设备管理相关接口
export interface UserDevice {
  id: number
  userId: number
  deviceId: string
  deviceName: string
  deviceType: string
  os: string
  browser: string
  userAgent: string
  ipAddress: string
  location: string
  isTrusted: boolean
  isActive: boolean
  lastUsedAt: string
  createdAt: string
  updatedAt: string
}

export interface UserDevicesResponse {
  devices: UserDevice[]
}

// Profile Service 类
export class ProfileService extends BaseApiService {
  constructor() {
    super('/auth')
  }

  // 获取用户资料
  async getProfile(): Promise<any> {
    const response = await this.get<any>('/info')
    return this.handleResponse(response)
  }

  // 更新用户资料
  async updateProfile(data: UpdateProfileForm): Promise<null> {
    const response = await this.put<null>('/update', data)
    return this.handleResponse(response)
  }

  // 更新用户基本信息
  async updateBasicInfo(data: UpdateBasicInfoForm): Promise<null> {
    const response = await this.post<null>('/update/basic/info', data)
    return this.handleResponse(response)
  }

  // 更新用户偏好设置
  async updatePreferences(data: UpdatePreferencesForm): Promise<null> {
    const response = await this.put<null>('/update/preferences', data)
    return this.handleResponse(response)
  }

  // 修改密码
  async changePassword(data: ChangePasswordForm): Promise<null> {
    const response = await this.post<null>('/change-password', data)
    return this.handleResponse(response)
  }

  // 通过邮箱验证码修改密码
  async changePasswordByEmail(data: ChangePasswordByEmailForm): Promise<null> {
    const response = await this.post<null>('/change-password/email', data)
    return this.handleResponse(response)
  }

  // 上传头像
  async uploadAvatar(file: File): Promise<AvatarUploadResponse> {
    const formData = new FormData()
    formData.append('avatar', file)
    const response = await this.post<AvatarUploadResponse>('/avatar/upload', formData)
    return this.handleResponse(response)
  }

  // 设置两步验证（生成密钥和QR码）
  async setupTwoFactor(): Promise<TwoFactorSetupResponse> {
    const response = await this.post<TwoFactorSetupResponse>('/two-factor/setup', {})
    return this.handleResponse(response)
  }

  // 启用两步验证
  async enableTwoFactor(code: string): Promise<null> {
    const response = await this.post<null>('/two-factor/enable', { code })
    return this.handleResponse(response)
  }

  // 禁用两步验证
  async disableTwoFactor(code: string): Promise<null> {
    const response = await this.post<null>('/two-factor/disable', { code })
    return this.handleResponse(response)
  }

  // 获取两步验证状态
  async getTwoFactorStatus(): Promise<TwoFactorStatusResponse> {
    const response = await this.get<TwoFactorStatusResponse>('/two-factor/status')
    return this.handleResponse(response)
  }

  // 获取用户活动记录
  async getUserActivity(params?: {
    page?: number
    limit?: number
    action?: string
  }): Promise<ActivityLogResponse> {
    const queryParams = new URLSearchParams()
    if (params?.page) queryParams.append('page', params.page.toString())
    if (params?.limit) queryParams.append('limit', params.limit.toString())
    if (params?.action) queryParams.append('action', params.action)
    
    const queryString = queryParams.toString()
    const url = queryString ? `/activity?${queryString}` : '/activity'
    const response = await this.get<ActivityLogResponse>(url)
    return this.handleResponse(response)
  }

  // 获取用户设备列表
  async getUserDevices(): Promise<UserDevicesResponse> {
    const response = await this.get<UserDevicesResponse>('/devices')
    return this.handleResponse(response)
  }

  // 删除用户设备
  async deleteUserDevice(deviceId: string): Promise<null> {
    const response = await this.delete<null>(`/devices/${deviceId}`)
    return this.handleResponse(response)
  }

  // 信任用户设备
  async trustUserDevice(deviceId: string): Promise<null> {
    const response = await this.post<null>('/devices/trust', { deviceId })
    return this.handleResponse(response)
  }

  // 取消信任用户设备
  async untrustUserDevice(deviceId: string): Promise<null> {
    const response = await this.post<null>('/devices/untrust', { deviceId })
    return this.handleResponse(response)
  }
}

// 导出服务实例
export const profileService = new ProfileService()

// 兼容性导出（保持向后兼容）
export const getProfile = () => profileService.getProfile()
export const updateProfile = (data: UpdateProfileForm) => profileService.updateProfile(data)
export const updateBasicInfo = (data: UpdateBasicInfoForm) => profileService.updateBasicInfo(data)
export const updatePreferences = (data: UpdatePreferencesForm) => profileService.updatePreferences(data)
export const changePassword = (data: ChangePasswordForm) => profileService.changePassword(data)
export const changePasswordByEmail = (data: ChangePasswordByEmailForm) => profileService.changePasswordByEmail(data)
export const uploadAvatar = (file: File) => profileService.uploadAvatar(file)
export const setupTwoFactor = () => profileService.setupTwoFactor()
export const enableTwoFactor = (code: string) => profileService.enableTwoFactor(code)
export const disableTwoFactor = (code: string) => profileService.disableTwoFactor(code)
export const getTwoFactorStatus = () => profileService.getTwoFactorStatus()
export const getUserActivity = (params?: { page?: number; limit?: number; action?: string }) => profileService.getUserActivity(params)
export const getUserDevices = () => profileService.getUserDevices()
export const deleteUserDevice = (deviceId: string) => profileService.deleteUserDevice(deviceId)
export const trustUserDevice = (deviceId: string) => profileService.trustUserDevice(deviceId)
export const untrustUserDevice = (deviceId: string) => profileService.untrustUserDevice(deviceId)

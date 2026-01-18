import { BaseApiService } from './base.service'

// 设备信息
export interface Device {
  id: string
  userId: number
  macAddress: string
  board?: string
  appVersion?: string
  autoUpdate: number
  assistantId?: number
  alias?: string
  lastConnected?: string
  createdAt: string
  updatedAt: string
}

// 绑定设备请求
export interface BindDeviceRequest {
  agentId: string
  deviceCode: string
}

// 解绑设备请求
export interface UnbindDeviceRequest {
  deviceId: string
}

// 更新设备信息请求
export interface UpdateDeviceRequest {
  alias?: string
  autoUpdate?: number
}

// 手动添加设备请求
export interface ManualAddDeviceRequest {
  agentId: string
  board: string
  appVersion?: string
  macAddress: string
}

class DeviceService extends BaseApiService {
  constructor() {
    super('/device')
  }

  // 绑定设备（激活设备）
  async bindDevice(agentId: string, deviceCode: string): Promise<null> {
    const response = await this.post<null>(`/bind/${agentId}/${deviceCode}`, {})
    this.invalidateCache()
    return this.handleResponse(response)
  }

  // 获取已绑定设备列表
  async getUserDevices(agentId: string): Promise<Device[]> {
    const response = await this.get<Device[]>(`/bind/${agentId}`, {}, { enabled: true, ttl: 60000 })
    return this.handleResponse(response)
  }

  // 解绑设备
  async unbindDevice(data: UnbindDeviceRequest): Promise<null> {
    const response = await this.post<null>('/unbind', data)
    this.invalidateCache()
    return this.handleResponse(response)
  }

  // 更新设备信息
  async updateDevice(deviceId: string, data: UpdateDeviceRequest): Promise<Device> {
    const response = await this.put<Device>(`/update/${deviceId}`, data)
    this.invalidateCache()
    return this.handleResponse(response)
  }

  // 手动添加设备
  async manualAddDevice(data: ManualAddDeviceRequest): Promise<Device> {
    const response = await this.post<Device>('/manual-add', data)
    this.invalidateCache()
    return this.handleResponse(response)
  }
}

// 导出单例
export const deviceService = new DeviceService()

// 兼容性导出
export const bindDevice = deviceService.bindDevice.bind(deviceService)
export const getUserDevices = deviceService.getUserDevices.bind(deviceService)
export const unbindDevice = deviceService.unbindDevice.bind(deviceService)
export const updateDevice = deviceService.updateDevice.bind(deviceService)
export const manualAddDevice = deviceService.manualAddDevice.bind(deviceService)


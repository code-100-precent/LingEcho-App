import { BaseApiService } from './base.service'

// 通知类型 - 匹配后端返回的数据结构
export interface Notification {
  id: number
  user_id: number
  title: string
  content: string
  type?: 'info' | 'success' | 'warning' | 'error'
  read: boolean
  created_at: string
  updated_at?: string
  data?: any // 额外数据
}

// 未读数量响应 - 后端直接返回数字
export type UnreadCountResponse = number

// 通知列表响应
export interface NotificationListResponse {
  list: Notification[]
  total: number
  totalUnread: number // 新增
  totalRead: number // 新增
  page: number
  size: number
}

// 批量删除响应
export interface BatchDeleteResponse {
  deletedCount: number
  totalRequested: number
}

class NotificationService extends BaseApiService {
  constructor() {
    super('/notification')
  }

  // 获取未读通知数量
  async getUnreadNotificationCount(): Promise<UnreadCountResponse> {
    const response = await this.get<UnreadCountResponse>('/unread-count', {}, { enabled: true, ttl: 30000 })
    return this.handleResponse(response)
  }

  // 获取通知列表
  async getNotifications(params?: {
    page?: number
    size?: number
    filter?: 'all' | 'read' | 'unread'
    title?: string
    content?: string
    start_time?: string
    end_time?: string
  }): Promise<NotificationListResponse> {
    const response = await this.get<NotificationListResponse>('', { params })
    return this.handleResponse(response)
  }

  // 标记所有通知为已读
  async markAllNotificationsAsRead(): Promise<null> {
    const response = await this.post<null>('/readAll')
    return this.handleResponse(response)
  }

  // 标记单个通知为已读
  async markNotificationAsRead(id: string | number): Promise<null> {
    const response = await this.put<null>(`/read/${id}`)
    return this.handleResponse(response)
  }

  // 删除通知
  async deleteNotification(id: string | number): Promise<null> {
    const response = await this.delete<null>(`/${id}`)
    return this.handleResponse(response)
  }

  // 批量删除通知
  async batchDeleteNotifications(ids: number[]): Promise<BatchDeleteResponse> {
    const response = await this.post<BatchDeleteResponse>('/batch-delete', { ids })
    return this.handleResponse(response)
  }

  // 获取所有通知ID（用于全选功能）
  async getAllNotificationIds(params?: {
    filter?: 'all' | 'read' | 'unread'
    title?: string
    content?: string
    start_time?: string
    end_time?: string
  }): Promise<{ ids: number[] }> {
    const response = await this.get<{ ids: number[] }>('/all-ids', { params })
    return this.handleResponse(response)
  }
}

// 导出单例
export const notificationService = new NotificationService()

// 兼容性导出
export const getUnreadNotificationCount = notificationService.getUnreadNotificationCount.bind(notificationService)
export const getNotifications = notificationService.getNotifications.bind(notificationService)
export const markAllNotificationsAsRead = notificationService.markAllNotificationsAsRead.bind(notificationService)
export const markNotificationAsRead = notificationService.markNotificationAsRead.bind(notificationService)
export const deleteNotification = notificationService.deleteNotification.bind(notificationService)
export const batchDeleteNotifications = notificationService.batchDeleteNotifications.bind(notificationService)
export const getAllNotificationIds = notificationService.getAllNotificationIds.bind(notificationService)

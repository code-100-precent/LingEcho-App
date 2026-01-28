/**
 * 通知API服务
 */
import { get, post, put, del, ApiResponse } from '../../utils/request';

// 通知类型
export interface Notification {
  id: number;
  user_id: number;
  title: string;
  content: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  read: boolean;
  created_at: string;
  updated_at?: string;
  data?: any;
}

// 通知列表响应
export interface NotificationListResponse {
  list: Notification[];
  total: number;
  totalUnread: number;
  totalRead: number;
  page: number;
  size: number;
}

// 获取未读通知数量
export const getUnreadNotificationCount = async (): Promise<ApiResponse<number>> => {
  return get('/notification/unread-count');
};

// 获取通知列表
export const getNotifications = async (params?: {
  page?: number;
  size?: number;
  filter?: 'all' | 'read' | 'unread';
}): Promise<ApiResponse<NotificationListResponse>> => {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.size) queryParams.append('size', params.size.toString());
  if (params?.filter) queryParams.append('filter', params.filter);
  
  const queryString = queryParams.toString();
  return get(`/notification${queryString ? `?${queryString}` : ''}`);
};

// 标记所有通知为已读
export const markAllNotificationsAsRead = async (): Promise<ApiResponse<null>> => {
  return post('/notification/readAll', {});
};

// 标记单个通知为已读
export const markNotificationAsRead = async (id: number): Promise<ApiResponse<null>> => {
  return put(`/notification/read/${id}`, {});
};

// 删除通知
export const deleteNotification = async (id: number): Promise<ApiResponse<null>> => {
  return del(`/notification/${id}`);
};

// 批量删除通知
export const batchDeleteNotifications = async (ids: number[]): Promise<ApiResponse<{ deletedCount: number; totalRequested: number }>> => {
  return post('/notification/batch-delete', { ids });
};

// 获取所有通知ID
export const getAllNotificationIds = async (params?: {
  filter?: 'all' | 'read' | 'unread';
}): Promise<ApiResponse<{ ids: number[] }>> => {
  const queryParams = new URLSearchParams();
  if (params?.filter) queryParams.append('filter', params.filter);
  
  const queryString = queryParams.toString();
  return get(`/notification/all-ids${queryString ? `?${queryString}` : ''}`);
};

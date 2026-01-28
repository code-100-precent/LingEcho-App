/**
 * 留言箱 API
 */
import { get, post, del, ApiResponse } from '../../utils/request';

// 留言接口
export interface Voicemail {
  id: number;
  callerNumber: string;
  callerName?: string;
  callTime: string;
  duration: number;
  audioUrl?: string;
  transcribedText?: string;
  summary?: string;
  isRead: boolean;
  isImportant: boolean;
  createdAt: string;
  updatedAt: string;
}

// 留言统计接口
export interface VoicemailStats {
  total: number;
  unread: number;
  important: number;
  today: number;
}

/**
 * 获取留言列表
 */
export const getVoicemails = (params?: {
  isRead?: boolean;
  isImportant?: boolean;
  page?: number;
  limit?: number;
}): Promise<ApiResponse<{ list: Voicemail[]; total: number; page: number; limit: number }>> => {
  return get('/voicemails', params);
};

/**
 * 获取留言统计
 */
export const getVoicemailStats = (): Promise<ApiResponse<VoicemailStats>> => {
  return get('/voicemails/stats');
};

/**
 * 获取留言详情
 */
export const getVoicemailDetail = (id: number): Promise<ApiResponse<Voicemail>> => {
  return get(`/voicemails/${id}`);
};

/**
 * 标记为已读
 */
export const markAsRead = (id: number): Promise<ApiResponse<null>> => {
  return post(`/voicemails/${id}/mark-read`);
};

/**
 * 标记为重要
 */
export const markAsImportant = (id: number): Promise<ApiResponse<null>> => {
  return post(`/voicemails/${id}/mark-important`);
};

/**
 * 取消重要标记
 */
export const unmarkAsImportant = (id: number): Promise<ApiResponse<null>> => {
  return post(`/voicemails/${id}/unmark-important`);
};

/**
 * 删除留言
 */
export const deleteVoicemail = (id: number): Promise<ApiResponse<null>> => {
  return del(`/voicemails/${id}`);
};

/**
 * 批量删除留言
 */
export const batchDeleteVoicemails = (ids: number[]): Promise<ApiResponse<null>> => {
  return post('/voicemails/batch-delete', { ids });
};

/**
 * 批量标记为已读
 */
export const batchMarkAsRead = (ids: number[]): Promise<ApiResponse<null>> => {
  return post('/voicemails/batch-mark-read', { ids });
};

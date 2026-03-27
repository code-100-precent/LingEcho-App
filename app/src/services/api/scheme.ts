/**
 * 代接方案 API
 */
import { get, post, put, del, ApiResponse } from '../../utils/request';

// 日期类型
export type DayType = 'weekday' | 'weekend' | 'all';

// 激活模式
export type ActivationMode = 'manual' | 'auto';

// 时间段配置
export interface TimeSlot {
  dayType: DayType;
  startTime: string; // 格式 HH:MM，如 "09:00"
  endTime: string;   // 格式 HH:MM，如 "18:00"
}

// 代接方案接口（与后端SipUser模型对应）
export interface Scheme {
  id: number;
  schemeName: string;
  description?: string;
  username: string;
  status?: string;
  isActive: boolean;
  enabled: boolean;
  
  // AI配置
  assistantId?: number;
  autoAnswer: boolean;
  autoAnswerDelay: number;
  
  // AI回复配置
  openingMessage?: string;
  keywordReplies?: any[];
  fallbackMessage?: string;
  aiFreeResponse?: boolean;
  
  // 录音配置
  recordingEnabled: boolean;
  recordingMode: 'full' | 'message';
  
  // 留言配置
  messageEnabled: boolean;
  messageDuration: number;
  messagePrompt?: string;
  
  // 绑定号码
  boundPhoneNumber?: string;
  
  // 时间调度配置
  activationMode: ActivationMode;
  timeSlots?: TimeSlot[];
  priority?: number;
  
  // 接通前方案选择
  enablePreSelection?: boolean;
  
  // 统计信息
  callCount?: number;
  messageCount?: number;
  
  createdAt: string;
  updatedAt: string;
}

/**
 * 获取代接方案列表
 */
export const getSchemes = (): Promise<ApiResponse<Scheme[]>> => {
  return get('/schemes');
};

/**
 * 创建代接方案
 */
export const createScheme = (data: Partial<Scheme>): Promise<ApiResponse<Scheme>> => {
  return post('/schemes', data);
};

/**
 * 更新代接方案
 */
export const updateScheme = (id: number, data: Partial<Scheme>): Promise<ApiResponse<Scheme>> => {
  return put(`/schemes/${id}`, data);
};

/**
 * 删除代接方案
 */
export const deleteScheme = (id: number): Promise<ApiResponse<null>> => {
  return del(`/schemes/${id}`);
};

/**
 * 激活代接方案
 */
export const activateScheme = (id: number): Promise<ApiResponse<null>> => {
  return post(`/schemes/${id}/activate`);
};

/**
 * 停用代接方案
 */
export const deactivateScheme = (id: number): Promise<ApiResponse<null>> => {
  return post(`/schemes/${id}/deactivate`);
};

/**
 * 初始化默认代接方案（工作模式、休闲模式、休息模式）
 */
export const initDefaultSchemes = (): Promise<ApiResponse<Scheme[]>> => {
  return post('/schemes/init-defaults');
};

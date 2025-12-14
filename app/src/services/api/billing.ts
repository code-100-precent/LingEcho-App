/**
 * 账单API服务
 */
import { get, post, ApiResponse } from '../../utils/request';

// 使用量类型
export type UsageType = 'llm' | 'call' | 'asr' | 'tts' | 'storage' | 'api';

// 使用量记录
export interface UsageRecord {
  id: number;
  userId: number;
  credentialId: number;
  assistantId?: number;
  sessionId?: string;
  callLogId?: number;
  usageType: UsageType;
  model?: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  callDuration: number;
  callCount: number;
  audioDuration: number;
  audioSize: number;
  storageSize: number;
  apiCallCount: number;
  metadata?: string;
  description?: string;
  usageTime: string;
  createdAt: string;
  updatedAt: string;
}

// 使用量统计
export interface UsageStatistics {
  startTime: string;
  endTime: string;
  llmCalls: number;
  llmTokens: number;
  promptTokens: number;
  completionTokens: number;
  callDuration: number;
  callCount: number;
  avgCallDuration: number;
  asrDuration: number;
  asrCount: number;
  ttsDuration: number;
  ttsCount: number;
  storageSize: number;
  apiCalls: number;
}

// 每日使用量数据
export interface DailyUsageData {
  date: string; // YYYY-MM-DD
  llmCalls: number;
  llmTokens: number;
  callCount: number;
  callDuration: number;
  asrCount: number;
  asrDuration: number;
  ttsCount: number;
  ttsDuration: number;
  storageSize: number;
  apiCalls: number;
}

// 账单状态
export type BillStatus = 'draft' | 'generated' | 'exported' | 'archived';

// 账单
export interface Bill {
  id: number;
  userId: number;
  credentialId?: number;
  billNo: string;
  title: string;
  status: BillStatus;
  startTime: string;
  endTime: string;
  totalLLMCalls: number;
  totalLLMTokens: number;
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalCallDuration: number;
  totalCallCount: number;
  totalASRDuration: number;
  totalASRCount: number;
  totalTTSDuration: number;
  totalTTSCount: number;
  totalStorageSize: number;
  totalAPICalls: number;
  exportFormat?: string;
  exportPath?: string;
  exportedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// 生成账单请求
export interface GenerateBillRequest {
  credentialId?: number;
  groupId?: number;
  startTime: string;
  endTime: string;
  title?: string;
}

// 获取使用量统计
export const getUsageStatistics = async (params?: {
  startTime?: string;
  endTime?: string;
  credentialId?: number;
  groupId?: number;
}): Promise<ApiResponse<UsageStatistics>> => {
  const queryParams = new URLSearchParams();
  if (params?.startTime) queryParams.append('startTime', params.startTime);
  if (params?.endTime) queryParams.append('endTime', params.endTime);
  if (params?.credentialId) queryParams.append('credentialId', params.credentialId.toString());
  if (params?.groupId) queryParams.append('groupId', params.groupId.toString());
  
  return get(`/billing/statistics?${queryParams.toString()}`);
};

// 获取每日使用量数据（用于图表）
export const getDailyUsageData = async (params?: {
  startTime?: string;
  endTime?: string;
  credentialId?: number;
  groupId?: number;
}): Promise<ApiResponse<DailyUsageData[]>> => {
  const queryParams = new URLSearchParams();
  if (params?.startTime) queryParams.append('startTime', params.startTime);
  if (params?.endTime) queryParams.append('endTime', params.endTime);
  if (params?.credentialId) queryParams.append('credentialId', params.credentialId.toString());
  if (params?.groupId) queryParams.append('groupId', params.groupId.toString());
  
  return get(`/billing/daily-usage?${queryParams.toString()}`);
};

// 获取使用量记录列表
export const getUsageRecords = async (params?: {
  page?: number;
  size?: number;
  credentialId?: number;
  assistantId?: number;
  groupId?: number;
  usageType?: UsageType;
  startTime?: string;
  endTime?: string;
  orderBy?: string;
}): Promise<ApiResponse<{
  list: UsageRecord[];
  total: number;
  page: number;
  size: number;
}>> => {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.size) queryParams.append('size', params.size.toString());
  if (params?.credentialId) queryParams.append('credentialId', params.credentialId.toString());
  if (params?.assistantId) queryParams.append('assistantId', params.assistantId.toString());
  if (params?.groupId) queryParams.append('groupId', params.groupId.toString());
  if (params?.usageType) queryParams.append('usageType', params.usageType);
  if (params?.startTime) queryParams.append('startTime', params.startTime);
  if (params?.endTime) queryParams.append('endTime', params.endTime);
  if (params?.orderBy) queryParams.append('orderBy', params.orderBy);
  
  return get(`/billing/usage-records?${queryParams.toString()}`);
};

// 生成账单
export const generateBill = async (data: GenerateBillRequest): Promise<ApiResponse<Bill>> => {
  return post('/billing/bills', data);
};

// 获取账单列表
export const getBills = async (params?: {
  page?: number;
  size?: number;
  credentialId?: number;
  groupId?: number;
  status?: BillStatus;
  startTime?: string;
  endTime?: string;
  orderBy?: string;
}): Promise<ApiResponse<{
  list: Bill[];
  total: number;
  page: number;
  size: number;
}>> => {
  const queryParams = new URLSearchParams();
  if (params?.page) queryParams.append('page', params.page.toString());
  if (params?.size) queryParams.append('size', params.size.toString());
  if (params?.credentialId) queryParams.append('credentialId', params.credentialId.toString());
  if (params?.groupId) queryParams.append('groupId', params.groupId.toString());
  if (params?.status) queryParams.append('status', params.status);
  if (params?.startTime) queryParams.append('startTime', params.startTime);
  if (params?.endTime) queryParams.append('endTime', params.endTime);
  if (params?.orderBy) queryParams.append('orderBy', params.orderBy);
  
  return get(`/billing/bills?${queryParams.toString()}`);
};

// 获取单个账单
export const getBill = async (id: number): Promise<ApiResponse<Bill>> => {
  return get(`/billing/bills/${id}`);
};


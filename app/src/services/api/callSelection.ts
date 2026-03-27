/**
 * 来电方案选择 API
 */
import { get, post, put, ApiResponse } from '../../utils/request';

export interface PendingCallSelection {
  id: number;
  callId: string;
  callerNumber: string;
  calledNumber: string;
  callerIp?: string;
  callerUri?: string;
  userId: number;
  status: 'pending' | 'selected' | 'timeout' | 'cancelled';
  selectedSchemeId?: number;
  selectTimeout: string;
  selectedAt?: string;
  availableSchemeIds?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CallSelectionStatus {
  callId: string;
  status: string;
  selectedSchemeId?: number;
  remainingSeconds: number;
  isTimeout: boolean;
}

export interface CallSelectionSettings {
  totalSchemes: number;
  preSelectionEnabledCount: number;
  preSelectionEnabledSchemes: Array<{
    id: number;
    schemeName: string;
    boundPhoneNumber: string;
    enablePreSelection: boolean;
  }>;
  hasPreSelectionEnabled: boolean;
}

export interface Scheme {
  id: number;
  schemeName: string;
  description?: string;
  boundPhoneNumber: string;
  isActive: boolean;
  enabled: boolean;
}

/**
 * 获取待选择的来电列表
 */
export const getPendingCallSelections = (status?: string): Promise<ApiResponse<PendingCallSelection[]>> => {
  return get('/call-selections/pending', status ? { params: { status } } : undefined);
};

/**
 * 获取待选择来电详情
 */
export const getPendingCallSelection = (callId: string): Promise<ApiResponse<PendingCallSelection>> => {
  return get(`/call-selections/${callId}`);
};

/**
 * 获取来电选择状态（用于轮询）
 */
export const getCallSelectionStatus = (callId: string): Promise<ApiResponse<CallSelectionStatus>> => {
  return get(`/call-selections/${callId}/status`);
};

/**
 * 获取来电可用的方案列表
 */
export const getAvailableSchemesForCall = (callId: string): Promise<ApiResponse<Scheme[]>> => {
  return get(`/call-selections/${callId}/available-schemes`);
};

/**
 * 为来电选择方案
 */
export const selectSchemeForCall = (callId: string, schemeId: number): Promise<ApiResponse<any>> => {
  return post(`/call-selections/${callId}/select`, { schemeId });
};

/**
 * 取消来电选择
 */
export const cancelCallSelection = (callId: string): Promise<ApiResponse<any>> => {
  return post(`/call-selections/${callId}/cancel`);
};

/**
 * 获取用户的来电选择设置
 */
export const getUserCallSelectionSettings = (): Promise<ApiResponse<CallSelectionSettings>> => {
  return get('/call-selections/settings');
};

/**
 * 更新方案的来电选择设置
 */
export const updateCallSelectionSettings = (
  schemeId: number,
  enablePreSelection: boolean
): Promise<ApiResponse<any>> => {
  return put('/call-selections/settings', { schemeId, enablePreSelection });
};

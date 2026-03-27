import { get, post, put } from '../utils/request';

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

// 获取待选择的来电列表
export const getPendingCallSelections = (status?: string) => {
  return get<PendingCallSelection[]>('/call-selections/pending', { status });
};

// 获取待选择来电详情
export const getPendingCallSelection = (callId: string) => {
  return get<PendingCallSelection>(`/call-selections/${callId}`);
};

// 获取来电选择状态（用于轮询）
export const getCallSelectionStatus = (callId: string) => {
  return get<CallSelectionStatus>(`/call-selections/${callId}/status`);
};

// 获取来电可用的方案列表
export const getAvailableSchemesForCall = (callId: string) => {
  return get<any[]>(`/call-selections/${callId}/available-schemes`);
};

// 为来电选择方案
export const selectSchemeForCall = (callId: string, schemeId: number) => {
  return post(`/call-selections/${callId}/select`, { schemeId });
};

// 取消来电选择
export const cancelCallSelection = (callId: string) => {
  return post(`/call-selections/${callId}/cancel`);
};

// 获取用户的来电选择设置
export const getUserCallSelectionSettings = () => {
  return get<CallSelectionSettings>('/call-selections/settings');
};

// 更新方案的来电选择设置
export const updateCallSelectionSettings = (schemeId: number, enablePreSelection: boolean) => {
  return put('/call-selections/settings', { schemeId, enablePreSelection });
};

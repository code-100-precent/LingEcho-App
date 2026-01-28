/**
 * SIP 相关 API
 */
import { get, post, ApiResponse } from '../../utils/request';

// SIP 用户接口
export interface SipUser {
  id: number;
  username: string;
  displayName?: string;
  alias?: string;
  contact?: string;
  contactIp?: string;
  contactPort?: number;
  status: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

// SIP 通话记录接口
export interface SipCall {
  id: number;
  callId: string;
  direction: 'inbound' | 'outbound';
  status: string;
  fromUri?: string;
  toUri?: string;
  startTime: string;
  answerTime?: string;
  endTime?: string;
  duration: number;
  remoteRtpAddr?: string;
  errorMessage?: string;
  notes?: string;
  userId?: number;
  groupId?: number;
  createdAt: string;
  updatedAt: string;
}

// 呼出会话接口
export interface OutgoingSession {
  callId: string;
  targetUri: string;
  status: string;
  startTime: string;
  answerTime?: string;
  endTime?: string;
  remoteRtpAddr?: string;
  error?: string;
}

// 发起呼出请求
export interface MakeOutgoingCallRequest {
  targetUri: string;
  userId?: number;
  groupId?: number;
  notes?: string;
}

// 发起呼出响应
export interface MakeOutgoingCallResponse {
  callId: string;
  status: string;
  targetUri: string;
}

/**
 * 获取 SIP 用户列表
 */
export const getSipUsers = (params?: {
  status?: string;
  enabled?: boolean;
}): Promise<ApiResponse<SipUser[]>> => {
  return get('/sip/users', params);
};

/**
 * 发起呼出呼叫
 */
export const makeOutgoingCall = (data: MakeOutgoingCallRequest): Promise<ApiResponse<MakeOutgoingCallResponse>> => {
  return post('/sip/calls/outgoing', data);
};

/**
 * 获取呼出状态
 */
export const getOutgoingCallStatus = (callId: string): Promise<ApiResponse<OutgoingSession>> => {
  return get(`/sip/calls/outgoing/${callId}`);
};

/**
 * 取消呼出呼叫
 */
export const cancelOutgoingCall = (callId: string): Promise<ApiResponse<null>> => {
  return post(`/sip/calls/outgoing/${callId}/cancel`);
};

/**
 * 挂断呼出呼叫
 */
export const hangupOutgoingCall = (callId: string): Promise<ApiResponse<null>> => {
  return post(`/sip/calls/outgoing/${callId}/hangup`);
};

/**
 * 获取通话历史
 */
export const getCallHistory = (params?: {
  userId?: number;
  status?: string;
  limit?: number;
  page?: number;
}): Promise<ApiResponse<{
  list: SipCall[];
  total: number;
  page: number;
  limit: number;
}>> => {
  return get('/sip/calls', params);
};

/**
 * 获取通话详情
 */
export const getCallDetail = (callId: string): Promise<ApiResponse<SipCall>> => {
  return get(`/sip/calls/${callId}/detail`);
};

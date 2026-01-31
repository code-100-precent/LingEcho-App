/**
 * SIP 通话相关 API
 */
import { get, post } from '../../utils/request';

// SIP 用户
export interface SipUser {
  id: number;
  username: string;
  displayName?: string;
  alias?: string;
  contact?: string;
  contactIp?: string;
  contactPort?: number;
  status: 'registered' | 'unregistered' | 'expired';
  enabled: boolean;
  registerCount: number;
  callCount: number;
  lastRegister?: string;
  createdAt: string;
  updatedAt: string;
}

// 呼出请求
export interface MakeOutgoingCallRequest {
  targetUri: string;
  userId?: number;
  groupId?: number;
  notes?: string;
}

// 呼出响应
export interface MakeOutgoingCallResponse {
  callId: string;
  status: string;
  targetUri: string;
}

// 呼出会话
export interface OutgoingSession {
  remoteRtpAddr: string;
  callId: string;
  targetUri: string;
  status: string;
  startTime: string;
  answerTime?: string;
  endTime?: string;
  error?: string;
}

// 通话记录
export interface SipCall {
  id: number;
  callId: string;
  direction: 'inbound' | 'outbound';
  status: 'calling' | 'ringing' | 'answered' | 'failed' | 'cancelled' | 'ended';
  fromUsername?: string;
  fromUri?: string;
  fromIp?: string;
  toUsername?: string;
  toUri?: string;
  toIp?: string;
  localRtpAddr?: string;
  remoteRtpAddr?: string;
  startTime: string;
  answerTime?: string;
  endTime?: string;
  duration: number;
  userId?: number;
  groupId?: number;
  errorCode?: number;
  errorMessage?: string;
  recordUrl?: string;
  transcription?: string;
  transcriptionStatus?: 'pending' | 'processing' | 'completed' | 'failed';
  transcriptionError?: string;
  metadata?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// 通话历史查询参数
export interface CallHistoryParams {
  userId?: number;
  status?: string;
  limit?: number;
  page?: number;
}

// 通话历史响应
export interface CallHistoryResponse {
  list: SipCall[];
  total: number;
  page: number;
  limit: number;
}

// ASR 转录请求
export interface TranscriptionRequest {
  audioUrl: string;
  language?: string;
}

// ASR 转录响应
export interface TranscriptionResponse {
  text: string;
  confidence?: number;
  segments?: Array<{
    text: string;
    startTime: number;
    endTime: number;
  }>;
}

// 获取 SIP 用户列表
export const getSipUsers = async () => {
  return get<SipUser[]>('/sip/users');
};

// 发起呼出
export const makeOutgoingCall = async (data: MakeOutgoingCallRequest) => {
  return post<MakeOutgoingCallResponse>('/sip/calls/outgoing', data);
};

// 获取呼出状态
export const getOutgoingCallStatus = async (callId: string) => {
  return get<OutgoingSession>(`/sip/calls/outgoing/${callId}`);
};

// 取消呼出
export const cancelOutgoingCall = async (callId: string) => {
  return post<void>(`/sip/calls/outgoing/${callId}/cancel`);
};

// 挂断呼出（已接通的通话）
export const hangupOutgoingCall = async (callId: string) => {
  return post<void>(`/sip/calls/outgoing/${callId}/hangup`);
};

// 获取通话历史
export const getCallHistory = async (params?: CallHistoryParams) => {
  return get<CallHistoryResponse>('/sip/calls', { params });
};

// 获取通话详情
export const getCallDetail = async (callId: string) => {
  return get<SipCall>(`/sip/calls/${callId}/detail`);
};

// 请求 ASR 转录（如果服务端支持）
export const requestTranscription = async (callId: string, data: TranscriptionRequest) => {
  return post<TranscriptionResponse>(`/sip/calls/${callId}/transcribe`, data);
};

// 默认导出所有函数
export default {
  getSipUsers,
  makeOutgoingCall,
  getOutgoingCallStatus,
  cancelOutgoingCall,
  hangupOutgoingCall,
  getCallHistory,
  getCallDetail,
  requestTranscription,
};

/**
 * SIP 通话相关 API
 */
import { request } from '../../utils/request';

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
  transcription?: string; // ASR 转录文本
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

// 获取通话历史
export const getCallHistory = async (params?: CallHistoryParams) => {
  return request<CallHistoryResponse>({
    url: '/sip/calls',
    method: 'GET',
    params,
  });
};

// 获取通话详情
export const getCallDetail = async (callId: string) => {
  return request<SipCall>({
    url: `/sip/calls/${callId}/detail`,
    method: 'GET',
  });
};

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

// 请求 ASR 转录（如果服务端支持）
export const requestTranscription = async (callId: string, data: TranscriptionRequest) => {
  return request<TranscriptionResponse>({
    url: `/sip/calls/${callId}/transcribe`,
    method: 'POST',
    data,
  });
};

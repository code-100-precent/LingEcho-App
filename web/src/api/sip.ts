import { BaseApiService } from './base.service'

// SIP用户
export interface SipUser {
  id: number
  username: string
  displayName?: string
  alias?: string
  contact?: string
  contactIp?: string
  contactPort?: number
  status: 'registered' | 'unregistered' | 'expired'
  enabled: boolean
  registerCount: number
  callCount: number
  lastRegister?: string
  createdAt: string
  updatedAt: string
}

// 呼出请求
export interface MakeOutgoingCallRequest {
  targetUri: string
  userId?: number
  groupId?: number
  notes?: string
}

// 呼出响应
export interface MakeOutgoingCallResponse {
  callId: string
  status: string
  targetUri: string
}

// 呼出会话
export interface OutgoingSession {
  remoteRtpAddr: string
  callId: string
  targetUri: string
  status: string
  startTime: string
  answerTime?: string
  endTime?: string
  error?: string
}

// 通话记录
export interface SipCall {
  id: number
  callId: string
  direction: 'inbound' | 'outbound'
  status: 'calling' | 'ringing' | 'answered' | 'failed' | 'cancelled' | 'ended'
  fromUsername?: string
  fromUri?: string
  fromIp?: string
  toUsername?: string
  toUri?: string
  toIp?: string
  localRtpAddr?: string
  remoteRtpAddr?: string
  startTime: string
  answerTime?: string
  endTime?: string
  duration: number
  userId?: number
  groupId?: number
  errorCode?: number
  errorMessage?: string
  recordUrl?: string
  metadata?: string
  notes?: string
  createdAt: string
  updatedAt: string
}

class SipService extends BaseApiService {
  constructor() {
    super('/sip')
  }

  // 获取SIP用户列表
  async getSipUsers(): Promise<SipUser[]> {
    const response = await this.get<SipUser[]>('/users', {}, { enabled: true, ttl: 30000 })
    return this.handleResponse(response)
  }

  // 发起呼出
  async makeOutgoingCall(data: MakeOutgoingCallRequest): Promise<MakeOutgoingCallResponse> {
    const response = await this.post<MakeOutgoingCallResponse>('/calls/outgoing', data)
    return this.handleResponse(response)
  }

  // 获取呼出状态
  async getOutgoingCallStatus(callId: string): Promise<OutgoingSession> {
    const response = await this.get<OutgoingSession>(`/calls/outgoing/${callId}`)
    return this.handleResponse(response)
  }

  // 取消呼出
  async cancelOutgoingCall(callId: string): Promise<void> {
    const response = await this.post<void>(`/calls/outgoing/${callId}/cancel`)
    return this.handleResponse(response)
  }

  // 挂断呼出（已接通的通话）
  async hangupOutgoingCall(callId: string): Promise<void> {
    const response = await this.post<void>(`/calls/outgoing/${callId}/hangup`)
    return this.handleResponse(response)
  }

  // 获取通话历史
  async getCallHistory(params?: {
    userId?: number
    status?: string
    limit?: number
  }): Promise<SipCall[]> {
    const response = await this.get<SipCall[]>('/calls', { params })
    return this.handleResponse(response)
  }
}

// 导出单例
export const sipService = new SipService()

// 兼容性导出
export const getSipUsers = sipService.getSipUsers.bind(sipService)
export const makeOutgoingCall = sipService.makeOutgoingCall.bind(sipService)
export const getOutgoingCallStatus = sipService.getOutgoingCallStatus.bind(sipService)
export const cancelOutgoingCall = sipService.cancelOutgoingCall.bind(sipService)
export const hangupOutgoingCall = sipService.hangupOutgoingCall.bind(sipService)
export const getCallHistory = sipService.getCallHistory.bind(sipService)


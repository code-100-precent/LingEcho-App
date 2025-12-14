import { get, post, ApiResponse } from '@/utils/request'

// 聊天请求参数
export interface ChatRequest {
  assistantId: number
  systemPrompt?: string
  instruction?: string
  speaker?: string
  language?: string
  apiKey?: string
  apiSecret?: string
  speed?: number
  volume?: number
  personaTag?: string
  temperature?: number
  maxTokens?: number
}

// 聊天响应
export interface ChatResponse {
  sessionId: string
  message: string
}

// 聊天会话日志摘要
export interface ChatSessionLogSummary {
  id: number
  sessionId: string
  assistantId: number
  assistantName: string
  chatType: string
  preview: string
  createdAt: string
}

// 聊天会话日志详情
export interface ChatSessionLogDetail {
  id: number
  sessionId: string
  assistantId: number
  assistantName: string
  chatType: string
  userMessage: string
  agentMessage: string
  audioUrl?: string
  duration?: number
  createdAt: string
  updatedAt: string
}

// 聊天会话日志列表响应
export interface ChatSessionLogListResponse {
  logs: ChatSessionLogSummary[]
  nextCursor: number
  hasMoreData: boolean
  assistantId?: number
}

// 开始聊天会话
export const startChatSession = async (data: ChatRequest): Promise<ApiResponse<ChatResponse>> => {
  return post('/chat/start', data)
}

// 停止聊天会话
export const stopChatSession = async (sessionId: string): Promise<ApiResponse<{ message: string }>> => {
  return post('/chat/stop', { sessionId })
}

// 获取聊天会话日志列表
export const getChatSessionLogs = async (params: {
  pageSize?: number
  cursor?: string
}): Promise<ApiResponse<ChatSessionLogListResponse>> => {
  const queryParams = new URLSearchParams()
  if (params.pageSize) queryParams.append('pageSize', params.pageSize.toString())
  if (params.cursor) queryParams.append('cursor', params.cursor)
  
  const queryString = queryParams.toString()
  return get(`/chat/chat-session-log${queryString ? `?${queryString}` : ''}`)
}

// 获取聊天会话日志详情
export const getChatSessionLogDetail = async (id: number): Promise<ApiResponse<ChatSessionLogDetail>> => {
  return get(`/chat/chat-session-log/${id}`)
}

// 获取指定助手的聊天会话日志
export const getChatSessionLogsByAssistant = async (assistantId: number, params: {
  pageSize?: number
  cursor?: string
}): Promise<ApiResponse<ChatSessionLogListResponse>> => {
  const queryParams = new URLSearchParams()
  if (params.pageSize) queryParams.append('pageSize', params.pageSize.toString())
  if (params.cursor) queryParams.append('cursor', params.cursor)
  
  const queryString = queryParams.toString()
  return get(`/chat/chat-session-log/by-assistant/${assistantId}${queryString ? `?${queryString}` : ''}`)
}

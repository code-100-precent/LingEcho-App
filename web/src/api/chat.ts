import { BaseApiService } from './base.service'

// 聊天请求参数
export interface ChatRequest {
  assistantId: number
  systemPrompt?: string
  speaker?: string
  language?: string
  apiKey?: string
  apiSecret?: string
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
  messageCount?: number // 该 session 下的消息数量
}

// 工具调用信息
export interface ToolCallInfo {
  id: string
  name: string
  arguments: string
}

// LLM Usage 信息
export interface LLMUsage {
  // Request Information
  model: string
  maxTokens?: number
  maxCompletionTokens?: number
  temperature?: number
  topP?: number
  frequencyPenalty?: number
  presencePenalty?: number
  stop?: string[]
  n?: number
  user?: string
  stream: boolean
  seed?: number

  // Response Information
  responseId?: string
  object?: string
  created?: number
  finishReason?: string
  promptTokens: number
  completionTokens: number
  totalTokens: number

  // Context Information
  systemPrompt?: string
  messageCount?: number

  // Timing Information
  startTime?: string // ISO 8601 format
  endTime?: string   // ISO 8601 format
  duration?: number  // Duration in milliseconds

  // Tool Call Information
  hasToolCalls?: boolean
  toolCallCount?: number
  toolCalls?: ToolCallInfo[]
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
  llmUsage?: LLMUsage // LLM使用信息
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

class ChatService extends BaseApiService {
  constructor() {
    super('/chat')
  }

  // 开始聊天会话
  async startChatSession(data: ChatRequest): Promise<ChatResponse> {
    const response = await this.post<ChatResponse>('/start', data)
    return this.handleResponse(response)
  }

  // 停止聊天会话
  async stopChatSession(sessionId: string): Promise<{ message: string }> {
    const response = await this.post<{ message: string }>('/stop', { sessionId })
    return this.handleResponse(response)
  }

  // 获取聊天会话日志列表
  async getChatSessionLogs(params: {
    pageSize?: number
    cursor?: string
  }): Promise<ChatSessionLogListResponse> {
    const response = await this.get<ChatSessionLogListResponse>('/chat-session-log', { params })
    return this.handleResponse(response)
  }

  // 获取聊天会话日志详情
  async getChatSessionLogDetail(id: number): Promise<ChatSessionLogDetail> {
    const response = await this.get<ChatSessionLogDetail>(`/chat-session-log/${id}`, {}, { enabled: true, ttl: 300000 })
    return this.handleResponse(response)
  }

  // 获取指定会话的所有聊天记录
  async getChatSessionLogsBySession(sessionId: string): Promise<ChatSessionLogDetail[]> {
    const response = await this.get<ChatSessionLogDetail[]>(`/chat-session-log/by-session/${sessionId}`, {}, { enabled: true, ttl: 60000 })
    return this.handleResponse(response)
  }

  // 获取指定助手的聊天会话日志
  async getChatSessionLogsByAssistant(assistantId: number, params: {
    pageSize?: number
    cursor?: string
  }): Promise<ChatSessionLogListResponse> {
    const response = await this.get<ChatSessionLogListResponse>(`/chat-session-log/by-assistant/${assistantId}`, { params })
    return this.handleResponse(response)
  }
}

// 导出单例
export const chatService = new ChatService()

// 兼容性导出
export const startChatSession = chatService.startChatSession.bind(chatService)
export const stopChatSession = chatService.stopChatSession.bind(chatService)
export const getChatSessionLogs = chatService.getChatSessionLogs.bind(chatService)
export const getChatSessionLogDetail = chatService.getChatSessionLogDetail.bind(chatService)
export const getChatSessionLogsBySession = chatService.getChatSessionLogsBySession.bind(chatService)
export const getChatSessionLogsByAssistant = chatService.getChatSessionLogsByAssistant.bind(chatService)

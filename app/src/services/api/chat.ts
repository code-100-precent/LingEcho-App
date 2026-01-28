/**
 * 聊天API服务
 */
import { get, post, ApiResponse } from '../../utils/request';

// 聊天请求参数
export interface ChatRequest {
  assistantId: number;
  systemPrompt?: string;
  speaker?: string;
  language?: string;
  apiKey?: string;
  apiSecret?: string;
  personaTag?: string;
  temperature?: number;
  maxTokens?: number;
  knowledgeBaseId?: string | null;
  voiceCloneId?: number | null;
  sessionId?: string;
  text: string;
}

// 聊天响应
export interface ChatResponse {
  sessionId: string;
  message: string;
}

// 一次性文本对话请求
export interface OneShotTextRequest {
  apiKey: string;
  apiSecret: string;
  text: string;
  assistantId: number;
  language?: string;
  sessionId?: string;
  systemPrompt?: string;
  speaker?: string;
  voiceCloneId?: number | null;
  knowledgeBaseId?: string | null;
  temperature?: number;
  maxTokens?: number;
}

// 一次性文本对话响应
export interface OneShotTextResponse {
  requestId: string;
  text: string;
  audioUrl?: string;
}

// 一次性文本对话（V2版本，支持流式）
export interface OneShotTextV2Request {
  apiKey: string;
  apiSecret: string;
  text: string;
  assistantId: number;
  language?: string;
  sessionId?: string;
  systemPrompt?: string;
  speaker?: string;
  voiceCloneId?: number | null;
  knowledgeBaseId?: string | null;
  temperature?: number;
  maxTokens?: number;
  llmModel?: string;
}

// 开始聊天会话
export const startChatSession = async (data: ChatRequest): Promise<ApiResponse<ChatResponse>> => {
  return post('/chat/start', data);
};

// 停止聊天会话
export const stopChatSession = async (sessionId: string): Promise<ApiResponse<{ message: string }>> => {
  return post('/chat/stop', { sessionId });
};

// 聊天会话日志摘要
export interface ChatSessionLogSummary {
  id: number;
  sessionId: string;
  assistantId: number;
  assistantName?: string;
  userId: number;
  startTime: string;
  endTime?: string;
  messageCount: number;
  firstMessage?: string;
  lastMessage?: string;
  createdAt: string;
  updatedAt: string;
}

// 聊天会话日志详情
export interface ChatSessionLogDetail {
  id: number;
  sessionId: string;
  assistantId: number;
  userId: number;
  userMessage: string;
  agentMessage: string;
  audioUrl?: string;
  messageTime: string;
  createdAt: string;
  updatedAt: string;
}

// 聊天会话日志列表响应
export interface ChatSessionLogListResponse {
  logs: ChatSessionLogSummary[];
  total: number;
  nextCursor: number;
  hasMoreData: boolean;
}

// 获取聊天会话日志列表
export const getChatSessionLogs = async (params: {
  pageSize?: number;
  cursor?: string;
}): Promise<ApiResponse<ChatSessionLogListResponse>> => {
  const queryParams = new URLSearchParams();
  if (params.pageSize) queryParams.append('pageSize', params.pageSize.toString());
  if (params.cursor) queryParams.append('cursor', params.cursor);
  
  const queryString = queryParams.toString();
  return get(`/chat/chat-session-log${queryString ? `?${queryString}` : ''}`);
};

// 获取聊天会话日志详情
export const getChatSessionLogDetail = async (id: number): Promise<ApiResponse<ChatSessionLogDetail>> => {
  return get(`/chat/chat-session-log/${id}`);
};

// 获取指定会话的所有聊天记录
export const getChatSessionLogsBySession = async (sessionId: string): Promise<ApiResponse<ChatSessionLogDetail[]>> => {
  return get(`/chat/chat-session-log/by-session/${sessionId}`);
};

// 获取指定助手的聊天会话日志
export const getChatSessionLogsByAssistant = async (assistantId: number, params: {
  pageSize?: number;
  cursor?: string;
}): Promise<ApiResponse<ChatSessionLogListResponse>> => {
  const queryParams = new URLSearchParams();
  if (params.pageSize) queryParams.append('pageSize', params.pageSize.toString());
  if (params.cursor) queryParams.append('cursor', params.cursor);
  
  const queryString = queryParams.toString();
  return get(`/chat/chat-session-log/by-assistant/${assistantId}${queryString ? `?${queryString}` : ''}`);
};

// 一次性文本对话（非流式）
export const oneShotText = async (data: OneShotTextRequest): Promise<ApiResponse<OneShotTextResponse>> => {
  return post('/voice/oneshot_text', data);
};

// 一次性文本对话（V2版本，非流式）
export const plainText = async (data: OneShotTextV2Request): Promise<ApiResponse<OneShotTextResponse>> => {
  return post('/voice/plain_text', data);
};

// 获取音频处理状态
export const getAudioStatus = async (requestId: string): Promise<ApiResponse<{ status: string; audioUrl?: string; text?: string }>> => {
  return get('/voice/audio_status', { params: { requestId } });
};

// 一次性文本对话（流式，使用SSE）- React Native版本使用非流式API
export const plainTextStream = async (
  data: OneShotTextV2Request,
  onChunk: (text: string) => void,
  onComplete?: () => void,
  onError?: (error: string) => void
): Promise<void> => {
  try {
    // React Native不支持fetch流式响应，使用非流式API
    const { plainText } = await import('./chat');
    const response = await plainText({
      apiKey: data.apiKey,
      apiSecret: data.apiSecret,
      text: data.text,
      assistantId: data.assistantId || 0,
      language: data.language,
      sessionId: data.sessionId,
      systemPrompt: data.systemPrompt,
      speaker: data.speaker,
      voiceCloneId: data.voiceCloneId || null,
      knowledgeBaseId: data.knowledgeBaseId || null,
      temperature: data.temperature,
      maxTokens: data.maxTokens,
    });

    if (response.code === 200 && response.data) {
      // 模拟流式输出效果
      const text = response.data.text || '';
      const words = text.split('');
      let currentText = '';
      
      for (let i = 0; i < words.length; i++) {
        currentText += words[i];
        onChunk(words[i]);
        // 添加小延迟模拟流式效果
        await new Promise(resolve => setTimeout(resolve, 20));
      }
      
      onComplete?.();
    } else {
      onError?.(response.msg || '请求失败');
    }
  } catch (error: any) {
    onError?.(error.message || '请求失败');
  }
};


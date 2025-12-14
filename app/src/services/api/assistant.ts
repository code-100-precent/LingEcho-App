/**
 * 助手API服务
 */
import { get, post, put, del, ApiResponse } from '../../utils/request';

// 助手创建表单
export interface CreateAssistantForm {
  name: string;
  description?: string;
  icon?: string;
  groupId?: number | null;
}

// 助手更新表单
export interface UpdateAssistantForm {
  name?: string;
  description?: string;
  icon?: string;
  systemPrompt?: string;
  persona_tag?: string;
  temperature?: number;
  maxTokens?: number;
  language?: string;
  speaker?: string;
  voiceCloneId?: number | null;
  knowledgeBaseId?: string | null;
  ttsProvider?: string;
  apiKey?: string;
  apiSecret?: string;
  llmModel?: string;
}

// 助手信息
export interface Assistant {
  id: number;
  userId: number;
  groupId?: number | null;
  name: string;
  description: string;
  icon: string;
  systemPrompt: string;
  personaTag: string;
  temperature: number;
  maxTokens: number;
  jsSourceId: string;
  language?: string;
  speaker?: string;
  voiceCloneId?: number | null;
  knowledgeBaseId?: string | null;
  ttsProvider?: string;
  apiKey?: string;
  apiSecret?: string;
  llmModel?: string;
  createdAt: string;
  updatedAt: string;
}

// 助手列表项（简化版）
export interface AssistantListItem {
  id: number;
  name: string;
  description: string;
  icon: string;
  groupId?: number | null;
}

// 创建助手
export const createAssistant = async (data: CreateAssistantForm): Promise<ApiResponse<Assistant>> => {
  return post('/assistant/add', data);
};

// 获取助手列表
export const getAssistantList = async (): Promise<ApiResponse<AssistantListItem[]>> => {
  return get('/assistant');
};

// 获取助手详情
export const getAssistant = async (id: number): Promise<ApiResponse<Assistant>> => {
  return get(`/assistant/${id}`);
};

// 更新助手
export const updateAssistant = async (id: number, data: UpdateAssistantForm): Promise<ApiResponse<Assistant>> => {
  return put(`/assistant/${id}`, data);
};

// 删除助手
export const deleteAssistant = async (id: number): Promise<ApiResponse<null>> => {
  return del(`/assistant/${id}`);
};

// 更新助手JS模板
export const updateAssistantJS = async (id: number, jsSourceId: string): Promise<ApiResponse<any>> => {
  return put(`/assistant/${id}/js`, { jsSourceId });
};

// 音色选项接口
export interface VoiceOption {
  id: string; // 音色编码
  name: string; // 音色名称
  description: string; // 音色描述
  type: string; // 音色类型（男声/女声/童声等）
  language: string; // 支持的语言
  sampleRate?: string; // 音色采样率
  emotion?: string; // 音色情感
  scene?: string; // 推荐场景
}

export interface VoiceOptionsResponse {
  provider: string;
  voices: VoiceOption[];
}

// 根据TTS Provider获取音色列表
export const getVoiceOptions = async (provider: string): Promise<ApiResponse<VoiceOptionsResponse>> => {
  return get('/voice/options', { params: { provider } });
};

// 语言选项接口
export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  configKey: string;
  description: string;
}

export interface LanguageOptionsResponse {
  provider: string;
  languages: LanguageOption[];
}

// 根据TTS Provider获取支持的语言列表
export const getLanguageOptions = async (provider: string): Promise<ApiResponse<LanguageOptionsResponse>> => {
  return get('/voice/language-options', { params: { provider } });
};

// 训练音色接口
export interface VoiceClone {
  id: number;
  voice_name: string;
  voice_description?: string;
}

// 获取用户音色列表
export const getVoiceClones = async (): Promise<ApiResponse<VoiceClone[]>> => {
  return get('/voice/clones');
};


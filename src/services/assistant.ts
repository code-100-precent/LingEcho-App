/**
 * 助手服务 - 使用 Mock 数据
 */
import { mockAssistantService, Assistant } from './mockData';

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
  language?: string;
  speaker?: string;
  voiceCloneId?: number | null;
  knowledgeBaseId?: string | null;
  ttsProvider?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAssistantForm {
  name: string;
  description?: string;
  icon?: string;
  groupId?: number | null;
}

export interface UpdateAssistantForm {
  name?: string;
  description?: string;
  icon?: string;
  systemPrompt?: string;
  personaTag?: string;
  temperature?: number;
  maxTokens?: number;
  language?: string;
  speaker?: string;
  voiceCloneId?: number | null;
  knowledgeBaseId?: string | null;
  ttsProvider?: string;
}

export const assistantService = {
  // 获取助手列表
  async getAssistants(): Promise<Assistant[]> {
    return await mockAssistantService.getAssistants();
  },

  // 获取单个助手
  async getAssistant(id: number): Promise<Assistant | null> {
    return await mockAssistantService.getAssistant(id);
  },

  // 创建助手
  async createAssistant(form: CreateAssistantForm): Promise<Assistant | null> {
    return await mockAssistantService.createAssistant(form);
  },

  // 更新助手
  async updateAssistant(id: number, form: UpdateAssistantForm): Promise<Assistant | null> {
    return await mockAssistantService.updateAssistant(id, form);
  },

  // 删除助手
  async deleteAssistant(id: number): Promise<boolean> {
    return await mockAssistantService.deleteAssistant(id);
  },
};


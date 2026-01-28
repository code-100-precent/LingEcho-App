/**
 * 知识库API服务
 */
import { get, post, del, ApiResponse } from '../../utils/request';

// 知识库基本信息
export interface KnowledgeBase {
  id: number;
  user_id: number;
  group_id?: number | null;
  knowledge_key: string;
  knowledge_name: string;
  provider?: string;
  created_at: string;
  updated_at?: string;
  update_at: string;
  delete_at: string;
}

// 创建知识库请求参数
export interface CreateKnowledgeBaseRequest {
  knowledgeName: string;
  file: any; // React Native 文件对象
  groupId?: number | null;
}

// 上传文件到知识库请求参数
export interface UploadKnowledgeBaseRequest {
  file: any;
  knowledgeKey: string;
}

// 向知识库提问请求参数
export interface AskKnowledgeBaseRequest {
  knowledgeKey: string;
  message: string;
}

// 创建知识库
export const createKnowledgeBase = async (
  data: CreateKnowledgeBaseRequest
): Promise<ApiResponse<KnowledgeBase>> => {
  const formData = new FormData();
  formData.append('knowledgeName', data.knowledgeName);
  formData.append('file', data.file);
  if (data.groupId) {
    formData.append('group_id', data.groupId.toString());
  }
  return post<KnowledgeBase>('/knowledge/create', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

// 上传文件到知识库
export const uploadKnowledgeBase = async (
  data: UploadKnowledgeBaseRequest
): Promise<ApiResponse<null>> => {
  const formData = new FormData();
  formData.append('file', data.file);
  formData.append('knowledgeKey', data.knowledgeKey);
  return post<null>('/knowledge/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

// 删除知识库
export const deleteKnowledgeBase = async (
  knowledgeKey: string
): Promise<ApiResponse<string>> => {
  return del<string>(`/knowledge/delete?knowledgeKey=${knowledgeKey}`);
};

// 获取知识库列表
export const getKnowledgeBaseByUser = async (): Promise<ApiResponse<KnowledgeBase[]>> => {
  return get<KnowledgeBase[]>('/knowledge/get');
};

// 向知识库提问
export const askKnowledgeBase = async (
  params: AskKnowledgeBaseRequest
): Promise<ApiResponse<string>> => {
  return get<string>('/knowledge/getInfo', { params });
};

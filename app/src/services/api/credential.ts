/**
 * 凭证管理 API 服务
 */
import { get, post, del, ApiResponse } from '../../utils/request';

// 凭证类型
export interface Credential {
  id: number;
  name: string;
  apiKey: string;
  apiSecret?: string;
  llmProvider?: string;
  llmApiKey?: string;
  llmApiUrl?: string;
  asrConfig?: {
    provider: string;
    [key: string]: any;
  };
  ttsConfig?: {
    provider: string;
    [key: string]: any;
  };
  created_at?: string;
  updated_at?: string;
}

// 创建凭证表单
export interface CreateCredentialForm {
  name: string;
  llmProvider?: string;
  llmApiKey?: string;
  llmApiUrl?: string;
  asrConfig?: {
    provider: string;
    [key: string]: any;
  };
  ttsConfig?: {
    provider: string;
    [key: string]: any;
  };
}

// 创建凭证响应
export interface CreateCredentialResponse {
  name: string;
  apiKey: string;
  apiSecret: string;
}

/**
 * 获取用户凭证列表
 */
export const fetchUserCredentials = async (): Promise<ApiResponse<Credential[]>> => {
  return get<Credential[]>('/credentials/');
};

/**
 * 创建凭证
 */
export const createCredential = async (
  data: CreateCredentialForm
): Promise<ApiResponse<CreateCredentialResponse>> => {
  return post<CreateCredentialResponse>('/credentials/', data);
};

/**
 * 删除凭证
 */
export const deleteCredential = async (id: number): Promise<ApiResponse<null>> => {
  return del<null>(`/credentials/${id}`);
};

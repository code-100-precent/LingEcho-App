import { get, post, del, ApiResponse } from '@/utils/request'

// 密钥创建表单
export interface CreateCredentialForm {
  name: string
  llmProvider: string
  llmApiKey: string
  llmApiUrl: string
  asrProvider: string
  asrAppId: string
  asrSecretId: string
  asrSecretKey: string
  asrLanguage: string
  ttsProvider: string
  ttsAppId: string
  ttsSecretId: string
  ttsSecretKey: string
}

// 密钥信息
export interface Credential {
  id: number
  name: string
  apiKey: string
  apiSecret: string
  llmProvider: string
  llmApiKey: string
  llmApiUrl: string
  asrProvider: string
  asrAppId: string
  asrSecretId: string
  asrSecretKey: string
  asrLanguage: string
  ttsProvider: string
  ttsAppId: string
  ttsSecretId: string
  ttsSecretKey: string
  created_at: string
  updated_at: string
}

// 创建密钥响应
export interface CreateCredentialResponse {
  id: number
  name: string
  apiKey: string
  apiSecret: string
}

// 获取用户密钥列表
export const fetchUserCredentials = async (): Promise<ApiResponse<Credential[]>> => {
  return get('/credentials/')
}

// 创建密钥
export const createCredential = async (data: CreateCredentialForm): Promise<ApiResponse<CreateCredentialResponse>> => {
  return post('/credentials/', data)
}

// 删除密钥
export const deleteCredential = async (id: number): Promise<ApiResponse<null>> => {
  return del(`/credentials/${id}`)
}

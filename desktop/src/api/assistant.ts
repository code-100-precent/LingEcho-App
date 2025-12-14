import { get, post, put, del, ApiResponse } from '@/utils/request'

// 助手创建表单
export interface CreateAssistantForm {
  name: string
  description?: string
  icon?: string
}

// 助手更新表单
export interface UpdateAssistantForm {
  systemPrompt?: string
  instruction?: string
  persona_tag?: string
  temperature?: number
  maxTokens?: number
}

// 助手信息 - 对应后端Assistant模型的部分字段
export interface Assistant {
  id: number
  name: string
  description: string
  icon: string
  systemPrompt: string
  instruction: string
  personaTag: string
  temperature: number
  maxTokens: number
  jsSourceId: string
  createdAt: string
  updatedAt: string
}

// 助手列表项 - 对应ListAssistants返回的字段
export interface AssistantListItem {
  id: number
  name: string
  icon: string
  description: string
  jsSourceId: string
}

// 创建助手
export const createAssistant = async (data: CreateAssistantForm): Promise<ApiResponse<Assistant>> => {
  return post('/assistant/add', data)
}

// 获取助手列表
export const getAssistantList = async (): Promise<ApiResponse<AssistantListItem[]>> => {
  return get('/assistant')
}

// 获取助手详情
export const getAssistant = async (id: number): Promise<ApiResponse<Assistant>> => {
  return get(`/assistant/${id}`)
}

// 更新助手
export const updateAssistant = async (id: number, data: UpdateAssistantForm): Promise<ApiResponse<Assistant>> => {
  return put(`/assistant/${id}`, data)
}

// 更新助手JS模板
export const updateAssistantJS = async (id: number, jsSourceId: string): Promise<ApiResponse<any>> => {
  return put(`/assistant/${id}/js`, { jsSourceId })
}

// 删除助手
export const deleteAssistant = async (id: number): Promise<ApiResponse<null>> => {
  return del(`/assistant/${id}`)
}

// 获取助手JS文件
export const getAssistantJS = async (jsSourceId: string): Promise<string> => {
  try {
    const response = await fetch(`http://localhost:7072/api/assistant/lingecho/client/${jsSourceId}/loader.js`)
    console.log('API响应状态:', response.status, response.statusText)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('API错误响应:', errorText)
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const jsContent = await response.text()
    console.log('JS内容获取成功，长度:', jsContent.length)
    return jsContent
  } catch (error) {
    console.error('获取助手JS失败:', error)
    const errorMessage = error instanceof Error ? error.message : '未知错误'
    throw new Error(`获取助手JS失败: ${errorMessage}`)
  }
}

// 语音相关接口
export interface VoiceClone {
  id: number
  voice_name: string
  voice_description?: string
}

export interface OneShotRequest {
  assistantId: number
  language?: string
  speaker?: string
  voiceCloneId?: number
  temperature?: number
  systemPrompt?: string
  instruction?: string
}

export interface OneShotTextRequest extends OneShotRequest {
  text: string
  sessionId?: string
}

export interface OneShotResponse {
  text: string
  audioUrl?: string
  requestId?: string
}

// 获取用户音色列表
export const getVoiceClones = async (): Promise<ApiResponse<VoiceClone[]>> => {
  return get('/voice/clones')
}

// 一句话模式 - 音频输入
export const oneShotAudio = async (formData: FormData): Promise<ApiResponse<OneShotResponse>> => {
  return post('/voice/oneshot', formData)
}

// 一句话模式 - 文本输入
export const oneShotText = async (data: OneShotTextRequest): Promise<ApiResponse<OneShotResponse>> => {
  return post('/voice/oneshot_text', data)
}

// 获取音频处理状态
export const getAudioStatus = async (requestId: string): Promise<ApiResponse<{ status: string; audioUrl?: string; text?: string }>> => {
  return get('/voice/audio_status', { params: { requestId } })
}
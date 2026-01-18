import { BaseApiService } from './base.service'
import { ApiResponse } from '@/utils/http'
import { getApiBaseURL } from '@/config/apiConfig'

// 助手创建表单
export interface CreateAssistantForm {
  name: string
  description?: string
  icon?: string
  groupId?: number | null // 组织ID，如果设置则创建为组织共享的助手
}

// 助手更新表单
export interface UpdateAssistantForm {
  name?: string
  description?: string
  icon?: string
  systemPrompt?: string
  persona_tag?: string
  temperature?: number
  maxTokens?: number
  language?: string
  speaker?: string
  voiceCloneId?: number | null
  knowledgeBaseId?: string | null
  ttsProvider?: string
  apiKey?: string
  apiSecret?: string
  llmModel?: string // LLM模型名称
  enableGraphMemory?: boolean
  enableVAD?: boolean // 是否启用VAD
  vadThreshold?: number // VAD阈值
  vadConsecutiveFrames?: number // VAD连续帧数
}

// 助手信息 - 对应后端Assistant模型的完整字段
export interface Assistant {
  id: number
  userId: number
  groupId?: number | null // 组织ID，如果设置则表示这是组织共享的助手
  name: string
  description: string
  icon: string
  systemPrompt: string
  personaTag: string
  temperature: number
  maxTokens: number
  jsSourceId: string
  language?: string
  speaker?: string
  voiceCloneId?: number | null
  knowledgeBaseId?: string | null
  ttsProvider?: string
  apiKey?: string
  apiSecret?: string
  llmModel?: string // LLM模型名称
  enableGraphMemory?: boolean // 是否启用基于图数据库的长期记忆
  enableVAD?: boolean // 是否启用VAD
  vadThreshold?: number // VAD阈值
  vadConsecutiveFrames?: number // VAD连续帧数
  createdAt: string
  updatedAt: string
}

// 助手列表项 - 对应ListAssistants返回的字段
export interface AssistantListItem {
  id: number
  userId?: number
  groupId?: number | null
  name: string
  icon: string
  description: string
  jsSourceId?: string
  personaTag?: string
  temperature?: number
  maxTokens?: number
  createdAt?: string
  updatedAt?: string
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
}

export interface OneShotTextV2Request {
  apiKey: string
  apiSecret: string
  text: string
  assistantId?: number
  language?: string
  sessionId?: string
  systemPrompt?: string
  speaker?: string      // 音色编码
  voiceCloneId?: number // 训练音色ID（优先级高于speaker）
  knowledgeBaseId?: string // 知识库ID（可选）
  temperature?: number  // 生成多样性 (0-2)
  maxTokens?: number   // 最大回复长度
}

export interface OneShotResponse {
  text: string
  audioUrl?: string
  requestId?: string
}

// 音色选项接口
export interface VoiceOption {
  id: string          // 音色编码
  name: string        // 音色名称
  description: string // 音色描述
  type: string        // 音色类型（男声/女声/童声等）
  language: string    // 支持的语言
  sampleRate?: string  // 音色采样率
  emotion?: string     // 音色情感
  scene?: string       // 推荐场景
}

export interface VoiceOptionsResponse {
  provider: string
  voices: VoiceOption[]
}

// 语言选项接口
export interface LanguageOption {
  code: string        // 语言代码，如 zh-CN, en-US
  name: string        // 语言名称，如 中文、English
  nativeName: string  // 本地名称，如 中文、English
  configKey: string  // 配置字段名（不同平台可能不同），如 language, languageCode, lan
  description: string // 语言描述
}

export interface LanguageOptionsResponse {
  provider: string
  languages: LanguageOption[]
}

// ========== Assistant Tools 相关接口 ==========

// 助手工具接口
export interface AssistantTool {
  id: number
  assistantId: number
  name: string
  description: string
  parameters: string // JSON Schema格式
  code?: string // 可选的代码标识
  webhookUrl?: string // Webhook URL（用于自定义工具执行）
  enabled: boolean
  createdAt: string
  updatedAt: string
}

// 创建工具表单
export interface CreateToolForm {
  name: string
  description: string
  parameters: string // JSON Schema格式
  code?: string
  webhookUrl?: string // Webhook URL（用于自定义工具执行）
  enabled?: boolean
}

// 更新工具表单
export interface UpdateToolForm {
  name?: string
  description?: string
  parameters?: string
  code?: string
  webhookUrl?: string // Webhook URL（用于自定义工具执行）
  enabled?: boolean
}

// 测试工具
export interface TestToolRequest {
  args: Record<string, any>
}

export interface TestToolResponse {
  result: string
  tool: AssistantTool
}

// ========== Assistant Graph Data 相关接口 ==========

// 图节点
export interface GraphNode {
  id: string
  label: string
  type: string // Assistant, User, Conversation, Topic, Intent, Knowledge等
  props: Record<string, any>
}

// 图边（关系）
export interface GraphEdge {
  id: string
  source: string
  target: string
  type: string // HAS_CONVERSATION, WITH_ASSISTANT, DISCUSSES等
  props: Record<string, any>
}

// 图统计信息
export interface GraphStats {
  totalNodes: number
  totalEdges: number
  usersCount: number
  conversationsCount: number
  topicsCount: number
  intentsCount: number
  knowledgeCount: number
}

// 助手图数据
export interface AssistantGraphData {
  assistantId: number
  nodes: GraphNode[]
  edges: GraphEdge[]
  stats: GraphStats
}

// Assistant Service 类
export class AssistantService extends BaseApiService {
  constructor() {
    super('/assistant')
  }

  // 创建助手
  async createAssistant(data: CreateAssistantForm): Promise<Assistant> {
    const response = await this.post<Assistant>('/add', data)
    return this.handleResponse(response)
  }

  // 获取助手列表
  async getAssistantList(): Promise<AssistantListItem[]> {
    const response = await this.get<AssistantListItem[]>('')
    return this.handleResponse(response)
  }

  // 获取助手详情
  async getAssistant(id: number): Promise<Assistant> {
    const response = await this.get<Assistant>(`/${id}`)
    return this.handleResponse(response)
  }

  // 更新助手
  async updateAssistant(id: number, data: UpdateAssistantForm): Promise<Assistant> {
    const response = await this.put<Assistant>(`/${id}`, data)
    return this.handleResponse(response)
  }

  // 更新助手JS模板
  async updateAssistantJS(id: number, jsSourceId: string): Promise<any> {
    const response = await this.put<any>(`/${id}/js`, { jsSourceId })
    return this.handleResponse(response)
  }

  // 删除助手
  async deleteAssistant(id: number): Promise<null> {
    const response = await this.delete<null>(`/${id}`)
    return this.handleResponse(response)
  }

  // 获取助手的所有工具
  async getAssistantTools(assistantId: number): Promise<AssistantTool[]> {
    const response = await this.get<AssistantTool[]>(`/${assistantId}/tools`)
    return this.handleResponse(response)
  }

  // 创建工具
  async createAssistantTool(assistantId: number, data: CreateToolForm): Promise<AssistantTool> {
    const response = await this.post<AssistantTool>(`/${assistantId}/tools`, data)
    return this.handleResponse(response)
  }

  // 更新工具
  async updateAssistantTool(assistantId: number, toolId: number, data: UpdateToolForm): Promise<AssistantTool> {
    const response = await this.put<AssistantTool>(`/${assistantId}/tools/${toolId}`, data)
    return this.handleResponse(response)
  }

  // 删除工具
  async deleteAssistantTool(assistantId: number, toolId: number): Promise<null> {
    const response = await this.delete<null>(`/${assistantId}/tools/${toolId}`)
    return this.handleResponse(response)
  }

  // 测试工具
  async testAssistantTool(assistantId: number, toolId: number, args: Record<string, any>): Promise<TestToolResponse> {
    const response = await this.post<TestToolResponse>(`/${assistantId}/tools/${toolId}/test`, { args })
    return this.handleResponse(response)
  }

  // 获取助手图数据
  async getAssistantGraphData(assistantId: number): Promise<AssistantGraphData> {
    const response = await this.get<AssistantGraphData>(`/${assistantId}/graph`)
    return this.handleResponse(response)
  }
}

// Voice Service 类
export class VoiceService extends BaseApiService {
  constructor() {
    super('/voice')
  }

  // 获取用户音色列表
  async getVoiceClones(): Promise<VoiceClone[]> {
    const response = await this.get<VoiceClone[]>('/clones')
    return this.handleResponse(response)
  }

  // 一句话模式 - 文本输入（带TTS合成）
  async oneShotText(data: OneShotTextV2Request): Promise<OneShotResponse> {
    const response = await this.post<OneShotResponse>('/oneshot_text', data)
    return this.handleResponse(response)
  }

  // 纯文本对话 - 文本输入（不进行TTS合成，用于调试）
  async plainText(data: OneShotTextV2Request): Promise<{ text: string }> {
    const response = await this.post<{ text: string }>('/plain_text', data)
    return this.handleResponse(response)
  }

  // 纯文本对话 - 流式接收（SSE）
  async plainTextStream(
    data: OneShotTextV2Request,
    onChunk: (text: string) => void,
    onComplete?: () => void,
    onError?: (error: string) => void
  ): Promise<void> {
    try {
      // 获取API基础URL
      const baseURL = getApiBaseURL()
      const token = localStorage.getItem('auth_token') || localStorage.getItem('token') || ''
      
      const response = await fetch(`${baseURL}/voice/plain_text`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ msg: '请求失败' }))
        onError?.(errorData.msg || '请求失败')
        return
      }

      const reader = response.body?.getReader()
      if (!reader) {
        onError?.('无法读取响应流')
        return
      }

      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        
        if (done) {
          onComplete?.()
          break
        }

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim()
            if (dataStr === '[DONE]' || dataStr === '{"done": true}') {
              onComplete?.()
              return
            }

            try {
              const jsonData = JSON.parse(dataStr)
              if (jsonData.error) {
                onError?.(jsonData.error)
                return
              }
              if (jsonData.text) {
                onChunk(jsonData.text)
              }
            } catch (e) {
              // 忽略解析错误，继续处理下一行
              console.warn('Failed to parse SSE data:', dataStr, e)
            }
          }
        }
      }
    } catch (error: any) {
      onError?.(error.message || '流式请求失败')
    }
  }

  // 获取音频处理状态
  async getAudioStatus(requestId: string): Promise<{ status: string; audioUrl?: string; text?: string }> {
    const response = await this.get<{ status: string; audioUrl?: string; text?: string }>('/audio_status', { params: { requestId } })
    return this.handleResponse(response)
  }

  // 根据TTS Provider获取音色列表
  async getVoiceOptions(provider: string): Promise<VoiceOptionsResponse> {
    const response = await this.get<VoiceOptionsResponse>('/options', { params: { provider } })
    return this.handleResponse(response)
  }

  // 根据TTS Provider获取支持的语言列表
  async getLanguageOptions(provider: string): Promise<LanguageOptionsResponse> {
    const response = await this.get<LanguageOptionsResponse>('/language-options', { params: { provider } })
    return this.handleResponse(response)
  }
}

// 导出服务实例
export const assistantService = new AssistantService()
export const voiceService = new VoiceService()

// 兼容性导出（保持向后兼容）
export const createAssistant = (data: CreateAssistantForm) => assistantService.createAssistant(data)
export const getAssistantList = () => assistantService.getAssistantList()
export const getAssistant = (id: number) => assistantService.getAssistant(id)
export const updateAssistant = (id: number, data: UpdateAssistantForm) => assistantService.updateAssistant(id, data)
export const updateAssistantJS = (id: number, jsSourceId: string) => assistantService.updateAssistantJS(id, jsSourceId)
export const deleteAssistant = (id: number) => assistantService.deleteAssistant(id)
export const getVoiceClones = () => voiceService.getVoiceClones()
export const oneShotText = (data: OneShotTextV2Request) => voiceService.oneShotText(data)
export const plainText = (data: OneShotTextV2Request) => voiceService.plainText(data)
export const plainTextStream = (
  data: OneShotTextV2Request,
  onChunk: (text: string) => void,
  onComplete?: () => void,
  onError?: (error: string) => void
) => voiceService.plainTextStream(data, onChunk, onComplete, onError)
export const getAudioStatus = (requestId: string) => voiceService.getAudioStatus(requestId)
export const getVoiceOptions = (provider: string) => voiceService.getVoiceOptions(provider)
export const getLanguageOptions = (provider: string) => voiceService.getLanguageOptions(provider)
export const getAssistantTools = (assistantId: number) => assistantService.getAssistantTools(assistantId)
export const createAssistantTool = (assistantId: number, data: CreateToolForm) => assistantService.createAssistantTool(assistantId, data)
export const updateAssistantTool = (assistantId: number, toolId: number, data: UpdateToolForm) => assistantService.updateAssistantTool(assistantId, toolId, data)
export const deleteAssistantTool = (assistantId: number, toolId: number) => assistantService.deleteAssistantTool(assistantId, toolId)
export const testAssistantTool = (assistantId: number, toolId: number, args: Record<string, any>) => assistantService.testAssistantTool(assistantId, toolId, args)
export const getAssistantGraphData = (assistantId: number) => assistantService.getAssistantGraphData(assistantId)
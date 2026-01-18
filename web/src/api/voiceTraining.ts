import { BaseApiService } from './base.service'

// 训练文本相关接口
export interface TrainingText {
  id: number
  text_id: number
  text_name: string
  language: string
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
  text_segments: TrainingTextSegment[]
}

export interface TrainingTextSegment {
  id: number
  text_id: number
  seg_id: string
  seg_text: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

// 语音克隆相关接口
export interface VoiceClone {
  id: number
  user_id: number
  task_id: string
  task_name: string
  sex: number
  age_group: number
  language: string
  status: number
  text_id: number
  text_seg_id: number
  audio_url: string
  audio_duration: number
  audio_size: number
  train_vid: string
  asset_id: string
  failed_reason: string
  created_at: string
  updated_at: string
  deleted_at: string | null
}

// 合成历史相关接口
export interface SynthesisHistory {
  id: number
  user_id: number
  voice_clone_id: number
  text: string
  audio_url: string
  duration: number
  created_at: string
  updated_at: string
  deleted_at: string | null
}

// 创建训练任务请求
export interface CreateTaskRequest {
  task_name: string
  sex: number
  age_group: number
  language?: string
}

// 提交音频请求
export interface SubmitAudioRequest {
  task_id: string
  text_seg_id: number
  audio_file: File
}

// 查询任务状态请求
export interface QueryTaskRequest {
  task_id: string
}

// 语音合成请求
export interface SynthesizeRequest {
  voice_clone_id: number
  text: string
  language?: string
}

// 更新语音克隆请求
export interface UpdateVoiceCloneRequest {
  id: number
  task_name?: string
  sex?: number
  age_group?: number
  language?: string
}

// 删除语音克隆请求
export interface DeleteVoiceCloneRequest {
  id: number
}

class VoiceTrainingService extends BaseApiService {
  constructor() {
    super('/voice')
  }

  // 获取训练文本列表
  async getTrainingTexts(): Promise<TrainingText> {
    const response = await this.get<TrainingText>('/training-texts', {}, { enabled: true, ttl: 300000 })
    return this.handleResponse(response)
  }

  // 获取语音克隆列表
  async getVoiceClones(): Promise<VoiceClone[]> {
    const response = await this.get<VoiceClone[]>('/clones', {}, { enabled: true, ttl: 60000 })
    return this.handleResponse(response)
  }

  // 获取合成历史
  async getSynthesisHistory(): Promise<SynthesisHistory[]> {
    const response = await this.get<SynthesisHistory[]>('/synthesis/history', {}, { enabled: true, ttl: 60000 })
    return this.handleResponse(response)
  }

  // 创建训练任务
  async createTrainingTask(data: CreateTaskRequest): Promise<{ task_id: string }> {
    const response = await this.post<{ task_id: string }>('/training/create', data)
    this.invalidateCache()
    return this.handleResponse(response)
  }

  // 提交音频文件
  async submitAudio(data: SubmitAudioRequest): Promise<any> {
    const formData = new FormData()
    formData.append('task_id', data.task_id)
    formData.append('text_seg_id', data.text_seg_id.toString())
    formData.append('audio_file', data.audio_file)
    
    const response = await this.post('/training/submit-audio', formData)
    this.invalidateCache()
    return this.handleResponse(response)
  }

  // 查询任务状态
  async queryTaskStatus(data: QueryTaskRequest): Promise<VoiceClone> {
    const response = await this.get<VoiceClone>('/training/status', { params: { task_id: data.task_id } })
    return this.handleResponse(response)
  }

  // 语音合成
  async synthesizeVoice(data: SynthesizeRequest): Promise<{ audio_url: string }> {
    const response = await this.post<{ audio_url: string }>('/synthesize', data)
    return this.handleResponse(response)
  }

  // 试听语音克隆
  async auditionVoiceClone(id: number): Promise<{ audio_url: string }> {
    const response = await this.get<{ audio_url: string }>(`/clones/${id}/audition`)
    return this.handleResponse(response)
  }

  // 更新语音克隆
  async updateVoiceClone(data: UpdateVoiceCloneRequest): Promise<any> {
    const response = await this.post('/clones/update', data)
    this.invalidateCache()
    return this.handleResponse(response)
  }

  // 删除语音克隆
  async deleteVoiceClone(data: DeleteVoiceCloneRequest): Promise<any> {
    const response = await this.post('/clones/delete', data)
    this.invalidateCache()
    return this.handleResponse(response)
  }

  // 删除合成历史记录
  async deleteSynthesisRecord(id: number): Promise<any> {
    const response = await this.post('/synthesis/delete', { id })
    this.invalidateCache()
    return this.handleResponse(response)
  }
}

// 导出单例
export const voiceTrainingService = new VoiceTrainingService()

// 兼容性导出
export const getTrainingTexts = voiceTrainingService.getTrainingTexts.bind(voiceTrainingService)
export const getVoiceClones = voiceTrainingService.getVoiceClones.bind(voiceTrainingService)
export const getSynthesisHistory = voiceTrainingService.getSynthesisHistory.bind(voiceTrainingService)
export const createTrainingTask = voiceTrainingService.createTrainingTask.bind(voiceTrainingService)
export const submitAudio = voiceTrainingService.submitAudio.bind(voiceTrainingService)
export const queryTaskStatus = voiceTrainingService.queryTaskStatus.bind(voiceTrainingService)
export const synthesizeVoice = voiceTrainingService.synthesizeVoice.bind(voiceTrainingService)
export const auditionVoiceClone = voiceTrainingService.auditionVoiceClone.bind(voiceTrainingService)
export const updateVoiceClone = voiceTrainingService.updateVoiceClone.bind(voiceTrainingService)
export const deleteVoiceClone = voiceTrainingService.deleteVoiceClone.bind(voiceTrainingService)
export const deleteSynthesisRecord = voiceTrainingService.deleteSynthesisRecord.bind(voiceTrainingService)

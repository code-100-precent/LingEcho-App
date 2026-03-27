/**
 * 音色克隆 API
 */
import { get, post, ApiResponse } from '../../utils/request';

// 音色克隆接口
export interface VoiceClone {
  id: number;
  voiceName: string;
  voiceDescription?: string;
  audioUrl?: string;
  provider?: string;
  createdAt?: string;
}

// 合成记录接口
export interface SynthesisRecord {
  id: number;
  voiceCloneId: number;
  text: string;
  audioUrl: string;
  createdAt: string;
}

// 音色克隆配置
export interface VoiceCloneConfig {
  provider: string;
  config: {
    appId?: string;
    apiKey?: string;
    apiSecret?: string;
    [key: string]: any;
  };
}

/**
 * 获取音色列表
 */
export const getVoiceClones = (provider?: string): Promise<ApiResponse<VoiceClone[]>> => {
  const params = provider ? { provider } : {};
  return get('/voice/clones', { params });
};

/**
 * 更新音色信息
 */
export const updateVoiceClone = (data: {
  id: number;
  voiceName: string;
  voiceDescription?: string;
}): Promise<ApiResponse<null>> => {
  return post('/voice/clones/update', data);
};

/**
 * 删除音色
 */
export const deleteVoiceClone = (id: number): Promise<ApiResponse<null>> => {
  return post('/voice/clones/delete', { id });
};

/**
 * 合成语音
 */
export const synthesizeVoice = (data: {
  voiceCloneId: number;
  text: string;
  language?: string;
}): Promise<ApiResponse<{ audioUrl: string }>> => {
  return post('/voice/synthesize', data);
};

/**
 * 获取合成历史
 */
export const getSynthesisHistory = (provider?: string): Promise<ApiResponse<SynthesisRecord[]>> => {
  const params = provider ? { provider } : {};
  return get('/voice/synthesis/history', { params });
};

/**
 * 保存音色克隆配置
 */
export const saveVoiceCloneConfig = (data: VoiceCloneConfig): Promise<ApiResponse<null>> => {
  return post('/system/voice-clone/config', data);
};

// 训练文本段落接口
export interface TrainingTextSegment {
  id: number;
  textId: number;
  segId: string;
  segText: string;
  createdAt: string;
}

// 训练文本接口
export interface TrainingText {
  id: number;
  textId: number;
  textName: string;
  language: string;
  isActive: boolean;
  textSegments: TrainingTextSegment[];
}

// 训练任务接口
export interface TrainingTask {
  taskId: string;
  status: number; // -1=训练中, 0=失败, 1=成功, 2=排队中
  progress?: number;
  message?: string;
}

/**
 * 获取训练文本列表
 */
export const getTrainingTexts = (): Promise<ApiResponse<TrainingText[]>> => {
  return get('/voice/training-texts');
};

/**
 * 创建训练任务
 */
export const createTrainingTask = (data: {
  taskName: string;
  sex: number; // 1: female, 2: male
  ageGroup: number; // 1: child, 2: youth, 3: middle, 4: old
  language: string;
  provider?: string; // 'xunfei' | 'volcengine'
}): Promise<ApiResponse<{ taskId: string }>> => {
  return post('/voice/training/create', data);
};

/**
 * 提交训练音频
 */
export const submitTrainingAudio = (data: {
  taskId: string;
  textSegId: number;
  audio: any; // FormData
}): Promise<ApiResponse<null>> => {
  return post('/voice/training/submit-audio', data);
};

/**
 * 查询训练任务状态（朗读克隆）
 */
export const queryTrainingTask = (taskId: string): Promise<ApiResponse<TrainingTask>> => {
  return post('/voice/training/query', { taskId });
};

/**
 * 创建训练任务（音频克隆）- 自动生成 Speaker ID
 */
export const createVolcengineTask = (data: {
  taskName: string;
  language: string;
}): Promise<ApiResponse<{ taskId: string; speakerId: string }>> => {
  return post('/voice/volcengine/create', data);
};

/**
 * 提交训练音频（音频克隆）
 */
export const submitVolcengineAudio = (data: {
  audio: any; // FormData
  taskId: string;
  language: string;
}): Promise<ApiResponse<void>> => {
  return post('/voice/volcengine/submit', data.audio);
};

/**
 * 查询训练任务状态（音频克隆）
 */
export const queryVolcengineTask = (speakerId: string): Promise<ApiResponse<{
  speakerId: string;
  status: number;
  failedDesc?: string;
}>> => {
  return post('/voice/volcengine/query', { speakerId });
};

/**
 * 音频克隆语音合成
 */
export const synthesizeVolcengineVoice = (data: {
  assetId: string; // speaker_id
  text: string;
  language?: string;
}): Promise<ApiResponse<{ audioUrl: string }>> => {
  return post('/volcengine/synthesize', data);
};

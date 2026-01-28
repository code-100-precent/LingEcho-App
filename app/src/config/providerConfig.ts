/**
 * ASR 和 TTS 服务商配置
 */

export interface ProviderField {
  key: string;
  label: string;
  type: 'text' | 'password' | 'number';
  placeholder?: string;
  required?: boolean;
  description?: string;
}

export interface ProviderConfig {
  name: string;
  fields: ProviderField[];
}

// TTS 服务商配置
export const TTS_PROVIDERS: Record<string, ProviderConfig> = {
  qiniu: {
    name: '七牛云',
    fields: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        placeholder: '请输入七牛云 API Key',
        required: true,
        description: '七牛云的 API Key',
      },
      {
        key: 'baseUrl',
        label: 'Base URL',
        type: 'text',
        placeholder: 'https://openai.qiniu.com/v1',
        required: false,
        description: 'API 基础地址（可选）',
      },
    ],
  },
  qcloud: {
    name: '腾讯云',
    fields: [
      {
        key: 'appId',
        label: 'App ID',
        type: 'text',
        placeholder: '请输入腾讯云 App ID',
        required: true,
      },
      {
        key: 'secretId',
        label: 'Secret ID',
        type: 'password',
        placeholder: '请输入 Secret ID',
        required: true,
      },
      {
        key: 'secretKey',
        label: 'Secret Key',
        type: 'password',
        placeholder: '请输入 Secret Key',
        required: true,
      },
    ],
  },
  tencent: {
    name: '腾讯云（别名）',
    fields: [
      {
        key: 'appId',
        label: 'App ID',
        type: 'text',
        placeholder: '请输入腾讯云 App ID',
        required: true,
      },
      {
        key: 'secretId',
        label: 'Secret ID',
        type: 'password',
        placeholder: '请输入 Secret ID',
        required: true,
      },
      {
        key: 'secretKey',
        label: 'Secret Key',
        type: 'password',
        placeholder: '请输入 Secret Key',
        required: true,
      },
    ],
  },
  baidu: {
    name: '百度',
    fields: [
      {
        key: 'token',
        label: 'Access Token',
        type: 'password',
        placeholder: '请输入百度 Access Token',
        required: true,
      },
    ],
  },
  xunfei: {
    name: '科大讯飞',
    fields: [
      {
        key: 'appId',
        label: 'App ID',
        type: 'text',
        placeholder: '请输入讯飞 App ID',
        required: true,
      },
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        placeholder: '请输入 API Key',
        required: true,
      },
      {
        key: 'apiSecret',
        label: 'API Secret',
        type: 'password',
        placeholder: '请输入 API Secret',
        required: true,
      },
    ],
  },
  openai: {
    name: 'OpenAI',
    fields: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        placeholder: '请输入 OpenAI API Key',
        required: true,
      },
      {
        key: 'baseUrl',
        label: 'Base URL',
        type: 'text',
        placeholder: 'https://api.openai.com',
        required: false,
      },
    ],
  },
  azure: {
    name: '微软 Azure',
    fields: [
      {
        key: 'subscriptionKey',
        label: 'Subscription Key',
        type: 'password',
        placeholder: '请输入 Azure Subscription Key',
        required: true,
      },
      {
        key: 'region',
        label: 'Region',
        type: 'text',
        placeholder: 'eastasia',
        required: true,
      },
    ],
  },
  google: {
    name: 'Google Cloud',
    fields: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        placeholder: '请输入 Google API Key',
        required: true,
      },
    ],
  },
  aws: {
    name: 'Amazon AWS',
    fields: [
      {
        key: 'accessKeyId',
        label: 'Access Key ID',
        type: 'password',
        placeholder: '请输入 Access Key ID',
        required: true,
      },
      {
        key: 'secretAccessKey',
        label: 'Secret Access Key',
        type: 'password',
        placeholder: '请输入 Secret Access Key',
        required: true,
      },
      {
        key: 'region',
        label: 'Region',
        type: 'text',
        placeholder: 'us-east-1',
        required: false,
      },
    ],
  },
  volcengine: {
    name: '火山引擎',
    fields: [
      {
        key: 'appId',
        label: 'App ID',
        type: 'text',
        placeholder: '请输入火山引擎 App ID',
        required: true,
      },
      {
        key: 'accessToken',
        label: 'Access Token',
        type: 'password',
        placeholder: '请输入 Access Token',
        required: true,
      },
    ],
  },
  minimax: {
    name: 'Minimax',
    fields: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        placeholder: '请输入 Minimax API Key',
        required: true,
      },
    ],
  },
  elevenlabs: {
    name: 'ElevenLabs',
    fields: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        placeholder: '请输入 ElevenLabs API Key',
        required: true,
      },
    ],
  },
  fishspeech: {
    name: 'FishSpeech',
    fields: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        placeholder: '请输入 FishSpeech API Key',
        required: true,
      },
    ],
  },
  coqui: {
    name: 'Coqui TTS',
    fields: [
      {
        key: 'url',
        label: 'URL',
        type: 'text',
        placeholder: 'http://localhost:5002/api/tts',
        required: true,
      },
    ],
  },
  local: {
    name: '本地 TTS',
    fields: [
      {
        key: 'command',
        label: '命令',
        type: 'text',
        placeholder: 'say',
        required: false,
      },
    ],
  },
};

// ASR 服务商配置
export const ASR_PROVIDERS: Record<string, ProviderConfig> = {
  qiniu: {
    name: '七牛云',
    fields: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        placeholder: '请输入七牛云 API Key',
        required: true,
        description: '七牛云的 API Key',
      },
      {
        key: 'baseUrl',
        label: 'Base URL',
        type: 'text',
        placeholder: 'https://asr.qiniu.com',
        required: false,
        description: 'API 基础地址',
      },
    ],
  },
  qcloud: {
    name: '腾讯云',
    fields: [
      {
        key: 'appId',
        label: 'App ID',
        type: 'text',
        placeholder: '请输入腾讯云 App ID',
        required: true,
        description: '腾讯云应用 ID',
      },
      {
        key: 'secretId',
        label: 'Secret ID',
        type: 'password',
        placeholder: '请输入 Secret ID',
        required: true,
        description: '腾讯云 Secret ID',
      },
      {
        key: 'secretKey',
        label: 'Secret Key',
        type: 'password',
        placeholder: '请输入 Secret Key',
        required: true,
        description: '腾讯云 Secret Key',
      },
    ],
  },
  tencent: {
    name: '腾讯云（别名）',
    fields: [
      {
        key: 'appId',
        label: 'App ID',
        type: 'text',
        placeholder: '请输入腾讯云 App ID',
        required: true,
      },
      {
        key: 'secretId',
        label: 'Secret ID',
        type: 'password',
        placeholder: '请输入 Secret ID',
        required: true,
      },
      {
        key: 'secretKey',
        label: 'Secret Key',
        type: 'password',
        placeholder: '请输入 Secret Key',
        required: true,
      },
    ],
  },
  baidu: {
    name: '百度',
    fields: [
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        placeholder: '请输入百度 API Key',
        required: true,
      },
      {
        key: 'secretKey',
        label: 'Secret Key',
        type: 'password',
        placeholder: '请输入 Secret Key',
        required: true,
      },
    ],
  },
  azure: {
    name: '微软 Azure',
    fields: [
      {
        key: 'subscriptionKey',
        label: 'Subscription Key',
        type: 'password',
        placeholder: '请输入 Azure Subscription Key',
        required: true,
      },
      {
        key: 'region',
        label: 'Region',
        type: 'text',
        placeholder: 'eastasia',
        required: true,
      },
    ],
  },
  xunfei: {
    name: '科大讯飞',
    fields: [
      {
        key: 'appId',
        label: 'App ID',
        type: 'text',
        placeholder: '请输入讯飞 App ID',
        required: true,
      },
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        placeholder: '请输入 API Key',
        required: true,
      },
      {
        key: 'apiSecret',
        label: 'API Secret',
        type: 'password',
        placeholder: '请输入 API Secret',
        required: true,
      },
    ],
  },
};

// 获取 TTS 服务商选项
export const getTTSProviderOptions = () => {
  return Object.keys(TTS_PROVIDERS).map((key) => ({
    value: key,
    label: TTS_PROVIDERS[key].name,
  }));
};

// 获取 ASR 服务商选项
export const getASRProviderOptions = () => {
  return Object.keys(ASR_PROVIDERS).map((key) => ({
    value: key,
    label: ASR_PROVIDERS[key].name,
  }));
};

// 获取 TTS 服务商配置
export const getTTSProviderConfig = (provider: string): ProviderConfig | null => {
  return TTS_PROVIDERS[provider] || null;
};

// 获取 ASR 服务商配置
export const getASRProviderConfig = (provider: string): ProviderConfig | null => {
  return ASR_PROVIDERS[provider] || null;
};

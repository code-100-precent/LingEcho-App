import { Language } from './common'

export const voice: Record<Language, Record<string, string>> = {
  zh: {
    // VoiceAssistant 页面
    'voiceAssistant.onboarding.voiceBall': '这是语音交互的核心按钮，点击开始或结束对话',
    'voiceAssistant.onboarding.assistantList': '在这里选择您要对话的AI助手，也可以添加新的助手',
    'voiceAssistant.onboarding.chatArea': '这里将显示您与AI助手的对话历史',
    'voiceAssistant.onboarding.controlPanel': '在这里可以配置AI助手的各种参数和设置',
    'voiceAssistant.onboarding.textInput': '您也可以直接输入文本与AI助手交流',

    // ControlPanel 配置面板
    'controlPanel.api.title': '密钥配置',
    'controlPanel.api.apiKey': 'API Key',
    'controlPanel.api.apiKeyPlaceholder': '请输入 API Key',
    'controlPanel.api.apiSecret': 'API Secret',
    'controlPanel.api.apiSecretPlaceholder': '请输入 API Secret',

    'controlPanel.call.title': '通话设置',
    'controlPanel.call.language': '语言设置',
    'controlPanel.call.languagePlaceholder': '请选择语言',
    'controlPanel.call.loadingLanguages': '加载语言列表中...',
    'controlPanel.call.speaker': '发音人设置',
    'controlPanel.call.speakerPlaceholder': '请选择音色',
    'controlPanel.call.loadingVoices': '加载音色列表中...',
    'controlPanel.call.noVoices': '暂无 {provider} 平台的音色选项',
    'controlPanel.call.noProvider': '请先配置TTS Provider',
    'controlPanel.call.systemPrompt': '系统角色设定',
    'controlPanel.call.systemPromptPlaceholder': '例：你是一个专业客服，负责处理产品咨询',
    'controlPanel.call.temperature': '生成多样性 (Temperature)',
    'controlPanel.call.temperatureLabel': '多样性',
    'controlPanel.call.maxTokens': '最大回复长度 (Tokens)',
    'controlPanel.call.maxTokensPlaceholder': '最多生成多少 tokens',
    'controlPanel.call.llmModel': 'LLM 模型名称',
    'controlPanel.call.llmModelPlaceholder': '如：deepseek-v3.1, gpt-4, claude-3-opus',
    'controlPanel.call.llmModelHint': '模型名称，例如 deepseek-v3.1、gpt-4、claude-3-opus 等。如果为空，将使用凭证配置或环境变量中的模型。',

    'controlPanel.assistant.title': '助手设置',
    'controlPanel.assistant.basicInfo': '助手基本信息',
    'controlPanel.assistant.name': '助手名称',
    'controlPanel.assistant.namePlaceholder': '请输入助手名称',
    'controlPanel.assistant.description': '助手描述',
    'controlPanel.assistant.graphMemoryTitle': 'Neo4j 长期记忆',
    'controlPanel.assistant.graphMemoryDesc': '开启后，将把该助手的对话写入 Neo4j，用于个性化记忆和知识图谱。',
    'controlPanel.assistant.descriptionPlaceholder': '请输入助手描述',
    'controlPanel.assistant.icon': '选择图标',
    'controlPanel.assistant.jsTemplate': 'JS模板配置',
    'controlPanel.assistant.jsTemplatePlaceholder': '选择JS模板或使用默认模板',
    'controlPanel.assistant.jsTemplateDefault': '使用默认模板',
    'controlPanel.assistant.jsTemplateHint': '选择JS模板将自定义助手的应用接入行为',
    'controlPanel.assistant.save': '保存设置',
    'controlPanel.assistant.delete': '删除助手',

    'controlPanel.knowledge.title': '知识库配置',
    'controlPanel.knowledge.select': '选择知识库',
    'controlPanel.knowledge.none': '不使用知识库',
    'controlPanel.knowledge.current': '当前使用的知识库:',
    'controlPanel.knowledge.refresh': '刷新知识库列表',
    'controlPanel.knowledge.manage': '管理知识库',
  },
  en: {
    // VoiceAssistant page
    'voiceAssistant.onboarding.voiceBall': 'This is the core button for voice interaction, click to start or end conversation',
    'voiceAssistant.onboarding.assistantList': 'Select the AI assistant you want to talk to here, or add a new one',
    'voiceAssistant.onboarding.chatArea': 'Your conversation history with the AI assistant will be displayed here',
    'voiceAssistant.onboarding.controlPanel': 'Configure various parameters and settings for the AI assistant here',
    'voiceAssistant.onboarding.textInput': 'You can also directly input text to communicate with the AI assistant',
  },
  ja: {
    // VoiceAssistant ページ
    'voiceAssistant.onboarding.voiceBall': 'これは音声インタラクションのコアボタンです。クリックして会話を開始または終了します',
    'voiceAssistant.onboarding.assistantList': 'ここで対話したいAIアシスタントを選択するか、新しいアシスタントを追加できます',
    'voiceAssistant.onboarding.chatArea': 'AIアシスタントとの会話履歴がここに表示されます',
    'voiceAssistant.onboarding.controlPanel': 'ここでAIアシスタントの各種パラメータと設定を構成できます',
    'voiceAssistant.onboarding.textInput': 'AIアシスタントと直接テキストで交流することもできます',
  }
}
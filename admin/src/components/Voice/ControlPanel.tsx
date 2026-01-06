import React, {useEffect, useState} from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Key, Settings, AppWindow, ChevronDown, RefreshCw, ArrowRight, Bot, MessageCircle, Users, Zap, Circle } from 'lucide-react';
import { cn } from '@/utils/cn';
// TODO: 实现知识库、JS模板和语音选项相关的API调用
// import {getKnowledgeBaseByUser} from "@/api/knowledge.ts";
// import { jsTemplateService, JSTemplate } from '@/api/jsTemplate';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/UI/Select.tsx';
import Button from '@/components/UI/Button';
// import { getVoiceOptions, VoiceOption } from '@/api/assistant';

// 临时类型定义
type JSTemplate = any;
type VoiceOption = any;
import { highlightContent } from '@/utils/highlight';

interface ControlPanelProps {
  // API 配置
  apiKey: string
  apiSecret: string
  onApiKeyChange: (value: string) => void
  onApiSecretChange: (value: string) => void
  
  // TTS Provider配置
  ttsProvider?: string  // TTS平台提供商，如 "tencent", "qiniu", "baidu" 等
  
  // 通话设置
  language: string
  selectedSpeaker: string
  systemPrompt: string
  instruction: string
  temperature: number
  maxTokens: number
  speed: number
  volume: number
  llmModel: string // LLM模型名称
  
  // 设置更新函数
  onLanguageChange: (value: string) => void
  onSpeakerChange: (value: string) => void
  onSystemPromptChange: (value: string) => void
  onInstructionChange: (value: string) => void
  onTemperatureChange: (value: number) => void
  onMaxTokensChange: (value: number) => void
  onSpeedChange: (value: number) => void
  onVolumeChange: (value: number) => void
  onLlmModelChange: (value: string) => void
  
  // 助手设置
  assistantName: string
  assistantDescription: string
  assistantIcon: string
  onAssistantNameChange: (value: string) => void
  onAssistantDescriptionChange: (value: string) => void
  onAssistantIconChange: (value: string) => void
  onSaveSettings: () => void
  onDeleteAssistant: () => void
  // JS模板配置
  selectedJSTemplate: string | null
  onJSTemplateChange: (value: string) => void
  // 知识库配置
  knowledgeBases: Array<{id: string, name: string}>
  selectedKnowledgeBase: string | null
  onKnowledgeBaseChange: (value: string) => void
  onRefreshKnowledgeBases: () => void
  onManageKnowledgeBases: () => void
  // 训练音色配置
  selectedVoiceCloneId: number | null
  onVoiceCloneChange: (value: number | null) => void
  voiceClones: Array<{id: number, voice_name: string}>
  onRefreshVoiceClones: () => void
  onNavigateToVoiceTraining: () => void
  // 应用接入
  onMethodClick: (method: string) => void
  
  // 搜索高亮（可选）
  searchKeyword?: string
  highlightFragments?: Record<string, string[]> | null
  highlightResultId?: string
  
  className?: string
}
const LANGUAGES = [
  { value: 'zh-cn', label: '中文（简体）' },
  { value: 'en-us', label: '英语（美国）' },
  { value: 'ja-jp', label: '日语' },
  { value: 'ko-kr', label: '韩语' },
  { value: 'yue', label: '粤语' }
]

const PRESET_INSTRUCTIONS = [
  { title: '简洁模式', text: '请用最简洁的语言回答，不超过50字' },
  { title: '详细模式', text: '请提供详细解释，包含示例说明' },
  { title: '友好模式', text: '请使用亲切友好的语气进行对话' }
]

const ICON_MAP = {
  Bot: <Bot className="w-5 h-5" />,
  MessageCircle: <MessageCircle className="w-5 h-5" />,
  Users: <Users className="w-5 h-5" />,
  Zap: <Zap className="w-5 h-5" />,
  Circle: <Circle className="w-5 h-5" />
}

const ControlPanel: React.FC<ControlPanelProps> = ({
  apiKey,
  apiSecret,
  onApiKeyChange,
  onApiSecretChange,
  ttsProvider,
  language,
  selectedSpeaker,
  systemPrompt,
  instruction,
  temperature,
  maxTokens,
  speed,
  volume,
  llmModel,
  onLanguageChange,
  onSpeakerChange,
  onSystemPromptChange,
  onInstructionChange,
  onTemperatureChange,
  onMaxTokensChange,
  onSpeedChange,
  onVolumeChange,
  onLlmModelChange,
  assistantName,
  assistantDescription,
  assistantIcon,
  onAssistantNameChange,
  onAssistantDescriptionChange,
  onAssistantIconChange,
  onSaveSettings,
  onDeleteAssistant,
  selectedJSTemplate,
  onJSTemplateChange,
  onMethodClick,
  selectedKnowledgeBase,
  onKnowledgeBaseChange,
  selectedVoiceCloneId,
  onVoiceCloneChange,
  voiceClones,
  onRefreshVoiceClones,
  onNavigateToVoiceTraining,
  className = ''
}) => {
  const [localKnowledgeBases, setLocalKnowledgeBases] = useState<Array<{id: string, name: string}>>([]);
  const [jsTemplates, setJsTemplates] = useState<JSTemplate[]>([]);
  const [voiceOptions, setVoiceOptions] = useState<VoiceOption[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  
  const fetchKnowledgeBases = async () => {
      const response = await getKnowledgeBaseByUser(); // 移除 userId 参数
      if (response.code === 200) {
        // 修改数据转换逻辑，适应新的返回格式
        const transformedData = response.data.map((item: { name: string; key: string }) => ({
          id: item.key,
          name: item.name
        }));
        setLocalKnowledgeBases(transformedData);
      }
  };

  const fetchJSTemplates = async () => {
    try {
      const response = await jsTemplateService.getTemplates({ page: 1, limit: 100 });
      if (response.code === 200) {
        setJsTemplates(response.data.data);
      }
    } catch (error) {
      console.error('获取JS模板失败:', error);
    }
  };
  const handleRefreshKnowledgeBases = () => {
    fetchKnowledgeBases();
  };

  // 根据TTS Provider加载音色列表
  const fetchVoiceOptions = async (provider: string, currentSpeaker?: string) => {
    if (!provider) {
      setVoiceOptions([]);
      return;
    }

    setLoadingVoices(true);
    try {
      const response = await getVoiceOptions(provider);
      if (response.code === 200 && response.data?.voices) {
        setVoiceOptions(response.data.voices);
        // 如果当前选中的音色不在新列表中，重置为第一个音色
        if (currentSpeaker && !response.data.voices.find(v => v.id === currentSpeaker)) {
          if (response.data.voices.length > 0) {
            onSpeakerChange(response.data.voices[0].id);
          }
        } else if (!currentSpeaker && response.data.voices.length > 0) {
          onSpeakerChange(response.data.voices[0].id);
        }
      }
    } catch (error) {
      console.error('获取音色列表失败:', error);
      setVoiceOptions([]);
    } finally {
      setLoadingVoices(false);
    }
  };

  useEffect(() => {
    fetchKnowledgeBases();
    fetchJSTemplates();
  }, []);

  // 当TTS Provider变化时，重新加载音色列表
  useEffect(() => {
    const provider = ttsProvider || 'tencent'; // 如果没有provider，使用默认的腾讯云音色列表（向后兼容）
    fetchVoiceOptions(provider, selectedSpeaker);
  }, [ttsProvider]); // 只依赖ttsProvider，selectedSpeaker的变化不影响重新加载
  const safeKnowledgeBases = localKnowledgeBases;
  const navigate = useNavigate();
  const [expandedSections, setExpandedSections] = useState({
    api: true,
    call: true,
    assistant: true,
    integration: true,
    knowledge: true,
    voiceClone: true
})
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }))
  }

  const SectionHeader: React.FC<{
    title: string
    icon: React.ReactNode
    section: keyof typeof expandedSections
    children?: React.ReactNode
  }> = ({ title, icon, section, children }) => (
    <motion.div 
      className="flex justify-between items-center cursor-pointer group"
      onClick={() => toggleSection(section)}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-center">
        <h3 className="text-lg font-semibold flex items-center">
          {icon}
          <span className="ml-2">{title}</span>
        </h3>
        <motion.div
          animate={{ rotate: expandedSections[section] ? 0 : -90 }}
          transition={{ duration: 0.2 }}
          className="ml-2"
        >
          <ChevronDown className="w-4 h-4 text-gray-500 group-hover:text-purple-600 transition-colors" />
        </motion.div>
      </div>
      {children}
    </motion.div>
  )

  // @ts-ignore
  return (
    <div className={cn('flex-1 p-6 overflow-y-auto space-y-4 custom-scrollbar', className)}>
      <div className="space-y-6 min-h-0 max-h-[85vh]">
        {/* API 密钥配置 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <SectionHeader
            title="密钥配置"
            icon={<Key className="w-5 h-5" />}
            section="api"
          />
          
          <AnimatePresence>
            {expandedSections.api && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">API Key</label>
                    <input
                      type="text"
                      value={apiKey}
                      onChange={(e) => onApiKeyChange(e.target.value)}
                      className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-neutral-700 dark:border-neutral-600"
                      placeholder="请输入 API Key"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">API Secret</label>
                    <input
                      type="password"
                      value={apiSecret}
                      onChange={(e) => onApiSecretChange(e.target.value)}
                      className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-neutral-700 dark:border-neutral-600"
                      placeholder="请输入 API Secret"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* 通话设置 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4"
        >
          <SectionHeader
            title="通话设置"
            icon={<Settings className="w-5 h-5" />}
            section="call"
          />

          <AnimatePresence>
            {expandedSections.call && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="space-y-4 pt-4">
                  {/* 语言选择 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">语言设置</label>
                    <select
                      value={language}
                      onChange={(e) => onLanguageChange(e.target.value)}
                      className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-neutral-700 dark:border-neutral-600"
                    >
                      {LANGUAGES.map(lang => (
                        <option key={lang.value} value={lang.value}>
                          {lang.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 发音人选择 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      发音人设置
                      {ttsProvider && (
                        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                          ({ttsProvider})
                        </span>
                      )}
                    </label>
                    {loadingVoices ? (
                      <div className="w-full p-3 text-sm text-gray-500 dark:text-gray-400 text-center border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
                        加载音色列表中...
                      </div>
                    ) : voiceOptions.length > 0 ? (
                      <Select
                        value={selectedSpeaker}
                        onValueChange={onSpeakerChange}
                        className="w-full"
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="请选择音色">
                            {voiceOptions.find(v => v.id === selectedSpeaker) 
                              ? `${voiceOptions.find(v => v.id === selectedSpeaker)?.name} - ${voiceOptions.find(v => v.id === selectedSpeaker)?.description}`
                              : '请选择音色'}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {voiceOptions.map(voice => (
                            <SelectItem key={voice.id} value={voice.id}>
                              <div className="flex flex-col">
                                <span className="font-medium">{voice.name}</span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {voice.description} · {voice.type}
                                </span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="w-full p-3 text-sm text-gray-500 dark:text-gray-400 text-center border border-gray-200 dark:border-gray-700 rounded-lg bg-gray-50 dark:bg-gray-800">
                        {ttsProvider ? `暂无 ${ttsProvider} 平台的音色选项` : '请先配置TTS Provider'}
                      </div>
                    )}
                  </div>

                  {/* 系统提示词 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">系统角色设定</label>
                    <div className="space-y-1">
                      <textarea
                        value={systemPrompt}
                        onChange={(e) => onSystemPromptChange(e.target.value)}
                        className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-neutral-700 dark:border-neutral-600"
                        placeholder="例：你是一个专业客服，负责处理产品咨询"
                        rows={3}
                      />
                      {searchKeyword && systemPrompt && (
                        <div 
                          className="text-xs text-gray-400 p-2 bg-gray-50 dark:bg-neutral-800 rounded border"
                          dangerouslySetInnerHTML={{
                            __html: highlightContent(systemPrompt, searchKeyword, highlightFragments)
                          }}
                        />
                      )}
                    </div>
                  </div>

                  {/* 对话指令 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">对话指令</label>
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={instruction}
                        onChange={(e) => onInstructionChange(e.target.value)}
                        className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-neutral-700 dark:border-neutral-600"
                        placeholder="输入自定义指令..."
                      />
                      <div className="grid grid-cols-3 gap-2">
                        {PRESET_INSTRUCTIONS.map((preset, i) => (
                          <button
                            key={i}
                            onClick={() => onInstructionChange(preset.text)}
                            className="text-xs p-2 border rounded hover:bg-purple-50 dark:hover:bg-neutral-700 transition-colors"
                          >
                            {preset.title}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Temperature 控制 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">生成多样性 (Temperature)</label>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">多样性</span>
                      <span className="font-medium text-purple-600">{temperature.toFixed(1)}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1.5"
                      step="0.1"
                      value={temperature}
                      onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  {/* Max Tokens 控制 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">最大回复长度 (Tokens)</label>
                    <input
                      type="number"
                      min="10"
                      max="2048"
                      step="10"
                      value={maxTokens}
                      onChange={(e) => onMaxTokensChange(parseInt(e.target.value))}
                      className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-neutral-700 dark:border-neutral-600"
                      placeholder="最多生成多少 tokens"
                    />
                  </div>

                  {/* LLM 模型设置 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">LLM 模型名称</label>
                    <input
                      type="text"
                      value={llmModel}
                      onChange={(e) => onLlmModelChange(e.target.value)}
                      className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-neutral-700 dark:border-neutral-600"
                      placeholder="如：deepseek-v3.1, gpt-4, claude-3-opus"
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      模型名称，例如 deepseek-v3.1、gpt-4、claude-3-opus 等。如果为空，将使用凭证配置或环境变量中的模型。
                    </p>
                  </div>

                  {/* 语速控制 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">语速设置</label>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">语速</span>
                      <span className="font-medium text-purple-600">{speed.toFixed(1)}x</span>
                    </div>
                    <input
                      type="range"
                      min="0.5"
                      max="2.0"
                      step="0.1"
                      value={speed}
                      onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
                      className="w-full"
                    />
                  </div>

                  {/* 音量控制 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">音量设置</label>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">音量</span>
                      <span className="font-medium text-purple-600">{volume}</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="10"
                      step="1"
                      value={volume}
                      onChange={(e) => onVolumeChange(parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* 助手设置 */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          <SectionHeader
            title="助手设置"
            icon={<Settings className="w-5 h-5" />}
            section="assistant"
          />
          
          <AnimatePresence>
            {expandedSections.assistant && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="pt-4 border-t dark:border-neutral-700 mb-6 space-y-6">
                  {/* 助手基本信息 */}
                  <div className="space-y-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      助手基本信息
                    </label>
                    
                    <div className="space-y-2">
                    <label className="text-xs text-gray-500 dark:text-gray-400">助手名称</label>
                    <div 
                      className={`w-full p-2 text-sm border rounded-lg focus-within:ring-2 focus-within:ring-purple-500 dark:bg-neutral-700 dark:border-neutral-600 dark:text-gray-100 ${highlightResultId?.startsWith('assistant_') ? 'ring-2 ring-yellow-400' : ''}`}
                    >
                      <input
                        type="text"
                        value={assistantName}
                        onChange={(e) => onAssistantNameChange(e.target.value)}
                        className="w-full bg-transparent border-none outline-none"
                        placeholder="请输入助手名称"
                      />
                      {searchKeyword && (
                        <div 
                          className="text-xs text-gray-400 mt-1"
                          dangerouslySetInnerHTML={{
                            __html: highlightContent(assistantName, searchKeyword, highlightFragments)
                          }}
                        />
                      )}
                    </div>
                    </div>
                    
                    <div className="space-y-2">
                    <label className="text-xs text-gray-500 dark:text-gray-400">助手描述</label>
                    <div className="space-y-1">
                      <textarea
                        value={assistantDescription}
                        onChange={(e) => onAssistantDescriptionChange(e.target.value)}
                        className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-neutral-700 dark:border-neutral-600 dark:text-gray-100"
                        rows={2}
                        placeholder="请输入助手描述"
                      />
                      {searchKeyword && assistantDescription && (
                        <div 
                          className="text-xs text-gray-400 p-2 bg-gray-50 dark:bg-neutral-800 rounded border"
                          dangerouslySetInnerHTML={{
                            __html: highlightContent(assistantDescription, searchKeyword, highlightFragments)
                          }}
                        />
                      )}
                    </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-xs text-gray-500 dark:text-gray-400">选择图标</label>
                      <div className="grid grid-cols-5 gap-2">
                        {Object.keys(ICON_MAP).map(iconName => (
                          <button
                            key={iconName}
                            onClick={() => onAssistantIconChange(iconName)}
                            className={cn(
                              'p-2 rounded-lg transition-colors border-2',
                              assistantIcon === iconName
                                ? 'bg-purple-100 dark:bg-purple-900/30 border-purple-500'
                                : 'hover:bg-gray-100 dark:hover:bg-neutral-600 border-transparent'
                            )}
                          >
                            {ICON_MAP[iconName as keyof typeof ICON_MAP]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  
                  {/* JS模板选择 */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      JS模板配置
                    </label>
                    <Select value={selectedJSTemplate || ""} onValueChange={onJSTemplateChange}>
                      <SelectTrigger 
                        className="w-full h-10 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        selectedValue={
                          selectedJSTemplate ? 
                            jsTemplates.find(t => t.jsSourceId === selectedJSTemplate)?.name || '未知模板'
                            : '使用默认模板'
                        }
                      >
                        <SelectValue placeholder="选择JS模板或使用默认模板" />
                      </SelectTrigger>
                      <SelectContent className="z-50 max-h-60 overflow-auto">
                        <SelectItem value="" className="px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                              默认
                            </span>
                            使用默认模板
                          </div>
                        </SelectItem>
                        {jsTemplates.map((template) => (
                          <SelectItem key={template.id} value={template.jsSourceId} className="px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                'inline-flex items-center px-2 py-0.5 rounded text-xs font-medium',
                                template.type === 'default' 
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100'
                                  : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100'
                              )}>
                                {template.type === 'default' ? '默认' : '自定义'}
                              </span>
                              <span className="truncate">{template.name}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      选择JS模板将自定义助手的应用接入行为
                    </p>
                  </div>
                  
                  <div className="flex justify-between pt-4 border-t dark:border-neutral-700">
                    <button
                      onClick={onDeleteAssistant}
                      className="text-red-600 px-4 py-2 rounded hover:bg-red-50 dark:hover:bg-neutral-700 transition-colors"
                    >
                      删除助手
                    </button>
                    <button
                      onClick={onSaveSettings}
                      className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700 transition-colors"
                    >
                      保存设置
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
        {/* 知识库配置 */}
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="space-y-4"
        >
          <SectionHeader
              title="知识库配置"
              icon={<AppWindow className="w-5 h-5" />}
              section="knowledge"
          />

          <AnimatePresence>
            {expandedSections.knowledge && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                >
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">选择知识库</label>
                      <select
                          value={selectedKnowledgeBase || ''}
                          onChange={(e) => onKnowledgeBaseChange(e.target.value)}
                          className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-neutral-700 dark:border-neutral-600"
                      >
                        <option value="">不使用知识库</option>
                        {safeKnowledgeBases.map((kb) => (
                            <option key={kb.id} value={kb.id}>
                              {kb.name}
                            </option>
                        ))}
                      </select>
                      {selectedKnowledgeBase && localKnowledgeBases && (
                          <div className="mt-3 p-3 bg-blue-50 dark:bg-neutral-700 rounded-lg">
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              当前使用的知识库: {localKnowledgeBases.find((kb) => kb.id === selectedKnowledgeBase)?.name}
                            </p>
                          </div>
                      )}
                    </div>

                    <div className="flex space-x-2">
                      <button
                          onClick={handleRefreshKnowledgeBases}
                          className="flex-1 bg-purple-100 text-purple-700 px-3 py-2 rounded-lg text-sm hover:bg-purple-200 dark:bg-neutral-700 dark:hover:bg-neutral-600 transition-colors"
                      >
                        刷新知识库列表
                      </button>
                      <button
                          onClick={() => navigate('/knowledge')}
                          className="flex-1 bg-purple-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-purple-700 transition-colors"
                      >
                        管理知识库
                      </button>
                    </div>
                  </div>
                </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* 训练音色配置 */}
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-4"
        >
          <SectionHeader
              title="训练音色配置"
              icon={<Settings className="w-5 h-5" />}
              section="voiceClone"
          />

          <AnimatePresence>
            {expandedSections.voiceClone && (
                <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: 'easeInOut' }}
                    className="overflow-hidden"
                >
                  <div className="space-y-4 pt-4 mb-24">
                    <div className="space-y-2 mb-6">
                      <label className="text-sm font-medium text-gray-700 dark:text-gray-300">选择训练音色</label>
                      <div className="flex items-center gap-2 mb-10">
                        <Select
                            className="flex-1"
                            value={selectedVoiceCloneId?.toString() ?? ''}
                            onValueChange={(value) => onVoiceCloneChange(value === '' ? null : Number(value) || null)}
                        >
                          <SelectTrigger className="flex-1 shadow-sm">
                            <SelectValue placeholder="选择训练音色">
                              {selectedVoiceCloneId === null 
                                ? '不使用训练音色'
                                : selectedVoiceCloneId ? 
                                  voiceClones.find(vc => vc.id === selectedVoiceCloneId)?.voice_name || '未知音色'
                                  : '选择训练音色'
                              }
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem key="none" value="">
                              不使用训练音色
                            </SelectItem>
                            {voiceClones.map(vc => (
                              <SelectItem key={vc.id} value={vc.id.toString()}>
                                {vc.voice_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                        <div className="flex space-x-2 mt-6 mb-6">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={onRefreshVoiceClones}
                                leftIcon={<RefreshCw className="w-3 h-3" />}
                                className="shadow-sm hover:shadow-md"
                            >
                                刷新
                            </Button>
                            <Button
                                variant="primary"
                                size="sm"
                                onClick={onNavigateToVoiceTraining}
                                leftIcon={<ArrowRight className="w-3 h-3" />}
                                className="shadow-sm hover:shadow-md"
                            >
                                去训练
                            </Button>
                        </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        使用您训练的音色进行语音合成
                      </p>
                    </div>
                  </div>
                </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* 应用接入 */}
        <motion.div
            initial={{opacity: 0, y: 20}}
            animate={{opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="space-y-4"
        >
          <SectionHeader
            title="应用接入"
            icon={<AppWindow className="w-5 h-5" />}
            section="integration"
          />
          
          <AnimatePresence>
            {expandedSections.integration && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.3, ease: 'easeInOut' }}
                className="overflow-hidden"
              >
                <div className="pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    {/* Web应用嵌入 */}
                    <div 
                      onClick={() => onMethodClick('web')}
                      className="cursor-pointer p-4 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200 group"
                    >
                      <div className="text-center">
                        <div className="w-12 h-12 mx-auto mb-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                          <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg">
                            <path
                              d="M853.333333 170.666667H170.666667c-46.933333 0-85.333333 38.4-85.333334 85.333333v512c0 46.933333 38.4 85.333333 85.333334 85.333333h682.666666c46.933333 0 85.333333-38.4 85.333334-85.333333V256c0-46.933333-38.4-85.333333-85.333334-85.333333z m-213.333333 597.333333H170.666667v-170.666667h469.333333v170.666667z m0-213.333333H170.666667V384h469.333333v170.666667z m213.333333 213.333333h-170.666666V384h170.666666v384z"
                              fill="currentColor"></path>
                          </svg>
                        </div>
                        <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">Web应用</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">嵌入到网页中</p>
                      </div>
                    </div>

                    {/* Flutter应用集成 */}
                    <div 
                      onClick={() => onMethodClick('flutter')}
                      className="cursor-pointer p-4 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-green-300 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all duration-200 group"
                    >
                      <div className="text-center">
                        <div className="w-12 h-12 mx-auto mb-2 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition-colors">
                          <svg className="w-6 h-6 text-green-600 dark:text-green-400" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M14.5 12C14.5 13.3807 13.3807 14.5 12 14.5C10.6193 14.5 9.5 13.3807 9.5 12C9.5 10.6193 10.6193 9.5 12 9.5C13.3807 9.5 14.5 10.6193 14.5 12Z" fill="currentColor"/>
                            <path d="M12 2C13.1 2 14 2.9 14 4V8C14 9.1 13.1 10 12 10C10.9 10 10 9.1 10 8V4C10 2.9 10.9 2 12 2ZM19 8C19 12.4 15.4 16 11 16H10V18H14V20H10V18H6V16H5C0.6 16 -3 12.4 -3 8H1C1 11.3 3.7 14 7 14H17C20.3 14 23 11.3 23 8H19Z" fill="currentColor"/>
                          </svg>
                        </div>
                        <h4 className="text-sm font-medium text-gray-800 dark:text-gray-200 mb-1">Flutter应用</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400">移动端集成</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
                      💡 点击上方选项查看详细的集成方法和代码示例
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  )
}

export default ControlPanel

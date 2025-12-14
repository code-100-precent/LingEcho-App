import React, {useEffect, useState} from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Key, Settings, AppWindow, ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';
import {getKnowledgeBaseByUser} from "@/api/knowledge.ts";
import { jsTemplateService, JSTemplate } from '@/api/jsTemplate';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/UI/Select.tsx';

interface ControlPanelProps {
  // API 配置
  apiKey: string
  apiSecret: string
  onApiKeyChange: (value: string) => void
  onApiSecretChange: (value: string) => void
  
  // 通话设置
  language: string
  selectedSpeaker: string
  systemPrompt: string
  instruction: string
  temperature: number
  maxTokens: number
  speed: number
  volume: number
  
  // 设置更新函数
  onLanguageChange: (value: string) => void
  onSpeakerChange: (value: string) => void
  onSystemPromptChange: (value: string) => void
  onInstructionChange: (value: string) => void
  onTemperatureChange: (value: number) => void
  onMaxTokensChange: (value: number) => void
  onSpeedChange: (value: number) => void
  onVolumeChange: (value: number) => void
  
  // 助手设置
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
  // 应用接入
  onMethodClick: (method: string) => void
  
  className?: string
}
const LANGUAGES = [
  { value: 'zh-cn', label: '中文（简体）' },
  { value: 'en-us', label: '英语（美国）' },
  { value: 'ja-jp', label: '日语' },
  { value: 'ko-kr', label: '韩语' },
  { value: 'yue', label: '粤语' }
]
const SPEAKERS = [
  { id: '101016', name: '云希宁', description: '亲和女声', type: '女声' },
  { id: '1002', name: '云小宁', description: '年轻女声', type: '女声' },
  { id: '1005', name: '云小琳', description: '成熟女声', type: '女声' },
  { id: '1009', name: '云小杰', description: '阳光男声', type: '男声' },
  { id: '1013', name: '云小强', description: '浑厚男声', type: '男声' },
  { id: '1050', name: '云小欣', description: '甜美童声', type: '童声' },
  { id: '10051000', name: '英小娜', description: '英语女声', type: '外语' },
  { id: '101007', name: '日小葵', description: '日语女声', type: '外语' },
  { id: '101009', name: '韩小敏', description: '韩语女声', type: '外语' },
  { id: '101010', name: '粤小琳', description: '粤语女声', type: '方言' }
]

const PRESET_INSTRUCTIONS = [
  { title: '简洁模式', text: '请用最简洁的语言回答，不超过50字' },
  { title: '详细模式', text: '请提供详细解释，包含示例说明' },
  { title: '友好模式', text: '请使用亲切友好的语气进行对话' }
]

const ControlPanel: React.FC<ControlPanelProps> = ({
  apiKey,
  apiSecret,
  onApiKeyChange,
  onApiSecretChange,
  language,
  selectedSpeaker,
  systemPrompt,
  instruction,
  temperature,
  maxTokens,
  speed,
  volume,
  onLanguageChange,
  onSpeakerChange,
  onSystemPromptChange,
  onInstructionChange,
  onTemperatureChange,
  onMaxTokensChange,
  onSpeedChange,
  onVolumeChange,
  onSaveSettings,
  onDeleteAssistant,
  selectedJSTemplate,
  onJSTemplateChange,
  onMethodClick,
  selectedKnowledgeBase,
  onKnowledgeBaseChange,
  className = ''
}) => {
  const [localKnowledgeBases, setLocalKnowledgeBases] = useState<Array<{id: string, name: string}>>([]);
  const [jsTemplates, setJsTemplates] = useState<JSTemplate[]>([]);
  
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

  useEffect(() => {
    fetchKnowledgeBases();
    fetchJSTemplates();
  }, []);
  const safeKnowledgeBases = localKnowledgeBases;
  const navigate = useNavigate();
  const [expandedSections, setExpandedSections] = useState({
    api: true,
    call: true,
    assistant: true,
    integration: true,
    knowledge: true
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
      <div className="space-y-6 min-h-0 max-h-[75vh]">
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
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">发音人设置</label>
                    <select
                      value={selectedSpeaker}
                      onChange={(e) => onSpeakerChange(e.target.value)}
                      className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-neutral-700 dark:border-neutral-600"
                    >
                      {SPEAKERS.map(speaker => (
                        <option key={speaker.id} value={speaker.id}>
                          {speaker.name} - {speaker.description} ({speaker.type})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 系统提示词 */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">系统角色设定</label>
                    <textarea
                      value={systemPrompt}
                      onChange={(e) => onSystemPromptChange(e.target.value)}
                      className="w-full p-2 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500 dark:bg-neutral-700 dark:border-neutral-600"
                      placeholder="例：你是一个专业客服，负责处理产品咨询"
                      rows={3}
                    />
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
                <div className="pt-4 border-t dark:border-neutral-700 mb-10">
                  {/* JS模板选择 */}
                  <div className="mb-10">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        JS模板配置
                      </label>
                      <button
                        onClick={() => navigate('/js-templates')}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium transition-colors duration-200 flex items-center gap-1"
                      >
                        <AppWindow className="w-3 h-3" />
                        管理模板
                      </button>
                    </div>
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
                      <SelectContent className="z-50 max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
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
                              {template.id}
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
                  
                  <div className="flex justify-between">
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

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Mic, Users, Shield, Save, Plus, Trash2, User, Volume2, Bot, AlertCircle } from 'lucide-react'
import Card, { CardContent, CardHeader, CardTitle } from '@/components/UI/Card'
import Button from '@/components/UI/Button'
import Input from '@/components/UI/Input'
import Modal, { ModalContent, ModalHeader, ModalTitle } from '@/components/UI/Modal'
import { showAlert } from '@/utils/notification'
import { getSystemInit, SystemInitInfo } from '@/api/system'
import { getAssistantList, AssistantListItem } from '@/api/assistant'
import EmptyState from '@/components/UI/EmptyState'
import AudioFileUpload from '@/components/UI/AudioFileUpload'
import {
  getVoiceprints,
  registerVoiceprint,
  deleteVoiceprint,
  VoiceprintRecord
} from '@/api/voiceprint'

const VoiceprintManagement = () => {
  const [loading, setLoading] = useState(false)
  const [assistants, setAssistants] = useState<AssistantListItem[]>([])
  const [selectedAssistantId, setSelectedAssistantId] = useState<string | null>(null)
  const [systemInfo, setSystemInfo] = useState<SystemInitInfo | null>(null)
  const [voiceprints, setVoiceprints] = useState<VoiceprintRecord[]>([])
  const [showAddModal, setShowAddModal] = useState(false)
  const [newSpeaker, setNewSpeaker] = useState({ name: '', audioFile: null as File | null })

  // 获取助手列表
  useEffect(() => {
    const fetchAssistants = async () => {
      try {
        const res = await getAssistantList()
        if (res.code === 200) {
          setAssistants(res.data)
          if (res.data.length > 0 && !selectedAssistantId) {
            setSelectedAssistantId(String(res.data[0].id))
          }
        } else {
          showAlert('无法获取助手列表', 'error', '获取失败')
        }
      } catch (err: any) {
        showAlert(err?.msg || err?.message || '无法获取助手列表', 'error', '获取失败')
      }
    }
    fetchAssistants()
  }, [])

  // 加载系统配置和声纹数据
  useEffect(() => {
    loadSystemInfo()
  }, [])

  useEffect(() => {
    if (selectedAssistantId) {
      loadVoiceprints()
    }
  }, [selectedAssistantId])

  const loadSystemInfo = async () => {
    try {
      const response = await getSystemInit()
      if (response.code === 200) {
        setSystemInfo(response.data)
      }
    } catch (error) {
      console.error('Failed to load system info:', error)
      showAlert('无法获取系统配置信息', 'error', '加载失败')
    }
  }

  const loadVoiceprints = async () => {
    if (!selectedAssistantId) return
    
    setLoading(true)
    try {
      const response = await getVoiceprints(selectedAssistantId)
      if (response.code === 200) {
        setVoiceprints(response.data.voiceprints)
      } else {
        showAlert(response.msg || '无法获取声纹记录', 'error', '加载失败')
      }
    } catch (error: any) {
      console.error('Failed to load voiceprints:', error)
      showAlert(error?.msg || error?.message || '无法获取声纹记录', 'error', '加载失败')
    } finally {
      setLoading(false)
    }
  }

  const handleAddVoiceprint = async () => {
    if (!newSpeaker.name || !newSpeaker.audioFile) {
      showAlert('请填写姓名并上传音频文件', 'warning', '参数错误')
      return
    }

    if (!selectedAssistantId) {
      showAlert('请先选择助手', 'warning', '参数错误')
      return
    }

    setLoading(true)
    try {
      const response = await registerVoiceprint(
        selectedAssistantId,
        newSpeaker.name,
        newSpeaker.audioFile
      )

      if (response.code === 200) {
        const selectedAssistant = assistants.find(a => String(a.id) === selectedAssistantId)
        showAlert(`已为助手 ${selectedAssistant?.name} 注册声纹`, 'success', '注册成功')
        setShowAddModal(false)
        setNewSpeaker({ name: '', audioFile: null })
        await loadVoiceprints()
      } else {
        throw new Error(response.msg || '注册失败')
      }
    } catch (error: any) {
      showAlert(error?.msg || error?.message || '声纹注册失败', 'error', '注册失败')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteVoiceprint = async (voiceprintId: number, speakerName: string) => {
    if (!confirm(`确定要删除 ${speakerName} 的声纹吗？`)) return

    try {
      const response = await deleteVoiceprint(voiceprintId)
      if (response.code === 200) {
        showAlert(`已删除 ${speakerName} 的声纹`, 'success', '删除成功')
        await loadVoiceprints()
      } else {
        throw new Error(response.msg || '删除失败')
      }
    } catch (error: any) {
      showAlert(error?.msg || error?.message || '删除声纹失败', 'error', '删除失败')
    }
  }

  const selectedAssistant = assistants.find(a => String(a.id) === selectedAssistantId)

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-6"
      >
        {/* 页面标题 */}
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
            <Mic className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              声纹识别管理
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              为不同助手配置和管理声纹识别功能
            </p>
          </div>
        </div>

        {/* 助手选择器 - 使用按钮组样式 */}
        {assistants.length > 0 ? (
          <div className="w-full">
            <div className="flex flex-wrap gap-2 mb-6">
              {assistants.map(assistant => (
                <Button
                  key={assistant.id}
                  variant={selectedAssistantId === String(assistant.id) ? 'primary' : 'outline'}
                  size="md"
                  onClick={() => setSelectedAssistantId(String(assistant.id))}
                  leftIcon={<Bot className="w-4 h-4" />}
                  className="flex-shrink-0"
                >
                  {assistant.name}
                </Button>
              ))}
            </div>
            
            {assistants.map(assistant => (
              selectedAssistantId === String(assistant.id) && (
                <div key={assistant.id} className="space-y-6">
                  {/* 状态卡片 */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            systemInfo?.voiceprint?.configured 
                              ? 'bg-green-100 dark:bg-green-900/20' 
                              : 'bg-red-100 dark:bg-red-900/20'
                          }`}>
                            <Shield className={`w-5 h-5 ${
                              systemInfo?.voiceprint?.configured
                                ? 'text-green-600 dark:text-green-400'
                                : 'text-red-600 dark:text-red-400'
                            }`} />
                          </div>
                          <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">服务状态</p>
                            <p className="font-semibold">
                              {systemInfo?.voiceprint?.configured ? '已配置' : '未配置'}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                          </div>
                          <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">注册用户</p>
                            <p className="font-semibold">{voiceprints.length}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardContent className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                            <Volume2 className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                          </div>
                          <div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">当前助手</p>
                            <p className="font-semibold">{assistant.name}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                      声纹记录 - {assistant.name}
                    </h2>
                    <div className="flex gap-3">
                      <Button
                        variant="primary"
                        onClick={() => setShowAddModal(true)}
                        leftIcon={<Plus className="w-4 h-4" />}
                        disabled={!systemInfo?.voiceprint?.enabled}
                      >
                        添加声纹
                      </Button>
                    </div>
                  </div>

                  {/* 声纹记录列表 */}
                  <Card>
                    <CardContent className="p-6">
                      {loading ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                        </div>
                      ) : voiceprints.length === 0 ? (
                        <EmptyState
                          icon={Mic}
                          title="暂无声纹记录"
                          description={`还没有为助手 ${assistant.name} 注册任何声纹`}
                          iconClassName="text-purple-400 dark:text-purple-500"
                          action={systemInfo?.voiceprint?.enabled ? {
                            label: '添加声纹',
                            onClick: () => setShowAddModal(true)
                          } : undefined}
                        />
                      ) : (
                        <div className="space-y-4">
                          {voiceprints.map((voiceprint) => (
                            <div
                              key={voiceprint.id}
                              className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                            >
                              <div className="flex items-center gap-4">
                                <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                                  <User className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div>
                                  <h3 className="font-medium text-gray-900 dark:text-white">
                                    {voiceprint.speaker_name}
                                  </h3>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    ID: {voiceprint.speaker_id} • 注册时间: {new Date(voiceprint.created_at).toLocaleString()}
                                  </p>
                                  {voiceprint.last_used && (
                                    <p className="text-xs text-gray-500 dark:text-gray-500">
                                      最后使用: {new Date(voiceprint.last_used).toLocaleString()}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                {voiceprint.confidence && (
                                  <div className="text-right">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                      置信度: {(voiceprint.confidence * 100).toFixed(1)}%
                                    </p>
                                    <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-1">
                                      <div
                                        className="bg-purple-600 h-2 rounded-full"
                                        style={{ width: `${voiceprint.confidence * 100}%` }}
                                      />
                                    </div>
                                  </div>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteVoiceprint(voiceprint.id, voiceprint.speaker_name)}
                                  className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Bot}
            title="暂无助手"
            description="请先创建助手后再进行声纹识别管理"
            iconClassName="text-gray-400"
          />
        )}

        {/* 使用说明 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              使用说明
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                助手声纹识别功能
              </h4>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>• 每个助手都有独立的声纹识别范围，互不干扰</li>
                <li>• 在语音对话中，系统会自动识别当前助手下注册的说话人</li>
                <li>• 支持为同一个用户在不同助手下注册不同的声纹</li>
                <li>• 识别结果仅在当前助手的上下文中有效</li>
              </ul>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
              <h4 className="font-medium text-yellow-900 dark:text-yellow-100 mb-2">
                注意事项
              </h4>
              <ul className="text-sm text-yellow-800 dark:text-yellow-200 space-y-1">
                <li>• 声纹识别服务由系统管理员配置</li>
                <li>• 建议在安静环境下录制声纹样本，时长3-10秒</li>
                <li>• 音频质量会直接影响识别准确性</li>
                <li>• 删除声纹后无法恢复，请谨慎操作</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* 添加声纹模态框 */}
      <Modal isOpen={showAddModal} onClose={() => setShowAddModal(false)}>
        <ModalContent className="max-w-lg">
          <ModalHeader>
            <ModalTitle>添加声纹</ModalTitle>
          </ModalHeader>
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                说话人姓名 <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                value={newSpeaker.name}
                onChange={(e) => setNewSpeaker(prev => ({ ...prev, name: e.target.value }))}
                placeholder="输入说话人的姓名，如：张三"
                className="w-full"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                系统将自动为该说话人生成唯一标识符
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                音频文件 <span className="text-red-500">*</span>
              </label>
              <AudioFileUpload
                onFileSelect={(file) => setNewSpeaker(prev => ({ ...prev, audioFile: file }))}
                placeholder="选择WAV音频文件或拖拽到此处"
                maxSize={50}
                required
              />
              <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                  录音建议
                </h4>
                <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
                  <li>• 录音时长：3-10秒为最佳</li>
                  <li>• 环境要求：安静无噪音的环境</li>
                  <li>• 说话内容：清晰朗读一段文字</li>
                  <li>• 音频质量：采样率16kHz，单声道</li>
                </ul>
              </div>
            </div>

            <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-lg">
              <div className="flex items-start space-x-3">
                <Bot className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-amber-900 dark:text-amber-100">
                    当前助手: {selectedAssistant?.name}
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                    声纹将注册到此助手下，仅在该助手的对话中生效
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowAddModal(false)
                  setNewSpeaker({ name: '', audioFile: null })
                }}
              >
                取消
              </Button>
              <Button
                variant="primary"
                onClick={handleAddVoiceprint}
                loading={loading}
                leftIcon={<Save className="w-4 h-4" />}
                disabled={!newSpeaker.name || !newSpeaker.audioFile}
              >
                注册声纹
              </Button>
            </div>
          </div>
        </ModalContent>
      </Modal>
    </div>
  )
}

export default VoiceprintManagement
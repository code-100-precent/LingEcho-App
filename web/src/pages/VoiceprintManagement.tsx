import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Mic, Settings, Users, Shield, AlertCircle, Save } from 'lucide-react'
import Card, { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/UI/Card'
import Button from '@/components/UI/Button'
import Input from '@/components/UI/Input'
import { useToast } from '@/components/UI/ToastContainer'
import { getSystemInit, saveVoiceprintConfig, SystemInitInfo } from '@/api/system'

const VoiceprintManagement = () => {
  const toast = useToast()
  const [loading, setLoading] = useState(false)
  const [systemInfo, setSystemInfo] = useState<SystemInitInfo | null>(null)
  const [config, setConfig] = useState({
    enabled: false,
    service_url: 'http://localhost:7074',
    api_key: '',
    similarity_threshold: 0.6,
    max_candidates: 10,
    cache_enabled: true,
    log_enabled: true
  })

  // 加载系统配置
  useEffect(() => {
    loadSystemInfo()
  }, [])

  const loadSystemInfo = async () => {
    try {
      const response = await getSystemInit()
      if (response.code === 200) {
        setSystemInfo(response.data)
        
        // 如果有现有配置，加载它
        if (response.data.voiceprint?.config) {
          setConfig({
            enabled: response.data.voiceprint.enabled || false,
            service_url: response.data.voiceprint.config.service_url || 'http://localhost:7074',
            api_key: response.data.voiceprint.config.api_key || '',
            similarity_threshold: response.data.voiceprint.config.similarity_threshold || 0.6,
            max_candidates: response.data.voiceprint.config.max_candidates || 10,
            cache_enabled: response.data.voiceprint.config.cache_enabled !== false,
            log_enabled: response.data.voiceprint.config.log_enabled !== false
          })
        }
      }
    } catch (error) {
      console.error('Failed to load system info:', error)
      toast.error('加载失败', '无法获取系统配置信息')
    }
  }

  const handleSave = async () => {
    if (!config.service_url || !config.api_key) {
      toast.error('配置错误', '服务地址和API密钥不能为空')
      return
    }

    setLoading(true)
    try {
      const response = await saveVoiceprintConfig({
        enabled: config.enabled,
        config: {
          service_url: config.service_url,
          api_key: config.api_key,
          similarity_threshold: config.similarity_threshold,
          max_candidates: config.max_candidates,
          cache_enabled: config.cache_enabled,
          log_enabled: config.log_enabled
        }
      })

      if (response.code === 200) {
        toast.success('保存成功', '声纹识别配置已保存')
        // 重新加载配置
        await loadSystemInfo()
      } else {
        throw new Error(response.msg || '保存失败')
      }
    } catch (error: any) {
      toast.error('保存失败', error.message || '保存声纹识别配置失败')
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: any) => {
    setConfig(prev => ({
      ...prev,
      [field]: value
    }))
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
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
              配置和管理声纹识别功能
            </p>
          </div>
        </div>

        {/* 状态卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${
                  systemInfo?.voiceprint?.configured 
                    ? 'bg-green-100 dark:bg-green-900/20' 
                    : 'bg-red-100 dark:bg-red-900/20'
                }`}>
                  <Settings className={`w-5 h-5 ${
                    systemInfo?.voiceprint?.configured
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`} />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">配置状态</p>
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
                <div className={`p-2 rounded-lg ${
                  systemInfo?.voiceprint?.enabled 
                    ? 'bg-green-100 dark:bg-green-900/20' 
                    : 'bg-gray-100 dark:bg-gray-900/20'
                }`}>
                  <Shield className={`w-5 h-5 ${
                    systemInfo?.voiceprint?.enabled
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-gray-600 dark:text-gray-400'
                  }`} />
                </div>
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">服务状态</p>
                  <p className="font-semibold">
                    {systemInfo?.voiceprint?.enabled ? '已启用' : '已禁用'}
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
                  <p className="font-semibold">0</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 配置表单 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="w-5 h-5" />
              基础配置
            </CardTitle>
            <CardDescription>
              配置声纹识别服务的基本参数
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* 启用开关 */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white">启用声纹识别</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  开启后将在语音对话中进行声纹识别
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={config.enabled}
                  onChange={(e) => handleInputChange('enabled', e.target.checked)}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
              </label>
            </div>

            {/* 服务配置 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  服务地址
                </label>
                <Input
                  type="url"
                  value={config.service_url}
                  onChange={(e) => handleInputChange('service_url', e.target.value)}
                  placeholder="http://localhost:7074"
                  className="w-full"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  API密钥
                </label>
                <Input
                  type="password"
                  value={config.api_key}
                  onChange={(e) => handleInputChange('api_key', e.target.value)}
                  placeholder="输入API密钥"
                  className="w-full"
                />
              </div>
            </div>

            {/* 高级配置 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  相似度阈值
                </label>
                <Input
                  type="number"
                  min="0"
                  max="1"
                  step="0.1"
                  value={config.similarity_threshold}
                  onChange={(e) => handleInputChange('similarity_threshold', parseFloat(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  识别相似度阈值，范围0-1，越高越严格
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  最大候选数
                </label>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={config.max_candidates}
                  onChange={(e) => handleInputChange('max_candidates', parseInt(e.target.value))}
                  className="w-full"
                />
                <p className="text-xs text-gray-500 mt-1">
                  每次识别的最大候选人数
                </p>
              </div>
            </div>

            {/* 功能开关 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">启用缓存</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    缓存识别结果以提高性能
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={config.cache_enabled}
                    onChange={(e) => handleInputChange('cache_enabled', e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">启用日志</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    记录识别过程的详细日志
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={config.log_enabled}
                    onChange={(e) => handleInputChange('log_enabled', e.target.checked)}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                </label>
              </div>
            </div>

            {/* 保存按钮 */}
            <div className="flex justify-end pt-4 border-t border-gray-200 dark:border-gray-700">
              <Button
                variant="primary"
                onClick={handleSave}
                loading={loading}
                leftIcon={<Save className="w-4 h-4" />}
              >
                保存配置
              </Button>
            </div>
          </CardContent>
        </Card>

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
                声纹识别功能说明
              </h4>
              <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                <li>• 声纹识别可以在语音对话中自动识别说话人身份</li>
                <li>• 支持实时识别和会话开始时的身份验证</li>
                <li>• 需要先注册用户的声纹信息才能进行识别</li>
                <li>• 相似度阈值越高，识别越严格，但可能影响识别率</li>
              </ul>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
              <h4 className="font-medium text-yellow-900 dark:text-yellow-100 mb-2">
                环境要求
              </h4>
              <ul className="text-sm text-yellow-800 dark:text-yellow-200 space-y-1">
                <li>• 需要部署声纹识别服务（默认端口7074）</li>
                <li>• 确保服务地址可以正常访问</li>
                <li>• 建议在安静环境下进行声纹注册和识别</li>
                <li>• 音频质量会影响识别准确性</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}

export default VoiceprintManagement
import { useState, useEffect } from 'react'
import { 
  Key, Plus, Trash2, Download, 
  Settings, CheckCircle,
  Brain, Mic, Volume2, Globe, Lock
} from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import Button from '../components/UI/Button'
import Input from '../components/UI/Input'
import Card from '../components/UI/Card'
import Badge from '../components/UI/Badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/UI/Tabs'
import FadeIn from '../components/Animations/FadeIn'
import { showAlert } from '../utils/notification'
import { createCredential, fetchUserCredentials, deleteCredential, type Credential, type CreateCredentialForm } from '../api/credential'
import { motion, AnimatePresence } from 'framer-motion'

const CredentialManager = () => {
  const { isAuthenticated } = useAuthStore()
  const [credentials, setCredentials] = useState<Credential[]>([])
  const [isPageLoading, setIsPageLoading] = useState(true)
  const [isCreating, setIsCreating] = useState(false)
  const [activeTab, setActiveTab] = useState('list')
  const [generatedKey, setGeneratedKey] = useState<{ name: string; apiKey: string; apiSecret: string } | null>(null)
  const [form, setForm] = useState<CreateCredentialForm>({
    name: "",
    llmProvider: "",
    llmApiKey: "",
    llmApiUrl: "",
    asrProvider: "",
    asrAppId: "",
    asrSecretId: "",
    asrSecretKey: "",
    asrLanguage: "zh",
    ttsProvider: "",
    ttsAppId: "",
    ttsSecretId: "",
    ttsSecretKey: "",
  })

  // 页面加载时获取密钥列表
  useEffect(() => {
    if (!isAuthenticated) {
      setIsPageLoading(false)
      return
    }

    const fetchCredentials = async () => {
      try {
        setIsPageLoading(true)
        const response = await fetchUserCredentials()
        if (response.code === 200) {
          setCredentials(response.data)
        } else {
          throw new Error(response.msg || '获取密钥失败')
        }
      } catch (error: any) {
        // 处理API错误响应
        const errorMessage = error?.msg || error?.message || '获取密钥失败'
        showAlert(errorMessage, 'error', '加载失败')
      } finally {
        setIsPageLoading(false)
      }
    }

    fetchCredentials()
  }, [isAuthenticated])

  const handleCreate = async () => {
    if (!form.name.trim()) {
      showAlert('请输入密钥名称', 'error', '验证失败')
      return
    }

    setIsCreating(true)
    try {
      const response = await createCredential(form)
      if (response.code === 200) {
        setGeneratedKey({
          name: response.data.name,
          apiKey: response.data.apiKey,
          apiSecret: response.data.apiSecret,
        })
        showAlert('密钥已创建，请妥善保存', 'success', '创建成功')
        
        // 重新获取列表
        try {
          const listResponse = await fetchUserCredentials()
          if (listResponse.code === 200) {
            setCredentials(listResponse.data)
          }
        } catch (error: any) {
          console.error('Failed to refresh credentials list:', error)
        }
        
        // 重置表单
        setForm({
          name: "",
          llmProvider: "",
          llmApiKey: "",
          llmApiUrl: "",
          asrProvider: "",
          asrAppId: "",
          asrSecretId: "",
          asrSecretKey: "",
          asrLanguage: "zh",
          ttsProvider: "",
          ttsAppId: "",
          ttsSecretId: "",
          ttsSecretKey: "",
        })
      } else {
        throw new Error(response.msg || '创建失败')
      }
    } catch (error: any) {
      // 处理API错误响应
      const errorMessage = error?.msg || error?.message || '创建失败'
      showAlert(errorMessage, 'error', '操作失败')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async (id: number) => {
    try {
      const response = await deleteCredential(id)
      if (response.code === 200) {
        setCredentials((prev) => prev.filter((c) => c.id !== id))
        showAlert('密钥已删除', 'success', '删除成功')
      } else {
        throw new Error(response.msg || '删除失败')
      }
    } catch (error: any) {
      // 处理API错误响应
      const errorMessage = error?.msg || error?.message || '删除失败'
      showAlert(errorMessage, 'error', '操作失败')
    }
  }

  const handleFormChange = (field: keyof CreateCredentialForm, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const handleExport = () => {
    if (!generatedKey) return
    
    const blob = new Blob(
      [`Name: ${generatedKey.name}\nAPI Key: ${generatedKey.apiKey}\nAPI Secret: ${generatedKey.apiSecret}`],
      { type: "text/plain" }
    )
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${generatedKey.name || "credential"}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }



  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
            请先登录
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            您需要登录才能访问密钥管理页面
          </p>
        </div>
      </div>
    )
  }

  if (isPageLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <h1 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mb-4">
            加载中...
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400">
            正在获取您的密钥信息
          </p>
        </div>
      </div>
    )
  }

  // @ts-ignore
    return (
    <div className="min-h-screen bg-gradient-to-br from-sky-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* 头部操作栏 */}
        <FadeIn direction="down">
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Key className="w-3 h-3 mr-1" />
                <Badge variant="primary" className="text-xs">
                  密钥管理
                </Badge>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  共 {credentials.length} 个密钥
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-4 h-4" />}
                  onClick={() => setActiveTab('create')}
                >
                  创建密钥
                </Button>
              </div>
            </div>
          </div>
        </FadeIn>

        {/* 主要内容区域 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* 左侧：密钥统计卡片 */}
          <div className="lg:col-span-1">
            <FadeIn direction="left">
              <Card className="sticky top-8">
                {/* 统计信息 */}
                <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-sky-100 dark:bg-sky-900/30 rounded-lg">
                      <Key className="w-6 h-6 text-sky-600 dark:text-sky-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        密钥统计
                      </h2>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        管理您的API密钥
                      </p>
                    </div>
                  </div>
                </div>

                {/* 统计详情 */}
                <div className="p-6">
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">总密钥数</span>
                      <span className="text-sm font-mono text-gray-900 dark:text-white">#{credentials.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">LLM密钥</span>
                      <span className="text-sm text-gray-900 dark:text-white">
                        {credentials.filter(c => c.llmProvider).length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">ASR密钥</span>
                      <span className="text-sm text-gray-900 dark:text-white">
                        {credentials.filter(c => c.asrProvider).length}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600 dark:text-gray-400">TTS密钥</span>
                      <span className="text-sm text-gray-900 dark:text-white">
                        {credentials.filter(c => c.ttsProvider).length}
                      </span>
                    </div>
                  </div>
                </div>
              </Card>
            </FadeIn>
          </div>

          {/* 右侧：主要内容区域 */}
          <div className="lg:col-span-2">
            <FadeIn direction="right">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-0">
                <TabsList className="grid w-full grid-cols-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-1">
                  <TabsTrigger value="list" className="flex items-center space-x-2 text-sm py-2">
                    <Key className="w-4 h-4" />
                    <span>密钥列表</span>
                  </TabsTrigger>
                  <TabsTrigger value="create" className="flex items-center space-x-2 text-sm py-2">
                    <Plus className="w-4 h-4" />
                    <span>创建密钥</span>
                  </TabsTrigger>
                </TabsList>

                {/* 密钥列表标签页 */}
                <TabsContent value="list" className="mt-6">
                  <Card>
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">我的密钥</h3>
                        <Button
                          variant="outline"
                          size="sm"
                          leftIcon={<Plus className="w-4 h-4" />}
                          onClick={() => setActiveTab('create')}
                        >
                          新建密钥
                        </Button>
                      </div>
                      
                      {credentials.length === 0 ? (
                        <div className="text-center py-12">
                          <Key className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                          <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">暂无密钥</h4>
                          <p className="text-gray-600 dark:text-gray-400 mb-4">创建您的第一个API密钥</p>
                          <Button
                            variant="primary"
                            leftIcon={<Plus className="w-4 h-4" />}
                            onClick={() => setActiveTab('create')}
                          >
                            创建密钥
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {credentials.map((cred) => (
                            <div key={cred.id} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                              <div className="flex items-center justify-between">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center space-x-3 mb-2">
                                    <h4 className="font-medium text-gray-900 dark:text-white truncate">{cred.name}</h4>
                                    <Badge variant="secondary" className="text-xs">
                                      {cred.llmProvider || '未配置'}
                                    </Badge>
                                  </div>
                                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                                    <div>
                                      <span className="text-gray-600 dark:text-gray-400">API Key:</span>
                                      <div className="flex items-center space-x-2 mt-1">
                                        <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded">
                                          {cred.apiKey ? `${cred.apiKey.substring(0, 8)}...${cred.apiKey.substring(cred.apiKey.length - 4)}` : '••••••••••••••••'}
                                        </span>
                                      </div>
                                    </div>
                                    <div>
                                      <span className="text-gray-600 dark:text-gray-400">创建时间:</span>
                                      <div className="text-gray-900 dark:text-white">
                                        {cred.created_at ? new Date(cred.created_at).toLocaleDateString('zh-CN', {
                                          year: 'numeric',
                                          month: '2-digit',
                                          day: '2-digit',
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        }) : '未知'}
                                      </div>
                                    </div>
                                    <div>
                                      <span className="text-gray-600 dark:text-gray-400">状态:</span>
                                      <div>
                                        <Badge variant="success" className="text-xs">活跃</Badge>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2 ml-4">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    leftIcon={<Download className="w-4 h-4" />}
                                    onClick={() => {
                                      const blob = new Blob(
                                        [`Name: ${cred.name}\nAPI Key: ${cred.apiKey}\nProvider: ${cred.llmProvider || '未配置'}\nCreated: ${cred.created_at ? new Date(cred.created_at).toLocaleString('zh-CN') : '未知'}`],
                                        { type: "text/plain" }
                                      )
                                      const url = URL.createObjectURL(blob)
                                      const a = document.createElement("a")
                                      a.href = url
                                      a.download = `${cred.name}.txt`
                                      a.click()
                                      URL.revokeObjectURL(url)
                                    }}
                                  >
                                    导出
                                  </Button>
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    leftIcon={<Trash2 className="w-4 h-4" />}
                                    onClick={() => handleDelete(cred.id)}
                                  >
                                    删除
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </Card>
                </TabsContent>

                {/* 创建密钥标签页 */}
                <TabsContent value="create" className="mt-6">
                  <Card>
                    <div className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">创建新密钥</h3>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setActiveTab('list')}
                        >
                          返回列表
                        </Button>
                      </div>
                      
                      <div className="space-y-6">
                        {/* 通用设置 */}
                        <div className="space-y-4">
                          <h4 className="text-md font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 pb-2">
                            通用设置
                          </h4>
                          <Input
                            label="密钥名称"
                            value={form.name}
                            onChange={(e) => handleFormChange("name", e.target.value)}
                            leftIcon={<Key className="w-4 h-4" />}
                            placeholder="请输入密钥名称"
                          />
                        </div>

                        {/* LLM配置 */}
                        <div className="space-y-4">
                          <h4 className="text-md font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 pb-2">
                            大模型（LLM）配置
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                              label="Provider"
                              value={form.llmProvider}
                              onChange={(e) => handleFormChange("llmProvider", e.target.value)}
                              leftIcon={<Brain className="w-4 h-4" />}
                              placeholder="如：openai, anthropic"
                            />
                            <Input
                              label="API Key"
                              value={form.llmApiKey}
                              onChange={(e) => handleFormChange("llmApiKey", e.target.value)}
                              leftIcon={<Lock className="w-4 h-4" />}
                              placeholder="请输入API密钥"
                            />
                            <Input
                              label="API URL"
                              value={form.llmApiUrl}
                              onChange={(e) => handleFormChange("llmApiUrl", e.target.value)}
                              leftIcon={<Globe className="w-4 h-4" />}
                              placeholder="API端点地址"
                            />
                          </div>
                        </div>

                        {/* ASR配置 */}
                        <div className="space-y-4">
                          <h4 className="text-md font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 pb-2">
                            语音识别（ASR）配置
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                              label="Provider"
                              value={form.asrProvider}
                              onChange={(e) => handleFormChange("asrProvider", e.target.value)}
                              leftIcon={<Mic className="w-4 h-4" />}
                              placeholder="如：tencent, azure"
                            />
                            <Input
                              label="App ID"
                              value={form.asrAppId}
                              onChange={(e) => handleFormChange("asrAppId", e.target.value)}
                              leftIcon={<Settings className="w-4 h-4" />}
                              placeholder="应用ID"
                            />
                            <Input
                              label="Secret ID"
                              value={form.asrSecretId}
                              onChange={(e) => handleFormChange("asrSecretId", e.target.value)}
                              leftIcon={<Lock className="w-4 h-4" />}
                              placeholder="Secret ID"
                            />
                            <Input
                              label="Secret Key"
                              value={form.asrSecretKey}
                              onChange={(e) => handleFormChange("asrSecretKey", e.target.value)}
                              leftIcon={<Lock className="w-4 h-4" />}
                              placeholder="Secret Key"
                            />
                            <Input
                              label="语言"
                              value={form.asrLanguage}
                              onChange={(e) => handleFormChange("asrLanguage", e.target.value)}
                              leftIcon={<Globe className="w-4 h-4" />}
                              placeholder="语言代码，如：zh, en"
                            />
                          </div>
                        </div>

                        {/* TTS配置 */}
                        <div className="space-y-4">
                          <h4 className="text-md font-semibold text-gray-700 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700 pb-2">
                            语音合成（TTS）配置
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <Input
                              label="Provider"
                              value={form.ttsProvider}
                              onChange={(e) => handleFormChange("ttsProvider", e.target.value)}
                              leftIcon={<Volume2 className="w-4 h-4" />}
                              placeholder="如：tencent, azure"
                            />
                            <Input
                              label="App ID"
                              value={form.ttsAppId}
                              onChange={(e) => handleFormChange("ttsAppId", e.target.value)}
                              leftIcon={<Settings className="w-4 h-4" />}
                              placeholder="应用ID"
                            />
                            <Input
                              label="Secret ID"
                              value={form.ttsSecretId}
                              onChange={(e) => handleFormChange("ttsSecretId", e.target.value)}
                              leftIcon={<Lock className="w-4 h-4" />}
                              placeholder="Secret ID"
                            />
                            <Input
                              label="Secret Key"
                              value={form.ttsSecretKey}
                              onChange={(e) => handleFormChange("ttsSecretKey", e.target.value)}
                              leftIcon={<Lock className="w-4 h-4" />}
                              placeholder="Secret Key"
                            />
                          </div>
                        </div>

                        <div className="flex justify-end space-x-3">
                          <Button
                            variant="outline"
                            onClick={() => setActiveTab('list')}
                            disabled={isCreating}
                          >
                            取消
                          </Button>
                          <Button
                            variant="primary"
                            leftIcon={<Plus className="w-4 h-4" />}
                            onClick={handleCreate}
                            loading={isCreating}
                          >
                            {isCreating ? '创建中...' : '创建密钥'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                </TabsContent>
              </Tabs>
            </FadeIn>
          </div>
        </div>
      </div>

      {/* 密钥创建成功弹窗 */}
      <AnimatePresence>
        {generatedKey && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg max-w-md w-full mx-4"
            >
              <div className="flex items-center space-x-3 mb-4">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">密钥创建成功</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                请妥善保存以下信息：
              </p>
              <div className="space-y-3 mb-6">
                <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-md">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">API Key</div>
                  <div className="font-mono text-sm break-all">{generatedKey.apiKey}</div>
                </div>
                <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-md">
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">API Secret</div>
                  <div className="font-mono text-sm break-all">{generatedKey.apiSecret}</div>
                </div>
              </div>
              <div className="flex justify-end space-x-3">
                <Button
                  variant="outline"
                  leftIcon={<Download className="w-4 h-4" />}
                  onClick={handleExport}
                >
                  导出
                </Button>
                <Button
                  variant="primary"
                  onClick={() => setGeneratedKey(null)}
                >
                  我已保存
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default CredentialManager

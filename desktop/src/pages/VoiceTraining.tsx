import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { showAlert } from '@/utils/notification'
import Card, { CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/UI/Card'
import Input from '@/components/UI/Input'
import Button from '@/components/UI/Button'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/UI/Select'
import FileUpload from '@/components/UI/FileUpload'
import FormField from '@/components/Forms/FormField'
import { Upload, RefreshCw, Clock, Mic, History, Play, Pause, Volume2, Trash2, Edit3 } from 'lucide-react'
import { get, post } from '@/utils/request'

interface TrainingTextSegment {
    id: number
    text_id: number
    seg_id: string
    seg_text: string
    created_at: string
    updated_at: string
}

interface TrainingText {
    id: number
    text_id: number
    text_name: string
    language: string
    is_active: boolean
    created_at: string
    updated_at: string
    text_segments: TrainingTextSegment[]
}

interface TaskInfo {
    taskId: string
    status: number // 后端返回的数字状态：-1=训练中, 0=失败, 1=成功, 2=排队中
    progress?: number
    message?: string
}

interface VoiceClone {
    id: number
    voiceName: string
    voiceDescription: string
    isActive: boolean
    createdAt: string
    audioUrl?: string
}

interface SynthesisRecord {
    id: number
    voiceCloneId: number
    text: string
    audioUrl: string
    createdAt: string
}

// 状态转换函数
const getStatusInfo = (status: number) => {
    switch (status) {
        case -1: return { text: '训练中', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' }
        case 0: return { text: '失败', color: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' }
        case 1: return { text: '成功', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' }
        case 2: return { text: '排队中', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' }
        default: return { text: '未知状态', color: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400' }
    }
}

const VoiceTraining: React.FC = () => {
    const navigate = useNavigate()

    const [taskName, setTaskName] = useState('我的音色训练')
    const [sex, setSex] = useState<number>(1) // 1: female, 2: male
    const [ageGroup, setAgeGroup] = useState<number>(2) // 1: child, 2: youth, 3: middle, 4: old
    const [language, setLanguage] = useState('zh-CN')

    const [creating, setCreating] = useState(false)
    const [currentTask, setCurrentTask] = useState<TaskInfo | null>(null)
    const [uploading, setUploading] = useState(false)
    const [polling, setPolling] = useState(false)
    const [selectedTextSegment, setSelectedTextSegment] = useState<TrainingTextSegment | null>(null)

    const [trainingTexts, setTrainingTexts] = useState<TrainingText[]>([])
    const [loadingTexts, setLoadingTexts] = useState(false)

    // 音色管理相关状态
    const [voiceClones, setVoiceClones] = useState<VoiceClone[]>([])
    const [loadingClones, setLoadingClones] = useState(false)
    const [synthesisHistory, setSynthesisHistory] = useState<SynthesisRecord[]>([])
    const [loadingHistory, setLoadingHistory] = useState(false)
    const [activeTab, setActiveTab] = useState<'training' | 'clones' | 'history'>('training')

    // 音频播放相关状态
    const [playingAudio, setPlayingAudio] = useState<string | null>(null)
    const [audioRef, setAudioRef] = useState<HTMLAudioElement | null>(null)

    // 音色管理相关状态
    const [editingClone, setEditingClone] = useState<VoiceClone | null>(null)
    const [editName, setEditName] = useState('')
    const [editDescription, setEditDescription] = useState('')
    const [synthesisText, setSynthesisText] = useState('')
    const [synthesizing, setSynthesizing] = useState(false)
    


    useEffect(() => {
        refreshTrainingTexts()
        refreshVoiceClones()
        refreshSynthesisHistory()
    }, [])

    const refreshTrainingTexts = async () => {
        try {
            setLoadingTexts(true)
            const response = await get('/voice/training-texts')
            console.log('训练文本API响应:', response)

            // 处理不同的响应结构
            let list = []
            if (Array.isArray(response.data)) {
                list = response.data
            } else if (response.data && Array.isArray(response.data.data)) {
                list = response.data.data
            } else if (response.data && response.data.list) {
                list = response.data.list
            } else if (response.data && response.data.text_segments) {
                // 如果返回的是单个训练文本对象，包装成数组
                list = [response.data]
            }

            console.log('处理后的训练文本列表:', list)
            setTrainingTexts(list)
        } catch (err: any) {
            console.error('获取训练文本失败:', err)
            showAlert(err?.message || '获取训练文本失败', 'error')
        } finally {
            setLoadingTexts(false)
        }
    }


    const refreshVoiceClones = async () => {
        try {
            setLoadingClones(true)
            const response = await get('/voice/clones')
            console.log('音色列表API响应:', response)

            // 确保data是数组
            let list = []
            if (Array.isArray(response.data)) {
                list = response.data
            } else if (response.data && Array.isArray(response.data.data)) {
                list = response.data.data
            } else if (response.data && response.data.list) {
                list = response.data.list
            }

            setVoiceClones(list.map((x: any) => ({
                id: x.id ?? x.ID,
                voiceName: x.voiceName || x.voice_name || '',
                voiceDescription: x.voiceDescription || x.voice_description || '',
                isActive: x.isActive ?? x.is_active ?? false,
                createdAt: x.createdAt || x.created_at || ''
            })))
        } catch (err: any) {
            console.error('获取音色列表失败:', err)
            showAlert(err?.message || '获取音色列表失败', 'error')
        } finally {
            setLoadingClones(false)
        }
    }

    const refreshSynthesisHistory = async () => {
        try {
            setLoadingHistory(true)
            const response = await get('/voice/synthesis/history')
            console.log('合成历史API响应:', response)

            // 确保data是数组
            let list = []
            if (Array.isArray(response.data)) {
                list = response.data
            } else if (response.data && Array.isArray(response.data.data)) {
                list = response.data.data
            } else if (response.data && response.data.list) {
                list = response.data.list
            }

            setSynthesisHistory(list.map((x: any) => ({
                id: x.id ?? x.ID,
                voiceCloneId: x.voiceCloneId ?? x.voice_clone_id,
                text: x.text || '',
                audioUrl: x.audioUrl || x.audio_url || '',
                createdAt: x.createdAt || x.created_at || ''
            })))
        } catch (err: any) {
            console.error('获取合成历史失败:', err)
            showAlert(err?.message || '获取合成历史失败', 'error')
        } finally {
            setLoadingHistory(false)
        }
    }

    const deleteSynthesisRecord = async (recordId: number) => {
        try {
            await post('/voice/synthesis/delete', { id: recordId })
            showAlert('删除成功', 'success')
            refreshSynthesisHistory() // 刷新列表
        } catch (err: any) {
            console.error('删除合成记录失败:', err)
            showAlert(err?.message || '删除合成记录失败', 'error')
        }
    }

    const createTask = async () => {
        try {
            setCreating(true)
            const response = await post('/voice/training/create', { taskName, sex, ageGroup, language })
            console.log('创建任务响应:', response)

            const taskId = response.data?.task_id || response.data?.taskId
            if (!taskId) {
                console.error('响应数据:', response.data)
                throw new Error(response.msg || '返回缺少taskId')
            }
            setCurrentTask({ taskId, status: 2 }) // 2 = 排队中
            showAlert('任务创建成功', 'success')
        } catch (err: any) {
            console.error('创建任务失败:', err)
            
            // 检查是否是API错误响应，优先显示服务器返回的错误信息
            if (err.response && err.response.data) {
                const errorData = err.response.data
                if (errorData.msg) {
                    showAlert(errorData.msg, 'error')
                } else if (errorData.data) {
                    showAlert(errorData.data, 'error')
                } else {
                    showAlert(err?.message || '创建任务失败', 'error')
                }
            } else {
                showAlert(err?.message || '创建任务失败', 'error')
            }
        } finally {
            setCreating(false)
        }
    }

    const submitAudio = async (file: File) => {
        if (!currentTask?.taskId) {
            showAlert('请先创建任务', 'warning')
            return
        }
        if (!selectedTextSegment) {
            showAlert('请先选择一个训练文本段落', 'warning')
            return
        }
        try {
            setUploading(true)
            const form = new FormData()
            form.append('taskId', currentTask.taskId)
            form.append('textSegId', selectedTextSegment.id.toString())
            form.append('audio', file)
            await post('/voice/training/submit-audio', form)
            showAlert('音频上传成功', 'success')
        } catch (err: any) {
            console.error('上传音频失败:', err)
            showAlert(err?.message || '上传音频失败', 'error')
        } finally {
            setUploading(false)
        }
    }

    const queryTask = async () => {
        if (!currentTask?.taskId) {
            showAlert('请先创建任务', 'warning')
            return
        }
        try {
            const response = await post('/voice/training/query', { taskId: currentTask.taskId })
            const status = response.data?.status || 2 // 默认为排队中
            const progress = response.data?.progress
            const message = response.data?.message
            const failedReason = response.data?.failed_reason

            setCurrentTask(prev => prev ? {
                ...prev,
                status,
                progress,
                message: message || failedReason
            } : { taskId: '', status })

            // 如果训练失败，显示失败原因
            if (status === 0 && failedReason) {
                showAlert(`训练失败: ${failedReason}`, 'error')
            }

            // 如果训练成功，显示成功信息
            if (status === 1) {
                showAlert('🎉 训练成功！您现在可以使用这个音色了', 'success')
            }
        } catch (err: any) {
            console.error('查询任务失败:', err)
            showAlert(err?.message || '查询任务失败', 'error')
        }
    }

    const startPolling = () => {
        if (polling) return
        setPolling(true)
        const iv = setInterval(() => {
            queryTask()
        }, 3000)
        const stop = () => {
            clearInterval(iv)
            setPolling(false)
        }
        // 自动在组件卸载或状态变化时停止
        window.addEventListener('beforeunload', stop)
        setTimeout(() => window.removeEventListener('beforeunload', stop), 0)
    }

    // 音频播放功能
    const playAudio = (audioUrl: string) => {
        // 停止当前播放的音频
        if (audioRef) {
            audioRef.pause()
            audioRef.currentTime = 0
        }

        // 处理音频URL - 如果是相对路径，添加服务器基础URL
        let fullAudioUrl = audioUrl
        if (audioUrl.startsWith('/media/')) {
            fullAudioUrl = `http://localhost:7072${audioUrl}`
        }

        // 创建新的音频元素
        const audio = new Audio(fullAudioUrl)
        setAudioRef(audio)
        setPlayingAudio(audioUrl)

        audio.onended = () => {
            setPlayingAudio(null)
            setAudioRef(null)
        }

        audio.onerror = () => {
            showAlert('音频播放失败', 'error')
            setPlayingAudio(null)
            setAudioRef(null)
        }

        audio.play().catch(err => {
            console.error('音频播放失败:', err)
            showAlert('音频播放失败', 'error')
            setPlayingAudio(null)
            setAudioRef(null)
        })
    }

    const stopAudio = () => {
        if (audioRef) {
            audioRef.pause()
            audioRef.currentTime = 0
        }
        setPlayingAudio(null)
        setAudioRef(null)
    }

    // 清理音频资源
    useEffect(() => {
        return () => {
            if (audioRef) {
                audioRef.pause()
                audioRef.currentTime = 0
            }
        }
    }, [audioRef])

    // 音色试听功能
    const auditionVoice = async (clone: VoiceClone) => {
        if (!clone.audioUrl) {
            showAlert('该音色没有试听音频', 'warning')
            return
        }
        
        playAudio(clone.audioUrl)
    }

    // 编辑音色功能
    const editVoice = (clone: VoiceClone) => {
        setEditingClone(clone)
        setEditName(clone.voiceName)
        setEditDescription(clone.voiceDescription)
    }

    // 保存编辑
    const saveEdit = async () => {
        if (!editingClone) return
        
        try {
            await post('/voice/clones/update', {
                id: editingClone.id,
                voiceName: editName,
                voiceDescription: editDescription
            })
            
            showAlert('音色信息更新成功', 'success')
            setEditingClone(null)
            setEditName('')
            setEditDescription('')
            refreshVoiceClones()
        } catch (err: any) {
            console.error('更新音色失败:', err)
            showAlert(err?.message || '更新音色失败', 'error')
        }
    }

    // 删除音色功能
    const deleteVoice = async (clone: VoiceClone) => {
        if (!confirm(`确定要删除音色"${clone.voiceName}"吗？此操作不可恢复。`)) {
            return
        }
        
        try {
            await post('/voice/clones/delete', { id: clone.id })
            showAlert('音色删除成功', 'success')
            refreshVoiceClones()
        } catch (err: any) {
            console.error('删除音色失败:', err)
            showAlert(err?.message || '删除音色失败', 'error')
        }
    }

    // 合成语音功能
    const synthesizeVoice = async (clone: VoiceClone) => {
        if (!synthesisText.trim()) {
            showAlert('请输入要合成的文本', 'warning')
            return
        }
        
        try {
            setSynthesizing(true)
            await post('/voice/synthesize', {
                voiceCloneId: clone.id,
                text: synthesisText,
                language: 'zh-CN'
            })
            
            showAlert('语音合成成功', 'success')
            setSynthesisText('')
            refreshSynthesisHistory()
        } catch (err: any) {
            console.error('语音合成失败:', err)
            showAlert(err?.message || '语音合成失败', 'error')
        } finally {
            setSynthesizing(false)
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-sky-50 via-cyan-50 to-teal-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
            {/* 背景装饰 */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-sky-400/20 to-cyan-400/20 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-tr from-cyan-400/20 to-teal-400/20 rounded-full blur-3xl"></div>
            </div>

            <div className="relative max-w-6xl mx-auto p-6">
                {/* 页面头部 */}
                <div className="flex items-center justify-between mb-8">
                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold bg-gradient-to-r from-sky-600 to-cyan-600 bg-clip-text text-foreground">
                            训练我的专属音色
                        </h1>
                        <p className="text-gray-600 dark:text-gray-400 text-sm">
                            使用AI技术，打造属于您的独特声音
                        </p>
                    </div>
                    <div className="flex items-center gap-4">
                        <Button
                            variant="outline"
                            size="md"
                            onClick={() => navigate(-1)}
                            className="shadow-lg hover:shadow-xl transition-all duration-300"
                        >
                            返回
                        </Button>
                    </div>
                </div>

                {/* 标签页导航 */}
                <div className="flex space-x-1 mb-8 bg-gray-100 dark:bg-neutral-700 p-1 rounded-xl">
                    <button
                        onClick={() => setActiveTab('training')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-300 ${
                            activeTab === 'training'
                                ? 'bg-white dark:bg-neutral-800 text-sky-600 dark:text-sky-400 shadow-lg'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                        }`}
                    >
                        <Upload className="w-4 h-4" />
                        音色训练
                    </button>
                    <button
                        onClick={() => setActiveTab('clones')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-300 ${
                            activeTab === 'clones'
                                ? 'bg-white dark:bg-neutral-800 text-sky-600 dark:text-sky-400 shadow-lg'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                        }`}
                    >
                        <Mic className="w-4 h-4" />
                        我的音色
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all duration-300 ${
                            activeTab === 'history'
                                ? 'bg-white dark:bg-neutral-800 text-sky-600 dark:text-sky-400 shadow-lg'
                                : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
                        }`}
                    >
                        <History className="w-4 h-4" />
                        合成历史
                    </button>
                </div>

                {/* 音色训练标签页 */}
                {activeTab === 'training' && (
                    <div className="grid lg:grid-cols-2 gap-8">
                        <Card
                            variant="elevated"
                            padding="lg"
                            className="backdrop-blur-sm bg-white/80 dark:bg-neutral-800/80 border-0 shadow-2xl hover:shadow-3xl transition-all duration-500"
                            animation="fade"
                            delay={0.1}
                        >
                            <CardHeader>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 bg-gradient-to-br from-sky-500 to-cyan-600 rounded-xl flex items-center justify-center">
                                        <Upload className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-xl">创建训练任务</CardTitle>
                                        <CardDescription className="text-sm">设置音色训练的基本参数</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <FormField label="任务名称" required>
                                    <Input
                                        value={taskName}
                                        onValueChange={setTaskName}
                                        placeholder="请输入任务名称"
                                        size="md"
                                    />
                                </FormField>

                                <div className="grid grid-cols-2 gap-4">
                                    <FormField label="性别" required>
                                        <Select value={sex.toString()} onValueChange={(value) => setSex(parseInt(value))}>
                                            <SelectTrigger selectedValue={sex === 1 ? '女' : '男'}> {/* Render selected value as text */}
                                                <SelectValue placeholder="选择性别" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="1">女</SelectItem>
                                                <SelectItem value="2">男</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormField>

                                    <FormField label="年龄段" required>
                                        <Select value={ageGroup.toString()} onValueChange={(value) => setAgeGroup(parseInt(value))}>
                                            <SelectTrigger selectedValue={
                                                ageGroup === 1 ? '儿童' :
                                                    ageGroup === 2 ? '青年' :
                                                        ageGroup === 3 ? '中年' : '老年'
                                            }> {/* Render selected value as text */}
                                                <SelectValue placeholder="选择年龄段" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="1">儿童</SelectItem>
                                                <SelectItem value="2">青年</SelectItem>
                                                <SelectItem value="3">中年</SelectItem>
                                                <SelectItem value="4">老年</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </FormField>
                                </div>

                                <FormField label="语言" required>
                                    <Input
                                        value={language}
                                        onValueChange={setLanguage}
                                        placeholder="请输入语言代码"
                                        size="md"
                                    />
                                </FormField>
                            </CardContent>
                            <CardFooter>
                                <Button
                                    onClick={createTask}
                                    loading={creating}
                                    variant="primary"
                                    size="lg"
                                    fullWidth
                                    leftIcon={<Upload className="w-4 h-4" />}
                                >
                                    {creating ? '创建中...' : '创建任务'}
                                </Button>
                            </CardFooter>
                            {currentTask && (
                                <Card
                                    variant="outlined"
                                    padding="sm"
                                    className="mt-6 border-0 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 shadow-lg"
                                >
                                    <CardContent>
                                        <div className="space-y-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                                                    <Clock className="w-4 h-4 text-white" />
                                                </div>
                                                <span className="text-sm font-semibold text-green-700 dark:text-green-300">任务状态</span>
                                            </div>
                                            <div className="space-y-3">
                                                <div className="flex justify-between items-center p-3 bg-white/50 dark:bg-neutral-800/50 rounded-lg">
                                                    <span className="text-sm text-gray-600 dark:text-gray-400">任务ID</span>
                                                    <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded text-gray-800 dark:text-gray-200">
                          {currentTask.taskId}
                        </span>
                                                </div>
                                                <div className="flex justify-between items-center p-3 bg-white/50 dark:bg-neutral-800/50 rounded-lg">
                                                    <span className="text-sm text-gray-600 dark:text-gray-400">状态</span>
                                                    <div className="flex items-center gap-2">
                          <span className={`text-sm font-medium px-2 py-1 rounded-full ${getStatusInfo(currentTask.status).color}`}>
                            {getStatusInfo(currentTask.status).text}
                          </span>
                                                        {currentTask.progress != null && (
                                                            <span className="text-xs bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 px-2 py-1 rounded-full">
                              {currentTask.progress}%
                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                {currentTask.progress != null && currentTask.progress > 0 && (
                                                    <div className="p-3 bg-white/50 dark:bg-neutral-800/50 rounded-lg">
                                                        <div className="flex justify-between items-center mb-2">
                                                            <span className="text-xs text-gray-600 dark:text-gray-400">训练进度</span>
                                                            <span className="text-xs text-gray-600 dark:text-gray-400">{currentTask.progress}%</span>
                                                        </div>
                                                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                                                            <div
                                                                className="bg-gradient-to-r from-sky-500 to-cyan-600 h-2 rounded-full transition-all duration-500 ease-out"
                                                                style={{ width: `${currentTask.progress}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* 状态说明和下一步指导 */}
                                                <div className="p-3 bg-sky-50 dark:bg-sky-900/20 rounded-lg">
                                                    <div className="flex items-start gap-3">
                                                        <div className="flex-shrink-0 w-6 h-6 bg-sky-100 dark:bg-sky-900/30 rounded-full flex items-center justify-center">
                                                            <span className="text-sky-600 dark:text-sky-400 text-sm">ℹ</span>
                                                        </div>
                                                        <div className="flex-1">
                                                            <h4 className="text-sm font-medium text-sky-900 dark:text-sky-100 mb-1">
                                                                {getStatusInfo(currentTask.status).text} - 下一步操作
                                                            </h4>
                                                            <div className="text-sm text-sky-700 dark:text-sky-300">
                                                                {currentTask.status === 2 && (
                                                                    <p>任务已创建并排队中，请上传音频文件开始训练。点击下方"选择音频文件"按钮上传您的录音。</p>
                                                                )}
                                                                {currentTask.status === -1 && (
                                                                    <p>训练正在进行中，请耐心等待。系统会自动更新进度，完成后您将收到通知。</p>
                                                                )}
                                                                {currentTask.status === 1 && (
                                                                    <p>🎉 训练成功完成！您现在可以在"我的音色"页面查看和管理您的音色。</p>
                                                                )}
                                                                {currentTask.status === 0 && (
                                                                    <p>训练失败，请检查音频文件质量或重新上传。如有问题请联系技术支持。</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>

                                                {currentTask.message && (
                                                    <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                                        <div className="text-xs text-yellow-700 dark:text-yellow-300">
                                                            <span className="font-medium">说明：</span>
                                                            {currentTask.message}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex gap-3 pt-2">
                                                <Button
                                                    onClick={queryTask}
                                                    variant="outline"
                                                    size="sm"
                                                    leftIcon={<RefreshCw className="w-3 h-3" />}
                                                    className="flex-1 shadow-sm hover:shadow-md transition-all duration-300"
                                                >
                                                    查询状态
                                                </Button>
                                                <Button
                                                    onClick={startPolling}
                                                    variant="primary"
                                                    size="sm"
                                                    leftIcon={<Clock className="w-3 h-3" />}
                                                    className="flex-1 shadow-sm hover:shadow-md transition-all duration-300"
                                                >
                                                    开始轮询
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}
                        </Card>

                        <Card
                            variant="elevated"
                            padding="lg"
                            className="backdrop-blur-sm bg-white/80 dark:bg-neutral-800/80 border-0 shadow-2xl hover:shadow-3xl transition-all duration-500"
                            animation="fade"
                            delay={0.2}
                        >
                            <CardHeader>
                                <div className="flex items-center gap-3 mb-2">
                                    <div className="w-10 h-10 bg-gradient-to-br from-sky-500 to-cyan-600 rounded-xl flex items-center justify-center">
                                        <Upload className="w-5 h-5 text-white" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-xl">上传训练音频</CardTitle>
                                        <CardDescription className="text-sm">上传高质量的音频文件进行音色训练</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="p-4 bg-gradient-to-r from-sky-50 to-cyan-50 dark:from-sky-900/20 dark:to-cyan-900/20 rounded-xl border border-sky-200/50 dark:border-sky-800/50 shadow-sm">
                                    <div className="text-sm text-sky-700 dark:text-sky-300">
                                        <div className="font-semibold mb-3 flex items-center gap-2">
                                            <div className="w-2 h-2 bg-sky-500 rounded-full"></div>
                                            音频要求
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-sky-600 dark:text-sky-400">
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 bg-sky-400 rounded-full"></div>
                                                <span>安静环境录制</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 bg-sky-400 rounded-full"></div>
                                                <span>16kHz采样率</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 bg-sky-400 rounded-full"></div>
                                                <span>单声道</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-1.5 h-1.5 bg-sky-400 rounded-full"></div>
                                                <span>每段10~30秒</span>
                                            </div>
                                            <div className="flex items-center gap-2 sm:col-span-2">
                                                <div className="w-1.5 h-1.5 bg-sky-400 rounded-full"></div>
                                                <span>多段覆盖不同文本</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 选中的训练文本段落 */}
                                {selectedTextSegment && (
                                    <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 mb-4">
                                        <div className="flex items-start gap-3">
                                            <div className="flex-shrink-0 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                                                <span className="text-xs text-white">✓</span>
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="text-sm font-medium text-green-900 dark:text-green-100 mb-1">
                                                    已选择训练文本段落
                                                </h4>
                                                <p className="text-sm text-green-700 dark:text-green-300 leading-relaxed">
                                                    {selectedTextSegment.seg_text}
                                                </p>
                                                <p className="text-xs text-green-600 dark:text-green-400 mt-2">
                                                    请录制这段文本的音频，然后上传音频文件开始训练。
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {!selectedTextSegment && (
                                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800 mb-4">
                                        <div className="flex items-start gap-3">
                                            <div className="flex-shrink-0 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center">
                                                <span className="text-xs text-white">!</span>
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="text-sm font-medium text-yellow-900 dark:text-yellow-100 mb-1">
                                                    请先选择训练文本段落
                                                </h4>
                                                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                                                    在上方选择一个训练文本段落，然后录制对应的音频文件。
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <FileUpload
                                    onFileSelect={(files) => {
                                        if (files.length > 0) {
                                            submitAudio(files[0])
                                        }
                                    }}
                                    accept="audio/*"
                                    multiple={false}
                                    maxSize={50}
                                    maxFiles={1}
                                    label="选择音频文件"
                                    disabled={uploading || !selectedTextSegment}
                                />
                            </CardContent>
                        </Card>


                        <Card
                            variant="elevated"
                            padding="lg"
                            className="mt-8 backdrop-blur-sm bg-white/80 dark:bg-neutral-800/80 border-0 shadow-2xl hover:shadow-3xl transition-all duration-500"
                            animation="fade"
                            delay={0.3}
                        >
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                                            <RefreshCw className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-xl">训练文本</CardTitle>
                                            <CardDescription className="text-sm">系统提供的训练文本，可用于录制音频</CardDescription>
                                        </div>
                                    </div>
                                    <Button
                                        onClick={refreshTrainingTexts}
                                        variant="outline"
                                        size="sm"
                                        loading={loadingTexts}
                                        leftIcon={<RefreshCw className="w-4 h-4" />}
                                        className="shadow-lg hover:shadow-xl transition-all duration-300"
                                    >
                                        刷新
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3 max-h-64 overflow-auto">
                                    {loadingTexts ? (
                                        <div className="flex items-center justify-center py-12">
                                            <div className="text-center">
                                                <div className="w-12 h-12 bg-gradient-to-br from-sky-500 to-cyan-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <RefreshCw className="w-6 h-6 text-white animate-spin" />
                                                </div>
                                                <div className="text-sm text-gray-500">正在加载训练文本...</div>
                                            </div>
                                        </div>
                                    ) : trainingTexts.length === 0 ? (
                                        <div className="flex items-center justify-center py-12">
                                            <div className="text-center">
                                                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <RefreshCw className="w-6 h-6 text-gray-400" />
                                                </div>
                                                <div className="text-sm text-gray-500">暂无训练文本</div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {trainingTexts.map((text, textIndex) => (
                                                <div key={text.id} className="space-y-3">
                                                    <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-sky-50 to-cyan-50 dark:from-sky-900/20 dark:to-cyan-900/20 rounded-lg border border-sky-200 dark:border-sky-800">
                                                        <div className="w-8 h-8 bg-gradient-to-br from-sky-500 to-cyan-600 rounded-full flex items-center justify-center shadow-lg">
                          <span className="text-xs font-bold text-white">
                            {textIndex + 1}
                          </span>
                                                        </div>
                                                        <div className="flex-1">
                                                            <h4 className="font-medium text-blue-900 dark:text-blue-100">{text.text_name}</h4>
                                                            <p className="text-sm text-blue-700 dark:text-blue-300">包含 {text.text_segments?.length || 0} 个训练段落</p>
                                                        </div>
                                                    </div>

                                                    {text.text_segments && text.text_segments.length > 0 && (
                                                        <div className="grid gap-2 ml-4">
                                                            {text.text_segments.map((segment, segmentIndex) => (
                                                                <Card
                                                                    key={segment.id}
                                                                    variant="outlined"
                                                                    padding="sm"
                                                                    className={`cursor-pointer transition-all duration-300 hover:shadow-lg hover:scale-[1.02] ${
                                                                        selectedTextSegment?.id === segment.id
                                                                            ? 'border-sky-500 bg-sky-50 dark:bg-sky-900/20 shadow-lg'
                                                                            : 'border-gray-200 dark:border-gray-700 hover:border-sky-300 dark:hover:border-sky-600'
                                                                    }`}
                                                                    onClick={() => setSelectedTextSegment(segment)}
                                                                >
                                                                    <CardContent>
                                                                        <div className="flex items-start gap-3">
                                                                            <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                                                                                selectedTextSegment?.id === segment.id
                                                                                    ? 'bg-sky-500 text-white'
                                                                                    : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                                                                            }`}>
                                                                                {selectedTextSegment?.id === segment.id ? (
                                                                                    <span className="text-xs">✓</span>
                                                                                ) : (
                                                                                    <span className="text-xs">{segmentIndex + 1}</span>
                                                                                )}
                                                                            </div>
                                                                            <div className="flex-1 text-sm text-gray-800 dark:text-gray-100 leading-relaxed">
                                                                                {segment.seg_text}
                                                                            </div>
                                                                        </div>
                                                                    </CardContent>
                                                                </Card>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {/* 我的音色标签页 */}
                {activeTab === 'clones' && (
                    <div className="space-y-6">
                        <Card
                            variant="elevated"
                            padding="lg"
                            className="backdrop-blur-sm bg-white/80 dark:bg-neutral-800/80 border-0 shadow-2xl"
                        >
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gradient-to-br from-sky-500 to-cyan-600 rounded-xl flex items-center justify-center">
                                            <Mic className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-xl">我的音色</CardTitle>
                                            <CardDescription className="text-sm">管理您已训练的音色模型</CardDescription>
                                        </div>
                                    </div>
                                    <Button
                                        onClick={refreshVoiceClones}
                                        variant="outline"
                                        size="sm"
                                        loading={loadingClones}
                                        leftIcon={<RefreshCw className="w-4 h-4" />}
                                        className="shadow-lg hover:shadow-xl transition-all duration-300"
                                    >
                                        刷新
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {loadingClones ? (
                                        <div className="flex items-center justify-center py-12">
                                            <div className="text-center">
                                                <div className="w-12 h-12 bg-gradient-to-br from-sky-500 to-cyan-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <RefreshCw className="w-6 h-6 text-white animate-spin" />
                                                </div>
                                                <div className="text-sm text-gray-500">正在加载音色列表...</div>
                                            </div>
                                        </div>
                                    ) : voiceClones.length === 0 ? (
                                        <div className="flex items-center justify-center py-12">
                                            <div className="text-center">
                                                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <Mic className="w-6 h-6 text-gray-400" />
                                                </div>
                                                <div className="text-sm text-gray-500">暂无训练的音色</div>
                                                <div className="text-xs text-gray-400 mt-2">请先完成音色训练</div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                            {voiceClones.map((clone) => (
                                                <Card
                                                    key={clone.id}
                                                    variant="outlined"
                                                    padding="md"
                                                    className="hover:shadow-lg hover:scale-[1.02] transition-all duration-300 border-0 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20"
                                                >
                                                    <CardContent>
                                                        <div className="space-y-3">
                                                            <div className="flex items-start justify-between">
                                                                <div className="flex-1">
                                                                    <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                                                                        {clone.voiceName}
                                                                    </h3>
                                                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                                                                        {clone.voiceDescription || '暂无描述'}
                                                                    </p>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    {clone.isActive ? (
                                                                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                                                    ) : (
                                                                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                            <div className="text-xs text-gray-500">
                                                                {new Date(clone.createdAt).toLocaleDateString()}
                                                            </div>
                                                            <div className="flex gap-2">
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="flex-1 text-xs"
                                                                    leftIcon={<Play className="w-3 h-3" />}
                                                                    onClick={() => auditionVoice(clone)}
                                                                >
                                                                    试听
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="flex-1 text-xs"
                                                                    leftIcon={<Edit3 className="w-3 h-3" />}
                                                                    onClick={() => editVoice(clone)}
                                                                >
                                                                    编辑
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    className="text-xs text-red-600 hover:text-red-700"
                                                                    leftIcon={<Trash2 className="w-3 h-3" />}
                                                                    onClick={() => deleteVoice(clone)}
                                                                >
                                                                    删除
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* 编辑音色模态框 */}
                        {editingClone && (
                            <Card
                                variant="elevated"
                                padding="lg"
                                className="mt-6 backdrop-blur-sm bg-white/80 dark:bg-neutral-800/80 border-0 shadow-2xl"
                            >
                                <CardHeader>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gradient-to-br from-sky-500 to-cyan-600 rounded-xl flex items-center justify-center">
                                            <Edit3 className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-xl">编辑音色信息</CardTitle>
                                            <CardDescription className="text-sm">修改音色的名称和描述</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <FormField label="音色名称" required>
                                        <Input
                                            value={editName}
                                            onValueChange={setEditName}
                                            placeholder="请输入音色名称"
                                            size="md"
                                        />
                                    </FormField>
                                    <FormField label="音色描述">
                                        <Input
                                            value={editDescription}
                                            onValueChange={setEditDescription}
                                            placeholder="请输入音色描述"
                                            size="md"
                                        />
                                    </FormField>
                                </CardContent>
                                <CardFooter className="flex gap-3">
                                    <Button
                                        onClick={saveEdit}
                                        variant="primary"
                                        size="md"
                                        leftIcon={<Edit3 className="w-4 h-4" />}
                                        className="flex-1"
                                    >
                                        保存修改
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            setEditingClone(null)
                                            setEditName('')
                                            setEditDescription('')
                                        }}
                                        variant="outline"
                                        size="md"
                                        className="flex-1"
                                    >
                                        取消
                                    </Button>
                                </CardFooter>
                            </Card>
                        )}

                        {/* 合成语音功能 */}
                        {voiceClones.length > 0 && (
                            <Card
                                variant="elevated"
                                padding="lg"
                                className="mt-6 backdrop-blur-sm bg-white/80 dark:bg-neutral-800/80 border-0 shadow-2xl"
                            >
                                <CardHeader>
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                                            <Volume2 className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-xl">合成语音</CardTitle>
                                            <CardDescription className="text-sm">使用您的音色合成语音</CardDescription>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <FormField label="合成文本" required>
                                        <Input
                                            value={synthesisText}
                                            onValueChange={setSynthesisText}
                                            placeholder="请输入要合成的文本"
                                            size="md"
                                        />
                                    </FormField>
                                </CardContent>
                                <CardFooter>
                                    <Button
                                        onClick={() => {
                                            const selectedClone = voiceClones[0] // 简化处理，使用第一个音色
                                            synthesizeVoice(selectedClone)
                                        }}
                                        loading={synthesizing}
                                        variant="primary"
                                        size="lg"
                                        fullWidth
                                        leftIcon={<Volume2 className="w-4 h-4" />}
                                    >
                                        {synthesizing ? '合成中...' : '开始合成'}
                                    </Button>
                                </CardFooter>
                            </Card>
                        )}
                    </div>
                )}

                {/* 合成历史标签页 */}
                {activeTab === 'history' && (
                    <div className="space-y-6">
                        <Card
                            variant="elevated"
                            padding="lg"
                            className="backdrop-blur-sm bg-white/80 dark:bg-neutral-800/80 border-0 shadow-2xl"
                        >
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center">
                                            <History className="w-5 h-5 text-white" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-xl">合成历史</CardTitle>
                                            <CardDescription className="text-sm">查看您的语音合成记录</CardDescription>
                                        </div>
                                    </div>
                                    <Button
                                        onClick={refreshSynthesisHistory}
                                        variant="outline"
                                        size="sm"
                                        loading={loadingHistory}
                                        leftIcon={<RefreshCw className="w-4 h-4" />}
                                        className="shadow-lg hover:shadow-xl transition-all duration-300"
                                    >
                                        刷新
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {loadingHistory ? (
                                        <div className="flex items-center justify-center py-12">
                                            <div className="text-center">
                                                <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <RefreshCw className="w-6 h-6 text-white animate-spin" />
                                                </div>
                                                <div className="text-sm text-gray-500">正在加载合成历史...</div>
                                            </div>
                                        </div>
                                    ) : synthesisHistory.length === 0 ? (
                                        <div className="flex items-center justify-center py-12">
                                            <div className="text-center">
                                                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                                                    <History className="w-6 h-6 text-gray-400" />
                                                </div>
                                                <div className="text-sm text-gray-500">暂无合成记录</div>
                                                <div className="text-xs text-gray-400 mt-2">开始使用音色进行语音合成吧</div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {synthesisHistory.map((record) => (
                                                <Card
                                                    key={record.id}
                                                    variant="outlined"
                                                    padding="md"
                                                    className="hover:shadow-lg hover:scale-[1.01] transition-all duration-300 border-0 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20"
                                                >
                                                    <CardContent>
                                                        <div className="flex items-start gap-4">
                                                            <div className="flex-shrink-0 w-10 h-10 bg-gradient-to-br from-green-500 to-emerald-600 rounded-full flex items-center justify-center">
                                                                <Volume2 className="w-5 h-5 text-white" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-start justify-between">
                                                                    <div className="flex-1">
                                                                        <p className="text-sm text-gray-800 dark:text-gray-100 line-clamp-2">
                                                                            {record.text}
                                                                        </p>
                                                                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                                                                            <span>音色ID: {record.voiceCloneId}</span>
                                                                            <span>{new Date(record.createdAt).toLocaleString()}</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 ml-4">
                                                                        {record.audioUrl ? (
                                                                            <Button
                                                                                size="sm"
                                                                                variant="outline"
                                                                                className="text-xs"
                                                                                onClick={() => {
                                                                                    if (playingAudio === record.audioUrl) {
                                                                                        stopAudio()
                                                                                    } else {
                                                                                        playAudio(record.audioUrl)
                                                                                    }
                                                                                }}
                                                                                leftIcon={
                                                                                    playingAudio === record.audioUrl ?
                                                                                        <Pause className="w-3 h-3" /> :
                                                                                        <Play className="w-3 h-3" />
                                                                                }
                                                                            >
                                                                                {playingAudio === record.audioUrl ? '暂停' : '播放'}
                                                                            </Button>
                                                                        ) : (
                                                                            <span className="text-xs text-gray-400">无音频</span>
                                                                        )}
                                                                        <Button
                                                                            size="sm"
                                                                            variant="outline"
                                                                            className="text-xs text-red-600 hover:text-red-700"
                                                                            leftIcon={<Trash2 className="w-3 h-3" />}
                                                                            onClick={() => deleteSynthesisRecord(record.id)}
                                                                        >
                                                                            删除
                                                                        </Button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </div>
        </div>
    )
}

export default VoiceTraining


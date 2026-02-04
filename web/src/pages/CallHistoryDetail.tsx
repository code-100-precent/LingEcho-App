import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, 
  Phone, 
  Clock, 
  Calendar,
  MapPin,
  FileText,
  Download,
  Play,
  Pause,
  Volume2,
  FileAudio,
  Loader
} from 'lucide-react'
import { getCallDetail, requestTranscription, type SipCall } from '@/api/sip'
import Button from '@/components/UI/Button'
import { showAlert } from '@/utils/notification'

const CallHistoryDetail = () => {
  const { callId } = useParams<{ callId: string }>()
  const navigate = useNavigate()
  const [call, setCall] = useState<SipCall | null>(null)
  const [loading, setLoading] = useState(true)
  const [playing, setPlaying] = useState(false)
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null)
  const [transcribing, setTranscribing] = useState(false)
  const [transcription, setTranscription] = useState<string>('')

  useEffect(() => {
    if (callId) {
      loadCallDetail(callId)
    }
  }, [callId])

  useEffect(() => {
    return () => {
      if (audioElement) {
        audioElement.pause()
        audioElement.src = ''
      }
    }
  }, [audioElement])

  useEffect(() => {
    if (call?.transcription) {
      setTranscription(call.transcription)
    }
  }, [call])

  const loadCallDetail = async (id: string) => {
    try {
      setLoading(true)
      const res = await getCallDetail(id)
      if (res.code === 200 && res.data) {
        setCall(res.data)
      } else {
        showAlert('获取通话详情失败', 'error')
        navigate(-1)
      }
    } catch (error) {
      console.error('Load call detail error:', error)
      showAlert('获取通话详情失败', 'error')
      navigate(-1)
    } finally {
      setLoading(false)
    }
  }

  const formatDuration = (seconds: number) => {
    if (seconds === 0) return '-'
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  const getStatusInfo = (status: string) => {
    const statusConfig: Record<string, { color: string; bgColor: string; text: string }> = {
      answered: { color: 'text-green-700', bgColor: 'bg-green-100', text: '已接通' },
      ended: { color: 'text-gray-700', bgColor: 'bg-gray-100', text: '已结束' },
      failed: { color: 'text-red-700', bgColor: 'bg-red-100', text: '未接通' },
      cancelled: { color: 'text-orange-700', bgColor: 'bg-orange-100', text: '已取消' },
      calling: { color: 'text-blue-700', bgColor: 'bg-blue-100', text: '呼叫中' },
      ringing: { color: 'text-yellow-700', bgColor: 'bg-yellow-100', text: '响铃中' },
    }
    return statusConfig[status] || { color: 'text-gray-700', bgColor: 'bg-gray-100', text: status }
  }

  const handlePlayAudio = () => {
    if (!call?.recordUrl) return

    if (!audioElement) {
      const audio = new Audio(call.recordUrl)
      audio.addEventListener('ended', () => setPlaying(false))
      audio.addEventListener('error', () => {
        showAlert('播放失败', 'error')
        setPlaying(false)
      })
      setAudioElement(audio)
      audio.play()
      setPlaying(true)
    } else {
      if (playing) {
        audioElement.pause()
        setPlaying(false)
      } else {
        audioElement.play()
        setPlaying(true)
      }
    }
  }

  const handleDownloadRecording = () => {
    if (!call?.recordUrl) return
    window.open(call.recordUrl, '_blank')
  }

  const handleRequestTranscription = async () => {
    if (!call?.callId) return

    try {
      setTranscribing(true)
      const res = await requestTranscription(call.callId, {
        provider: 'qcloud',
        language: 'zh'
      })

      if (res.code === 200) {
        showAlert('转录任务已提交，请稍后刷新查看结果', 'success')
        
        // 5秒后自动刷新
        setTimeout(() => {
          if (callId) {
            loadCallDetail(callId)
          }
        }, 5000)
      } else {
        showAlert(res.msg || '转录请求失败', 'error')
      }
    } catch (error: any) {
      showAlert(error.message || '转录请求失败', 'error')
    } finally {
      setTranscribing(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">加载中...</p>
        </div>
      </div>
    )
  }

  if (!call) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">通话记录不存在</p>
          <Button onClick={() => navigate(-1)} className="mt-4">
            返回
          </Button>
        </div>
      </div>
    )
  }

  const statusInfo = getStatusInfo(call.status)

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            返回
          </Button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            通话详情
          </h1>
        </div>

        {/* Main Info Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 rounded-full ${statusInfo.bgColor} flex items-center justify-center`}>
                <Phone className={`w-8 h-8 ${statusInfo.color}`} />
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                  {call.direction === 'inbound' 
                    ? (call.fromUsername || call.fromUri || '未知号码')
                    : (call.toUsername || call.toUri || '未知号码')}
                </h2>
                <p className="text-gray-600 dark:text-gray-400">
                  {call.direction === 'inbound' ? '呼入' : '呼出'}
                </p>
              </div>
            </div>
            <span className={`px-4 py-2 rounded-full text-sm font-medium ${statusInfo.bgColor} ${statusInfo.color}`}>
              {statusInfo.text}
            </span>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-start gap-3">
              <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">开始时间</p>
                <p className="text-gray-900 dark:text-gray-100 font-medium">
                  {new Date(call.startTime).toLocaleString('zh-CN')}
                </p>
              </div>
            </div>

            {call.answerTime && (
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">接通时间</p>
                  <p className="text-gray-900 dark:text-gray-100 font-medium">
                    {new Date(call.answerTime).toLocaleString('zh-CN')}
                  </p>
                </div>
              </div>
            )}

            {call.endTime && (
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">结束时间</p>
                  <p className="text-gray-900 dark:text-gray-100 font-medium">
                    {new Date(call.endTime).toLocaleString('zh-CN')}
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-gray-400 mt-0.5" />
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">通话时长</p>
                <p className="text-gray-900 dark:text-gray-100 font-medium">
                  {formatDuration(call.duration)}
                </p>
              </div>
            </div>

            {call.fromIp && (
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">来源IP</p>
                  <p className="text-gray-900 dark:text-gray-100 font-medium font-mono text-sm">
                    {call.fromIp}
                  </p>
                </div>
              </div>
            )}

            {call.toIp && (
              <div className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-gray-400 mt-0.5" />
                <div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">目标IP</p>
                  <p className="text-gray-900 dark:text-gray-100 font-medium font-mono text-sm">
                    {call.toIp}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Call ID */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-600 dark:text-gray-400">通话ID</p>
            <p className="text-gray-900 dark:text-gray-100 font-mono text-sm mt-1">
              {call.callId}
            </p>
          </div>
        </div>

        {/* Recording Card */}
        {call.recordUrl && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Volume2 className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  通话录音
                </h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadRecording}
              >
                <Download className="w-4 h-4 mr-2" />
                下载
              </Button>
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant="primary"
                onClick={handlePlayAudio}
              >
                {playing ? (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    暂停
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    播放
                  </>
                )}
              </Button>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                点击播放或下载录音文件
              </p>
            </div>
          </div>
        )}

        {/* Transcription Card */}
        {call.recordUrl && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileAudio className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  语音转文字
                </h3>
              </div>
              {!transcription && call.transcriptionStatus !== 'processing' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRequestTranscription}
                  disabled={transcribing}
                >
                  {transcribing ? (
                    <>
                      <Loader className="w-4 h-4 mr-2 animate-spin" />
                      转录中...
                    </>
                  ) : (
                    <>
                      <FileAudio className="w-4 h-4 mr-2" />
                      转录
                    </>
                  )}
                </Button>
              )}
            </div>

            {call.transcriptionStatus === 'processing' && (
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                <Loader className="w-4 h-4 animate-spin" />
                <span className="text-sm">正在转录中，请稍候...</span>
              </div>
            )}

            {transcription && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {transcription}
                </p>
              </div>
            )}

            {!transcription && call.transcriptionStatus !== 'processing' && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                点击"转录"按钮将录音转换为文字
              </p>
            )}

            {call.transcriptionStatus === 'failed' && call.transcriptionError && (
              <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                转录失败: {call.transcriptionError}
              </div>
            )}
          </div>
        )}

        {/* Notes Card */}
        {call.notes && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                备注
              </h3>
            </div>
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {call.notes}
            </p>
          </div>
        )}

        {/* Error Info */}
        {call.errorMessage && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-red-900 dark:text-red-100 mb-2">
              错误信息
            </h3>
            <p className="text-red-700 dark:text-red-300">
              {call.errorMessage}
            </p>
            {call.errorCode && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                错误代码: {call.errorCode}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default CallHistoryDetail

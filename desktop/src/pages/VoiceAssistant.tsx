import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { showAlert } from '@/utils/notification'
import { useAuthStore } from '@/stores/authStore'
import Input from '@/components/UI/Input'
import Button from '@/components/UI/Button'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from '@/components/UI/Select'
import { Slider } from '@/components/UI/Slider'
import FormField from '@/components/Forms/FormField'
import { RefreshCw, Settings, ArrowRight, HelpCircle, CheckCircle2, ChevronRight } from 'lucide-react'
import { createPortal } from 'react-dom';
// 导入语音助手组件
import VoiceBall from '@/components/Voice/VoiceBall'
import AssistantList from '@/components/Voice/AssistantList'
import ChatArea from '@/components/Voice/ChatArea'
import ControlPanel from '@/components/Voice/ControlPanel'
import AddAssistantModal from '@/components/Voice/AddAssistantModal'
import IntegrationModal from '@/components/Voice/IntegrationModal'
import { getKnowledgeBaseByUser } from '@/api/knowledge'
// 导入API服务
import {
  createAssistant,
  getAssistantList,
  getAssistant,
  updateAssistant,
  updateAssistantJS,
  deleteAssistant,
  getVoiceClones,
  oneShotAudio,
  oneShotText,
  getAudioStatus,
  type VoiceClone,
  type OneShotTextRequest
} from '@/api/assistant'

// 引导动画组件
// 引导提示组件
interface GuideTooltipProps {
  text: string
  position?: 'top' | 'bottom' | 'left' | 'right'
  onNext?: () => void
  onClose?: () => void
  isLast?: boolean
}
// 完全重构 GuideTooltip 组件，修复只显示横线的问题
const GuideTooltip: React.FC<GuideTooltipProps> = ({
                                                     text,
                                                     position = 'bottom',
                                                     onNext,
                                                     onClose,
                                                     isLast = false
                                                   }) => {
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const [isVisible, setIsVisible] = useState(false);

  // 获取指示器样式
  const getIndicatorStyle = (pos: string) => {
    switch (pos) {
      case 'top':
        return {
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          borderTop: 'none',
          borderLeft: 'none'
        };
      case 'bottom':
        return {
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          borderBottom: 'none',
          borderRight: 'none'
        };
      case 'left':
        return {
          left: '100%',
          top: '50%',
          transform: 'translateY(-50%)',
          borderLeft: 'none',
          borderTop: 'none'
        };
      case 'right':
        return {
          right: '100%',
          top: '50%',
          transform: 'translateY(-50%)',
          borderRight: 'none',
          borderBottom: 'none'
        };
      default:
        return {
          top: '100%',
          left: '50%',
          transform: 'translateX(-50%)'
        };
    }
  };

  // 计算提示框位置
  useEffect(() => {
    const calculatePosition = () => {
      // 获取目标元素的位置信息
      const targetElement = document.querySelector(`[data-highlighted="true"]`);
      if (!targetElement || !tooltipRef.current) return;

      const targetRect = targetElement.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      // 基础偏移量
      const offset = 10;

      // 根据原始位置计算提示框位置
      let newStyle: React.CSSProperties = {};
      let newPosition = position;

      switch (position) {
        case 'top':
          // 检查上方是否有足够空间
          if (targetRect.top < tooltipRect.height + offset) {
            // 上方空间不足，改为下方显示
            newPosition = 'bottom';
            newStyle = {
              top: targetRect.bottom + offset,
              left: targetRect.left + targetRect.width / 2,
              transform: 'translateX(-50%)'
            };
          } else {
            newStyle = {
              top: targetRect.top - tooltipRect.height - offset,
              left: targetRect.left + targetRect.width / 2,
              transform: 'translateX(-50%)'
            };
          }
          break;

        case 'bottom':
          // 检查下方是否有足够空间
          if (targetRect.bottom + tooltipRect.height + offset > viewportHeight) {
            // 下方空间不足，改为上方显示
            newPosition = 'top';
            newStyle = {
              top: targetRect.top - tooltipRect.height - offset,
              left: targetRect.left + targetRect.width / 2,
              transform: 'translateX(-50%)'
            };
          } else {
            newStyle = {
              top: targetRect.bottom + offset,
              left: targetRect.left + targetRect.width / 2,
              transform: 'translateX(-50%)'
            };
          }
          break;

        case 'left':
          // 检查左侧是否有足够空间
          if (targetRect.left < tooltipRect.width + offset) {
            // 左侧空间不足，改为右侧显示
            newPosition = 'right';
            newStyle = {
              top: targetRect.top + targetRect.height / 2,
              left: targetRect.right + offset,
              transform: 'translateY(-50%)'
            };
          } else {
            newStyle = {
              top: targetRect.top + targetRect.height / 2,
              left: targetRect.left - tooltipRect.width - offset,
              transform: 'translateY(-50%)'
            };
          }
          break;

        case 'right':
          // 检查右侧是否有足够空间
          if (targetRect.right + tooltipRect.width + offset > viewportWidth) {
            // 右侧空间不足，改为左侧显示
            newPosition = 'left';
            newStyle = {
              top: targetRect.top + targetRect.height / 2,
              left: targetRect.left - tooltipRect.width - offset,
              transform: 'translateY(-50%)'
            };
          } else {
            newStyle = {
              top: targetRect.top + targetRect.height / 2,
              left: targetRect.right + offset,
              transform: 'translateY(-50%)'
            };
          }
          break;
      }

      // 确保提示框不会超出视口边界
      if (newStyle.left !== undefined && newStyle.top !== undefined) {
        // 水平边界检查
        if ((newStyle.left as number) < offset) {
          newStyle.left = offset;
        } else if ((newStyle.left as number) > viewportWidth - tooltipRect.width - offset) {
          newStyle.left = viewportWidth - tooltipRect.width - offset;
        }

        // 垂直边界检查
        if ((newStyle.top as number) < offset) {
          newStyle.top = offset;
        } else if ((newStyle.top as number) > viewportHeight - tooltipRect.height - offset) {
          newStyle.top = viewportHeight - tooltipRect.height - offset;
        }
      }

      setAdjustedPosition(newPosition);
      setTooltipStyle(newStyle);
      setIsVisible(true);
    };

    // 延迟计算位置，确保DOM元素已经渲染完成
    const timer = setTimeout(calculatePosition, 50);

    // 监听窗口大小变化
    window.addEventListener('resize', calculatePosition);
    return () => {
      window.removeEventListener('resize', calculatePosition);
      clearTimeout(timer);
    };
  }, [position]);

  // 创建 Portal 组件，将提示框渲染到 body 下
  const tooltipElement = (
      // 使用最高的 z-index 确保提示框在最上层
      <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none',
            zIndex: 2147483647 // 使用最大安全整数作为 z-index
          }}
      >
        <div
            ref={tooltipRef}
            style={{
              position: 'absolute',
              width: '16rem',
              maxHeight: '12rem',
              backgroundColor: 'white',
              borderRadius: '0.5rem',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
              border: '1px solid #e5e7eb',
              padding: '0.75rem',
              overflowY: 'auto',
              pointerEvents: 'auto',
              zIndex: 2147483647,
              opacity: isVisible ? 1 : 0,
              transition: 'opacity 0.2s ease-in-out',
              ...tooltipStyle
            }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
            <HelpCircle style={{ width: '1.25rem', height: '1.25rem', color: '#3b82f6', marginTop: '0.125rem', flexShrink: 0 }} />
            <p style={{ fontSize: '0.875rem', color: '#374151', margin: 0 }}>{text}</p>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '0.75rem' }}>
            {onClose && (
                <button
                    onClick={onClose}
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.25rem 0.75rem',
                      backgroundColor: '#f3f4f6',
                      color: '#374151',
                      borderRadius: '0.25rem',
                      border: 'none',
                      cursor: 'pointer'
                    }}
                >
                  跳过
                </button>
            )}
            <button
                onClick={onNext}
                style={{
                  fontSize: '0.75rem',
                  padding: '0.25rem 0.75rem',
                  backgroundColor: '#2563eb',
                  color: 'white',
                  borderRadius: '0.25rem',
                  border: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem'
                }}
            >
              {isLast ? (
                  <>完成 <CheckCircle2 style={{ width: '0.75rem', height: '0.75rem' }} /></>
              ) : (
                  <>下一步 <ChevronRight style={{ width: '0.75rem', height: '0.75rem' }} /></>
              )}
            </button>
          </div>
          {/* 小三角指示器 - 根据调整后的位置显示 */}
          <div
              style={{
                position: 'absolute',
                width: '0.5rem',
                height: '0.5rem',
                backgroundColor: 'white',
                border: '1px solid #e5e7eb',
                zIndex: 2147483646, // 略低于提示框主体
                ...getIndicatorStyle(adjustedPosition),
                transform: 'rotate(45deg)',
              }}
          ></div>
        </div>
      </div>
  );

  // 使用 Portal 将组件渲染到 body 下，避免被父级层叠上下文限制
  return createPortal(tooltipElement, document.body);
};






interface Assistant {
  id: number
  name: string
  description: string
  icon: string
  jsSourceId: string
  active?: boolean
}

interface ChatMessage {
  type: 'user' | 'agent'
  content: string
  timestamp: string
  id?: string
  audioUrl?: string
}


const VoiceAssistant: React.FC = () => {
  const navigate = useNavigate()
  const { isAuthenticated, isLoading } = useAuthStore()

  // 引导动画状态管理
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [onboardingStep, setOnboardingStep] = useState(0)
  const [highlightedElement, setHighlightedElement] = useState<string | null>(null)

  // 状态管理
  const [isCalling, setIsCalling] = useState(false)
  const [assistants, setAssistants] = useState<Assistant[]>([])
  const [selectedAssistant, setSelectedAssistant] = useState<number>(0)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [isGlobalMuted, setIsGlobalMuted] = useState(false)
  const [isWaitingForResponse, setIsWaitingForResponse] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const currentPlayingAudioRef = useRef<HTMLAudioElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  // 引用DOM元素用于引导动画
  const modeToggleRef = useRef<HTMLDivElement>(null)
  const voiceBallRef = useRef<HTMLDivElement>(null)
  const chatAreaRef = useRef<HTMLDivElement>(null)
  const controlPanelRef = useRef<HTMLDivElement>(null)
  const textInputRef = useRef<HTMLDivElement>(null)

  // WebSocket 和 WebRTC 相关状态
  const [socket, setSocket] = useState<WebSocket | null>(null)
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)
  const [callDuration, setCallDuration] = useState(0)
  const [callTimer, setCallTimer] = useState<NodeJS.Timeout | null>(null)
  const [pendingCandidates, setPendingCandidates] = useState<any[]>([])

  // 模式选择：实时通话 / 按住说话
  type CallMode = 'realtime' | 'press'
  const [callMode, setCallMode] = useState<CallMode>('realtime')
  
  // 线路选择：WebRTC / 七牛云ASR+TTS
  type LineMode = 'webrtc' | 'qiniu'
  const [lineMode, setLineMode] = useState<LineMode>('webrtc')
  const [isRecordingOneShot, setIsRecordingOneShot] = useState(false)
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null)
  const oneShotStreamRef = React.useRef<MediaStream | null>(null)
  const oneShotChunksRef = React.useRef<BlobPart[]>([])
  // 按住说话模式：训练音色
  const [voiceClones, setVoiceClones] = useState<VoiceClone[]>([])
  const [selectedVoiceCloneId, setSelectedVoiceCloneId] = useState<number | null>(null)

  // 控制面板抽屉状态管理
  const [isControlPanelOpen, setIsControlPanelOpen] = useState(false) // 默认隐藏配置面板
  const [isDrawerAnimating, setIsDrawerAnimating] = useState(false) // 控制动画状态

  // 控制面板状态
  const [apiKey, setApiKey] = useState('')
  const [apiSecret, setApiSecret] = useState('')
  const [language, setLanguage] = useState('zh-cn')
  const [selectedSpeaker, setSelectedSpeaker] = useState('101016')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [instruction, setInstruction] = useState('你是一个专业的语音助手，请用简洁的语言回答问题')
  const [temperature, setTemperature] = useState(0.6)
  const [maxTokens, setMaxTokens] = useState(150)
  const [speed, setSpeed] = useState(1.0)
  const [volume, setVolume] = useState(5)

  // 模态框状态
  const [showAddAssistantModal, setShowAddAssistantModal] = useState(false)
  const [showIntegrationModal, setShowIntegrationModal] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null)
  const [pendingAgent, setPendingAgent] = useState<number | null>(null)


  // 获取选中助手的 jsSourceId
  const jsSourceId = assistants.find(a => a.id === selectedAssistant)?.jsSourceId || ''
  
  // 当选中助手变化时，更新JS模板选择
  useEffect(() => {
    if (selectedAssistant && assistants.length > 0) {
      const currentAssistant = assistants.find(a => a.id === selectedAssistant)
      if (currentAssistant) {
        setSelectedJSTemplate(currentAssistant.jsSourceId || null)
      }
    }
  }, [selectedAssistant, assistants])
  
  // 状态管理中新增
  const [selectedKnowledgeBase, setSelectedKnowledgeBase] = useState<string | null>(null)
  const [knowledgeBases, setKnowledgeBases] = useState<Array<{id: string, name: string}>>([]);
  const [selectedJSTemplate, setSelectedJSTemplate] = useState<string | null>(null)

  // 引导步骤配置
  const onboardingSteps = [
    {
      element: 'mode-toggle',
      text: '在这里可以切换两种交互模式：实时通话和按住说话',
      position: 'bottom'
    },
    {
      element: 'voice-ball',
      text: '这是语音交互的核心按钮，点击开始或结束对话',
      position: 'right'
    },
    {
      element: 'chat-area',
      text: '这里将显示您与AI助手的对话历史',
      position: 'top'
    },
    {
      element: 'control-panel',
      text: '在这里可以配置AI助手的各种参数和设置',
      position: 'left'
    },
    {
      element: 'text-input',
      text: '您也可以直接输入文本与AI助手交流',
      position: 'top',
      isLast: true
    }
  ]

  // 处理引导下一步
  const handleNextStep = () => {
    if (onboardingStep < onboardingSteps.length - 1) {
      setOnboardingStep(onboardingStep + 1)
      setHighlightedElement(onboardingSteps[onboardingStep + 1].element)

      // 滚动到下一个元素
      const nextElement = getElementByStep(onboardingStep + 1)
      if (nextElement) {
        nextElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    } else {
      setShowOnboarding(false)
      setHighlightedElement(null)
      showAlert('引导动画结束， 请用户开始进行语音聊天吧', 'success')
    }
  }

  // 处理跳过引导
  const handleSkipOnboarding = () => {
    setShowOnboarding(false)
    setHighlightedElement(null)
  }

  // 根据步骤获取元素
  const getElementByStep = (step: number) => {
    const elementId = onboardingSteps[step].element
    switch (elementId) {
      case 'mode-toggle':
        return modeToggleRef.current
      case 'voice-ball':
        return voiceBallRef.current
      case 'chat-area':
        return chatAreaRef.current
      case 'control-panel':
        return controlPanelRef.current
      case 'text-input':
        return textInputRef.current
      default:
        return null
    }
  }

  // 开始引导
  const startOnboarding = () => {
    setShowOnboarding(true)
    setOnboardingStep(0)
    setHighlightedElement(onboardingSteps[0].element)

    // 滚动到第一个元素
    const firstElement = getElementByStep(0)
    if (firstElement) {
      firstElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }

  const fetchKnowledgeBases = async () => {
    try {
      const response = await getKnowledgeBaseByUser();
      // 修改数据转换逻辑，适应新的返回格式
      const transformedData = response.data.map((item: { name: string; key: string }) => ({
        id: item.key,
        name: item.name
      }));
      setKnowledgeBases(transformedData);
    } catch (error) {
      console.error('获取知识库列表失败:', error);
    }
  };

  // 添加管理知识库的函数（导航到知识库管理页面）
  const handleManageKnowledgeBases = () => {
    navigate('/knowledge'); // 假设知识库管理页面的路径是 /knowledge
  };

  // 停止当前播放的音频
  const stopCurrentAudio = () => {
    if (currentPlayingAudioRef.current) {
      currentPlayingAudioRef.current.pause()
      currentPlayingAudioRef.current.currentTime = 0
      currentPlayingAudioRef.current = null
    }
    // 也停止页面上所有其他音频元素
    const audioElements = document.querySelectorAll('audio')
    audioElements.forEach(audio => {
      if (audio !== currentPlayingAudioRef.current) {
        audio.pause()
        audio.currentTime = 0
      }
    })
  }

  // 添加AI消息到聊天记录
  const addAIMessage = (text: string, audioUrl?: string) => {
    console.log('添加AI消息:', text, '音频URL:', audioUrl)

    // 如果有新消息且不是静音状态，停止当前播放的音频
    if (audioUrl && !isGlobalMuted) {
      console.log('停止当前播放的音频，准备播放新音频')
      stopCurrentAudio()
    }

    const messageId = `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const newMessage = {
      type: 'agent' as const,
      content: text,
      timestamp: new Date().toLocaleTimeString(),
      id: messageId,
      audioUrl: audioUrl
    }
    console.log('新消息对象:', newMessage)
    setChatMessages(prev => {
      const updated = [...prev, newMessage]
      console.log('更新后的消息列表:', updated)
      return updated
    })

    return messageId
  }

  // 添加AI loading消息
  const addAILoadingMessage = () => {
    const messageId = `loading-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const loadingMessage = {
      type: 'agent' as const,
      content: '',
      timestamp: new Date().toLocaleTimeString(),
      id: messageId,
      isLoading: true
    }
    setChatMessages(prev => [...prev, loadingMessage])
    return messageId
  }

  // 移除loading消息
  const removeLoadingMessage = (messageId: string) => {
    setChatMessages(prev => prev.filter(msg => msg.id !== messageId))
  }

  // 轮询获取音频URL
  const pollAudioStatus = async (requestId: string, messageId: string) => {
    console.log('开始轮询音频状态:', requestId, messageId)
    const pollInterval = 1000 // 1秒轮询一次
    const maxAttempts = 30 // 最多轮询30次（30秒）
    let attempts = 0

    const poll = async () => {
      console.log(`轮询第 ${attempts + 1} 次，requestId: ${requestId}`)
      try {
        const response = await getAudioStatus(requestId)
        console.log('轮询结果:', response)

        if (response.data?.status === 'completed' && response.data?.audioUrl) {
            // 将 /media/ 路径替换为完整的 URL 路径
            const audioUrl = response.data.audioUrl.replace('/media/', 'http://localhost:7072/uploads/');

            // 更新消息的音频URL（不触发打字特效）
            setChatMessages(prev => prev.map(msg =>
                msg.id === messageId
                    ? { ...msg, audioUrl: audioUrl }
                    : msg
            ))

          // 如果不是静音状态，播放音频
          if (!isGlobalMuted) {
            console.log('准备播放轮询获取的音频:', audioUrl)
            setTimeout(() => {
              const audio = new Audio(audioUrl) // 使用处理后的完整URL
              currentPlayingAudioRef.current = audio

              audio.onended = () => {
                currentPlayingAudioRef.current = null
              }

              audio.onerror = (error) => {
                console.error('音频播放失败:', error)
                console.error('音频URL:', audioUrl)
                currentPlayingAudioRef.current = null
              }

              audio.play().catch(err => {
                console.error('音频播放失败:', err)
                console.error('音频URL:', audioUrl)
                currentPlayingAudioRef.current = null
              })
            }, 500)
          } else {
            console.log('全局静音状态，跳过音频播放')
          }
          return
        }

        attempts++
        if (attempts < maxAttempts) {
          setTimeout(poll, pollInterval)
        } else {
          console.log('轮询超时，停止轮询')
        }
      } catch (error) {
        console.error('轮询音频状态失败:', error)
        attempts++
        if (attempts < maxAttempts) {
          setTimeout(poll, pollInterval)
        }
      }
    }

    // 开始轮询
    setTimeout(poll, pollInterval)
  }

  // 添加用户消息到聊天记录
  const addUserMessage = (text: string) => {
    console.log('添加用户消息:', text)
    const messageId = `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const newMessage = {
      type: 'user' as const,
      content: text,
      timestamp: new Date().toLocaleTimeString(),
      id: messageId
    }
    console.log('新用户消息对象:', newMessage)
    setChatMessages(prev => {
      const updated = [...prev, newMessage]
      console.log('更新后的消息列表(用户):', updated)
      return updated
    })
  }

  // 连接七牛云语音服务
  const connectQiniuVoice = () => {
    // 先关闭现有连接
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.close()
    }

    // 获取认证token
    const token = localStorage.getItem('auth_token') || 'test-token-123'
    
    // 连接七牛云语音WebSocket
    const wsUrl = `ws://localhost:7072/api/voice/qiniu?assistantId=${selectedAssistant}&token=${token}`
    const newSocket = new WebSocket(wsUrl)

    newSocket.onopen = async () => {
      console.log('[七牛云语音] WebSocket已连接')
      
      try {
        // 获取麦克风权限
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        })
        
        setLocalStream(stream)
        
        // 开始实时录音和发送
        startQiniuRecording(stream, newSocket)
        
        showAlert('七牛云语音连接已建立', 'success')
      } catch (error) {
        console.error('[七牛云语音] 获取麦克风失败:', error)
        showAlert('获取麦克风权限失败', 'error')
      }
    }

    newSocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        console.log('[七牛云语音] 收到消息:', data)
        
        switch (data.type) {
          case 'asr_result':
            // 显示识别结果
            addUserMessage(data.text)
            break
          case 'llm_response':
            // 显示LLM回复
            addAIMessage(data.text)
            break
          case 'tts_audio':
            // 播放TTS音频
            if (data.audioUrl && !isGlobalMuted) {
              playTTSAudio(data.audioUrl)
            }
            break
          case 'error':
            console.error('[七牛云语音] 错误:', data.message)
            showAlert(data.message, 'error')
            break
        }
      } catch (error) {
        console.error('[七牛云语音] 消息解析失败:', error)
      }
    }

    newSocket.onerror = (error) => {
      console.error('[七牛云语音] WebSocket错误:', error)
      showAlert('七牛云语音连接出错', 'error')
    }

    newSocket.onclose = () => {
      console.log('[七牛云语音] WebSocket连接关闭')
    }

    setSocket(newSocket)
  }

  // 开始七牛云录音 - 使用Web Audio API获取PCM数据
  const startQiniuRecording = (stream: MediaStream, ws: WebSocket) => {
    console.log('开始七牛云录音，使用Web Audio API获取PCM数据')
    
    try {
      // 创建AudioContext
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)({
        sampleRate: 16000 // 设置采样率为16kHz
      })
      
      // 创建音频源
      const source = audioContext.createMediaStreamSource(stream)
      
      // 创建ScriptProcessorNode来处理音频数据
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      
      processor.onaudioprocess = (event) => {
        if (ws.readyState === WebSocket.OPEN) {
          // 获取PCM数据
          const inputBuffer = event.inputBuffer
          const pcmData = inputBuffer.getChannelData(0)
          
          // 将Float32Array转换为Int16Array (PCM 16-bit)
          const pcm16Data = new Int16Array(pcmData.length)
          for (let i = 0; i < pcmData.length; i++) {
            // 将float32 (-1.0 到 1.0) 转换为int16 (-32768 到 32767)
            pcm16Data[i] = Math.max(-32768, Math.min(32767, pcmData[i] * 32768))
          }
          
          // 发送PCM数据
          console.log('发送PCM音频数据到七牛云ASR，大小:', pcm16Data.byteLength)
          ws.send(pcm16Data.buffer)
        }
      }
      
      // 连接音频处理链
      source.connect(processor)
      processor.connect(audioContext.destination)
      
      // 保存引用以便停止
      mediaRecorderRef.current = {
        stop: () => {
          processor.disconnect()
          source.disconnect()
          audioContext.close()
        }
      } as any
      
    } catch (error) {
      console.error('创建Web Audio API失败:', error)
      // 如果Web Audio API失败，回退到MediaRecorder
      startQiniuRecordingFallback(stream, ws)
    }
  }
  
  // 回退方案：使用MediaRecorder
  const startQiniuRecordingFallback = (stream: MediaStream, ws: WebSocket) => {
    console.log('使用MediaRecorder回退方案')
    
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus',
      audioBitsPerSecond: 128000
    })
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
        const reader = new FileReader()
        reader.onload = () => {
          const arrayBuffer = reader.result as ArrayBuffer
          console.log('发送WebM音频数据到七牛云ASR，大小:', arrayBuffer.byteLength)
          ws.send(arrayBuffer)
        }
        reader.readAsArrayBuffer(event.data)
      }
    }
    
    mediaRecorder.start(200)
    mediaRecorderRef.current = mediaRecorder
  }

  // 播放TTS音频
  const playTTSAudio = (audioUrl: string) => {
    console.log('准备播放TTS音频:', audioUrl)
    
    // 检查音频URL是否有效
    if (!audioUrl || audioUrl.trim() === '') {
      console.error('音频URL为空')
      return
    }
    
    const audio = new Audio(audioUrl)
    currentPlayingAudioRef.current = audio
    
    audio.onended = () => {
      console.log('音频播放完成')
      currentPlayingAudioRef.current = null
    }
    
    audio.onerror = (error) => {
      console.error('TTS音频播放失败:', error)
      console.error('音频URL:', audioUrl)
      currentPlayingAudioRef.current = null
      
      // 尝试检查音频文件是否可访问
      fetch(audioUrl, { method: 'HEAD' })
        .then(response => {
          console.log('音频文件HTTP状态:', response.status)
          console.log('音频文件Content-Type:', response.headers.get('content-type'))
        })
        .catch(fetchError => {
          console.error('音频文件访问失败:', fetchError)
        })
    }
    
    audio.play().catch(err => {
      console.error('TTS音频播放失败:', err)
      console.error('音频URL:', audioUrl)
      currentPlayingAudioRef.current = null
    })
  }

  // 连接WebSocket
  const connectWebSocket = () => {
    // 先关闭现有连接
    if (socket && socket.readyState !== WebSocket.CLOSED) {
      socket.close()
    }

    // 将认证信息作为查询参数添加到URL中
    const apiKey = "1234567"
    const apiSecret = "1234567"
    const wsUrl = `ws://localhost:7072/api/chat/call?apiKey=${apiKey}&apiSecret=${apiSecret}`
    const newSocket = new WebSocket(wsUrl)

    newSocket.onopen = async () => {
      console.log('[WebSocket] 已连接')

      try {
        // 1. 创建 RTCPeerConnection
        const newPeerConnection = new RTCPeerConnection({
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' } // 公共 STUN 服务器
          ]
        })

        // 2. 获取麦克风音频
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
          }
        })

        stream.getTracks().forEach(track => {
          newPeerConnection.addTrack(track, stream)
        })

        // 3. 收集 ICE 候选，并发送给后端
        newPeerConnection.onicecandidate = (event) => {
          if (event.candidate && newSocket.readyState === WebSocket.OPEN) {
            newSocket.send(JSON.stringify({
              type: 'ice-candidate',
              candidate: event.candidate
            }))
          } else if (event.candidate) {
            console.warn('[WebRTC] WebSocket连接已关闭，无法发送ICE候选')
          }
        }

        newPeerConnection.ontrack = (event) => {
          const remoteAudio = new Audio()
          remoteAudio.srcObject = event.streams[0]
          remoteAudio.play().catch(err => {
            console.error('[WebRTC] 播放远端音频失败:', err)
          })
        }

        newPeerConnection.onconnectionstatechange = () => {
          switch (newPeerConnection.connectionState) {
            case 'connected':
              console.log('[WebRTC] 已连接')
              break
            case 'disconnected':
            case 'failed':
            case 'closed':
              console.log('[WebRTC] 连接关闭/失败')
              break
          }
        }

        // 4. 创建 offer
        const offer = await newPeerConnection.createOffer()
        await newPeerConnection.setLocalDescription(offer)

        // 5. 发送 offer to websocket
        if (newSocket.readyState === WebSocket.OPEN) {
          newSocket.send(JSON.stringify({
            type: 'offer',
            sdp: offer.sdp,
            assistantId: 1, // 使用硬编码的助手ID，与Vue代码保持一致
            instruction: "请以清晰、专业的方式回答用户的提问，尽量提供步骤化的解决方案。对于复杂问题，请分点说明并使用示例进行解释。",
            language: "zh-cn",
            maxTokens: 50,
            personaTag: "技术支持",
            speaker: "101016",
            speed: 1,
            systemPrompt: "你是一个专业的技术支持工程师，专注于帮助用户解决技术相关的问题。",
            temperature: 0.6,
            volume: 5,
          }))
        } else {
          console.error('[WebSocket] 连接未就绪，无法发送offer')
        }

        setPeerConnection(newPeerConnection)
        setLocalStream(stream)

        // 设置WebSocket消息处理，确保peerConnection已经创建
        newSocket.onmessage = async (event) => {
          console.log('[WebSocket] 收到消息:', event.data)
          const data = JSON.parse(event.data)
          console.log('[WebSocket] 解析后的数据:', data)

          switch (data.type) {
            case 'answer':
              console.log('[WebRTC] 收到answer消息，检查条件:')
              console.log('- peerConnection存在:', !!newPeerConnection)
              console.log('- data.sdp存在:', !!data.sdp)
              console.log('- data.sdp内容:', data.sdp)

              if (newPeerConnection && data.sdp) {
                const remoteDesc = new RTCSessionDescription({
                  type: 'answer',
                  sdp: data.sdp,
                })
                console.log('[WebRTC] 设置远端 SDP answer', remoteDesc)
                await newPeerConnection.setRemoteDescription(remoteDesc)
                console.log('[WebRTC] 已设置远端 SDP answer')

                // 设置完 remoteDescription 后再处理缓存的 ICE 候选
                for (const candidate of pendingCandidates) {
                  try {
                    await newPeerConnection.addIceCandidate(new RTCIceCandidate(candidate))
                    console.log('[WebRTC] 添加缓存 ICE 候选成功')
                  } catch (err) {
                    console.error('[WebRTC] 添加缓存 ICE 候选失败:', err)
                  }
                }
                setPendingCandidates([])
              } else {
                console.error('[WebRTC] 条件不满足，无法设置远端SDP')
                console.error('- peerConnection:', newPeerConnection)
                console.error('- data.sdp:', data.sdp)
              }
              break
            case 'asrFinal':
              console.log('[WebSocket] 收到ASR结果:', data.text)
              addAIMessage(data.text)
              break
            case 'ice-candidate':
              if (newPeerConnection) {
                const candidate = new RTCIceCandidate(data.candidate)
                if (newPeerConnection.remoteDescription && newPeerConnection.remoteDescription.type) {
                  try {
                    await newPeerConnection.addIceCandidate(candidate)
                    console.log('[WebRTC] 添加 ICE 候选成功')
                  } catch (err) {
                    console.error('[WebRTC] 添加 ICE 候选失败:', err)
                  }
                } else {
                  setPendingCandidates(prev => [...prev, data.candidate])
                  console.log('[WebRTC] 缓存 ICE 候选，等待 remoteDescription 设置')
                }
              }
              break
          }
        }

      } catch (error) {
        console.error('[WebRTC] 初始化失败:', error)
        showAlert('音频设备初始化失败', 'error')
      }
    }

    newSocket.onerror = (error) => {
      console.error('[WebSocket] 连接出错:', error)
      showAlert('WebSocket连接出错', 'error')
    }

    newSocket.onclose = () => {
      console.log('[WebSocket] 连接关闭')
    }

    setSocket(newSocket)
  }

  // 初始化数据
  useEffect(() => {
    // 只有在已登录且不在加载状态时才初始化数据
    if (!isAuthenticated || isLoading) {
      return
    }

    const initializeData = async () => {
      try {
        // 检查是否为首次访问
        const hasVisited = localStorage.getItem('hasVisitedVoiceAssistant');
        if (!hasVisited) {
          // 首次访问，自动启动引导
          setTimeout(() => {
            startOnboarding();
          }, 1000);
          // 标记已访问
          localStorage.setItem('hasVisitedVoiceAssistant', 'true');
        }

        // 获取助手列表
        const assistantsResponse = await getAssistantList()
        setAssistants(assistantsResponse.data)

        // 获取知识库列表
        await fetchKnowledgeBases();
        
        // 获取音色列表
        try {
          const response = await getVoiceClones()
          const list = Array.isArray(response.data) ? response.data : []
          setVoiceClones(list)
          if (list.length && selectedVoiceCloneId == null) {
            setSelectedVoiceCloneId(list[0].id)
          }
        } catch (err) {
          console.warn('获取音色列表失败:', err)
          setVoiceClones([])
        }
      } catch (err) {
        console.error('初始化数据失败:', err)
        showAlert('加载数据失败', 'error')
      }
    }

    initializeData()
  }, [isAuthenticated, isLoading])

  // 键盘快捷键支持
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl/Cmd + 2: 切换控制面板
      if ((event.ctrlKey || event.metaKey) && event.key === '2') {
        event.preventDefault()
        if (isControlPanelOpen) {
          closeDrawer()
        } else {
          openDrawer()
        }
      }
      // ESC: 关闭抽屉
      if (event.key === 'Escape' && isControlPanelOpen) {
        event.preventDefault()
        closeDrawer()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isControlPanelOpen])

  // 组件卸载时清理资源
  useEffect(() => {
    return () => {
      console.log('[Cleanup] 组件卸载，清理资源')
      // 组件卸载时清理所有连接
      if (callTimer) {
        clearInterval(callTimer)
      }
      if (socket && socket.readyState !== WebSocket.CLOSED) {
        socket.close()
      }
      if (peerConnection && peerConnection.connectionState !== 'closed') {
        peerConnection.close()
      }
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  // 开始通话
  const startCall = async () => {
    if (selectedAssistant === 0) {
      showAlert('请先选择一个AI助手', 'warning')
      return
    }

    try {
      setIsCalling(true)
      setCallDuration(0)
      setChatMessages([]) // 清空当前聊天记录

      // 根据线路选择连接方式
      if (lineMode === 'webrtc') {
        // 线路1：WebRTC实时通信
        connectWebSocket()
      } else if (lineMode === 'qiniu') {
        // 线路2：七牛云ASR+TTS
        connectQiniuVoice()
      }

      // 开始通话计时器
      const timer = setInterval(() => {
        setCallDuration(prev => prev + 1)
      }, 1000)
      setCallTimer(timer)

      showAlert('通话已开始', 'success')
    } catch (err: any) {
      console.error('通话启动失败:', err)
      setIsCalling(false)
      showAlert('通话启动失败', 'error')
    }
  }

  // 停止通话
  const stopCall = async () => {
    try {
      console.log('[StopCall] 开始停止通话')

      // 停止通话计时器
      if (callTimer) {
        clearInterval(callTimer)
        setCallTimer(null)
      }

      // 根据线路类型停止相应的连接
      if (lineMode === 'webrtc') {
        // 停止WebRTC连接
        if (peerConnection && peerConnection.connectionState !== 'closed') {
          peerConnection.close()
          setPeerConnection(null)
        }
      } else if (lineMode === 'qiniu') {
        // 停止七牛云录音
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
          mediaRecorderRef.current.stop()
          mediaRecorderRef.current = null
        }
      }

      // 关闭WebSocket连接
      if (socket && socket.readyState !== WebSocket.CLOSED) {
        socket.close()
        setSocket(null)
      }

      // 停止本地音频流
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop())
        setLocalStream(null)
      }

      setIsCalling(false)
      setCallDuration(0)
      setPendingCandidates([])

      console.log('[StopCall] 通话已结束')
      showAlert('通话已结束', 'success')
      return true
    } catch (err: any) {
      console.error('终止通话失败:', err)
      showAlert('终止通话失败', 'error')
      return false
    }
  }

  // 一句话模式：开始录音
  const startOneShot = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      oneShotStreamRef.current = stream
      oneShotChunksRef.current = []
      // 尝试使用浏览器支持的音频格式，优先选择七牛云ASR支持的格式
      // 七牛云ASR支持: raw / wav / mp3 / ogg
      let mimeType = 'audio/webm' // 默认格式

      console.log('检查浏览器支持的音频格式:')
      console.log('audio/wav:', MediaRecorder.isTypeSupported('audio/wav'))
      console.log('audio/ogg:', MediaRecorder.isTypeSupported('audio/ogg'))
      console.log('audio/mp4:', MediaRecorder.isTypeSupported('audio/mp4'))
      console.log('audio/webm:', MediaRecorder.isTypeSupported('audio/webm'))

      if (MediaRecorder.isTypeSupported('audio/wav')) {
        mimeType = 'audio/wav'
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg'
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4'
      }

      console.log('选择的MIME类型:', mimeType)

      const mr = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mr
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          oneShotChunksRef.current.push(e.data)
        }
      }
      mr.onstop = async () => {
        const blob = new Blob(oneShotChunksRef.current, { type: mimeType })
        await uploadOneShot(blob)
        // 清理
        oneShotStreamRef.current?.getTracks().forEach(t => t.stop())
        oneShotStreamRef.current = null
        mediaRecorderRef.current = null
        setIsRecordingOneShot(false)
      }
      mr.start()
      setIsRecordingOneShot(true)
      showAlert('开始录音（一句话模式）', 'success')
    } catch (e) {
      console.error('开启录音失败:', e)
      showAlert('开启录音失败', 'error')
    }
  }

  // 一句话模式：停止录音
  const stopOneShot = async () => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop()
      } else {
        setIsRecordingOneShot(false)
      }
    } catch (e) {
      console.error('停止录音失败:', e)
      setIsRecordingOneShot(false)
    }
  }

  // 上传音频到后端（后端将调用七牛ASR -> LLM -> 七牛TTS）
  const uploadOneShot = async (blob: Blob) => {
    // 校验是否选择了助手
    if (!selectedAssistant || selectedAssistant === 0) {
      showAlert('请先选择一个助手', 'warning')
      return
    }

    try {
      const form = new FormData()
      // 后端可选参数：assistantId/language/speaker/voiceCloneId 等
      form.append('audio', blob, `oneshot_${Date.now()}.webm`)
      form.append('assistantId', String(selectedAssistant))
      form.append('language', language)
      if (callMode === 'press' && selectedVoiceCloneId) {
        form.append('voiceCloneId', String(selectedVoiceCloneId))
      } else {
        form.append('speaker', selectedSpeaker)
      }
      form.append('temperature', String(temperature))
      form.append('systemPrompt', systemPrompt)
      form.append('instruction', instruction)

      // 如果选择了知识库，则传入知识库key，否则传空值
      if (selectedKnowledgeBase) {
        form.append('knowledgeKey', selectedKnowledgeBase)
      } else {
        form.append('knowledgeKey', '')
      }

      const response = await oneShotAudio(form)
      console.log('OneShotAudio响应:', response)
      
      if (response.data?.text) {
        const messageId = addAIMessage(response.data.text)
        
        // 如果有requestId，开始轮询音频状态（与文本输入保持一致）
        if ((response.data as any)?.requestId) {
          console.log('开始轮询音频状态(音频上传):', (response.data as any).requestId)
          pollAudioStatus((response.data as any).requestId, messageId)
        } else {
          console.log('响应中没有requestId字段(音频上传)')
        }
      }
      
      // 如果有直接返回的audioUrl，立即播放（兼容旧版本）
      if (response.data?.audioUrl) {
        console.log('直接播放返回的音频URL:', response.data.audioUrl)
        const audio = new Audio(response.data.audioUrl)
        currentPlayingAudioRef.current = audio
        
        audio.onended = () => {
          currentPlayingAudioRef.current = null
        }
        
        audio.onerror = (error) => {
          console.error('音频播放失败:', error)
          currentPlayingAudioRef.current = null
        }
        
        await audio.play()
      }
      
      showAlert('处理完成', 'success')
    } catch (e: any) {
      console.error('上传处理失败:', e)
      showAlert(e?.msg || e?.message || '上传处理失败', 'error')
    }
  }

  // 开始新会话
  const startNewSession = () => {
    setCurrentSessionId(null)
    setChatMessages([])
    showAlert('已开始新会话', 'success')
  }

  // 切换助手
  const handleSelectAgent = async (agentId: number) => {
    if (isCalling) {
      setPendingAgent(agentId)
      setShowConfirmModal(true)
      return
    }

    try {
      const response = await getAssistant(agentId)
      const detail = response.data
      setSelectedAssistant(agentId)

      if (detail) {
        setSystemPrompt(detail.systemPrompt || '')
        setInstruction(detail.instruction || '')
        // 注意：以下字段在assistant接口中没有提供，需要保留原有实现或另外处理
        // setSelectedSpeaker(detail.speaker || '101016')
        // setLanguage(detail.language || 'zh-cn')
        setTemperature(detail.temperature ?? 0.6)
        // setVolume(detail.volume ?? 5)
        setMaxTokens(detail.maxTokens ?? 150)
      }
    } catch (err: any) {
      console.error('获取助手详情失败:', err)

      // 检查是否是API错误响应
      if (err.response && err.response.data && err.response.data.msg) {
        showAlert(err.response.data.msg, 'error')
      } else if (err.message) {
        showAlert(err.message, 'error')
      } else {
        showAlert('获取助手详情失败', 'error')
      }
    }
  }

  // 确认切换助手
  const confirmSwitch = async () => {
    setShowConfirmModal(false)
    const success = await stopCall()
    if (success && pendingAgent) {
      setSelectedAssistant(pendingAgent)
      setPendingAgent(null)
    }
  }

  // 添加助手
  const handleAddAssistant = async (assistant: { name: string; description: string; icon: string }) => {
    try {
      await createAssistant(assistant)

      // 刷新助手列表
      const assistantsResponse = await getAssistantList()
      setAssistants(assistantsResponse.data)

      showAlert('助手创建成功', 'success')
    } catch (err: any) {
      console.error('创建助手失败:', err)

      // 检查是否是API错误响应
      if (err.response && err.response.data && err.response.data.msg) {
        showAlert(err.response.data.msg, 'error')
      } else if (err.message) {
        showAlert(err.message, 'error')
      } else {
        showAlert('创建助手失败', 'error')
      }
    }
  }

  // 保存设置
  const handleSaveSettings = async () => {
    try {
      await updateAssistant(selectedAssistant, {
        systemPrompt,
        instruction,
        persona_tag: assistants.find(a => a.id === selectedAssistant)?.name || '',
        temperature,
        maxTokens,
      })

      // 更新JS模板
      if (selectedJSTemplate !== null) {
        await updateAssistantJS(selectedAssistant, selectedJSTemplate)
      }

      showAlert('设置保存成功', 'success')
    } catch (err: any) {
      console.error('保存设置失败:', err)

      // 检查是否是API错误响应
      if (err.response && err.response.data && err.response.data.msg) {
        showAlert(err.response.data.msg, 'error')
      } else if (err.message) {
        showAlert(err.message, 'error')
      } else {
        showAlert('保存设置失败', 'error')
      }
    }
  }

  // 删除助手
  const handleDeleteAssistant = async () => {
    try {
      await deleteAssistant(selectedAssistant)
      setShowDeleteConfirm(false)
      setSelectedAssistant(0)
      setSystemPrompt('')
      setInstruction('')

      // 刷新助手列表
      const assistantsResponse = await getAssistantList()
      setAssistants(assistantsResponse.data)

      showAlert('助手删除成功', 'success')
    } catch (err: any) {
      console.error('删除助手失败:', err)

      // 检查是否是API错误响应
      if (err.response && err.response.data && err.response.data.msg) {
        showAlert(err.response.data.msg, 'error')
      } else if (err.message) {
        showAlert(err.message, 'error')
      } else {
        showAlert('删除助手失败', 'error')
      }
    }
  }


  // 处理接入方法点击
  const handleMethodClick = (method: string) => {
    if (selectedAssistant === 0) {
      showAlert('请先选择一个AI助手', 'warning')
      return
    }
    setSelectedMethod(method)
    setShowIntegrationModal(true)
  }

  // 处理JS模板变化
  const handleJSTemplateChange = (value: string) => {
    setSelectedJSTemplate(value)
  }

  // 处理配置按钮点击
  const handleConfigClick = () => {
    if (selectedAssistant === 0) {
      showAlert('请先选择一个AI助手', 'warning')
      return
    }
    openDrawer()
  }

  // 打开抽屉
  const openDrawer = () => {
    setIsControlPanelOpen(true)
    // 使用 setTimeout 确保 DOM 更新后再开始动画
    setTimeout(() => {
      setIsDrawerAnimating(true)
    }, 10)
  }

  // 关闭抽屉
  const closeDrawer = () => {
    setIsDrawerAnimating(false)
    // 等待动画完成后再隐藏抽屉
    setTimeout(() => {
      setIsControlPanelOpen(false)
    }, 300) // 与CSS动画时长一致
  }

  // 如果正在加载，显示加载状态
  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-sky-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-300">正在加载...</p>
        </div>
      </div>
    )
  }

  // 如果未登录，显示登录提示
  if (!isAuthenticated) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-br from-sky-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="w-20 h-20 bg-gradient-to-br from-sky-500 to-cyan-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">欢迎使用语音助手</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-8">请先登录以使用语音助手功能</p>
          <div className="space-y-4">
            <Button
              variant="primary"
              size="lg"
              onClick={() => {
                // 触发登录窗口打开事件
                const event = new CustomEvent('openAuthModal')
                window.dispatchEvent(event)
              }}
              className="w-full bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700"
            >
              立即登录
            </Button>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              登录后即可使用AI语音助手、知识库管理等功能
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
      <div className="h-full overflow-hidden flex flex-col bg-gradient-to-br from-sky-50 to-cyan-50 dark:from-slate-900 dark:to-slate-800">
        <div className="flex flex-1 overflow-hidden">
          {/* 左侧边栏（语音球+助手列表） */}
          <div
              className="w-64 flex flex-col border-r dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-hidden">
            {/* 语音球区域 */}
            <div className="p-3 flex flex-col justify-center flex-shrink-0">
              {/* 模式切换（带滑块特效） */}
              <div
                  ref={modeToggleRef}
                  data-highlighted={showOnboarding && highlightedElement === 'mode-toggle' ? 'true' : 'false'}
                  className={`mb-3 flex items-center justify-center ${highlightedElement === 'mode-toggle' ? 'ring-2 ring-blue-500 rounded-xl p-1' : ''}`}
              >
                <div className="relative bg-gray-100 dark:bg-neutral-700 rounded-xl p-1 flex gap-1 shadow-inner">
                  <div
                      className={`absolute top-1 bottom-1 w-1/2 rounded-lg bg-gradient-to-r from-sky-500 to-cyan-500 transition-transform duration-300 ease-out shadow-[0_0_20px_rgba(14,165,233,0.6)] ${callMode === 'realtime' ? 'translate-x-0' : 'translate-x-full'}`}
                      style={{transform: callMode === 'realtime' ? 'translateX(0%)' : 'translateX(100%)'}}
                  />
                  <button
                      className={`relative z-10 px-4 py-1.5 text-sm rounded-lg transition-all duration-200 ${callMode === 'realtime' ? 'text-sky-700 dark:text-sky-300 scale-[1.02]' : 'text-gray-700 dark:text-gray-200 hover:text-gray-900'} `}
                      onClick={() => setCallMode('realtime')}
                      title="实时通话模式"
                  >实时通话
                  </button>
                  <button
                      className={`relative z-10 px-4 py-1.5 text-sm rounded-lg transition-all duration-200 ${callMode === 'press' ? 'text-sky-700 dark:text-sky-300 scale-[1.02]' : 'text-gray-700 dark:text-gray-200 hover:text-gray-900'} `}
                      onClick={() => setCallMode('press')}
                      title="按住说话模式：录音后发送"
                  >按住说话
                  </button>
                </div>
                {showOnboarding && highlightedElement === 'mode-toggle' && (
                    <GuideTooltip
                        text={onboardingSteps[onboardingStep].text}
                        position={onboardingSteps[onboardingStep].position as any}
                        onNext={handleNextStep}
                        onClose={handleSkipOnboarding}
                    />
                )}
              </div>

              {/* 线路选择（仅在实时通话模式下显示） */}
              {callMode === 'realtime' && (
                <div className="mb-3 flex items-center justify-center">
                  <div className="relative bg-gray-100 dark:bg-neutral-700 rounded-xl p-1 flex gap-1 shadow-inner">
                  <div
                      className={`absolute top-1 bottom-1 w-1/2 rounded-lg bg-gradient-to-r from-blue-500 to-cyan-500 transition-transform duration-300 ease-out shadow-[0_0_20px_rgba(59,130,246,0.6)] ${lineMode === 'webrtc' ? 'translate-x-0' : 'translate-x-full'}`}
                  />
                    <button
                        className={`relative z-10 px-4 py-1.5 text-sm rounded-lg transition-all duration-200 ${lineMode === 'webrtc' ? 'text-blue-700 dark:text-blue-300 scale-[1.02]' : 'text-gray-700 dark:text-gray-200 hover:text-gray-900'} `}
                        onClick={() => setLineMode('webrtc')}
                    >线路1
                    </button>
                    <button
                        className={`relative z-10 px-4 py-1.5 text-sm rounded-lg transition-all duration-200 ${lineMode === 'qiniu' ? 'text-blue-700 dark:text-blue-300 scale-[1.02]' : 'text-gray-700 dark:text-gray-200 hover:text-gray-900'} `}
                        onClick={() => setLineMode('qiniu')}
                    >线路2
                    </button>
                  </div>
                  
                  {/* 提示图标 */}
                  <div className="ml-2 relative group">
                    <div className="w-5 h-5 bg-gray-400 dark:bg-gray-500 rounded-full flex items-center justify-center cursor-help">
                      <span className="text-white text-xs font-bold">?</span>
                    </div>
                    
                    {/* 悬停提示框 - 显示在屏幕中央，避免被遮挡 */}
                    <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-[9999] opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      <div className="px-4 py-3 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-sm rounded-lg shadow-xl max-w-sm mx-4">
                        <div className="font-medium mb-2">线路选择说明：</div>
                        <div className="space-y-2">
                          <div className="flex items-start gap-2">
                            <span><span className="text-blue-300 dark:text-blue-600 font-medium">线路1：</span>此线路是WebRTC实时通信，超低延迟，适合连续对话，不过该通信方式使用了RustPBX，需要安装部署RustPBX, 示例网站可能不支持使用， 如有问题请联系我们。</span>
                          </div>
                          <div className="flex items-start gap-2">
                            <span><span className="text-cyan-300 dark:text-cyan-600 font-medium">线路2：</span>Websocket语音服务，高精度识别，略有延迟</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div
                  ref={voiceBallRef}
                  data-highlighted={showOnboarding && highlightedElement === 'voice-ball' ? 'true' : 'false'}
                  className={highlightedElement === 'voice-ball' ? 'ring-2 ring-blue-500 rounded-xl p-1' : ''}
              >
                <VoiceBall
                    isCalling={isCalling || isRecordingOneShot}
                    onToggleCall={() => {
                      if (callMode === 'realtime') {
                        return isCalling ? stopCall() : startCall()
                      }
                      return isRecordingOneShot ? stopOneShot() : startOneShot()
                    }}
                />
                {showOnboarding && highlightedElement === 'voice-ball' && (
                    <GuideTooltip
                        text={onboardingSteps[onboardingStep].text}
                        position={onboardingSteps[onboardingStep].position as any}
                        onNext={handleNextStep}
                        onClose={handleSkipOnboarding}
                    />
                )}
              </div>

              {/* 状态指示 */}
              <div className="mt-4 text-center">
                <h2 className={`text-sm font-bold transition-all duration-300 ${
                    (isCalling || isRecordingOneShot) ? 'text-sky-600' : 'text-cyan-500'
                }`}>
                  {callMode === 'realtime' ? ((isCalling) ? '通话中...' : '待机中') : ((isRecordingOneShot) ? '录音中...' : '按住说话模式')}
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  {assistants.find(a => a.id === selectedAssistant)?.name || '未选择助手'}
                </p>
                {callMode === 'realtime' && isCalling && (
                    <p className="text-xs text-sky-600 mt-1 font-mono">
                      {Math.floor(callDuration / 60).toString().padStart(2, '0')}:
                      {(callDuration % 60).toString().padStart(2, '0')}
                    </p>
                )}
              </div>
            </div>

            {/* 助手列表区域 */}
            <div className="flex-1 overflow-y-auto border-t dark:border-neutral-700 min-h-0">
              <AssistantList
                  assistants={assistants}
                  selectedAssistant={selectedAssistant}
                  onSelectAssistant={handleSelectAgent}
                  onAddAssistant={() => setShowAddAssistantModal(true)}
                  onConfigAssistant={handleConfigClick}
              />
            </div>
          </div>

          {/* 聊天主区域 */}
          <main className="flex-1 flex overflow-hidden">
            <div
                ref={chatAreaRef}
                data-highlighted={showOnboarding && highlightedElement === 'chat-area' ? 'true' : 'false'}
                className={`flex-1 flex flex-col overflow-hidden relative min-h-0 ${showOnboarding && highlightedElement === 'chat-area' ? 'border-2 border-blue-500' : ''}`}
            >
              <ChatArea
                  messages={chatMessages}
                  isCalling={isCalling}
                  isGlobalMuted={isGlobalMuted}
                  onMuteToggle={setIsGlobalMuted}
                  onNewSession={startNewSession}
                  assistantName={assistants.find(a => a.id === selectedAssistant)?.name}
              />
              {showOnboarding && highlightedElement === 'chat-area' && (
                  <GuideTooltip
                      text={onboardingSteps[onboardingStep].text}
                      position={onboardingSteps[onboardingStep].position as any}
                      onNext={handleNextStep}
                      onClose={handleSkipOnboarding}
                  />
              )}

              {/* 按住说话模式：文本输入框（不影响实时模式） */}
              {callMode === 'press' && (
                  <div
                      ref={textInputRef}
                      className={`border-t dark:border-neutral-700 p-4 bg-gradient-to-r from-sky-50 to-cyan-50 dark:from-sky-900/20 dark:to-cyan-900/20 flex-shrink-0`}
                  >
                    <div className="max-w-2xl mx-auto">
                      <div className="flex items-center gap-3">
                        <Input
                            ref={inputRef}
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            placeholder={isWaitingForResponse ? "正在处理中..." : "输入文本直接发送"}
                            size="md"
                            disabled={isWaitingForResponse}
                            className="shadow-lg border-sky-200 dark:border-sky-800 focus:ring-sky-300 dark:focus:ring-sky-700"
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter') {
                                const value = inputValue.trim()
                                if (!value) return

                                // 校验是否选择了助手
                                if (!selectedAssistant || selectedAssistant === 0) {
                                  showAlert('请先选择一个助手', 'warning')
                                  return
                                }

                                // 生成或使用当前会话ID
                                if (!currentSessionId) {
                                  setCurrentSessionId(`text_${Date.now()}`)
                                }

                                // 先清空输入框
                                setInputValue('')

                                // 设置等待状态
                                setIsWaitingForResponse(true)

                                try {
                                  // 先添加用户消息到聊天记录
                                  addUserMessage(value)

                                  // 添加AI loading消息
                                  const loadingMessageId = addAILoadingMessage()

                                  // 直接用文本走同一条后端链路：/api/voice/oneshot_text
                                  const requestData: OneShotTextRequest = {
                                    assistantId: selectedAssistant || 1,
                                    language,
                                    ...(callMode === 'press' && selectedVoiceCloneId ? {voiceCloneId: selectedVoiceCloneId} : {speaker: selectedSpeaker}),
                                    temperature,
                                    systemPrompt,
                                    instruction,
                                    text: value,
                                    sessionId: currentSessionId || `text_${Date.now()}`,
                                  }

                                  const response = await oneShotText(requestData)
                                  console.log('OneShotText响应:', response)

                                  // 移除loading消息
                                  removeLoadingMessage(loadingMessageId)

                                  // 立即显示文本，不等待音频
                                  if (response.data?.text && response.data.text.trim()) {
                                    console.log('准备添加AI消息:', response.data.text)
                                    console.log('完整响应数据:', response.data)
                                    const messageId = addAIMessage(response.data.text)

                                    // 如果有requestId，开始轮询音频状态
                                    if ((response.data as any)?.requestId) {
                                      console.log('开始轮询音频状态:', (response.data as any).requestId)
                                      pollAudioStatus((response.data as any).requestId, messageId)
                                    } else {
                                      console.log('响应中没有requestId字段')
                                    }
                                  } else {
                                    console.log('响应中没有有效text字段，可能是function tools调用')
                                    // 对于function tools调用，显示一个提示消息
                                    addAIMessage('正在处理您的请求，请稍候...')
                                  }
                                } catch (err: any) {
                                  console.error('文本发送失败:', err)
                                  showAlert(err?.message || '文本发送失败', 'error')
                                } finally {
                                  // 清除等待状态
                                  setIsWaitingForResponse(false)
                                }
                              }
                            }}
                        />
                        <Button
                            variant="primary"
                            size="md"
                            disabled={isWaitingForResponse}
                            onClick={async () => {
                              const value = inputValue.trim()
                              if (!value) return

                              // 校验是否选择了助手
                              if (!selectedAssistant || selectedAssistant === 0) {
                                showAlert('请先选择一个助手', 'warning')
                                return
                              }

                              // 生成或使用当前会话ID
                              if (!currentSessionId) {
                                setCurrentSessionId(`text_${Date.now()}`)
                              }

                              // 先清空输入框
                              setInputValue('')

                              // 设置等待状态
                              setIsWaitingForResponse(true)

                              try {
                                // 先添加用户消息到聊天记录
                                addUserMessage(value)

                                // 添加AI loading消息
                                const loadingMessageId = addAILoadingMessage()

                                const requestData: OneShotTextRequest = {
                                  assistantId: selectedAssistant || 1,
                                  language,
                                  ...(callMode === 'press' && selectedVoiceCloneId ? {voiceCloneId: selectedVoiceCloneId} : {speaker: selectedSpeaker}),
                                  temperature,
                                  systemPrompt,
                                  instruction,
                                  text: value,
                                  sessionId: currentSessionId || `text_${Date.now()}`,
                                }

                                const response = await oneShotText(requestData)
                                console.log('OneShotText响应(按钮):', response)

                                // 移除loading消息
                                removeLoadingMessage(loadingMessageId)

                                // 立即显示文本，不等待音频
                                if (response.data?.text && response.data.text.trim()) {
                                  console.log('准备添加AI消息(按钮):', response.data.text)
                                  const messageId = addAIMessage(response.data.text)

                                  // 如果有requestId，开始轮询音频状态
                                  if ((response.data as any)?.requestId) {
                                    console.log('开始轮询音频状态(按钮):', (response.data as any).requestId)
                                    pollAudioStatus((response.data as any).requestId, messageId)
                                  }
                                } else {
                                  console.log('响应中没有有效text字段(按钮)，可能是function tools调用')
                                  // 对于function tools调用，显示一个提示消息
                                  addAIMessage('正在处理您的请求，请稍候...')
                                }
                              } catch (err: any) {
                                console.error('文本发送失败:', err)
                                showAlert(err?.message || '文本发送失败', 'error')
                              } finally {
                                // 清除等待状态
                                setIsWaitingForResponse(false)
                              }
                            }}
                            className="shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all duration-200 px-6 bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700"
                            animation="scale"
                        >
                          {isWaitingForResponse ? "处理中..." : "发送"}
                        </Button>
                      </div>
                    </div>
                  </div>
              )}
            </div>
          </main>

          {/* 右侧控制面板抽屉 */}
          {isControlPanelOpen && (
            <>
              {/* 背景遮罩 */}
              <div 
                className={`fixed top-14 left-0 right-0 bottom-0 bg-black z-40 transition-opacity duration-300 ease-in-out ${
                  isDrawerAnimating ? 'opacity-50' : 'opacity-0'
                }`}
                onClick={closeDrawer}
              />
              
              {/* 抽屉面板 */}
              <div
                  ref={controlPanelRef}
                  data-highlighted={showOnboarding && highlightedElement === 'control-panel' ? 'true' : 'false'}
                  className={`fixed right-0 top-14 bottom-0 w-[28rem] bg-white dark:bg-neutral-800 border-l dark:border-neutral-700 shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${
                    isDrawerAnimating ? 'translate-x-0' : 'translate-x-full'
                  }`}
              >
                {/* 抽屉头部 */}
                <div className="flex items-center justify-between p-3 border-b dark:border-neutral-700 flex-shrink-0">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">助手配置</h3>
                  <button
                    onClick={closeDrawer}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-lg transition-colors"
                    title="关闭配置面板"
                  >
                    <svg className="w-5 h-5 text-gray-600 dark:text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
                    </svg>
                  </button>
                </div>

                {/* 控制面板内容 */}
                {selectedAssistant !== 0 && (
                <div className={`flex-1 overflow-y-auto transition-opacity duration-300 ease-in-out min-h-0 ${
                  isDrawerAnimating ? 'opacity-100' : 'opacity-0'
                } ${showOnboarding && highlightedElement === 'control-panel' ? 'border-2 border-blue-500' : ''}`}>
                  {callMode === 'realtime' ? (
                      <ControlPanel
                          apiKey={apiKey}
                          apiSecret={apiSecret}
                          onApiKeyChange={setApiKey}
                          onApiSecretChange={setApiSecret}
                          language={language}
                          selectedSpeaker={selectedSpeaker}
                          systemPrompt={systemPrompt}
                          instruction={instruction}
                          temperature={temperature}
                          maxTokens={maxTokens}
                          speed={speed}
                          volume={volume}
                          onLanguageChange={setLanguage}
                          onSpeakerChange={setSelectedSpeaker}
                          onSystemPromptChange={setSystemPrompt}
                          onInstructionChange={setInstruction}
                          onTemperatureChange={setTemperature}
                          onMaxTokensChange={setMaxTokens}
                          onSpeedChange={setSpeed}
                          onVolumeChange={setVolume}
                          onSaveSettings={handleSaveSettings}
                          onDeleteAssistant={() => setShowDeleteConfirm(true)}
                          selectedJSTemplate={selectedJSTemplate}
                          onJSTemplateChange={handleJSTemplateChange}
                          onMethodClick={handleMethodClick}
                          selectedKnowledgeBase={selectedKnowledgeBase}
                          onKnowledgeBaseChange={setSelectedKnowledgeBase}
                          knowledgeBases={knowledgeBases}
                          onManageKnowledgeBases={handleManageKnowledgeBases}
                          onRefreshKnowledgeBases={fetchKnowledgeBases}
                      />
                  ) : (
                      <div
                          className="p-4 space-y-4 bg-gradient-to-br from-sky-50 to-cyan-50 dark:from-sky-900/20 dark:to-cyan-900/20 rounded-xl min-h-0">
                        <div className="flex items-center gap-3 mb-3">
                          <div
                              className="w-7 h-7 bg-gradient-to-br from-sky-500 to-cyan-600 rounded-lg flex items-center justify-center">
                            <Settings className="w-3.5 h-3.5 text-white"/>
                          </div>
                          <div>
                            <h3 className="text-sm font-semibold text-gray-800 dark:text-gray-200">按住说话 -
                              训练音色</h3>
                            <p className="text-xs text-gray-600 dark:text-gray-400">使用您训练的音色进行合成</p>
                          </div>
                        </div>

                          <div className="space-y-3">
                              <FormField label="选择训练音色" hint="选择您已训练的音色进行语音合成">
                                  <div className="flex items-center gap-2">
                                      <Select
                                          className="flex-1"
                                          value={selectedVoiceCloneId?.toString() ?? ''}
                                          onValueChange={(value) => setSelectedVoiceCloneId(value === '' ? null : Number(value) || null)}
                                      >
                                          <SelectTrigger className="flex-1 shadow-sm">
                                              <SelectValue placeholder="选择训练音色">
                                                  {selectedVoiceCloneId === null ? 
                                                      '不使用训练音色'
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
                                              {Array.isArray(voiceClones) && voiceClones.map(vc => (
                                                  <SelectItem key={vc.id} value={vc.id.toString()}>
                                                      {vc.voice_name}
                                                  </SelectItem>
                                              ))}
                                          </SelectContent>
                                      </Select>
                                      <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={async () => {
                                              try {
                                                  const response = await getVoiceClones()
                                                  const list = Array.isArray(response.data) ? response.data : []
                                                  setVoiceClones(list)
                                                  if (list.length && selectedVoiceCloneId == null) setSelectedVoiceCloneId(list[0].id)
                                                  showAlert('音色已刷新', 'success')
                                              } catch (err: any) {
                                                  console.error('刷新音色失败:', err)
                                                  showAlert(err?.msg || err?.message || '刷新音色失败', 'error')
                                              }
                                          }}
                                          leftIcon={<RefreshCw className="w-3 h-3" />}
                                          className="shadow-sm hover:shadow-md hover:scale-105 transition-all duration-200"
                                      >
                                          刷新
                                      </Button>
                                      <Button
                                          variant="primary"
                                          size="sm"
                                          onClick={() => navigate('/voice-training')}
                                          leftIcon={<ArrowRight className="w-3 h-3" />}
                                          className="shadow-sm hover:shadow-md hover:scale-105 transition-all duration-200"
                                      >
                                          去训练
                                      </Button>
                                  </div>
                              </FormField>
                          </div>

                        {/* 知识库配置 */}
                        <div className="space-y-3 pt-2">
                          <div
                              className="p-3 bg-white/50 dark:bg-neutral-800/50 rounded-lg border border-sky-200/50 dark:border-sky-800/50">
                            <FormField label="知识库配置" hint="选择知识库以增强AI回答能力">
                              <div className="space-y-3">
                                <Select
                                    value={selectedKnowledgeBase || '不使用知识库'}
                                    onValueChange={setSelectedKnowledgeBase}
                                >
                                  <SelectTrigger className="w-full shadow-sm">
                                    <SelectValue placeholder="不使用知识库"/>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="">不使用知识库</SelectItem>
                                    {knowledgeBases.map(kb => (
                                        <SelectItem key={kb.id} value={kb.id}>
                                          {kb.name}
                                        </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>

                                {selectedKnowledgeBase && (
                                    <div
                                        className="p-2 bg-sky-50 dark:bg-neutral-700 rounded text-xs text-gray-600 dark:text-gray-300">
                                      当前使用的知识库: {knowledgeBases.find(kb => kb.id === selectedKnowledgeBase)?.name}
                                    </div>
                                )}

                                <div className="flex gap-2">
                                  <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={fetchKnowledgeBases}
                                      leftIcon={<RefreshCw className="w-3 h-3"/>}
                                      className="flex-1 shadow-sm hover:shadow-md"
                                  >
                                    刷新
                                  </Button>
                                  <Button
                                      variant="primary"
                                      size="sm"
                                      onClick={handleManageKnowledgeBases}
                                      className="flex-1 shadow-sm hover:shadow-md"
                                  >
                                    管理
                                  </Button>
                                </div>
                              </div>
                            </FormField>
                          </div>
                        </div>

                        {/* 优化后的表单字段 */}
                        <div className="space-y-4 pt-2">
                          <div
                              className="p-3 bg-white/50 dark:bg-neutral-800/50 rounded-lg border border-sky-200/50 dark:border-sky-800/50">
                            <FormField label="提示词" hint="系统级别的提示词，影响AI的整体行为">
                              <Input
                                  value={systemPrompt}
                                  onValueChange={setSystemPrompt}
                                  placeholder="请输入系统提示词"
                                  size="sm"
                                  showCount
                                  countMax={500}
                                  className="shadow-sm"
                              />
                            </FormField>
                          </div>

                          <div
                              className="p-3 bg-white/50 dark:bg-neutral-800/50 rounded-lg border border-sky-200/50 dark:border-sky-800/50">
                            <FormField label="指令" hint="具体的指令，指导AI如何响应用户">
                              <Input
                                  value={instruction}
                                  onValueChange={setInstruction}
                                  placeholder="请输入指令"
                                  size="sm"
                                  showCount
                                  countMax={300}
                                  className="shadow-sm"
                              />
                            </FormField>
                          </div>

                          <div
                              className="p-3 bg-white/50 dark:bg-neutral-800/50 rounded-lg border border-sky-200/50 dark:border-sky-800/50">
                            <FormField label="温度" hint={`当前值: ${temperature}`}>
                              <div className="space-y-2">
                                <Slider
                                    value={[temperature]}
                                    onValueChange={(value) => setTemperature(value[0])}
                                    min={0}
                                    max={2}
                                    step={0.1}
                                />
                                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
                                  <span>保守 (0.0)</span>
                                  <span>平衡 (1.0)</span>
                                  <span>创意 (2.0)</span>
                                </div>
                              </div>
                            </FormField>
                          </div>

                          <div
                              className="p-3 bg-white/50 dark:bg-neutral-800/50 rounded-lg border border-sky-200/50 dark:border-sky-800/50">
                            <FormField label="最大Token" hint="控制回复的最大长度">
                              <Input
                                  type="number"
                                  value={maxTokens.toString()}
                                  onValueChange={(value) => setMaxTokens(parseInt(value) || 1000)}
                                  placeholder="请输入最大Token数"
                                  size="sm"
                                  min={1}
                                  max={4000}
                                  className="shadow-sm"
                              />
                            </FormField>
                          </div>
                        </div>
                      </div>
                  )}
                  {showOnboarding && highlightedElement === 'control-panel' && (
                      <GuideTooltip
                          text={onboardingSteps[onboardingStep].text}
                          position={onboardingSteps[onboardingStep].position as any}
                          onNext={handleNextStep}
                          onClose={handleSkipOnboarding}
                      />
                  )}
                </div>
                )}

                {/* 未选择助手时的提示 */}
                {selectedAssistant === 0 && (
                    <div className={`flex-1 flex items-center justify-center p-6 transition-opacity duration-300 ease-in-out ${
                      isDrawerAnimating ? 'opacity-100' : 'opacity-0'
                    }`}>
                      <div className="text-center text-gray-500 dark:text-gray-400">
                        <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium mb-2">请先选择一个助手</p>
                        <p className="text-sm">选择助手后可以配置相关参数</p>
                      </div>
                    </div>
                )}
              </div>
            </>
          )}

        </div>

        {/* 模态框 */}
        <AddAssistantModal
            isOpen={showAddAssistantModal}
            onClose={() => setShowAddAssistantModal(false)}
            onAdd={handleAddAssistant}
        />

        <IntegrationModal
            isOpen={showIntegrationModal}
            onClose={() => setShowIntegrationModal(false)}
            selectedMethod={selectedMethod}
            selectedAgent={selectedAssistant}
            jsSourceId={jsSourceId}
        />

        {/* 确认切换助手模态框 */}
        {showConfirmModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-neutral-800 p-6 rounded-xl max-w-md w-full mx-4">
                <h3 className="text-lg font-semibold mb-4">切换助手确认</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  当前正在通话中，切换助手将结束当前通话。确定要切换吗？
                </p>
                <div className="flex justify-end space-x-4">
                  <button
                      onClick={() => setShowConfirmModal(false)}
                      className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-lg"
                  >
                    取消
                  </button>
                  <button
                      onClick={confirmSwitch}
                      className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700"
                  >
                    确定切换
                  </button>
                </div>
              </div>
            </div>
        )}

        {/* 删除确认模态框 */}
        {showDeleteConfirm && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white dark:bg-neutral-800 p-6 rounded-xl max-w-md w-full mx-4">
                <h3 className="text-lg font-semibold mb-4">删除确认</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  确定要删除当前助手吗？此操作不可撤销。
                </p>
                <div className="flex justify-end space-x-4">
                  <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-neutral-700 rounded-lg"
                  >
                    取消
                  </button>
                  <button
                      onClick={handleDeleteAssistant}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    确定删除
                  </button>
                </div>
              </div>
            </div>
        )}


      </div>
  )
}

export default VoiceAssistant
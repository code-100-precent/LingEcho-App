import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mic, PhoneOff, Volume2, VolumeX } from 'lucide-react'
import { cn } from '@/utils/cn'

interface VoiceBallProps {
  isCalling: boolean
  onToggleCall: () => void
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showVolumeIndicator?: boolean
  volumeLevel?: number
  isMuted?: boolean
  onMuteToggle?: () => void
}

const VoiceBall: React.FC<VoiceBallProps> = ({
  isCalling,
  onToggleCall,
  className = '',
  size = 'md',
  showVolumeIndicator = false,
  volumeLevel = 0,
  isMuted = false,
  onMuteToggle
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationRef = useRef<number | null>(null)
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null)
  const [isHovered, setIsHovered] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isFocused, setIsFocused] = useState(false)
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  // 响应式尺寸配置
  const sizeConfig = useMemo(() => {
    const configs = {
      sm: { 
        ball: 'h-12 w-12 sm:h-16 sm:w-16', 
        canvas: 64, 
        button: 'p-1 sm:p-1.5', 
        icon: 'w-3 h-3 sm:w-4 sm:h-4' 
      },
      md: { 
        ball: 'h-16 w-16 sm:h-20 sm:w-20', 
        canvas: 80, 
        button: 'p-1.5 sm:p-2', 
        icon: 'w-4 h-4 sm:w-5 sm:h-5' 
      },
      lg: { 
        ball: 'h-20 w-20 sm:h-24 sm:w-24', 
        canvas: 96, 
        button: 'p-2 sm:p-2.5', 
        icon: 'w-5 h-5 sm:w-6 sm:h-6' 
      },
      xl: { 
        ball: 'h-24 w-24 sm:h-32 sm:w-32', 
        canvas: 128, 
        button: 'p-2.5 sm:p-3', 
        icon: 'w-6 h-6 sm:w-8 sm:h-8' 
      }
    }
    return configs[size]
  }, [size])

  // 检测触摸设备
  useEffect(() => {
    const checkTouchDevice = () => {
      setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0)
    }
    checkTouchDevice()
    window.addEventListener('resize', checkTouchDevice)
    return () => window.removeEventListener('resize', checkTouchDevice)
  }, [])

  // 初始化音频分析器
  useEffect(() => {
    if (isCalling) {
      initAudioContext()
    } else {
      stopAudioContext()
    }
  }, [isCalling])

  useEffect(() => {
    return () => {
      stopAudioContext()
    }
  }, [])

  const initAudioContext = useCallback(async () => {
    try {
      // 检查浏览器支持
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('浏览器不支持getUserMedia API')
      }

      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        } 
      })
      setAudioStream(stream)

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      if (!AudioContextClass) {
        throw new Error('浏览器不支持Web Audio API')
      }

      const audioContext = new AudioContextClass({
        sampleRate: 44100
      })
      
      // 检查音频上下文状态
      if (audioContext.state === 'suspended') {
        await audioContext.resume()
      }

      const analyser = audioContext.createAnalyser()
      analyser.fftSize = 512
      analyser.smoothingTimeConstant = 0.8
      analyser.minDecibels = -90
      analyser.maxDecibels = -10

      const source = audioContext.createMediaStreamSource(stream)
      source.connect(analyser)

      audioContextRef.current = audioContext
      analyserRef.current = analyser
      setIsInitialized(true)

      drawWaveform()
    } catch (err) {
      console.error('麦克风访问失败:', err)
      setIsInitialized(false)
      
      // 显示用户友好的错误信息
      if (err instanceof Error) {
        if (err.name === 'NotAllowedError') {
          console.warn('用户拒绝了麦克风权限')
        } else if (err.name === 'NotFoundError') {
          console.warn('未找到麦克风设备')
        } else if (err.name === 'NotSupportedError') {
          console.warn('浏览器不支持音频功能')
        }
      }
    }
  }, [])

  const stopAudioContext = useCallback(() => {
    // 停止音频流
    if (audioStream) {
      audioStream.getTracks().forEach(track => {
        try {
          track.stop()
          track.enabled = false
        } catch (err) {
          console.warn('停止音频轨道失败:', err)
        }
      })
      setAudioStream(null)
    }

    // 关闭音频上下文
    if (audioContextRef.current) {
      try {
        if (audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close()
            .then(() => {
              console.log('AudioContext成功关闭')
            })
            .catch(err => {
              console.error('关闭AudioContext失败:', err)
            })
        }
      } catch (err) {
        console.warn('关闭AudioContext时出错:', err)
      }
      audioContextRef.current = null
    }

    // 清理分析器引用
    analyserRef.current = null
    setIsInitialized(false)

    // 停止动画帧
    if (animationRef.current) {
      try {
        cancelAnimationFrame(animationRef.current)
      } catch (err) {
        console.warn('取消动画帧失败:', err)
      }
      animationRef.current = null
    }
  }, [audioStream])

  const drawWaveform = useCallback(() => {
    if (!canvasRef.current || !analyserRef.current || !isInitialized) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const analyser = analyserRef.current
    const bufferLength = analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    const timeDataArray = new Uint8Array(bufferLength)

    // 性能优化：减少不必要的重绘
    let lastDrawTime = 0
    const targetFPS = 60
    const frameInterval = 1000 / targetFPS

    const draw = (currentTime: number) => {
      if (currentTime - lastDrawTime < frameInterval) {
        animationRef.current = requestAnimationFrame(draw)
        return
      }
      
      lastDrawTime = currentTime
      animationRef.current = requestAnimationFrame(draw)
      
      analyser.getByteFrequencyData(dataArray)
      analyser.getByteTimeDomainData(timeDataArray)

      // 计算音频级别（使用更高效的算法）
      let sum = 0
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i]
      }
      const average = sum / dataArray.length
      
      // 只在音频级别变化较大时更新状态
      if (Math.abs(average - audioLevel) > 5) {
        setAudioLevel(average)
      }

      // 清空画布
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // 创建径向渐变背景
      const centerX = canvas.width / 2
      const centerY = canvas.height / 2
      const radius = Math.min(canvas.width, canvas.height) / 2
      
      const bgGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius)
      bgGradient.addColorStop(0, 'rgba(99, 102, 241, 0.15)')
      bgGradient.addColorStop(0.7, 'rgba(168, 85, 247, 0.1)')
      bgGradient.addColorStop(1, 'rgba(99, 102, 241, 0.05)')
      ctx.fillStyle = bgGradient
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // 绘制频率条（圆形排列）
      const barCount = Math.min(bufferLength, 64)
      const barWidth = (Math.PI * 2) / barCount
      const centerRadius = radius * 0.3
      const maxBarLength = radius * 0.6

      ctx.save()
      ctx.translate(centerX, centerY)

      for (let i = 0; i < barCount; i++) {
        const barHeight = (dataArray[i] / 255) * maxBarLength
        const angle = (i / barCount) * Math.PI * 2

        // 创建条形渐变
        const barGradient = ctx.createLinearGradient(0, 0, 0, -barHeight)
        barGradient.addColorStop(0, `hsla(${200 + (dataArray[i] / 255) * 60}, 80%, 60%, 0.8)`)
        barGradient.addColorStop(0.5, `hsla(${240 + (dataArray[i] / 255) * 40}, 90%, 70%, 0.9)`)
        barGradient.addColorStop(1, `hsla(${280 + (dataArray[i] / 255) * 20}, 100%, 80%, 1)`)

        ctx.save()
        ctx.rotate(angle)
        ctx.fillStyle = barGradient
        
        // 添加发光效果
        ctx.shadowColor = `hsla(${240 + (dataArray[i] / 255) * 40}, 100%, 70%, 0.8)`
        ctx.shadowBlur = 8
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 0

        // 绘制条形
        const barX = centerRadius
        const barY = -barHeight / 2
        const barW = Math.max(2, barWidth * centerRadius * 0.8)
        
        ctx.fillRect(barX, barY, barW, barHeight)
        
        // 添加高光
        if (barHeight > 5) {
          ctx.fillStyle = `hsla(${240 + (dataArray[i] / 255) * 40}, 100%, 90%, 0.6)`
          ctx.fillRect(barX, barY, barW * 0.3, barHeight)
        }
        
        ctx.restore()
      }

      // 绘制动态粒子
      ctx.shadowBlur = 12
      dataArray.forEach((value, i) => {
        if (i % 6 === 0 && value > 100) {
          const particleAngle = (i / dataArray.length) * Math.PI * 2
          const particleRadius = centerRadius + (value / 255) * maxBarLength * 0.8
          const particleX = Math.cos(particleAngle) * particleRadius
          const particleY = Math.sin(particleAngle) * particleRadius
          const size = (value / 255) * 6 + 2

          ctx.beginPath()
          ctx.arc(particleX, particleY, size, 0, Math.PI * 2)
          ctx.fillStyle = `hsla(${280 + (value / 255) * 40}, 80%, 70%, ${0.4 + (value / 255) * 0.4})`
          ctx.fill()
        }
      })

      // 绘制中心脉冲环
      if (average > 50) {
        const pulseRadius = centerRadius * 0.3 + (average / 255) * centerRadius * 0.4
        ctx.beginPath()
        ctx.arc(0, 0, pulseRadius, 0, Math.PI * 2)
        ctx.strokeStyle = `hsla(${240 + (average / 255) * 40}, 100%, 70%, ${0.3 + (average / 255) * 0.4})`
        ctx.lineWidth = 2
        ctx.shadowBlur = 15
        ctx.stroke()
      }

      ctx.restore()
      ctx.shadowBlur = 0
    }

    draw(0)
  }, [isInitialized, audioLevel])

  // 键盘事件处理
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onToggleCall()
    } else if (event.key === 'Escape' && isCalling) {
      event.preventDefault()
      onToggleCall()
    } else if (event.key === 'm' && onMuteToggle && isCalling) {
      event.preventDefault()
      onMuteToggle()
    }
  }, [onToggleCall, isCalling, onMuteToggle])

  // 触觉反馈
  const triggerHapticFeedback = useCallback(() => {
    if ('vibrate' in navigator) {
      navigator.vibrate([50])
    }
  }, [])

  // 动画变体
  const containerVariants = {
    idle: { scale: 1, rotate: 0 },
    calling: { 
      scale: [1, 1.05, 1], 
      rotate: [0, 2, -2, 0],
      transition: { 
        duration: 2, 
        repeat: Infinity,
        ease: "easeInOut"
      }
    },
    hover: { scale: 1.02 }
  }

  const buttonVariants = {
    idle: { scale: 1, rotate: 0 },
    calling: { 
      scale: [1, 1.1, 1],
      transition: { 
        duration: 1.5, 
        repeat: Infinity,
        ease: "easeInOut"
      }
    },
    hover: { scale: 1.05 },
    tap: { scale: 0.95 }
  }

  const iconVariants = {
    idle: { scale: 1, rotate: 0 },
    calling: { 
      scale: [1, 1.2, 1],
      rotate: [0, 5, -5, 0],
      transition: { 
        duration: 1, 
        repeat: Infinity,
        ease: "easeInOut"
      }
    },
    hover: { scale: 1.1 }
  }

  return (
    <div 
      className={cn('relative group', className)}
      onMouseEnter={() => !isTouchDevice && setIsHovered(true)}
      onMouseLeave={() => !isTouchDevice && setIsHovered(false)}
      onTouchStart={() => isTouchDevice && setIsHovered(true)}
      onTouchEnd={() => isTouchDevice && setIsHovered(false)}
    >
      {/* 背景光晕效果 */}
      <motion.div 
        className="absolute inset-0 rounded-full"
        animate={{
          scale: isCalling ? [1, 1.2, 1] : 1,
          opacity: isCalling ? [0.4, 0.6, 0.4] : 0.4
        }}
        transition={{
          duration: 2,
          repeat: isCalling ? Infinity : 0,
          ease: "easeInOut"
        }}
      >
        <div className="w-full h-full bg-gradient-to-br from-sky-300/40 to-cyan-400/40 blur-xl rounded-full" />
      </motion.div>

      {/* 音频级别指示环 */}
      {isCalling && audioLevel > 30 && (
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-sky-400/60"
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.6, 1, 0.6]
          }}
          transition={{
            duration: 0.5,
            repeat: Infinity,
            ease: "easeInOut"
          }}
          style={{
            transform: `scale(${1 + (audioLevel / 255) * 0.3})`
          }}
        />
      )}

      {/* 主容器 */}
      <motion.div 
        className={cn(
          'relative flex items-center justify-center mx-auto rounded-full shadow-xl',
          sizeConfig.ball,
          isCalling 
            ? 'bg-gradient-to-br from-sky-500 to-cyan-700 shadow-sky-400/50' 
            : 'bg-gradient-to-br from-sky-400 to-cyan-600 shadow-sky-300/50'
        )}
        variants={containerVariants}
        animate={isCalling ? 'calling' : isHovered ? 'hover' : 'idle'}
        whileHover="hover"
      >
        {/* Canvas 音频可视化 */}
        <canvas
          ref={canvasRef}
          className="absolute w-full h-full rounded-full"
          width={sizeConfig.canvas}
          height={sizeConfig.canvas}
        />

        {/* 中心按钮 */}
        <motion.button
          onClick={() => {
            triggerHapticFeedback()
            onToggleCall()
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={cn(
            'rounded-full transition-all shadow-lg z-10 relative overflow-hidden focus:outline-none',
            sizeConfig.button,
            isCalling
              ? 'bg-sky-600 hover:bg-sky-700 shadow-sky-400/50'
              : 'bg-gradient-to-br from-sky-300 to-cyan-500 hover:from-sky-400 hover:to-cyan-600',
            isFocused && ''
          )}
          variants={buttonVariants}
          animate={isCalling ? 'calling' : (isHovered || isFocused) ? 'hover' : 'idle'}
          whileHover="hover"
          whileTap="tap"
          disabled={!isInitialized && isCalling}
          aria-label={isCalling ? '结束通话' : '开始通话'}
          aria-describedby="voice-ball-description"
          role="button"
          tabIndex={0}
        >
          {/* 按钮高光效果 */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/30 to-transparent rounded-full" />
          
          {/* 按钮内容 */}
          <div className="relative z-10">
            <AnimatePresence mode="wait">
              {isCalling ? (
                <motion.div
                  key="phone-off"
                  variants={iconVariants}
                  initial="idle"
                  animate="calling"
                  exit="idle"
                >
                  <PhoneOff className={sizeConfig.icon} />
                </motion.div>
              ) : (
                <motion.div
                  key="mic"
                  variants={iconVariants}
                  initial="idle"
                  animate={isHovered ? 'hover' : 'idle'}
                  exit="idle"
                >
                  <Mic className={sizeConfig.icon} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* 加载状态指示器 */}
          {!isInitialized && isCalling && (
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-white/30 border-t-white"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          )}
        </motion.button>

        {/* 音量指示器 */}
        {showVolumeIndicator && (
          <motion.div
            className="absolute -bottom-2 left-1/2 transform -translate-x-1/2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
          >
            <div className="flex items-center space-x-1 bg-black/50 rounded-full px-2 py-1">
              {isMuted ? (
                <VolumeX className="w-3 h-3" />
              ) : (
                <Volume2 className="w-3 h-3" />
              )}
              <div className="w-8 h-1 bg-white/30 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-white rounded-full"
                  style={{ width: `${Math.min(volumeLevel, 100)}%` }}
                  transition={{ duration: 0.1 }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* 静音按钮 */}
      {onMuteToggle && isCalling && (
        <motion.button
          onClick={() => {
            triggerHapticFeedback()
            onMuteToggle()
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              triggerHapticFeedback()
              onMuteToggle()
            }
          }}
          className="absolute -top-2 -right-2 w-6 h-6 bg-gray-600 hover:bg-gray-700 rounded-full flex items-center justify-center shadow-lg z-20 focus:outline-none"
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0 }}
          aria-label={isMuted ? '取消静音' : '静音'}
          role="button"
          tabIndex={0}
        >
          {isMuted ? (
            <VolumeX className="w-3 h-3" />
          ) : (
            <Volume2 className="w-3 h-3" />
          )}
        </motion.button>
      )}

      {/* 屏幕阅读器描述 */}
      <div id="voice-ball-description" className="sr-only">
        语音球组件，用于控制语音通话。当前状态：{isCalling ? '通话中' : '待机中'}。
        {isCalling && `音频级别：${Math.round(audioLevel)}%`}
        {onMuteToggle && isCalling && `，静音状态：${isMuted ? '已静音' : '未静音'}`}
        使用空格键或回车键切换状态，按M键切换静音状态。
      </div>
    </div>
  )
}

export default VoiceBall

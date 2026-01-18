import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface PerformanceMetrics {
  fps: number
  memory: {
    used: number
    total: number
    percentage: number
  }
  timing: {
    domContentLoaded: number
    loadComplete: number
    firstPaint: number
    firstContentfulPaint: number
  }
  network: {
    effectiveType: string
    downlink: number
    rtt: number
  }
  renderTime: number
  componentCount: number
}

interface PerformanceMonitorProps {
  visible: boolean
  onToggle: () => void
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
}

export const PerformanceMonitor: React.FC<PerformanceMonitorProps> = ({
  visible,
  onToggle,
  position = 'top-left'
}) => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    memory: { used: 0, total: 0, percentage: 0 },
    timing: { domContentLoaded: 0, loadComplete: 0, firstPaint: 0, firstContentfulPaint: 0 },
    network: { effectiveType: 'unknown', downlink: 0, rtt: 0 },
    renderTime: 0,
    componentCount: 0
  })

  const frameCountRef = useRef(0)
  const lastTimeRef = useRef(performance.now())
  const renderStartRef = useRef(0)

  // FPS 计算
  useEffect(() => {
    let animationId: number

    const calculateFPS = () => {
      frameCountRef.current++
      const currentTime = performance.now()
      
      if (currentTime - lastTimeRef.current >= 1000) {
        const fps = Math.round((frameCountRef.current * 1000) / (currentTime - lastTimeRef.current))
        
        setMetrics(prev => ({
          ...prev,
          fps: fps
        }))
        
        frameCountRef.current = 0
        lastTimeRef.current = currentTime
      }
      
      animationId = requestAnimationFrame(calculateFPS)
    }

    if (visible) {
      animationId = requestAnimationFrame(calculateFPS)
    }

    return () => {
      if (animationId) {
        cancelAnimationFrame(animationId)
      }
    }
  }, [visible])

  // 内存和性能指标更新
  useEffect(() => {
    if (!visible) return

    const updateMetrics = () => {
      // 内存使用情况
      if ('memory' in performance) {
        const memory = (performance as any).memory
        setMetrics(prev => ({
          ...prev,
          memory: {
            used: Math.round(memory.usedJSHeapSize / 1024 / 1024),
            total: Math.round(memory.totalJSHeapSize / 1024 / 1024),
            percentage: Math.round((memory.usedJSHeapSize / memory.totalJSHeapSize) * 100)
          }
        }))
      }

      // 页面加载时间
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
      if (navigation) {
        setMetrics(prev => ({
          ...prev,
          timing: {
            domContentLoaded: Math.round(navigation.domContentLoadedEventEnd - navigation.navigationStart),
            loadComplete: Math.round(navigation.loadEventEnd - navigation.navigationStart),
            firstPaint: 0, // 需要通过 PerformanceObserver 获取
            firstContentfulPaint: 0
          }
        }))
      }

      // 网络信息
      if ('connection' in navigator) {
        const connection = (navigator as any).connection
        setMetrics(prev => ({
          ...prev,
          network: {
            effectiveType: connection.effectiveType || 'unknown',
            downlink: connection.downlink || 0,
            rtt: connection.rtt || 0
          }
        }))
      }

      // 组件渲染时间
      const renderTime = performance.now() - renderStartRef.current
      setMetrics(prev => ({
        ...prev,
        renderTime: Math.round(renderTime * 100) / 100,
        componentCount: document.querySelectorAll('[data-react-component]').length
      }))
    }

    renderStartRef.current = performance.now()
    updateMetrics()

    const interval = setInterval(updateMetrics, 1000)
    return () => clearInterval(interval)
  }, [visible])

  // Paint Timing API
  useEffect(() => {
    if (!visible) return

    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      entries.forEach((entry) => {
        if (entry.name === 'first-paint') {
          setMetrics(prev => ({
            ...prev,
            timing: {
              ...prev.timing,
              firstPaint: Math.round(entry.startTime)
            }
          }))
        } else if (entry.name === 'first-contentful-paint') {
          setMetrics(prev => ({
            ...prev,
            timing: {
              ...prev.timing,
              firstContentfulPaint: Math.round(entry.startTime)
            }
          }))
        }
      })
    })

    observer.observe({ entryTypes: ['paint'] })
    return () => observer.disconnect()
  }, [visible])

  const getPositionClasses = () => {
    switch (position) {
      case 'top-right':
        return 'top-4 right-4'
      case 'bottom-left':
        return 'bottom-4 left-4'
      case 'bottom-right':
        return 'bottom-4 right-4'
      default:
        return 'top-4 left-4'
    }
  }

  const getFPSColor = (fps: number) => {
    if (fps >= 55) return 'text-green-400'
    if (fps >= 30) return 'text-yellow-400'
    return 'text-red-400'
  }

  const getMemoryColor = (percentage: number) => {
    if (percentage < 70) return 'text-green-400'
    if (percentage < 85) return 'text-yellow-400'
    return 'text-red-400'
  }

  return (
    <>
      {/* 切换按钮 */}
      <button
        onClick={onToggle}
        className={`fixed ${getPositionClasses()} z-50 bg-black/80 text-white px-2 py-1 rounded text-xs font-mono hover:bg-black/90 transition-colors`}
        title="Toggle Performance Monitor"
      >
        PERF
      </button>

      {/* 性能监控面板 */}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={`fixed ${getPositionClasses()} z-40 w-80 bg-black/95 backdrop-blur-sm rounded-lg p-4 text-white font-mono text-xs border border-gray-700`}
            style={{ marginTop: visible ? '32px' : '0' }}
          >
            <div className="space-y-3">
              {/* FPS */}
              <div className="flex justify-between items-center">
                <span className="text-gray-300">FPS:</span>
                <span className={`font-bold ${getFPSColor(metrics.fps)}`}>
                  {metrics.fps}
                </span>
              </div>

              {/* 内存使用 */}
              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <span className="text-gray-300">Memory:</span>
                  <span className={`font-bold ${getMemoryColor(metrics.memory.percentage)}`}>
                    {metrics.memory.used}MB / {metrics.memory.total}MB
                  </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-1">
                  <div
                    className={`h-1 rounded-full transition-all duration-300 ${
                      metrics.memory.percentage < 70 ? 'bg-green-400' :
                      metrics.memory.percentage < 85 ? 'bg-yellow-400' : 'bg-red-400'
                    }`}
                    style={{ width: `${metrics.memory.percentage}%` }}
                  />
                </div>
              </div>

              {/* 页面加载时间 */}
              <div className="space-y-1">
                <div className="text-gray-300 text-xs">Page Timing:</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">DOM:</span>
                    <span className="text-blue-400">{metrics.timing.domContentLoaded}ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Load:</span>
                    <span className="text-blue-400">{metrics.timing.loadComplete}ms</span>
                  </div>
                  {metrics.timing.firstPaint > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">FP:</span>
                      <span className="text-blue-400">{metrics.timing.firstPaint}ms</span>
                    </div>
                  )}
                  {metrics.timing.firstContentfulPaint > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">FCP:</span>
                      <span className="text-blue-400">{metrics.timing.firstContentfulPaint}ms</span>
                    </div>
                  )}
                </div>
              </div>

              {/* 网络信息 */}
              {metrics.network.effectiveType !== 'unknown' && (
                <div className="space-y-1">
                  <div className="text-gray-300 text-xs">Network:</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Type:</span>
                      <span className="text-purple-400">{metrics.network.effectiveType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">RTT:</span>
                      <span className="text-purple-400">{metrics.network.rtt}ms</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 渲染信息 */}
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Render:</span>
                <span className="text-cyan-400">{metrics.renderTime}ms</span>
              </div>

              {/* 组件数量 */}
              <div className="flex justify-between items-center">
                <span className="text-gray-300">Components:</span>
                <span className="text-cyan-400">{metrics.componentCount}</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

export default PerformanceMonitor
import React, { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Play, 
  Square, 
  Trash2, 
  Save, 
  Mic,
  Volume2,
  AlertCircle,
  Bot,
  MessageSquare,
  Settings,
  XCircle
} from 'lucide-react'
import { cn } from '@/utils/cn'

// 节点类型定义
export interface WorkflowNode {
  id: string
  type: 'start' | 'voice_input' | 'ai_process' | 'voice_output' | 'condition' | 'user_input' | 'end'
  position: { x: number; y: number }
  data: {
    label: string
    config?: any
    [key: string]: any
  }
  inputs: string[]
  outputs: string[]
}

// 连接线定义
export interface WorkflowConnection {
  id: string
  source: string
  target: string
  sourceHandle: string
  targetHandle: string
}

// 工作流定义
export interface Workflow {
  id: string
  name: string
  description: string
  nodes: WorkflowNode[]
  connections: WorkflowConnection[]
  createdAt: string
  updatedAt: string
}

// 节点类型配置
const NODE_TYPES = {
  start: {
    label: '开始',
    icon: <Play className="w-4 h-4" />,
    color: 'bg-green-500',
    inputs: 0,
    outputs: 1
  },
  voice_input: {
    label: '语音输入',
    icon: <Mic className="w-4 h-4" />,
    color: 'bg-blue-500',
    inputs: 1,
    outputs: 1
  },
  ai_process: {
    label: 'AI处理',
    icon: <Bot className="w-4 h-4" />,
    color: 'bg-purple-500',
    inputs: 1,
    outputs: 1
  },
  voice_output: {
    label: '语音输出',
    icon: <Volume2 className="w-4 h-4" />,
    color: 'bg-orange-500',
    inputs: 1,
    outputs: 1
  },
  condition: {
    label: '条件判断',
    icon: <AlertCircle className="w-4 h-4" />,
    color: 'bg-yellow-500',
    inputs: 1,
    outputs: 2
  },
  user_input: {
    label: '用户输入',
    icon: <MessageSquare className="w-4 h-4" />,
    color: 'bg-indigo-500',
    inputs: 1,
    outputs: 1
  },
  end: {
    label: '结束',
    icon: <Square className="w-4 h-4" />,
    color: 'bg-red-500',
    inputs: 1,
    outputs: 0
  }
}

interface WorkflowEditorProps {
  workflow?: Workflow
  onSave?: (workflow: Workflow) => void
  onRun?: (workflow: Workflow) => void
  className?: string
}

const WorkflowEditor: React.FC<WorkflowEditorProps> = ({
  workflow,
  onSave,
  onRun,
  className = ''
}) => {
  const canvasRef = useRef<HTMLDivElement>(null)
  const [nodes, setNodes] = useState<WorkflowNode[]>(workflow?.nodes || [])
  const [connections, setConnections] = useState<WorkflowConnection[]>(workflow?.connections || [])
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [draggedNode, setDraggedNode] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionStart, setConnectionStart] = useState<{ nodeId: string; handle: string } | null>(null)
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isRunning, setIsRunning] = useState(false)
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null)
  const [configuringNode, setConfiguringNode] = useState<string | null>(null)
  const [canvasScale, setCanvasScale] = useState(1)

  // 添加节点
  const addNode = useCallback((type: WorkflowNode['type'], position: { x: number; y: number }) => {
    const defaultConfig = getDefaultNodeConfig(type)
    const newNode: WorkflowNode = {
      id: `node-${Date.now()}`,
      type,
      position,
      data: {
        label: NODE_TYPES[type].label,
        config: defaultConfig
      },
      inputs: Array(NODE_TYPES[type].inputs).fill('').map((_, i) => `input-${i}`),
      outputs: Array(NODE_TYPES[type].outputs).fill('').map((_, i) => `output-${i}`)
    }
    setNodes(prev => [...prev, newNode])
  }, [])

  // 获取默认节点配置
  const getDefaultNodeConfig = (type: WorkflowNode['type']) => {
    switch (type) {
      case 'condition':
        return {
          condition: 'input.includes("订单")',
          trueLabel: '是',
          falseLabel: '否',
          trueOutput: 'output-0',
          falseOutput: 'output-1'
        }
      case 'user_input':
        return {
          prompt: '请输入您的订单号',
          inputType: 'text',
          required: true,
          validation: 'order_number'
        }
      case 'ai_process':
        return {
          model: 'deepseek-v3.1',
          temperature: 0.7,
          maxTokens: 1000,
          systemPrompt: '你是一个智能助手'
        }
      case 'voice_input':
        return {
          language: 'zh-CN',
          sampleRate: 16000,
          format: 'wav'
        }
      case 'voice_output':
        return {
          voice: 'qiniu_zh_female_tmjxxy',
          speed: 1.0,
          pitch: 1.0
        }
      default:
        return {}
    }
  }

  // 删除节点
  const deleteNode = useCallback((nodeId: string) => {
    setNodes(prev => prev.filter(node => node.id !== nodeId))
    setConnections(prev => prev.filter(conn => 
      conn.source !== nodeId && conn.target !== nodeId
    ))
    if (selectedNode === nodeId) {
      setSelectedNode(null)
    }
  }, [selectedNode])

  // 更新节点位置
  const updateNodePosition = useCallback((nodeId: string, position: { x: number; y: number }) => {
    setNodes(prev => prev.map(node => 
      node.id === nodeId ? { ...node, position } : node
    ))
  }, [])

  // 更新节点配置
  const updateNodeConfig = useCallback((nodeId: string, config: any) => {
    setNodes(prev => prev.map(node => 
      node.id === nodeId ? { ...node, data: { ...node.data, config } } : node
    ))
  }, [])

  // 画布控制功能
  const resetCanvasView = useCallback(() => {
    setCanvasOffset({ x: 0, y: 0 })
    setCanvasScale(1)
  }, [])

  const zoomIn = useCallback(() => {
    setCanvasScale(prev => Math.min(prev * 1.2, 3))
  }, [])

  const zoomOut = useCallback(() => {
    setCanvasScale(prev => Math.max(prev / 1.2, 0.3))
  }, [])

  const centerOnNodes = useCallback(() => {
    if (nodes.length === 0) return
    
    const bounds = nodes.reduce((acc, node) => {
      return {
        minX: Math.min(acc.minX, node.position.x),
        minY: Math.min(acc.minY, node.position.y),
        maxX: Math.max(acc.maxX, node.position.x + 192),
        maxY: Math.max(acc.maxY, node.position.y + 48)
      }
    }, { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity })
    
    const centerX = (bounds.minX + bounds.maxX) / 2
    const centerY = (bounds.minY + bounds.maxY) / 2
    
    setCanvasOffset({ x: -centerX + 400, y: -centerY + 300 })
  }, [nodes])

  // 开始连接
  const startConnection = useCallback((nodeId: string, handle: string) => {
    setIsConnecting(true)
    setConnectionStart({ nodeId, handle })
  }, [])

  // 完成连接
  const completeConnection = useCallback((nodeId: string, handle: string) => {
    if (isConnecting && connectionStart && connectionStart.nodeId !== nodeId) {
      // 检查是否已存在相同的连接
      const existingConnection = connections.find(conn => 
        conn.source === connectionStart.nodeId && 
        conn.target === nodeId &&
        conn.sourceHandle === connectionStart.handle &&
        conn.targetHandle === handle
      )
      
      if (!existingConnection) {
        const newConnection: WorkflowConnection = {
          id: `conn-${Date.now()}`,
          source: connectionStart.nodeId,
          target: nodeId,
          sourceHandle: connectionStart.handle,
          targetHandle: handle
        }
        setConnections(prev => [...prev, newConnection])
      }
    }
    setIsConnecting(false)
    setConnectionStart(null)
  }, [isConnecting, connectionStart, connections])

  // 删除连接
  const deleteConnection = useCallback((connectionId: string) => {
    setConnections(prev => prev.filter(conn => conn.id !== connectionId))
    if (selectedConnection === connectionId) {
      setSelectedConnection(null)
    }
  }, [selectedConnection])

  // 画布拖拽处理
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    // 只有在点击画布背景时才开始拖拽
    if (e.target === canvasRef.current || (e.target as Element).tagName === 'svg') {
      setIsDragging(true)
      setDragStart({ x: e.clientX - canvasOffset.x, y: e.clientY - canvasOffset.y })
      e.preventDefault()
    }
  }, [canvasOffset])

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      const newOffset = {
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      }
      setCanvasOffset(newOffset)
    }
  }, [isDragging, dragStart])

  const handleCanvasMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // 节点拖拽处理
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 })
  
  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation()
    e.preventDefault()
    
    const rect = canvasRef.current?.getBoundingClientRect()
    if (rect) {
      const node = nodes.find(n => n.id === nodeId)
      if (node) {
        // 计算鼠标相对于节点的偏移量
        // 注意：这里要使用鼠标在画布中的实际位置
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top
        
        // 节点在画布中的实际位置（考虑画布偏移）
        const nodeX = node.position.x + canvasOffset.x
        const nodeY = node.position.y + canvasOffset.y
        
        // 计算偏移量
        const offsetX = mouseX - nodeX
        const offsetY = mouseY - nodeY
        
        setDragOffset({ x: offsetX, y: offsetY })
        setDraggedNode(nodeId)
        setSelectedNode(nodeId)
      }
    }
  }, [nodes, canvasOffset])


  // 保存工作流
  const handleSave = useCallback(() => {
    if (onSave) {
      const savedWorkflow: Workflow = {
        id: workflow?.id || `workflow-${Date.now()}`,
        name: workflow?.name || '未命名工作流',
        description: workflow?.description || '',
        nodes,
        connections,
        createdAt: workflow?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      onSave(savedWorkflow)
    }
  }, [workflow, nodes, connections, onSave])

  // 运行工作流
  const handleRun = useCallback(async () => {
    if (onRun) {
      setIsRunning(true)
      const currentWorkflow: Workflow = {
        id: workflow?.id || `workflow-${Date.now()}`,
        name: workflow?.name || '未命名工作流',
        description: workflow?.description || '',
        nodes,
        connections,
        createdAt: workflow?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      try {
        await onRun(currentWorkflow)
      } finally {
        setIsRunning(false)
      }
    }
  }, [workflow, nodes, connections, onRun])

  // 渲染连接线
  const renderConnections = () => {
    return connections.map(connection => {
      const sourceNode = nodes.find(n => n.id === connection.source)
      const targetNode = nodes.find(n => n.id === connection.target)
      
      if (!sourceNode || !targetNode) return null

      const sourceX = sourceNode.position.x + 192 // 节点右边缘
      const sourceY = sourceNode.position.y + 24  // 节点中心
      const targetX = targetNode.position.x       // 节点左边缘
      const targetY = targetNode.position.y + 24  // 节点中心

      const isSelected = selectedConnection === connection.id

      return (
        <g key={connection.id}>
          {/* 可点击的连接线背景（更粗，透明） */}
          <line
            x1={sourceX}
            y1={sourceY}
            x2={targetX}
            y2={targetY}
            stroke="transparent"
            strokeWidth="20"
            className="cursor-pointer"
            onClick={() => setSelectedConnection(connection.id)}
          />
          {/* 可见的连接线 */}
          <motion.line
            x1={sourceX}
            y1={sourceY}
            x2={targetX}
            y2={targetY}
            stroke={isSelected ? "#ef4444" : "#6366f1"}
            strokeWidth={isSelected ? "3" : "2"}
            markerEnd="url(#arrowhead)"
            className="pointer-events-none"
            whileHover={{ strokeWidth: 3 }}
          />
        </g>
      )
    })
  }

  // 验证工作流
  const validateWorkflow = () => {
    const startNodes = nodes.filter(n => n.type === 'start')
    const endNodes = nodes.filter(n => n.type === 'end')
    
    if (startNodes.length === 0) {
      return { valid: false, message: '工作流必须有一个开始节点' }
    }
    if (startNodes.length > 1) {
      return { valid: false, message: '工作流只能有一个开始节点' }
    }
    if (endNodes.length === 0) {
      return { valid: false, message: '工作流必须有一个结束节点' }
    }
    
    return { valid: true, message: '工作流验证通过' }
  }

  const validation = validateWorkflow()

  // 渲染节点配置面板
  const renderNodeConfigPanel = () => {
    if (!configuringNode) return null
    
    const node = nodes.find(n => n.id === configuringNode)
    if (!node) return null

    return (
      <div className="absolute top-4 right-4 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              配置 {node.data.label}
            </h3>
            <button
              onClick={() => setConfiguringNode(null)}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="p-4 space-y-4">
          {node.type === 'condition' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  判断条件
                </label>
                <input
                  type="text"
                  value={node.data.config.condition || ''}
                  onChange={(e) => updateNodeConfig(node.id, { ...node.data.config, condition: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="例如: input.includes('订单')"
                />
                <p className="text-xs text-gray-500 mt-1">
                  使用 input 变量引用输入数据
                </p>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    是分支标签
                  </label>
                  <input
                    type="text"
                    value={node.data.config.trueLabel || ''}
                    onChange={(e) => updateNodeConfig(node.id, { ...node.data.config, trueLabel: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="是"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    否分支标签
                  </label>
                  <input
                    type="text"
                    value={node.data.config.falseLabel || ''}
                    onChange={(e) => updateNodeConfig(node.id, { ...node.data.config, falseLabel: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    placeholder="否"
                  />
                </div>
              </div>
            </div>
          )}
          
          {node.type === 'user_input' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  提示信息
                </label>
                <input
                  type="text"
                  value={node.data.config.prompt || ''}
                  onChange={(e) => updateNodeConfig(node.id, { ...node.data.config, prompt: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="请输入您的订单号"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  输入类型
                </label>
                <select
                  value={node.data.config.inputType || 'text'}
                  onChange={(e) => updateNodeConfig(node.id, { ...node.data.config, inputType: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="text">文本</option>
                  <option value="number">数字</option>
                  <option value="email">邮箱</option>
                  <option value="phone">电话</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  验证规则
                </label>
                <select
                  value={node.data.config.validation || ''}
                  onChange={(e) => updateNodeConfig(node.id, { ...node.data.config, validation: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">无验证</option>
                  <option value="order_number">订单号</option>
                  <option value="phone_number">手机号</option>
                  <option value="email">邮箱地址</option>
                  <option value="required">必填</option>
                </select>
              </div>
            </div>
          )}
          
          {node.type === 'ai_process' && (
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  系统提示词
                </label>
                <textarea
                  value={node.data.config.systemPrompt || ''}
                  onChange={(e) => updateNodeConfig(node.id, { ...node.data.config, systemPrompt: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={3}
                  placeholder="你是一个智能客服助手"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    温度
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="2"
                    step="0.1"
                    value={node.data.config.temperature || 0.7}
                    onChange={(e) => updateNodeConfig(node.id, { ...node.data.config, temperature: parseFloat(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    最大令牌数
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="4000"
                    value={node.data.config.maxTokens || 1000}
                    onChange={(e) => updateNodeConfig(node.id, { ...node.data.config, maxTokens: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // 全局鼠标事件监听
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (draggedNode) {
        const rect = canvasRef.current?.getBoundingClientRect()
        if (rect) {
          // 计算鼠标在画布中的位置
          const mouseX = e.clientX - rect.left
          const mouseY = e.clientY - rect.top
          
          // 计算新的节点位置，保持鼠标相对于节点的偏移量
          const x = mouseX - canvasOffset.x - dragOffset.x
          const y = mouseY - canvasOffset.y - dragOffset.y
          
          // 无限画布，不限制节点位置
          updateNodePosition(draggedNode, { x, y })
        }
      }
    }

    const handleGlobalMouseUp = () => {
      setDraggedNode(null)
      setDragOffset({ x: 0, y: 0 })
    }

    if (draggedNode) {
      document.addEventListener('mousemove', handleGlobalMouseMove)
      document.addEventListener('mouseup', handleGlobalMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove)
      document.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [draggedNode, canvasOffset, dragOffset, updateNodePosition])

  // 键盘事件监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedConnection) {
        deleteConnection(selectedConnection)
      }
      if (e.key === 'Escape') {
        setSelectedConnection(null)
        setIsConnecting(false)
        setConnectionStart(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [selectedConnection, deleteConnection])

  return (
    <div className={cn('flex flex-col h-full bg-gray-50 dark:bg-gray-900', className)}>
      {/* 工具栏 */}
      <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            工作流编辑器
          </h2>
          {!validation.valid && (
            <div className="flex items-center text-red-600 text-sm">
              <AlertCircle className="w-4 h-4 mr-1" />
              {validation.message}
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {/* 画布控制按钮 */}
          <div className="flex items-center space-x-1 border-r border-gray-200 dark:border-gray-700 pr-2">
            <motion.button
              onClick={zoomOut}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="缩小"
            >
              <span className="text-lg font-bold">-</span>
            </motion.button>
            
            <span className="text-sm text-gray-600 dark:text-gray-400 min-w-[3rem] text-center">
              {Math.round(canvasScale * 100)}%
            </span>
            
            <motion.button
              onClick={zoomIn}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="放大"
            >
              <span className="text-lg font-bold">+</span>
            </motion.button>
            
            <motion.button
              onClick={resetCanvasView}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="重置视图"
            >
              <span className="text-sm">重置</span>
            </motion.button>
            
            <motion.button
              onClick={centerOnNodes}
              className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="居中显示所有节点"
            >
              <span className="text-sm">居中</span>
            </motion.button>
          </div>

          {selectedConnection && (
            <motion.button
              onClick={() => deleteConnection(selectedConnection)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              删除连接
            </motion.button>
          )}
          
          <motion.button
            onClick={handleRun}
            disabled={!validation.valid || isRunning}
            className={cn(
              'px-4 py-2 rounded-lg transition-colors flex items-center',
              validation.valid && !isRunning
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            )}
            whileHover={validation.valid && !isRunning ? { scale: 1.05 } : {}}
            whileTap={validation.valid && !isRunning ? { scale: 0.95 } : {}}
          >
            {isRunning ? (
              <>
                <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                运行中...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                运行
              </>
            )}
          </motion.button>
          
          <motion.button
            onClick={handleSave}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Save className="w-4 h-4 mr-2" />
            保存
          </motion.button>
        </div>
      </div>

      <div className="flex flex-1">
        {/* 节点面板 */}
        <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
            节点类型
          </h3>
          <div className="space-y-2 mb-6">
            {Object.entries(NODE_TYPES).map(([type, config]) => (
              <motion.div
                key={type}
                className="flex items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => addNode(type as WorkflowNode['type'], { x: 200, y: 200 })}
              >
                <div className={cn('p-2 rounded-lg text-white mr-3', config.color)}>
                  {config.icon}
                </div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {config.label}
                </span>
              </motion.div>
            ))}
          </div>
          
          {/* 操作说明 */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
              操作说明
            </h4>
            <div className="space-y-3 text-xs text-gray-600 dark:text-gray-400">
              <div>
                <p className="font-medium mb-1">连接操作：</p>
                <div className="flex items-center mb-1">
                  <div className="w-3 h-3 bg-blue-500 rounded-full mr-2"></div>
                  <span>蓝色点：输出连接点</span>
                </div>
                <div className="flex items-center mb-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                  <span>绿色点：输入连接点</span>
                </div>
                <p className="mb-1">• 点击蓝色点开始连接</p>
                <p className="mb-1">• 拖拽到绿色点完成连接</p>
                <p className="mb-1">• 点击连接线选中连接</p>
                <p className="mb-1">• 点击"删除连接"按钮删除</p>
                <p className="mb-2">• 按Delete键删除选中连接</p>
              </div>
              
              <div>
                <p className="font-medium mb-1">画布操作：</p>
                <p className="mb-1">• 拖拽空白区域移动画布</p>
                <p className="mb-1">• 拖拽节点调整位置（无限画布）</p>
                <p className="mb-1">• 使用 +/- 按钮缩放画布</p>
                <p className="mb-1">• 点击"重置"恢复默认视图</p>
                <p className="mb-1">• 点击"居中"显示所有节点</p>
                <p className="mb-1">• 点击节点选中，显示配置按钮</p>
                <p>• 点击设置按钮配置节点参数</p>
              </div>
            </div>
          </div>
        </div>

        {/* 画布区域 */}
        <div className="flex-1 relative overflow-auto">
          <div
            ref={canvasRef}
            className="relative cursor-grab active:cursor-grabbing"
            style={{ 
              width: '200vw', 
              height: '100vh',
              minWidth: '100%',
              minHeight: '100%'
            }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
          >
            {/* SVG 连接线层 */}
            <svg
              className="absolute inset-0 w-full h-full"
              style={{ 
                zIndex: 1,
                transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${canvasScale})`,
                transformOrigin: '0 0'
              }}
            >
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="7"
                  refX="9"
                  refY="3.5"
                  orient="auto"
                >
                  <polygon
                    points="0 0, 10 3.5, 0 7"
                    fill="#6366f1"
                  />
                </marker>
              </defs>
              {renderConnections()}
            </svg>

            {/* 节点层 */}
            <div
              className="absolute inset-0"
              style={{
                transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${canvasScale})`,
                transformOrigin: '0 0',
                zIndex: 2
              }}
            >
              {nodes.map(node => {
                const nodeConfig = NODE_TYPES[node.type]
                return (
                  <motion.div
                    key={node.id}
                    className={cn(
                      'absolute w-48 h-12 bg-white dark:bg-gray-800 border-2 rounded-lg shadow-lg cursor-move select-none',
                      selectedNode === node.id 
                        ? 'border-purple-500 shadow-purple-200' 
                        : 'border-gray-200 dark:border-gray-600',
                      draggedNode === node.id ? 'z-50' : 'z-10'
                    )}
                    style={{
                      left: node.position.x,
                      top: node.position.y
                    }}
                    onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ 
                      opacity: 1, 
                      scale: draggedNode === node.id ? 1.05 : 1,
                      boxShadow: draggedNode === node.id ? '0 10px 25px rgba(0,0,0,0.2)' : '0 4px 6px rgba(0,0,0,0.1)'
                    }}
                    transition={{ duration: 0.2 }}
                  >
                    <div className="flex items-center h-full px-3">
                      <div className={cn('p-1.5 rounded-lg text-white mr-3', nodeConfig.color)}>
                        {nodeConfig.icon}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {node.data.label}
                        </div>
                      </div>
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setConfiguringNode(node.id)
                          }}
                          className={cn(
                            "p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-opacity",
                            selectedNode === node.id ? "opacity-100" : "opacity-0"
                          )}
                          title="配置节点"
                        >
                          <Settings className="w-3 h-3 text-gray-500" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteNode(node.id)
                          }}
                          className={cn(
                            "p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-opacity",
                            selectedNode === node.id ? "opacity-100" : "opacity-0"
                          )}
                          title="删除节点"
                        >
                          <Trash2 className="w-3 h-3 text-gray-500" />
                        </button>
                      </div>
                    </div>

                    {/* 输入连接点 (绿色) */}
                    {node.inputs.map((input, index) => (
                      <div
                        key={input}
                        className={cn(
                          "absolute w-3 h-3 rounded-full cursor-pointer border-2 border-white shadow-sm transition-all",
                          isConnecting && connectionStart?.nodeId !== node.id
                            ? "bg-green-500 hover:bg-green-600 scale-110"
                            : "bg-green-500 hover:bg-green-600"
                        )}
                        style={{
                          left: -6,
                          top: 18 + index * 16
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation()
                          if (isConnecting) {
                            completeConnection(node.id, input)
                          }
                        }}
                        title="输入连接点 - 点击完成连接"
                      />
                    ))}

                    {/* 输出连接点 (蓝色) */}
                    {node.outputs.map((output, index) => (
                      <div
                        key={output}
                        className={cn(
                          "absolute w-3 h-3 rounded-full cursor-pointer border-2 border-white shadow-sm transition-all",
                          !isConnecting
                            ? "bg-blue-500 hover:bg-blue-600"
                            : "bg-gray-400 cursor-not-allowed"
                        )}
                        style={{
                          right: -6,
                          top: 18 + index * 16
                        }}
                        onMouseDown={(e) => {
                          e.stopPropagation()
                          if (!isConnecting) {
                            startConnection(node.id, output)
                          }
                        }}
                        title="输出连接点 - 点击开始连接"
                      />
                    ))}
                  </motion.div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      
      {/* 节点配置面板 */}
      {renderNodeConfigPanel()}
    </div>
  )
}

export default WorkflowEditor
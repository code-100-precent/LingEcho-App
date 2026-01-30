import React, { useState, useRef, useCallback, useEffect, Suspense, lazy } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Play, 
  Square, 
  Trash2, 
  AlertCircle,
  Settings,
  FileText,
  GitBranch,
  Zap,
  Clock,
  Timer,
  Code,
  HelpCircle,
  Plus,
  Search,
  X,
  Maximize2,
  Minimize2,
  TestTube,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Package,
  CheckCircle
} from 'lucide-react'
import { cn } from '@/utils/cn'
import Modal from '@/components/UI/Modal'
import Button from '@/components/UI/Button'
import Input from '@/components/UI/Input'
import { showAlert } from '@/utils/notification'
import { workflowService } from '@/api/workflow'
import { workflowPluginService, WorkflowPluginCategory } from '@/api/workflowPlugin'
import { useI18nStore } from '@/stores/i18nStore'

// 懒加载Monaco Editor，优化首次加载性能
const MonacoEditor = lazy(() => import('@monaco-editor/react'))

// 节点类型定义（根据后端定义）
export interface WorkflowNode {
  id: string
  type: 'start' | 'end' | 'task' | 'gateway' | 'event' | 'subflow' | 'parallel' | 'wait' | 'timer' | 'script' | 'plugin' | 'workflow_plugin'
  position: { x: number; y: number }
  data: {
    label: string
    config?: any
    pluginId?: number // 插件ID，用于插件节点
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
  type?: 'default' | 'true' | 'false' | 'error' | 'branch'
  condition?: string
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

// 获取节点类型配置的函数（支持国际化）- 优化后的现代化设计
const getNodeTypes = (t: (key: string) => string) => ({
  start: {
    label: t('workflow.nodes.start'),
    icon: <Play className="w-5 h-5" />,
    color: '#059669', // 更深的绿色
    gradient: 'from-emerald-400 to-emerald-600',
    shadowColor: 'shadow-emerald-200',
    inputs: 0,
    outputs: 1
  },
  end: {
    label: t('workflow.nodes.end'),
    icon: <Square className="w-5 h-5" />,
    color: '#dc2626', // 更深的红色
    gradient: 'from-red-400 to-red-600',
    shadowColor: 'shadow-red-200',
    inputs: 1,
    outputs: 0
  },
  task: {
    label: t('workflow.nodes.task'),
    icon: <FileText className="w-5 h-5" />,
    color: '#2563eb', // 更深的蓝色
    gradient: 'from-blue-400 to-blue-600',
    shadowColor: 'shadow-blue-200',
    inputs: 1,
    outputs: 1
  },
  gateway: {
    label: t('workflow.nodes.gateway'),
    icon: <GitBranch className="w-5 h-5" />,
    color: '#7c3aed', // 更深的紫色
    gradient: 'from-violet-400 to-violet-600',
    shadowColor: 'shadow-violet-200',
    inputs: 1,
    outputs: 2
  },
  event: {
    label: t('workflow.nodes.event'),
    icon: <Zap className="w-5 h-5" />,
    color: '#d97706', // 更深的橙色
    gradient: 'from-amber-400 to-orange-500',
    shadowColor: 'shadow-amber-200',
    inputs: 0,
    outputs: 1
  },
  subflow: {
    label: t('workflow.nodes.subflow'),
    icon: <Settings className="w-5 h-5" />,
    color: '#4f46e5', // 更深的靛蓝色
    gradient: 'from-indigo-400 to-indigo-600',
    shadowColor: 'shadow-indigo-200',
    inputs: 1,
    outputs: 1
  },
  parallel: {
    label: t('workflow.nodes.parallel'),
    icon: <GitBranch className="w-5 h-5 rotate-90" />,
    color: '#0891b2', // 更深的青色
    gradient: 'from-cyan-400 to-cyan-600',
    shadowColor: 'shadow-cyan-200',
    inputs: 1,
    outputs: 2
  },
  wait: {
    label: t('workflow.nodes.wait'),
    icon: <Clock className="w-5 h-5" />,
    color: '#be185d', // 更深的粉色
    gradient: 'from-pink-400 to-pink-600',
    shadowColor: 'shadow-pink-200',
    inputs: 1,
    outputs: 1
  },
  timer: {
    label: t('workflow.nodes.timer'),
    icon: <Timer className="w-5 h-5" />,
    color: '#0d9488', // 更深的青绿色
    gradient: 'from-teal-400 to-teal-600',
    shadowColor: 'shadow-teal-200',
    inputs: 1,
    outputs: 1
  },
  script: {
    label: t('workflow.nodes.script'),
    icon: <Code className="w-5 h-5" />,
    color: '#475569', // 更深的灰色
    gradient: 'from-slate-400 to-slate-600',
    shadowColor: 'shadow-slate-200',
    inputs: 1,
    outputs: 1
  },
  plugin: {
    label: t('workflow.nodes.plugin'),
    icon: <Package className="w-5 h-5" />,
    color: '#7c2d12', // 棕色
    gradient: 'from-orange-400 to-orange-600',
    shadowColor: 'shadow-orange-200',
    inputs: 1,
    outputs: 1
  },
  workflow_plugin: {
    label: t('workflow.nodes.workflowPlugin'),
    icon: <Package className="w-5 h-5" />,
    color: '#7c3aed', // 紫色
    gradient: 'from-purple-400 to-purple-600',
    shadowColor: 'shadow-purple-200',
    inputs: 1,
    outputs: 1
  }
})

interface WorkflowEditorProps {
  workflow?: Workflow
  onSave?: (workflow: Workflow) => void
  onRun?: (workflow: Workflow, parameters?: Record<string, any>) => void
  workflowId?: number // 工作流ID，用于节点测试
  className?: string
}

const WorkflowEditor: React.FC<WorkflowEditorProps> = ({
  workflow,
  onSave,
  onRun,
  workflowId,
  className = ''
}) => {
  const { t } = useI18nStore()
  const NODE_TYPES = getNodeTypes(t)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [nodes, setNodes] = useState<WorkflowNode[]>(workflow?.nodes || [])
  const [connections, setConnections] = useState<WorkflowConnection[]>(workflow?.connections || [])
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [draggedNode, setDraggedNode] = useState<string | null>(null)
  const [isConnecting, setIsConnecting] = useState(false)
  const [connectionStart, setConnectionStart] = useState<{ nodeId: string; handle: string } | null>(null)
  const [canvasOffset, setCanvasOffset] = useState({ x: 100000, y: 100000 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [isRunning, setIsRunning] = useState(false)
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null)
  const [configuringNode, setConfiguringNode] = useState<string | null>(null)
  const [canvasScale, setCanvasScale] = useState(1)
  const [showHelpModal, setShowHelpModal] = useState(false)
  const [showNodeDrawer, setShowNodeDrawer] = useState(false)
  const [installedPlugins, setInstalledPlugins] = useState<any[]>([])
  const [loadingPlugins, setLoadingPlugins] = useState(false)
  const [nodeSearchQuery, setNodeSearchQuery] = useState('')
  const [isCodeEditorFullscreen, setIsCodeEditorFullscreen] = useState(false)

  // 加载已安装的插件
  const loadInstalledPlugins = useCallback(async () => {
    setLoadingPlugins(true)
    try {
      const response = await workflowPluginService.listInstalledWorkflowPlugins()
      if (response.data) {
        setInstalledPlugins(response.data)
      }
    } catch (error) {
      console.error('加载已安装插件失败:', error)
    } finally {
      setLoadingPlugins(false)
    }
  }, [])

  // 组件挂载时加载插件
  useEffect(() => {
    loadInstalledPlugins()
  }, [])
  const [showPublishModal, setShowPublishModal] = useState(false)
  const [showRunParamsModal, setShowRunParamsModal] = useState(false)
  const [runParameters, setRunParameters] = useState<Record<string, string>>({})
  const [availableEventTypes, setAvailableEventTypes] = useState<string[]>([])
  const [loadingEventTypes, setLoadingEventTypes] = useState(false)
  const [showGatewayHelp, setShowGatewayHelp] = useState(false)
  const [showNodeTestModal, setShowNodeTestModal] = useState(false)
  const [testingNode, setTestingNode] = useState<string | null>(null)
  const [nodeTestParameters, setNodeTestParameters] = useState<Record<string, string>>({})
  const [nodeTestResult, setNodeTestResult] = useState<any>(null)
  const [isTestingNode, setIsTestingNode] = useState(false)
  


  // 添加节点
  const addNode = useCallback((type: WorkflowNode['type'], position: { x: number; y: number }) => {
    const defaultConfig = getDefaultNodeConfig(type)
    const nodeId = `node-${Date.now()}`
    const newNode: WorkflowNode = {
      id: nodeId,
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
    // 选中新添加的节点
    setSelectedNode(nodeId)
    return nodeId
  }, [])

  // 添加插件节点
  const addPluginNode = useCallback((plugin: any, position: { x: number; y: number }) => {
    const nodeId = `plugin-${Date.now()}`
    const newNode: WorkflowNode = {
      id: nodeId,
      type: 'workflow_plugin',
      position,
      data: {
        label: plugin.plugin?.displayName || plugin.plugin?.name || '插件节点',
        config: {
          pluginId: plugin.pluginId,
          parameters: {}
        },
        pluginId: plugin.pluginId
      },
      inputs: plugin.plugin?.inputSchema?.parameters?.map((p: any, i: number) => p.name || `input-${i}`) || ['input-0'],
      outputs: plugin.plugin?.outputSchema?.parameters?.map((p: any, i: number) => p.name || `output-${i}`) || ['output-0']
    }
    setNodes(prev => [...prev, newNode])
    // 选中新添加的节点
    setSelectedNode(nodeId)
    return nodeId
  }, [])

  // 获取默认节点配置
  const getDefaultNodeConfig = (type: WorkflowNode['type']) => {
    switch (type) {
      case 'gateway':
        return {
          condition: 'context.value > 0',
          trueLabel: '是',
          falseLabel: '否'
        }
      case 'task':
        return {
          action: 'process_data',
          timeout: 30000
        }
      case 'event':
        return {
          eventType: 'user_action',
          trigger: 'click'
        }
      case 'subflow':
        return {
          workflowId: '',
          workflowName: ''
        }
      case 'parallel':
        return {
          branches: 2,
          waitAll: true
        }
      case 'wait':
        return {
          duration: 5000,
          untilEvent: ''
        }
      case 'timer':
        return {
          delay: 1000,
          repeat: false
        }
      case 'script':
        return {
          language: 'go',
          code: `// Go 脚本示例
// 必须定义一个 Run 函数，接收 inputs 并返回结果

func Run(inputs map[string]interface{}) (map[string]interface{}, error) {
	// 从 inputs 中获取输入数据
	// inputs 是一个 map，键是输入参数的别名（如 "input-0"）
	
	// 示例：获取第一个输入
	var input interface{}
	if val, ok := inputs["input-0"]; ok {
		input = val
	}
	
	// 处理逻辑
	result := map[string]interface{}{
		"output": input,
		"processed": true,
	}
	
	return result, nil
}`
        }
      case 'plugin':
        return {
          pluginId: null,
          parameters: {}
        }
      case 'workflow_plugin':
        return {
          pluginId: null,
          parameters: {}
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
    setCanvasOffset({ x: 100000, y: 100000 })
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
          maxX: Math.max(acc.maxX, node.position.x + 180),
          maxY: Math.max(acc.maxY, node.position.y + 50)
      }
    }, { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity })
    
    const centerX = (bounds.minX + bounds.maxX) / 2
    const centerY = (bounds.minY + bounds.maxY) / 2
    
    // 计算偏移，使节点居中（考虑画布从 -100000px 开始）
    // 节点层的实际屏幕位置：-100000 + canvasOffset.x + node.position.x * canvasScale
    // 要让节点中心在屏幕中心：rect.width/2 = -100000 + canvasOffset.x + centerX * canvasScale
    // 所以：canvasOffset.x = rect.width/2 + 100000 - centerX * canvasScale
    const rect = canvasRef.current?.getBoundingClientRect()
    if (rect) {
      const viewportCenterX = rect.width / 2
      const viewportCenterY = rect.height / 2
      setCanvasOffset({ 
        x: viewportCenterX + 100000 - centerX * canvasScale, 
        y: viewportCenterY + 100000 - centerY * canvasScale 
      })
    }
  }, [nodes, canvasScale])

  // 删除连接 - 移到前面避免初始化顺序问题
  const deleteConnection = useCallback((connectionId: string) => {
    setConnections(prev => prev.filter(conn => conn.id !== connectionId))
    if (selectedConnection === connectionId) {
      setSelectedConnection(null)
    }
  }, [selectedConnection])

  // 点击画布取消选择


  // 检查输出点是否已经有连接
  const isOutputConnected = useCallback((nodeId: string, outputHandle: string) => {
    return connections.some(conn => 
      conn.source === nodeId && conn.sourceHandle === outputHandle
    )
  }, [connections])

  // 开始连接
  const startConnection = useCallback((nodeId: string, handle: string) => {
    setIsConnecting(true)
    setConnectionStart({ nodeId, handle })
  }, [])

  // 完成连接
  // 连接规则：
  // 1. 一个输出只能连接到一个输入（限制输出点只能连接一次）
  // 2. 不允许创建完全相同的连接（相同的 source, target, sourceHandle, targetHandle）
  // 3. 一个输入可以接收多个输出（支持数据合并）
  const completeConnection = useCallback((nodeId: string, handle: string) => {
    if (isConnecting && connectionStart && connectionStart.nodeId !== nodeId) {
      // 检查源输出点是否已经连接
      const sourceAlreadyConnected = connections.some(conn => 
        conn.source === connectionStart.nodeId && conn.sourceHandle === connectionStart.handle
      )
      
      if (sourceAlreadyConnected) {
        console.log('输出点已经连接，无法再次连接')
        setIsConnecting(false)
        setConnectionStart(null)
        return
      }
      
      // 检查是否已存在完全相同的连接（防止重复连接）
      const existingConnection = connections.find(conn => 
        conn.source === connectionStart.nodeId && 
        conn.target === nodeId &&
        conn.sourceHandle === connectionStart.handle &&
        conn.targetHandle === handle
      )
      
      if (!existingConnection) {
        // 根据源节点类型和 sourceHandle 确定边的类型
        const sourceNode = nodes.find(n => n.id === connectionStart.nodeId)
        let edgeType: 'default' | 'true' | 'false' | 'error' | 'branch' | undefined = 'default'
        
        if (sourceNode) {
          if (sourceNode.type === 'gateway') {
            // 对于 condition/gateway 节点，根据 sourceHandle 确定类型
            const outputIndex = sourceNode.outputs.findIndex(o => o === connectionStart.handle)
            if (outputIndex === 0) {
              edgeType = 'true'
            } else if (outputIndex === 1) {
              edgeType = 'false'
            }
          } else if (sourceNode.type === 'parallel') {
            // 对于 parallel 节点，使用 branch 类型
            edgeType = 'branch'
          }
        }
        
        const newConnection: WorkflowConnection = {
          id: `conn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          source: connectionStart.nodeId,
          target: nodeId,
          sourceHandle: connectionStart.handle,
          targetHandle: handle,
          type: edgeType
        }
        setConnections(prev => [...prev, newConnection])
      } else {
        // 连接已存在，静默忽略（可以在这里添加用户提示）
        console.log('连接已存在，跳过创建')
      }
    }
    setIsConnecting(false)
    setConnectionStart(null)
  }, [isConnecting, connectionStart, connections, nodes])

  // 画布拖拽处理
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    // 只有在点击画布背景时才开始拖拽（不是节点）
    const target = e.target as HTMLElement
    // 检查是否点击在节点上
    const isNode = target.closest('.absolute.w-\\[180px\\]')
    // 检查是否点击在连接线上
    const isConnection = target.tagName === 'path' || target.tagName === 'line'
    
    if (!isNode && !isConnection) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - canvasOffset.x, y: e.clientY - canvasOffset.y })
      // 只在需要时调用 preventDefault
      if (e.cancelable) {
        e.preventDefault()
      }
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
    // 只在需要时调用 preventDefault
    if (e.cancelable) {
      e.preventDefault()
    }
    
    const rect = canvasRef.current?.getBoundingClientRect()
    if (rect) {
      const node = nodes.find(n => n.id === nodeId)
      if (node) {
        // 计算鼠标相对于节点的偏移量
        // 注意：这里要使用鼠标在画布中的实际位置
        const mouseX = e.clientX - rect.left
        const mouseY = e.clientY - rect.top
        
        // 节点在屏幕中的实际位置（考虑画布偏移 -100000px 和缩放）
        // 节点层的 transform: translate(canvasOffset.x, canvasOffset.y) scale(canvasScale)
        // 节点位置: left: node.position.x, top: node.position.y (相对于节点层，节点层从 -100000px 开始)
        // 节点在屏幕中的位置: -100000 + canvasOffset.x + node.position.x * canvasScale
        const nodeScreenX = -100000 + canvasOffset.x + node.position.x * canvasScale
        const nodeScreenY = -100000 + canvasOffset.y + node.position.y * canvasScale
        
        // 计算鼠标相对于节点的偏移量（在画布坐标系中）
        const offsetX = (mouseX - nodeScreenX) / canvasScale
        const offsetY = (mouseY - nodeScreenY) / canvasScale
        
        setDragOffset({ x: offsetX, y: offsetY })
        setDraggedNode(nodeId)
        setSelectedNode(nodeId)
      }
    }
  }, [nodes, canvasOffset, canvasScale])


  // 保存工作流
  const handleSave = useCallback(async () => {
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
      try {
        await onSave(savedWorkflow)
      } catch (error) {
        console.error('Failed to save workflow:', error)
      }
    } else {
      console.warn('onSave callback is not provided')
    }
  }, [workflow, nodes, connections, onSave])

  // 运行工作流
  const handleRun = useCallback(() => {
    // 找到开始节点，获取其输入参数
    const startNode = nodes.find(n => n.type === 'start')
    if (!startNode) {
      console.warn('工作流中没有开始节点')
      return
    }

    // 如果有输入参数，显示参数输入对话框
    if (startNode.inputs && startNode.inputs.length > 0) {
      // 初始化参数值
      const initialParams: Record<string, string> = {}
      startNode.inputs.forEach(input => {
        if (input && input.trim()) {
          initialParams[input] = ''
        }
      })
      setRunParameters(initialParams)
      setShowRunParamsModal(true)
    } else {
      // 没有输入参数，直接运行
      executeRun({})
    }
  }, [nodes])

  // 执行运行
  const executeRun = useCallback(async (parameters: Record<string, any>) => {
    if (onRun) {
      setIsRunning(true)
      setShowRunParamsModal(false)
      
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
        // 将参数传递给 onRun 回调
        await onRun(currentWorkflow, parameters)
      } finally {
        setIsRunning(false)
      }
    }
  }, [workflow, nodes, connections, onRun])

  // 渲染连接线 - 现代化贝塞尔曲线设计
  const renderConnections = () => {
    return connections.map(connection => {
      const sourceNode = nodes.find(n => n.id === connection.source)
      const targetNode = nodes.find(n => n.id === connection.target)
      
      if (!sourceNode || !targetNode) return null

      // 节点卡片宽度 260px
      const nodeWidth = 260
      const baseConnectionY = 45 // 基础连接点Y位置（从顶部开始）
      
      // 计算源节点连接点位置
      const sourceOutputIndex = connection.sourceHandle ? 
        (sourceNode.outputs?.findIndex(o => o === connection.sourceHandle) ?? 0) : 0
      const sourceX = sourceNode.position.x + nodeWidth // 节点右边缘
      // 根据输出参数数量均匀分布连接点
      const totalSourceOutputs = sourceNode.outputs?.length || 1
      const sourceSpacing = totalSourceOutputs > 1 ? 60 / (totalSourceOutputs - 1) : 0
      const sourceY = sourceNode.position.y + baseConnectionY + (sourceOutputIndex * sourceSpacing)
      
      // 计算目标节点连接点位置
      const targetInputIndex = connection.targetHandle ? 
        (targetNode.inputs?.findIndex(i => i === connection.targetHandle) ?? 0) : 0
      const targetX = targetNode.position.x // 节点左边缘
      // 根据输入参数数量均匀分布连接点
      const totalTargetInputs = targetNode.inputs?.length || 1
      const targetSpacing = totalTargetInputs > 1 ? 60 / (totalTargetInputs - 1) : 0
      const targetY = targetNode.position.y + baseConnectionY + (targetInputIndex * targetSpacing)

      // 计算控制点，创建平滑的贝塞尔曲线
      const dx = targetX - sourceX
      const controlPointOffset = Math.min(Math.abs(dx) * 0.5, 180) // 控制点偏移，最大180px
      const cp1x = sourceX + controlPointOffset
      const cp1y = sourceY
      const cp2x = targetX - controlPointOffset
      const cp2y = targetY

      const isSelected = selectedConnection === connection.id
      
      // 根据连接类型确定颜色和样式
      const getConnectionStyle = () => {
        switch (connection.type) {
          case 'true':
            return {
              color: '#059669', // 绿色 - 真分支
              gradient: 'url(#greenGradient)',
              dashArray: 'none'
            }
          case 'false':
            return {
              color: '#dc2626', // 红色 - 假分支
              gradient: 'url(#redGradient)',
              dashArray: 'none'
            }
          case 'error':
            return {
              color: '#f59e0b', // 橙色 - 错误分支
              gradient: 'url(#orangeGradient)',
              dashArray: '8,4'
            }
          case 'branch':
            return {
              color: '#8b5cf6', // 紫色 - 并行分支
              gradient: 'url(#purpleGradient)',
              dashArray: 'none'
            }
          default:
            return {
              color: '#3b82f6', // 蓝色 - 默认
              gradient: 'url(#blueGradient)',
              dashArray: 'none'
            }
        }
      }

      const connectionStyle = getConnectionStyle()

      return (
        <g key={connection.id}>
          {/* 连接线光晕效果 */}
          <motion.path
            d={`M ${sourceX} ${sourceY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${targetX} ${targetY}`}
            stroke={connectionStyle.color}
            strokeWidth={isSelected ? "8" : "6"}
            fill="none"
            className="pointer-events-none opacity-20"
            strokeDasharray={connectionStyle.dashArray}
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.2 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
          />
          
          {/* 可点击的连接线背景（更粗，透明） */}
          <path
            d={`M ${sourceX} ${sourceY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${targetX} ${targetY}`}
            stroke="transparent"
            strokeWidth="24"
            fill="none"
            className="cursor-pointer"
            style={{ pointerEvents: 'all' }}
            onClick={(e) => {
              e.stopPropagation()
              setSelectedConnection(connection.id)
            }}
          />
          
          {/* 主连接线 - 渐变贝塞尔曲线 */}
          <motion.path
            d={`M ${sourceX} ${sourceY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${targetX} ${targetY}`}
            stroke={isSelected ? "#ef4444" : connectionStyle.gradient}
            strokeWidth={isSelected ? "4" : "3"}
            fill="none"
            markerEnd={`url(#arrowhead-${connection.type || 'default'})`}
            className="pointer-events-none"
            strokeDasharray={connectionStyle.dashArray}
            style={{ 
              filter: isSelected 
                ? 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.6))' 
                : `drop-shadow(0 2px 4px ${connectionStyle.color}40)`
            }}
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, ease: "easeInOut" }}
            whileHover={{ strokeWidth: isSelected ? 5 : 4 }}
          />
          
          {/* 数据流动画效果 */}
          <motion.circle
            r="3"
            fill={connectionStyle.color}
            className="opacity-60"
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.8, 0] }}
            transition={{ 
              duration: 2, 
              repeat: Infinity, 
              ease: "easeInOut",
              delay: Math.random() * 2 
            }}
          >
            <animateMotion
              dur="2s"
              repeatCount="indefinite"
              path={`M ${sourceX} ${sourceY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${targetX} ${targetY}`}
            />
          </motion.circle>
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

  // 渲染节点配置面板 - 从右往左的抽屉
  const renderNodeConfigPanel = () => {
    if (!configuringNode) return null
    
    const node = nodes.find(n => n.id === configuringNode)
    if (!node) return null

    const nodeConfig = NODE_TYPES[node.type]

    return (
      <AnimatePresence>
        <>
          {/* 背景遮罩 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setConfiguringNode(null)}
            className="fixed inset-0 bg-black/50 z-40"
          />
          {/* 抽屉内容 */}
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 bottom-0 w-96 bg-white dark:bg-gray-800 shadow-2xl z-50 flex flex-col"
          >
            {/* 抽屉头部 */}
            <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-gray-50 to-white dark:from-gray-800 dark:to-gray-900">
              <div className="flex items-center gap-3">
                <div 
                  className="p-2 rounded-lg"
                  style={{ 
                    backgroundColor: `${nodeConfig.color || '#64748b'}15`,
                    color: nodeConfig.color || '#64748b'
                  }}
                >
                  {nodeConfig.icon}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {node.data.label}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {nodeConfig.label}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setConfiguringNode(null)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            
            {/* 配置内容 */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* 节点基本信息 */}
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                    <div className="w-1 h-4 rounded-full" style={{ backgroundColor: nodeConfig.color || '#64748b' }} />
                    基本信息
                  </h4>
                  <Input
                    label="节点名称"
                    size="sm"
                    value={node.data.label}
                    onChange={(e) => {
                      setNodes(prev => prev.map(n => 
                        n.id === node.id ? { ...n, data: { ...n.data, label: e.target.value } } : n
                      ))
                    }}
                    placeholder="输入节点名称"
                  />
                </div>
              </div>

              {/* 节点类型特定配置 */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full" style={{ backgroundColor: nodeConfig.color || '#64748b' }} />
                  配置参数
                </h4>

          
                {node.type === 'event' && (
                  <div className="space-y-4">
                    <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                      <div className="text-xs text-orange-800 dark:text-orange-200 space-y-2">
                        <div>
                          <strong>事件节点：</strong>发布事件到事件总线，自动触发其他工作流执行。
                        </div>
                        <div className="mt-2 space-y-2">
                          <div>
                            <strong>工作原理：</strong>
                            <ol className="ml-4 mt-1 space-y-1 list-decimal">
                              <li>当前工作流执行到事件节点时，发布指定类型的事件</li>
                              <li>系统自动查找所有配置了<strong>事件触发器</strong>的工作流</li>
                              <li>如果其他工作流监听该事件类型，会自动触发执行</li>
                              <li>事件数据会作为参数传递给被触发的工作流</li>
                            </ol>
                          </div>
                          <div className="mt-2 p-2 bg-orange-100 dark:bg-orange-900 rounded">
                            <strong>如何让其他工作流响应事件：</strong>
                            <div className="mt-1 text-xs">
                              在工作流管理页面，为其他工作流配置<strong>事件触发器</strong>，设置监听的事件类型（如：user_action），当事件发布时，该工作流会自动执行。
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        工作模式
                      </label>
                      <select
                        value={node.data.config?.mode || 'publish'}
                        onChange={(e) => updateNodeConfig(node.id, { ...(node.data.config || {}), mode: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="publish">发布事件（推荐）</option>
                        <option value="wait">等待事件（待完善）</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        事件类型（必填）
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          list={`event-types-${node.id}`}
                          value={node.data.config?.eventType || node.data.config?.event_type || ''}
                          onChange={(e) => updateNodeConfig(node.id, { ...(node.data.config || {}), eventType: e.target.value, event_type: e.target.value })}
                          placeholder="user.created, order.paid, workflow.completed"
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <datalist id={`event-types-${node.id}`}>
                          {availableEventTypes.map((type, idx) => (
                            <option key={idx} value={type} />
                          ))}
                        </datalist>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        事件类型标识符，用于触发其他工作流
                        {availableEventTypes.length > 0 && (
                          <span className="ml-2 text-blue-600 dark:text-blue-400">
                            （已注册 {availableEventTypes.length} 个事件类型，输入时会有提示）
                          </span>
                        )}
                      </p>
                    </div>

                    {node.data.config?.mode === 'publish' && (
                      <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            事件数据 (JSON)
                          </label>
                          <textarea
                            value={node.data.config?.eventData ? (typeof node.data.config.eventData === 'string' ? node.data.config.eventData : JSON.stringify(node.data.config.eventData, null, 2)) : (node.data.config?.event_data || '{}')}
                            onChange={(e) => {
                              try {
                                const eventData = JSON.parse(e.target.value)
                                updateNodeConfig(node.id, { ...(node.data.config || {}), eventData, event_data: JSON.stringify(eventData) })
                              } catch {
                                // Keep as string if not valid JSON
                                updateNodeConfig(node.id, { ...(node.data.config || {}), eventData: e.target.value, event_data: e.target.value })
                              }
                            }}
                            className="w-full px-2 py-1.5 text-xs font-mono border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                            rows={4}
                            placeholder='{"userId": 123, "action": "login"}'
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            事件数据会与输入参数合并。支持模板变量：{'{{'}variable{'}}'} 或 {'{{'}context.key{'}}'}
                          </p>
                        </div>
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-xs">
                          <div className="font-semibold text-blue-800 dark:text-blue-200 mb-1">使用场景：</div>
                          <div className="text-blue-700 dark:text-blue-300 space-y-1">
                            <div>• 工作流完成后通知外部系统</div>
                            <div>• 触发其他工作流执行</div>
                            <div>• 记录重要业务事件</div>
                            <div>• 与消息队列、Webhook 等集成</div>
                          </div>
                        </div>
                      </div>
                    )}

                    {node.data.config?.mode === 'wait' && (
                      <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <div className="text-xs text-yellow-800 dark:text-yellow-200">
                          <strong>注意：</strong>等待事件功能正在开发中。当前会立即继续执行。
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {node.type === 'task' && (
                  <div className="space-y-4">
                    <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                      <div className="text-xs text-purple-800 dark:text-purple-200">
                        <strong>任务节点：</strong>执行各种操作（HTTP请求、数据转换、变量设置等），输出数据存储在上下文中，可在后续节点通过 <code className="bg-purple-100 dark:bg-purple-900 px-1 rounded">context.xxx</code> 访问。
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        任务类型
                      </label>
                      <select
                        value={node.data.config?.task_type || node.data.config?.type || 'log'}
                        onChange={(e) => updateNodeConfig(node.id, { ...(node.data.config || {}), task_type: e.target.value, type: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="http">HTTP 请求</option>
                        <option value="transform">数据转换</option>
                        <option value="set_variable">设置变量</option>
                        <option value="delay">延迟等待</option>
                        <option value="log">日志记录</option>
                      </select>
                    </div>

                    {/* HTTP 任务配置 */}
                    {((node.data.config?.task_type || node.data.config?.type) === 'http' || !node.data.config?.task_type && !node.data.config?.type) && (
                      <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-xs">
                          <div className="font-semibold text-blue-800 dark:text-blue-200 mb-1">输出数据访问：</div>
                          <div className="text-blue-700 dark:text-blue-300 space-y-1">
                            <div>• <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">context.response.body</code> - 响应体（JSON 对象）</div>
                            <div>• <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">context.response.body.data.user.name</code> - 嵌套字段访问</div>
                            <div>• <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">context.response.statusCode</code> - HTTP 状态码</div>
                            <div>• <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">context.{'{'}nodeId{'}'}.response</code> - 通过节点ID访问</div>
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            请求方法
                          </label>
                          <select
                            value={node.data.config?.method || 'GET'}
                            onChange={(e) => updateNodeConfig(node.id, { ...(node.data.config || {}), method: e.target.value })}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                          >
                            <option value="GET">GET</option>
                            <option value="POST">POST</option>
                            <option value="PUT">PUT</option>
                            <option value="PATCH">PATCH</option>
                            <option value="DELETE">DELETE</option>
                          </select>
                        </div>
                        <Input
                          label="请求 URL"
                          size="sm"
                          value={node.data.config?.url || ''}
                          onChange={(e) => updateNodeConfig(node.id, { ...(node.data.config || {}), url: e.target.value })}
                          placeholder="https://api.example.com/data"
                          helperText={'支持模板变量：{{variable}} 或 {{context.key}}'}
                        />
                        <Input
                          label="超时时间"
                          size="sm"
                          type="text"
                          value={node.data.config?.timeout || '10s'}
                          onChange={(e) => updateNodeConfig(node.id, { ...(node.data.config || {}), timeout: e.target.value })}
                          placeholder="10s"
                          helperText="例如：10s, 30s, 1m"
                        />
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            请求头 (JSON)
                          </label>
                          <textarea
                            value={node.data.config?.headers ? JSON.stringify(node.data.config.headers, null, 2) : '{}'}
                            onChange={(e) => {
                              try {
                                const headers = JSON.parse(e.target.value)
                                updateNodeConfig(node.id, { ...(node.data.config || {}), headers })
                              } catch {
                                // Invalid JSON, ignore
                              }
                            }}
                            className="w-full px-2 py-1.5 text-xs font-mono border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                            rows={3}
                            placeholder='{"Content-Type": "application/json"}'
                          />
                        </div>
                        {(node.data.config?.method === 'POST' || node.data.config?.method === 'PUT' || node.data.config?.method === 'PATCH') && (
                          <div>
                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                              请求体 (JSON)
                            </label>
                            <textarea
                              value={node.data.config?.body ? (typeof node.data.config.body === 'string' ? node.data.config.body : JSON.stringify(node.data.config.body, null, 2)) : '{}'}
                              onChange={(e) => {
                                try {
                                  const body = JSON.parse(e.target.value)
                                  updateNodeConfig(node.id, { ...(node.data.config || {}), body })
                                } catch {
                                  // Keep as string if not valid JSON
                                  updateNodeConfig(node.id, { ...(node.data.config || {}), body: e.target.value })
                                }
                              }}
                              className="w-full px-2 py-1.5 text-xs font-mono border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                              rows={4}
                              placeholder='{"key": "value"}'
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* 数据转换任务配置 */}
                    {(node.data.config?.task_type || node.data.config?.type) === 'transform' && (
                      <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            转换操作
                          </label>
                          <select
                            value={node.data.config?.operation || 'copy'}
                            onChange={(e) => updateNodeConfig(node.id, { ...(node.data.config || {}), operation: e.target.value })}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                          >
                            <option value="copy">复制所有字段</option>
                            <option value="select">选择字段</option>
                            <option value="map">字段映射</option>
                            <option value="merge">合并数据</option>
                            <option value="filter">过滤数据</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* 设置变量任务配置 */}
                    {(node.data.config?.task_type || node.data.config?.type) === 'set_variable' && (
                      <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            变量 (JSON)
                          </label>
                          <textarea
                            value={node.data.config?.variables ? JSON.stringify(node.data.config.variables, null, 2) : '{}'}
                            onChange={(e) => {
                              try {
                                const variables = JSON.parse(e.target.value)
                                updateNodeConfig(node.id, { ...(node.data.config || {}), variables })
                              } catch {
                                // Invalid JSON, ignore
                              }
                            }}
                            className="w-full px-2 py-1.5 text-xs font-mono border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                            rows={4}
                            placeholder='{"key": "value"}'
                          />
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              支持模板变量：{'{'}{'{'}variable{'}'}{'}'} 或 {'{'}{'{'}context.key{'}'}{'}'}
                            </p>
                        </div>
                      </div>
                    )}

                    {/* 延迟任务配置 */}
                    {(node.data.config?.task_type || node.data.config?.type) === 'delay' && (
                      <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <Input
                          label="延迟时间"
                          size="sm"
                          type="text"
                          value={node.data.config?.duration || '1s'}
                          onChange={(e) => updateNodeConfig(node.id, { ...(node.data.config || {}), duration: e.target.value })}
                          placeholder="1s"
                          helperText="例如：1s, 5s, 1m, 30s"
                        />
                      </div>
                    )}

                    {/* 日志任务配置 */}
                    {(node.data.config?.task_type || node.data.config?.type) === 'log' && (
                      <div className="space-y-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div>
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            日志级别
                          </label>
                          <select
                            value={node.data.config?.level || 'info'}
                            onChange={(e) => updateNodeConfig(node.id, { ...(node.data.config || {}), level: e.target.value })}
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700"
                          >
                            <option value="debug">Debug</option>
                            <option value="info">Info</option>
                            <option value="warning">Warning</option>
                            <option value="error">Error</option>
                          </select>
                        </div>
                        <Input
                          label="日志消息"
                          size="sm"
                          value={node.data.config?.message || ''}
                          onChange={(e) => updateNodeConfig(node.id, { ...(node.data.config || {}), message: e.target.value })}
                          placeholder="日志内容"
                          helperText={'支持模板变量：{{variable}} 或 {{context.key}}'}
                        />
                      </div>
                    )}
                  </div>
                )}
                
                {node.type === 'script' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        脚本语言
                      </label>
                      <select
                        value={node.data.config?.language || 'go'}
                        onChange={(e) => updateNodeConfig(node.id, { ...(node.data.config || {}), language: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        disabled
                      >
                        <option value="go">Go</option>
                      </select>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        目前仅支持 Go 语言脚本
                      </p>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          脚本代码
                        </label>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => setIsCodeEditorFullscreen(!isCodeEditorFullscreen)}
                        >
                          {isCodeEditorFullscreen ? (
                            <Minimize2 className="w-4 h-4" />
                          ) : (
                            <Maximize2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                      <div className="mb-2 p-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded text-xs text-blue-800 dark:text-blue-200">
                        <strong>提示：</strong>脚本必须定义一个 <code className="px-1 py-0.5 bg-blue-100 dark:bg-blue-900/40 rounded">Run</code> 函数，签名：
                        <code className="block mt-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/40 rounded font-mono">
                          func Run(inputs map[string]interface{}) (map[string]interface{}, error)
                        </code>
                      </div>
                      <div className="relative border border-gray-300 dark:border-gray-600 rounded-md overflow-hidden bg-gray-900">
                        <Suspense fallback={
                          <div className="h-[400px] flex items-center justify-center bg-gray-900">
                            <div className="text-center">
                              <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-700 border-t-blue-500 mx-auto mb-3"></div>
                              <p className="text-sm text-gray-400">加载代码编辑器...</p>
                            </div>
                          </div>
                        }>
                          <MonacoEditor
                            height="400px"
                            language={node.data.config?.language || 'go'}
                            value={node.data.config?.code || ''}
                            onChange={(value) => updateNodeConfig(node.id, { ...(node.data.config || {}), code: value || '' })}
                            theme="vs-dark"
                            options={{
                              minimap: { enabled: false },
                              scrollBeyondLastLine: false,
                              fontSize: 14,
                              lineNumbers: 'on',
                              wordWrap: 'on',
                              automaticLayout: true,
                              tabSize: 2,
                              formatOnPaste: true,
                              formatOnType: true,
                              suggestOnTriggerCharacters: true,
                              quickSuggestions: true,
                            }}
                          />
                        </Suspense>
                      </div>
                    </div>
                  </div>
                )}
                
                {node.type === 'wait' && (
                  <div className="space-y-4">
                    <Input
                      label="等待时长 (毫秒)"
                      size="sm"
                      type="number"
                      min="0"
                      value={node.data.config?.duration?.toString() || '5000'}
                      onChange={(e) => updateNodeConfig(node.id, { ...(node.data.config || {}), duration: parseInt(e.target.value) || 5000 })}
                    />
                    <Input
                      label="等待事件"
                      size="sm"
                      value={node.data.config?.untilEvent || ''}
                      onChange={(e) => updateNodeConfig(node.id, { ...(node.data.config || {}), untilEvent: e.target.value })}
                      placeholder="可选：等待特定事件"
                      helperText="留空则按时长等待"
                    />
                  </div>
                )}
                
                {node.type === 'plugin' && (
                  <div className="space-y-4">
                    {/* 插件信息显示 */}
                    {(() => {
                      const plugin = installedPlugins.find(p => p.pluginId === node.data.pluginId)
                      if (!plugin) {
                        return (
                          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                              <AlertCircle className="w-4 h-4" />
                              <span className="text-sm font-medium">插件未找到</span>
                            </div>
                            <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                              该节点关联的插件可能已被卸载或不存在
                            </p>
                          </div>
                        )
                      }
                      
                      return (
                        <div className="space-y-4">
                          {/* 插件基本信息 */}
                          <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                            <div className="flex items-center gap-3 mb-2">
                              <div 
                                className="p-2 rounded-lg"
                                style={{ 
                                  backgroundColor: plugin.plugin?.color || '#7c2d12',
                                  color: 'white'
                                }}
                              >
                                <Package className="w-4 h-4" />
                              </div>
                              <div>
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                                  {plugin.plugin?.displayName || plugin.plugin?.name}
                                </h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  v{plugin.version} • {plugin.plugin?.category}
                                </p>
                              </div>
                            </div>
                            {plugin.plugin?.description && (
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                {plugin.plugin.description}
                              </p>
                            )}
                          </div>
                          
                          {/* 输入参数配置 */}
                          {plugin.plugin?.inputSchema?.parameters?.length > 0 && (
                            <div>
                              <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                输入参数配置
                              </h5>
                              <div className="space-y-3">
                                {plugin.plugin.inputSchema.parameters.map((param: any, index: number) => (
                                  <div key={index} className="space-y-2">
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                                      {param.name}
                                      {param.required && <span className="text-red-500 ml-1">*</span>}
                                    </label>
                                    {param.type === 'boolean' ? (
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={node.data.config?.parameters?.[param.name] || false}
                                          onChange={(e) => updateNodeConfig(node.id, {
                                            ...(node.data.config || {}),
                                            parameters: {
                                              ...(node.data.config?.parameters || {}),
                                              [param.name]: e.target.checked
                                            }
                                          })}
                                          className="rounded border-gray-300 dark:border-gray-600"
                                        />
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                          {param.description}
                                        </span>
                                      </div>
                                    ) : param.type === 'number' ? (
                                      <input
                                        type="number"
                                        value={node.data.config?.parameters?.[param.name] || param.default || ''}
                                        onChange={(e) => updateNodeConfig(node.id, {
                                          ...(node.data.config || {}),
                                          parameters: {
                                            ...(node.data.config?.parameters || {}),
                                            [param.name]: parseFloat(e.target.value) || 0
                                          }
                                        })}
                                        placeholder={param.example || param.default}
                                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                    ) : (
                                      <input
                                        type="text"
                                        value={node.data.config?.parameters?.[param.name] || param.default || ''}
                                        onChange={(e) => updateNodeConfig(node.id, {
                                          ...(node.data.config || {}),
                                          parameters: {
                                            ...(node.data.config?.parameters || {}),
                                            [param.name]: e.target.value
                                          }
                                        })}
                                        placeholder={param.example || param.default}
                                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      />
                                    )}
                                    {param.description && (
                                      <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {param.description}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* 输出参数说明 */}
                          {plugin.plugin?.outputSchema?.parameters?.length > 0 && (
                            <div>
                              <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                                输出参数说明
                              </h5>
                              <div className="space-y-2">
                                {plugin.plugin.outputSchema.parameters.map((param: any, index: number) => (
                                  <div key={index} className="flex items-center gap-2 text-xs">
                                    <span className="font-medium text-gray-600 dark:text-gray-400">
                                      {param.name}
                                    </span>
                                    <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded">
                                      {param.type}
                                    </span>
                                    {param.description && (
                                      <span className="text-gray-500 dark:text-gray-500">
                                        {param.description}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )}
                
                {node.type === 'workflow_plugin' && (
                  <div className="space-y-4">
                    {/* 工作流插件信息显示 */}
                    {(() => {
                      const plugin = installedPlugins.find(p => p.pluginId === node.data.pluginId)
                      if (!plugin) {
                        return (
                          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                            <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                              <AlertCircle className="w-4 h-4" />
                              <span className="text-sm font-medium">工作流插件未找到</span>
                            </div>
                            <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                              该节点关联的工作流插件可能已被卸载或不存在
                            </p>
                          </div>
                        )
                      }
                      
                      return (
                        <div className="space-y-4">
                          {/* 工作流插件基本信息 */}
                          <div className="p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                            <div className="flex items-center gap-3 mb-2">
                              <div 
                                className="p-2 rounded-lg bg-gradient-to-r from-purple-500 to-blue-500 text-white"
                                style={{ 
                                  background: plugin.plugin?.color 
                                    ? `linear-gradient(to right, ${plugin.plugin.color}, ${plugin.plugin.color}CC)` 
                                    : undefined
                                }}
                              >
                                <Package className="w-4 h-4" />
                              </div>
                              <div>
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                                  {plugin.plugin?.displayName || plugin.plugin?.name}
                                </h4>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  工作流插件 • v{plugin.version} • {plugin.plugin?.category}
                                </p>
                              </div>
                            </div>
                            {plugin.plugin?.description && (
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                {plugin.plugin.description}
                              </p>
                            )}
                            <div className="mt-2 p-2 bg-purple-100 dark:bg-purple-900/30 border border-purple-200 dark:border-purple-700 rounded text-xs text-purple-800 dark:text-purple-200">
                              <strong>说明：</strong>工作流插件节点会执行一个完整的子工作流，输入参数会传递给子工作流的开始节点，输出参数来自子工作流的结束节点。
                            </div>
                          </div>
                          
                          {/* 输入参数配置 */}
                          {plugin.plugin?.inputSchema?.parameters?.length > 0 && (
                            <div>
                              <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500"></div>
                                输入参数配置
                              </h5>
                              <div className="space-y-3">
                                {plugin.plugin.inputSchema.parameters.map((param: any, index: number) => (
                                  <div key={index} className="space-y-2">
                                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                                      {param.name}
                                      {param.required && <span className="text-red-500 ml-1">*</span>}
                                    </label>
                                    {param.type === 'boolean' ? (
                                      <div className="flex items-center gap-2">
                                        <input
                                          type="checkbox"
                                          checked={node.data.config?.parameters?.[param.name] || false}
                                          onChange={(e) => updateNodeConfig(node.id, {
                                            ...(node.data.config || {}),
                                            parameters: {
                                              ...(node.data.config?.parameters || {}),
                                              [param.name]: e.target.checked
                                            }
                                          })}
                                          className="rounded border-gray-300 dark:border-gray-600 text-purple-600 focus:ring-purple-500"
                                        />
                                        <span className="text-xs text-gray-500 dark:text-gray-400">
                                          {param.description}
                                        </span>
                                      </div>
                                    ) : param.type === 'number' ? (
                                      <input
                                        type="number"
                                        value={node.data.config?.parameters?.[param.name] || param.default || ''}
                                        onChange={(e) => updateNodeConfig(node.id, {
                                          ...(node.data.config || {}),
                                          parameters: {
                                            ...(node.data.config?.parameters || {}),
                                            [param.name]: parseFloat(e.target.value) || 0
                                          }
                                        })}
                                        placeholder={param.example || param.default}
                                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                      />
                                    ) : (
                                      <input
                                        type="text"
                                        value={node.data.config?.parameters?.[param.name] || param.default || ''}
                                        onChange={(e) => updateNodeConfig(node.id, {
                                          ...(node.data.config || {}),
                                          parameters: {
                                            ...(node.data.config?.parameters || {}),
                                            [param.name]: e.target.value
                                          }
                                        })}
                                        placeholder={param.example || param.default}
                                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
                                      />
                                    )}
                                    {param.description && (
                                      <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {param.description}
                                      </p>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* 输出参数说明 */}
                          {plugin.plugin?.outputSchema?.parameters?.length > 0 && (
                            <div>
                              <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-400 to-blue-500"></div>
                                输出参数说明
                              </h5>
                              <div className="space-y-2">
                                {plugin.plugin.outputSchema.parameters.map((param: any, index: number) => (
                                  <div key={index} className="flex items-center gap-2 text-xs">
                                    <span className="font-medium text-gray-600 dark:text-gray-400">
                                      {param.name}
                                    </span>
                                    <span className="px-2 py-1 bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30 text-blue-700 dark:text-blue-400 rounded border border-blue-200 dark:border-blue-700">
                                      {param.type}
                                    </span>
                                    {param.description && (
                                      <span className="text-gray-500 dark:text-gray-500">
                                        {param.description}
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* 工作流插件特有的执行说明 */}
                          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <div className="text-xs text-blue-800 dark:text-blue-200">
                              <div className="font-semibold mb-1">执行流程：</div>
                              <div className="space-y-1">
                                <div>1. 当前工作流执行到此节点时，会启动子工作流</div>
                                <div>2. 输入参数会传递给子工作流的开始节点</div>
                                <div>3. 子工作流完整执行后，输出结果返回到当前工作流</div>
                                <div>4. 输出数据可在后续节点中通过 <code className="bg-blue-100 dark:bg-blue-900 px-1 rounded">context.{node.id}.参数名</code> 访问</div>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )}
                
                {node.type === 'timer' && (
                  <div className="space-y-4">
                    <Input
                      label="延迟时间 (毫秒)"
                      size="sm"
                      type="number"
                      min="0"
                      value={node.data.config?.delay?.toString() || '1000'}
                      onChange={(e) => updateNodeConfig(node.id, { ...(node.data.config || {}), delay: parseInt(e.target.value) || 1000 })}
                    />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        是否重复
                      </label>
                      <select
                        value={node.data.config?.repeat ? 'true' : 'false'}
                        onChange={(e) => updateNodeConfig(node.id, { ...(node.data.config || {}), repeat: e.target.value === 'true' })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="false">否</option>
                        <option value="true">是</option>
                      </select>
                    </div>
                  </div>
                )}
                
                {node.type === 'gateway' && (
                  <div className="space-y-4">
                    <div className="p-3 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                      <div className="text-xs text-purple-800 dark:text-purple-200">
                        <strong>条件判断节点：</strong>这是一个路由节点，根据条件值选择不同的执行路径。它不处理数据，只负责分支路由。
                      </div>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        判断模式
                      </label>
                      <select
                        value={node.data.config?.mode || 'value'}
                        onChange={(e) => updateNodeConfig(node.id, { ...(node.data.config || {}), mode: e.target.value })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="value">值判断（推荐）</option>
                        <option value="expression">表达式评估（待实现）</option>
                      </select>
                    </div>

                    {node.data.config?.mode === 'value' ? (
                      <Input
                        label="条件键或比较表达式（必填）"
                        size="sm"
                        value={node.data.config?.condition || ''}
                        onChange={(e) => updateNodeConfig(node.id, { ...(node.data.config || {}), condition: e.target.value })}
                        placeholder="例如: parameters.input > 0 或 parameters.isVip"
                        helperText="支持两种格式：1) 简单值判断：parameters.xxx（判断值是否为真）；2) 比较表达式：parameters.xxx > 0（支持 >, <, >=, <=, ==, !=）。例如：parameters.input > 0 表示判断 input 是否大于 0。"
                      />
                    ) : (
                      <Input
                        label="表达式（待实现）"
                        size="sm"
                        value={node.data.config?.expression || ''}
                        onChange={(e) => updateNodeConfig(node.id, { ...(node.data.config || {}), expression: e.target.value })}
                        placeholder="例如: input.includes('订单')"
                        helperText="表达式评估功能待实现，当前请使用值判断模式"
                        disabled
                      />
                    )}

                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <button
                        type="button"
                        onClick={() => setShowGatewayHelp(!showGatewayHelp)}
                        className="w-full flex items-center justify-between text-xs text-blue-800 dark:text-blue-200 font-semibold hover:text-blue-900 dark:hover:text-blue-100 transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <HelpCircle className="w-4 h-4" />
                          使用说明
                        </span>
                        {showGatewayHelp ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </button>
                      {showGatewayHelp && (
                        <div className="mt-3 text-xs text-blue-700 dark:text-blue-300 space-y-2">
                          <div>
                            <strong>1. 两个输出端口的含义：</strong>
                            <ul className="ml-4 mt-1 space-y-1 list-disc">
                              <li>第一个输出（上方）：条件为<strong>真</strong>时走这个分支</li>
                              <li>第二个输出（下方）：条件为<strong>假</strong>时走这个分支</li>
                            </ul>
                          </div>
                          <div>
                            <strong>2. 分支标签的作用：</strong>
                            <ul className="ml-4 mt-1 space-y-1 list-disc">
                              <li>仅用于<strong>显示</strong>，让连接线更易读（如"是VIP"、"不是VIP"）</li>
                              <li>不影响逻辑判断，可以不填</li>
                            </ul>
                          </div>
                          <div>
                            <strong>3. 判断逻辑：</strong>
                            <ul className="ml-4 mt-1 space-y-1 list-disc">
                              <li><strong>简单值判断：</strong>真值（true、非空字符串、非0数字），假值（false、0、空字符串""、null）</li>
                              <li><strong>比较表达式：</strong>支持 <code>&gt;</code>, <code>&lt;</code>, <code>&gt;=</code>, <code>&lt;=</code>, <code>==</code>, <code>!=</code></li>
                              <li>例如：<code>parameters.input &gt; 0</code> 表示判断 input 是否大于 0</li>
                            </ul>
                          </div>
                          <div>
                            <strong>4. 测试参数示例：</strong>
                            <div className="mt-1 space-y-1">
                              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded text-xs font-mono">
                                条件：<code>parameters.input &gt; 0</code>
                                <br />
                                参数：<code>{"{ \"input\": 666 }"}</code> → 结果：<strong>真</strong>（666 &gt; 0）
                                <br />
                                参数：<code>{"{ \"input\": -111 }"}</code> → 结果：<strong>假</strong>（-111 不大于 0）
                              </div>
                              <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded text-xs font-mono mt-1">
                                条件：<code>parameters.isVip</code>
                                <br />
                                参数：<code>{"{ \"isVip\": true }"}</code> → 结果：<strong>真</strong>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        label="是分支标签（可选，仅用于显示）"
                        size="sm"
                        value={node.data.config?.trueLabel || ''}
                        onChange={(e) => updateNodeConfig(node.id, { ...(node.data.config || {}), trueLabel: e.target.value })}
                        placeholder="例如: 是VIP"
                        helperText="条件为真时的分支标签，仅用于显示"
                      />
                      <Input
                        label="否分支标签（可选，仅用于显示）"
                        size="sm"
                        value={node.data.config?.falseLabel || ''}
                        onChange={(e) => updateNodeConfig(node.id, { ...(node.data.config || {}), falseLabel: e.target.value })}
                        placeholder="例如: 不是VIP"
                        helperText="条件为假时的分支标签，仅用于显示"
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`store-result-${node.id}`}
                        checked={node.data.config?.storeResult || false}
                        onChange={(e) => updateNodeConfig(node.id, { ...(node.data.config || {}), storeResult: e.target.checked })}
                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label htmlFor={`store-result-${node.id}`} className="text-sm text-gray-700 dark:text-gray-300">
                        存储判断结果到上下文
                      </label>
                    </div>
                  </div>
                )}
                
                {node.type === 'parallel' && (
                  <div className="space-y-4">
                    <Input
                      label="分支数量"
                      size="sm"
                      type="number"
                      min="2"
                      max="10"
                      value={node.data.config?.branches?.toString() || '2'}
                      onChange={(e) => updateNodeConfig(node.id, { ...(node.data.config || {}), branches: parseInt(e.target.value) || 2 })}
                    />
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        等待所有分支
                      </label>
                      <select
                        value={node.data.config?.waitAll ? 'true' : 'false'}
                        onChange={(e) => updateNodeConfig(node.id, { ...(node.data.config || {}), waitAll: e.target.value === 'true' })}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="true">是</option>
                        <option value="false">否</option>
                      </select>
                    </div>
                  </div>
                )}
                
                {node.type === 'subflow' && (
                  <div className="space-y-4">
                    <Input
                      label="子工作流 ID"
                      size="sm"
                      value={node.data.config?.workflowId || ''}
                      onChange={(e) => updateNodeConfig(node.id, { ...(node.data.config || {}), workflowId: e.target.value })}
                      placeholder="工作流 ID"
                    />
                    <Input
                      label="子工作流名称"
                      size="sm"
                      value={node.data.config?.workflowName || ''}
                      onChange={(e) => updateNodeConfig(node.id, { ...(node.data.config || {}), workflowName: e.target.value })}
                      placeholder="工作流名称"
                    />
                  </div>
                )}

              </div>

              {/* 输入输出参数配置 */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full" style={{ backgroundColor: nodeConfig.color || '#64748b' }} />
                  {node.type === 'start' ? '输入参数' : node.type === 'end' ? '输出参数' : '输入输出参数'}
                </h4>
                
                {/* 开始节点：只显示输入参数 */}
                {node.type === 'start' && (
                  <>
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg mb-4">
                      <p className="text-xs text-blue-800 dark:text-blue-200">
                        <strong>开始节点：</strong>定义输入参数，用于接收工作流的初始输入数据。
                        这些参数将在运行工作流时由用户填写，并传递给下游节点。
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          输入参数
                        </label>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => {
                            const newInputs = [...(node.inputs || []), `input-${node.inputs.length}`]
                            setNodes(prev => prev.map(n => 
                              n.id === node.id ? { ...n, inputs: newInputs } : n
                            ))
                          }}
                        >
                          <Plus className="w-4 h-4" />
                          <span>添加</span>
                        </Button>
                      </div>
                      {node.inputs && node.inputs.length > 0 ? (
                        <div className="space-y-2">
                          {node.inputs.map((input, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <Input
                                size="sm"
                                value={input}
                                onChange={(e) => {
                                  const newInputs = [...node.inputs]
                                  newInputs[idx] = e.target.value
                                  setNodes(prev => prev.map(n => 
                                    n.id === node.id ? { ...n, inputs: newInputs } : n
                                  ))
                                }}
                                placeholder={`输入参数 ${idx + 1} 名称`}
                              />
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => {
                                  const newInputs = node.inputs.filter((_, i) => i !== idx)
                                  setNodes(prev => prev.map(n => 
                                    n.id === node.id ? { ...n, inputs: newInputs } : n
                                  ))
                                }}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                          暂无输入参数
                        </p>
                      )}
                    </div>
                  </>
                )}

                {/* 结束节点：只显示输出参数 */}
                {node.type === 'end' && (
                  <>
                    <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg mb-4">
                      <p className="text-xs text-blue-800 dark:text-blue-200">
                        <strong>结束节点：</strong>定义输出参数，用于指定工作流的最终输出字段名称。
                        结束节点会自动从上游节点接收数据，并根据定义的输出参数名称组织最终结果。
                      </p>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          输出参数
                        </label>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => {
                            const newOutputs = [...(node.outputs || []), `output-${node.outputs.length}`]
                            setNodes(prev => prev.map(n => 
                              n.id === node.id ? { ...n, outputs: newOutputs } : n
                            ))
                          }}
                        >
                          <Plus className="w-4 h-4" />
                          <span>添加</span>
                        </Button>
                      </div>
                      {node.outputs && node.outputs.length > 0 ? (
                        <div className="space-y-2">
                          {node.outputs.map((output, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <Input
                                size="sm"
                                value={output}
                                onChange={(e) => {
                                  const newOutputs = [...node.outputs]
                                  newOutputs[idx] = e.target.value
                                  setNodes(prev => prev.map(n => 
                                    n.id === node.id ? { ...n, outputs: newOutputs } : n
                                  ))
                                }}
                                placeholder={`输出参数 ${idx + 1} 名称`}
                              />
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => {
                                  const newOutputs = node.outputs.filter((_, i) => i !== idx)
                                  setNodes(prev => prev.map(n => 
                                    n.id === node.id ? { ...n, outputs: newOutputs } : n
                                  ))
                                }}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                          暂无输出参数
                        </p>
                      )}
                    </div>
                  </>
                )}

                {/* 条件判断节点：不需要输入输出参数，它是路由节点 */}
                {node.type === 'gateway' && (
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="text-xs text-gray-600 dark:text-gray-400">
                      <strong>说明：</strong>条件判断节点是路由节点，不需要定义输入输出参数。它从上下文中读取条件值，然后根据判断结果选择下一个节点。数据会自动从上游节点传递到下游节点。
                    </div>
                  </div>
                )}

                {/* 其他节点：显示输入和输出参数 */}
                {node.type !== 'start' && node.type !== 'end' && node.type !== 'gateway' && (
                  <>
                    {/* 输入参数配置 */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          输入参数
                        </label>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => {
                            const newInputs = [...(node.inputs || []), `input-${node.inputs.length}`]
                            setNodes(prev => prev.map(n => 
                              n.id === node.id ? { ...n, inputs: newInputs } : n
                            ))
                          }}
                        >
                          <Plus className="w-4 h-4" />
                          <span>添加</span>
                        </Button>
                      </div>
                      {node.inputs && node.inputs.length > 0 ? (
                        <div className="space-y-2">
                          {node.inputs.map((input, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <Input
                                size="sm"
                                value={input}
                                onChange={(e) => {
                                  const newInputs = [...node.inputs]
                                  newInputs[idx] = e.target.value
                                  setNodes(prev => prev.map(n => 
                                    n.id === node.id ? { ...n, inputs: newInputs } : n
                                  ))
                                }}
                                placeholder={`输入参数 ${idx + 1} 名称`}
                              />
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => {
                                  const newInputs = node.inputs.filter((_, i) => i !== idx)
                                  setNodes(prev => prev.map(n => 
                                    n.id === node.id ? { ...n, inputs: newInputs } : n
                                  ))
                                }}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                          暂无输入参数
                        </p>
                      )}
                    </div>

                    {/* 输出参数配置 */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          输出参数
                        </label>
                        <Button
                          variant="ghost"
                          size="xs"
                          onClick={() => {
                            const newOutputs = [...(node.outputs || []), `output-${node.outputs.length}`]
                            setNodes(prev => prev.map(n => 
                              n.id === node.id ? { ...n, outputs: newOutputs } : n
                            ))
                          }}
                        >
                          <Plus className="w-4 h-4" />
                          <span>添加</span>
                        </Button>
                      </div>
                      {node.outputs && node.outputs.length > 0 ? (
                        <div className="space-y-2">
                          {node.outputs.map((output, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                              <Input
                                size="sm"
                                value={output}
                                onChange={(e) => {
                                  const newOutputs = [...node.outputs]
                                  newOutputs[idx] = e.target.value
                                  setNodes(prev => prev.map(n => 
                                    n.id === node.id ? { ...n, outputs: newOutputs } : n
                                  ))
                                }}
                                placeholder={`输出参数 ${idx + 1} 名称`}
                              />
                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => {
                                  const newOutputs = node.outputs.filter((_, i) => i !== idx)
                                  setNodes(prev => prev.map(n => 
                                    n.id === node.id ? { ...n, outputs: newOutputs } : n
                                  ))
                                }}
                              >
                                <X className="w-4 h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                          暂无输出参数
                        </p>
                      )}
                    </div>

                    <div className="p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                      <div className="text-xs text-gray-600 dark:text-gray-400">
                        <strong>提示：</strong>
                        <ul className="mt-1 space-y-1 list-disc list-inside">
                          <li>输入参数名称用于在脚本中访问输入数据（如 inputs["参数名"]）</li>
                          <li>输出参数名称用于将脚本结果映射到工作流上下文</li>
                        </ul>
                      </div>
                    </div>
                  </>
                )}
              </div>
              
              {/* 连接管理 */}
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <div className="w-1 h-4 rounded-full bg-blue-500" />
                  连接管理
                </h4>
                
                {/* 输入连接 */}
                <div className="space-y-2">
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    输入连接
                  </div>
                  {(() => {
                    const inputConnections = connections.filter(conn => conn.target === node.id)
                    if (inputConnections.length === 0) {
                      return (
                        <div className="text-xs text-gray-500 dark:text-gray-400 italic">
                          暂无输入连接
                        </div>
                      )
                    }
                    return inputConnections.map(conn => {
                      const sourceNode = nodes.find(n => n.id === conn.source)
                      return (
                        <div key={conn.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="flex items-center gap-2 text-xs">
                            <div className="w-2 h-2 bg-green-500 rounded-full" />
                            <span className="text-gray-700 dark:text-gray-300">
                              来自: {sourceNode?.data.label || '未知节点'}
                            </span>
                            {conn.type && conn.type !== 'default' && (
                              <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs">
                                {conn.type}
                              </span>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteConnection(conn.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 p-1"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )
                    })
                  })()}
                </div>
                
                {/* 输出连接 */}
                <div className="space-y-2">
                  <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    输出连接
                  </div>
                  {(() => {
                    const outputConnections = connections.filter(conn => conn.source === node.id)
                    if (outputConnections.length === 0) {
                      return (
                        <div className="text-xs text-gray-500 dark:text-gray-400 italic">
                          暂无输出连接
                        </div>
                      )
                    }
                    return outputConnections.map(conn => {
                      const targetNode = nodes.find(n => n.id === conn.target)
                      return (
                        <div key={conn.id} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="flex items-center gap-2 text-xs">
                            <div className="w-2 h-2 bg-blue-500 rounded-full" />
                            <span className="text-gray-700 dark:text-gray-300">
                              到: {targetNode?.data.label || '未知节点'}
                            </span>
                            {conn.type && conn.type !== 'default' && (
                              <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs">
                                {conn.type}
                              </span>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => deleteConnection(conn.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 p-1"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )
                    })
                  })()}
                </div>
                
                {/* 连接操作提示 */}
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="text-xs text-blue-800 dark:text-blue-200">
                    <div className="font-semibold mb-1">连接操作方式：</div>
                    <div className="space-y-1">
                      <div>• 在此面板中点击删除按钮删除连接</div>
                      <div>• 拖拽节点输出点到目标节点创建连接</div>
                      <div>• 点击连接线可以选中连接</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 抽屉底部操作按钮 */}
            <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
              <div className="flex items-center justify-between">
                {/* 左侧：测试按钮 */}
                {workflowId && node.inputs && node.inputs.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTestingNode(node.id)
                      // 初始化测试参数
                      const initialParams: Record<string, string> = {}
                      node.inputs.forEach(input => {
                        if (input && input.trim()) {
                          initialParams[input] = ''
                        }
                      })
                      setNodeTestParameters(initialParams)
                      setNodeTestResult(null)
                      setShowNodeTestModal(true)
                    }}
                    className="flex items-center gap-2"
                  >
                    <TestTube className="w-4 h-4" />
                    <span>测试节点</span>
                  </Button>
                )}
                
                {/* 右侧：取消和保存按钮 */}
                <div className="flex items-center gap-3 ml-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfiguringNode(null)}
                  >
                    取消
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => setConfiguringNode(null)}
                  >
                    保存
                  </Button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      </AnimatePresence>
    )
  }

  // 全局鼠标事件监听 - 处理节点拖拽和画布拖拽
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (draggedNode) {
        const rect = canvasRef.current?.getBoundingClientRect()
        if (rect) {
          // 计算鼠标在画布中的位置
          const mouseX = e.clientX - rect.left
          const mouseY = e.clientY - rect.top
          
          // 计算新的节点位置，考虑画布偏移 -100000px、缩放和拖拽偏移
          // 节点在屏幕中的位置: -100000 + canvasOffset.x + node.position.x * canvasScale
          // 所以: node.position.x = (mouseX - (-100000 + canvasOffset.x)) / canvasScale - dragOffset.x
          const x = (mouseX + 100000 - canvasOffset.x) / canvasScale - dragOffset.x
          const y = (mouseY + 100000 - canvasOffset.y) / canvasScale - dragOffset.y
          
          // 无限画布，不限制节点位置
          updateNodePosition(draggedNode, { x, y })
        }
      } else if (isDragging) {
        // 画布拖拽
        const newOffset = {
          x: e.clientX - dragStart.x,
          y: e.clientY - dragStart.y
        }
        setCanvasOffset(newOffset)
      }
    }

    const handleGlobalMouseUp = () => {
      setDraggedNode(null)
      setDragOffset({ x: 0, y: 0 })
      setIsDragging(false)
    }

    if (draggedNode || isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove)
      document.addEventListener('mouseup', handleGlobalMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove)
      document.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [draggedNode, isDragging, canvasOffset, canvasScale, dragOffset, dragStart, updateNodePosition])

  // 加载可用的事件类型
  useEffect(() => {
    const loadEventTypes = async () => {
      setLoadingEventTypes(true)
      try {
        const response = await workflowService.getAvailableEventTypes()
        if (response.code === 200 && response.data) {
          const types = response.data.event_types.map(et => et.type)
          setAvailableEventTypes(types)
        }
      } catch (error) {
        console.error('Failed to load event types:', error)
      } finally {
        setLoadingEventTypes(false)
      }
    }
    loadEventTypes()
  }, [])

  // 画布滚轮缩放 - 使用非被动事件监听器避免 preventDefault 警告
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handleWheel = (e: WheelEvent) => {
      if (isCodeEditorFullscreen) return // 全屏时禁用画布缩放
      
      e.preventDefault()
      const delta = e.deltaY > 0 ? 0.9 : 1.1
      setCanvasScale(prev => Math.max(0.3, Math.min(3, prev * delta)))
    }

    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => {
      canvas.removeEventListener('wheel', handleWheel)
    }
  }, [])

  return (
    <div className={cn('flex flex-col h-full bg-gray-50 dark:bg-gray-900', className)}>
      {/* 工具栏 */}
      <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-4">
          {!validation.valid && (
            <div className="flex items-center text-red-600 text-sm">
              <AlertCircle className="w-4 h-4" />
              <span className="ml-1">{validation.message}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowNodeDrawer(true)}
              className="flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>{t('workflow.editor.addNode')}</span>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowHelpModal(true)}
              title={t('workflow.editor.help')}
            >
              <HelpCircle className="w-5 h-5" />
            </Button>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* 画布控制按钮组 */}
          <div className="flex items-center space-x-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            <motion.button
              onClick={zoomOut}
              className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white dark:hover:bg-gray-600 rounded transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="缩小"
            >
              <span className="text-sm font-bold">-</span>
            </motion.button>
            
            <span className="text-xs text-gray-600 dark:text-gray-400 min-w-[2.5rem] text-center px-1">
              {Math.round(canvasScale * 100)}%
            </span>
            
            <motion.button
              onClick={zoomIn}
              className="p-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white dark:hover:bg-gray-600 rounded transition-colors"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="放大"
            >
              <span className="text-sm font-bold">+</span>
            </motion.button>
          </div>

          <div className="flex items-center space-x-1">
            <motion.button
              onClick={resetCanvasView}
              className="px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              title="重置视图"
            >
              重置
            </motion.button>
            
            <motion.button
              onClick={centerOnNodes}
              className="px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              title="居中显示所有节点"
            >
              居中
            </motion.button>
          </div>

          {/* 分隔线 */}
          <div className="h-6 w-px bg-gray-300 dark:bg-gray-600"></div>

          {selectedConnection && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteConnection(selectedConnection)}
            >
              <Trash2 className="w-4 h-4" />
              删除连接
            </Button>
          )}
          
          {/* 主要操作按钮 */}
          <div className="flex items-center space-x-2">
            <Button
              variant="success"
              size="sm"
              onClick={handleRun}
              disabled={!validation.valid || isRunning}
              loading={isRunning}
            >
              {isRunning ? '运行中...' : '运行'}
            </Button>
            
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={!onSave}
            >
              保存
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (workflowId && validation.valid) {
                  setShowPublishModal(true)
                } else {
                  console.log('发布按钮被禁用:', { workflowId, validation })
                }
              }}
              disabled={!workflowId || !validation.valid}
              title={!workflowId ? '需要工作流ID' : !validation.valid ? `工作流验证失败: ${validation.message}` : '发布为插件'}
            >
              发布为插件
            </Button>
          </div>
        </div>
      </div>

      <div className="flex flex-1">
        {/* 画布区域 */}
        <div className="flex-1 relative overflow-hidden">
          <div
            ref={canvasRef}
            className="relative w-full h-full"
            style={{ 
              cursor: isDragging ? 'grabbing' : 'grab'
            }}
            onMouseDown={handleCanvasMouseDown}
            onMouseMove={handleCanvasMouseMove}
            onMouseUp={handleCanvasMouseUp}
            onMouseLeave={handleCanvasMouseUp}
          >
            {/* 画布背景网格 - 无限延伸 */}
            <div 
              className="absolute pointer-events-none"
              style={{
                width: '200000px',
                height: '200000px',
                left: '-100000px',
                top: '-100000px',
                backgroundImage: `
                  linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)
                `,
                backgroundSize: '20px 20px',
                backgroundPosition: `${(canvasOffset.x % 20)}px ${(canvasOffset.y % 20)}px`,
                transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${canvasScale})`,
                transformOrigin: '0 0',
                zIndex: 0
              }}
            />
            {/* SVG 连接线层 - 无限延伸 */}
            <svg
              className="absolute pointer-events-none"
              style={{ 
                width: '200000px',
                height: '200000px',
                left: '-100000px',
                top: '-100000px',
                zIndex: 1,
                transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${canvasScale})`,
                transformOrigin: '0 0'
              }}
            >
              <defs>
                {/* 渐变定义 */}
                <linearGradient id="blueGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#3b82f6" />
                  <stop offset="100%" stopColor="#1d4ed8" />
                </linearGradient>
                
                <linearGradient id="greenGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#059669" />
                  <stop offset="100%" stopColor="#047857" />
                </linearGradient>
                
                <linearGradient id="redGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#dc2626" />
                  <stop offset="100%" stopColor="#b91c1c" />
                </linearGradient>
                
                <linearGradient id="orangeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#f59e0b" />
                  <stop offset="100%" stopColor="#d97706" />
                </linearGradient>
                
                <linearGradient id="purpleGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#8b5cf6" />
                  <stop offset="100%" stopColor="#7c3aed" />
                </linearGradient>

                {/* 箭头标记定义 */}
                <marker
                  id="arrowhead-default"
                  markerWidth="12"
                  markerHeight="8"
                  refX="11"
                  refY="4"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <polygon
                    points="0 0, 12 4, 0 8"
                    fill="url(#blueGradient)"
                    stroke="none"
                  />
                </marker>
                
                <marker
                  id="arrowhead-true"
                  markerWidth="12"
                  markerHeight="8"
                  refX="11"
                  refY="4"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <polygon
                    points="0 0, 12 4, 0 8"
                    fill="url(#greenGradient)"
                    stroke="none"
                  />
                </marker>
                
                <marker
                  id="arrowhead-false"
                  markerWidth="12"
                  markerHeight="8"
                  refX="11"
                  refY="4"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <polygon
                    points="0 0, 12 4, 0 8"
                    fill="url(#redGradient)"
                    stroke="none"
                  />
                </marker>
                
                <marker
                  id="arrowhead-error"
                  markerWidth="12"
                  markerHeight="8"
                  refX="11"
                  refY="4"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <polygon
                    points="0 0, 12 4, 0 8"
                    fill="url(#orangeGradient)"
                    stroke="none"
                  />
                </marker>
                
                <marker
                  id="arrowhead-branch"
                  markerWidth="12"
                  markerHeight="8"
                  refX="11"
                  refY="4"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <polygon
                    points="0 0, 12 4, 0 8"
                    fill="url(#purpleGradient)"
                    stroke="none"
                  />
                </marker>
              </defs>
              {renderConnections()}
            </svg>

            {/* 节点层 - 无限画布 */}
            <div
              className="absolute"
              style={{
                width: '200000px',
                height: '200000px',
                left: '-100000px',
                top: '-100000px',
                transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px) scale(${canvasScale})`,
                transformOrigin: '0 0',
                zIndex: 2
              }}
            >
              {nodes.map(node => {
                const nodeConfig = NODE_TYPES[node.type]
                if (!nodeConfig) {
                  console.warn(`Unknown node type: ${node.type}, using default config`)
                  return null
                }
                return (
                  <motion.div
                    key={node.id}
                    className={cn(
                      'absolute w-[260px] cursor-move select-none group',
                      draggedNode === node.id ? 'z-50' : 'z-10'
                    )}
                    style={{
                      left: node.position.x,
                      top: node.position.y
                    }}
                    onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ 
                      opacity: 1, 
                      scale: draggedNode === node.id ? 1.02 : 1
                    }}
                    transition={{ duration: 0.15 }}
                  >
                    {/* 主卡片 - 全新现代化设计 */}
                    <div className={cn(
                      'relative overflow-hidden transition-all duration-300 transform-gpu',
                      'bg-gradient-to-br from-white via-gray-50 to-white dark:from-gray-800 dark:via-gray-850 dark:to-gray-800',
                      'rounded-2xl border border-gray-200/60 dark:border-gray-700/60',
                      'backdrop-blur-sm shadow-lg hover:shadow-2xl',
                      selectedNode === node.id 
                        ? `border-2 ${nodeConfig.shadowColor} shadow-2xl ring-4 ring-opacity-20` 
                        : 'hover:border-gray-300/80 dark:hover:border-gray-600/80 hover:-translate-y-1',
                      draggedNode === node.id && 'shadow-3xl scale-105'
                    )}
                    style={{
                      boxShadow: selectedNode === node.id 
                        ? `0 20px 40px -12px ${nodeConfig.color}40, 0 8px 16px -8px ${nodeConfig.color}20`
                        : undefined
                    }}>
                      {/* 渐变顶部装饰条 */}
                      <div 
                        className={cn(
                          'absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r',
                          nodeConfig.gradient || 'from-gray-400 to-gray-600'
                        )}
                      />
                      
                      {/* 背景装饰 - 微妙的几何图案 */}
                      <div className="absolute top-0 right-0 w-24 h-24 opacity-5 dark:opacity-10">
                        <div 
                          className="w-full h-full rounded-full blur-xl"
                          style={{ backgroundColor: nodeConfig.color }}
                        />
                      </div>
                      
                      {/* 内容区域 */}
                      <div className="relative pt-4 pb-4 px-5">
                        {/* 头部：图标和标题 */}
                        <div className="flex items-center justify-between gap-4 mb-4">
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            {/* 现代化图标容器 */}
                            <div className="relative flex-shrink-0">
                              <div 
                                className={cn(
                                  'p-3 rounded-xl shadow-md transition-all duration-300',
                                  'bg-gradient-to-br border border-white/20',
                                  nodeConfig.gradient || 'from-gray-400 to-gray-600',
                                  'hover:scale-110 hover:rotate-3'
                                )}
                                style={{
                                  boxShadow: `0 8px 16px -4px ${nodeConfig.color}30`
                                }}
                              >
                                <div className="text-white drop-shadow-sm">
                                  {nodeConfig.icon}
                                </div>
                              </div>
                              {/* 图标光晕效果 */}
                              <div 
                                className="absolute inset-0 rounded-xl blur-md opacity-30 -z-10"
                                style={{ backgroundColor: nodeConfig.color }}
                              />
                            </div>
                            
                            {/* 标题和类型 */}
                            <div className="flex-1 min-w-0">
                              <div className="text-lg font-bold text-gray-900 dark:text-gray-100 truncate leading-tight">
                                {node.data.label}
                              </div>
                              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1 font-medium">
                                {nodeConfig.label}
                              </div>
                            </div>
                          </div>
                          
                          {/* 现代化操作按钮 */}
                          <div className={cn(
                            'flex items-center gap-2 transition-all duration-300 flex-shrink-0',
                            selectedNode === node.id ? 'opacity-100 scale-100' : 'opacity-0 scale-95 group-hover:opacity-100 group-hover:scale-100'
                          )}>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={(e) => {
                                e.stopPropagation()
                                setConfiguringNode(node.id)
                              }}
                              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
                              title="配置"
                            >
                              <Settings className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.95 }}
                              onClick={(e) => {
                                e.stopPropagation()
                                deleteNode(node.id)
                              }}
                              className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md"
                              title="删除"
                            >
                              <Trash2 className="w-4 h-4 text-red-500 dark:text-red-400" />
                            </motion.button>
                          </div>
                        </div>

                        {/* 现代化参数展示区域 */}
                        {(() => {
                          // 开始节点：只显示输入参数
                          if (node.type === 'start' && node.inputs.length > 0) {
                            return (
                              <div className="pt-3 border-t border-gray-100/60 dark:border-gray-700/60">
                                <div className="space-y-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-sm"></div>
                                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                      输入参数 ({node.inputs.length})
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {node.inputs.slice(0, 3).map((input, idx) => (
                                      <motion.span
                                        key={idx}
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: idx * 0.1 }}
                                        className="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/30 text-emerald-700 dark:text-emerald-400 rounded-lg border border-emerald-200/60 dark:border-emerald-700/60 shadow-sm hover:shadow-md transition-all duration-200 truncate max-w-[120px]"
                                        title={input}
                                      >
                                        {input}
                                      </motion.span>
                                    ))}
                                    {node.inputs.length > 3 && (
                                      <span className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg">
                                        +{node.inputs.length - 3}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          }
                          
                          // 结束节点：只显示输出参数
                          if (node.type === 'end' && node.outputs.length > 0) {
                            return (
                              <div className="pt-3 border-t border-gray-100/60 dark:border-gray-700/60">
                                <div className="space-y-3">
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-400 to-blue-500 shadow-sm"></div>
                                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                      输出参数 ({node.outputs.length})
                                    </span>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {node.outputs.slice(0, 3).map((output, idx) => (
                                      <motion.span
                                        key={idx}
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: idx * 0.1 }}
                                        className="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 text-blue-700 dark:text-blue-400 rounded-lg border border-blue-200/60 dark:border-blue-700/60 shadow-sm hover:shadow-md transition-all duration-200 truncate max-w-[120px]"
                                        title={output}
                                      >
                                        {output}
                                      </motion.span>
                                    ))}
                                    {node.outputs.length > 3 && (
                                      <span className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg">
                                        +{node.outputs.length - 3}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )
                          }
                          
                          // 其他节点：显示输入和输出参数
                          if (node.type !== 'start' && node.type !== 'end' && (node.inputs.length > 0 || node.outputs.length > 0)) {
                            return (
                              <div className="pt-3 border-t border-gray-100/60 dark:border-gray-700/60 space-y-4">
                                {/* 输入参数 */}
                                {node.inputs.length > 0 && (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <div className="w-3 h-3 rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-sm"></div>
                                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        输入 ({node.inputs.length})
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {node.inputs.slice(0, 3).map((input, idx) => (
                                        <motion.span
                                          key={idx}
                                          initial={{ opacity: 0, scale: 0.8 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          transition={{ delay: idx * 0.1 }}
                                          className="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-emerald-50 to-emerald-100 dark:from-emerald-900/30 dark:to-emerald-800/30 text-emerald-700 dark:text-emerald-400 rounded-lg border border-emerald-200/60 dark:border-emerald-700/60 shadow-sm hover:shadow-md transition-all duration-200 truncate max-w-[120px]"
                                          title={input}
                                        >
                                          {input}
                                        </motion.span>
                                      ))}
                                      {node.inputs.length > 3 && (
                                        <span className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg">
                                          +{node.inputs.length - 3}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* 输出参数 - gateway 节点不显示输出参数标签，因为它们是逻辑分支而不是数据输出 */}
                                {node.outputs.length > 0 && node.type !== 'gateway' && (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-400 to-blue-500 shadow-sm"></div>
                                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                                        输出 ({node.outputs.length})
                                      </span>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {node.outputs.slice(0, 3).map((output, idx) => (
                                        <motion.span
                                          key={idx}
                                          initial={{ opacity: 0, scale: 0.8 }}
                                          animate={{ opacity: 1, scale: 1 }}
                                          transition={{ delay: idx * 0.1 }}
                                          className="px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 text-blue-700 dark:text-blue-400 rounded-lg border border-blue-200/60 dark:border-blue-700/60 shadow-sm hover:shadow-md transition-all duration-200 truncate max-w-[120px]"
                                          title={output}
                                        >
                                          {output}
                                        </motion.span>
                                      ))}
                                      {node.outputs.length > 3 && (
                                        <span className="px-3 py-1.5 text-xs font-medium text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-lg">
                                          +{node.outputs.length - 3}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )
                          }
                          
                          return null
                        })()}
                      </div>
                    </div>

                    {/* 现代化输入连接点 - 渐变设计 */}
                    {node.inputs.map((input, index) => {
                      // 计算连接点位置：在节点左侧，根据输入参数数量均匀分布
                      const totalInputs = node.inputs.length
                      const spacing = totalInputs > 1 ? 60 / (totalInputs - 1) : 0
                      const topPosition = 45 + (index * spacing)
                      
                      return (
                        <motion.div
                          key={input}
                          className="absolute z-30"
                          style={{
                            left: -10,
                            top: `${topPosition}px`
                          }}
                          whileHover={{ scale: 1.2 }}
                          whileTap={{ scale: 0.9 }}
                        >
                          {/* 连接点光晕效果 */}
                          <div 
                            className={cn(
                              "absolute inset-0 rounded-full blur-sm opacity-60 transition-all duration-300",
                              isConnecting && connectionStart?.nodeId !== node.id
                                ? "bg-emerald-400 scale-150"
                                : "bg-emerald-300 scale-100"
                            )}
                          />
                          {/* 主连接点 */}
                          <div
                            className={cn(
                              "relative w-5 h-5 rounded-full cursor-pointer transition-all duration-300 transform-gpu",
                              "bg-gradient-to-br from-emerald-400 to-emerald-600",
                              "border-2 border-white dark:border-gray-800 shadow-lg",
                              "hover:shadow-emerald-300/50 hover:shadow-xl",
                              isConnecting && connectionStart?.nodeId !== node.id
                                ? "ring-4 ring-emerald-300/60 scale-110 animate-pulse"
                                : "hover:scale-110"
                            )}
                            onMouseDown={(e) => {
                              e.stopPropagation()
                              if (isConnecting) {
                                completeConnection(node.id, input)
                              }
                            }}
                            title={`输入: ${input}`}
                          >
                            {/* 内部高光 */}
                            <div className="absolute top-0.5 left-0.5 w-2 h-2 bg-white/40 rounded-full blur-sm" />
                          </div>
                        </motion.div>
                      )
                    })}

                    {/* 现代化输出连接点 - 渐变设计 */}
                    {node.outputs.map((output, index) => {
                      // 计算连接点位置：在节点右侧，根据输出参数数量均匀分布
                      const totalOutputs = node.outputs.length
                      const spacing = totalOutputs > 1 ? 60 / (totalOutputs - 1) : 0
                      const topPosition = 45 + (index * spacing)
                      
                      // 检查此输出点是否已经连接
                      const isConnected = isOutputConnected(node.id, output)
                      // 检查是否可以开始连接（未连接且不在连接模式中）
                      const canStartConnection = !isConnected && !isConnecting
                      
                      return (
                        <motion.div
                          key={output}
                          className="absolute z-30"
                          style={{
                            right: -10,
                            top: `${topPosition}px`
                          }}
                          whileHover={{ scale: canStartConnection ? 1.2 : 1.1 }}
                          whileTap={{ scale: canStartConnection ? 0.9 : 1 }}
                        >
                          {/* 连接点光晕效果 */}
                          <div 
                            className={cn(
                              "absolute inset-0 rounded-full blur-sm opacity-60 transition-all duration-300",
                              canStartConnection
                                ? "bg-blue-300 scale-100"
                                : isConnected
                                ? "bg-green-300 scale-90"
                                : "bg-gray-300 scale-75"
                            )}
                          />
                          
                          {/* 主连接点 */}
                          <div
                            className={cn(
                              "relative w-5 h-5 rounded-full transition-all duration-300 transform-gpu",
                              "border-2 border-white dark:border-gray-800 shadow-lg",
                              canStartConnection
                                ? "bg-gradient-to-br from-blue-400 to-blue-600 hover:shadow-blue-300/50 hover:shadow-xl cursor-pointer"
                                : isConnected
                                ? "bg-gradient-to-br from-green-400 to-green-600 shadow-green-300/50 cursor-default"
                                : "bg-gradient-to-br from-gray-300 to-gray-500 cursor-not-allowed opacity-60"
                            )}
                            onMouseDown={(e) => {
                              e.stopPropagation()
                              if (canStartConnection) {
                                startConnection(node.id, output)
                              }
                            }}
                            title={
                              isConnected 
                                ? `输出: ${output} (已连接)` 
                                : canStartConnection 
                                ? `输出: ${output}` 
                                : `输出: ${output} (连接模式中)`
                            }
                          >
                            {/* 内部高光 */}
                            <div className="absolute top-0.5 left-0.5 w-2 h-2 bg-white/40 rounded-full blur-sm" />
                          </div>
                        </motion.div>
                      )
                    })}
                  </motion.div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
      
      {/* 节点配置面板 */}
      {renderNodeConfigPanel()}

      {/* 运行参数输入对话框 */}
      <Modal
        isOpen={showRunParamsModal}
        onClose={() => setShowRunParamsModal(false)}
        title="填写工作流参数"
        size="md"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            请填写开始节点的输入参数值：
          </p>
          {(() => {
            const startNode = nodes.find(n => n.type === 'start')
            if (!startNode || !startNode.inputs || startNode.inputs.length === 0) {
              return (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                  开始节点没有定义输入参数
                </p>
              )
            }
            return (
              <div className="space-y-3">
                {startNode.inputs.map((input, idx) => (
                  <div key={idx}>
                    <Input
                      label={input || `参数 ${idx + 1}`}
                      size="sm"
                      value={runParameters[input] || ''}
                      onChange={(e) => {
                        setRunParameters(prev => ({
                          ...prev,
                          [input]: e.target.value
                        }))
                      }}
                      placeholder={`请输入 ${input || `参数 ${idx + 1}`} 的值`}
                    />
                  </div>
                ))}
              </div>
            )
          })()}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowRunParamsModal(false)}
            >
              取消
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                // 转换参数值（尝试解析 JSON，如果失败则作为字符串）
                const parsedParams: Record<string, any> = {}
                Object.entries(runParameters).forEach(([key, value]) => {
                  if (value.trim() === '') {
                    parsedParams[key] = null
                  } else {
                    try {
                      // 尝试解析为 JSON
                      parsedParams[key] = JSON.parse(value)
                    } catch {
                      // 解析失败，作为字符串
                      parsedParams[key] = value
                    }
                  }
                })
                executeRun(parsedParams)
              }}
              disabled={isRunning}
              loading={isRunning}
            >
              {isRunning ? '运行中...' : '运行'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* 节点测试对话框 */}
      <Modal
        isOpen={showNodeTestModal}
        onClose={() => {
          setShowNodeTestModal(false)
          setTestingNode(null)
          setNodeTestResult(null)
        }}
        title="测试节点"
        size="lg"
      >
        <div className="space-y-4">
          {(() => {
            const node = nodes.find(n => n.id === testingNode)
            if (!node || !node.inputs || node.inputs.length === 0) {
              return (
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                  该节点没有定义输入参数
                </p>
              )
            }
            return (
              <>
                <div className="space-y-3">
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    请填写节点的输入参数值：
                  </p>
                  {node.inputs.map((input, idx) => (
                    <div key={idx}>
                      <Input
                        label={input || `参数 ${idx + 1}`}
                        size="sm"
                        value={nodeTestParameters[input] || ''}
                        onChange={(e) => {
                          setNodeTestParameters(prev => ({
                            ...prev,
                            [input]: e.target.value
                          }))
                        }}
                        placeholder={`请输入 ${input || `参数 ${idx + 1}`} 的值`}
                      />
                    </div>
                  ))}
                </div>

                {/* 测试结果 */}
                {nodeTestResult && (
                  <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
                      测试结果
                    </h4>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium text-gray-700 dark:text-gray-300">状态：</span>
                        <span className={`ml-2 ${
                          nodeTestResult.status === 'completed' 
                            ? 'text-green-600 dark:text-green-400' 
                            : 'text-red-600 dark:text-red-400'
                        }`}>
                          {nodeTestResult.status === 'completed' ? '成功' : '失败'}
                        </span>
                      </div>
                      {nodeTestResult.error && (
                        <div>
                          <span className="font-medium text-gray-700 dark:text-gray-300">错误：</span>
                          <span className="ml-2 text-red-600 dark:text-red-400">{nodeTestResult.error}</span>
                        </div>
                      )}
                      {nodeTestResult.context && Object.keys(nodeTestResult.context).length > 0 && (
                        <div>
                          <span className="font-medium text-gray-700 dark:text-gray-300">输出数据：</span>
                          <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-auto max-h-40">
                            {JSON.stringify(nodeTestResult.context, null, 2)}
                          </pre>
                        </div>
                      )}
                      {nodeTestResult.logs && nodeTestResult.logs.length > 0 && (
                        <div>
                          <span className="font-medium text-gray-700 dark:text-gray-300">执行日志：</span>
                          <div className="mt-1 p-2 bg-gray-100 dark:bg-gray-900 rounded text-xs overflow-auto max-h-40 space-y-1">
                            {nodeTestResult.logs.map((log: any, idx: number) => (
                              <div key={idx} className={`${
                                log.level === 'error' ? 'text-red-600 dark:text-red-400' :
                                log.level === 'success' ? 'text-green-600 dark:text-green-400' :
                                log.level === 'warning' ? 'text-yellow-600 dark:text-yellow-400' :
                                'text-gray-700 dark:text-gray-300'
                              }`}>
                                [{log.level.toUpperCase()}] {log.message}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowNodeTestModal(false)
                      setTestingNode(null)
                      setNodeTestResult(null)
                    }}
                  >
                    关闭
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={async () => {
                      if (!workflowId || !testingNode) return
                      
                      setIsTestingNode(true)
                      try {
                        // 转换参数值
                        const parsedParams: Record<string, any> = {}
                        Object.entries(nodeTestParameters).forEach(([key, value]) => {
                          if (value.trim() === '') {
                            parsedParams[key] = null
                          } else {
                            try {
                              parsedParams[key] = JSON.parse(value)
                            } catch {
                              parsedParams[key] = value
                            }
                          }
                        })
                        
                        const response = await workflowService.testNode(workflowId, testingNode, parsedParams)
                        if (response.code === 200 && response.data) {
                          setNodeTestResult(response.data)
                        } else {
                          setNodeTestResult({
                            status: 'failed',
                            error: response.msg || '测试失败'
                          })
                        }
                      } catch (error: any) {
                        setNodeTestResult({
                          status: 'failed',
                          error: error.message || '测试失败'
                        })
                      } finally {
                        setIsTestingNode(false)
                      }
                    }}
                    disabled={isTestingNode}
                    loading={isTestingNode}
                  >
                    {isTestingNode ? '测试中...' : '运行测试'}
                  </Button>
                </div>
              </>
            )
          })()}
        </div>
      </Modal>
      
      {/* 代码编辑器全屏模式 */}
      <AnimatePresence>
        {isCodeEditorFullscreen && configuringNode && (() => {
          const node = nodes.find(n => n.id === configuringNode)
          if (!node || node.type !== 'script') return null
          
          return (
            <>
              {/* 背景遮罩 */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsCodeEditorFullscreen(false)}
                className="fixed inset-0 bg-black/80 z-[100]"
              />
              {/* 全屏编辑器 */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-4 z-[110] bg-gray-900 rounded-lg shadow-2xl flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
              >
                {/* 标题栏 */}
                <div className="h-14 bg-gray-800 border-b border-gray-700 flex items-center justify-between px-6 flex-shrink-0">
                  <div className="flex items-center gap-3">
                    <div 
                      className="p-2 rounded-lg"
                      style={{ 
                        backgroundColor: `${NODE_TYPES.script.color}15`,
                        color: NODE_TYPES.script.color
                      }}
                    >
                      <Code className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-gray-200">
                        {node.data.label} - 脚本代码编辑器
                      </h3>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {node.data.config?.language || 'javascript'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsCodeEditorFullscreen(false)}
                    className="flex items-center gap-2">
                      <Minimize2 className="w-4 h-4" />
                      <span>退出全屏</span>
                    </Button>
                  </div>
                </div>
                
                {/* 编辑器区域 */}
                <div className="flex-1 overflow-hidden" style={{ height: 'calc(100vh - 8rem)' }}>
                  <Suspense fallback={
                    <div className="h-full flex items-center justify-center bg-gray-900">
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-700 border-t-blue-500 mx-auto mb-3"></div>
                        <p className="text-sm text-gray-400">加载代码编辑器...</p>
                      </div>
                    </div>
                  }>
                    <MonacoEditor
                      height="100%"
                      language={node.data.config?.language || 'go'}
                      value={node.data.config?.code || ''}
                      onChange={(value) => updateNodeConfig(node.id, { ...(node.data.config || {}), code: value || '' })}
                      theme="vs-dark"
                      options={{
                        minimap: { enabled: true },
                        scrollBeyondLastLine: false,
                        fontSize: 14,
                        lineNumbers: 'on',
                        wordWrap: 'on',
                        automaticLayout: true,
                        tabSize: 2,
                        formatOnPaste: true,
                        formatOnType: true,
                        suggestOnTriggerCharacters: true,
                        quickSuggestions: true,
                      }}
                    />
                  </Suspense>
                </div>
              </motion.div>
            </>
          )
        })()}
      </AnimatePresence>
      
      {/* 节点选择抽屉 - 从下到上 */}
      <AnimatePresence>
        {showNodeDrawer && (
          <>
            {/* 背景遮罩 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowNodeDrawer(false)}
              className="fixed inset-0 bg-black/50 z-40"
            />
            {/* 抽屉内容 */}
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 rounded-t-2xl shadow-2xl z-50 max-h-[80vh] flex flex-col"
            >
              {/* 抽屉头部 */}
              <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  选择节点类型
                </h3>
                <button
                  onClick={() => setShowNodeDrawer(false)}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
              
              {/* 搜索框 */}
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={nodeSearchQuery}
                    onChange={(e) => setNodeSearchQuery(e.target.value)}
                    placeholder="搜索节点类型..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    autoFocus
                  />
                </div>
              </div>
              
              {/* 现代化节点列表 */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                  {Object.entries(NODE_TYPES)
                    .filter(([type, config]) => 
                      config.label.toLowerCase().includes(nodeSearchQuery.toLowerCase()) ||
                      type.toLowerCase().includes(nodeSearchQuery.toLowerCase())
                    )
                    .map(([type, config]) => (
                      <motion.div
                        key={type}
                        className="group relative"
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          addNode(type as WorkflowNode['type'], { x: 0, y: 0 })
                          setTimeout(() => {
                            centerOnNodes()
                          }, 100)
                          setShowNodeDrawer(false)
                          setNodeSearchQuery('')
                        }}
                      >
                        {/* 节点卡片 */}
                        <div className="relative flex flex-col items-center p-4 bg-gradient-to-br from-white via-gray-50 to-white dark:from-gray-800 dark:via-gray-850 dark:to-gray-800 rounded-2xl cursor-pointer transition-all duration-300 border border-gray-200/60 dark:border-gray-700/60 hover:border-gray-300/80 dark:hover:border-gray-600/80 shadow-lg hover:shadow-2xl backdrop-blur-sm overflow-hidden">
                          
                          {/* 背景装饰 */}
                          <div className="absolute top-0 right-0 w-16 h-16 opacity-10">
                            <div 
                              className="w-full h-full rounded-full blur-xl"
                              style={{ backgroundColor: config.color }}
                            />
                          </div>
                          
                          {/* 顶部装饰条 */}
                          <div 
                            className={cn(
                              'absolute top-0 left-0 right-0 h-1 bg-gradient-to-r',
                              config.gradient || 'from-gray-400 to-gray-600'
                            )}
                          />
                          
                          {/* 图标容器 */}
                          <div className="relative mb-3">
                            <div 
                              className={cn(
                                'p-3 rounded-xl shadow-lg transition-all duration-300',
                                'bg-gradient-to-br border border-white/20',
                                config.gradient || 'from-gray-400 to-gray-600',
                                'group-hover:scale-110 group-hover:rotate-3'
                              )}
                              style={{
                                boxShadow: `0 8px 16px -4px ${config.color}30`
                              }}
                            >
                              <div className="text-white drop-shadow-sm">
                                {config.icon}
                              </div>
                            </div>
                            {/* 图标光晕效果 */}
                            <div 
                              className="absolute inset-0 rounded-xl blur-md opacity-30 -z-10 group-hover:opacity-50 transition-opacity duration-300"
                              style={{ backgroundColor: config.color }}
                            />
                          </div>
                          
                          {/* 标题 */}
                          <span className="text-sm font-bold text-gray-900 dark:text-white text-center leading-tight">
                            {config.label}
                          </span>
                          
                          {/* 悬停效果 */}
                          <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
                        </div>
                      </motion.div>
                    ))}
                </div>
                
                {/* 插件节点部分 */}
                {installedPlugins.length > 0 && (
                  <>
                    <div className="mt-8 mb-4">
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                        <Package className="w-5 h-5" />
                        已安装的插件
                      </h4>
                      <div className="h-px bg-gradient-to-r from-gray-200 via-gray-300 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700"></div>
                    </div>
                    
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                      {installedPlugins
                        .filter(plugin => 
                          plugin.plugin?.displayName?.toLowerCase().includes(nodeSearchQuery.toLowerCase()) ||
                          plugin.plugin?.name?.toLowerCase().includes(nodeSearchQuery.toLowerCase()) ||
                          plugin.plugin?.description?.toLowerCase().includes(nodeSearchQuery.toLowerCase())
                        )
                        .map((plugin) => (
                          <motion.div
                            key={plugin.id}
                            className="group relative"
                            whileHover={{ scale: 1.05, y: -2 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              addPluginNode(plugin, { x: 0, y: 0 })
                              setTimeout(() => {
                                centerOnNodes()
                              }, 100)
                              setShowNodeDrawer(false)
                              setNodeSearchQuery('')
                            }}
                          >
                            {/* 插件节点卡片 */}
                            <div className="relative flex flex-col items-center p-4 bg-gradient-to-br from-white via-gray-50 to-white dark:from-gray-800 dark:via-gray-850 dark:to-gray-800 rounded-2xl cursor-pointer transition-all duration-300 border border-gray-200/60 dark:border-gray-700/60 hover:border-gray-300/80 dark:hover:border-gray-600/80 shadow-lg hover:shadow-2xl backdrop-blur-sm overflow-hidden">
                              
                              {/* 背景装饰 */}
                              <div className="absolute top-0 right-0 w-16 h-16 opacity-10">
                                <div 
                                  className="w-full h-full rounded-full blur-xl"
                                  style={{ backgroundColor: plugin.plugin?.color || '#7c2d12' }}
                                />
                              </div>
                              
                              {/* 顶部装饰条 */}
                              <div 
                                className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-orange-400 to-orange-600"
                                style={{ 
                                  background: plugin.plugin?.color 
                                    ? `linear-gradient(to right, ${plugin.plugin.color}80, ${plugin.plugin.color})` 
                                    : undefined 
                                }}
                              />
                              
                              {/* 图标容器 */}
                              <div className="relative mb-3">
                                <div 
                                  className="p-3 rounded-xl shadow-lg transition-all duration-300 bg-gradient-to-br border border-white/20 from-orange-400 to-orange-600 group-hover:scale-110 group-hover:rotate-3"
                                  style={{
                                    background: plugin.plugin?.color 
                                      ? `linear-gradient(to bottom right, ${plugin.plugin.color}CC, ${plugin.plugin.color})` 
                                      : undefined,
                                    boxShadow: `0 8px 16px -4px ${plugin.plugin?.color || '#7c2d12'}30`
                                  }}
                                >
                                  <div className="text-white drop-shadow-sm">
                                    <Package className="w-5 h-5" />
                                  </div>
                                </div>
                                {/* 图标光晕效果 */}
                                <div 
                                  className="absolute inset-0 rounded-xl blur-md opacity-30 -z-10 group-hover:opacity-50 transition-opacity duration-300"
                                  style={{ backgroundColor: plugin.plugin?.color || '#7c2d12' }}
                                />
                              </div>
                              
                              {/* 标题 */}
                              <span className="text-sm font-bold text-gray-900 dark:text-white text-center leading-tight">
                                {plugin.plugin?.displayName || plugin.plugin?.name || '插件节点'}
                              </span>
                              
                              {/* 描述 */}
                              {plugin.plugin?.description && (
                                <span className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1 line-clamp-2">
                                  {plugin.plugin.description}
                                </span>
                              )}
                              
                              {/* 悬停效果 */}
                              <div className="absolute inset-0 bg-gradient-to-t from-transparent via-transparent to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
                            </div>
                          </motion.div>
                        ))}
                    </div>
                  </>
                )}
                
                {/* 加载插件状态 */}
                {loadingPlugins && (
                  <div className="mt-8 text-center">
                    <div className="inline-flex items-center gap-2 text-gray-500 dark:text-gray-400">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-blue-500"></div>
                      <span>加载插件中...</span>
                    </div>
                  </div>
                )}
                
                {/* 空状态 */}
                {Object.entries(NODE_TYPES).filter(([type, config]) => 
                  config.label.toLowerCase().includes(nodeSearchQuery.toLowerCase()) ||
                  type.toLowerCase().includes(nodeSearchQuery.toLowerCase())
                ).length === 0 && (
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center py-16 text-gray-500 dark:text-gray-400"
                  >
                    <div className="relative">
                      <Search className="w-16 h-16 mx-auto mb-4 opacity-30" />
                      <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-16 h-16 bg-gradient-to-r from-blue-400 to-purple-500 rounded-full blur-xl opacity-20 animate-pulse" />
                    </div>
                    <p className="text-lg font-medium">未找到匹配的节点类型</p>
                    <p className="text-sm mt-2 opacity-75">尝试使用不同的关键词搜索</p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      {/* 操作说明弹窗 */}
      <Modal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        title="操作说明"
        size="lg"
      >
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              连接操作
            </h4>
            <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span>蓝色点：输出连接点</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span>绿色点：输入连接点</span>
              </div>
              <ul className="list-disc list-inside space-y-1 ml-5">
                <li>点击蓝色点开始连接</li>
                <li>拖拽到绿色点完成连接</li>
                <li>点击连接线选中连接</li>
                <li>右键连接线打开菜单</li>
                <li>双击连接线直接删除连接</li>
                <li>按Delete键删除选中连接</li>
              </ul>
            </div>
          </div>
          
          <div>
            <h4 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">
              画布操作
            </h4>
            <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400 ml-5">
              <li>拖拽空白区域移动画布视角</li>
              <li>拖拽节点调整位置（无限画布）</li>
              <li>使用 +/- 按钮缩放画布</li>
              <li>使用鼠标滚轮缩放画布</li>
              <li>点击"重置"恢复默认视图</li>
              <li>点击"居中"显示所有节点</li>
              <li>点击节点选中，显示配置按钮</li>
              <li>点击设置按钮配置节点参数</li>
            </ul>
          </div>
        </div>
      </Modal>

      {/* 发布为插件模态框 */}
      <Modal
        isOpen={showPublishModal}
        onClose={() => setShowPublishModal(false)}
        title="发布工作流为插件"
        size="lg"
      >
        <PublishWorkflowPluginModal
          workflowId={workflowId!}
          onClose={() => setShowPublishModal(false)}
        />
      </Modal>
    </div>
  )
}

// 发布工作流插件模态框组件
const PublishWorkflowPluginModal: React.FC<{
  workflowId: number
  onClose: () => void
}> = ({ workflowId, onClose }) => {
  const [workflow, setWorkflow] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(1) // 添加步骤状态
  const [formData, setFormData] = useState({
    name: '',
    displayName: '',
    description: '',
    category: 'utility' as WorkflowPluginCategory,
    icon: '',
    color: '#6366f1',
    tags: '',
    author: '',
    homepage: '',
    repository: '',
    license: 'MIT',
    inputSchema: {
      parameters: [] as any[]
    },
    outputSchema: {
      parameters: [] as any[]
    }
  })

  // 加载工作流详情
  useEffect(() => {
    const loadWorkflow = async () => {
      try {
        const response = await workflowService.getDefinition(workflowId)
        if (response.data) {
          const workflowData = response.data
          setWorkflow(workflowData)
          setFormData(prev => ({
            ...prev,
            name: workflowData.slug || workflowData.name.toLowerCase().replace(/\s+/g, '-'),
            displayName: workflowData.name,
            description: workflowData.description || ''
          }))
        }
      } catch (error) {
        console.error('加载工作流失败:', error)
      }
    }
    
    loadWorkflow()
  }, [workflowId])

  // 处理表单提交
  const handleSubmit = async () => {
    if (!workflow) return
    
    setLoading(true)
    try {
      const pluginData = {
        ...formData,
        tags: formData.tags.split(',').map((tag: string) => tag.trim()).filter(Boolean)
      }

      const response = await workflowPluginService.publishWorkflowAsPlugin(workflowId, pluginData)
      if (response.data) {
        // 使用 Toast 显示成功提示
        showAlert('您的工作流插件已成功发布到插件市场', 'success', '插件发布成功！')
        setStep(3) // 显示成功页面
        setTimeout(() => {
          onClose()
        }, 2000)
      }
    } catch (error) {
      console.error('发布工作流失败:', error)
      showAlert('插件发布时发生错误，请稍后重试', 'error', '发布失败')
    } finally {
      setLoading(false)
    }
  }

  const isFormValid = formData.name && formData.displayName && formData.description

  if (!workflow) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">加载工作流信息...</p>
      </div>
    )
  }

  // 成功页面
  if (step === 3) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-4">
          <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          插件发布成功！
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          您的工作流插件已成功发布，现在可以在插件市场中找到它。
        </p>
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            <strong>提示：</strong>插件已创建为草稿状态，您可以在插件市场的"我的插件"中查看和管理。
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-h-[80vh] overflow-y-auto">
      {/* 步骤指示器 */}
      <div className="flex items-center justify-center mb-8">
        <div className="flex items-center space-x-4">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
            step >= 1 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
          }`}>
            1
          </div>
          <div className={`h-1 w-16 ${step >= 2 ? 'bg-blue-600' : 'bg-gray-200'}`}></div>
          <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium ${
            step >= 2 ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
          }`}>
            2
          </div>
        </div>
      </div>

      {step === 1 && (
        <div className="space-y-6">
          {/* 工作流信息预览 */}
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-blue-600 rounded-lg flex items-center justify-center">
                <GitBranch className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {workflow.name}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-3">
                  {workflow.description || '暂无描述'}
                </p>
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 text-xs font-medium rounded-full ${
                    workflow.status === 'active' 
                      ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                      : workflow.status === 'draft'
                      ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                      : 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
                  }`}>
                    {workflow.status === 'active' ? '已激活' : workflow.status === 'draft' ? '草稿' : '已归档'}
                  </span>
                  <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                    {workflow.definition?.nodes?.length || 0} 个节点
                  </span>
                  <span className="text-xs text-gray-500 bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                    v{workflow.version}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 基本信息表单 */}
          <div className="space-y-6">
            <div>
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">基本信息</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    插件名称 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="my-awesome-workflow"
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-gray-500 mt-1">用于标识插件的唯一名称，建议使用小写字母和连字符</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    显示名称 <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={formData.displayName}
                    onChange={(e) => setFormData({...formData, displayName: e.target.value})}
                    placeholder="我的超棒工作流"
                  />
                  <p className="text-xs text-gray-500 mt-1">在插件市场中显示的名称</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                插件描述 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                placeholder="详细描述这个工作流插件的功能和用途..."
                className="w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-lg resize-none bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={4}
              />
              <p className="text-xs text-gray-500 mt-1">清晰的描述有助于其他用户理解和使用您的插件</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">分类</label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({...formData, category: e.target.value as WorkflowPluginCategory})}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="data_processing">📊 数据处理</option>
                  <option value="api_integration">🔗 API集成</option>
                  <option value="ai_service">🤖 AI服务</option>
                  <option value="notification">📢 通知服务</option>
                  <option value="utility">🛠️ 工具类</option>
                  <option value="business">💼 业务逻辑</option>
                  <option value="custom">⚙️ 自定义</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">主题色</label>
                <div className="flex items-center space-x-3">
                  <input
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({...formData, color: e.target.value})}
                    className="w-12 h-10 border border-gray-300 dark:border-gray-600 rounded-lg cursor-pointer"
                  />
                  <Input
                    value={formData.color}
                    onChange={(e) => setFormData({...formData, color: e.target.value})}
                    placeholder="#6366f1"
                    className="flex-1 font-mono text-sm"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="outline"
              onClick={onClose}
            >
              取消
            </Button>
            <Button
              variant="primary"
              onClick={() => setStep(2)}
              disabled={!isFormValid}
            >
              下一步
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-6">
          <div>
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">可选信息</h4>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              以下信息是可选的，但填写完整有助于提升插件的专业度和可信度。
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">标签</label>
            <Input
              value={formData.tags}
              onChange={(e) => setFormData({...formData, tags: e.target.value})}
              placeholder="自动化, 数据处理, API"
            />
            <p className="text-xs text-gray-500 mt-1">用逗号分隔多个标签，有助于用户搜索和发现</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">作者</label>
              <Input
                value={formData.author}
                onChange={(e) => setFormData({...formData, author: e.target.value})}
                placeholder="您的名称"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">主页</label>
              <Input
                value={formData.homepage}
                onChange={(e) => setFormData({...formData, homepage: e.target.value})}
                placeholder="https://example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">代码仓库</label>
              <Input
                value={formData.repository}
                onChange={(e) => setFormData({...formData, repository: e.target.value})}
                placeholder="https://github.com/user/repo"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">许可证</label>
            <select
              value={formData.license}
              onChange={(e) => setFormData({...formData, license: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="MIT">MIT License</option>
              <option value="Apache-2.0">Apache License 2.0</option>
              <option value="GPL-3.0">GNU General Public License v3.0</option>
              <option value="BSD-3-Clause">BSD 3-Clause License</option>
              <option value="ISC">ISC License</option>
              <option value="Unlicense">The Unlicense</option>
              <option value="Custom">自定义许可证</option>
            </select>
          </div>

          {/* 操作按钮 */}
          <div className="flex justify-between pt-6 border-t border-gray-200 dark:border-gray-700">
            <Button
              variant="outline"
              onClick={() => setStep(1)}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              上一步
            </Button>
            <Button
              variant="primary"
              onClick={handleSubmit}
              loading={loading}
              disabled={loading}
            >
              {loading ? '发布中...' : '发布插件'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

export default WorkflowEditor
import { post, get } from '../utils/request'

// 工作流相关类型定义
export interface WorkflowNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: {
    label: string
    config: Record<string, any>
  }
  inputs: string[]
  outputs: string[]
}

export interface WorkflowConnection {
  id: string
  source: string
  target: string
  sourceHandle: string
  targetHandle: string
}

export interface Workflow {
  id: string
  name: string
  description: string
  nodes: WorkflowNode[]
  connections: WorkflowConnection[]
  createdAt: string
  updatedAt: string
}

export interface WorkflowExecutionRequest {
  workflowId: string
  executionId?: string
  inputData: Record<string, any>
  context: {
    userId: string
    sessionId: string
    timestamp?: string
    environment?: string
  }
}

export interface WorkflowExecutionResponse {
  executionId: string
  status: string
  result?: Record<string, any>
  error?: string
  duration: number
}

export interface WebSocketMessage {
  type: string
  executionId: string
  nodeId?: string
  data?: Record<string, any>
  timestamp: number
}

// 工作流API服务
export const workflowService = {
  // 保存工作流
  async saveWorkflow(workflow: Workflow) {
    return await post<Workflow>('/workflows', workflow)
  },

  // 获取工作流列表
  async getWorkflows() {
    return await get<{ workflows: Workflow[]; total: number }>('/workflows')
  },

  // 获取特定工作流
  async getWorkflow(id: string) {
    return await get<Workflow>(`/workflows/${id}`)
  },

  // 执行工作流
  async executeWorkflow(request: WorkflowExecutionRequest) {
    return await post<WorkflowExecutionResponse>(`/workflows/${request.workflowId}/execute`, request)
  },

  // 获取执行状态
  async getExecutionStatus(executionId: string) {
    return await get<{
      executionId: string
      clientCount: number
      isActive: boolean
      lastUpdate: number
    }>(`/executions/${executionId}`)
  },

  // 获取活跃执行列表
  async getActiveExecutions() {
    return await get<{
      executions: string[]
      count: number
    }>('/executions')
  }
}

// WebSocket连接管理
export class WorkflowWebSocketManager {
  private ws: WebSocket | null = null
  private executionId: string | null = null
  private messageHandlers: Map<string, (message: WebSocketMessage) => void> = new Map()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectInterval = 1000

  // 连接到WebSocket
  connect(executionId: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('WebSocket已连接，先断开现有连接')
      this.disconnect()
    }

    this.executionId = executionId
    const wsUrl = `ws://localhost:7072/ws/workflow-execution/${executionId}`
    console.log('🔌 尝试连接WebSocket:', wsUrl)

    try {
      this.ws = new WebSocket(wsUrl)
      this.setupEventHandlers()
    } catch (error) {
      console.error('WebSocket连接失败:', error)
      this.handleReconnect()
    }
  }

  // 设置事件处理器
  private setupEventHandlers() {
    if (!this.ws) return

    this.ws.onopen = () => {
      console.log('✅ WebSocket连接已建立')
      this.reconnectAttempts = 0

      // 发送连接建立事件到前端
      const connectionMessage: WebSocketMessage = {
        type: 'connection_established',
        executionId: this.executionId || "",
        data: {
          message: 'WebSocket连接已建立',
          timestamp: Date.now()
        },
        timestamp: Date.now()
      }

      // 触发连接建立消息处理器
      this.messageHandlers.forEach((handler) => {
        try {
          handler(connectionMessage)
        } catch (error) {
          console.error('连接建立消息处理器执行失败:', error)
        }
      })
    }

    this.ws.onmessage = (event) => {
      try {
        // 处理可能的多条消息（用换行符分隔）
        const messages = event.data.split('\n').filter((msg: string) => msg.trim())
        for (const messageData of messages) {
          if (messageData.trim()) {
            try {
              const message: WebSocketMessage = JSON.parse(messageData.trim())
              this.handleMessage(message)
            } catch (parseError) {
              console.error('解析单条消息失败:', parseError)
              console.error('问题数据:', messageData.trim())
              // 尝试修复JSON格式问题
              try {
                // 如果JSON解析失败，尝试修复常见的格式问题
                let fixedData = messageData.trim()
                // 移除可能的控制字符
                fixedData = fixedData.replace(/[\x00-\x1F\x7F]/g, '')
                const message: WebSocketMessage = JSON.parse(fixedData)
                this.handleMessage(message)
              } catch (fixError) {
                console.error('修复JSON格式也失败:', fixError)
              }
            }
          }
        }
      } catch (error) {
        console.error('处理WebSocket消息失败:', error)
        console.error('原始数据:', event.data)
      }
    }

    this.ws.onclose = (event) => {
      console.log('🔌 WebSocket连接已关闭:', event.code, event.reason)
      if (event.code !== 1000) { // 非正常关闭
        console.log('🔄 检测到非正常关闭，准备重连...')
        this.handleReconnect()
      }
    }

    this.ws.onerror = (error) => {
      console.error('❌ WebSocket错误:', error)
    }
  }

  // 处理消息
  private handleMessage(message: WebSocketMessage) {
    console.log('收到WebSocket消息:', message)

    // 根据消息类型调用对应的处理器
    const handler = this.messageHandlers.get(message.type)
    if (handler) {
      try {
        handler(message)
      } catch (error) {
        console.error('消息处理器执行失败:', error)
      }
    } else {
      console.log('未找到消息类型处理器:', message.type)
    }
  }

  // 处理重连
  private handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('❌ WebSocket重连次数已达上限')
      return
    }

    this.reconnectAttempts++
    console.log(`🔄 WebSocket重连中... (${this.reconnectAttempts}/${this.maxReconnectAttempts})`)

    setTimeout(() => {
      if (this.executionId) {
        console.log('🔄 开始重连WebSocket...')
        this.connect(this.executionId)
      }
    }, this.reconnectInterval * this.reconnectAttempts)
  }

  // 注册消息处理器
  onMessage(type: string, handler: (message: WebSocketMessage) => void) {
    this.messageHandlers.set(type, handler)
  }

  // 移除消息处理器
  offMessage(type: string) {
    this.messageHandlers.delete(type)
  }

  // 断开连接
  disconnect() {
    if (this.ws) {
      this.ws.close(1000, '主动断开连接')
      this.ws = null
    }
    this.executionId = null
    this.messageHandlers.clear()
  }

  // 获取连接状态
  getConnectionState(): number {
    return this.ws ? this.ws.readyState : WebSocket.CLOSED
  }

  // 是否已连接
  isConnected(): boolean {
    return this.ws ? this.ws.readyState === WebSocket.OPEN : false
  }
}

// 创建全局WebSocket管理器实例
export const workflowWebSocketManager = new WorkflowWebSocketManager()

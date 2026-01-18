import { BaseApiService } from './base.service'
import { ApiResponse } from '@/utils/http'

// 工作流状态类型
export type WorkflowStatus = 'draft' | 'active' | 'archived'

// 工作流边类型
export type WorkflowEdgeType = 'default' | 'true' | 'false' | 'error' | 'branch'

// 工作流节点类型
export type WorkflowNodeType = 'start' | 'end' | 'task' | 'gateway' | 'event' | 'subflow' | 'parallel' | 'wait' | 'timer' | 'script'

// 工作流节点 Schema
export interface WorkflowNodeSchema {
  id: string
  name: string
  type: WorkflowNodeType
  description?: string
  inputMap?: Record<string, string>
  outputMap?: Record<string, string>
  properties?: Record<string, string>
  lanes?: string[]
  position?: { x: number; y: number }
}

// 工作流边 Schema
export interface WorkflowEdgeSchema {
  id: string
  source: string
  target: string
  type?: WorkflowEdgeType
  condition?: string
  description?: string
  metadata?: Record<string, any>
}

// 工作流图定义
export interface WorkflowGraph {
  nodes: WorkflowNodeSchema[]
  edges: WorkflowEdgeSchema[]
  metadata?: Record<string, any>
}

// 触发器配置类型
export interface WorkflowTriggerConfig {
  api?: {
    enabled: boolean
    public: boolean
    apiKey?: string
    description?: string
  }
  event?: {
    enabled: boolean
    events: string[]
    condition?: string
  }
  schedule?: {
    enabled: boolean
    cronExpr: string
    timezone?: string
  }
  webhook?: {
    enabled: boolean
    url?: string
    secret?: string
    method?: string
  }
  assistant?: {
    enabled: boolean
    assistantIds?: number[]
    intents?: string[]
    description?: string
  }
}

// 工作流定义
export interface WorkflowDefinition {
  id: number
  name: string
  slug: string
  description: string
  version: number
  status: WorkflowStatus
  definition: WorkflowGraph
  settings?: Record<string, any>
  triggers?: WorkflowTriggerConfig
  tags?: string[]
  createdBy: string
  updatedBy: string
  createdAt: string
  updatedAt: string
}

// 工作流版本
export interface WorkflowVersion {
  id: number
  definitionId: number
  version: number
  name: string
  slug: string
  description: string
  status: WorkflowStatus
  definition: WorkflowGraph
  settings?: Record<string, any>
  triggers?: WorkflowTriggerConfig
  tags?: string[]
  createdBy: string
  updatedBy: string
  changeNote?: string
  createdAt: string
}

// 工作流版本对比结果
export interface WorkflowVersionDiff {
  name?: { old: string; new: string }
  description?: { old: string; new: string }
  status?: { old: string; new: string }
  nodes?: {
    added?: WorkflowNodeSchema[]
    removed?: WorkflowNodeSchema[]
    modified?: Array<{ id: string; old: WorkflowNodeSchema; new: WorkflowNodeSchema }>
  }
  edges?: {
    added?: WorkflowEdgeSchema[]
    removed?: WorkflowEdgeSchema[]
    modified?: Array<{ id: string; old: WorkflowEdgeSchema; new: WorkflowEdgeSchema }>
  }
  settings?: { old: Record<string, any>; new: Record<string, any> }
  triggers?: { old: Record<string, any>; new: Record<string, any> }
}

// 工作流版本对比响应
export interface WorkflowVersionCompareResponse {
  version1: WorkflowVersion
  version2: WorkflowVersion
  diff: WorkflowVersionDiff
}

// 创建工作流定义请求
export interface CreateWorkflowDefinitionRequest {
  name: string
  slug: string
  description?: string
  status?: WorkflowStatus
  definition: WorkflowGraph
  settings?: Record<string, any>
  triggers?: WorkflowTriggerConfig
  tags?: string[]
  version?: number
}

// 更新工作流定义请求
export interface UpdateWorkflowDefinitionRequest {
  name?: string
  description?: string
  status?: WorkflowStatus
  definition?: WorkflowGraph
  settings?: Record<string, any>
  triggers?: WorkflowTriggerConfig
  tags?: string[]
  version: number // 必须提供当前版本号，用于乐观锁
  changeNote?: string // 版本变更说明
}

// 工作流定义列表查询参数
export interface ListWorkflowDefinitionsParams {
  status?: WorkflowStatus
  keyword?: string
}

// 执行日志
export interface ExecutionLog {
  timestamp: string
  level: 'info' | 'success' | 'warning' | 'error' | 'debug'
  message: string
  nodeId?: string
  nodeName?: string
}

// 工作流实例类型
export interface WorkflowInstance {
  id: number
  definitionId: number
  definitionName: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  currentNodeId?: string
  contextData?: Record<string, any>
  resultData?: Record<string, any>
  startedAt?: string
  completedAt?: string
  createdAt: string
  updatedAt: string
}

// 工作流运行响应（包含日志）
export interface RunWorkflowResponse {
  instance: WorkflowInstance
  logs?: ExecutionLog[]
}

// 节点测试响应
export interface NodeTestResponse {
  nodeId: string
  nodeName: string
  status: string
  nextNodes: string[]
  context: Record<string, any>
  logs: ExecutionLog[]
  error?: string
}

// 事件类型响应
export interface EventTypesResponse {
  event_types: Array<{
    type: string
    first_published: string | null
    source: string
  }>
  total: number
}

// Workflow Service 类
export class WorkflowService extends BaseApiService {
  constructor() {
    super('/workflows')
  }

  // 创建工作流定义
  async createDefinition(data: CreateWorkflowDefinitionRequest): Promise<WorkflowDefinition> {
    const response = await this.post<WorkflowDefinition>('/definitions', data)
    return this.handleResponse(response)
  }

  // 获取工作流定义列表
  async listDefinitions(params?: ListWorkflowDefinitionsParams): Promise<WorkflowDefinition[]> {
    const response = await this.get<WorkflowDefinition[]>('/definitions', { params })
    return this.handleResponse(response)
  }

  // 获取单个工作流定义
  async getDefinition(id: number): Promise<WorkflowDefinition> {
    const response = await this.get<WorkflowDefinition>(`/definitions/${id}`)
    return this.handleResponse(response)
  }

  // 更新工作流定义
  async updateDefinition(id: number, data: UpdateWorkflowDefinitionRequest): Promise<WorkflowDefinition> {
    const response = await this.put<WorkflowDefinition>(`/definitions/${id}`, data)
    return this.handleResponse(response)
  }

  // 删除工作流定义
  async deleteDefinition(id: number): Promise<{ message: string }> {
    const response = await this.delete<{ message: string }>(`/definitions/${id}`)
    return this.handleResponse(response)
  }

  // 运行工作流定义
  async runDefinition(id: number, parameters?: Record<string, any>): Promise<RunWorkflowResponse> {
    const response = await this.post<RunWorkflowResponse>(`/definitions/${id}/run`, {
      parameters: parameters || {}
    })
    return this.handleResponse(response)
  }

  // 测试单个节点
  async testNode(definitionId: number, nodeId: string, parameters?: Record<string, any>): Promise<NodeTestResponse> {
    const response = await this.post<NodeTestResponse>(`/definitions/${definitionId}/nodes/${nodeId}/test`, {
      parameters: parameters || {}
    })
    return this.handleResponse(response)
  }

  // 获取工作流定义的历史版本列表
  async listVersions(definitionId: number): Promise<WorkflowVersion[]> {
    const response = await this.get<WorkflowVersion[]>(`/definitions/${definitionId}/versions`)
    return this.handleResponse(response)
  }

  // 获取工作流定义的特定版本
  async getVersion(definitionId: number, versionId: number): Promise<WorkflowVersion> {
    const response = await this.get<WorkflowVersion>(`/definitions/${definitionId}/versions/${versionId}`)
    return this.handleResponse(response)
  }

  // 回滚工作流定义到特定版本
  async rollbackVersion(definitionId: number, versionId: number): Promise<WorkflowDefinition> {
    const response = await this.post<WorkflowDefinition>(`/definitions/${definitionId}/versions/${versionId}/rollback`)
    return this.handleResponse(response)
  }

  // 对比两个工作流版本
  async compareVersions(definitionId: number, version1Id: number, version2Id: number): Promise<WorkflowVersionCompareResponse> {
    const response = await this.get<WorkflowVersionCompareResponse>(`/definitions/${definitionId}/versions/compare`, {
      params: {
        version1: version1Id,
        version2: version2Id
      }
    })
    return this.handleResponse(response)
  }

  // 获取可用的事件类型
  async getAvailableEventTypes(): Promise<EventTypesResponse> {
    const response = await this.get<EventTypesResponse>('/events/types')
    return this.handleResponse(response)
  }
}

// 导出服务实例
export const workflowService = new WorkflowService()

// 兼容性导出（保持向后兼容）
export const createDefinition = (data: CreateWorkflowDefinitionRequest) => workflowService.createDefinition(data)
export const listDefinitions = (params?: ListWorkflowDefinitionsParams) => workflowService.listDefinitions(params)
export const getDefinition = (id: number) => workflowService.getDefinition(id)
export const updateDefinition = (id: number, data: UpdateWorkflowDefinitionRequest) => workflowService.updateDefinition(id, data)
export const deleteDefinition = (id: number) => workflowService.deleteDefinition(id)
export const runDefinition = (id: number, parameters?: Record<string, any>) => workflowService.runDefinition(id, parameters)
export const testNode = (definitionId: number, nodeId: string, parameters?: Record<string, any>) => workflowService.testNode(definitionId, nodeId, parameters)
export const listVersions = (definitionId: number) => workflowService.listVersions(definitionId)
export const getVersion = (definitionId: number, versionId: number) => workflowService.getVersion(definitionId, versionId)
export const rollbackVersion = (definitionId: number, versionId: number) => workflowService.rollbackVersion(definitionId, versionId)
export const compareVersions = (definitionId: number, version1Id: number, version2Id: number) => workflowService.compareVersions(definitionId, version1Id, version2Id)
export const getAvailableEventTypes = () => workflowService.getAvailableEventTypes()

export default workflowService


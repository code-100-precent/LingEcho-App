import { BaseApiService } from './base.service'

// 知识库基本信息
export interface KnowledgeBase {
    id: number
    user_id: number
    group_id?: number | null // 组织ID，如果设置则表示这是组织共享的知识库
    knowledge_key: string
    knowledge_name: string
    provider?: string
    created_at: string
    updated_at?: string
    update_at: string
    delete_at: string
}

// 创建知识库请求参数
export interface CreateKnowledgeBaseRequest {
    knowledgeName: string
    file: File
    groupId?: number | null // 组织ID，如果设置则创建为组织共享的知识库
}

// 上传文件到知识库请求参数
export interface UploadKnowledgeBaseRequest {
    file: File
    knowledgeKey: string
}

// 删除知识库请求参数
export interface DeleteKnowledgeBaseRequest {
    knowledgeKey: string
}

export interface KnowledgeInfo {
    name: string
    key: string
}

// 根据用户ID获取知识库列表响应
export type GetKnowledgeBaseByUserResponse = KnowledgeInfo[]

// 向知识库提问请求参数
export interface AskKnowledgeBaseRequest {
    knowledgeKey: string
    message: string
}

// 向知识库提问响应
export type AskKnowledgeBaseResponse = string

class KnowledgeService extends BaseApiService {
    constructor() {
        super('/knowledge')
    }

    // 创建知识库
    async createKnowledgeBase(data: CreateKnowledgeBaseRequest): Promise<KnowledgeBase> {
        const formData = new FormData()
        formData.append('knowledgeName', data.knowledgeName)
        formData.append('file', data.file)
        if (data.groupId) {
            formData.append('group_id', data.groupId.toString())
        }
        const response = await this.post<KnowledgeBase>('/create', formData)
        this.invalidateCache()
        return this.handleResponse(response)
    }

    // 上传文件到知识库
    async uploadKnowledgeBase(data: UploadKnowledgeBaseRequest): Promise<null> {
        const formData = new FormData()
        formData.append('file', data.file)
        formData.append('knowledgeKey', data.knowledgeKey)
        const response = await this.post<null>('/upload', formData)
        this.invalidateCache()
        return this.handleResponse(response)
    }

    // 删除知识库
    async deleteKnowledgeBase(knowledgeKey: string): Promise<string> {
        const response = await this.delete<string>('/delete', {
            params: { knowledgeKey }
        })
        this.invalidateCache()
        return this.handleResponse(response)
    }

    // 根据用户ID获取知识库名称列表
    async getKnowledgeBaseByUser(): Promise<GetKnowledgeBaseByUserResponse> {
        const response = await this.get<GetKnowledgeBaseByUserResponse>('/get', {}, { enabled: true, ttl: 60000 })
        return this.handleResponse(response)
    }

    // 向知识库提问
    async askKnowledgeBase(params: AskKnowledgeBaseRequest): Promise<AskKnowledgeBaseResponse> {
        const response = await this.get<AskKnowledgeBaseResponse>('/getInfo', { params })
        return this.handleResponse(response)
    }
}

// 导出单例
export const knowledgeService = new KnowledgeService()

// 兼容性导出
export const createKnowledgeBase = knowledgeService.createKnowledgeBase.bind(knowledgeService)
export const uploadKnowledgeBase = knowledgeService.uploadKnowledgeBase.bind(knowledgeService)
export const deleteKnowledgeBase = knowledgeService.deleteKnowledgeBase.bind(knowledgeService)
export const getKnowledgeBaseByUser = knowledgeService.getKnowledgeBaseByUser.bind(knowledgeService)
export const askKnowledgeBase = knowledgeService.askKnowledgeBase.bind(knowledgeService)


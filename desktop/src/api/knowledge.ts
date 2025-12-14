import { get, post, del, ApiResponse } from '@/utils/request'

// 知识库基本信息
export interface KnowledgeBase {
    id: number
    userid: number
    knowledge_key: string
    knowledge_name: string
    created_at: string
    update_at: string
    delete_at: string
}

// 创建知识库请求参数
export interface CreateKnowledgeBaseRequest {
    knowledgeName: string
    file: File
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

// 创建知识库
export const createKnowledgeBase = async (
    data: CreateKnowledgeBaseRequest
): Promise<ApiResponse<KnowledgeBase>> => {
    const formData = new FormData()
    formData.append('knowledgeName', data.knowledgeName)
    formData.append('file', data.file)
    return post<KnowledgeBase>('/knowledge/create', formData)
}

// 上传文件到知识库
// 在 knowledge.ts 中检查 uploadKnowledgeBase 函数
export const uploadKnowledgeBase = async (
    data: UploadKnowledgeBaseRequest
): Promise<ApiResponse<null>> => {
    const formData = new FormData()
    formData.append('file', data.file)
    formData.append('knowledgeKey', data.knowledgeKey) // 确保参数名匹配
    return post<null>('/knowledge/upload', formData)
}


// 删除知识库
export const deleteKnowledgeBase = async (
    knowledgeKey: string
): Promise<ApiResponse<string>> => {
    return del<string>('/knowledge/delete', {
        params: { knowledgeKey }
    })
}

// 根据用户ID获取知识库名称列表
export const getKnowledgeBaseByUser = async (): Promise<ApiResponse<GetKnowledgeBaseByUserResponse>> => {
    return get<GetKnowledgeBaseByUserResponse>(
        '/knowledge/get',
    )
}
// 向知识库提问
export const askKnowledgeBase = async (
    params: AskKnowledgeBaseRequest
): Promise<ApiResponse<AskKnowledgeBaseResponse>> => {
    return get<AskKnowledgeBaseResponse>(
        '/knowledge/getInfo',
        { params }
    )
}


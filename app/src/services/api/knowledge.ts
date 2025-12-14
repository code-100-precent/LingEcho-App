/**
 * 知识库API服务
 */
import { get, post, del, ApiResponse } from '../../utils/request';

// 知识库信息
export interface KnowledgeInfo {
  name: string;
  key: string;
}

// 根据用户ID获取知识库列表响应
export type GetKnowledgeBaseByUserResponse = KnowledgeInfo[];

// 根据用户ID获取知识库名称列表
export const getKnowledgeBaseByUser = async (): Promise<ApiResponse<GetKnowledgeBaseByUserResponse>> => {
  return get<GetKnowledgeBaseByUserResponse>('/knowledge/get');
};


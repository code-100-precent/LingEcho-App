/**
 * 组织API服务
 */
import { get, post, put, del, ApiResponse } from '../../utils/request';

// 组织权限
export interface GroupPermission {
  permissions: string[];
}

// 组织信息
export interface Group {
  id: number;
  createdAt: string;
  updatedAt: string;
  name: string;
  type?: string;
  extra?: string;
  avatar?: string;
  permission?: GroupPermission;
  creatorId: number;
  creator?: {
    id: number;
    email: string;
    displayName?: string;
  };
  memberCount?: number;
  myRole?: string;
  members?: GroupMember[];
}

// 组织成员
export interface GroupMember {
  id: number;
  createdAt: string;
  userId: number;
  user: {
    id: number;
    email: string;
    displayName?: string;
  };
  groupId: number;
  role: string;
}

// 创建组织请求
export interface CreateGroupRequest {
  name: string;
  type?: string;
  extra?: string;
  permission?: GroupPermission;
}

// 更新组织请求
export interface UpdateGroupRequest {
  name?: string;
  type?: string;
  extra?: string;
  permission?: GroupPermission;
}

// 获取组织列表
export const getGroupList = async (): Promise<ApiResponse<Group[]>> => {
  return get('/group');
};

// 获取组织详情
export const getGroup = async (id: number): Promise<ApiResponse<Group>> => {
  return get(`/group/${id}`);
};

// 创建组织
export const createGroup = async (data: CreateGroupRequest): Promise<ApiResponse<Group>> => {
  return post('/group', data);
};

// 更新组织
export const updateGroup = async (id: number, data: UpdateGroupRequest): Promise<ApiResponse<Group>> => {
  return put(`/group/${id}`, data);
};

// 删除组织
export const deleteGroup = async (id: number): Promise<ApiResponse<null>> => {
  return del(`/group/${id}`);
};

// 离开组织
export const leaveGroup = async (id: number): Promise<ApiResponse<null>> => {
  return post<null>(`/group/${id}/leave`, {});
};


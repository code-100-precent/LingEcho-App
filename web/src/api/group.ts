import { BaseApiService } from './base.service'

// 组织权限
export interface GroupPermission {
  permissions: string[]
}

// 组织信息
export interface Group {
  id: number
  createdAt: string
  updatedAt: string
  name: string
  type?: string
  extra?: string
  avatar?: string
  permission?: GroupPermission
  creatorId: number
  creator?: {
    id: number
    email: string
    displayName?: string
  }
  memberCount?: number
  myRole?: string
  members?: GroupMember[]
}

// 组织成员
export interface GroupMember {
  id: number
  createdAt: string
  userId: number
  user: {
    id: number
    email: string
    displayName?: string
  }
  groupId: number
  role: string
}

// 组织邀请
export interface GroupInvitation {
  id: number
  createdAt: string
  updatedAt: string
  groupId: number
  group: Group
  inviterId: number
  inviter: {
    id: number
    email: string
    displayName?: string
  }
  inviteeId: number
  invitee: {
    id: number
    email: string
    displayName?: string
  }
  status: 'pending' | 'accepted' | 'rejected' | 'expired'
  expiresAt?: string
}

// 创建组织请求
export interface CreateGroupRequest {
  name: string
  type?: string
  extra?: string
  permission?: GroupPermission
}

// 更新组织请求
export interface UpdateGroupRequest {
  name?: string
  type?: string
  extra?: string
  permission?: GroupPermission
}

// 邀请用户请求
export interface InviteUserRequest {
  userId: number
}

// 用户搜索结果
export interface UserSearchResult {
  id: number
  email: string
  displayName: string
  firstName: string
  lastName: string
  avatar?: string
  createdAt: string
}

// 组织共享的资源
export interface GroupSharedResources {
  assistants: Array<{
    id: number
    name: string
    description: string
    icon: string
    createdAt: string
  }>
  knowledgeBases: Array<{
    id: number
    knowledge_key: string
    knowledge_name: string
    created_at: string
  }>
}

// 更新成员角色请求
export interface UpdateMemberRoleRequest {
  role: string
}

class GroupService extends BaseApiService {
  constructor() {
    super('/group')
  }

  // 创建组织
  async createGroup(data: CreateGroupRequest): Promise<Group> {
    const response = await this.post<Group>('', data)
    this.invalidateCache()
    return this.handleResponse(response)
  }

  // 获取组织列表
  async getGroupList(): Promise<Group[]> {
    const response = await this.get<Group[]>('', {}, { enabled: true, ttl: 60000 })
    return this.handleResponse(response)
  }

  // 获取组织详情
  async getGroup(id: number): Promise<Group> {
    const response = await this.get<Group>(`/${id}`, {}, { enabled: true, ttl: 300000 })
    return this.handleResponse(response)
  }

  // 更新组织
  async updateGroup(id: number, data: UpdateGroupRequest): Promise<Group> {
    const response = await this.put<Group>(`/${id}`, data)
    this.invalidateCache()
    return this.handleResponse(response)
  }

  // 删除组织
  async deleteGroup(id: number): Promise<null> {
    const response = await this.delete<null>(`/${id}`)
    this.invalidateCache()
    return this.handleResponse(response)
  }

  // 离开组织
  async leaveGroup(id: number): Promise<null> {
    const response = await this.post<null>(`/${id}/leave`)
    this.invalidateCache()
    return this.handleResponse(response)
  }

  // 移除成员
  async removeMember(groupId: number, memberId: number): Promise<null> {
    const response = await this.delete<null>(`/${groupId}/members/${memberId}`)
    this.invalidateCache()
    return this.handleResponse(response)
  }

  // 邀请用户
  async inviteUser(groupId: number, data: InviteUserRequest): Promise<GroupInvitation> {
    const response = await this.post<GroupInvitation>(`/${groupId}/invite`, data)
    return this.handleResponse(response)
  }

  // 获取邀请列表
  async getInvitations(): Promise<GroupInvitation[]> {
    const response = await this.get<GroupInvitation[]>('/invitations', {}, { enabled: true, ttl: 30000 })
    return this.handleResponse(response)
  }

  // 接受邀请
  async acceptInvitation(id: number): Promise<null> {
    const response = await this.post<null>(`/invitations/${id}/accept`)
    this.invalidateCache()
    return this.handleResponse(response)
  }

  // 拒绝邀请
  async rejectInvitation(id: number): Promise<null> {
    const response = await this.post<null>(`/invitations/${id}/reject`)
    this.invalidateCache()
    return this.handleResponse(response)
  }

  // 搜索用户（用于邀请）
  async searchUsers(keyword: string, limit: number = 20): Promise<UserSearchResult[]> {
    const response = await this.get<UserSearchResult[]>('/search-users', { params: { keyword, limit } })
    return this.handleResponse(response)
  }

  // 获取组织共享的资源
  async getGroupSharedResources(groupId: number): Promise<GroupSharedResources> {
    const response = await this.get<GroupSharedResources>(`/${groupId}/resources`, {}, { enabled: true, ttl: 60000 })
    return this.handleResponse(response)
  }

  // 上传组织头像
  async uploadGroupAvatar(groupId: number, file: File): Promise<{ avatar: string }> {
    const formData = new FormData()
    formData.append('avatar', file)
    const response = await this.post<{ avatar: string }>(`/${groupId}/avatar`, formData)
    this.invalidateCache()
    return this.handleResponse(response)
  }

  // 更新成员角色
  async updateMemberRole(groupId: number, memberId: number, role: string): Promise<null> {
    const response = await this.put<null>(`/${groupId}/members/${memberId}/role`, { role })
    this.invalidateCache()
    return this.handleResponse(response)
  }
}

// 导出单例
export const groupService = new GroupService()

// 兼容性导出
export const createGroup = groupService.createGroup.bind(groupService)
export const getGroupList = groupService.getGroupList.bind(groupService)
export const getGroup = groupService.getGroup.bind(groupService)
export const updateGroup = groupService.updateGroup.bind(groupService)
export const deleteGroup = groupService.deleteGroup.bind(groupService)
export const leaveGroup = groupService.leaveGroup.bind(groupService)
export const removeMember = groupService.removeMember.bind(groupService)
export const inviteUser = groupService.inviteUser.bind(groupService)
export const getInvitations = groupService.getInvitations.bind(groupService)
export const acceptInvitation = groupService.acceptInvitation.bind(groupService)
export const rejectInvitation = groupService.rejectInvitation.bind(groupService)
export const searchUsers = groupService.searchUsers.bind(groupService)
export const getGroupSharedResources = groupService.getGroupSharedResources.bind(groupService)
export const uploadGroupAvatar = groupService.uploadGroupAvatar.bind(groupService)
export const updateMemberRole = groupService.updateMemberRole.bind(groupService)


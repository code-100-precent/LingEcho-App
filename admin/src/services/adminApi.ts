import { get, post, put, del, patch } from '@/utils/request'
import { getApiBaseURL } from '@/config/apiConfig'

const API_BASE = getApiBaseURL()
const ADMIN_BASE = '/admin'

// 根据对象名称获取路径
// 注意：根据代码逻辑，如果Path未设置，会使用 strings.ToLower(obj.Name)
// 所以 User 对象的路径是 "user"（单数）
const getAdminObjectPath = (objectName: string): string => {
  // 直接使用小写的对象名称（根据代码逻辑，User -> user）
  return objectName.toLowerCase()
}

// ==================== Dashboard API ====================
export interface DashboardStats {
  pv?: {
    today: number
    yesterday: number
    change: number
  }
  uv?: {
    today: number
    yesterday: number
    change: number
  }
  apiCalls?: {
    today: number
    yesterday: number
    change: number
  }
  activeUsers?: {
    today: number
    yesterday: number
    change: number
  }
  // 兼容旧数据格式
  totalUsers?: number
  userGrowth?: number
  visitTrend?: number[]
  userDistribution?: Array<{ name: string; value: number }>
  recentActivities?: Array<{
    id: number
    type: string
    title: string
    content: string
    createdAt: string
  }>
}

export const getDashboardStats = async () => {
  const res = await get<DashboardStats>(`${ADMIN_BASE}/dashboard/metrics`)
  return res.data
}

// ==================== Users API ====================
export interface User {
  id: number
  email: string
  displayName?: string
  firstName?: string
  lastName?: string
  enabled: boolean
  isStaff: boolean
  isSuperUser: boolean
  createdAt: string
}

export interface UserListResponse {
  list: User[]
  total: number
  page: number
  pageSize: number
}

// 使用server的admin系统，POST查询，PATCH更新，DELETE删除
export const getUsers = async (params?: {
  page?: number
  pageSize?: number
  search?: string
  status?: string
  role?: string
  isStaff?: boolean
  isSuperUser?: boolean
}) => {
  // server的admin系统使用POST查询，参数在body中
  const queryParams: any = {
    pos: params?.page ? (params.page - 1) * (params.pageSize || 10) : 0,
    limit: params?.pageSize || 10,
  }
  if (params?.search) {
    queryParams.keyword = params.search
  }
  
  // 构建filters数组
  const filters: any[] = []
  if (params?.status) {
    filters.push({ name: 'enabled', op: '=', value: params.status === 'enabled' || params.status === 'active' })
  }
  if (params?.isStaff !== undefined) {
    filters.push({ name: 'is_staff', op: '=', value: params.isStaff })
  }
  if (params?.isSuperUser !== undefined) {
    filters.push({ name: 'role', op: '=', value: params.isSuperUser ? 'superadmin' : 'user' })
  }
  if (params?.role) {
    if (params.role === 'superadmin') {
      filters.push({ name: 'role', op: '=', value: 'superadmin' })
    } else if (params.role === 'admin') {
      filters.push({ name: 'is_staff', op: '=', value: true })
    }
  }
  
  if (filters.length > 0) {
    queryParams.filters = filters
  }
  
  // 获取User对象的实际路径（根据代码逻辑，User -> user）
  const userPath = getAdminObjectPath('User')
  const res = await post<any>(`${ADMIN_BASE}/${userPath}/`, queryParams)
  // 转换server返回格式到前端期望格式
  // server返回格式: {total: number, items: User[]}
  const serverData = res.data as any
  return {
    list: serverData.items || [],
    total: serverData.total || 0,
    page: params?.page || 1,
    pageSize: params?.pageSize || 10,
  }
}

export const getUser = async (id: number) => {
  // server的admin系统使用POST查询单个，通过filters指定id
  const userPath = getAdminObjectPath('User')
  const res = await post<any>(`${ADMIN_BASE}/${userPath}/`, {
    filters: [{ name: 'id', op: '=', value: id }],
    limit: 1,
  })
  const serverData = res.data as any
  return (serverData.items?.[0] || null) as User
}

export const updateUser = async (id: number, data: Partial<User>) => {
  // server的admin系统使用PATCH更新，id在query参数中
  const userPath = getAdminObjectPath('User')
  const res = await patch(`${ADMIN_BASE}/${userPath}/?id=${id}`, data)
  return res.data
}

export const deleteUser = async (id: number) => {
  // server的admin系统使用DELETE删除，id在query参数中
  const userPath = getAdminObjectPath('User')
  const res = await del(`${ADMIN_BASE}/${userPath}/?id=${id}`)
  return res.data
}

// ==================== Notifications API ====================
export interface Notification {
  id: number
  title: string
  content: string
  type?: string
  read: boolean
  createdAt: string
}

export interface NotificationListResponse {
  list: Notification[]
  total: number
  page: number
  pageSize: number
}

export const getNotifications = async (params?: {
  page?: number
  pageSize?: number
  search?: string
  filter?: 'all' | 'read' | 'unread'
  userId?: string
}) => {
  // 管理后台专用的notification接口
  const queryParams: any = {}
  if (params?.page) queryParams.page = params.page
  if (params?.pageSize) queryParams.pageSize = params.pageSize
  if (params?.filter === 'read') queryParams.read = true
  if (params?.filter === 'unread') queryParams.read = false
  const res = await get<NotificationListResponse>(`${ADMIN_BASE}/notification`, { params: queryParams })
  // 转换server返回格式
  if (Array.isArray(res.data)) {
    return {
      list: res.data,
      total: res.data.length,
      page: params?.page || 1,
      pageSize: params?.pageSize || 10,
    }
  }
  return res.data
}

export const markAllNotificationsRead = async (userId?: string) => {
  const res = await post(`${ADMIN_BASE}/notification/readAll`, userId ? { userId } : {})
  return res.data
}

export const deleteNotification = async (id: number) => {
  const res = await del(`${ADMIN_BASE}/notification/${id}`)
  return res.data
}

// ==================== Profile API ====================
// 管理后台专用的认证接口
const ADMIN_AUTH_BASE = `${ADMIN_BASE}/auth`

export interface ProfileUpdateRequest {
  displayName?: string
  email?: string
  phone?: string
  timezone?: string
  gender?: string
  avatar?: string
  extra?: string
}

export interface ChangePasswordRequest {
  oldPassword: string
  newPassword: string
}

// 获取当前管理员信息
export const getCurrentUser = async () => {
  const res = await get(`${ADMIN_AUTH_BASE}/info`)
  return res.data
}

// 更新管理员信息
export const updateProfile = async (data: ProfileUpdateRequest) => {
  const res = await put(`${ADMIN_AUTH_BASE}/update`, data)
  return res.data
}

// 修改管理员密码
export const changePassword = async (data: ChangePasswordRequest) => {
  const res = await post(`${ADMIN_AUTH_BASE}/change-password`, data)
  return res.data
}

// 上传管理员头像
export const uploadAvatar = async (file: File) => {
  const formData = new FormData()
  // 后端期望的字段名是 "avatar"，不是 "file"
  formData.append('avatar', file)
    const res = await post(`${ADMIN_AUTH_BASE}/avatar/upload`, formData, {
      headers: {} as any, // FormData会自动设置Content-Type
    })
  // 后端返回格式是 {code: 200, msg: "...", data: {avatar: "..."}}
  return res.data
}



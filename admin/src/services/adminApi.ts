import { get, post, put, del } from '@/utils/request'
import { getApiBaseURL } from '@/config/apiConfig'

const API_BASE = `${getApiBaseURL()}/admin-api`

// ==================== Dashboard API ====================
export interface DashboardStats {
  totalUsers: number
  totalOrders: number
  totalPlaymates: number
  activeUsers: number
  totalRevenue: number
  todayOrders: number
  todayRevenue: number
  pendingOrders: number
  userGrowth: number
  orderGrowth: number
  revenueGrowth: number
  visitTrend: number[]
  userDistribution: Array<{ name: string; value: number }>
  orderStats: Array<{ month: string; count: number; amount: number }>
  recentActivities: Array<{
    id: number
    type: string
    title: string
    content: string
    createdAt: string
  }>
}

export const getDashboardStats = async () => {
  const res = await get<DashboardStats>(`${API_BASE}/dashboard/stats`)
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

export const getUsers = async (params?: {
  page?: number
  pageSize?: number
  search?: string
  status?: string
}) => {
  const res = await get<UserListResponse>(`${API_BASE}/users`, { params })
  return res.data
}

export const getUser = async (id: number) => {
  const res = await get<User>(`${API_BASE}/users/${id}`)
  return res.data
}

export const updateUser = async (id: number, data: Partial<User>) => {
  const res = await put(`${API_BASE}/users/${id}`, data)
  return res.data
}

export const deleteUser = async (id: number) => {
  const res = await del(`${API_BASE}/users/${id}`)
  return res.data
}

// ==================== Posts API ====================
export interface Post {
  id: number
  userId?: number
  title: string
  content: string
  summary?: string
  coverImage?: string
  coverImageURL?: string
  images?: string | Array<{ id: string; url: string }>
  author?: string
  authorName?: string
  authorEmail?: string
  user?: {
    id: number
    displayName?: string
    name?: string
    email?: string
    avatar?: string
  }
  tags?: Array<{ id: number; name: string }>
  topics?: Array<{ id: number; title: string }>
  views?: number
  viewCount?: number
  likes?: number
  likeCount?: number
  commentCount?: number
  collectionCount?: number
  shareCount?: number
  status: 'published' | 'draft' | 'pending' | 'rejected' | 'deleted'
  isTop?: boolean
  isHot?: boolean
  isRecommended?: boolean
  createdAt: string
  updatedAt?: string
}

export interface PostListResponse {
  list: Post[]
  total: number
  page: number
  pageSize: number
}

export const getPosts = async (params?: {
  page?: number
  pageSize?: number
  search?: string
  status?: string
  userId?: number
  tagId?: number
  isTop?: boolean
  isHot?: boolean
  isRecommended?: boolean
  startDate?: string
  endDate?: string
}) => {
  const res = await get<PostListResponse>(`${API_BASE}/posts`, { params })
  return res.data
}

export const getPost = async (id: number) => {
  const res = await get<Post>(`${API_BASE}/posts/${id}`)
  return res.data
}

export const createPost = async (data: {
  title: string
  content: string
  summary?: string
  coverImage?: string
  images?: string[]
  tagIds?: number[]
  topicIds?: number[]
  status?: 'published' | 'draft' | 'pending'
  isTop?: boolean
  isHot?: boolean
  isRecommended?: boolean
  userId?: number
}) => {
  const res = await post(`${API_BASE}/posts`, data)
  return res.data
}

export const updatePost = async (id: number, data: {
  title?: string
  content?: string
  summary?: string
  coverImage?: string
  images?: string[]
  tagIds?: number[]
  topicIds?: number[]
  status?: 'published' | 'draft' | 'pending' | 'rejected' | 'deleted'
  isTop?: boolean
  isHot?: boolean
  isRecommended?: boolean
}) => {
  const res = await put(`${API_BASE}/posts/${id}`, data)
  return res.data
}

export const deletePost = async (id: number) => {
  const res = await del(`${API_BASE}/posts/${id}`)
  return res.data
}

export const approvePost = async (id: number) => {
  const res = await post(`${API_BASE}/posts/${id}/approve`)
  return res.data
}

export const rejectPost = async (id: number) => {
  const res = await post(`${API_BASE}/posts/${id}/reject`)
  return res.data
}

// ==================== Orders API ====================
export interface Order {
  id: number
  orderNo: string
  playmateId?: number
  playmateName?: string
  customerId?: number
  customerName?: string
  gameName: string
  amount: number
  status: string
  createdAt: string
}

export interface OrderListResponse {
  list: Order[]
  total: number
  page: number
  pageSize: number
}

export const getOrders = async (params?: {
  page?: number
  pageSize?: number
  search?: string
  status?: string
}) => {
  const res = await get<OrderListResponse>(`${API_BASE}/orders`, { params })
  return res.data
}

export const getOrder = async (id: number) => {
  const res = await get<Order>(`${API_BASE}/orders/${id}`)
  return res.data
}

export const updateOrderStatus = async (id: number, status: string) => {
  const res = await put(`${API_BASE}/orders/${id}/status`, { status })
  return res.data
}

export const confirmPayment = async (id: number) => {
  const res = await post(`${API_BASE}/orders/${id}/confirm-payment`)
  return res.data
}

// ==================== Playmates API ====================
export interface PlaymateApplication {
  userId: number
  realName: string
  phoneNumber: string
  gameExperience: string
  gameId: string
  mainGames: string
  skillLevel: string
  profileDesc: string
  status: string
  rejectionReason?: string
  reviewedAt?: string
  createdAt: string
}

export interface Playmate {
  id: number
  name: string
  email: string
  displayName?: string
  gameName?: string
  skillLevel?: string
  rating?: number
  orderCount?: number
  status: 'verified' | 'pending' | 'rejected'
  createdAt: string
  application?: PlaymateApplication
}

export interface PlaymateListResponse {
  list: Playmate[]
  total: number
  page: number
  pageSize: number
  stats?: Array<{
    userId: number
    orderCount: number
    rating: number
  }>
}

export const getPlaymates = async (params?: {
  page?: number
  pageSize?: number
  search?: string
  status?: string
}) => {
  const res = await get<PlaymateListResponse>(`${API_BASE}/playmates`, { params })
  return res.data
}

export const approvePlaymate = async (id: number) => {
  const res = await post(`${API_BASE}/playmates/${id}/approve`)
  return res.data
}

export const rejectPlaymate = async (id: number, reason?: string) => {
  const res = await post(`${API_BASE}/playmates/${id}/reject`, { reason: reason || '' })
  return res.data
}

export const getPlaymateDetail = async (id: number) => {
  const res = await get<Playmate>(`${API_BASE}/playmates/${id}`)
  return res.data
}

// ==================== VIP Friends API ====================
export interface VIPFriend {
  id: number
  ownerUserId: number
  ownerUserName: string
  userId: number
  userName: string
  userEmail: string
  avatar: string
  gameLevel: string
  sortOrder: number
  createdAt: string
}

export const getVIPFriends = async (ownerUserId?: number) => {
  const params = ownerUserId ? { ownerUserId } : {}
  const res = await get<VIPFriend[]>(`${API_BASE}/vip-friends`, { params })
  return res.data
}

export const addVIPFriend = async (data: { ownerUserId: number; userId: number; sortOrder?: number }) => {
  const res = await post(`${API_BASE}/vip-friends`, data)
  return res.data
}

export const deleteVIPFriend = async (id: number) => {
  const res = await del(`${API_BASE}/vip-friends/${id}`)
  return res.data
}

export const updateVIPFriend = async (id: number, data: { sortOrder: number }) => {
  const res = await put(`${API_BASE}/vip-friends/${id}`, data)
  return res.data
}

// ==================== Tags API ====================
export interface Tag {
  id: number
  name: string
  postCount: number
  isHot: boolean
  sortOrder: number
}

export const getTags = async (params?: { search?: string }) => {
  const res = await get<Tag[]>(`${API_BASE}/tags`, { params })
  return res.data
}

export const createTag = async (data: { name: string; isHot?: boolean; sortOrder?: number }) => {
  const res = await post(`${API_BASE}/tags`, data)
  return res.data
}

export const updateTag = async (id: number, data: Partial<Tag>) => {
  const res = await put(`${API_BASE}/tags/${id}`, data)
  return res.data
}

export const deleteTag = async (id: number) => {
  const res = await del(`${API_BASE}/tags/${id}`)
  return res.data
}

// ==================== Topics API ====================
export interface Topic {
  id: number
  title: string
  description: string
  postCount: number
  isHot: boolean
  sortOrder: number
}

export const getTopics = async (params?: { search?: string }) => {
  const res = await get<Topic[]>(`${API_BASE}/topics`, { params })
  return res.data
}

export const createTopic = async (data: { title: string; description?: string; isHot?: boolean; sortOrder?: number }) => {
  const res = await post(`${API_BASE}/topics`, data)
  return res.data
}

export const updateTopic = async (id: number, data: Partial<Topic>) => {
  const res = await put(`${API_BASE}/topics/${id}`, data)
  return res.data
}

export const deleteTopic = async (id: number) => {
  const res = await del(`${API_BASE}/topics/${id}`)
  return res.data
}

// ==================== Rankings API ====================
export interface RankingsResponse {
  playmate?: Array<{
    userId: number
    name: string
    rating: number
    orderCount: number
  }>
  post?: Post[]
  user?: User[]
}

export const getRankings = async (type: 'playmate' | 'post' | 'user', limit?: number) => {
  const res = await get<RankingsResponse>(`${API_BASE}/rankings`, {
    params: { type, limit }
  })
  return res.data
}

// ==================== Social API ====================
export interface SocialRelation {
  id: number
  followerId: number
  followerName: string
  followerEmail?: string
  followerAvatar?: string
  followingId: number
  followingName: string
  followingEmail?: string
  followingAvatar?: string
  createdAt: string
}

export interface SocialListResponse {
  list: SocialRelation[]
  total: number
  page: number
  pageSize: number
}

export const getFollows = async (params?: {
  page?: number
  pageSize?: number
  search?: string
  userId?: string
}) => {
  const res = await get<SocialListResponse>(`${API_BASE}/social/follows`, { params })
  return res.data
}

export const getFollowers = async (params?: {
  page?: number
  pageSize?: number
  search?: string
  userId?: string
}) => {
  const res = await get<SocialListResponse>(`${API_BASE}/social/followers`, { params })
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
  const res = await get<NotificationListResponse>(`${API_BASE}/notifications`, { params })
  return res.data
}

export const markAllNotificationsRead = async (userId?: string) => {
  const res = await post(`${API_BASE}/notifications/read-all`, userId ? { userId } : {})
  return res.data
}

export const deleteNotification = async (id: number) => {
  const res = await del(`${API_BASE}/notifications/${id}`)
  return res.data
}

// ==================== Profile API ====================
const AUTH_API_BASE = `${getApiBaseURL()}/auth`

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

// 获取当前用户信息
export const getCurrentUser = async () => {
  const res = await get(`${AUTH_API_BASE}/info`)
  return res.data
}

// 更新用户信息
export const updateProfile = async (data: ProfileUpdateRequest) => {
  const res = await put(`${AUTH_API_BASE}/update`, data)
  return res.data
}

// 修改密码
export const changePassword = async (data: ChangePasswordRequest) => {
  const res = await post(`${AUTH_API_BASE}/change-password`, data)
  return res.data
}

// 上传头像
export const uploadAvatar = async (file: File) => {
  const formData = new FormData()
  // 后端期望的字段名是 "avatar"，不是 "file"
  formData.append('avatar', file)
  const res = await post(`${AUTH_API_BASE}/avatar/upload`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  })
  // 后端返回格式是 {code: 200, msg: "...", data: {avatar: "..."}}
  return res.data
}

// 上传图片（用于文章等）
export const uploadImage = async (file: File): Promise<string> => {
  const formData = new FormData()
  formData.append('file', file)
  try {
    const res = await post<{ url: string }>(`${API_BASE}/upload/image`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    // 后端返回格式是 {code: 200, msg: "...", data: {url: "..."}}
    if (res.data && typeof res.data === 'object' && 'url' in res.data) {
      return res.data.url
    }
    // 如果data直接是字符串URL
    if (typeof res.data === 'string') {
      return res.data
    }
    throw new Error('上传失败：响应格式错误')
  } catch (error: any) {
    console.error('上传图片失败:', error)
    throw new Error(error.msg || error.message || '上传失败')
  }
}


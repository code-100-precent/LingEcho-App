/**
 * 头像URL处理工具函数
 */

/**
 * 处理头像URL，如果是相对路径则拼接完整的API地址
 * @param avatarUrl 头像URL（可能是相对路径或完整URL）
 * @returns 完整的头像URL
 */
export const getAvatarUrl = (avatarUrl?: string | null): string => {
  if (!avatarUrl) {
    return ''
  }

  // 如果已经是完整的URL（以http开头），直接返回
  if (avatarUrl.startsWith('http://') || avatarUrl.startsWith('https://')) {
    return avatarUrl
  }

  // 如果是相对路径，拼接API基础URL
  const baseUrl = getApiBaseUrl()
  // 移除baseUrl末尾的/api，因为头像路径已经包含了/media
  const apiBaseUrl = baseUrl.replace('/api', '')
  
  // 处理Windows路径分隔符
  const normalizedPath = avatarUrl.replace(/\\/g, '/')
  
  return `${apiBaseUrl}${normalizedPath}`
}

/**
 * 获取API基础URL（复用axios配置中的逻辑）
 */
const getApiBaseUrl = (): string => {
  // 优先使用环境变量
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL
  }
  
  // 所有环境都使用7072端口
  return 'http://localhost:7072/api'
}

/**
 * 生成默认头像URL
 * @param name 用户名
 * @param size 头像大小
 * @returns 默认头像URL
 */
export const getDefaultAvatarUrl = (name: string = 'User', size: number = 64): string => {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=6366f1&color=fff&size=${size}`
}

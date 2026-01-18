// 缓存策略实现
export interface CacheItem<T> {
  data: T
  timestamp: number
  ttl: number // Time to live in milliseconds
}

export interface CacheOptions {
  ttl?: number // Default TTL in milliseconds
  maxSize?: number // Maximum number of items in cache
  storage?: 'memory' | 'localStorage' | 'sessionStorage'
}

export class CacheManager {
  private cache = new Map<string, CacheItem<any>>()
  private options: Required<CacheOptions>

  constructor(options: CacheOptions = {}) {
    this.options = {
      ttl: options.ttl || 5 * 60 * 1000, // 5 minutes default
      maxSize: options.maxSize || 100,
      storage: options.storage || 'memory'
    }

    // Load from persistent storage if specified
    if (this.options.storage !== 'memory') {
      this.loadFromStorage()
    }
  }

  // Set cache item
  set<T>(key: string, data: T, ttl?: number): void {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.options.ttl
    }

    // Remove oldest items if cache is full
    if (this.cache.size >= this.options.maxSize) {
      const oldestKey = this.cache.keys().next().value
      this.cache.delete(oldestKey)
    }

    this.cache.set(key, item)
    this.saveToStorage()
  }

  // Get cache item
  get<T>(key: string): T | null {
    const item = this.cache.get(key)
    
    if (!item) {
      return null
    }

    // Check if item has expired
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key)
      this.saveToStorage()
      return null
    }

    return item.data as T
  }

  // Check if key exists and is not expired
  has(key: string): boolean {
    return this.get(key) !== null
  }

  // Delete cache item
  delete(key: string): boolean {
    const result = this.cache.delete(key)
    this.saveToStorage()
    return result
  }

  // Clear all cache
  clear(): void {
    this.cache.clear()
    this.saveToStorage()
  }

  // Get cache size
  size(): number {
    return this.cache.size
  }

  // Clean expired items
  cleanup(): void {
    const now = Date.now()
    const expiredKeys: string[] = []

    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        expiredKeys.push(key)
      }
    }

    expiredKeys.forEach(key => this.cache.delete(key))
    this.saveToStorage()
  }

  // Get cache statistics
  getStats(): {
    size: number
    maxSize: number
    hitRate: number
    items: Array<{ key: string; age: number; ttl: number }>
  } {
    const now = Date.now()
    const items = Array.from(this.cache.entries()).map(([key, item]) => ({
      key,
      age: now - item.timestamp,
      ttl: item.ttl
    }))

    return {
      size: this.cache.size,
      maxSize: this.options.maxSize,
      hitRate: 0, // Would need to track hits/misses for accurate calculation
      items
    }
  }

  // Load cache from persistent storage
  private loadFromStorage(): void {
    if (typeof window === 'undefined') return

    try {
      const storage = this.getStorage()
      const cached = storage.getItem('cache-manager')
      
      if (cached) {
        const data = JSON.parse(cached)
        this.cache = new Map(data)
      }
    } catch (error) {
      console.warn('Failed to load cache from storage:', error)
    }
  }

  // Save cache to persistent storage
  private saveToStorage(): void {
    if (typeof window === 'undefined' || this.options.storage === 'memory') return

    try {
      const storage = this.getStorage()
      const data = Array.from(this.cache.entries())
      storage.setItem('cache-manager', JSON.stringify(data))
    } catch (error) {
      console.warn('Failed to save cache to storage:', error)
    }
  }

  // Get storage instance
  private getStorage(): Storage {
    if (typeof window === 'undefined') {
      throw new Error('Storage not available in non-browser environment')
    }

    switch (this.options.storage) {
      case 'localStorage':
        return window.localStorage
      case 'sessionStorage':
        return window.sessionStorage
      default:
        throw new Error(`Invalid storage type: ${this.options.storage}`)
    }
  }
}

// API Response Cache
export class ApiCache extends CacheManager {
  constructor() {
    super({
      ttl: 5 * 60 * 1000, // 5 minutes for API responses
      maxSize: 50,
      storage: 'sessionStorage'
    })
  }

  // Generate cache key for API requests
  generateKey(url: string, params?: any): string {
    const paramString = params ? JSON.stringify(params) : ''
    return `api:${url}:${paramString}`
  }

  // Cache API response
  cacheResponse<T>(url: string, params: any, data: T, ttl?: number): void {
    const key = this.generateKey(url, params)
    this.set(key, data, ttl)
  }

  // Get cached API response
  getCachedResponse<T>(url: string, params?: any): T | null {
    const key = this.generateKey(url, params)
    return this.get<T>(key)
  }
}

// User Data Cache
export class UserCache extends CacheManager {
  constructor() {
    super({
      ttl: 30 * 60 * 1000, // 30 minutes for user data
      maxSize: 20,
      storage: 'localStorage'
    })
  }

  // Cache user profile
  cacheUserProfile(userId: string, profile: any): void {
    this.set(`user:${userId}:profile`, profile)
  }

  // Get cached user profile
  getCachedUserProfile(userId: string): any | null {
    return this.get(`user:${userId}:profile`)
  }

  // Cache user preferences
  cacheUserPreferences(userId: string, preferences: any): void {
    this.set(`user:${userId}:preferences`, preferences)
  }

  // Get cached user preferences
  getCachedUserPreferences(userId: string): any | null {
    return this.get(`user:${userId}:preferences`)
  }
}

// Global cache instances
export const apiCache = new ApiCache()
export const userCache = new UserCache()

// Cache decorator for API methods
export function cached(ttl?: number) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value

    descriptor.value = async function (...args: any[]) {
      const cacheKey = `${target.constructor.name}:${propertyName}:${JSON.stringify(args)}`
      
      // Try to get from cache first
      const cached = apiCache.get(cacheKey)
      if (cached) {
        return cached
      }

      // Call original method
      const result = await method.apply(this, args)
      
      // Cache the result
      apiCache.set(cacheKey, result, ttl)
      
      return result
    }

    return descriptor
  }
}

// Cache invalidation utilities
export class CacheInvalidator {
  // Invalidate cache by pattern
  static invalidateByPattern(pattern: RegExp): void {
    const keys = Array.from(apiCache['cache'].keys())
    keys.forEach(key => {
      if (pattern.test(key)) {
        apiCache.delete(key)
      }
    })
  }

  // Invalidate user-related cache
  static invalidateUserCache(userId: string): void {
    userCache.delete(`user:${userId}:profile`)
    userCache.delete(`user:${userId}:preferences`)
    
    // Also invalidate API cache for user-related endpoints
    this.invalidateByPattern(new RegExp(`api:.*user.*${userId}`))
  }

  // Invalidate cache by tags
  static invalidateByTags(tags: string[]): void {
    tags.forEach(tag => {
      this.invalidateByPattern(new RegExp(`.*${tag}.*`))
    })
  }
}

// Automatic cleanup
if (typeof window !== 'undefined') {
  // Clean up expired cache items every 10 minutes
  setInterval(() => {
    apiCache.cleanup()
    userCache.cleanup()
  }, 10 * 60 * 1000)
}
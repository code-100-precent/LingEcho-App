// AI功能相关类型定义

export interface AIRecommendation {
  id: string
  type: 'content' | 'user' | 'product' | 'action'
  title: string
  description: string
  confidence: number // 0-1
  reason: string
  metadata?: Record<string, any>
  createdAt: string
}

export interface AISearchResult {
  id: string
  title: string
  content: string
  type: 'page' | 'component' | 'document' | 'user'
  relevance: number // 0-1
  url?: string
  metadata?: Record<string, any>
}

export interface AISearchQuery {
  query: string
  filters?: {
    type?: string[]
    dateRange?: {
      start: string
      end: string
    }
    category?: string[]
  }
  limit?: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: string
  isStreaming?: boolean // 标识消息是否正在流式传输
  metadata?: {
    type?: 'text' | 'image' | 'file' | 'code'
    attachments?: string[]
    suggestions?: string[]
  }
}

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: string
  updatedAt: string
  context?: {
    userId?: string
    currentPage?: string
    userPreferences?: Record<string, any>
  }
}

export interface AIAssistant {
  id: string
  name: string
  description: string
  avatar?: string
  capabilities: string[]
  personality: {
    tone: 'professional' | 'friendly' | 'casual' | 'technical'
    expertise: string[]
  }
  isActive: boolean
}

export interface AIAnalysis {
  id: string
  type: 'sentiment' | 'intent' | 'classification' | 'extraction'
  input: string
  result: any
  confidence: number
  timestamp: string
}

export interface UserBehavior {
  userId: string
  action: string
  target: string
  timestamp: string
  metadata?: Record<string, any>
}

export interface AIInsight {
  id: string
  type: 'trend' | 'anomaly' | 'pattern' | 'prediction'
  title: string
  description: string
  confidence: number
  impact: 'low' | 'medium' | 'high'
  actionable: boolean
  suggestions?: string[]
  createdAt: string
}

export interface AIConfig {
  apiKey?: string
  baseUrl?: string
  model: string
  temperature: number
  maxTokens: number
  enableRecommendations: boolean
  enableSmartSearch: boolean
  enableChatbot: boolean
  enableAnalytics: boolean
  personalizationLevel: 'basic' | 'standard' | 'advanced'
}

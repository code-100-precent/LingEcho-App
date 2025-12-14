import { useCallback, useEffect, useState } from 'react'
import { useAIStore } from '../stores/aiStore'
import {
  AISearchQuery, 
  ChatMessage,
  AIAssistant,
  UserBehavior
} from '../types/ai'

// 智能推荐 Hook
export const useRecommendations = (userId?: string, context?: any) => {
  const { 
    recommendations, 
    recommendationsLoading, 
    loadRecommendations 
  } = useAIStore()

  const refreshRecommendations = useCallback(async () => {
    if (userId) {
      await loadRecommendations(userId, context)
    }
  }, [userId, context, loadRecommendations])

  useEffect(() => {
    refreshRecommendations()
  }, [refreshRecommendations])

  return {
    recommendations,
    loading: recommendationsLoading,
    refresh: refreshRecommendations
  }
}

// 智能搜索 Hook
export const useSmartSearch = () => {
  const { 
    searchResults, 
    searchLoading, 
    searchHistory,
    performSearch 
  } = useAIStore()

  const search = useCallback(async (query: string, filters?: AISearchQuery['filters']) => {
    const searchQuery: AISearchQuery = {
      query,
      filters,
      limit: 10
    }
    await performSearch(searchQuery)
  }, [performSearch])

  const clearResults = useCallback(() => {
    useAIStore.setState({ searchResults: [] })
  }, [])

  return {
    results: searchResults,
    loading: searchLoading,
    history: searchHistory,
    search,
    clearResults
  }
}

// 聊天机器人 Hook
export const useChatbot = () => {
  const { 
    chatSessions, 
    currentSessionId,
    chatLoading,
    createChatSession,
    sendMessage,
    deleteChatSession
  } = useAIStore()

  const [currentSession, setCurrentSession] = useState<ChatMessage[]>([])

  // 同步当前会话数据
  useEffect(() => {
    if (currentSessionId) {
      const session = chatSessions.find(s => s.id === currentSessionId)
      if (session) {
        setCurrentSession(session.messages)
      }
    } else {
      setCurrentSession([])
    }
  }, [currentSessionId, chatSessions])

  // 确保新消息能自动显示
  useEffect(() => {
    if (currentSessionId && chatSessions.length > 0) {
      const session = chatSessions.find(s => s.id === currentSessionId)
      if (session && session.messages.length > 0) {
        setCurrentSession(session.messages)
      }
    }
  }, [chatSessions, currentSessionId])

  // 创建新会话
  const startNewChat = useCallback((title?: string, context?: any) => {
    const sessionId = createChatSession(title, context)
    setCurrentSession([])
    return sessionId
  }, [createChatSession])

  // 发送消息
  const sendChatMessage = useCallback(async (message: string, context?: any) => {
    let sessionId = currentSessionId
    if (!sessionId) {
      sessionId = startNewChat()
      useAIStore.setState({ currentSessionId: sessionId })
    }
    
    await sendMessage(sessionId, message, context)
    
    // 更新当前会话消息
    const session = chatSessions.find(s => s.id === sessionId)
    if (session) {
      setCurrentSession(session.messages)
    }
  }, [currentSessionId, sendMessage, startNewChat, chatSessions])

  // 删除会话
  const removeSession = useCallback((sessionId: string) => {
    deleteChatSession(sessionId)
    if (sessionId === currentSessionId) {
      setCurrentSession([])
    }
  }, [deleteChatSession, currentSessionId])

  // 切换会话
  const switchSession = useCallback((sessionId: string) => {
    const session = chatSessions.find(s => s.id === sessionId)
    if (session) {
      setCurrentSession(session.messages)
      useAIStore.setState({ currentSessionId: sessionId })
    }
  }, [chatSessions])

  return {
    sessions: chatSessions,
    currentSession,
    currentSessionId,
    loading: chatLoading,
    startNewChat,
    sendMessage: sendChatMessage,
    deleteSession: removeSession,
    switchSession
  }
}

// AI助手 Hook
export const useAIAssistant = () => {
  const { 
    assistants, 
    currentAssistant,
    setCurrentAssistant 
  } = useAIStore()

  const selectAssistant = useCallback((assistant: AIAssistant) => {
    setCurrentAssistant(assistant)
  }, [setCurrentAssistant])

  const getAssistantById = useCallback((id: string) => {
    return assistants.find(a => a.id === id)
  }, [assistants])

  return {
    assistants,
    currentAssistant,
    selectAssistant,
    getAssistantById
  }
}

// 用户行为追踪 Hook
export const useBehaviorTracking = () => {
  const { recordBehavior } = useAIStore()

  const trackAction = useCallback((action: string, target: string, metadata?: any) => {
    const behavior: UserBehavior = {
      userId: 'current-user', // 实际项目中应该从认证状态获取
      action,
      target,
      timestamp: new Date().toISOString(),
      metadata
    }
    recordBehavior(behavior)
  }, [recordBehavior])

  const trackPageView = useCallback((page: string) => {
    trackAction('page_view', page, { page })
  }, [trackAction])

  const trackComponentInteraction = useCallback((component: string, action: string) => {
    trackAction('component_interaction', component, { component, action })
  }, [trackAction])

  const trackSearch = useCallback((query: string, results: number) => {
    trackAction('search', query, { query, results })
  }, [trackAction])

  return {
    trackAction,
    trackPageView,
    trackComponentInteraction,
    trackSearch
  }
}

// AI配置 Hook
export const useAIConfig = () => {
  const { config, updateConfig } = useAIStore()

  const updateAIConfig = useCallback((newConfig: Partial<typeof config>) => {
    updateConfig(newConfig)
  }, [updateConfig])

  const toggleFeature = useCallback((feature: keyof typeof config) => {
    if (typeof config[feature] === 'boolean') {
      updateConfig({ [feature]: !config[feature] } as any)
    }
  }, [config, updateConfig])

  return {
    config,
    updateConfig: updateAIConfig,
    toggleFeature
  }
}

// AI洞察 Hook
export const useAIInsights = () => {
  const { insights, loadInsights } = useAIStore()

  const refreshInsights = useCallback(async () => {
    await loadInsights()
  }, [loadInsights])

  useEffect(() => {
    refreshInsights()
  }, [refreshInsights])

  return {
    insights,
    refresh: refreshInsights
  }
}

// 综合AI Hook
export const useAI = () => {
  const recommendations = useRecommendations()
  const search = useSmartSearch()
  const chatbot = useChatbot()
  const assistant = useAIAssistant()
  const behavior = useBehaviorTracking()
  const config = useAIConfig()
  const insights = useAIInsights()

  return {
    recommendations,
    search,
    chatbot,
    assistant,
    behavior,
    config,
    insights
  }
}

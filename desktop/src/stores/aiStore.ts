import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { 
  AIRecommendation, 
  AISearchResult, 
  AISearchQuery, 
  ChatSession,
  AIAssistant,
  AIInsight,
  AIConfig,
  UserBehavior
} from '../types/ai'
import { aiService } from '../services/aiService'

interface AIState {
  // 推荐系统
  recommendations: AIRecommendation[]
  recommendationsLoading: boolean
  
  // 智能搜索
  searchResults: AISearchResult[]
  searchLoading: boolean
  searchHistory: string[]
  
  // 聊天机器人
  chatSessions: ChatSession[]
  currentSessionId: string | null
  chatLoading: boolean
  
  // AI助手
  assistants: AIAssistant[]
  currentAssistant: AIAssistant | null
  
  // 配置
  config: AIConfig
  
  // 洞察
  insights: AIInsight[]
  
  // Actions
  loadRecommendations: (userId: string, context?: any) => Promise<void>
  performSearch: (query: AISearchQuery) => Promise<void>
  createChatSession: (title?: string, context?: any) => string
  sendMessage: (sessionId: string, message: string, context?: any) => Promise<void>
  deleteChatSession: (sessionId: string) => void
  recordBehavior: (behavior: UserBehavior) => void
  updateConfig: (config: Partial<AIConfig>) => void
  loadInsights: () => Promise<void>
  setCurrentAssistant: (assistant: AIAssistant) => void
}

export const useAIStore = create<AIState>()(
  persist(
    (set, get) => ({
      // 初始状态
      recommendations: [],
      recommendationsLoading: false,
      searchResults: [],
      searchLoading: false,
      searchHistory: [],
      chatSessions: [],
      currentSessionId: null,
      chatLoading: false,
      assistants: [
        {
          id: 'default',
          name: '智能助手',
          description: '您的专属AI助手，随时为您提供帮助',
          capabilities: ['问答', '推荐', '搜索', '分析'],
          personality: {
            tone: 'friendly',
            expertise: ['技术', '产品', '用户支持']
          },
          isActive: true
        }
      ],
      currentAssistant: null,
      config: {
        model: 'qwen-turbo',
        temperature: 0.7,
        maxTokens: 1000,
        enableRecommendations: true,
        enableSmartSearch: true,
        enableChatbot: true,
        enableAnalytics: true,
        personalizationLevel: 'standard',
        apiKey: 'sk-2fd01e230c274cf79fa50fb03ffde1da',
        baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1'
      },
      insights: [],

      // 加载推荐
      loadRecommendations: async (userId: string, context?: any) => {
        set({ recommendationsLoading: true })
        try {
          const recommendations = await aiService.getRecommendations(userId, context)
          set({ recommendations, recommendationsLoading: false })
        } catch (error) {
          console.error('Failed to load recommendations:', error)
          set({ recommendationsLoading: false })
        }
      },

      // 执行搜索
      performSearch: async (query: AISearchQuery) => {
        set({ searchLoading: true })
        try {
          const results = await aiService.smartSearch(query)
          set({ 
            searchResults: results,
            searchLoading: false,
            searchHistory: [...get().searchHistory, query.query].slice(-10) // 保持最近10条
          })
        } catch (error) {
          console.error('Failed to perform search:', error)
          set({ searchLoading: false })
        }
      },

      // 创建聊天会话
      createChatSession: (title?: string, context?: any) => {
        const session = aiService.createChatSession(title, context)
        set(state => ({
          chatSessions: [...state.chatSessions, session],
          currentSessionId: session.id
        }))
        return session.id
      },

      // 发送消息
      sendMessage: async (sessionId: string, message: string, context?: any) => {
        set({ chatLoading: true })
        try {
          // 设置会话更新回调
          aiService.setOnSessionUpdate((_session) => {
            const updatedSessions = aiService.getAllChatSessions()
            // 使用setTimeout来避免同步更新问题
            setTimeout(() => {
              set({ 
                chatSessions: updatedSessions,
                chatLoading: false
              })
            }, 0)
          })
          
          await aiService.sendMessage(sessionId, message, context)
          const updatedSessions = aiService.getAllChatSessions()
          set({ 
            chatSessions: updatedSessions,
            chatLoading: false
          })
        } catch (error) {
          console.error('Failed to send message:', error)
          set({ chatLoading: false })
        }
      },

      // 删除聊天会话
      deleteChatSession: (sessionId: string) => {
        const { chatSessions } = get()
        const updatedSessions = chatSessions.filter(session => session.id !== sessionId)
        set({ 
          chatSessions: updatedSessions,
          currentSessionId: sessionId === get().currentSessionId ? null : get().currentSessionId
        })
      },

      // 记录用户行为
      recordBehavior: (behavior: UserBehavior) => {
        aiService.recordUserBehavior(behavior)
      },

      // 更新配置
      updateConfig: (newConfig: Partial<AIConfig>) => {
        const updatedConfig = { ...get().config, ...newConfig }
        set({ config: updatedConfig })
        aiService.updateConfig(newConfig)
      },

      // 加载洞察
      loadInsights: async () => {
        try {
          // 模拟加载洞察数据
          const mockInsights: AIInsight[] = [
            {
              id: '1',
              type: 'trend',
              title: '用户活跃度上升',
              description: '过去一周用户活跃度比上周提升了15%',
              confidence: 0.85,
              impact: 'medium',
              actionable: true,
              suggestions: ['增加服务器资源', '优化热门功能'],
              createdAt: new Date().toISOString()
            },
            {
              id: '2',
              type: 'pattern',
              title: '用户行为模式',
              description: '发现用户通常在上午9-11点使用搜索功能',
              confidence: 0.92,
              impact: 'low',
              actionable: true,
              suggestions: ['在高峰时段优化搜索性能'],
              createdAt: new Date().toISOString()
            }
          ]
          set({ insights: mockInsights })
        } catch (error) {
          console.error('Failed to load insights:', error)
        }
      },

      // 设置当前助手
      setCurrentAssistant: (assistant: AIAssistant) => {
        set({ currentAssistant: assistant })
      }
    }),
    {
      name: 'ai-storage',
      partialize: (state) => ({
        searchHistory: state.searchHistory,
        chatSessions: state.chatSessions,
        currentSessionId: state.currentSessionId,
        assistants: state.assistants,
        currentAssistant: state.currentAssistant,
        config: state.config
      })
    }
  )
)

// 导出类型
export type { AIState }

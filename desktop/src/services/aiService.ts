import { 
  AIRecommendation, 
  AISearchResult, 
  AISearchQuery, 
  ChatMessage, 
  ChatSession,
  UserBehavior,
  AIConfig
} from '../types/ai'
import { functionToolsService } from './functionToolsService'
import { knowledgeService } from './knowledgeService'

// AI服务配置
const DEFAULT_CONFIG: AIConfig = {
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
}

class AIService {
  private config: AIConfig
  private userBehaviors: UserBehavior[] = []
  private chatSessions: Map<string, ChatSession> = new Map()

  constructor(config: Partial<AIConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  // 智能推荐系统
  async getRecommendations(userId: string, context?: any): Promise<AIRecommendation[]> {
    if (!this.config.enableRecommendations) return []

    try {
      // 分析用户行为模式
      const userBehaviors = this.getUserBehaviors(userId)
      const patterns = this.analyzeUserPatterns(userBehaviors)
      
      // 基于模式生成推荐
      const recommendations = await this.generateRecommendations(patterns)
      
      // 从知识库获取相关推荐
      const knowledgeRecommendations = await this.getKnowledgeBasedRecommendations(userId, context)
      
      // 合并推荐结果
      const allRecommendations = [...recommendations, ...knowledgeRecommendations]
      
      // 去重并排序
      const uniqueRecommendations = this.deduplicateRecommendations(allRecommendations)
      
      return uniqueRecommendations.slice(0, 10) // 限制返回数量
    } catch (error) {
      console.error('Failed to get recommendations:', error)
      return []
    }
  }

  // 智能搜索
  async smartSearch(query: AISearchQuery): Promise<AISearchResult[]> {
    if (!this.config.enableSmartSearch) return []

    try {
      // 理解搜索意图
      const intent = await this.analyzeSearchIntent(query.query)
      
      // 从知识库搜索
      const knowledgeResults = await knowledgeService.searchKnowledge({
        query: query.query,
        category: intent.type === 'how-to' ? 'components' : undefined,
        limit: 5
      })
      
      // 转换为AISearchResult格式
      const knowledgeSearchResults: AISearchResult[] = knowledgeResults.map(result => ({
        id: result.item.id,
        title: result.item.title,
        content: result.item.content,
        type: 'document' as const,
        url: `#knowledge/${result.item.id}`,
        relevance: result.relevance / 10, // 标准化到0-1范围
        metadata: {
          category: result.item.category,
          tags: result.item.tags,
          highlights: result.highlights
        }
      }))
      
      // 执行语义搜索（原有逻辑）
      const semanticResults = await this.performSemanticSearch(query)
      
      // 合并结果
      const allResults = [...knowledgeSearchResults, ...semanticResults]
      
      // 排序和过滤结果
      const rankedResults = this.rankSearchResults(allResults, query)
      
      return rankedResults
    } catch (error) {
      console.error('Failed to perform smart search:', error)
      return []
    }
  }

  // 聊天机器人
  async sendMessage(sessionId: string, message: string, _context?: any): Promise<ChatMessage> {
    if (!this.config.enableChatbot) {
      throw new Error('Chatbot is disabled')
    }

    try {
      let session = this.getChatSession(sessionId)
      if (!session) {
        // 如果会话不存在，创建一个新的会话
        session = this.createChatSession(sessionId)
      }

      // 创建用户消息
      const userMessage: ChatMessage = {
        id: this.generateId(),
        role: 'user',
        content: message,
        timestamp: new Date().toISOString()
      }

      // 添加到会话
      session.messages.push(userMessage)
      session.updatedAt = new Date().toISOString()

      // 创建AI回复消息（初始为空，标记为流式）
      const assistantMessage: ChatMessage = {
        id: this.generateId(),
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        isStreaming: true,
        metadata: {
          type: 'text',
          suggestions: ['了解更多', '相关功能', '帮助文档']
        }
      }

      // 先添加空的AI消息到会话
      session.messages.push(assistantMessage)

      // 异步生成AI回复
      this.generateChatResponseStream(session, assistantMessage.id)

      return assistantMessage
    } catch (error) {
      console.error('Failed to send message:', error)
      throw error
    }
  }

  // 更新消息内容
  private updateMessageContent(sessionId: string, messageId: string, content: string, isStreaming: boolean): void {
    const session = this.getChatSession(sessionId)
    if (session) {
      const message = session.messages.find(msg => msg.id === messageId)
      if (message) {
        message.content = content
        message.isStreaming = isStreaming
        session.updatedAt = new Date().toISOString()
        
        // 触发状态更新（这里需要通知store更新）
        this.notifySessionUpdate(session)
      }
    }
  }

  // 通知会话更新
  private notifySessionUpdate(session: ChatSession): void {
    // 这里可以通过事件系统或其他方式通知UI更新
    // 暂时使用简单的回调机制
    if (this.onSessionUpdate) {
      this.onSessionUpdate(session)
    }
  }

  // 会话更新回调
  private onSessionUpdate?: (session: ChatSession) => void

  // 设置会话更新回调
  setOnSessionUpdate(callback: (session: ChatSession) => void): void {
    this.onSessionUpdate = callback
  }

  // 创建新的聊天会话
  createChatSession(title?: string, context?: any): ChatSession {
    const session: ChatSession = {
      id: this.generateId(),
      title: title || 'New Chat',
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      context: context
    }

    this.chatSessions.set(session.id, session)
    return session
  }

  // 获取聊天会话
  getChatSession(sessionId: string): ChatSession | null {
    return this.chatSessions.get(sessionId) || null
  }

  // 获取所有聊天会话
  getAllChatSessions(): ChatSession[] {
    return Array.from(this.chatSessions.values())
  }

  // 记录用户行为
  recordUserBehavior(behavior: UserBehavior): void {
    this.userBehaviors.push(behavior)
    
    // 保持最近1000条记录
    if (this.userBehaviors.length > 1000) {
      this.userBehaviors = this.userBehaviors.slice(-1000)
    }
  }

  // 获取用户行为
  getUserBehaviors(userId: string): UserBehavior[] {
    return this.userBehaviors.filter(b => b.userId === userId)
  }

  // 分析用户模式
  private analyzeUserPatterns(behaviors: UserBehavior[]): any {
    const patterns = {
      frequentActions: new Map<string, number>(),
      timePatterns: new Map<string, number>(),
      contentPreferences: new Map<string, number>(),
      navigationPaths: [] as string[][]
    }

    behaviors.forEach(behavior => {
      // 统计频繁操作
      const count = patterns.frequentActions.get(behavior.action) || 0
      patterns.frequentActions.set(behavior.action, count + 1)

      // 分析时间模式
      const hour = new Date(behavior.timestamp).getHours()
      const timeKey = `${hour}:00`
      const timeCount = patterns.timePatterns.get(timeKey) || 0
      patterns.timePatterns.set(timeKey, timeCount + 1)

      // 分析内容偏好
      if (behavior.metadata?.category) {
        const category = behavior.metadata.category
        const catCount = patterns.contentPreferences.get(category) || 0
        patterns.contentPreferences.set(category, catCount + 1)
      }
    })

    return patterns
  }

  // 生成推荐
  private async generateRecommendations(patterns: any): Promise<AIRecommendation[]> {
    const recommendations: AIRecommendation[] = []

    // 基于频繁操作推荐
    const topActions = Array.from(patterns.frequentActions.entries())
      .sort((a: any, b: any) => (b[1] as number) - (a[1] as number))
      .slice(0, 3) as [string, number][]

    topActions.forEach(([action, count]) => {
      recommendations.push({
        id: this.generateId(),
        type: 'action',
        title: `快速${action}`,
        description: `您经常使用${action}功能，点击快速访问`,
        confidence: Math.min(count / 10, 1),
        reason: `基于您的使用习惯，您经常使用${action}功能`,
        metadata: { action, count },
        createdAt: new Date().toISOString()
      })
    })

    // 基于内容偏好推荐
    const topCategories = Array.from(patterns.contentPreferences.entries())
      .sort((a: any, b: any) => (b[1] as number) - (a[1] as number))
      .slice(0, 2) as [string, number][]

    topCategories.forEach(([category, count]) => {
      recommendations.push({
        id: this.generateId(),
        type: 'content',
        title: `推荐${category}相关内容`,
        description: `基于您的兴趣，为您推荐${category}相关内容`,
        confidence: Math.min(count / 5, 1),
        reason: `您对${category}内容表现出较高兴趣`,
        metadata: { category, count },
        createdAt: new Date().toISOString()
      })
    })

    return recommendations
  }

  // 分析搜索意图
  private async analyzeSearchIntent(query: string): Promise<any> {
    try {
      // 使用AI分析搜索意图
      const messages = [
        {
          role: 'system',
          content: '你是一个搜索意图分析专家。请分析用户的搜索查询，返回JSON格式的结果，包含type（搜索类型：how-to, what, why, general）、entities（关键词列表）、sentiment（情感：positive, negative, neutral）。'
        },
        {
          role: 'user',
          content: `请分析这个搜索查询的意图：${query}`
        }
      ]

      const aiResponse = await this.callAlibabaAI(messages)
      
      try {
        // 尝试解析AI返回的JSON
        const intent = JSON.parse(aiResponse)
        return intent
      } catch {
        // 如果解析失败，使用简单的规则分析
        return this.fallbackIntentAnalysis(query)
      }
    } catch (error) {
      console.error('AI意图分析失败，使用降级方案:', error)
      return this.fallbackIntentAnalysis(query)
    }
  }

  // 降级意图分析
  private fallbackIntentAnalysis(query: string): any {
    const intent: any = {
      type: 'general',
      entities: [] as string[],
      sentiment: 'neutral'
    }

    // 检测问题类型
    if (query.includes('如何') || query.includes('怎么')) {
      intent.type = 'how-to'
    } else if (query.includes('什么') || query.includes('哪个')) {
      intent.type = 'what'
    } else if (query.includes('为什么') || query.includes('为何')) {
      intent.type = 'why'
    }

    // 检测实体
    const entities = query.match(/[\u4e00-\u9fa5]+/g) || []
    intent.entities = entities as string[]

    return intent
  }

  // 执行语义搜索
  private async performSemanticSearch(_query: AISearchQuery): Promise<AISearchResult[]> {
    // 模拟搜索结果（实际项目中会调用搜索引擎API）
    const mockResults: AISearchResult[] = [
      {
        id: '1',
        title: '组件库文档',
        content: '完整的组件使用指南和示例',
        type: 'document',
        relevance: 0.9,
        url: '/component-library'
      },
      {
        id: '2',
        title: '动画效果展示',
        content: '各种动画效果的演示和实现',
        type: 'page',
        relevance: 0.8,
        url: '/animation-showcase'
      },
      {
        id: '3',
        title: '用户资料管理',
        content: '用户信息编辑和设置',
        type: 'page',
        relevance: 0.7,
        url: '/profile'
      }
    ]

    // 根据查询过滤结果
    return mockResults.filter(result => 
      result.title.toLowerCase().includes(_query.query.toLowerCase()) ||
      result.content.toLowerCase().includes(_query.query.toLowerCase())
    )
  }

  // 排序搜索结果
  private rankSearchResults(results: AISearchResult[], _query: AISearchQuery): AISearchResult[] {
    return results.sort((a, b) => b.relevance - a.relevance)
  }

  // 调用阿里百炼API
  private async callAlibabaAI(messages: any[], tools?: any[]): Promise<any> {
    if (!this.config.apiKey || !this.config.baseUrl) {
      throw new Error('AI API配置不完整')
    }

    try {
      const requestBody: any = {
        model: this.config.model,
        messages: messages,
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
        stream: false
      }

      // 如果有工具，添加到请求中
      if (tools && tools.length > 0) {
        requestBody.tools = tools
        requestBody.tool_choice = 'auto'
      }

      const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`
        },
        body: JSON.stringify(requestBody)
      })

      if (!response.ok) {
        throw new Error(`API调用失败: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      return data
    } catch (error) {
      console.error('AI API调用错误:', error)
      throw error
    }
  }

  // 生成聊天回复
  private async generateChatResponseStream(session: ChatSession, messageId: string): Promise<void> {
    try {
      // 构建消息历史
      const messages = session.messages.map(msg => ({
        role: msg.role,
        content: msg.content
      }))

      // 添加系统提示
      const systemPrompt = {
        role: 'system',
        content: `你是一个智能助手，专门帮助用户使用Hibiscus React应用。你有以下能力：

1. 知识库搜索：可以搜索系统知识库获取相关信息
2. 组件信息：可以查询UI组件的使用方法
3. 系统信息：可以获取系统状态和功能信息
4. 页面导航：可以帮助用户导航到不同页面

请用中文回答，保持友好和专业的语调。当用户询问关于系统功能、组件使用、技术问题等时，优先使用可用的工具来获取准确信息。`
      }

      const allMessages = [systemPrompt, ...messages]

      // 获取可用的Function Tools
      const tools = functionToolsService.getToolsForAI()

      // 调用AI API
      const aiResponse = await this.callAlibabaAI(allMessages, tools)
      
      // 检查是否有工具调用
      const choice = aiResponse.choices?.[0]
      if (choice?.message?.tool_calls) {
        // 处理工具调用
        const toolResults = await this.handleToolCalls(choice.message.tool_calls, allMessages)
        
        // 如果有工具调用结果，再次调用AI生成最终回复
        if (toolResults.length > 0) {
          const toolMessages = [
            ...allMessages,
            choice.message,
            ...toolResults
          ]
          
          const finalResponse = await this.callAlibabaAI(toolMessages)
          const finalContent = finalResponse.choices?.[0]?.message?.content || '抱歉，我无法生成回复。'
          
          // 更新消息内容并标记为非流式
          this.updateMessageContent(session.id, messageId, finalContent, false)
          return
        }
      }
      
      const content = choice?.message?.content || '抱歉，我无法生成回复。'
      
      // 更新消息内容并标记为非流式
      this.updateMessageContent(session.id, messageId, content, false)
    } catch (error) {
      console.error('生成AI回复失败:', error)
      
      // 降级到模拟回复
      const fallbackResponses = [
        '抱歉，AI服务暂时不可用，请稍后再试。',
        '我遇到了一些技术问题，但我会尽力帮助您。',
        'AI服务正在维护中，请稍后重试。'
      ]
      
      const fallbackContent = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)]
      this.updateMessageContent(session.id, messageId, fallbackContent, false)
    }
  }


  // 处理工具调用
  private async handleToolCalls(toolCalls: any[], _messages: any[]): Promise<any[]> {
    const toolResults: any[] = []
    
    for (const toolCall of toolCalls) {
      try {
        const functionCall = {
          name: toolCall.function.name,
          arguments: JSON.parse(toolCall.function.arguments),
          id: toolCall.id,
          timestamp: new Date().toISOString()
        }
        
        const result = await functionToolsService.executeFunctionCall(functionCall)
        
        toolResults.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        })
      } catch (error) {
        console.error('工具调用失败:', error)
        toolResults.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify({
            success: false,
            error: '工具调用失败'
          })
        })
      }
    }
    
    return toolResults
  }

  // 基于知识库的推荐
  private async getKnowledgeBasedRecommendations(userId: string, _context?: any): Promise<AIRecommendation[]> {
    try {
      // 获取用户行为模式
      const userBehaviors = this.getUserBehaviors(userId)
      const patterns = this.analyzeUserPatterns(userBehaviors)
      
      const recommendations: AIRecommendation[] = []
      
      // 基于用户访问的页面推荐相关知识
      if (patterns.frequentActions.has('访问组件库')) {
        const componentKnowledge = await knowledgeService.searchKnowledge({
          query: '组件使用',
          category: 'components',
          limit: 3
        })
        
        componentKnowledge.forEach(result => {
          recommendations.push({
            id: `knowledge-${result.item.id}`,
            type: 'content',
            title: `学习: ${result.item.title}`,
            description: result.item.content.substring(0, 100) + '...',
            confidence: result.relevance / 10,
            reason: '基于您对组件库的访问历史推荐',
            metadata: { 
              knowledgeId: result.item.id,
              category: result.item.category,
              source: 'knowledge'
            },
            createdAt: new Date().toISOString()
          })
        })
      }
      
      // 基于用户搜索历史推荐
      if (patterns.frequentActions.has('搜索')) {
        const generalKnowledge = await knowledgeService.searchKnowledge({
          query: 'React开发',
          limit: 2
        })
        
        generalKnowledge.forEach(result => {
          recommendations.push({
            id: `knowledge-general-${result.item.id}`,
            type: 'content',
            title: `推荐阅读: ${result.item.title}`,
            description: result.item.content.substring(0, 100) + '...',
            confidence: (result.relevance * 0.8) / 10,
            reason: '基于您的搜索历史推荐',
            metadata: { 
              knowledgeId: result.item.id,
              category: result.item.category,
              source: 'knowledge'
            },
            createdAt: new Date().toISOString()
          })
        })
      }
      
      return recommendations
    } catch (error) {
      console.error('获取知识库推荐失败:', error)
      return []
    }
  }

  // 去重推荐结果
  private deduplicateRecommendations(recommendations: AIRecommendation[]): AIRecommendation[] {
    const seen = new Set<string>()
    return recommendations
      .filter(rec => {
        const key = `${rec.type}-${rec.title}`
        if (seen.has(key)) {
          return false
        }
        seen.add(key)
        return true
      })
      .sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
  }

  // 生成唯一ID
  private generateId(): string {
    return Math.random().toString(36).substr(2, 9)
  }

  // 更新配置
  updateConfig(newConfig: Partial<AIConfig>): void {
    this.config = { ...this.config, ...newConfig }
  }

  // 获取配置
  getConfig(): AIConfig {
    return { ...this.config }
  }
}

// 创建单例实例
export const aiService = new AIService()

// 导出类型和实例
export default AIService

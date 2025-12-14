/**
 * Mock 数据服务
 * 用于模拟API响应，不依赖axios
 */

export interface User {
  id: number;
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
}

export interface Assistant {
  id: number;
  userId: number;
  groupId?: number | null;
  name: string;
  description: string;
  icon: string;
  systemPrompt: string;
  personaTag: string;
  temperature: number;
  maxTokens: number;
  language?: string;
  speaker?: string;
  voiceCloneId?: number | null;
  knowledgeBaseId?: string | null;
  ttsProvider?: string;
  createdAt: string;
  updatedAt: string;
}

// Mock 用户数据
const mockUsers: User[] = [
  {
    id: 1,
    email: 'demo@lingecho.com',
    displayName: 'Demo User',
    firstName: 'Demo',
    lastName: 'User',
  },
];

// Mock 助手数据
const mockAssistants: Assistant[] = [
  {
    id: 1,
    userId: 1,
    name: '智能客服助手',
    description: '专业的客户服务AI助手，能够处理常见问题和咨询',
    icon: '🤖',
    systemPrompt: '你是一个专业的客服助手',
    personaTag: 'professional',
    temperature: 0.7,
    maxTokens: 2000,
    language: 'zh-CN',
    speaker: 'zh-CN-XiaoxiaoNeural',
    ttsProvider: 'azure',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 2,
    userId: 1,
    name: '学习助手',
    description: '帮助你学习和记忆的AI助手',
    icon: '📚',
    systemPrompt: '你是一个耐心的学习助手',
    personaTag: 'friendly',
    temperature: 0.8,
    maxTokens: 2000,
    language: 'zh-CN',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// 模拟网络延迟
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const mockAuthService = {
  async login(email: string, password: string): Promise<{ code: number; message: string; data?: { token: string; user: User } }> {
    await delay(500);
    
    // 去除空格并转为小写进行比较
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();
    
    console.log('Mock登录验证:', { 
      inputEmail: normalizedEmail, 
      inputPassword: normalizedPassword,
      expectedEmail: 'demo@lingecho.com',
      expectedPassword: 'demo123'
    });
    
    // 允许demo账号或任意账号登录（Mock模式）
    if (normalizedEmail === 'demo@lingecho.com' && normalizedPassword === 'demo123') {
      console.log('使用demo账号登录');
      return {
        code: 0,
        message: '登录成功',
        data: {
          token: 'mock_token_' + Date.now(),
          user: mockUsers[0],
        },
      };
    }
    
    // Mock模式下，也允许任意邮箱密码登录（方便测试）
    if (normalizedEmail && normalizedPassword) {
      console.log('使用任意账号登录（Mock模式）');
      // 查找或创建用户
      let user = mockUsers.find(u => u.email.toLowerCase() === normalizedEmail);
      if (!user) {
        user = {
          id: mockUsers.length + 1,
          email: normalizedEmail,
          displayName: normalizedEmail.split('@')[0],
        };
        mockUsers.push(user);
      }
      
      return {
        code: 0,
        message: '登录成功（Mock模式）',
        data: {
          token: 'mock_token_' + Date.now(),
          user: user,
        },
      };
    }
    
    return {
      code: 1,
      message: '邮箱或密码不能为空',
    };
  },

  async register(email: string, password: string, displayName?: string): Promise<{ code: number; message: string; data?: { token: string; user: User } }> {
    await delay(500);
    
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();
    
    if (!normalizedEmail || !normalizedPassword) {
      return {
        code: 1,
        message: '邮箱和密码不能为空',
      };
    }
    
    // 检查是否已存在
    const existingUser = mockUsers.find(u => u.email.toLowerCase() === normalizedEmail);
    if (existingUser) {
      return {
        code: 1,
        message: '该邮箱已被注册',
      };
    }
    
    const newUser: User = {
      id: mockUsers.length + 1,
      email: normalizedEmail,
      displayName: (displayName || normalizedEmail.split('@')[0]).trim(),
    };
    
    mockUsers.push(newUser);
    console.log('注册成功:', newUser);
    
    return {
      code: 0,
      message: '注册成功',
      data: {
        token: 'mock_token_' + Date.now(),
        user: newUser,
      },
    };
  },

  async getCurrentUser(): Promise<User | null> {
    await delay(200);
    return mockUsers[0] || null;
  },
};

export const mockAssistantService = {
  async getAssistants(): Promise<Assistant[]> {
    await delay(300);
    return [...mockAssistants];
  },

  async getAssistant(id: number): Promise<Assistant | null> {
    await delay(200);
    return mockAssistants.find((a) => a.id === id) || null;
  },

  async createAssistant(form: { name: string; description?: string; icon?: string }): Promise<Assistant | null> {
    await delay(400);
    
    const newAssistant: Assistant = {
      id: mockAssistants.length + 1,
      userId: 1,
      name: form.name,
      description: form.description || '',
      icon: form.icon || '🤖',
      systemPrompt: '',
      personaTag: 'default',
      temperature: 0.7,
      maxTokens: 2000,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    mockAssistants.push(newAssistant);
    return newAssistant;
  },

  async updateAssistant(id: number, form: Partial<Assistant>): Promise<Assistant | null> {
    await delay(400);
    const index = mockAssistants.findIndex((a) => a.id === id);
    if (index === -1) return null;
    
    mockAssistants[index] = { ...mockAssistants[index], ...form, updatedAt: new Date().toISOString() };
    return mockAssistants[index];
  },

  async deleteAssistant(id: number): Promise<boolean> {
    await delay(300);
    const index = mockAssistants.findIndex((a) => a.id === id);
    if (index === -1) return false;
    
    mockAssistants.splice(index, 1);
    return true;
  },
};


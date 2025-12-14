/**
 * 认证服务 - 使用真实API
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  loginUser, 
  registerUser, 
  registerUserByEmail,
  sendEmailCode,
  loginWithEmailCode,
  getUserInfo, 
  logoutUser, 
  User, 
  LoginForm as APILoginForm, 
  RegisterUserForm,
  EmailRegisterForm,
  SendEmailCodeRequest,
  EmailCodeLoginForm,
  LoginResponseData
} from './api/auth';

// 导出 User 类型供其他模块使用
export type { User };

export interface LoginForm {
  email: string;
  password: string;
  twoFactorCode?: string;
  timezone?: string;
  remember?: boolean;
}

export interface EmailCodeLoginFormLocal {
  email: string;
  code: string;
  timezone?: string;
  remember?: boolean;
}

export interface RegisterForm {
  email: string;
  password: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  locale?: string;
  timezone?: string;
  userName?: string;
  verificationCode?: string;
}

export interface SendCodeForm {
  email: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  requiresTwoFactor?: boolean;
}

export const authService = {
  // 登录（密码登录）
  async login(form: LoginForm) {
    try {
      const apiForm: APILoginForm = {
        email: form.email,
        password: form.password,
        twoFactorCode: form.twoFactorCode,
        timezone: form.timezone || 'Asia/Shanghai',
        remember: form.remember,
        authToken: true,
      };
      const response = await loginUser(apiForm);
      if (response.code === 200 && response.data) {
        // 检查是否需要二级验证
        if (response.data.requiresTwoFactor && !form.twoFactorCode) {
          return {
            code: 200,
            message: '需要二级验证',
            data: {
              requiresTwoFactor: true,
            },
          };
        }
        
        await AsyncStorage.setItem('auth_token', response.data.token);
        // 将用户信息转换为User格式并保存
        const user: User = {
          id: response.data.email, // 如果没有id，使用email作为标识
          email: response.data.email,
          displayName: response.data.displayName,
          firstName: response.data.firstName,
          lastName: response.data.lastName,
          timezone: response.data.timezone,
          createdAt: response.data.createdAt,
          updatedAt: response.data.updatedAt,
          lastLogin: response.data.lastLogin,
          hasFilledDetails: response.data.hasFilledDetails,
          emailNotifications: response.data.emailNotifications,
        };
        await AsyncStorage.setItem('user_info', JSON.stringify(user));
        return {
          code: 0,
          message: '登录成功',
          data: {
            token: response.data.token,
            user,
          },
        };
      } else {
        return {
          code: response.code || 1,
          message: response.msg || '登录失败',
        };
      }
    } catch (error: any) {
      console.error('Login error:', error);
      return {
        code: error.code || 1,
        message: error.msg || error.message || '登录失败',
      };
    }
  },

  // 邮箱验证码登录
  async loginWithEmailCode(form: EmailCodeLoginFormLocal) {
    try {
      const apiForm: EmailCodeLoginForm = {
        email: form.email,
        code: form.code,
        timezone: form.timezone || 'Asia/Shanghai',
        remember: form.remember,
        authToken: true,
      };
      const response = await loginWithEmailCode(apiForm);
      if (response.code === 200 && response.data) {
        await AsyncStorage.setItem('auth_token', response.data.token);
        // 将用户信息转换为User格式并保存
        const user: User = {
          id: response.data.email,
          email: response.data.email,
          displayName: response.data.displayName,
          firstName: response.data.firstName,
          lastName: response.data.lastName,
          timezone: response.data.timezone,
          createdAt: response.data.createdAt,
          updatedAt: response.data.updatedAt,
          lastLogin: response.data.lastLogin,
          hasFilledDetails: response.data.hasFilledDetails,
          emailNotifications: response.data.emailNotifications,
        };
        await AsyncStorage.setItem('user_info', JSON.stringify(user));
        return {
          code: 0,
          message: '登录成功',
          data: {
            token: response.data.token,
            user,
          },
        };
      } else {
        return {
          code: response.code || 1,
          message: response.msg || '登录失败',
        };
      }
    } catch (error: any) {
      console.error('Email code login error:', error);
      return {
        code: error.code || 1,
        message: error.msg || error.message || '登录失败',
      };
    }
  },

  // 发送邮箱验证码
  async sendEmailCode(form: SendCodeForm) {
    try {
      const apiForm: SendEmailCodeRequest = {
        email: form.email,
        clientIp: '', // 由后端自动获取
        userAgent: 'React Native',
      };
      const response = await sendEmailCode(apiForm);
      if (response.code === 200) {
        return {
          code: 0,
          message: '验证码已发送',
        };
      } else {
        return {
          code: response.code || 1,
          message: response.msg || '发送失败',
        };
      }
    } catch (error: any) {
      console.error('Send email code error:', error);
      return {
        code: error.code || 1,
        message: error.msg || error.message || '发送失败',
      };
    }
  },

  // 注册
  async register(form: RegisterForm, emailEnabled: boolean = true) {
    try {
      let response;
      
      // 根据邮件配置状态选择注册方式
      if (emailEnabled) {
        // 如果配置了邮箱，使用邮箱验证码注册
        if (!form.verificationCode) {
          return {
            code: 1,
            message: '请输入验证码',
          };
        }
        if (!form.userName) {
          return {
            code: 1,
            message: '请输入用户名',
          };
        }
        
        const apiForm: EmailRegisterForm = {
          email: form.email,
          password: form.password,
          userName: form.userName,
          displayName: form.displayName || form.userName,
          code: form.verificationCode,
          firstName: form.firstName || form.userName.split(' ')[0] || form.userName,
          lastName: form.lastName || form.userName.split(' ')[1] || '',
          locale: 'zh-CN',
          timezone: form.timezone || 'Asia/Shanghai',
          source: 'MOBILE',
        };
        response = await registerUserByEmail(apiForm);
      } else {
        // 如果没有配置邮箱，使用普通注册（不需要验证码）
        const apiForm: RegisterUserForm = {
          email: form.email,
          password: form.password,
          displayName: form.displayName,
          firstName: form.firstName || form.displayName,
          lastName: form.lastName || '',
          locale: form.locale || 'zh-CN',
          timezone: form.timezone || 'Asia/Shanghai',
          source: 'MOBILE',
        };
        response = await registerUser(apiForm);
      }
      
      // 注册成功处理
      // 后端可能返回两种格式：
      // 1. 标准格式: {code: 200, msg: "...", data: {...}}
      // 2. 直接格式: {email: "...", activation: false} (HTTP 200 但响应体直接是对象)
      const responseData = (response.data || response) as any;
      
      // 检查是否是成功响应
      if (response.code === 200 || (responseData && (responseData.email || responseData.activation !== undefined))) {
        // 处理标准格式
        if (response.code === 200 && response.data && (response.data as any).displayName) {
          return {
            code: 0,
            message: '注册成功',
            data: response.data,
          };
        } else {
          // 处理直接格式 {email, activation}
          const registerData = responseData;
          return {
            code: 0,
            message: '注册成功',
            data: {
              email: registerData.email,
              displayName: registerData.email?.split('@')[0] || '用户',
              activation: registerData.activation || false,
            },
          };
        }
      } else {
        return {
          code: response.code || 1,
          message: response.msg || (response as any).error || '注册失败',
        };
      }
    } catch (error: any) {
      console.error('Register error:', error);
      return {
        code: error.code || 1,
        message: error.msg || error.message || '注册失败',
      };
    }
  },

  // 登出
  async logout() {
    try {
      // 尝试调用 logout API，即使返回 401 也继续执行（token 可能已失效）
      await logoutUser();
    } catch (error: any) {
      // 如果返回 401，说明 token 已经失效，这是正常的，继续清除本地存储
      if (error?.response?.status === 401 || error?.code === 401) {
        console.log('Logout: token 已失效，继续清除本地存储');
      } else {
        console.error('Logout error:', error);
      }
    } finally {
      // 无论 API 调用成功与否，都清除本地存储
      try {
        await AsyncStorage.removeItem('auth_token');
        await AsyncStorage.removeItem('user_info');
      } catch (storageError) {
        console.error('Error clearing storage during logout:', storageError);
      }
    }
  },

  // 获取当前用户信息
  async getCurrentUser(): Promise<User | null> {
    try {
      // 先检查本地存储
      const userStr = await AsyncStorage.getItem('user_info');
      if (userStr) {
        const user = JSON.parse(userStr);
        // 验证token是否有效，如果无效则重新获取
        const token = await AsyncStorage.getItem('auth_token');
        if (token) {
          try {
            // 尝试从服务器获取最新用户信息
            const response = await getUserInfo();
            if (response.code === 200 && response.data) {
              const updatedUser = response.data;
              await AsyncStorage.setItem('user_info', JSON.stringify(updatedUser));
              return updatedUser;
            }
          } catch (error) {
            console.error('Error fetching user info from server:', error);
            // 如果获取失败，返回本地缓存的用户信息
            return user;
          }
        }
        return user;
      }
      
      // 如果没有本地缓存，尝试从服务器获取
      const token = await AsyncStorage.getItem('auth_token');
      if (token) {
        const response = await getUserInfo();
        if (response.code === 200 && response.data) {
          const user = response.data;
          await AsyncStorage.setItem('user_info', JSON.stringify(user));
          return user;
        }
      }
    } catch (error) {
      console.error('Error getting current user:', error);
    }
    return null;
  },

  // 检查是否已登录
  async isAuthenticated(): Promise<boolean> {
    const token = await AsyncStorage.getItem('auth_token');
    return !!token;
  },

  // 获取token
  async getToken(): Promise<string | null> {
    return await AsyncStorage.getItem('auth_token');
  },
};


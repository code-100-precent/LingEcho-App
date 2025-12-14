/**
 * 认证上下文
 */
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, User } from '../services/auth';
import { authEvents } from '../utils/authEvents';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string, twoFactorCode?: string) => Promise<{ requiresTwoFactor?: boolean }>;
  loginWithEmailCode: (email: string, code: string) => Promise<void>;
  sendEmailCode: (email: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string, userName?: string, verificationCode?: string, emailEnabled?: boolean) => Promise<any>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();

    // 监听 401 未授权事件
    const handleUnauthorized = () => {
      console.log('AuthContext: 收到 401 未授权事件，清除用户状态');
      // 只清除用户状态，不再次调用 logout（避免循环）
      // logout 时如果返回 401，拦截器已经清除了存储，这里只需要清除状态即可
      setUser(null);
    };

    authEvents.onUnauthorized(handleUnauthorized);

    // 清理监听器
    return () => {
      authEvents.offUnauthorized(handleUnauthorized);
    };
  }, []);

  const loadUser = async () => {
    try {
      // 先检查是否有保存的用户信息
      const currentUser = await authService.getCurrentUser();
      
      if (currentUser) {
        setUser(currentUser);
        console.log('已加载保存的用户:', currentUser);
      } else {
        // 如果没有用户，保持为 null，显示登录页面
        setUser(null);
        console.log('未找到已保存的用户，需要登录');
      }
    } catch (error) {
      console.error('Error loading user:', error);
      // 出错时也保持为 null，显示登录页面
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string, twoFactorCode?: string) => {
    console.log('AuthContext: 开始登录', { email, hasTwoFactor: !!twoFactorCode });
    const response = await authService.login({ email, password, twoFactorCode });
    console.log('AuthContext: 登录响应', { code: response.code, hasData: !!response.data, requiresTwoFactor: response.data?.requiresTwoFactor });
    
    if (response.code === 200 && response.data?.requiresTwoFactor) {
      // 需要二级验证
      return { requiresTwoFactor: true };
    }
    
    if (response.code === 0 && response.data) {
      setUser(response.data.user);
      console.log('AuthContext: 用户已设置', response.data.user);
      return { requiresTwoFactor: false };
    } else {
      const errorMsg = response.message || '登录失败';
      console.error('AuthContext: 登录失败', errorMsg);
      throw new Error(errorMsg);
    }
  };

  const loginWithEmailCode = async (email: string, code: string) => {
    console.log('AuthContext: 开始邮箱验证码登录', { email });
    const response = await authService.loginWithEmailCode({ email, code });
    console.log('AuthContext: 邮箱验证码登录响应', { code: response.code, hasData: !!response.data });
    
    if (response.code === 0 && response.data) {
      setUser(response.data.user);
      console.log('AuthContext: 用户已设置', response.data.user);
    } else {
      const errorMsg = response.message || '登录失败';
      console.error('AuthContext: 邮箱验证码登录失败', errorMsg);
      throw new Error(errorMsg);
    }
  };

  const sendEmailCode = async (email: string) => {
    console.log('AuthContext: 发送验证码', { email });
    const response = await authService.sendEmailCode({ email });
    console.log('AuthContext: 发送验证码响应', { code: response.code });
    
    if (response.code !== 0) {
      const errorMsg = response.message || '发送失败';
      console.error('AuthContext: 发送验证码失败', errorMsg);
      throw new Error(errorMsg);
    }
  };

  const register = async (email: string, password: string, displayName?: string, userName?: string, verificationCode?: string, emailEnabled: boolean = true) => {
    const response = await authService.register({ 
      email, 
      password, 
      displayName, 
      userName,
      verificationCode 
    }, emailEnabled);
    if (response.code === 0) {
      // 注册成功，但不自动登录（用户需要手动登录）
      console.log('AuthContext: 注册成功', response.data);
      return response.data;
    } else {
      throw new Error(response.message || '注册失败');
    }
  };

  const logout = async () => {
    console.log('AuthContext: 开始退出登录');
    try {
      await authService.logout();
    } catch (error) {
      console.error('AuthContext: logout 过程中出错，但继续清除状态:', error);
    }
    // 确保清除用户状态，这样 isAuthenticated 会变为 false，导航会自动跳转到登录页
    console.log('AuthContext: 清除用户状态，isAuthenticated 将变为 false');
    setUser(null);
    console.log('AuthContext: 用户状态已清除，user:', null);
  };

  const refreshUser = async () => {
    const currentUser = await authService.getCurrentUser();
    setUser(currentUser);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        loginWithEmailCode,
        sendEmailCode,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}


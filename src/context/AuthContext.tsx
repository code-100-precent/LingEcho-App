/**
 * 认证上下文
 */
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authService, User } from '../services/auth';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadUser();
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

  const login = async (email: string, password: string) => {
    console.log('AuthContext: 开始登录', { email });
    const response = await authService.login({ email, password });
    console.log('AuthContext: 登录响应', { code: response.code, hasData: !!response.data });
    
    if (response.code === 0 && response.data) {
      setUser(response.data.user);
      console.log('AuthContext: 用户已设置', response.data.user);
    } else {
      const errorMsg = response.message || '登录失败';
      console.error('AuthContext: 登录失败', errorMsg);
      throw new Error(errorMsg);
    }
  };

  const register = async (email: string, password: string, displayName?: string) => {
    const response = await authService.register({ email, password, displayName });
    if (response.code === 0 && response.data) {
      setUser(response.data.user);
    } else {
      throw new Error(response.message || '注册失败');
    }
  };

  const logout = async () => {
    await authService.logout();
    setUser(null);
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


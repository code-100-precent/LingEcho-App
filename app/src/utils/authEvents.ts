/**
 * 认证事件管理器
 * 用于在 axios 拦截器和 React 组件之间传递认证状态变化
 * 使用简单的观察者模式，不依赖 Node.js events 模块
 */
type UnauthorizedCallback = () => void;

class AuthEventEmitter {
  private listeners: Set<UnauthorizedCallback> = new Set();

  // 401 未授权事件
  emitUnauthorized() {
    console.log('AuthEvents: 触发未授权事件，通知', this.listeners.size, '个监听器');
    this.listeners.forEach(callback => {
      try {
        callback();
      } catch (error) {
        console.error('AuthEvents: 监听器执行错误:', error);
      }
    });
  }

  // 监听 401 未授权事件
  onUnauthorized(callback: UnauthorizedCallback) {
    this.listeners.add(callback);
    console.log('AuthEvents: 添加未授权监听器，当前监听器数量:', this.listeners.size);
  }

  // 移除监听器
  offUnauthorized(callback: UnauthorizedCallback) {
    this.listeners.delete(callback);
    console.log('AuthEvents: 移除未授权监听器，当前监听器数量:', this.listeners.size);
  }
}

export const authEvents = new AuthEventEmitter();


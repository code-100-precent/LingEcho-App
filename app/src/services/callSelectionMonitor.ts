/**
 * 来电方案选择监听服务
 * 轮询检测待处理的来电并触发弹窗
 */
import { getPendingCallSelections, PendingCallSelection } from './api/callSelection';

type CallSelectionCallback = (call: PendingCallSelection) => void;

class CallSelectionMonitor {
  private pollingInterval: NodeJS.Timeout | null = null;
  private callbacks: CallSelectionCallback[] = [];
  private isPolling = false;
  private processedCallIds = new Set<string>(); // 记录已处理的来电ID

  /**
   * 开始轮询
   */
  startPolling(intervalMs: number = 2000) {
    if (this.isPolling) {
      console.log('[CallSelectionMonitor] Already polling');
      return;
    }

    console.log('[CallSelectionMonitor] Start polling for incoming calls');
    this.isPolling = true;

    // 立即执行一次
    this.checkPendingCalls();

    // 设置定时轮询
    this.pollingInterval = setInterval(() => {
      this.checkPendingCalls();
    }, intervalMs);
  }

  /**
   * 停止轮询
   */
  stopPolling() {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isPolling = false;
    console.log('[CallSelectionMonitor] Stopped polling');
  }

  /**
   * 注册回调函数
   */
  onIncomingCall(callback: CallSelectionCallback) {
    this.callbacks.push(callback);
    return () => {
      this.callbacks = this.callbacks.filter(cb => cb !== callback);
    };
  }

  /**
   * 检查待处理的来电
   */
  private async checkPendingCalls() {
    try {
      const response = await getPendingCallSelections('pending');
      
      if (response.code === 200 && response.data) {
        const pendingCalls = response.data;

        // 遍历所有待处理的来电
        for (const call of pendingCalls) {
          // 如果这个来电还没有被处理过
          if (!this.processedCallIds.has(call.callId)) {
            console.log('[CallSelectionMonitor] New incoming call detected:', call.callId);
            
            // 标记为已处理
            this.processedCallIds.add(call.callId);
            
            // 触发所有回调
            this.callbacks.forEach(callback => {
              try {
                callback(call);
              } catch (error) {
                console.error('[CallSelectionMonitor] Callback error:', error);
              }
            });
          }
        }

        // 清理已超时或已完成的来电ID（避免内存泄漏）
        const currentCallIds = new Set(pendingCalls.map(c => c.callId));
        this.processedCallIds.forEach(callId => {
          if (!currentCallIds.has(callId)) {
            this.processedCallIds.delete(callId);
          }
        });
      }
    } catch (error) {
      console.error('[CallSelectionMonitor] Failed to check pending calls:', error);
    }
  }

  /**
   * 清除已处理的来电记录
   */
  clearProcessedCalls() {
    this.processedCallIds.clear();
  }
}

// 导出单例
export const callSelectionMonitor = new CallSelectionMonitor();

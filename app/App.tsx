/**
 * LingEcho App 主入口
 */
import React, { useEffect, useState } from 'react';
import { LogBox } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';
import IncomingCallModal from './src/components/CallSelection/IncomingCallModal';
import { callSelectionMonitor } from './src/services/callSelectionMonitor';
import { PendingCallSelection } from './src/services/api/callSelection';

// 禁用所有 LogBox 警告和错误提示
LogBox.ignoreAllLogs(true);

// 内部组件，可以访问 AuthContext
function AppContent() {
  const { user } = useAuth();
  const [incomingCall, setIncomingCall] = useState<PendingCallSelection | null>(null);
  const [showCallModal, setShowCallModal] = useState(false);
  
  useEffect(() => {
    // 只有在用户登录时才启动轮询
    if (!user) {
      console.log('=== 用户未登录，不启动来电监听 ===');
      return;
    }
    
    console.log('=== 用户已登录，启动来电监听 ===');
    
    // 注册来电监听
    const unsubscribe = callSelectionMonitor.onIncomingCall((call) => {
      console.log('=== 收到新来电 ===', call);
      setIncomingCall(call);
      setShowCallModal(true);
    });
    
    // 启动轮询（每2秒检查一次）
    callSelectionMonitor.startPolling(2000);
    
    // 清理函数
    return () => {
      unsubscribe();
      callSelectionMonitor.stopPolling();
    };
  }, [user]);
  
  const handleCloseModal = () => {
    setShowCallModal(false);
    setIncomingCall(null);
  };
  
  const handleSchemeSelected = (schemeId: number) => {
    console.log('=== 用户选择了方案 ===', schemeId);
    setShowCallModal(false);
    setIncomingCall(null);
  };
  
  return (
    <>
      <AppNavigator />
      
      {/* 来电方案选择弹窗 */}
      {incomingCall && (
        <IncomingCallModal
          visible={showCallModal}
          callId={incomingCall.callId}
          callerNumber={incomingCall.callerNumber}
          calledNumber={incomingCall.calledNumber}
          onClose={handleCloseModal}
          onSchemeSelected={handleSchemeSelected}
        />
      )}
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ExpoStatusBar style="auto" />
        <AppContent />
      </AuthProvider>
    </SafeAreaProvider>
  );
}



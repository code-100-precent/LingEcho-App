/**
 * LingEcho App 主入口
 */
import React, { useEffect } from 'react';
import { LogBox } from 'react-native';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import AppNavigator from './src/navigation/AppNavigator';

// 禁用所有 LogBox 警告和错误提示
LogBox.ignoreAllLogs(true);

export default function App() {
  console.log('=== App.tsx: 开始渲染 ===');
  
  useEffect(() => {
    console.log('=== App.tsx: useEffect 执行 ===');
  }, []);
  
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ExpoStatusBar style="auto" />
        <AppNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}


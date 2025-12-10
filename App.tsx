/**
 * LingEcho App 主入口
 */
import React from 'react';
import { StatusBar as ExpoStatusBar } from 'expo-status-bar';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <>
      <ExpoStatusBar style="auto" />
      <AppNavigator />
    </>
  );
}


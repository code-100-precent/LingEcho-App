/**
 * 应用导航 - 简化版，只显示组件演示页面
 */
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ComponentShowcase from '../screens/ComponentShowcase';

const Stack = createNativeStackNavigator();

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name="ComponentShowcase"
          component={ComponentShowcase}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}


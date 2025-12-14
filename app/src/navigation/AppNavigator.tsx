/**
 * 应用导航
 * 使用 Stack Navigator + Tab Navigator 的组合
 * 添加全局路由守卫，根据认证状态控制导航
 */
import React, { useEffect, useRef } from 'react';
import { Platform, View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer, useNavigation, CommonActions } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import AssistantScreen from '../screens/AssistantScreen';
import AssistantDetailScreen from '../screens/AssistantDetailScreen';
import AssistantControlPanelScreen from '../screens/AssistantControlPanelScreen';
import BillingScreen from '../screens/BillingScreen';
import ProfileScreen from '../screens/ProfileScreen';
import DeviceManagementScreen from '../screens/DeviceManagementScreen';
import HelpFeedbackScreen from '../screens/HelpFeedbackScreen';
import AboutScreen from '../screens/AboutScreen';
import NotificationScreen from '../screens/NotificationScreen';
import GroupManagementScreen from '../screens/GroupManagementScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// 主 Tab 导航器
function MainTabs() {
  const insets = useSafeAreaInsets();
  // 减少底部内边距，让 TabBar 往上移
  const bottomPadding = Math.max(insets.bottom * 0.5, 4);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#7c3aed',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#e5e7eb',
          backgroundColor: '#ffffff',
          paddingBottom: bottomPadding,
          paddingTop: 6,
          paddingHorizontal: 8,
          height: 50 + bottomPadding,
          elevation: 8,
          shadowColor: '#000',
          shadowOffset: {
            width: 0,
            height: -2,
          },
          shadowOpacity: 0.1,
          shadowRadius: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: 2,
          marginBottom: 0,
        },
        tabBarIconStyle: {
          marginTop: 0,
          marginBottom: 0,
        },
        tabBarItemStyle: {
          paddingVertical: 2,
        },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          tabBarLabel: '首页',
          tabBarIcon: ({ color, size }) => (
            <Feather name="home" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Assistant"
        component={AssistantScreen}
        options={{
          tabBarLabel: '助手',
          tabBarIcon: ({ color, size }) => (
            <Feather name="message-circle" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Billing"
        component={BillingScreen}
        options={{
          tabBarLabel: '账单',
          tabBarIcon: ({ color, size }) => (
            <Feather name="file-text" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Device"
        component={DeviceManagementScreen}
        options={{
          tabBarLabel: '设备',
          tabBarIcon: ({ color, size }) => (
            <Feather name="smartphone" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: '我的',
          tabBarIcon: ({ color, size }) => (
            <Feather name="user" size={size} color={color} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export type RootStackParamList = {
  Login: undefined;
  Main: undefined;
  AssistantDetail: { assistantId: number };
  AssistantControlPanel: { assistantId: number };
  HelpFeedback: undefined;
  About: undefined;
  Notification: undefined;
  GroupManagement: { groupId: number };
};

// 加载屏幕组件
function LoadingScreen() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#7c3aed" />
    </View>
  );
}

export default function AppNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const navigationRef = useRef<any>(null);
  const prevIsAuthenticatedRef = useRef<boolean | null>(null);

  // 监听认证状态变化，当从已登录变为未登录时，重置导航栈
  useEffect(() => {
    // 初始化时记录当前状态
    if (prevIsAuthenticatedRef.current === null) {
      prevIsAuthenticatedRef.current = isAuthenticated;
      return;
    }

    // 如果从已登录变为未登录，重置导航栈到登录页
    if (prevIsAuthenticatedRef.current === true && isAuthenticated === false) {
      console.log('AppNavigator: 检测到用户退出登录，重置导航栈到登录页');
      if (navigationRef.current) {
        navigationRef.current.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Login' }],
          })
        );
      }
    }

    // 更新前一个状态
    prevIsAuthenticatedRef.current = isAuthenticated;
  }, [isAuthenticated]);

  // 加载中显示加载屏幕
  if (isLoading) {
    return (
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Loading" component={LoadingScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator 
        screenOptions={{ headerShown: false }}
      >
        {isAuthenticated ? (
          // 已登录，显示主页面
          <>
            <Stack.Screen
              name="Main"
              component={MainTabs}
              options={{ gestureEnabled: false }}
            />
            <Stack.Screen
              name="Login"
              component={LoginScreen}
            />
            <Stack.Screen
              name="AssistantDetail"
              component={AssistantDetailScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="AssistantControlPanel"
              component={AssistantControlPanelScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="HelpFeedback"
              component={HelpFeedbackScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="About"
              component={AboutScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Notification"
              component={NotificationScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="GroupManagement"
              component={GroupManagementScreen}
              options={{ headerShown: false }}
            />
          </>
        ) : (
          // 未登录，显示登录页
          <>
            <Stack.Screen
              name="Login"
              component={LoginScreen}
              options={{ gestureEnabled: false }}
            />
            <Stack.Screen
              name="Main"
              component={MainTabs}
            />
            <Stack.Screen
              name="AssistantDetail"
              component={AssistantDetailScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="AssistantControlPanel"
              component={AssistantControlPanelScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="HelpFeedback"
              component={HelpFeedbackScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="About"
              component={AboutScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Notification"
              component={NotificationScreen}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="GroupManagement"
              component={GroupManagementScreen}
              options={{ headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
});


/**
 * MainLayout 组件 - React Native 版本
 * 主布局容器，整合顶部导航栏和内容区域
 * 底部标签栏由 React Navigation 的 Tab Navigator 提供
 */
import React, { ReactNode } from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import NavBar, { NavBarProps } from './NavBar';

export interface MainLayoutProps {
  children: ReactNode;
  // NavBar 相关属性
  navBarProps?: NavBarProps;
  showNavBar?: boolean;
  // 布局样式
  style?: ViewStyle;
  contentStyle?: ViewStyle;
  backgroundColor?: string;
}

const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  navBarProps,
  showNavBar = true,
  style,
  contentStyle,
  backgroundColor = '#f5f5f5',
}) => {
  return (
    <View style={[styles.container, { backgroundColor }, style]}>
      {/* 顶部导航栏 */}
      {showNavBar && <NavBar {...navBarProps} />}

      {/* 内容区域 */}
      <View style={[styles.content, contentStyle]}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
});

export default MainLayout;


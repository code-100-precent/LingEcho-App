/**
 * Layout 组件 - React Native 版本
 * 移动 App 的布局容器，提供安全区域和滚动支持
 */
import React, { ReactNode } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  ViewStyle,
} from 'react-native';

interface LayoutProps {
  children: ReactNode;
  style?: ViewStyle;
  scrollable?: boolean;
  safeArea?: boolean;
  contentContainerStyle?: ViewStyle;
}

const Layout: React.FC<LayoutProps> = ({
  children,
  style,
  scrollable = false,
  safeArea = true,
  contentContainerStyle,
}) => {
  const Container = safeArea ? SafeAreaView : View;
  const ContentWrapper = scrollable ? ScrollView : View;

  return (
    <Container style={[styles.container, style]}>
      <ContentWrapper
        style={styles.content}
        contentContainerStyle={scrollable ? [styles.scrollContent, contentContainerStyle] : undefined}
        showsVerticalScrollIndicator={scrollable}
      >
        {children}
      </ContentWrapper>
    </Container>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
});

export default Layout;

/**
 * PageContainer 组件 - React Native 版本
 */
import React, { ReactNode } from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
} from 'react-native';

interface PageContainerProps {
  children: ReactNode;
  style?: ViewStyle;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const PageContainer: React.FC<PageContainerProps> = ({
  children,
  style,
  maxWidth = 'xl',
  padding = 'md',
}) => {
  const paddingStyles = {
    none: { paddingHorizontal: 0, paddingVertical: 0 },
    sm: { paddingHorizontal: 16, paddingVertical: 24 },
    md: { paddingHorizontal: 24, paddingVertical: 32 },
    lg: { paddingHorizontal: 32, paddingVertical: 48 },
  };

  return (
    <View
      style={[
        styles.container,
        paddingStyles[padding],
        style,
      ]}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignSelf: 'center',
  },
});

export default PageContainer;

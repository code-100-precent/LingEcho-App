/**
 * IconText 组件 - React Native 版本
 */
import React, { ReactNode } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';

interface IconTextProps {
  icon: ReactNode;
  children: ReactNode;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'muted';
  direction?: 'horizontal' | 'vertical';
  spacing?: 'tight' | 'normal' | 'loose';
  style?: ViewStyle;
  iconStyle?: ViewStyle;
  textStyle?: ViewStyle;
  onPress?: () => void;
}

const IconText: React.FC<IconTextProps> = ({
  icon,
  children,
  size = 'md',
  variant = 'default',
  direction = 'horizontal',
  spacing = 'normal',
  style,
  iconStyle,
  textStyle,
  onPress,
}) => {
  const sizeStyles = {
    xs: { icon: 12, text: 12, gap: 4 },
    sm: { icon: 16, text: 14, gap: 6 },
    md: { icon: 20, text: 16, gap: 8 },
    lg: { icon: 24, text: 18, gap: 10 },
    xl: { icon: 32, text: 20, gap: 12 },
  };

  const spacingStyles = {
    tight: 4,
    normal: 8,
    loose: 12,
  };

  const variantStyles = {
    default: '#1f2937',
    primary: '#3b82f6',
    secondary: '#6b7280',
    success: '#10b981',
    warning: '#f59e0b',
    error: '#ef4444',
    muted: '#9ca3af',
  };

  const currentSize = sizeStyles[size];
  const currentSpacing = spacingStyles[spacing];
  const currentColor = variantStyles[variant];

  const content = (
    <View
      style={[
        styles.container,
        direction === 'horizontal' ? styles.horizontal : styles.vertical,
        { gap: currentSpacing },
        style,
      ]}
    >
      <View style={[styles.iconContainer, iconStyle]}>
        {icon}
      </View>
      <Text
        style={[
          styles.text,
          {
            fontSize: currentSize.text,
            color: currentColor,
          },
          textStyle,
        ]}
      >
        {children}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={0.7}
        style={style}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return content;
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  horizontal: {
    flexDirection: 'row',
  },
  vertical: {
    flexDirection: 'column',
  },
  iconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '400',
  },
});

export default IconText;

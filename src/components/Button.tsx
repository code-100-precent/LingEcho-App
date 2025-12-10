/**
 * Button 组件 - React Native 版本
 */
import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from 'react-native';
// import { cn, mergeStyles } from '../utils/cn';

export interface ButtonProps {
  variant?: 'default' | 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'success' | 'warning';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'icon';
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
  disabled?: boolean;
  onPress?: () => void;
  children?: React.ReactNode;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

const Button: React.FC<ButtonProps> = ({
  variant = 'default',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  fullWidth = false,
  disabled = false,
  onPress,
  children,
  style,
  textStyle,
}) => {
  const buttonStyle: ViewStyle[] = [
    styles.base,
    variantStyles[variant],
    sizeStyles[size],
    fullWidth && styles.fullWidth,
    (disabled || loading) && styles.disabled,
    style,
  ].filter(Boolean) as ViewStyle[];

  const textStyles: TextStyle[] = [
    styles.text,
    textVariantStyles[variant],
    textSizeStyles[size],
    textStyle,
  ].filter(Boolean) as TextStyle[];

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        {loading && (
          <ActivityIndicator
            size="small"
            color={variant === 'outline' || variant === 'ghost' ? '#007AFF' : '#ffffff'}
            style={styles.loader}
          />
        )}
        {!loading && leftIcon && <View style={styles.icon}>{leftIcon}</View>}
        {children && <Text style={textStyles}>{children}</Text>}
        {!loading && rightIcon && <View style={styles.icon}>{rightIcon}</View>}
      </View>
    </TouchableOpacity>
  );
};

const variantStyles: Record<string, ViewStyle> = {
  default: {
    backgroundColor: '#f3f4f6',
  },
  primary: {
    backgroundColor: '#007AFF',
  },
  secondary: {
    backgroundColor: '#6b7280',
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  destructive: {
    backgroundColor: '#ef4444',
  },
  success: {
    backgroundColor: '#10b981',
  },
  warning: {
    backgroundColor: '#f59e0b',
  },
};

const sizeStyles: Record<string, ViewStyle> = {
  xs: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    minHeight: 28,
  },
  sm: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 32,
  },
  md: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    minHeight: 36,
  },
  lg: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    minHeight: 44,
  },
  xl: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    minHeight: 52,
  },
  icon: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    minWidth: 36,
    minHeight: 36,
  },
};

const textVariantStyles: Record<string, TextStyle> = {
  default: {
    color: '#1f2937',
  },
  primary: {
    color: '#ffffff',
  },
  secondary: {
    color: '#ffffff',
  },
  outline: {
    color: '#374151',
  },
  ghost: {
    color: '#374151',
  },
  destructive: {
    color: '#ffffff',
  },
  success: {
    color: '#ffffff',
  },
  warning: {
    color: '#ffffff',
  },
};

const textSizeStyles: Record<string, TextStyle> = {
  xs: {
    fontSize: 12,
  },
  sm: {
    fontSize: 14,
  },
  md: {
    fontSize: 14,
  },
  lg: {
    fontSize: 16,
  },
  xl: {
    fontSize: 18,
  },
  icon: {
    fontSize: 14,
  },
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    overflow: 'hidden',
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  icon: {
    marginHorizontal: 4,
  },
  loader: {
    marginRight: 4,
  },
  text: {
    fontWeight: '500',
  },
});

export default Button;


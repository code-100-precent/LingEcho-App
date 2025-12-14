/**
 * Badge 组件 - React Native 版本
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';

export interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'outline' | 'muted';
  size?: 'xs' | 'sm' | 'md' | 'lg';
  shape?: 'rounded' | 'pill' | 'square';
  icon?: React.ReactNode;
  style?: ViewStyle;
  onPress?: () => void;
}

const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'default',
  size = 'sm',
  shape = 'rounded',
  icon,
  style,
  onPress,
}) => {
  const Component = onPress ? TouchableOpacity : View;

  return (
    <Component
      style={[
        styles.base,
        styles.variant[variant],
        styles.size[size],
        styles.shape[shape],
        style,
      ]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {icon && <View style={styles.icon}>{icon}</View>}
      <Text style={[styles.text, styles.textVariant[variant], styles.textSize[size]]}>
        {children}
      </Text>
    </Component>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  variant: {
    default: {
      backgroundColor: '#f3f4f6',
    },
    primary: {
      backgroundColor: '#dbeafe',
    },
    secondary: {
      backgroundColor: '#e5e7eb',
    },
    success: {
      backgroundColor: '#d1fae5',
    },
    warning: {
      backgroundColor: '#fef3c7',
    },
    error: {
      backgroundColor: '#fee2e2',
    },
    outline: {
      backgroundColor: 'transparent',
      borderWidth: 1,
      borderColor: '#d1d5db',
    },
    muted: {
      backgroundColor: '#f9fafb',
    },
  },
  size: {
    xs: {
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    sm: {
      paddingHorizontal: 8,
      paddingVertical: 4,
    },
    md: {
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    lg: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
  },
  shape: {
    rounded: {
      borderRadius: 6,
    },
    pill: {
      borderRadius: 9999,
    },
    square: {
      borderRadius: 0,
    },
  },
  icon: {
    marginRight: 4,
  },
  text: {
    fontWeight: '500',
  },
  textVariant: {
    default: {
      color: '#374151',
    },
    primary: {
      color: '#1e40af',
    },
    secondary: {
      color: '#374151',
    },
    success: {
      color: '#065f46',
    },
    warning: {
      color: '#92400e',
    },
    error: {
      color: '#991b1b',
    },
    outline: {
      color: '#374151',
    },
    muted: {
      color: '#6b7280',
    },
  },
  textSize: {
    xs: {
      fontSize: 10,
    },
    sm: {
      fontSize: 12,
    },
    md: {
      fontSize: 14,
    },
    lg: {
      fontSize: 16,
    },
  },
});

export default Badge;


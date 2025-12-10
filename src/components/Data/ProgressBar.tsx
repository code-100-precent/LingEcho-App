/**
 * ProgressBar 组件 - React Native 版本
 */
import React, { ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
} from 'react-native';

interface ProgressBarProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'error';
  showValue?: boolean;
  label?: string;
  description?: string;
  style?: ViewStyle;
  children?: ReactNode;
}

const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  max = 100,
  size = 'md',
  variant = 'default',
  showValue = true,
  label,
  description,
  style,
  children,
}) => {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  const sizeStyles = {
    sm: styles.sizeSm,
    md: styles.sizeMd,
    lg: styles.sizeLg,
  };

  const variantStyles = {
    default: styles.variantDefault,
    success: styles.variantSuccess,
    warning: styles.variantWarning,
    error: styles.variantError,
  };

  const getVariantTextColor = () => {
    switch (variant) {
      case 'success':
        return styles.textSuccess;
      case 'warning':
        return styles.textWarning;
      case 'error':
        return styles.textError;
      default:
        return styles.textDefault;
    }
  };

  return (
    <View style={[styles.container, style]}>
      {(label || showValue) && (
        <View style={styles.header}>
          {label && (
            <Text style={styles.label}>{label}</Text>
          )}
          {showValue && (
            <Text style={[styles.value, getVariantTextColor()]}>
              {Math.round(percentage)}%
            </Text>
          )}
        </View>
      )}

      <View style={[styles.track, sizeStyles[size]]}>
        <View
          style={[
            styles.fill,
            variantStyles[variant],
            { width: `${percentage}%` },
          ]}
        >
          {children}
        </View>
      </View>

      {description && (
        <Text style={styles.description}>{description}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
  },
  textDefault: {
    color: '#3b82f6',
  },
  textSuccess: {
    color: '#10b981',
  },
  textWarning: {
    color: '#f59e0b',
  },
  textError: {
    color: '#ef4444',
  },
  track: {
    width: '100%',
    backgroundColor: '#e5e7eb',
    borderRadius: 999,
    overflow: 'hidden',
  },
  sizeSm: {
    height: 8,
  },
  sizeMd: {
    height: 12,
  },
  sizeLg: {
    height: 16,
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
  variantDefault: {
    backgroundColor: '#3b82f6',
  },
  variantSuccess: {
    backgroundColor: '#10b981',
  },
  variantWarning: {
    backgroundColor: '#f59e0b',
  },
  variantError: {
    backgroundColor: '#ef4444',
  },
  description: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
});

export default ProgressBar;

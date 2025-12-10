/**
 * Input 组件 - React Native 版本
 */
import React, { useState, forwardRef } from 'react';
import {
  View,
  TextInput,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
  TextInputProps,
} from 'react-native';

export interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  clearable?: boolean;
  onClear?: () => void;
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  showCount?: boolean;
  countMax?: number;
  wrapperStyle?: ViewStyle;
  inputStyle?: TextStyle;
}

const Input = forwardRef<TextInput, InputProps>(
  (
    {
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      clearable = false,
      onClear,
      size = 'md',
      loading = false,
      showCount = false,
      countMax,
      maxLength,
      value,
      onChangeText,
      secureTextEntry,
      wrapperStyle,
      inputStyle,
      ...props
    },
    ref
  ) => {
    const [showPassword, setShowPassword] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    const currentValue = value || '';
    const hasValue = currentValue.length > 0;

    const handleClear = () => {
      if (onClear) {
        onClear();
      } else if (onChangeText) {
        onChangeText('');
      }
    };

    return (
      <View style={[styles.wrapper, wrapperStyle]}>
        {label && (
          <Text style={styles.label}>
            {label}
            {props.required && <Text style={styles.required}> *</Text>}
          </Text>
        )}

        <View
          style={[
            styles.inputContainer,
            styles.size[size],
            isFocused && styles.focused,
            error && styles.error,
            leftIcon && styles.withLeftIcon,
            (rightIcon || clearable || secureTextEntry) && styles.withRightIcon,
          ]}
        >
          {leftIcon && <View style={styles.leftIcon}>{leftIcon}</View>}

          <TextInput
            ref={ref}
            style={[styles.input, styles.inputSize[size], inputStyle]}
            value={value}
            onChangeText={onChangeText}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            secureTextEntry={secureTextEntry && !showPassword}
            maxLength={maxLength || countMax}
            placeholderTextColor="#9ca3af"
            {...props}
          />

          <View style={styles.rightActions}>
            {loading && (
              <View style={styles.iconContainer}>
                <Text>⏳</Text>
              </View>
            )}

            {clearable && hasValue && !loading && (
              <TouchableOpacity
                onPress={handleClear}
                style={styles.iconContainer}
              >
                <Text style={styles.clearIcon}>✕</Text>
              </TouchableOpacity>
            )}

            {secureTextEntry && !loading && (
              <TouchableOpacity
                onPress={() => setShowPassword(!showPassword)}
                style={styles.iconContainer}
              >
                <Text>{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
              </TouchableOpacity>
            )}

            {!loading && !clearable && !secureTextEntry && rightIcon && (
              <View style={styles.iconContainer}>{rightIcon}</View>
            )}
          </View>
        </View>

        <View style={styles.footer}>
          <View style={styles.helperContainer}>
            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : helperText ? (
              <Text style={styles.helperText}>{helperText}</Text>
            ) : null}
          </View>

          {showCount && (
            <Text
              style={[
                styles.count,
                countMax && currentValue.length > countMax && styles.countError,
              ]}
            >
              {currentValue.length}
              {countMax ? ` / ${countMax}` : ''}
            </Text>
          )}
        </View>
      </View>
    );
  }
);

Input.displayName = 'Input';

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  required: {
    color: '#ef4444',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    backgroundColor: '#ffffff',
  },
  focused: {
    borderColor: '#007AFF',
    borderWidth: 2,
  },
  error: {
    borderColor: '#ef4444',
  },
  withLeftIcon: {
    paddingLeft: 12,
  },
  withRightIcon: {
    paddingRight: 12,
  },
  size: {
    sm: {
      minHeight: 32,
    },
    md: {
      minHeight: 40,
    },
    lg: {
      minHeight: 48,
    },
  },
  input: {
    flex: 1,
    color: '#1f2937',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inputSize: {
    sm: {
      fontSize: 14,
    },
    md: {
      fontSize: 16,
    },
    lg: {
      fontSize: 18,
    },
  },
  leftIcon: {
    marginRight: 8,
  },
  rightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconContainer: {
    padding: 4,
  },
  clearIcon: {
    fontSize: 16,
    color: '#6b7280',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginTop: 4,
  },
  helperContainer: {
    flex: 1,
  },
  helperText: {
    fontSize: 12,
    color: '#6b7280',
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
  },
  count: {
    fontSize: 12,
    color: '#6b7280',
  },
  countError: {
    color: '#ef4444',
  },
});

export default Input;


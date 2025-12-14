/**
 * 验证码输入组件 - 6位数字验证码
 */
import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

interface VerificationCodeInputProps {
  value: string;
  onChangeText: (text: string) => void;
  length?: number;
  error?: boolean;
  disabled?: boolean;
}

const VerificationCodeInput: React.FC<VerificationCodeInputProps> = ({
  value,
  onChangeText,
  length = 6,
  error = false,
  disabled = false,
}) => {
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  const handleChangeText = (text: string, index: number) => {
    // 只允许数字
    const numericText = text.replace(/[^0-9]/g, '');
    
    if (numericText.length === 0) {
      // 删除字符
      const newValue = value.split('');
      newValue[index] = '';
      onChangeText(newValue.join(''));
      
      // 聚焦到上一个输入框
      if (index > 0) {
        inputRefs.current[index - 1]?.focus();
      }
    } else {
      // 输入字符
      const newValue = value.split('');
      newValue[index] = numericText[numericText.length - 1];
      onChangeText(newValue.join(''));
      
      // 自动聚焦到下一个输入框
      if (index < length - 1 && numericText.length > 0) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && value[index] === '' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleFocus = (index: number) => {
    setFocusedIndex(index);
  };

  const handleBlur = () => {
    setFocusedIndex(null);
  };

  const handleContainerPress = () => {
    // 点击容器时聚焦到第一个空输入框
    const firstEmptyIndex = value.length < length ? value.length : 0;
    inputRefs.current[firstEmptyIndex]?.focus();
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        activeOpacity={1}
        onPress={handleContainerPress}
        style={styles.inputsContainer}
        disabled={disabled}
      >
        {Array.from({ length }).map((_, index) => (
          <TextInput
            key={index}
            ref={(ref) => {
              inputRefs.current[index] = ref;
            }}
            style={[
              styles.input,
              focusedIndex === index && styles.inputFocused,
              error && styles.inputError,
              disabled && styles.inputDisabled,
            ]}
            value={value[index] || ''}
            onChangeText={(text) => handleChangeText(text, index)}
            onKeyPress={(e) => handleKeyPress(e, index)}
            onFocus={() => handleFocus(index)}
            onBlur={handleBlur}
            keyboardType="number-pad"
            maxLength={1}
            editable={!disabled}
            selectTextOnFocus
          />
        ))}
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  inputsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  input: {
    flex: 1,
    height: 56,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    backgroundColor: '#ffffff',
    textAlign: 'center',
    fontSize: 24,
    fontWeight: '600',
    color: '#1e293b',
  },
  inputFocused: {
    borderColor: '#a78bfa',
    backgroundColor: '#faf5ff',
  },
  inputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  inputDisabled: {
    backgroundColor: '#f1f5f9',
    opacity: 0.6,
  },
});

export default VerificationCodeInput;


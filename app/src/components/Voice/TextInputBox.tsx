/**
 * TextInputBox 组件 - React Native 版本
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import Input from '../Input';
import Button from '../Button';
import Select from '../Select';

export type TextMode = 'voice' | 'text';

interface TextInputBoxProps {
  inputValue: string;
  onInputChange: (value: string) => void;
  isWaitingForResponse: boolean;
  onEnter?: () => void;
  onSend: () => void;
  textMode?: TextMode;
  onTextModeChange?: (mode: TextMode) => void;
  style?: ViewStyle;
}

const TextInputBox: React.FC<TextInputBoxProps> = ({
  inputValue,
  onInputChange,
  isWaitingForResponse,
  onEnter,
  onSend,
  textMode = 'voice',
  onTextModeChange,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.content}>
        <View style={styles.inputRow}>
          {/* 文本模式选择框 */}
          {onTextModeChange && (
            <View style={styles.selectContainer}>
              <Select
                value={textMode}
                onValueChange={(value) => onTextModeChange(value as TextMode)}
                disabled={isWaitingForResponse}
                options={[
                  { label: '语音输出', value: 'voice' },
                  { label: '文本对话', value: 'text' },
                ]}
                style={styles.select}
              />
            </View>
          )}
          <Input
            value={inputValue}
            onChangeText={onInputChange}
            placeholder={
              isWaitingForResponse
                ? '正在处理中...'
                : textMode === 'text'
                ? '输入文本进行文本对话...'
                : '输入文本直接发送'
            }
            disabled={isWaitingForResponse}
            style={styles.input}
            onSubmitEditing={onEnter}
          />
          <Button
            variant="primary"
            onPress={onSend}
            disabled={isWaitingForResponse}
            style={styles.sendButton}
          >
            {isWaitingForResponse ? '处理中...' : '发送'}
          </Button>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    padding: 24,
    backgroundColor: '#faf5ff',
  },
  content: {
    maxWidth: 672,
    alignSelf: 'center',
    width: '100%',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectContainer: {
    width: 128,
  },
  select: {
    flex: 0,
  },
  input: {
    flex: 1,
  },
  sendButton: {
    paddingHorizontal: 24,
  },
});

export default TextInputBox;

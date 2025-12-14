/**
 * Switch 组件 - React Native 版本
 */
import React from 'react';
import { Switch as RNSwitch, StyleSheet, ViewStyle } from 'react-native';

export interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  style?: ViewStyle;
  trackColor?: { false: string; true: string };
  thumbColor?: string;
}

const Switch: React.FC<SwitchProps> = ({
  checked,
  onCheckedChange,
  disabled = false,
  style,
  trackColor = { false: '#ccc', true: '#007AFF' },
  thumbColor = '#ffffff',
}) => {
  return (
    <RNSwitch
      value={checked}
      onValueChange={onCheckedChange}
      disabled={disabled}
      trackColor={trackColor}
      thumbColor={thumbColor}
      style={style}
    />
  );
};

export default Switch;


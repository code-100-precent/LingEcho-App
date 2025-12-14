/**
 * 类名合并工具（React Native版本）
 * 简化版本，用于统一样式处理
 */
import { StyleSheet, ViewStyle, TextStyle, ImageStyle } from 'react-native';

export type Style = ViewStyle | TextStyle | ImageStyle;

export function cn(...styles: (Style | false | null | undefined)[]): Style[] {
  return styles.filter((s): s is Style => s !== false && s !== null && s !== undefined);
}

export function mergeStyles(...styles: Style[]): Style {
  return StyleSheet.flatten(styles);
}


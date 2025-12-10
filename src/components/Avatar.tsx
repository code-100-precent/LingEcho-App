/**
 * Avatar 组件 - React Native 版本
 */
import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';

export interface AvatarProps {
  src?: string;
  alt?: string;
  fallback?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  style?: ViewStyle;
  onPress?: () => void;
}

// 基于文本生成颜色
const getColorFromText = (text: string): string => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = text.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 60%)`;
};

const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = 'Avatar',
  fallback = 'U',
  size = 'md',
  style,
  onPress,
}) => {
  const Component = onPress ? TouchableOpacity : View;
  const avatarText = size === 'sm' 
    ? fallback.charAt(0).toUpperCase() 
    : fallback.substring(0, 2).toUpperCase();

  const backgroundColor = src ? 'transparent' : getColorFromText(fallback);

  return (
    <Component
      style={[
        styles.base,
        styles.size[size],
        { backgroundColor },
        style,
      ]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      {src ? (
        <Image
          source={{ uri: src }}
          style={[styles.image, styles.size[size]]}
          resizeMode="cover"
        />
      ) : (
        <Text style={[styles.text, styles.textSize[size]]}>{avatarText}</Text>
      )}
    </Component>
  );
};

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 9999,
    overflow: 'hidden',
  },
  size: {
    sm: {
      width: 32,
      height: 32,
    },
    md: {
      width: 40,
      height: 40,
    },
    lg: {
      width: 48,
      height: 48,
    },
    xl: {
      width: 64,
      height: 64,
    },
  },
  image: {
    width: '100%',
    height: '100%',
  },
  text: {
    fontWeight: '600',
    color: '#ffffff',
  },
  textSize: {
    sm: {
      fontSize: 12,
    },
    md: {
      fontSize: 14,
    },
    lg: {
      fontSize: 16,
    },
    xl: {
      fontSize: 20,
    },
  },
});

export default Avatar;


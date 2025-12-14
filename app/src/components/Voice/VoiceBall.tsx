/**
 * VoiceBall 组件 - React Native 版本
 */
import React, { useRef, useEffect, useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ViewStyle,
} from 'react-native';
import { Mic, PhoneOff } from '../Icons';

interface VoiceBallProps {
  isCalling: boolean;
  onToggleCall: () => void;
  style?: ViewStyle;
}

const VoiceBall: React.FC<VoiceBallProps> = ({
  isCalling,
  onToggleCall,
  style,
}) => {
  const [audioLevel, setAudioLevel] = useState(0);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const pulseAnim = useRef(new Animated.Value(0)).current;

  // 动画效果
  useEffect(() => {
    if (isCalling) {
      // 脉冲动画
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();

      // 缩放动画
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      scaleAnim.setValue(1);
      pulseAnim.setValue(0);
    }
  }, [isCalling, scaleAnim, pulseAnim]);

  // 模拟音频级别（实际应用中需要从音频分析器获取）
  useEffect(() => {
    if (!isCalling) {
      setAudioLevel(0);
      return;
    }

    const interval = setInterval(() => {
      // 模拟音频级别变化
      setAudioLevel(Math.random() * 100);
    }, 100);

    return () => clearInterval(interval);
  }, [isCalling]);

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.6],
  });

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.2],
  });

  return (
    <View style={[styles.container, style]}>
      {/* 脉冲背景 */}
      {isCalling && (
        <Animated.View
          style={[
            styles.pulseBackground,
            {
              opacity: pulseOpacity,
              transform: [{ scale: pulseScale }],
            },
          ]}
        />
      )}

      {/* 主球体 */}
      <Animated.View
        style={[
          styles.ball,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        {/* 音频可视化圆圈 */}
        {isCalling && (
          <View
            style={[
              styles.audioRing,
              {
                width: 64 + (audioLevel / 100) * 20,
                height: 64 + (audioLevel / 100) * 20,
                borderRadius: 32 + (audioLevel / 100) * 10,
                opacity: 0.3 + (audioLevel / 100) * 0.3,
              },
            ]}
          />
        )}

        <TouchableOpacity
          onPress={onToggleCall}
          style={[
            styles.button,
            isCalling && styles.buttonActive,
          ]}
          activeOpacity={0.8}
        >
          <View style={styles.buttonContent}>
            {isCalling ? (
              <PhoneOff size={32} color="#ffffff" />
            ) : (
              <Mic size={32} color="#ffffff" />
            )}
          </View>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  pulseBackground: {
    position: 'absolute',
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: '#a855f7',
  },
  ball: {
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: '#a855f7',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  audioRing: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#a855f7',
    backgroundColor: 'transparent',
  },
  button: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#8b5cf6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonActive: {
    backgroundColor: '#7c3aed',
  },
  buttonContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default VoiceBall;

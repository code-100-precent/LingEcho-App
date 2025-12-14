/**
 * CallAudioPlayer 组件 - React Native 版本
 */
import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';
import { Audio } from 'expo-av';

export interface ParsedMessage {
  role: 'user' | 'agent' | 'system';
  content: string;
  timeInCallSecs: number;
}

interface CallAudioPlayerProps {
  callId: string;
  audioUrl: string;
  hasAudio: boolean;
  durationSeconds: number | null;
  messages?: ParsedMessage[];
  style?: ViewStyle;
}

export default function CallAudioPlayer({
  callId,
  audioUrl,
  hasAudio,
  durationSeconds,
  messages = [],
  style,
}: CallAudioPlayerProps) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<any>(null);

  const duration = durationSeconds || 0;
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // 加载音频
  useEffect(() => {
    let isMounted = true;

    const loadAudio = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const { sound: audioSound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: false }
        );

        if (isMounted) {
          setSound(audioSound);

          // 监听播放状态
          audioSound.setOnPlaybackStatusUpdate((playbackStatus) => {
            if (playbackStatus.isLoaded) {
              setStatus(playbackStatus);
              setCurrentTime(playbackStatus.positionMillis / 1000);
              setIsPlaying(playbackStatus.isPlaying);

              if (playbackStatus.didJustFinish) {
                setIsPlaying(false);
                setCurrentTime(0);
              }
            }
          });
        }
      } catch (err) {
        console.error('音频加载失败:', err);
        if (isMounted) {
          setError('音频加载失败');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    if (hasAudio && audioUrl) {
      loadAudio();
    }

    return () => {
      isMounted = false;
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [audioUrl, hasAudio]);

  // 播放/暂停
  const togglePlayPause = async () => {
    if (!sound || !status?.isLoaded) return;

    try {
      if (isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
    } catch (err) {
      console.error('播放失败:', err);
      setError('播放失败');
    }
  };

  // 跳转到指定时间
  const handleSeek = async (event: any) => {
    if (!sound || !status?.isLoaded || !duration || duration === 0) return;

    const { locationX } = event.nativeEvent;
    const containerWidth = 300; // Approximate width
    const percentage = Math.max(0, Math.min(1, locationX / containerWidth));
    const newTime = percentage * duration;

    try {
      await sound.setPositionAsync(newTime * 1000);
      if (!isPlaying) {
        await sound.playAsync();
      }
    } catch (err) {
      console.error('跳转失败:', err);
    }
  };

  const formatTime = (seconds: number) => {
    if (isNaN(seconds) || seconds === null) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!hasAudio) {
    return null;
  }

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>通话录音</Text>
        <Text style={styles.timeText}>
          {formatTime(currentTime)} / {formatTime(duration)}
        </Text>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.controls}>
        {/* 播放/暂停按钮 */}
        <TouchableOpacity
          onPress={togglePlayPause}
          disabled={isLoading}
          style={[styles.playButton, isLoading && styles.disabled]}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : isPlaying ? (
            <Text style={styles.iconText}>⏸</Text>
          ) : (
            <Text style={styles.iconText}>▶</Text>
          )}
        </TouchableOpacity>

        {/* 进度条 */}
        <TouchableOpacity
          style={styles.progressContainer}
          onPress={handleSeek}
          activeOpacity={1}
        >
          {/* 消息分段背景 */}
          {duration > 0 && messages.length > 0 && (
            <View style={styles.messageSegments}>
              {messages.map((msg, idx) => {
                const nextMsg = messages[idx + 1];
                const startPercent = (msg.timeInCallSecs / duration) * 100;
                const endTime = nextMsg ? nextMsg.timeInCallSecs : duration;
                const widthPercent = ((endTime - msg.timeInCallSecs) / duration) * 100;

                const bgColor =
                  msg.role === 'user'
                    ? '#dbeafe'
                    : msg.role === 'agent'
                    ? '#d1fae5'
                    : '#f3f4f6';

                return (
                  <View
                    key={idx}
                    style={[
                      styles.segment,
                      {
                        left: `${startPercent}%`,
                        width: `${widthPercent}%`,
                        backgroundColor: bgColor,
                      },
                    ]}
                  />
                );
              })}
            </View>
          )}

          {/* 进度条 */}
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>

          {/* 进度指示器 */}
          <View style={[styles.progressIndicator, { left: `${progress}%` }]} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
  },
  timeText: {
    fontSize: 14,
    color: '#6b7280',
    fontFamily: 'monospace',
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#991b1b',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabled: {
    backgroundColor: '#9ca3af',
  },
  iconText: {
    color: '#ffffff',
    fontSize: 16,
  },
  progressContainer: {
    flex: 1,
    height: 64,
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  messageSegments: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  segment: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  progressBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  progressFill: {
    height: 4,
    backgroundColor: '#3b82f6',
    borderRadius: 2,
  },
  progressIndicator: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#ef4444',
  },
});

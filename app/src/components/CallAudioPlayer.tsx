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

        // 验证音频URL
        if (!audioUrl || audioUrl.trim() === '') {
          throw new Error('音频URL为空');
        }

        console.log('正在加载音频:', audioUrl);

        // 设置音频模式
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });

        const { sound: audioSound } = await Audio.Sound.createAsync(
          { uri: audioUrl },
          { shouldPlay: false },
          (playbackStatus) => {
            if (playbackStatus.isLoaded) {
              setStatus(playbackStatus);
              setCurrentTime(playbackStatus.positionMillis / 1000);
              setIsPlaying(playbackStatus.isPlaying);

              if (playbackStatus.didJustFinish) {
                setIsPlaying(false);
                setCurrentTime(0);
              }
            } else if (playbackStatus.error) {
              console.error('播放状态错误:', playbackStatus.error);
              setError(`播放错误: ${playbackStatus.error}`);
            }
          }
        );

        if (isMounted) {
          setSound(audioSound);
          console.log('音频加载成功');
        }
      } catch (err: any) {
        console.error('音频加载失败:', err);
        console.error('错误详情:', {
          message: err.message,
          code: err.code,
          audioUrl,
        });
        
        if (isMounted) {
          let errorMessage = '音频加载失败';
          
          if (err.message?.includes('404') || err.message?.includes('Not Found')) {
            errorMessage = '音频文件不存在';
          } else if (err.message?.includes('no supported source')) {
            errorMessage = '不支持的音频格式';
          } else if (err.message?.includes('network')) {
            errorMessage = '网络连接失败';
          } else if (err.message) {
            errorMessage = `加载失败: ${err.message}`;
          }
          
          setError(errorMessage);
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
        sound.unloadAsync().catch(err => {
          console.error('卸载音频失败:', err);
        });
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
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.playerContent}>
        {/* 播放/暂停按钮 */}
        <TouchableOpacity
          onPress={togglePlayPause}
          disabled={isLoading}
          style={[styles.playButton, isLoading && styles.disabled]}
          activeOpacity={0.8}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <View style={styles.playIconContainer}>
              {isPlaying ? (
                <View style={styles.pauseIcon}>
                  <View style={styles.pauseBar} />
                  <View style={styles.pauseBar} />
                </View>
              ) : (
                <View style={styles.playIcon} />
              )}
            </View>
          )}
        </TouchableOpacity>

        {/* 进度条和时间 */}
        <View style={styles.progressSection}>
          {/* 时间显示 */}
          <View style={styles.timeRow}>
            <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
            <Text style={styles.timeSeparator}>•</Text>
            <Text style={styles.durationText}>{formatTime(duration)}</Text>
          </View>

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

            {/* 进度条背景 */}
            <View style={styles.progressTrack}>
              {/* 已播放进度 */}
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
              {/* 进度指示器 */}
              <View style={[styles.progressThumb, { left: `${progress}%` }]} />
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    color: '#991b1b',
    flex: 1,
  },
  playerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  playButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#a855f7',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  disabled: {
    backgroundColor: '#cbd5e1',
    shadowColor: '#64748b',
    shadowOpacity: 0.2,
  },
  playIconContainer: {
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    width: 0,
    height: 0,
    marginLeft: 3,
    borderLeftWidth: 16,
    borderTopWidth: 10,
    borderBottomWidth: 10,
    borderLeftColor: '#ffffff',
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  pauseIcon: {
    flexDirection: 'row',
    gap: 4,
    alignItems: 'center',
  },
  pauseBar: {
    width: 4,
    height: 18,
    backgroundColor: '#ffffff',
    borderRadius: 2,
  },
  progressSection: {
    flex: 1,
    gap: 8,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  timeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
  },
  timeSeparator: {
    fontSize: 12,
    color: '#cbd5e1',
    fontWeight: '600',
  },
  durationText: {
    fontSize: 13,
    color: '#94a3b8',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
  },
  progressContainer: {
    height: 48,
    justifyContent: 'center',
    position: 'relative',
  },
  messageSegments: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 24,
    overflow: 'hidden',
  },
  segment: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    opacity: 0.4,
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#e2e8f0',
    borderRadius: 3,
    position: 'relative',
    overflow: 'visible',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#a855f7',
    borderRadius: 3,
    position: 'relative',
  },
  progressThumb: {
    position: 'absolute',
    top: -5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#a855f7',
    marginLeft: -8,
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
    borderWidth: 3,
    borderColor: '#ffffff',
  },
});

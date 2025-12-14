/**
 * VoicePlayer 组件 - React Native 版本
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
} from 'react-native';
import { Audio } from 'expo-av';

interface VoicePlayerProps {
  audioUrl?: string;
  audioData?: string; // base64 encoded audio data
  title?: string;
  autoPlay?: boolean;
  onPlay?: () => void;
  onPause?: () => void;
  onEnd?: () => void;
  style?: ViewStyle;
}

const VoicePlayer: React.FC<VoicePlayerProps> = ({
  audioUrl,
  audioData,
  title = '语音播放',
  autoPlay = false,
  onPlay,
  onPause,
  onEnd,
  style,
}) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<any>(null);

  // 加载音频
  useEffect(() => {
    let isMounted = true;

    const loadAudio = async () => {
      try {
        setIsLoading(true);
        setError(null);

        let source;
        if (audioUrl) {
          source = { uri: audioUrl };
        } else if (audioData) {
          source = { uri: `data:audio/mp3;base64,${audioData}` };
        } else {
          return;
        }

        const { sound: audioSound } = await Audio.Sound.createAsync(
          source,
          {
            shouldPlay: autoPlay,
            volume: volume,
            isMuted: isMuted,
          }
        );

        if (isMounted) {
          setSound(audioSound);

          audioSound.setOnPlaybackStatusUpdate((playbackStatus) => {
            if (playbackStatus.isLoaded) {
              setStatus(playbackStatus);
              setCurrentTime(playbackStatus.positionMillis / 1000);
              setDuration((playbackStatus.durationMillis || 0) / 1000);
              setIsPlaying(playbackStatus.isPlaying);
              setIsMuted(playbackStatus.isMuted);

              if (playbackStatus.didJustFinish) {
                setIsPlaying(false);
                setCurrentTime(0);
                onEnd?.();
              }

              if (playbackStatus.isPlaying) {
                onPlay?.();
              } else {
                onPause?.();
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

    if (audioUrl || audioData) {
      loadAudio();
    }

    return () => {
      isMounted = false;
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [audioUrl, audioData, autoPlay]);

  // 播放/暂停
  const togglePlay = async () => {
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

  // 静音/取消静音
  const toggleMute = async () => {
    if (!sound || !status?.isLoaded) return;

    try {
      await sound.setIsMutedAsync(!isMuted);
    } catch (err) {
      console.error('静音操作失败:', err);
    }
  };

  // 设置音量
  const handleVolumeChange = async (newVolume: number) => {
    if (!sound || !status?.isLoaded) return;

    try {
      await sound.setVolumeAsync(newVolume);
      setVolume(newVolume);
      if (newVolume === 0) {
        setIsMuted(true);
      } else if (isMuted) {
        setIsMuted(false);
      }
    } catch (err) {
      console.error('音量设置失败:', err);
    }
  };

  // 跳转到指定时间
  const handleSeek = async (value: number) => {
    if (!sound || !status?.isLoaded || !duration) return;

    try {
      await sound.setPositionAsync(value * 1000);
    } catch (err) {
      console.error('跳转失败:', err);
    }
  };

  // 重置播放
  const resetPlayback = async () => {
    if (!sound || !status?.isLoaded) return;

    try {
      await sound.setPositionAsync(0);
      setCurrentTime(0);
    } catch (err) {
      console.error('重置失败:', err);
    }
  };

  // 格式化时间
  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={resetPlayback} style={styles.iconButton}>
            <Text style={styles.iconText}>↻</Text>
          </TouchableOpacity>
        </View>
      </View>

      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      )}

      {/* 进度条 */}
      <View style={styles.progressContainer}>
        <TouchableOpacity
          style={styles.progressBar}
          onPress={(e) => {
            // Simple seek implementation - can be enhanced with proper slider
            const { locationX } = e.nativeEvent;
            const containerWidth = 300; // Approximate width
            const percentage = Math.max(0, Math.min(1, locationX / containerWidth));
            handleSeek(percentage * duration);
          }}
          activeOpacity={1}
        >
          <View style={styles.progressTrack}>
            <View
              style={[
                styles.progressFill,
                { width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` },
              ]}
            />
          </View>
        </TouchableOpacity>
        <View style={styles.timeContainer}>
          <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
          <Text style={styles.timeText}>{formatTime(duration)}</Text>
        </View>
      </View>

      {/* 控制按钮 */}
      <View style={styles.controls}>
        <View style={styles.leftControls}>
          {/* 播放/暂停按钮 */}
          <TouchableOpacity
            onPress={togglePlay}
            disabled={isLoading || !!error}
            style={[
              styles.playButton,
              (isLoading || !!error) && styles.disabled,
            ]}
          >
            {isPlaying ? (
              <Text style={styles.playIcon}>⏸</Text>
            ) : (
              <Text style={styles.playIcon}>▶</Text>
            )}
          </TouchableOpacity>

          {/* 静音按钮 */}
          <TouchableOpacity onPress={toggleMute} style={styles.iconButton}>
            <Text style={styles.iconText}>{isMuted ? '🔇' : '🔊'}</Text>
          </TouchableOpacity>

          {/* 音量控制 */}
          <View style={styles.volumeContainer}>
            <Text style={styles.volumeIcon}>🔊</Text>
            <TouchableOpacity
              style={styles.volumeBar}
              onPress={(e) => {
                const { locationX } = e.nativeEvent;
                const containerWidth = 80;
                const percentage = Math.max(0, Math.min(1, locationX / containerWidth));
                handleVolumeChange(percentage);
              }}
              activeOpacity={1}
            >
              <View style={styles.volumeTrack}>
                <View
                  style={[
                    styles.volumeFill,
                    { width: `${(isMuted ? 0 : volume) * 100}%` },
                  ]}
                />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* 状态指示器 */}
        {isPlaying && (
          <View style={styles.statusIndicator}>
            <View style={styles.statusDot} />
            <Text style={styles.statusText}>播放中</Text>
          </View>
        )}
      </View>
    </View>
  );
};

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
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '500',
    color: '#1f2937',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    padding: 8,
  },
  iconText: {
    fontSize: 16,
    color: '#6b7280',
  },
  errorContainer: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#991b1b',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6b7280',
  },
  progressContainer: {
    marginBottom: 16,
  },
  progressBar: {
    width: '100%',
    height: 40,
    justifyContent: 'center',
  },
  progressTrack: {
    width: '100%',
    height: 4,
    backgroundColor: '#d1d5db',
    borderRadius: 2,
  },
  progressFill: {
    height: 4,
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  volumeBar: {
    width: 80,
    height: 30,
    justifyContent: 'center',
  },
  volumeTrack: {
    width: '100%',
    height: 4,
    backgroundColor: '#d1d5db',
    borderRadius: 2,
  },
  volumeFill: {
    height: 4,
    backgroundColor: '#007AFF',
    borderRadius: 2,
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  timeText: {
    fontSize: 12,
    color: '#6b7280',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  playButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabled: {
    backgroundColor: '#9ca3af',
  },
  playIcon: {
    fontSize: 24,
    color: '#ffffff',
  },
  volumeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  volumeIcon: {
    fontSize: 16,
  },
  volumeSlider: {
    width: 80,
    height: 40,
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
  },
  statusText: {
    fontSize: 12,
    color: '#10b981',
  },
});

export default VoicePlayer;

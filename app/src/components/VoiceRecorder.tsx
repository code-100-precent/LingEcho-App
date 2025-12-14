/**
 * VoiceRecorder 组件 - React Native 版本
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  Alert,
} from 'react-native';
import { Audio } from 'expo-av';

interface VoiceRecorderProps {
  onRecordingComplete: (audioData: string) => void;
  onRecordingStart?: () => void;
  onRecordingStop?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
}

const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onRecordingComplete,
  onRecordingStart,
  onRecordingStop,
  disabled = false,
  style,
}) => {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingUri, setRecordingUri] = useState<string | null>(null);

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 请求音频权限
  useEffect(() => {
    const requestPermissions = async () => {
      try {
        await Audio.requestPermissionsAsync();
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });
      } catch (err) {
        console.error('权限请求失败:', err);
        Alert.alert('错误', '无法访问麦克风，请检查应用权限设置');
      }
    };

    requestPermissions();
  }, []);

  // 清理定时器
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  // 开始录音
  const startRecording = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording: newRecording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      setRecording(newRecording);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingTime(0);
      setRecordingUri(null);

      // 开始计时
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);

      onRecordingStart?.();
    } catch (err) {
      console.error('无法开始录音:', err);
      Alert.alert('错误', '无法访问麦克风，请检查应用权限设置');
    }
  };

  // 停止录音
  const stopRecording = async () => {
    if (!recording) return;

    try {
      setIsRecording(false);

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      setRecordingUri(uri);

      // 读取录音文件并转换为 base64
      if (uri) {
        try {
          const response = await fetch(uri);
          const blob = await response.blob();
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64 = reader.result as string;
            const base64Data = base64.split(',')[1];
            onRecordingComplete(base64Data);
          };
          reader.readAsDataURL(blob);
        } catch (err) {
          console.error('读取录音文件失败:', err);
          // 如果无法读取，至少传递 URI
          onRecordingComplete(uri);
        }
      }

      setRecording(null);
      onRecordingStop?.();
    } catch (err) {
      console.error('停止录音失败:', err);
    }
  };

  // 暂停/恢复录音
  const togglePause = async () => {
    if (!recording) return;

    try {
      if (isPaused) {
        await recording.startAsync();
        setIsPaused(false);

        // 恢复计时
        timerRef.current = setInterval(() => {
          setRecordingTime((prev) => prev + 1);
        }, 1000);
      } else {
        await recording.pauseAsync();
        setIsPaused(true);

        // 暂停计时
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      }
    } catch (err) {
      console.error('暂停/恢复录音失败:', err);
    }
  };

  // 播放录音
  const playRecording = async () => {
    if (!recordingUri) return;

    try {
      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          await sound.playAsync();
          setIsPlaying(true);
        }
      } else {
        const { sound: newSound } = await Audio.Sound.createAsync({
          uri: recordingUri,
        });
        setSound(newSound);

        newSound.setOnPlaybackStatusUpdate((status) => {
          if (status.isLoaded) {
            setIsPlaying(status.isPlaying);
            if (status.didJustFinish) {
              setIsPlaying(false);
            }
          }
        });

        await newSound.playAsync();
        setIsPlaying(true);
      }
    } catch (err) {
      console.error('播放录音失败:', err);
    }
  };

  // 清理音频
  useEffect(() => {
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, [sound]);

  // 格式化时间
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <View style={[styles.container, style]}>
      {/* 录音控制按钮 */}
      <View style={styles.controls}>
        {!isRecording ? (
          <TouchableOpacity
            onPress={startRecording}
            disabled={disabled}
            style={[styles.recordButton, disabled && styles.disabled]}
          >
            <Text style={styles.recordIcon}>🎤</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.recordingControls}>
            <TouchableOpacity
              onPress={togglePause}
              style={styles.pauseButton}
            >
              <Text style={styles.controlIcon}>
                {isPaused ? '▶' : '⏸'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={stopRecording}
              style={styles.stopButton}
            >
              <Text style={styles.controlIcon}>⏹</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* 录音状态显示 */}
      {isRecording && (
        <View style={styles.statusContainer}>
          <View style={styles.statusRow}>
            <View style={styles.recordingDot} />
            <Text style={styles.statusText}>
              {isPaused ? '录音已暂停' : '正在录音...'}
            </Text>
          </View>
          <Text style={styles.timeText}>{formatTime(recordingTime)}</Text>
        </View>
      )}

      {/* 录音预览 */}
      {recordingUri && !isRecording && (
        <View style={styles.previewContainer}>
          <View style={styles.previewHeader}>
            <Text style={styles.previewTitle}>录音预览</Text>
          </View>

          <View style={styles.previewControls}>
            <TouchableOpacity
              onPress={playRecording}
              style={styles.playButton}
            >
              <Text style={styles.playIcon}>
                {isPlaying ? '⏸' : '▶'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* 使用说明 */}
      <View style={styles.helpContainer}>
        <Text style={styles.helpText}>
          {isRecording
            ? '点击暂停/恢复录音，点击停止按钮结束录音'
            : '点击麦克风开始录音，录音将自动转换为文本'}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  recordButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ef4444',
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabled: {
    backgroundColor: '#9ca3af',
  },
  recordIcon: {
    fontSize: 32,
  },
  recordingControls: {
    flexDirection: 'row',
    gap: 8,
  },
  pauseButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f59e0b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stopButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#6b7280',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlIcon: {
    fontSize: 24,
    color: '#ffffff',
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#ef4444',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  timeText: {
    fontSize: 24,
    fontFamily: 'monospace',
    color: '#1f2937',
  },
  previewContainer: {
    width: '100%',
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  previewControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    fontSize: 20,
    color: '#ffffff',
  },
  helpContainer: {
    marginTop: 16,
  },
  helpText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
});

export default VoiceRecorder;

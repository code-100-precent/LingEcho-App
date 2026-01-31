/**
 * 通话记录详情页面
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { MainLayout, CallAudioPlayer, Card } from '../components';
import * as sipApi from '../services/api/sip';
import { getUploadsBaseURL } from '../config/apiConfig';

type SipCall = sipApi.SipCall;

type CallHistoryDetailRouteParams = {
  CallHistoryDetail: {
    callId: string;
  };
};

const CallHistoryDetailScreen: React.FC = () => {
  const route = useRoute<RouteProp<CallHistoryDetailRouteParams, 'CallHistoryDetail'>>();
  const navigation = useNavigation();
  const { callId } = route.params;

  const [call, setCall] = useState<SipCall | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [transcription, setTranscription] = useState<string>('');
  const [isTranscribing, setIsTranscribing] = useState(false);

  // 加载通话详情
  useEffect(() => {
    const loadCallDetail = async () => {
      setIsLoading(true);
      try {
        const response = await sipApi.getCallDetail(callId);
        if (response.code === 200 && response.data) {
          setCall(response.data);
          // 如果已有转录文本，直接显示
          if (response.data.transcription) {
            setTranscription(response.data.transcription);
          }
        } else {
          Alert.alert('错误', response.msg || '加载通话详情失败');
          navigation.goBack();
        }
      } catch (error: any) {
        console.error('Load call detail error:', error);
        Alert.alert('错误', error.msg || '加载通话详情失败');
        navigation.goBack();
      } finally {
        setIsLoading(false);
      }
    };

    loadCallDetail();
  }, [callId]);

  // 请求 ASR 转录
  const handleTranscribe = async () => {
    if (!call || !call.recordUrl) {
      Alert.alert('提示', '没有可用的录音文件');
      return;
    }

    setIsTranscribing(true);
    try {
      const uploadsBaseURL = getUploadsBaseURL();
      
      // 处理音频URL
      let audioUrl = '';
      if (call.recordUrl.startsWith('http')) {
        audioUrl = call.recordUrl;
      } else if (call.recordUrl.startsWith('/api/files/')) {
        // 临时方案：将 /api/files/ 替换为 /api/uploads/
        const baseURL = uploadsBaseURL.replace(/\/uploads$/, '').replace(/\/$/, '');
        const fixedPath = call.recordUrl.replace('/api/files/', '/api/uploads/');
        audioUrl = `${baseURL}${fixedPath}`;
      } else if (call.recordUrl.startsWith('/api/')) {
        const baseURL = uploadsBaseURL.replace(/\/uploads$/, '').replace(/\/$/, '');
        audioUrl = `${baseURL}${call.recordUrl}`;
      } else if (call.recordUrl.startsWith('/media/')) {
        audioUrl = call.recordUrl.replace('/media/', `${uploadsBaseURL}/`);
      } else {
        audioUrl = `${uploadsBaseURL}/${call.recordUrl}`;
      }

      const response = await sipApi.requestTranscription(callId, {
        audioUrl,
        language: 'zh-CN',
      });

      if (response.code === 200) {
        // 转录任务已提交，开始轮询检查状态
        Alert.alert('提示', '转录任务已提交，正在处理中...');
        pollTranscriptionStatus();
      } else {
        Alert.alert('错误', response.msg || '转录失败');
        setIsTranscribing(false);
      }
    } catch (error: any) {
      console.error('Transcription error:', error);
      Alert.alert('错误', error.msg || '转录失败，该功能可能未启用');
      setIsTranscribing(false);
    }
  };

  // 轮询转录状态
  const pollTranscriptionStatus = async () => {
    const maxAttempts = 30; // 最多轮询30次（30秒）
    let attempts = 0;

    const checkStatus = async () => {
      try {
        const response = await sipApi.getCallDetail(callId);
        if (response.code === 200 && response.data) {
          const status = response.data.transcriptionStatus;
          
          if (status === 'completed') {
            // 转录完成
            setTranscription(response.data.transcription || '');
            setIsTranscribing(false);
            Alert.alert('成功', '转录完成');
            return;
          } else if (status === 'failed') {
            // 转录失败
            setIsTranscribing(false);
            Alert.alert('错误', response.data.transcriptionError || '转录失败');
            return;
          } else if (status === 'processing' || status === 'pending') {
            // 继续轮询
            attempts++;
            if (attempts < maxAttempts) {
              setTimeout(checkStatus, 1000); // 1秒后再次检查
            } else {
              setIsTranscribing(false);
              Alert.alert('超时', '转录超时，请稍后重试');
            }
          }
        }
      } catch (error) {
        console.error('Poll transcription status error:', error);
        setIsTranscribing(false);
      }
    };

    checkStatus();
  };

  // 格式化时长
  const formatDuration = (seconds: number) => {
    if (seconds === 0) return '0秒';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins > 0) {
      return `${mins}分${secs}秒`;
    }
    return `${secs}秒`;
  };

  // 格式化时间
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // 获取状态信息
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'answered':
      case 'ended':
        return { text: '已接通', color: '#10b981' };
      case 'failed':
        return { text: '未接通', color: '#ef4444' };
      case 'cancelled':
        return { text: '已取消', color: '#f59e0b' };
      case 'calling':
      case 'ringing':
        return { text: '呼叫中', color: '#3b82f6' };
      default:
        return { text: status, color: '#64748b' };
    }
  };

  if (isLoading || !call) {
    return (
      <MainLayout
        navBarProps={{
          title: '通话详情',
          leftIcon: 'arrow-left',
          onLeftPress: () => navigation.goBack(),
        }}
        backgroundColor="#f8fafc"
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#a855f7" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </MainLayout>
    );
  }

  const statusInfo = getStatusInfo(call.status);
  const uploadsBaseURL = getUploadsBaseURL();
  
  // 处理录音 URL
  let audioUrl = '';
  if (call.recordUrl) {
    if (call.recordUrl.startsWith('http')) {
      // 已经是完整URL
      audioUrl = call.recordUrl;
    } else if (call.recordUrl.startsWith('/api/files/')) {
      // /api/files/audio/xxx.wav -> http://host:port/api/uploads/audio/xxx.wav
      // 临时方案：将 /api/files/ 替换为 /api/uploads/（因为服务端可能还没重启）
      const baseURL = uploadsBaseURL.replace(/\/uploads$/, '').replace(/\/$/, '');
      const fixedPath = call.recordUrl.replace('/api/files/', '/api/uploads/');
      audioUrl = `${baseURL}${fixedPath}`;
    } else if (call.recordUrl.startsWith('/api/')) {
      // 其他 /api/ 开头的路径
      const baseURL = uploadsBaseURL.replace(/\/uploads$/, '').replace(/\/$/, '');
      audioUrl = `${baseURL}${call.recordUrl}`;
    } else if (call.recordUrl.startsWith('/media/')) {
      // /media/xxx.wav -> http://host:port/uploads/xxx.wav
      audioUrl = call.recordUrl.replace('/media/', `${uploadsBaseURL}/`);
    } else {
      // 其他相对路径，直接拼接到 uploads
      audioUrl = `${uploadsBaseURL}/${call.recordUrl}`;
    }
    console.log('=== 录音信息 ===');
    console.log('原始 recordUrl:', call.recordUrl);
    console.log('处理后 audioUrl:', audioUrl);
    console.log('uploadsBaseURL:', uploadsBaseURL);
  } else {
    console.log('=== 无录音 ===');
    console.log('call.recordUrl 为空');
  }

  return (
    <MainLayout
      navBarProps={{
        title: '通话详情',
        leftIcon: 'arrow-left',
        onLeftPress: () => navigation.goBack(),
      }}
      backgroundColor="#f8fafc"
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 通话基本信息 */}
        <Card style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={[styles.statusBadge, { backgroundColor: `${statusInfo.color}15` }]}>
              <Text style={[styles.statusText, { color: statusInfo.color }]}>
                {statusInfo.text}
              </Text>
            </View>
            <View style={styles.directionBadge}>
              <Feather
                name={call.direction === 'inbound' ? 'phone-incoming' : 'phone-outgoing'}
                size={14}
                color="#64748b"
              />
              <Text style={styles.directionText}>
                {call.direction === 'inbound' ? '呼入' : '呼出'}
              </Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>通话号码</Text>
            <Text style={styles.infoValue}>
              {call.direction === 'inbound'
                ? call.fromUsername || call.fromUri || '未知'
                : call.toUsername || call.toUri || '未知'}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>开始时间</Text>
            <Text style={styles.infoValue}>{formatDateTime(call.startTime)}</Text>
          </View>

          {call.answerTime && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>接通时间</Text>
              <Text style={styles.infoValue}>{formatDateTime(call.answerTime)}</Text>
            </View>
          )}

          {call.endTime && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>结束时间</Text>
              <Text style={styles.infoValue}>{formatDateTime(call.endTime)}</Text>
            </View>
          )}

          {call.duration > 0 && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>通话时长</Text>
              <Text style={styles.infoValue}>{formatDuration(call.duration)}</Text>
            </View>
          )}

          {call.errorMessage && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>错误信息</Text>
              <Text style={[styles.infoValue, styles.errorText]}>{call.errorMessage}</Text>
            </View>
          )}
        </Card>

        {/* 通话录音 */}
        {call.recordUrl && (
          <Card style={styles.card}>
            <View style={styles.sectionHeader}>
              <Feather name="mic" size={18} color="#1e293b" />
              <Text style={styles.sectionTitle}>通话录音</Text>
            </View>
            <CallAudioPlayer
              callId={call.callId}
              audioUrl={audioUrl}
              hasAudio={true}
              durationSeconds={call.duration}
              style={styles.audioPlayer}
            />
          </Card>
        )}

        {/* 语音转文字 */}
        {call.recordUrl && (
          <Card style={styles.card}>
            <View style={styles.sectionHeader}>
              <Feather name="file-text" size={18} color="#1e293b" />
              <Text style={styles.sectionTitle}>语音转文字</Text>
              {!transcription && !call.transcription && (
                <TouchableOpacity
                  style={styles.transcribeButton}
                  onPress={handleTranscribe}
                  disabled={isTranscribing}
                  activeOpacity={0.7}
                >
                  {isTranscribing ? (
                    <ActivityIndicator size="small" color="#a855f7" />
                  ) : (
                    <>
                      <Feather name="zap" size={14} color="#a855f7" />
                      <Text style={styles.transcribeButtonText}>转录</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {transcription || call.transcription ? (
              <View style={styles.transcriptionContainer}>
                <Text style={styles.transcriptionText}>
                  {transcription || call.transcription}
                </Text>
              </View>
            ) : (
              <View style={styles.emptyTranscription}>
                <Feather name="message-square" size={32} color="#cbd5e1" />
                <Text style={styles.emptyText}>
                  {isTranscribing ? '正在转录中...' : '点击"转录"按钮将语音转换为文字'}
                </Text>
              </View>
            )}
          </Card>
        )}

        {/* 技术信息 */}
        <Card style={styles.card}>
          <View style={styles.sectionHeader}>
            <Feather name="info" size={18} color="#1e293b" />
            <Text style={styles.sectionTitle}>技术信息</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Call ID</Text>
            <Text style={[styles.infoValue, styles.monoText]} numberOfLines={1}>
              {call.callId}
            </Text>
          </View>

          {call.fromIp && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>主叫 IP</Text>
              <Text style={styles.infoValue}>{call.fromIp}</Text>
            </View>
          )}

          {call.toIp && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>被叫 IP</Text>
              <Text style={styles.infoValue}>{call.toIp}</Text>
            </View>
          )}

          {call.localRtpAddr && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>本地 RTP</Text>
              <Text style={[styles.infoValue, styles.monoText]}>{call.localRtpAddr}</Text>
            </View>
          )}

          {call.remoteRtpAddr && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>远程 RTP</Text>
              <Text style={[styles.infoValue, styles.monoText]}>{call.remoteRtpAddr}</Text>
            </View>
          )}
        </Card>

        {/* 备注 */}
        {call.notes && (
          <Card style={styles.card}>
            <View style={styles.sectionHeader}>
              <Feather name="edit-3" size={18} color="#1e293b" />
              <Text style={styles.sectionTitle}>备注</Text>
            </View>
            <Text style={styles.notesText}>{call.notes}</Text>
          </Card>
        )}
      </ScrollView>
    </MainLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 12,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  card: {
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '600',
  },
  directionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
  },
  directionText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  infoLabel: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '400',
    flex: 2,
    textAlign: 'right',
  },
  errorText: {
    color: '#ef4444',
  },
  monoText: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  transcribeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#f3e8ff',
  },
  transcribeButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#a855f7',
  },
  audioPlayer: {
    marginTop: 0,
  },
  transcriptionContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    padding: 16,
  },
  transcriptionText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#1e293b',
  },
  emptyTranscription: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
  notesText: {
    fontSize: 14,
    lineHeight: 22,
    color: '#475569',
  },
});

export default CallHistoryDetailScreen;

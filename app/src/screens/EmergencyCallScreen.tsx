import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';

interface EmergencyCallPlan {
  id: number;
  name: string;
  description?: string;
  enabled: boolean;
  timeWindow: number;
  missedCallThreshold: number;
  alarmSoundUrl?: string;
  alarmVolume: number;
  alarmDuration: number;
  notifyEmail: boolean;
  notifySms: boolean;
  notifyWebhook: boolean;
  webhookUrl?: string;
  createdAt: string;
}

interface EmergencyCallAlarm {
  id: number;
  planId: number;
  callerPhone?: string;
  callerIp?: string;
  callerUri?: string;
  triggeredAt: string;
  missedCallCount: number;
  timeWindowSeconds: number;
  status: 'active' | 'acknowledged' | 'resolved';
}

const EmergencyCallScreen: React.FC = () => {
  const navigation = useNavigation();
  const [plans, setPlans] = useState<EmergencyCallPlan[]>([]);
  const [alarms, setAlarms] = useState<EmergencyCallAlarm[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      await Promise.all([fetchPlans(), fetchAlarms()]);
    } catch (error) {
      console.error('获取数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPlans = async () => {
    try {
      const response = await axios.get('/api/emergency-calls/plans');
      setPlans(response.data.data || []);
    } catch (error) {
      console.error('获取方案列表失败:', error);
    }
  };

  const fetchAlarms = async () => {
    try {
      const response = await axios.get('/api/emergency-calls/alarms?status=active');
      setAlarms(response.data.data || []);
    } catch (error) {
      console.error('获取告警列表失败:', error);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const togglePlan = async (planId: number, enabled: boolean) => {
    try {
      await axios.put(`/api/emergency-calls/plans/${planId}`, { enabled: !enabled });
      fetchPlans();
    } catch (error) {
      Alert.alert('错误', '更新方案失败');
    }
  };

  const deletePlan = (planId: number) => {
    Alert.alert(
      '确认删除',
      '确定要删除此紧急呼叫方案吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await axios.delete(`/api/emergency-calls/plans/${planId}`);
              fetchPlans();
            } catch (error) {
              Alert.alert('错误', '删除方案失败');
            }
          },
        },
      ]
    );
  };

  const acknowledgeAlarm = async (alarmId: number) => {
    try {
      await axios.post(`/api/emergency-calls/alarms/${alarmId}/acknowledge`);
      fetchAlarms();
    } catch (error) {
      Alert.alert('错误', '确认告警失败');
    }
  };

  const resolveAlarm = async (alarmId: number) => {
    try {
      await axios.post(`/api/emergency-calls/alarms/${alarmId}/resolve`);
      fetchAlarms();
    } catch (error) {
      Alert.alert('错误', '解决告警失败');
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    return `${minutes}分钟`;
  };

  if (loading && plans.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* 活动告警 */}
      {alarms.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🚨 活动告警</Text>
          {alarms.map((alarm) => (
            <View key={alarm.id} style={styles.alarmCard}>
              <View style={styles.alarmHeader}>
                <Text style={styles.alarmTitle}>紧急告警 #{alarm.id}</Text>
                <View style={styles.alarmBadge}>
                  <Text style={styles.alarmBadgeText}>活动中</Text>
                </View>
              </View>
              <Text style={styles.alarmText}>
                来电: {alarm.callerPhone || alarm.callerIp || alarm.callerUri}
              </Text>
              <Text style={styles.alarmText}>
                未接次数: {alarm.missedCallCount} 次（{formatTime(alarm.timeWindowSeconds)}内）
              </Text>
              <Text style={styles.alarmTime}>
                触发时间: {new Date(alarm.triggeredAt).toLocaleString('zh-CN')}
              </Text>
              <View style={styles.alarmActions}>
                <TouchableOpacity
                  style={[styles.button, styles.acknowledgeButton]}
                  onPress={() => acknowledgeAlarm(alarm.id)}
                >
                  <Text style={styles.buttonText}>确认</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.button, styles.resolveButton]}
                  onPress={() => resolveAlarm(alarm.id)}
                >
                  <Text style={styles.buttonText}>解决</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      )}

      {/* 方案列表 */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>紧急呼叫方案</Text>
          <TouchableOpacity
            style={styles.addButton}
            onPress={() => navigation.navigate('CreateEmergencyPlan' as never)}
          >
            <Ionicons name="add-circle" size={28} color="#007AFF" />
          </TouchableOpacity>
        </View>

        {plans.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="alert-circle-outline" size={64} color="#999" />
            <Text style={styles.emptyText}>暂无紧急呼叫方案</Text>
            <Text style={styles.emptySubtext}>点击右上角 + 创建新方案</Text>
          </View>
        ) : (
          plans.map((plan) => (
            <View key={plan.id} style={styles.planCard}>
              <View style={styles.planHeader}>
                <View style={styles.planTitleContainer}>
                  <Text style={styles.planTitle}>{plan.name}</Text>
                  {plan.enabled ? (
                    <View style={styles.enabledBadge}>
                      <Text style={styles.enabledBadgeText}>已启用</Text>
                    </View>
                  ) : (
                    <View style={styles.disabledBadge}>
                      <Text style={styles.disabledBadgeText}>已禁用</Text>
                    </View>
                  )}
                </View>
              </View>

              {plan.description && (
                <Text style={styles.planDescription}>{plan.description}</Text>
              )}

              <View style={styles.planDetails}>
                <View style={styles.detailRow}>
                  <Ionicons name="time-outline" size={16} color="#666" />
                  <Text style={styles.detailText}>
                    时间窗口: {formatTime(plan.timeWindow)}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="call-outline" size={16} color="#666" />
                  <Text style={styles.detailText}>
                    未接阈值: {plan.missedCallThreshold} 次
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="volume-high-outline" size={16} color="#666" />
                  <Text style={styles.detailText}>音量: {plan.alarmVolume}%</Text>
                </View>
                <View style={styles.detailRow}>
                  <Ionicons name="timer-outline" size={16} color="#666" />
                  <Text style={styles.detailText}>时长: {plan.alarmDuration}秒</Text>
                </View>
                {plan.alarmSoundUrl && (
                  <View style={styles.detailRow}>
                    <Ionicons name="musical-notes" size={16} color="#4CAF50" />
                    <Text style={[styles.detailText, { color: '#4CAF50' }]}>
                      已上传闹铃音频
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.planActions}>
                <TouchableOpacity
                  style={[styles.actionButton, styles.toggleButton]}
                  onPress={() => togglePlan(plan.id, plan.enabled)}
                >
                  <Ionicons
                    name={plan.enabled ? 'pause-circle' : 'play-circle'}
                    size={20}
                    color="#fff"
                  />
                  <Text style={styles.actionButtonText}>
                    {plan.enabled ? '禁用' : '启用'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.editButton]}
                  onPress={() =>
                    navigation.navigate('EditEmergencyPlan' as never, { planId: plan.id } as never)
                  }
                >
                  <Ionicons name="create-outline" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>编辑</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => deletePlan(plan.id)}
                >
                  <Ionicons name="trash-outline" size={20} color="#fff" />
                  <Text style={styles.actionButtonText}>删除</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    padding: 4,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#ccc',
    marginTop: 8,
  },
  alarmCard: {
    backgroundColor: '#FFF3E0',
    borderLeftWidth: 4,
    borderLeftColor: '#FF5722',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 8,
  },
  alarmHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  alarmTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#D84315',
  },
  alarmBadge: {
    backgroundColor: '#FF5722',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  alarmBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  alarmText: {
    fontSize: 14,
    color: '#333',
    marginBottom: 4,
  },
  alarmTime: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  alarmActions: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  button: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
  },
  acknowledgeButton: {
    backgroundColor: '#FF9800',
  },
  resolveButton: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  planCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  planHeader: {
    marginBottom: 8,
  },
  planTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  enabledBadge: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  enabledBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  disabledBadge: {
    backgroundColor: '#999',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  disabledBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  planDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  planDetails: {
    marginBottom: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#666',
  },
  planActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    borderRadius: 6,
    gap: 4,
  },
  toggleButton: {
    backgroundColor: '#2196F3',
  },
  editButton: {
    backgroundColor: '#FF9800',
  },
  deleteButton: {
    backgroundColor: '#F44336',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
});

export default EmergencyCallScreen;

/**
 * 告警规则列表页面 - 完整版
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { MainLayout, Card, EmptyState } from '../components';
import {
  getAlertRules,
  deleteAlertRule,
  AlertRule,
  AlertType,
  AlertSeverity,
  NotificationChannel,
} from '../services/api/alert';

const AlertRulesScreen: React.FC = () => {
  const navigation = useNavigation();
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadRules();
  }, []);

  const loadRules = async () => {
    setIsLoading(true);
    try {
      const response = await getAlertRules();
      if (response.code === 200 && response.data) {
        setRules(response.data);
      }
    } catch (error: any) {
      console.error('Load alert rules error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadRules();
    setIsRefreshing(false);
  };

  const handleDelete = async (id: number) => {
    Alert.alert(
      '确认删除',
      '确定要删除这条告警规则吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await deleteAlertRule(id);
              if (response.code === 200) {
                Alert.alert('成功', '告警规则已删除');
                loadRules();
              }
            } catch (error: any) {
              console.error('Delete alert rule error:', error);
              Alert.alert('错误', '删除失败');
            }
          },
        },
      ]
    );
  };

  const getTypeLabel = (type: AlertType) => {
    const labels: Record<AlertType, string> = {
      system_error: '系统错误',
      quota_exceeded: '配额超限',
      service_error: '服务错误',
      custom: '自定义',
    };
    return labels[type] || type;
  };

  const getSeverityLabel = (severity: AlertSeverity) => {
    const labels: Record<AlertSeverity, string> = {
      critical: '严重',
      high: '高',
      medium: '中',
      low: '低',
    };
    return labels[severity] || severity;
  };

  const getSeverityColor = (severity: AlertSeverity) => {
    switch (severity) {
      case 'critical':
        return { bg: '#fee2e2', text: '#991b1b' };
      case 'high':
        return { bg: '#fed7aa', text: '#9a3412' };
      case 'medium':
        return { bg: '#fef3c7', text: '#854d0e' };
      case 'low':
        return { bg: '#dbeafe', text: '#1e40af' };
      default:
        return { bg: '#f1f5f9', text: '#475569' };
    }
  };

  const parseChannels = (channelsStr: string): NotificationChannel[] => {
    try {
      return JSON.parse(channelsStr);
    } catch {
      return [];
    }
  };

  const getChannelLabel = (channel: NotificationChannel) => {
    const labels: Record<NotificationChannel, string> = {
      email: '邮件',
      internal: '站内',
      webhook: 'Webhook',
      sms: '短信',
    };
    return labels[channel] || channel;
  };

  return (
    <MainLayout
      navBarProps={{
        title: '告警规则',
        leftIcon: 'arrow-left',
        onLeftPress: () => navigation.goBack(),
        rightIcon: 'plus',
        onRightPress: () => navigation.navigate('AlertRuleForm' as never, { mode: 'create' } as never),
      }}
      backgroundColor="#f8fafc"
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#a78bfa" />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        ) : rules.length === 0 ? (
          <EmptyState
            title="暂无告警规则"
            description="创建第一条告警规则，及时获取系统通知"
            icon={<Feather name="bell" size={64} color="#a78bfa" />}
            action={{
              label: '创建规则',
              onPress: () => navigation.navigate('AlertRuleForm' as never, { mode: 'create' } as never),
            }}
          />
        ) : (
          rules.map((rule) => {
            const severityColor = getSeverityColor(rule.severity);
            const channels = parseChannels(rule.channels);

            return (
              <Card
                key={rule.id}
                variant="elevated"
                padding="md"
                style={styles.ruleCard}
              >
                <View style={styles.ruleHeader}>
                  <View style={styles.ruleTitleRow}>
                    <Text style={styles.ruleTitle} numberOfLines={1}>
                      {rule.name}
                    </Text>
                    <Feather
                      name={rule.enabled ? 'toggle-right' : 'toggle-left'}
                      size={24}
                      color={rule.enabled ? '#10b981' : '#94a3b8'}
                    />
                  </View>
                  {rule.description && (
                    <Text style={styles.ruleDescription} numberOfLines={2}>
                      {rule.description}
                    </Text>
                  )}
                </View>

                <View style={styles.ruleInfo}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>类型</Text>
                    <Text style={styles.infoValue}>{getTypeLabel(rule.alertType)}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>严重程度</Text>
                    <View style={[styles.badge, { backgroundColor: severityColor.bg }]}>
                      <Text style={[styles.badgeText, { color: severityColor.text }]}>
                        {getSeverityLabel(rule.severity)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>通知渠道</Text>
                    <View style={styles.channelList}>
                      {channels.map((channel, idx) => (
                        <View key={idx} style={styles.channelBadge}>
                          <Text style={styles.channelText}>{getChannelLabel(channel)}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>触发次数</Text>
                    <Text style={styles.infoValue}>{rule.triggerCount}</Text>
                  </View>
                  {rule.lastTriggerAt && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>最后触发</Text>
                      <Text style={styles.infoValue}>
                        {new Date(rule.lastTriggerAt).toLocaleString()}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.ruleFooter}>
                  <Text style={styles.footerText}>
                    创建于 {new Date(rule.createdAt).toLocaleString()}
                  </Text>
                  <View style={styles.ruleActions}>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() =>
                        navigation.navigate('AlertRuleForm' as never, {
                          mode: 'edit',
                          ruleId: rule.id,
                        } as never)
                      }
                      activeOpacity={0.7}
                    >
                      <Feather name="edit-2" size={14} color="#64748b" />
                      <Text style={styles.actionButtonText}>编辑</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionButton}
                      onPress={() => handleDelete(rule.id)}
                      activeOpacity={0.7}
                    >
                      <Feather name="trash-2" size={14} color="#ef4444" />
                      <Text style={[styles.actionButtonText, { color: '#ef4444' }]}>删除</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>
            );
          })
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
  },
  loadingContainer: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  ruleCard: {
    marginBottom: 12,
  },
  ruleHeader: {
    marginBottom: 12,
  },
  ruleTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  ruleTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  ruleDescription: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  ruleInfo: {
    gap: 8,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  infoLabel: {
    fontSize: 12,
    color: '#94a3b8',
  },
  infoValue: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1e293b',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  channelList: {
    flexDirection: 'row',
    gap: 4,
  },
  channelBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: '#f1f5f9',
  },
  channelText: {
    fontSize: 11,
    color: '#64748b',
  },
  ruleFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  footerText: {
    fontSize: 11,
    color: '#94a3b8',
  },
  ruleActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#f8fafc',
  },
  actionButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
  },
});

export default AlertRulesScreen;

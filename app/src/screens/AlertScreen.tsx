/**
 * 告警列表页面 - 完整版
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
  Alert as RNAlert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { MainLayout, Card, EmptyState } from '../components';
import {
  getAlerts,
  resolveAlert,
  muteAlert,
  Alert,
  AlertStatus,
  AlertType,
} from '../services/api/alert';

const AlertScreen: React.FC = () => {
  const navigation = useNavigation();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 20;
  const [statusFilter, setStatusFilter] = useState<AlertStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<AlertType | ''>('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadAlerts();
  }, [page, statusFilter, typeFilter]);

  const loadAlerts = async () => {
    setIsLoading(true);
    try {
      const params: any = { page, pageSize };
      if (statusFilter) params.status = statusFilter;
      if (typeFilter) params.alertType = typeFilter;

      const response = await getAlerts(params);
      if (response.code === 200 && response.data) {
        setAlerts(response.data.list || []);
        setTotal(response.data.total || 0);
        setTotalPages(Math.ceil((response.data.total || 0) / pageSize));
      }
    } catch (error: any) {
      console.error('Load alerts error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setPage(1);
    await loadAlerts();
    setIsRefreshing(false);
  };

  const handleResolve = async (id: number) => {
    try {
      const response = await resolveAlert(id);
      if (response.code === 200) {
        RNAlert.alert('成功', '告警已解决');
        loadAlerts();
      }
    } catch (error: any) {
      console.error('Resolve alert error:', error);
      RNAlert.alert('错误', '操作失败');
    }
  };

  const handleMute = async (id: number) => {
    try {
      const response = await muteAlert(id);
      if (response.code === 200) {
        RNAlert.alert('成功', '告警已静音');
        loadAlerts();
      }
    } catch (error: any) {
      console.error('Mute alert error:', error);
      RNAlert.alert('错误', '操作失败');
    }
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return { name: 'alert-triangle' as const, color: '#ef4444' };
      case 'high':
        return { name: 'alert-circle' as const, color: '#f97316' };
      case 'medium':
        return { name: 'info' as const, color: '#eab308' };
      case 'low':
        return { name: 'info' as const, color: '#3b82f6' };
      default:
        return { name: 'bell' as const, color: '#64748b' };
    }
  };

  const getSeverityColor = (severity: string) => {
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

  const getStatusColor = (status: AlertStatus) => {
    switch (status) {
      case 'active':
        return { bg: '#fee2e2', text: '#991b1b' };
      case 'resolved':
        return { bg: '#d1fae5', text: '#065f46' };
      case 'muted':
        return { bg: '#f1f5f9', text: '#475569' };
      default:
        return { bg: '#f1f5f9', text: '#475569' };
    }
  };

  const getStatusLabel = (status: AlertStatus) => {
    const labels: Record<AlertStatus, string> = {
      active: '活跃',
      resolved: '已解决',
      muted: '已静音',
    };
    return labels[status] || status;
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

  return (
    <MainLayout
      navBarProps={{
        title: '告警管理',
        leftIcon: 'arrow-left',
        onLeftPress: () => navigation.goBack(),
        rightIcon: 'settings',
        onRightPress: () => navigation.navigate('AlertRules' as never),
      }}
      backgroundColor="#f8fafc"
    >
      <View style={styles.container}>
        {/* 过滤器 */}
        <View style={styles.filterContainer}>
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>状态</Text>
            <View style={styles.filterButtons}>
              <TouchableOpacity
                style={[styles.filterButton, statusFilter === '' && styles.filterButtonActive]}
                onPress={() => {
                  setStatusFilter('');
                  setPage(1);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterButtonText, statusFilter === '' && styles.filterButtonTextActive]}>
                  全部
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterButton, statusFilter === 'active' && styles.filterButtonActive]}
                onPress={() => {
                  setStatusFilter('active');
                  setPage(1);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterButtonText, statusFilter === 'active' && styles.filterButtonTextActive]}>
                  活跃
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterButton, statusFilter === 'resolved' && styles.filterButtonActive]}
                onPress={() => {
                  setStatusFilter('resolved');
                  setPage(1);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterButtonText, statusFilter === 'resolved' && styles.filterButtonTextActive]}>
                  已解决
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterButton, statusFilter === 'muted' && styles.filterButtonActive]}
                onPress={() => {
                  setStatusFilter('muted');
                  setPage(1);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterButtonText, statusFilter === 'muted' && styles.filterButtonTextActive]}>
                  已静音
                </Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.filterRow}>
            <Text style={styles.filterLabel}>类型</Text>
            <View style={styles.filterButtons}>
              <TouchableOpacity
                style={[styles.filterButton, typeFilter === '' && styles.filterButtonActive]}
                onPress={() => {
                  setTypeFilter('');
                  setPage(1);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterButtonText, typeFilter === '' && styles.filterButtonTextActive]}>
                  全部
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterButton, typeFilter === 'quota_exceeded' && styles.filterButtonActive]}
                onPress={() => {
                  setTypeFilter('quota_exceeded');
                  setPage(1);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterButtonText, typeFilter === 'quota_exceeded' && styles.filterButtonTextActive]}>
                  配额
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterButton, typeFilter === 'system_error' && styles.filterButtonActive]}
                onPress={() => {
                  setTypeFilter('system_error');
                  setPage(1);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterButtonText, typeFilter === 'system_error' && styles.filterButtonTextActive]}>
                  系统
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterButton, typeFilter === 'service_error' && styles.filterButtonActive]}
                onPress={() => {
                  setTypeFilter('service_error');
                  setPage(1);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.filterButtonText, typeFilter === 'service_error' && styles.filterButtonTextActive]}>
                  服务
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* 告警列表 */}
        <ScrollView
          style={styles.listContainer}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
        >
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#a78bfa" />
              <Text style={styles.loadingText}>加载中...</Text>
            </View>
          ) : alerts.length === 0 ? (
            <EmptyState
              title="暂无告警"
              description="当前没有符合条件的告警"
              icon={<Feather name="bell" size={64} color="#a78bfa" />}
            />
          ) : (
            <>
              {alerts.map((alert) => {
                const severityIcon = getSeverityIcon(alert.severity);
                const severityColor = getSeverityColor(alert.severity);
                const statusColor = getStatusColor(alert.status);

                return (
                  <Card
                    key={alert.id}
                    variant="elevated"
                    padding="md"
                    style={styles.alertCard}
                  >
                    <View style={styles.alertHeader}>
                      <View style={styles.alertTitleRow}>
                        <Feather name={severityIcon.name} size={18} color={severityIcon.color} />
                        <Text style={styles.alertTitle} numberOfLines={1}>
                          {alert.title}
                        </Text>
                      </View>
                      <View style={styles.badgeRow}>
                        <View style={[styles.badge, { backgroundColor: severityColor.bg }]}>
                          <Text style={[styles.badgeText, { color: severityColor.text }]}>
                            {alert.severity}
                          </Text>
                        </View>
                        <View style={[styles.badge, { backgroundColor: statusColor.bg }]}>
                          <Text style={[styles.badgeText, { color: statusColor.text }]}>
                            {getStatusLabel(alert.status)}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <Text style={styles.alertMessage} numberOfLines={2}>
                      {alert.message}
                    </Text>

                    <View style={styles.alertMeta}>
                      <View style={styles.metaItem}>
                        <Text style={styles.metaLabel}>类型：</Text>
                        <Text style={styles.metaValue}>{getTypeLabel(alert.alertType)}</Text>
                      </View>
                      <View style={styles.metaItem}>
                        <Text style={styles.metaLabel}>时间：</Text>
                        <Text style={styles.metaValue}>
                          {new Date(alert.createdAt).toLocaleString()}
                        </Text>
                      </View>
                      {alert.notified && (
                        <View style={styles.metaItem}>
                          <Feather name="check-circle" size={12} color="#10b981" />
                          <Text style={[styles.metaValue, { color: '#10b981' }]}>已通知</Text>
                        </View>
                      )}
                    </View>

                    {alert.status === 'active' && (
                      <View style={styles.alertActions}>
                        <TouchableOpacity
                          style={[styles.actionButton, { backgroundColor: '#d1fae5' }]}
                          onPress={() => handleResolve(alert.id)}
                          activeOpacity={0.7}
                        >
                          <Feather name="check-circle" size={14} color="#065f46" />
                          <Text style={[styles.actionButtonText, { color: '#065f46' }]}>解决</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButton, { backgroundColor: '#f1f5f9' }]}
                          onPress={() => handleMute(alert.id)}
                          activeOpacity={0.7}
                        >
                          <Feather name="volume-x" size={14} color="#475569" />
                          <Text style={[styles.actionButtonText, { color: '#475569' }]}>静音</Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </Card>
                );
              })}

              {/* 分页 */}
              {totalPages > 1 && (
                <View style={styles.pagination}>
                  <TouchableOpacity
                    style={[styles.pageButton, page === 1 && styles.pageButtonDisabled]}
                    onPress={() => setPage(Math.max(1, page - 1))}
                    disabled={page === 1}
                    activeOpacity={0.7}
                  >
                    <Feather name="chevron-left" size={16} color="#64748b" />
                  </TouchableOpacity>
                  <Text style={styles.pageText}>
                    {page} / {totalPages}
                  </Text>
                  <TouchableOpacity
                    style={[styles.pageButton, page === totalPages && styles.pageButtonDisabled]}
                    onPress={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages}
                    activeOpacity={0.7}
                  >
                    <Feather name="chevron-right" size={16} color="#64748b" />
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>
    </MainLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  filterContainer: {
    backgroundColor: '#ffffff',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  filterRow: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
    marginBottom: 8,
  },
  filterButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
  },
  filterButtonActive: {
    backgroundColor: '#a78bfa',
  },
  filterButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
  },
  filterButtonTextActive: {
    color: '#ffffff',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
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
  alertCard: {
    marginBottom: 12,
  },
  alertHeader: {
    marginBottom: 8,
  },
  alertTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  alertTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 6,
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
  alertMessage: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 8,
  },
  alertMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94a3b8',
  },
  metaValue: {
    fontSize: 11,
    color: '#64748b',
  },
  alertActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
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
  actionButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 20,
  },
  pageButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageButtonDisabled: {
    opacity: 0.3,
  },
  pageText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
});

export default AlertScreen;

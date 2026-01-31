/**
 * 通话记录标签页
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { EmptyState } from '../../components';
import * as sipApi from '../../services/api/sip';

type SipCall = sipApi.SipCall;
type CallHistoryParams = sipApi.CallHistoryParams;

const CallHistoryTab: React.FC = () => {
  const navigation = useNavigation();
  const [calls, setCalls] = useState<SipCall[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [filter, setFilter] = useState<'all' | 'answered' | 'failed'>('all');

  // 加载通话记录
  const loadCalls = useCallback(async (pageNum: number = 1, refresh: boolean = false) => {
    if (refresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }

    try {
      const params: CallHistoryParams = {
        page: pageNum,
        limit: 20,
      };

      if (filter !== 'all') {
        params.status = filter;
      }

      const response = await sipApi.getCallHistory(params);
      
      if (response.code === 200 && response.data) {
        const newCalls = response.data.list || [];
        
        console.log('=== 通话记录加载成功 ===');
        console.log('记录数量:', newCalls.length);
        if (newCalls.length > 0) {
          console.log('第一条记录:', JSON.stringify(newCalls[0], null, 2));
          console.log('是否有录音:', !!newCalls[0].recordUrl);
        }
        
        if (refresh || pageNum === 1) {
          setCalls(newCalls);
        } else {
          setCalls((prev) => [...prev, ...newCalls]);
        }

        setHasMore(newCalls.length === params.limit);
        setPage(pageNum);
      } else {
        Alert.alert('错误', response.msg || '加载通话记录失败');
      }
    } catch (error: any) {
      console.error('Load calls error:', error);
      if (error.code !== 401) {
        Alert.alert('错误', error.msg || '加载通话记录失败');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    loadCalls(1, false);
  }, [filter]);

  // 下拉刷新
  const handleRefresh = () => {
    loadCalls(1, true);
  };

  // 加载更多
  const handleLoadMore = () => {
    if (!isLoading && hasMore) {
      loadCalls(page + 1, false);
    }
  };

  // 格式化时长
  const formatDuration = (seconds: number) => {
    if (seconds === 0) return '-';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 格式化时间
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else if (days === 1) {
      return '昨天 ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
    } else if (days < 7) {
      return `${days}天前`;
    } else {
      return date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
    }
  };

  // 获取状态信息
  const getStatusInfo = (call: SipCall) => {
    switch (call.status) {
      case 'answered':
      case 'ended':
        return {
          icon: 'phone',
          color: '#10b981',
          text: '已接通',
        };
      case 'failed':
        return {
          icon: 'phone-missed',
          color: '#ef4444',
          text: '未接通',
        };
      case 'cancelled':
        return {
          icon: 'phone-off',
          color: '#f59e0b',
          text: '已取消',
        };
      case 'calling':
      case 'ringing':
        return {
          icon: 'phone-call',
          color: '#3b82f6',
          text: '呼叫中',
        };
      default:
        return {
          icon: 'phone',
          color: '#64748b',
          text: call.status,
        };
    }
  };

  // 获取方向图标
  const getDirectionIcon = (direction: string) => {
    return direction === 'inbound' ? 'phone-incoming' : 'phone-outgoing';
  };

  return (
    <View style={styles.container}>
      {/* 筛选器 */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
          onPress={() => setFilter('all')}
          activeOpacity={0.7}
        >
          <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
            全部
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'answered' && styles.filterButtonActive]}
          onPress={() => setFilter('answered')}
          activeOpacity={0.7}
        >
          <Text style={[styles.filterText, filter === 'answered' && styles.filterTextActive]}>
            已接通
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filter === 'failed' && styles.filterButtonActive]}
          onPress={() => setFilter('failed')}
          activeOpacity={0.7}
        >
          <Text style={[styles.filterText, filter === 'failed' && styles.filterTextActive]}>
            未接通
          </Text>
        </TouchableOpacity>
      </View>

      {/* 通话记录列表 */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const isCloseToBottom =
            layoutMeasurement.height + contentOffset.y >= contentSize.height - 20;
          if (isCloseToBottom) {
            handleLoadMore();
          }
        }}
        scrollEventThrottle={400}
      >
        {isLoading && page === 1 ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#a855f7" />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        ) : calls.length === 0 ? (
          <EmptyState
            title="暂无通话记录"
            description="还没有通话记录，开始您的第一次通话吧"
            icon={<Feather name="phone" size={64} color="#a855f7" />}
          />
        ) : (
          <>
            {calls.map((call) => {
              const statusInfo = getStatusInfo(call);
              const directionIcon = getDirectionIcon(call.direction);

              return (
                <TouchableOpacity
                  key={call.id}
                  style={styles.callCard}
                  onPress={() => {
                    navigation.navigate('CallHistoryDetail' as never, {
                      callId: call.callId,
                    } as never);
                  }}
                  activeOpacity={0.7}
                >
                  {/* 左侧图标 */}
                  <View style={[styles.iconContainer, { backgroundColor: `${statusInfo.color}15` }]}>
                    <Feather name={directionIcon as any} size={20} color={statusInfo.color} />
                  </View>

                  {/* 中间信息 */}
                  <View style={styles.callInfo}>
                    <View style={styles.callHeader}>
                      <Text style={styles.callNumber} numberOfLines={1}>
                        {call.direction === 'inbound'
                          ? call.fromUsername || call.fromUri || '未知号码'
                          : call.toUsername || call.toUri || '未知号码'}
                      </Text>
                      <View style={[styles.statusBadge, { backgroundColor: `${statusInfo.color}15` }]}>
                        <Text style={[styles.statusText, { color: statusInfo.color }]}>
                          {statusInfo.text}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.callMeta}>
                      <Text style={styles.metaText}>
                        {formatTime(call.startTime)}
                      </Text>
                      {call.duration > 0 && (
                        <>
                          <Text style={styles.metaDot}>•</Text>
                          <Text style={styles.metaText}>
                            {formatDuration(call.duration)}
                          </Text>
                        </>
                      )}
                      {call.recordUrl && (
                        <>
                          <Text style={styles.metaDot}>•</Text>
                          <Feather name="mic" size={12} color="#64748b" />
                        </>
                      )}
                    </View>
                  </View>

                  {/* 右侧箭头 */}
                  <Feather name="chevron-right" size={20} color="#cbd5e1" />
                </TouchableOpacity>
              );
            })}

            {/* 加载更多指示器 */}
            {isLoading && page > 1 && (
              <View style={styles.loadMoreContainer}>
                <ActivityIndicator size="small" color="#a855f7" />
                <Text style={styles.loadMoreText}>加载更多...</Text>
              </View>
            )}

            {!hasMore && calls.length > 0 && (
              <View style={styles.noMoreContainer}>
                <Text style={styles.noMoreText}>没有更多记录了</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#f3e8ff',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  filterTextActive: {
    color: '#a855f7',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 12,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  callCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  callInfo: {
    flex: 1,
    minWidth: 0,
  },
  callHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 8,
  },
  callNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  callMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaText: {
    fontSize: 12,
    color: '#64748b',
  },
  metaDot: {
    fontSize: 12,
    color: '#cbd5e1',
  },
  loadMoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  loadMoreText: {
    fontSize: 14,
    color: '#64748b',
  },
  noMoreContainer: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  noMoreText: {
    fontSize: 14,
    color: '#94a3b8',
  },
});

export default CallHistoryTab;

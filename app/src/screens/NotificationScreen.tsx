/**
 * 通知中心页面 - 完整版
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
  Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { MainLayout, Card, EmptyState } from '../components';
import {
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  batchDeleteNotifications,
  getAllNotificationIds,
  Notification,
} from '../services/api/notification';

type FilterType = 'all' | 'unread' | 'read';

const NotificationScreen: React.FC = () => {
  const navigation = useNavigation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>('all');
  const [total, setTotal] = useState(0);
  const [totalUnread, setTotalUnread] = useState(0);
  const [totalRead, setTotalRead] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const pageSize = 20;
  
  // 批量选择
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  
  // 详情抽屉
  const [showDetail, setShowDetail] = useState(false);
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);

  useEffect(() => {
    loadNotifications();
  }, [filter, currentPage]);

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const response = await getNotifications({
        page: currentPage,
        size: pageSize,
        filter: filter,
      });
      if (response.code === 200 && response.data) {
        setNotifications(response.data.list || []);
        setTotal(response.data.total || 0);
        setTotalUnread(response.data.totalUnread || 0);
        setTotalRead(response.data.totalRead || 0);
        setTotalPages(Math.ceil((response.data.total || 0) / pageSize));
      }
    } catch (error: any) {
      console.error('Load notifications error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    setCurrentPage(1);
    await loadNotifications();
    setIsRefreshing(false);
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      const response = await markNotificationAsRead(id);
      if (response.code === 200) {
        loadNotifications();
      }
    } catch (error: any) {
      console.error('Mark as read error:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const response = await markAllNotificationsAsRead();
      if (response.code === 200) {
        Alert.alert('成功', '已标记所有通知为已读');
        loadNotifications();
      }
    } catch (error: any) {
      console.error('Mark all as read error:', error);
      Alert.alert('错误', '操作失败');
    }
  };

  const handleDelete = async (id: number) => {
    Alert.alert(
      '确认删除',
      '确定要删除这条通知吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await deleteNotification(id);
              if (response.code === 200) {
                loadNotifications();
              }
            } catch (error: any) {
              console.error('Delete notification error:', error);
              Alert.alert('错误', '删除失败');
            }
          },
        },
      ]
    );
  };

  const handleSelectAll = async () => {
    if (selectedIds.length > 0) {
      setSelectedIds([]);
    } else {
      const params = { filter: filter === 'all' ? undefined : filter };
      try {
        const response = await getAllNotificationIds(params);
        if (response.code === 200 && response.data) {
          setSelectedIds(response.data.ids || []);
        }
      } catch (error: any) {
        console.error('Get all IDs error:', error);
      }
    }
  };

  const handleSelectNotification = (id: number) => {
    setSelectedIds(prev =>
      prev.includes(id)
        ? prev.filter(selectedId => selectedId !== id)
        : [...prev, id]
    );
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;

    Alert.alert(
      '确认删除',
      `确定要删除选中的 ${selectedIds.length} 条通知吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await batchDeleteNotifications(selectedIds);
              if (response.code === 200) {
                Alert.alert('成功', `已删除 ${selectedIds.length} 条通知`);
                setSelectedIds([]);
                setIsSelectMode(false);
                loadNotifications();
              }
            } catch (error: any) {
              console.error('Batch delete error:', error);
              Alert.alert('错误', '批量删除失败');
            }
          },
        },
      ]
    );
  };

  const handleBatchMarkAsRead = async () => {
    if (selectedIds.length === 0) return;

    try {
      for (const id of selectedIds) {
        await markNotificationAsRead(id);
      }
      Alert.alert('成功', `已标记 ${selectedIds.length} 条通知为已读`);
      setSelectedIds([]);
      setIsSelectMode(false);
      loadNotifications();
    } catch (error: any) {
      console.error('Batch mark as read error:', error);
      Alert.alert('错误', '批量标记失败');
    }
  };

  const openDetail = async (notification: Notification) => {
    setSelectedNotification(notification);
    setShowDetail(true);
    if (!notification.read) {
      await handleMarkAsRead(notification.id);
    }
  };

  const getTypeIcon = (type?: string) => {
    switch (type) {
      case 'success':
        return { name: 'check-circle' as const, color: '#10b981' };
      case 'warning':
        return { name: 'alert-triangle' as const, color: '#f59e0b' };
      case 'error':
        return { name: 'x-circle' as const, color: '#ef4444' };
      default:
        return { name: 'info' as const, color: '#3b82f6' };
    }
  };

  return (
    <MainLayout
      navBarProps={{
        title: '通知中心',
        leftIcon: 'arrow-left',
        onLeftPress: () => navigation.goBack(),
        rightIcon: isSelectMode ? undefined : (totalUnread > 0 ? 'check-circle' : undefined),
        onRightPress: isSelectMode ? undefined : (totalUnread > 0 ? handleMarkAllAsRead : undefined),
      }}
      backgroundColor="#f8fafc"
    >
      <View style={styles.container}>
        {/* 统计卡片 */}
        <View style={styles.statsContainer}>
          <View style={[styles.statCard, { backgroundColor: '#dbeafe' }]}>
            <Feather name="bell" size={16} color="#3b82f6" />
            <View style={styles.statInfo}>
              <Text style={[styles.statLabel, { color: '#1e40af' }]}>总数</Text>
              <Text style={[styles.statValue, { color: '#1e40af' }]}>{total}</Text>
            </View>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#fed7aa' }]}>
            <Feather name="eye-off" size={16} color="#ea580c" />
            <View style={styles.statInfo}>
              <Text style={[styles.statLabel, { color: '#9a3412' }]}>未读</Text>
              <Text style={[styles.statValue, { color: '#9a3412' }]}>{totalUnread}</Text>
            </View>
          </View>
          <View style={[styles.statCard, { backgroundColor: '#bbf7d0' }]}>
            <Feather name="eye" size={16} color="#16a34a" />
            <View style={styles.statInfo}>
              <Text style={[styles.statLabel, { color: '#14532d' }]}>已读</Text>
              <Text style={[styles.statValue, { color: '#14532d' }]}>{totalRead}</Text>
            </View>
          </View>
        </View>

        {/* 操作栏 */}
        <View style={styles.actionBar}>
          {!isSelectMode ? (
            <>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => setIsSelectMode(true)}
                activeOpacity={0.7}
              >
                <Feather name="check-square" size={16} color="#64748b" />
                <Text style={styles.actionButtonText}>选择</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  setIsSelectMode(false);
                  setSelectedIds([]);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.actionButtonText}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleSelectAll}
                activeOpacity={0.7}
              >
                <Text style={styles.actionButtonText}>
                  {selectedIds.length > 0 ? '取消全选' : '全选'}
                </Text>
              </TouchableOpacity>
              {selectedIds.length > 0 && (
                <>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#a78bfa' }]}
                    onPress={handleBatchMarkAsRead}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.actionButtonText, { color: '#ffffff' }]}>
                      标记已读 ({selectedIds.length})
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#ef4444' }]}
                    onPress={handleBatchDelete}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.actionButtonText, { color: '#ffffff' }]}>
                      删除 ({selectedIds.length})
                    </Text>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
        </View>

        {/* 筛选器 */}
        <View style={styles.filterContainer}>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
            onPress={() => {
              setFilter('all');
              setCurrentPage(1);
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
              全部 ({total})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'unread' && styles.filterButtonActive]}
            onPress={() => {
              setFilter('unread');
              setCurrentPage(1);
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterText, filter === 'unread' && styles.filterTextActive]}>
              未读 ({totalUnread})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.filterButton, filter === 'read' && styles.filterButtonActive]}
            onPress={() => {
              setFilter('read');
              setCurrentPage(1);
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterText, filter === 'read' && styles.filterTextActive]}>
              已读 ({totalRead})
            </Text>
          </TouchableOpacity>
        </View>

        {/* 通知列表 */}
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
          ) : notifications.length === 0 ? (
            <EmptyState
              title="暂无通知"
              description={
                filter === 'unread'
                  ? '没有未读通知'
                  : filter === 'read'
                  ? '没有已读通知'
                  : '还没有收到任何通知'
              }
              icon={<Feather name="bell" size={64} color="#a78bfa" />}
            />
          ) : (
            <>
              {notifications.map((notification) => {
                const typeIcon = getTypeIcon(notification.type);
                const isSelected = selectedIds.includes(notification.id);
                
                return (
                  <TouchableOpacity
                    key={notification.id}
                    activeOpacity={0.7}
                    onPress={() => {
                      if (isSelectMode) {
                        handleSelectNotification(notification.id);
                      } else {
                        openDetail(notification);
                      }
                    }}
                  >
                    <Card
                      variant="elevated"
                      padding="md"
                      style={[
                        styles.notificationCard,
                        !notification.read && styles.notificationCardUnread,
                        isSelected && styles.notificationCardSelected,
                      ]}
                    >
                      <View style={styles.notificationContent}>
                        {isSelectMode && (
                          <View style={styles.checkbox}>
                            <Feather
                              name={isSelected ? 'check-square' : 'square'}
                              size={20}
                              color={isSelected ? '#a78bfa' : '#94a3b8'}
                            />
                          </View>
                        )}
                        <View
                          style={[
                            styles.iconContainer,
                            { backgroundColor: `${typeIcon.color}15` },
                          ]}
                        >
                          <Feather name={typeIcon.name} size={18} color={typeIcon.color} />
                        </View>
                        <View style={styles.textContainer}>
                          <View style={styles.titleRow}>
                            <Text style={styles.notificationTitle} numberOfLines={1}>
                              {notification.title}
                            </Text>
                            {!notification.read && <View style={styles.unreadDot} />}
                          </View>
                          <Text style={styles.notificationText} numberOfLines={2}>
                            {notification.content}
                          </Text>
                          <Text style={styles.notificationTime}>
                            {new Date(notification.created_at).toLocaleString()}
                          </Text>
                        </View>
                        {!isSelectMode && (
                          <View style={styles.actionButtons}>
                            {!notification.read && (
                              <TouchableOpacity
                                style={styles.iconButton}
                                onPress={(e) => {
                                  e.stopPropagation();
                                  handleMarkAsRead(notification.id);
                                }}
                                activeOpacity={0.7}
                              >
                                <Feather name="check" size={14} color="#10b981" />
                              </TouchableOpacity>
                            )}
                            <TouchableOpacity
                              style={styles.iconButton}
                              onPress={(e) => {
                                e.stopPropagation();
                                handleDelete(notification.id);
                              }}
                              activeOpacity={0.7}
                            >
                              <Feather name="trash-2" size={14} color="#ef4444" />
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>
                    </Card>
                  </TouchableOpacity>
                );
              })}

              {/* 分页 */}
              {totalPages > 1 && (
                <View style={styles.pagination}>
                  <TouchableOpacity
                    style={[styles.pageButton, currentPage === 1 && styles.pageButtonDisabled]}
                    onPress={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    activeOpacity={0.7}
                  >
                    <Feather name="chevron-left" size={16} color="#64748b" />
                  </TouchableOpacity>
                  <Text style={styles.pageText}>
                    {currentPage} / {totalPages}
                  </Text>
                  <TouchableOpacity
                    style={[styles.pageButton, currentPage === totalPages && styles.pageButtonDisabled]}
                    onPress={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
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

      {/* 详情 Modal */}
      <Modal
        visible={showDetail}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDetail(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailModal}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>通知详情</Text>
              <TouchableOpacity
                onPress={() => setShowDetail(false)}
                style={styles.closeButton}
                activeOpacity={0.7}
              >
                <Feather name="x" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.detailContent}>
              {selectedNotification && (
                <>
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>标题</Text>
                    <Text style={styles.detailValue}>{selectedNotification.title}</Text>
                  </View>
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>内容</Text>
                    <Text style={styles.detailValue}>{selectedNotification.content}</Text>
                  </View>
                  <View style={styles.detailSection}>
                    <Text style={styles.detailLabel}>时间</Text>
                    <Text style={styles.detailValue}>
                      {new Date(selectedNotification.created_at).toLocaleString()}
                    </Text>
                  </View>
                  {selectedNotification.type && (
                    <View style={styles.detailSection}>
                      <Text style={styles.detailLabel}>类型</Text>
                      <Text style={styles.detailValue}>{selectedNotification.type}</Text>
                    </View>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </MainLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  statsContainer: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  statCard: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    gap: 8,
  },
  statInfo: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
  },
  actionBar: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#f1f5f9',
    gap: 4,
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
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
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#a78bfa',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
  },
  filterTextActive: {
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
  notificationCard: {
    marginBottom: 8,
  },
  notificationCardUnread: {
    backgroundColor: '#f3e8ff',
    borderLeftWidth: 3,
    borderLeftColor: '#a78bfa',
  },
  notificationCardSelected: {
    borderWidth: 2,
    borderColor: '#a78bfa',
  },
  notificationContent: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  checkbox: {
    marginRight: 8,
    paddingTop: 2,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    flexShrink: 0,
  },
  textContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  notificationTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#a78bfa',
    marginLeft: 6,
  },
  notificationText: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
    marginBottom: 4,
  },
  notificationTime: {
    fontSize: 11,
    color: '#94a3b8',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 8,
  },
  iconButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  detailModal: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  detailTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailContent: {
    padding: 20,
  },
  detailSection: {
    marginBottom: 20,
  },
  detailLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#64748b',
    marginBottom: 6,
  },
  detailValue: {
    fontSize: 15,
    color: '#1e293b',
    lineHeight: 22,
  },
});

export default NotificationScreen;

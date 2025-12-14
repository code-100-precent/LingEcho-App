/**
 * 通知中心页面
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
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { MainLayout, Card } from '../components';
import {
  getNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  deleteNotification,
  Notification,
  NotificationListResponse,
} from '../services/api/notification';

const NotificationScreen: React.FC = () => {
  const navigation = useNavigation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'read' | 'unread'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalUnread, setTotalUnread] = useState(0);
  const [totalRead, setTotalRead] = useState(0);
  const pageSize = 20;

  useEffect(() => {
    loadNotifications();
  }, [filter, currentPage]);

  const loadNotifications = async () => {
    setIsLoading(true);
    try {
      const response = await getNotifications({
        page: currentPage,
        size: pageSize,
        filter: filter === 'all' ? undefined : filter,
      });

      if (response.code === 200 && response.data) {
        const data = response.data;
        setNotifications(data.list || []);
        setTotal(data.total || 0);
        setTotalUnread(data.totalUnread || 0);
        setTotalRead(data.totalRead || 0);
      }
    } catch (error: any) {
      console.error('Load notifications error:', error);
      Alert.alert('错误', error.msg || '加载通知失败');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    setCurrentPage(1);
    loadNotifications();
  };

  const handleMarkAsRead = async (id: number) => {
    try {
      const response = await markNotificationAsRead(id);
      if (response.code === 200) {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, read: true } : n))
        );
        setTotalUnread((prev) => Math.max(0, prev - 1));
        setTotalRead((prev) => prev + 1);
      }
    } catch (error: any) {
      console.error('Mark as read error:', error);
      Alert.alert('错误', error.msg || '标记已读失败');
    }
  };

  const handleDelete = async (id: number) => {
    Alert.alert('确认删除', '确定要删除这条通知吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            const response = await deleteNotification(id);
            if (response.code === 200) {
              setNotifications((prev) => prev.filter((n) => n.id !== id));
              setTotal((prev) => prev - 1);
              if (!notifications.find((n) => n.id === id)?.read) {
                setTotalUnread((prev) => Math.max(0, prev - 1));
              } else {
                setTotalRead((prev) => Math.max(0, prev - 1));
              }
            }
          } catch (error: any) {
            console.error('Delete notification error:', error);
            Alert.alert('错误', error.msg || '删除失败');
          }
        },
      },
    ]);
  };

  const handleMarkAllAsRead = async () => {
    Alert.alert('确认操作', '确定要将所有通知标记为已读吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '确定',
        onPress: async () => {
          try {
            const response = await markAllNotificationsAsRead();
            if (response.code === 200) {
              setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
              setTotalRead(total);
              setTotalUnread(0);
            }
          } catch (error: any) {
            console.error('Mark all as read error:', error);
            Alert.alert('错误', error.msg || '标记失败');
          }
        },
      },
    ]);
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString('zh-CN');
  };

  return (
    <MainLayout
      navBarProps={{
        title: '通知中心',
        leftIcon: 'arrow-left',
        onLeftPress: () => navigation.goBack(),
        rightIcon: totalUnread > 0 ? 'check' : undefined,
        onRightPress: totalUnread > 0 ? handleMarkAllAsRead : undefined,
      }}
      backgroundColor="#f8fafc"
    >
      <View style={styles.container}>
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
            <Text
              style={[
                styles.filterText,
                filter === 'all' && styles.filterTextActive,
              ]}
            >
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
            <Text
              style={[
                styles.filterText,
                filter === 'unread' && styles.filterTextActive,
              ]}
            >
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
            <Text
              style={[
                styles.filterText,
                filter === 'read' && styles.filterTextActive,
              ]}
            >
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
          showsVerticalScrollIndicator={false}
        >
          {isLoading && notifications.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#a78bfa" />
              <Text style={styles.loadingText}>加载中...</Text>
            </View>
          ) : notifications.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Feather name="bell-off" size={48} color="#94a3b8" />
              <Text style={styles.emptyText}>暂无通知</Text>
              <Text style={styles.emptySubtext}>
                {filter === 'all'
                  ? '您还没有收到任何通知'
                  : filter === 'unread'
                  ? '所有通知都已阅读'
                  : '没有已读通知'}
              </Text>
            </View>
          ) : (
            notifications.map((notification) => (
              <Card
                key={notification.id}
                variant="default"
                padding="md"
                style={[
                  styles.notificationCard,
                  !notification.read && styles.unreadCard,
                ]}
              >
                <View style={styles.notificationHeader}>
                  <View style={styles.notificationMain}>
                    {!notification.read && (
                      <View style={styles.unreadDot} />
                    )}
                    <View style={styles.notificationContent}>
                      <Text
                        style={[
                          styles.notificationTitle,
                          !notification.read && styles.unreadTitle,
                        ]}
                        numberOfLines={2}
                      >
                        {notification.title}
                      </Text>
                      <Text
                        style={styles.notificationText}
                        numberOfLines={3}
                      >
                        {notification.content}
                      </Text>
                      <Text style={styles.notificationTime}>
                        {formatTime(notification.created_at)}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.notificationActions}>
                    {!notification.read && (
                      <TouchableOpacity
                        style={styles.actionButton}
                        onPress={() => handleMarkAsRead(notification.id)}
                        activeOpacity={0.7}
                      >
                        <Feather name="check" size={18} color="#10b981" />
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.actionButton, styles.deleteButton]}
                      onPress={() => handleDelete(notification.id)}
                      activeOpacity={0.7}
                    >
                      <Feather name="trash-2" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>
            ))
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
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterButtonActive: {
    backgroundColor: '#f3e8ff',
    borderColor: '#a78bfa',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  filterTextActive: {
    color: '#a78bfa',
    fontWeight: '600',
  },
  listContainer: {
    flex: 1,
  },
  listContent: {
    padding: 16,
    gap: 12,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
    textAlign: 'center',
  },
  notificationCard: {
    marginBottom: 0,
  },
  unreadCard: {
    borderLeftWidth: 4,
    borderLeftColor: '#a78bfa',
    backgroundColor: '#fefcff',
  },
  notificationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  notificationMain: {
    flex: 1,
    flexDirection: 'row',
    marginRight: 12,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#a78bfa',
    marginRight: 12,
    marginTop: 6,
  },
  notificationContent: {
    flex: 1,
  },
  notificationTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 6,
  },
  unreadTitle: {
    fontWeight: '700',
  },
  notificationText: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 8,
  },
  notificationTime: {
    fontSize: 12,
    color: '#94a3b8',
  },
  notificationActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  deleteButton: {
    backgroundColor: '#fef2f2',
    borderColor: '#fecaca',
  },
});

export default NotificationScreen;


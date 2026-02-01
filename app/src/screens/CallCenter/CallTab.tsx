/**
 * 通话控制标签页
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Card, Button, Badge } from '../../components';
import * as sipApi from '../../services/api/sip';

type SipUser = sipApi.SipUser;
type SipCall = sipApi.SipCall;

const CallTab: React.FC = () => {
  const [sipUsers, setSipUsers] = useState<SipUser[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<SipUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<SipUser | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 通话状态
  const [calling, setCalling] = useState(false);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [callStatus, setCallStatus] = useState<string>('');

  // 通话历史
  const [callHistory, setCallHistory] = useState<SipCall[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // 轮询定时器
  const pollingInterval = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadData();
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
      }
    };
  }, []);

  // 搜索过滤
  useEffect(() => {
    if (!searchTerm) {
      setFilteredUsers(sipUsers);
    } else {
      const search = searchTerm.toLowerCase();
      const filtered = sipUsers.filter(
        (user) =>
          user.username.toLowerCase().includes(search) ||
          (user.displayName && user.displayName.toLowerCase().includes(search)) ||
          (user.alias && user.alias.toLowerCase().includes(search))
      );
      setFilteredUsers(filtered);
    }
  }, [searchTerm, sipUsers]);

  // 轮询通话状态
  useEffect(() => {
    if (currentCallId && calling) {
      pollingInterval.current = setInterval(() => {
        checkCallStatus(currentCallId);
      }, 2000);

      return () => {
        if (pollingInterval.current) {
          clearInterval(pollingInterval.current);
        }
      };
    }
  }, [currentCallId, calling]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      await Promise.all([loadSipUsers(), loadCallHistory()]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSipUsers = async () => {
    try {
      const response = await sipApi.getSipUsers();
      if (response.code === 200) {
        setSipUsers(response.data || []);
        setFilteredUsers(response.data || []);
      } else {
        // 只在非空数据错误时显示提示
        if (response.code !== 404) {
          Alert.alert('错误', response.msg || '获取 SIP 用户列表失败');
        } else {
          setSipUsers([]);
          setFilteredUsers([]);
        }
      }
    } catch (error: any) {
      console.error('获取 SIP 用户列表失败', error);
      setSipUsers([]);
      setFilteredUsers([]);
    }
  };

  const loadCallHistory = async () => {
    try {
      const response = await sipApi.getCallHistory({ limit: 20 });
      if (response.code === 200) {
        setCallHistory(response.data?.list || []);
      }
    } catch (error) {
      console.error('获取通话历史失败', error);
      setCallHistory([]);
    }
  };

  const checkCallStatus = async (callId: string) => {
    try {
      const response = await sipApi.getOutgoingCallStatus(callId);
      if (response.code === 200 && response.data) {
        setCallStatus(response.data.status);

        if (['ended', 'failed', 'cancelled'].includes(response.data.status)) {
          setCalling(false);
          setCurrentCallId(null);
          if (pollingInterval.current) {
            clearInterval(pollingInterval.current);
          }
          loadCallHistory();
        }
      }
    } catch (error) {
      console.error('获取通话状态失败', error);
    }
  };

  const handleMakeCall = async () => {
    if (!selectedUser) {
      Alert.alert('提示', '请选择要呼叫的用户');
      return;
    }

    if (!selectedUser.enabled) {
      Alert.alert('提示', '该用户已被禁用，无法发起呼叫');
      return;
    }

    if (calling) {
      Alert.alert('提示', '正在通话中，请稍候');
      return;
    }

    try {
      setCalling(true);
      setCallStatus('calling');

      const targetUri =
        selectedUser.contact ||
        `sip:${selectedUser.username}@${selectedUser.contactIp || '127.0.0.1'}:${
          selectedUser.contactPort || 5060
        }`;

      const response = await sipApi.makeOutgoingCall({
        targetUri,
        notes: `外呼到 ${selectedUser.displayName || selectedUser.username}`,
      });

      if (response.code === 200 && response.data) {
        setCurrentCallId(response.data.callId);
        setCallStatus(response.data.status);
        Alert.alert('成功', '呼叫已发起');
        loadCallHistory();
      } else {
        throw new Error(response.msg || '发起呼叫失败');
      }
    } catch (error: any) {
      Alert.alert('错误', error.message || '发起呼叫失败');
      setCalling(false);
      setCallStatus('');
    }
  };

  const handleCancelCall = async () => {
    if (!currentCallId) return;

    try {
      const response =
        callStatus === 'answered'
          ? await sipApi.hangupOutgoingCall(currentCallId)
          : await sipApi.cancelOutgoingCall(currentCallId);

      if (response.code === 200) {
        setCalling(false);
        setCurrentCallId(null);
        setCallStatus('');
        Alert.alert('成功', callStatus === 'answered' ? '通话已挂断' : '呼叫已取消');
        loadCallHistory();
      } else {
        throw new Error(
          response.msg || (callStatus === 'answered' ? '挂断失败' : '取消呼叫失败')
        );
      }
    } catch (error: any) {
      Alert.alert(
        '错误',
        error.message || (callStatus === 'answered' ? '挂断失败' : '取消呼叫失败')
      );
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<
      string,
      { color: string; bgColor: string; text: string; icon: string }
    > = {
      calling: { color: '#3b82f6', bgColor: '#dbeafe', text: '呼叫中', icon: 'phone-call' },
      ringing: { color: '#f59e0b', bgColor: '#fef3c7', text: '响铃中', icon: 'phone' },
      answered: { color: '#10b981', bgColor: '#d1fae5', text: '已接通', icon: 'check-circle' },
      failed: { color: '#ef4444', bgColor: '#fee2e2', text: '失败', icon: 'x-circle' },
      cancelled: { color: '#6b7280', bgColor: '#f3f4f6', text: '已取消', icon: 'phone-off' },
      ended: { color: '#6b7280', bgColor: '#f3f4f6', text: '已结束', icon: 'check-circle' },
    };

    const config = statusConfig[status] || {
      color: '#6b7280',
      bgColor: '#f3f4f6',
      text: status,
      icon: 'alert-circle',
    };

    return (
      <View style={[styles.statusBadge, { backgroundColor: config.bgColor }]}>
        <Feather name={config.icon as any} size={12} color={config.color} />
        <Text style={[styles.statusText, { color: config.color }]}>{config.text}</Text>
      </View>
    );
  };

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}分${secs}秒`;
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#a855f7" />
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
    >
      {/* 搜索框 */}
      <View style={styles.searchContainer}>
        <Feather name="search" size={18} color="#64748b" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="搜索 SIP 用户..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholderTextColor="#94a3b8"
        />
      </View>

      {/* 呼叫控制区域 */}
      <Card variant="elevated" padding="lg" style={styles.controlCard}>
        <Text style={styles.sectionTitle}>呼叫控制</Text>

        {selectedUser ? (
          <View style={styles.selectedUserContainer}>
            <View style={styles.selectedUserInfo}>
              <View style={styles.userAvatar}>
                <Feather name="user" size={24} color="#a855f7" />
              </View>
              <View style={styles.userDetails}>
                <Text style={styles.userName}>
                  {selectedUser.displayName || selectedUser.alias || selectedUser.username}
                </Text>
                <Text style={styles.userUsername}>{selectedUser.username}</Text>
                {selectedUser.contact && (
                  <Text style={styles.userContact} numberOfLines={1}>
                    {selectedUser.contact}
                  </Text>
                )}
              </View>
            </View>

            {calling && currentCallId && (
              <View style={styles.callStatusContainer}>
                <Text style={styles.callStatusLabel}>通话状态</Text>
                {getStatusBadge(callStatus)}
                <Text style={styles.callId} numberOfLines={1}>
                  通话ID: {currentCallId}
                </Text>
              </View>
            )}

            <View style={styles.callActions}>
              {!calling ? (
                <Button
                  variant="primary"
                  onPress={handleMakeCall}
                  disabled={!selectedUser.enabled}
                  style={styles.callButton}
                >
                  <Feather name="phone" size={18} color="#ffffff" />
                  <Text style={styles.callButtonText}>发起呼叫</Text>
                </Button>
              ) : (
                <Button variant="destructive" onPress={handleCancelCall} style={styles.callButton}>
                  <Feather name="phone-off" size={18} color="#ffffff" />
                  <Text style={styles.callButtonText}>
                    {callStatus === 'answered' ? '挂断' : '取消'}
                  </Text>
                </Button>
              )}
            </View>

            {!selectedUser.enabled && (
              <Text style={styles.disabledWarning}>该用户已被禁用，无法发起呼叫</Text>
            )}
          </View>
        ) : (
          <View style={styles.noSelectionContainer}>
            <Feather name="phone-call" size={48} color="#cbd5e1" />
            <Text style={styles.noSelectionText}>请从下方选择要呼叫的用户</Text>
          </View>
        )}
      </Card>

      {/* SIP 用户列表 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SIP 用户列表</Text>
        {filteredUsers.length === 0 ? (
          <Card variant="default" padding="lg">
            <View style={styles.emptyState}>
              <Feather name="users" size={48} color="#cbd5e1" />
              <Text style={styles.emptyText}>
                {searchTerm ? '没有找到匹配的用户' : '暂无 SIP 用户'}
              </Text>
            </View>
          </Card>
        ) : (
          <View style={styles.userList}>
            {filteredUsers.map((user) => (
              <TouchableOpacity
                key={user.id}
                onPress={() => setSelectedUser(user)}
                activeOpacity={0.7}
              >
                <Card
                  variant={selectedUser?.id === user.id ? 'elevated' : 'default'}
                  padding="md"
                  style={
                    selectedUser?.id === user.id
                      ? { ...styles.userCard, ...styles.userCardSelected }
                      : styles.userCard
                  }
                >
                  <View style={styles.userCardContent}>
                    <View style={styles.userCardLeft}>
                      <View
                        style={[
                          styles.userCardAvatar,
                          selectedUser?.id === user.id && styles.userCardAvatarSelected,
                        ]}
                      >
                        <Feather
                          name="user"
                          size={20}
                          color={selectedUser?.id === user.id ? '#a855f7' : '#64748b'}
                        />
                      </View>
                      <View style={styles.userCardInfo}>
                        <Text style={styles.userCardName}>
                          {user.displayName || user.alias || user.username}
                        </Text>
                        <Text style={styles.userCardUsername}>{user.username}</Text>
                      </View>
                    </View>
                    <View style={styles.userCardRight}>
                      {getStatusBadge(user.status)}
                      <Badge variant={user.enabled ? 'success' : 'error'} style={styles.enabledBadge}>
                        <Text style={styles.enabledBadgeText}>
                          {user.enabled ? '已启用' : '已禁用'}
                        </Text>
                      </Badge>
                    </View>
                  </View>
                </Card>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* 通话历史 */}
      <View style={styles.section}>
        <TouchableOpacity
          style={styles.sectionHeader}
          onPress={() => setShowHistory(!showHistory)}
          activeOpacity={0.7}
        >
          <View style={styles.sectionTitleContainer}>
            <Feather name="clock" size={20} color="#1e293b" />
            <Text style={styles.sectionTitle}>通话历史</Text>
          </View>
          <Feather
            name={showHistory ? 'chevron-up' : 'chevron-down'}
            size={20}
            color="#64748b"
          />
        </TouchableOpacity>

        {showHistory && (
          <View style={styles.historyList}>
            {callHistory.length === 0 ? (
              <Card variant="default" padding="lg">
                <View style={styles.emptyState}>
                  <Feather name="phone-missed" size={48} color="#cbd5e1" />
                  <Text style={styles.emptyText}>暂无通话记录</Text>
                </View>
              </Card>
            ) : (
              callHistory.map((call) => (
                <Card key={call.id} variant="default" padding="md" style={styles.historyCard}>
                  <View style={styles.historyCardHeader}>
                    <View style={styles.historyCardLeft}>
                      <Feather
                        name={call.direction === 'outbound' ? 'phone-outgoing' : 'phone-incoming'}
                        size={16}
                        color="#64748b"
                      />
                      <Text style={styles.historyDirection}>
                        {call.direction === 'outbound' ? '呼出' : '呼入'}
                      </Text>
                    </View>
                    {getStatusBadge(call.status)}
                  </View>
                  <Text style={styles.historyUri} numberOfLines={1}>
                    {call.toUri || call.fromUri}
                  </Text>
                  <View style={styles.historyCardFooter}>
                    <Text style={styles.historyTime}>
                      {new Date(call.startTime).toLocaleString('zh-CN', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </Text>
                    {call.duration > 0 && (
                      <Text style={styles.historyDuration}>
                        时长: {formatDuration(call.duration)}
                      </Text>
                    )}
                  </View>
                </Card>
              ))
            )}
          </View>
        )}
      </View>

      <View style={styles.footer} />
    </ScrollView>
  );
};

// 样式定义（由于太长，我会在下一个消息中继续）
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 14,
    color: '#1e293b',
  },
  controlCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  selectedUserContainer: {
    gap: 16,
  },
  selectedUserInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f3e8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  userUsername: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 2,
  },
  userContact: {
    fontSize: 11,
    color: '#94a3b8',
  },
  callStatusContainer: {
    padding: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    gap: 8,
  },
  callStatusLabel: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 4,
  },
  callId: {
    fontSize: 11,
    color: '#94a3b8',
  },
  callActions: {
    gap: 8,
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  callButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
  },
  disabledWarning: {
    fontSize: 12,
    color: '#ef4444',
    textAlign: 'center',
  },
  noSelectionContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noSelectionText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  userList: {
    gap: 8,
  },
  userCard: {
    marginBottom: 0,
  },
  userCardSelected: {
    borderWidth: 2,
    borderColor: '#a855f7',
  },
  userCardContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  userCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  userCardAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  userCardAvatarSelected: {
    backgroundColor: '#f3e8ff',
  },
  userCardInfo: {
    flex: 1,
  },
  userCardName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  userCardUsername: {
    fontSize: 12,
    color: '#64748b',
  },
  userCardRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  enabledBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  enabledBadgeText: {
    fontSize: 10,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  historyList: {
    gap: 8,
  },
  historyCard: {
    marginBottom: 0,
  },
  historyCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  historyCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  historyDirection: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
  },
  historyUri: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 8,
  },
  historyCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyTime: {
    fontSize: 12,
    color: '#94a3b8',
  },
  historyDuration: {
    fontSize: 12,
    color: '#94a3b8',
  },
  footer: {
    height: 20,
  },
});

export default CallTab;

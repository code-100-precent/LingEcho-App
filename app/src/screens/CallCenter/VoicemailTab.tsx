/**
 * 留言箱标签页
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  RefreshControl,
  TextInput,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Card, Button, Badge } from '../../components';
import {
  getVoicemails,
  getVoicemailStats,
  markAsRead,
  markAsImportant,
  unmarkAsImportant,
  deleteVoicemail,
  batchDeleteVoicemails,
  batchMarkAsRead,
  Voicemail,
  VoicemailStats,
} from '../../services/api/voicemail';

type FilterType = 'all' | 'unread' | 'important';

const VoicemailTab: React.FC = () => {
  const [voicemails, setVoicemails] = useState<Voicemail[]>([]);
  const [stats, setStats] = useState<VoicemailStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterType>('all');
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  useEffect(() => {
    loadData();
  }, [filterStatus]);

  const loadData = async () => {
    try {
      setIsLoading(true);
      await Promise.all([loadVoicemails(), loadStats()]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadVoicemails = async () => {
    try {
      const params: any = {};

      if (filterStatus === 'unread') {
        params.isRead = false;
      } else if (filterStatus === 'important') {
        params.isImportant = true;
      }

      const response = await getVoicemails(params);
      if (response.code === 200 && response.data) {
        setVoicemails(response.data.list || []);
      } else {
        // 只在非空数据错误时显示提示
        if (response.code !== 404) {
          Alert.alert('错误', response.msg || '获取留言列表失败');
        } else {
          setVoicemails([]);
        }
      }
    } catch (error: any) {
      console.error('获取留言列表失败', error);
      setVoicemails([]);
    }
  };

  const loadStats = async () => {
    try {
      const response = await getVoicemailStats();
      if (response.code === 200 && response.data) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('获取统计失败', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };


  const handleMarkRead = async (voicemail: Voicemail) => {
    try {
      const response = await markAsRead(voicemail.id);
      if (response.code === 200) {
        loadData();
      } else {
        Alert.alert('错误', response.msg || '操作失败');
      }
    } catch (error: any) {
      Alert.alert('错误', error.message || '操作失败');
    }
  };

  const handleToggleImportant = async (voicemail: Voicemail) => {
    try {
      const response = voicemail.isImportant
        ? await unmarkAsImportant(voicemail.id)
        : await markAsImportant(voicemail.id);

      if (response.code === 200) {
        loadData();
      } else {
        Alert.alert('错误', response.msg || '操作失败');
      }
    } catch (error: any) {
      Alert.alert('错误', error.message || '操作失败');
    }
  };

  const handleDelete = (voicemail: Voicemail) => {
    Alert.alert('确认删除', '确定要删除这条留言吗？', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            const response = await deleteVoicemail(voicemail.id);
            if (response.code === 200) {
              Alert.alert('成功', '删除成功');
              loadData();
            } else {
              Alert.alert('错误', response.msg || '删除失败');
            }
          } catch (error: any) {
            Alert.alert('错误', error.message || '删除失败');
          }
        },
      },
    ]);
  };

  const handleBatchDelete = () => {
    if (selectedIds.length === 0) {
      Alert.alert('提示', '请选择要删除的留言');
      return;
    }

    Alert.alert('确认删除', `确定要删除 ${selectedIds.length} 条留言吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            const response = await batchDeleteVoicemails(selectedIds);
            if (response.code === 200) {
              Alert.alert('成功', '删除成功');
              setSelectedIds([]);
              loadData();
            } else {
              Alert.alert('错误', response.msg || '删除失败');
            }
          } catch (error: any) {
            Alert.alert('错误', error.message || '删除失败');
          }
        },
      },
    ]);
  };

  const handleBatchMarkRead = async () => {
    if (selectedIds.length === 0) {
      Alert.alert('提示', '请选择要标记的留言');
      return;
    }

    try {
      const response = await batchMarkAsRead(selectedIds);
      if (response.code === 200) {
        Alert.alert('成功', '已标记为已读');
        setSelectedIds([]);
        loadData();
      } else {
        Alert.alert('错误', response.msg || '操作失败');
      }
    } catch (error: any) {
      Alert.alert('错误', error.message || '操作失败');
    }
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredVoicemails.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredVoicemails.map((v) => v.id));
    }
  };

  const filteredVoicemails = voicemails.filter((v) => {
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        v.callerNumber.includes(search) ||
        v.callerName?.toLowerCase().includes(search) ||
        v.transcribedText?.toLowerCase().includes(search) ||
        v.summary?.toLowerCase().includes(search)
      );
    }
    return true;
  });

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
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
      {/* 统计卡片 */}
      {stats && (
        <View style={styles.statsGrid}>
          <Card variant="default" padding="md" style={styles.statCard}>
            <View style={styles.statContent}>
              <View>
                <Text style={styles.statValue}>{stats.total}</Text>
                <Text style={styles.statLabel}>总留言</Text>
              </View>
              <Feather name="mail" size={32} color="#94a3b8" />
            </View>
          </Card>

          <Card variant="default" padding="md" style={styles.statCard}>
            <View style={styles.statContent}>
              <View>
                <Text style={styles.statValue}>{stats.unread}</Text>
                <Text style={styles.statLabel}>未读</Text>
              </View>
              <Feather name="mail" size={32} color="#3b82f6" />
            </View>
          </Card>

          <Card variant="default" padding="md" style={styles.statCard}>
            <View style={styles.statContent}>
              <View>
                <Text style={styles.statValue}>{stats.important}</Text>
                <Text style={styles.statLabel}>重要</Text>
              </View>
              <Feather name="star" size={32} color="#f59e0b" />
            </View>
          </Card>

          <Card variant="default" padding="md" style={styles.statCard}>
            <View style={styles.statContent}>
              <View>
                <Text style={styles.statValue}>{stats.today}</Text>
                <Text style={styles.statLabel}>今日</Text>
              </View>
              <Feather name="calendar" size={32} color="#10b981" />
            </View>
          </Card>
        </View>
      )}

      {/* 搜索框 */}
      <View style={styles.searchContainer}>
        <Feather name="search" size={18} color="#64748b" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="搜索号码、姓名或内容..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholderTextColor="#94a3b8"
        />
      </View>

      {/* 筛选按钮 */}
      <View style={styles.filterButtons}>
        <TouchableOpacity
          style={[styles.filterButton, filterStatus === 'all' && styles.filterButtonActive]}
          onPress={() => setFilterStatus('all')}
        >
          <Text
            style={[
              styles.filterButtonText,
              filterStatus === 'all' && styles.filterButtonTextActive,
            ]}
          >
            全部
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filterStatus === 'unread' && styles.filterButtonActive]}
          onPress={() => setFilterStatus('unread')}
        >
          <Text
            style={[
              styles.filterButtonText,
              filterStatus === 'unread' && styles.filterButtonTextActive,
            ]}
          >
            未读
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.filterButton, filterStatus === 'important' && styles.filterButtonActive]}
          onPress={() => setFilterStatus('important')}
        >
          <Text
            style={[
              styles.filterButtonText,
              filterStatus === 'important' && styles.filterButtonTextActive,
            ]}
          >
            重要
          </Text>
        </TouchableOpacity>
      </View>

      {/* 批量操作 */}
      {selectedIds.length > 0 && (
        <Card variant="default" padding="md" style={styles.batchActions}>
          <View style={styles.batchActionsContent}>
            <Text style={styles.batchActionsText}>已选择 {selectedIds.length} 项</Text>
            <View style={styles.batchActionsButtons}>
              <Button variant="outline" size="sm" onPress={handleBatchMarkRead}>
                <Feather name="mail" size={14} color="#64748b" />
                <Text style={styles.batchActionButtonText}>标记已读</Text>
              </Button>
              <Button variant="destructive" size="sm" onPress={handleBatchDelete}>
                <Feather name="trash-2" size={14} color="#ffffff" />
                <Text style={styles.batchActionDeleteText}>删除</Text>
              </Button>
            </View>
          </View>
        </Card>
      )}

      {/* 全选按钮 */}
      {filteredVoicemails.length > 0 && (
        <TouchableOpacity style={styles.selectAllButton} onPress={toggleSelectAll}>
          <Feather
            name={
              selectedIds.length === filteredVoicemails.length ? 'check-square' : 'square'
            }
            size={20}
            color="#64748b"
          />
          <Text style={styles.selectAllText}>
            {selectedIds.length === filteredVoicemails.length ? '取消全选' : '全选'}
          </Text>
        </TouchableOpacity>
      )}

      {/* 留言列表 */}
      {filteredVoicemails.length === 0 ? (
        <Card variant="default" padding="lg" style={styles.emptyCard}>
          <View style={styles.emptyState}>
            <Feather name="mail" size={48} color="#cbd5e1" />
            <Text style={styles.emptyText}>
              {searchTerm ? '没有找到匹配的留言' : '还没有留言'}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchTerm ? '尝试使用其他关键词搜索' : '当有人给您留言时，会显示在这里'}
            </Text>
          </View>
        </Card>
      ) : (
        <View style={styles.voicemailList}>
          {filteredVoicemails.map((voicemail) => (
            <Card key={voicemail.id} variant="default" padding="md" style={styles.voicemailCard}>
              <View style={styles.voicemailHeader}>
                <TouchableOpacity
                  onPress={() => toggleSelect(voicemail.id)}
                  style={styles.checkbox}
                >
                  <Feather
                    name={selectedIds.includes(voicemail.id) ? 'check-square' : 'square'}
                    size={20}
                    color={selectedIds.includes(voicemail.id) ? '#a855f7' : '#cbd5e1'}
                  />
                </TouchableOpacity>

                <View style={styles.voicemailInfo}>
                  <View style={styles.voicemailTitleRow}>
                    <Text style={styles.callerNumber}>
                      {voicemail.callerName || voicemail.callerNumber}
                    </Text>
                    {!voicemail.isRead && <View style={styles.unreadDot} />}
                    {voicemail.isImportant && (
                      <Feather name="star" size={14} color="#f59e0b" />
                    )}
                  </View>
                  <Text style={styles.callTime}>
                    {new Date(voicemail.callTime).toLocaleString('zh-CN', {
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {' · '}
                    {formatDuration(voicemail.duration)}
                  </Text>
                  {voicemail.summary && (
                    <Text style={styles.summary} numberOfLines={2}>
                      {voicemail.summary}
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.voicemailActions}>
                {!voicemail.isRead && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleMarkRead(voicemail)}
                  >
                    <Feather name="mail" size={16} color="#64748b" />
                    <Text style={styles.actionBtnText}>标记已读</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleToggleImportant(voicemail)}
                >
                  <Feather
                    name="star"
                    size={16}
                    color={voicemail.isImportant ? '#f59e0b' : '#64748b'}
                  />
                  <Text style={styles.actionBtnText}>
                    {voicemail.isImportant ? '取消重要' : '标为重要'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionBtn}
                  onPress={() => handleDelete(voicemail)}
                >
                  <Feather name="trash-2" size={16} color="#ef4444" />
                  <Text style={[styles.actionBtnText, { color: '#ef4444' }]}>删除</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))}
        </View>
      )}

      <View style={styles.footer} />
    </ScrollView>
  );
};


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
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    width: '48%',
    marginBottom: 0,
  },
  statContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
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
  filterButtons: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  filterButtonActive: {
    backgroundColor: '#a855f7',
    borderColor: '#a855f7',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  filterButtonTextActive: {
    color: '#ffffff',
  },
  batchActions: {
    marginBottom: 16,
    backgroundColor: '#eff6ff',
  },
  batchActionsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  batchActionsText: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '500',
  },
  batchActionsButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  batchActionButtonText: {
    fontSize: 12,
    color: '#64748b',
    marginLeft: 4,
  },
  batchActionDeleteText: {
    fontSize: 12,
    color: '#ffffff',
    marginLeft: 4,
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  selectAllText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  emptyCard: {
    marginTop: 40,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  emptySubtext: {
    marginTop: 4,
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  voicemailList: {
    gap: 12,
  },
  voicemailCard: {
    marginBottom: 0,
  },
  voicemailHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  checkbox: {
    paddingTop: 2,
  },
  voicemailInfo: {
    flex: 1,
  },
  voicemailTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  callerNumber: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3b82f6',
  },
  callTime: {
    fontSize: 12,
    color: '#94a3b8',
    marginBottom: 8,
  },
  summary: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  voicemailActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
  },
  actionBtnText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  footer: {
    height: 20,
  },
});

export default VoicemailTab;

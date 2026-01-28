/**
 * 组织管理页面 - 完整版
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
  TextInput,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { MainLayout, Card, EmptyState } from '../components';
import {
  getGroupList,
  createGroup,
  deleteGroup,
  leaveGroup,
  inviteUser,
  getInvitations,
  acceptInvitation,
  rejectInvitation,
  searchUsers,
  Group,
  GroupInvitation,
  UserSearchResult,
} from '../services/api/group';
import { useAuth } from '../context/AuthContext';

const GroupManagementScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAuth();
  const [groups, setGroups] = useState<Group[]>([]);
  const [invitations, setInvitations] = useState<GroupInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 创建组织
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  // 邀请用户
  const [showInviteModal, setShowInviteModal] = useState<number | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([loadGroups(), loadInvitations()]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadGroups = async () => {
    try {
      const response = await getGroupList();
      if (response.code === 200 && response.data) {
        setGroups(response.data);
      }
    } catch (error: any) {
      console.error('Load groups error:', error);
    }
  };

  const loadInvitations = async () => {
    try {
      const response = await getInvitations();
      if (response.code === 200 && response.data) {
        setInvitations(response.data);
      }
    } catch (error: any) {
      console.error('Load invitations error:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const handleCreateGroup = async () => {
    if (!newGroupName.trim()) {
      Alert.alert('提示', '请输入组织名称');
      return;
    }

    try {
      const response = await createGroup({ name: newGroupName.trim() });
      if (response.code === 200) {
        Alert.alert('成功', '组织创建成功');
        setShowCreateModal(false);
        setNewGroupName('');
        loadGroups();
      }
    } catch (error: any) {
      console.error('Create group error:', error);
      Alert.alert('错误', error.msg || '创建失败');
    }
  };

  const handleDeleteGroup = async (groupId: number) => {
    Alert.alert(
      '确认删除',
      '确定要删除这个组织吗？此操作不可恢复。',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await deleteGroup(groupId);
              if (response.code === 200) {
                Alert.alert('成功', '组织已删除');
                loadGroups();
              }
            } catch (error: any) {
              console.error('Delete group error:', error);
              Alert.alert('错误', '删除失败');
            }
          },
        },
      ]
    );
  };

  const handleLeaveGroup = async (groupId: number) => {
    Alert.alert(
      '确认退出',
      '确定要退出这个组织吗？',
      [
        { text: '取消', style: 'cancel' },
        {
          text: '退出',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await leaveGroup(groupId);
              if (response.code === 200) {
                Alert.alert('成功', '已退出组织');
                loadGroups();
              }
            } catch (error: any) {
              console.error('Leave group error:', error);
              Alert.alert('错误', '退出失败');
            }
          },
        },
      ]
    );
  };

  const handleSearchUsers = async (keyword: string) => {
    if (!keyword.trim()) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await searchUsers(keyword, 10);
      if (response.code === 200 && response.data) {
        setSearchResults(response.data);
      }
    } catch (error: any) {
      console.error('Search users error:', error);
    } finally {
      setSearching(false);
    }
  };

  const handleInviteUser = async (groupId: number, userId: number) => {
    try {
      const response = await inviteUser(groupId, { userId });
      if (response.code === 200) {
        Alert.alert('成功', '邀请已发送');
        setShowInviteModal(null);
        setSearchKeyword('');
        setSearchResults([]);
      }
    } catch (error: any) {
      console.error('Invite user error:', error);
      Alert.alert('错误', error.msg || '邀请失败');
    }
  };

  const handleAcceptInvitation = async (invitationId: number) => {
    try {
      const response = await acceptInvitation(invitationId);
      if (response.code === 200) {
        Alert.alert('成功', '已加入组织');
        loadData();
      }
    } catch (error: any) {
      console.error('Accept invitation error:', error);
      Alert.alert('错误', '操作失败');
    }
  };

  const handleRejectInvitation = async (invitationId: number) => {
    try {
      const response = await rejectInvitation(invitationId);
      if (response.code === 200) {
        Alert.alert('成功', '已拒绝邀请');
        loadInvitations();
      }
    } catch (error: any) {
      console.error('Reject invitation error:', error);
      Alert.alert('错误', '操作失败');
    }
  };

  const isAdmin = (group: Group) => {
    const userId = user?.id ? Number(user.id) : null;
    return group.myRole === 'admin' || group.creatorId === userId;
  };

  const isCreator = (group: Group) => {
    const userId = user?.id ? Number(user.id) : null;
    return group.creatorId === userId;
  };

  const getAvatarUrl = (group: Group) => {
    if (group.avatar) {
      return { uri: group.avatar };
    }
    return { uri: `https://ui-avatars.com/api/?name=${encodeURIComponent(group.name)}&background=6366f1&color=fff&size=80&bold=true` };
  };

  return (
    <MainLayout
      navBarProps={{
        title: '组织管理',
        leftIcon: 'arrow-left',
        onLeftPress: () => navigation.goBack(),
        rightIcon: 'plus',
        onRightPress: () => setShowCreateModal(true),
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
        {/* 待处理的邀请 */}
        {invitations.length > 0 && (
          <View style={styles.invitationsSection}>
            <Text style={styles.sectionTitle}>待处理的邀请</Text>
            {invitations.map((invitation) => (
              <Card key={invitation.id} variant="elevated" padding="md" style={styles.invitationCard}>
                <View style={styles.invitationContent}>
                  <View style={styles.invitationInfo}>
                    <Text style={styles.invitationText}>
                      {invitation.inviter?.displayName || invitation.inviter?.email} 邀请您加入
                    </Text>
                    <Text style={styles.invitationGroupName}>{invitation.group.name}</Text>
                  </View>
                  <View style={styles.invitationActions}>
                    <TouchableOpacity
                      style={[styles.invitationButton, { backgroundColor: '#d1fae5' }]}
                      onPress={() => handleAcceptInvitation(invitation.id)}
                      activeOpacity={0.7}
                    >
                      <Feather name="check" size={14} color="#065f46" />
                      <Text style={[styles.invitationButtonText, { color: '#065f46' }]}>接受</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.invitationButton, { backgroundColor: '#f1f5f9' }]}
                      onPress={() => handleRejectInvitation(invitation.id)}
                      activeOpacity={0.7}
                    >
                      <Feather name="x" size={14} color="#64748b" />
                      <Text style={[styles.invitationButtonText, { color: '#64748b' }]}>拒绝</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* 组织列表 */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#a78bfa" />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        ) : groups.length === 0 ? (
          <EmptyState
            title="暂无组织"
            description="创建或加入一个组织，开始团队协作"
            icon={<Feather name="users" size={64} color="#a78bfa" />}
            action={{
              label: '创建组织',
              onPress: () => setShowCreateModal(true),
            }}
          />
        ) : (
          groups.map((group) => (
            <Card key={group.id} variant="elevated" padding="lg" style={styles.groupCard}>
              <View style={styles.groupHeader}>
                <Image source={getAvatarUrl(group)} style={styles.groupAvatar} />
                <View style={styles.groupInfo}>
                  <View style={styles.groupTitleRow}>
                    <Text style={styles.groupName} numberOfLines={1}>
                      {group.name}
                    </Text>
                    {isCreator(group) && (
                      <View style={[styles.roleBadge, { backgroundColor: '#fef3c7' }]}>
                        <Feather name="crown" size={10} color="#854d0e" />
                        <Text style={[styles.roleBadgeText, { color: '#854d0e' }]}>创建者</Text>
                      </View>
                    )}
                    {isAdmin(group) && !isCreator(group) && (
                      <View style={[styles.roleBadge, { backgroundColor: '#dbeafe' }]}>
                        <Feather name="shield" size={10} color="#1e40af" />
                        <Text style={[styles.roleBadgeText, { color: '#1e40af' }]}>管理员</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.groupMeta}>
                    <View style={styles.metaItem}>
                      <Feather name="users" size={12} color="#64748b" />
                      <Text style={styles.metaText}>{group.memberCount || 0} 成员</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Feather name="calendar" size={12} color="#64748b" />
                      <Text style={styles.metaText}>
                        {new Date(group.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                  </View>
                  {group.extra && (
                    <Text style={styles.groupDescription} numberOfLines={1}>
                      {group.extra}
                    </Text>
                  )}
                </View>
              </View>

              <View style={styles.groupActions}>
                {isAdmin(group) && (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#a78bfa' }]}
                    onPress={() => setShowInviteModal(group.id)}
                    activeOpacity={0.7}
                  >
                    <Feather name="user-plus" size={14} color="#ffffff" />
                    <Text style={[styles.actionButtonText, { color: '#ffffff' }]}>邀请</Text>
                  </TouchableOpacity>
                )}
                {!isCreator(group) && (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#fee2e2' }]}
                    onPress={() => handleLeaveGroup(group.id)}
                    activeOpacity={0.7}
                  >
                    <Feather name="log-out" size={14} color="#991b1b" />
                    <Text style={[styles.actionButtonText, { color: '#991b1b' }]}>退出</Text>
                  </TouchableOpacity>
                )}
                {isCreator(group) && (
                  <TouchableOpacity
                    style={[styles.actionButton, { backgroundColor: '#fee2e2' }]}
                    onPress={() => handleDeleteGroup(group.id)}
                    activeOpacity={0.7}
                  >
                    <Feather name="trash-2" size={14} color="#991b1b" />
                    <Text style={[styles.actionButtonText, { color: '#991b1b' }]}>删除</Text>
                  </TouchableOpacity>
                )}
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      {/* 创建组织 Modal */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>创建组织</Text>
            <TextInput
              style={styles.input}
              value={newGroupName}
              onChangeText={setNewGroupName}
              placeholder="请输入组织名称"
              placeholderTextColor="#94a3b8"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#f1f5f9' }]}
                onPress={() => {
                  setShowCreateModal(false);
                  setNewGroupName('');
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, { color: '#64748b' }]}>取消</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: '#a78bfa' }]}
                onPress={handleCreateGroup}
                activeOpacity={0.7}
              >
                <Text style={[styles.modalButtonText, { color: '#ffffff' }]}>创建</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 邀请用户 Modal */}
      <Modal
        visible={showInviteModal !== null}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowInviteModal(null);
          setSearchKeyword('');
          setSearchResults([]);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modal, { maxHeight: '80%' }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>邀请用户</Text>
              <TouchableOpacity
                onPress={() => {
                  setShowInviteModal(null);
                  setSearchKeyword('');
                  setSearchResults([]);
                }}
                activeOpacity={0.7}
              >
                <Feather name="x" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>
            <View style={styles.searchContainer}>
              <Feather name="search" size={18} color="#94a3b8" style={styles.searchIcon} />
              <TextInput
                style={styles.searchInput}
                value={searchKeyword}
                onChangeText={(text) => {
                  setSearchKeyword(text);
                  handleSearchUsers(text);
                }}
                placeholder="搜索用户邮箱或名称"
                placeholderTextColor="#94a3b8"
              />
            </View>
            <ScrollView style={styles.searchResults}>
              {searching ? (
                <View style={styles.searchingContainer}>
                  <ActivityIndicator size="small" color="#a78bfa" />
                  <Text style={styles.searchingText}>搜索中...</Text>
                </View>
              ) : searchKeyword && searchResults.length === 0 ? (
                <Text style={styles.noResultsText}>未找到用户</Text>
              ) : searchResults.length > 0 ? (
                searchResults.map((result) => (
                  <View key={result.id} style={styles.userItem}>
                    <Image
                      source={{
                        uri: result.avatar || `https://ui-avatars.com/api/?name=${result.displayName || result.email}&background=0ea5e9&color=fff`,
                      }}
                      style={styles.userAvatar}
                    />
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{result.displayName || result.email}</Text>
                      {result.displayName && (
                        <Text style={styles.userEmail}>{result.email}</Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={styles.inviteButton}
                      onPress={() => handleInviteUser(showInviteModal!, result.id)}
                      activeOpacity={0.7}
                    >
                      <Feather name="user-plus" size={14} color="#ffffff" />
                      <Text style={styles.inviteButtonText}>邀请</Text>
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <View style={styles.searchHintContainer}>
                  <Feather name="search" size={48} color="#cbd5e1" />
                  <Text style={styles.searchHintText}>输入邮箱或名称搜索用户</Text>
                </View>
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
  content: {
    padding: 12,
  },
  invitationsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  invitationCard: {
    marginBottom: 8,
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  invitationContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  invitationInfo: {
    flex: 1,
    marginRight: 12,
  },
  invitationText: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 4,
  },
  invitationGroupName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
  },
  invitationActions: {
    flexDirection: 'row',
    gap: 6,
  },
  invitationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    gap: 4,
  },
  invitationButtonText: {
    fontSize: 12,
    fontWeight: '500',
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
  groupCard: {
    marginBottom: 12,
  },
  groupHeader: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  groupAvatar: {
    width: 60,
    height: 60,
    borderRadius: 12,
    marginRight: 12,
    backgroundColor: '#f1f5f9',
  },
  groupInfo: {
    flex: 1,
  },
  groupTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 6,
  },
  groupName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    gap: 3,
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '500',
  },
  groupMeta: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 4,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#64748b',
  },
  groupDescription: {
    fontSize: 12,
    color: '#94a3b8',
  },
  groupActions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    color: '#1e293b',
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalButtonText: {
    fontSize: 15,
    fontWeight: '500',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1e293b',
  },
  searchResults: {
    maxHeight: 400,
  },
  searchingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  searchingText: {
    fontSize: 14,
    color: '#64748b',
  },
  noResultsText: {
    textAlign: 'center',
    paddingVertical: 20,
    fontSize: 14,
    color: '#94a3b8',
  },
  searchHintContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  searchHintText: {
    marginTop: 12,
    fontSize: 14,
    color: '#94a3b8',
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    marginBottom: 8,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: '#f1f5f9',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
  },
  userEmail: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#a78bfa',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 4,
  },
  inviteButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#ffffff',
  },
});

export default GroupManagementScreen;

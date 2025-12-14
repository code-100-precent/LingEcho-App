/**
 * 组织管理页面
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
  RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { MainLayout, Card, Avatar, Button } from '../components';
import {
  getGroup,
  updateGroup,
  deleteGroup,
  leaveGroup,
  Group,
  GroupMember,
} from '../services/api/group';
import { getUploadsBaseURL } from '../config/apiConfig';

type GroupManagementRouteParams = {
  GroupManagement: {
    groupId: number;
  };
};

const GroupManagementScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<GroupManagementRouteParams, 'GroupManagement'>>();
  const { groupId } = route.params;

  const [group, setGroup] = useState<Group | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    loadGroup();
  }, [groupId]);

  const loadGroup = async () => {
    setIsLoading(true);
    try {
      const response = await getGroup(groupId);
      if (response.code === 200 && response.data) {
        setGroup(response.data);
      } else {
        Alert.alert('错误', response.msg || '加载组织信息失败');
        navigation.goBack();
      }
    } catch (error: any) {
      console.error('Load group error:', error);
      Alert.alert('错误', error.msg || error.message || '加载组织信息失败');
      navigation.goBack();
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadGroup();
  };

  const handleDeleteGroup = () => {
    if (!group) return;

    Alert.alert(
      '确认删除',
      `确定要删除组织 "${group.name}" 吗？此操作不可恢复。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            try {
              const response = await deleteGroup(group.id);
              if (response.code === 200) {
                Alert.alert('成功', '组织已删除', [
                  {
                    text: '确定',
                    onPress: () => navigation.goBack(),
                  },
                ]);
              } else {
                Alert.alert('错误', response.msg || '删除失败');
              }
            } catch (error: any) {
              console.error('Delete group error:', error);
              Alert.alert('错误', error.msg || error.message || '删除失败');
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  const handleLeaveGroup = () => {
    if (!group) return;

    Alert.alert(
      '确认离开',
      `确定要离开组织 "${group.name}" 吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '离开',
          style: 'destructive',
          onPress: async () => {
            setIsLeaving(true);
            try {
              const response = await leaveGroup(group.id);
              if (response.code === 200) {
                Alert.alert('成功', '已离开组织', [
                  {
                    text: '确定',
                    onPress: () => navigation.goBack(),
                  },
                ]);
              } else {
                Alert.alert('错误', response.msg || '离开失败');
              }
            } catch (error: any) {
              console.error('Leave group error:', error);
              Alert.alert('错误', error.msg || error.message || '离开失败');
            } finally {
              setIsLeaving(false);
            }
          },
        },
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (isLoading && !group) {
    return (
      <MainLayout
        navBarProps={{
          title: '加载中...',
          leftIcon: 'arrow-left',
          onLeftPress: () => navigation.goBack(),
        }}
        backgroundColor="#ffffff"
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#a78bfa" />
          <Text style={styles.loadingText}>加载组织信息...</Text>
        </View>
      </MainLayout>
    );
  }

  if (!group) {
    return null;
  }

  const isCreator = group.myRole === 'creator' || group.myRole === 'admin';
  const uploadsBaseURL = getUploadsBaseURL();
  const avatarUrl = group.avatar
    ? group.avatar.startsWith('http')
      ? group.avatar
      : `${uploadsBaseURL}${group.avatar}`
    : undefined;

  return (
    <MainLayout
      navBarProps={{
        title: '组织管理',
        leftIcon: 'arrow-left',
        onLeftPress: () => navigation.goBack(),
      }}
      backgroundColor="#f8fafc"
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* 组织信息卡片 */}
        <Card variant="default" padding="lg" style={styles.infoCard}>
          <View style={styles.avatarContainer}>
            <Avatar
              src={avatarUrl}
              fallback={group.name.charAt(0).toUpperCase()}
              size="xl"
              style={styles.avatar}
            />
          </View>
          <Text style={styles.groupName}>{group.name}</Text>
          {group.type && (
            <View style={styles.typeBadge}>
              <Text style={styles.typeText}>{group.type}</Text>
            </View>
          )}

          <View style={styles.infoRow}>
            <Feather name="users" size={16} color="#64748b" />
            <Text style={styles.infoText}>
              {group.memberCount || 0} 位成员
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Feather name="user" size={16} color="#64748b" />
            <Text style={styles.infoText}>
              我的角色: {group.myRole === 'creator' ? '创建者' : group.myRole === 'admin' ? '管理员' : '成员'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Feather name="calendar" size={16} color="#64748b" />
            <Text style={styles.infoText}>
              创建于 {formatDate(group.createdAt)}
            </Text>
          </View>
        </Card>

        {/* 组织描述 */}
        {group.extra && (
          <Card variant="default" padding="lg" style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>组织描述</Text>
            <Text style={styles.sectionText}>{group.extra}</Text>
          </Card>
        )}

        {/* 成员列表 */}
        {group.members && group.members.length > 0 && (
          <Card variant="default" padding="lg" style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>成员列表</Text>
            <View style={styles.membersList}>
              {group.members.map((member) => (
                <View key={member.id} style={styles.memberItem}>
                  <Avatar
                    src={member.user.avatar}
                    fallback={member.user.displayName || member.user.email.charAt(0).toUpperCase()}
                    size="md"
                    style={styles.memberAvatar}
                  />
                  <View style={styles.memberInfo}>
                    <Text style={styles.memberName}>
                      {member.user.displayName || member.user.email}
                    </Text>
                    <Text style={styles.memberRole}>
                      {member.role === 'creator' ? '创建者' : member.role === 'admin' ? '管理员' : '成员'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </Card>
        )}

        {/* 操作按钮 */}
        <View style={styles.actionsContainer}>
          {isCreator ? (
            <Button
              variant="danger"
              fullWidth
              onPress={handleDeleteGroup}
              loading={isDeleting}
              disabled={isDeleting}
            >
              删除组织
            </Button>
          ) : (
            <Button
              variant="danger"
              fullWidth
              onPress={handleLeaveGroup}
              loading={isLeaving}
              disabled={isLeaving}
            >
              离开组织
            </Button>
          )}
        </View>
      </ScrollView>
    </MainLayout>
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
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  infoCard: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    marginBottom: 0,
  },
  groupName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
    textAlign: 'center',
  },
  typeBadge: {
    backgroundColor: '#f3e8ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginBottom: 16,
  },
  typeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#a78bfa',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#64748b',
  },
  sectionCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  sectionText: {
    fontSize: 15,
    color: '#64748b',
    lineHeight: 22,
  },
  membersList: {
    gap: 12,
  },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  memberAvatar: {
    marginRight: 12,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  memberRole: {
    fontSize: 13,
    color: '#64748b',
  },
  actionsContainer: {
    marginTop: 8,
    marginBottom: 24,
  },
});

export default GroupManagementScreen;


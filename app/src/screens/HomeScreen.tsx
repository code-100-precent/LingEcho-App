/**
 * 首页
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { MainLayout, Card, StatCard } from '../components';
import OrganizationDrawer from '../components/OrganizationDrawer';
import { useAuth } from '../context/AuthContext';
import { getUsageStatistics } from '../services/api/billing';
import { getGroupList, Group } from '../services/api/group';

const HomeScreen: React.FC = () => {
  const { user } = useAuth();
  const navigation = useNavigation();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [stats, setStats] = useState({
    totalTokens: 0,
    llmCalls: 0,
    asrCalls: 0,
    ttsCalls: 0,
  });
  const [isLoadingStats, setIsLoadingStats] = useState(false);

  useEffect(() => {
    loadStatistics();
  }, []);

  const loadStatistics = async () => {
    setIsLoadingStats(true);
    try {
      const response = await getUsageStatistics();
      if (response.code === 200 && response.data) {
        setStats({
          totalTokens: response.data.totalTokens || 0,
          llmCalls: response.data.llmCalls || 0,
          asrCalls: response.data.asrCalls || 0,
          ttsCalls: response.data.ttsCalls || 0,
        });
      }
    } catch (error: any) {
      console.error('Load statistics error:', error);
    } finally {
      setIsLoadingStats(false);
    }
  };

  const handleSelectGroup = (group: Group) => {
    setSelectedGroup(group);
    // 可以在这里处理组织切换逻辑
    console.log('Selected group:', group);
  };

  return (
    <>
      <MainLayout
        navBarProps={{
          title: 'LingEcho',
          leftIcon: 'menu',
          onLeftPress: () => setDrawerVisible(true),
          rightIcon: 'bell',
          onRightPress: () => {
            navigation.navigate('Notification' as never);
          },
        }}
        backgroundColor="#f8fafc"
      >
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
          {/* 欢迎卡片 */}
          <Card variant="default" padding="lg" style={styles.welcomeCard}>
            <View style={styles.welcomeContent}>
              <View style={styles.welcomeTextContainer}>
                <Text style={styles.welcomeGreeting}>你好，</Text>
                <Text style={styles.welcomeName}>
                  {user?.displayName || user?.email?.split('@')[0] || '用户'}
                </Text>
                {selectedGroup ? (
                  <View style={styles.groupBadge}>
                    <Feather name="users" size={14} color="#a78bfa" />
                    <Text style={styles.groupBadgeText}>{selectedGroup.name}</Text>
                  </View>
                ) : (
                  <Text style={styles.welcomeSubtitle}>开始使用智能助手吧</Text>
                )}
              </View>
              <View style={styles.welcomeIconContainer}>
                <View style={styles.welcomeIcon}>
                  <Feather name="zap" size={28} color="#a78bfa" />
                </View>
              </View>
            </View>
          </Card>

          {/* 统计卡片 */}
          <View style={styles.statsSection}>
            <Text style={styles.sectionTitle}>使用统计</Text>
            {isLoadingStats ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#a78bfa" />
              </View>
            ) : (
              <View style={styles.statsGrid}>
                <StatCard
                  title="总Token数"
                  value={stats.totalTokens.toLocaleString()}
                  icon={<Feather name="cpu" size={20} color="#a78bfa" />}
                  iconColor="#a78bfa"
                  style={styles.statCard}
                />
                <StatCard
                  title="LLM调用"
                  value={stats.llmCalls.toLocaleString()}
                  icon={<Feather name="message-circle" size={20} color="#3b82f6" />}
                  iconColor="#3b82f6"
                  style={styles.statCard}
                />
                <StatCard
                  title="ASR调用"
                  value={stats.asrCalls.toLocaleString()}
                  icon={<Feather name="mic" size={20} color="#10b981" />}
                  iconColor="#10b981"
                  style={styles.statCard}
                />
                <StatCard
                  title="TTS调用"
                  value={stats.ttsCalls.toLocaleString()}
                  icon={<Feather name="volume-2" size={20} color="#f59e0b" />}
                  iconColor="#f59e0b"
                  style={styles.statCard}
                />
              </View>
            )}
          </View>

          {/* 快捷入口 */}
          <View style={styles.quickActionsSection}>
            <Text style={styles.sectionTitle}>快捷入口</Text>
            <View style={styles.quickActionsGrid}>
              <TouchableOpacity
                style={styles.quickActionItem}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('Assistant' as never)}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: '#e0e7ff' }]}>
                  <Feather name="message-circle" size={24} color="#3b82f6" />
                </View>
                <Text style={styles.quickActionLabel}>智能助手</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickActionItem}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('Billing' as never)}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: '#fef3c7' }]}>
                  <Feather name="file-text" size={24} color="#f59e0b" />
                </View>
                <Text style={styles.quickActionLabel}>账单管理</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickActionItem}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('Device' as never)}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: '#d1fae5' }]}>
                  <Feather name="smartphone" size={24} color="#10b981" />
                </View>
                <Text style={styles.quickActionLabel}>设备管理</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickActionItem}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('Profile' as never)}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: '#f3e8ff' }]}>
                  <Feather name="user" size={24} color="#a78bfa" />
                </View>
                <Text style={styles.quickActionLabel}>个人设置</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </MainLayout>

      {/* 组织抽屉 */}
      <OrganizationDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        onSelectGroup={handleSelectGroup}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  welcomeCard: {
    marginBottom: 24,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
  },
  welcomeContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcomeTextContainer: {
    flex: 1,
  },
  welcomeGreeting: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 4,
  },
  welcomeName: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
  },
  groupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3e8ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  groupBadgeText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#a78bfa',
    marginLeft: 6,
  },
  welcomeIconContainer: {
    marginLeft: 16,
  },
  welcomeIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#f3e8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  loadingContainer: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: '48%',
  },
  quickActionsSection: {
    marginBottom: 24,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionItem: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
  },
});

export default HomeScreen;

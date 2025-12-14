/**
 * 我的页面
 */
import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Animated,
  LayoutAnimation,
  Platform,
  UIManager,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Feather } from '@expo/vector-icons';
import { ActivityIndicator } from 'react-native';
import { MainLayout, Avatar, Card, Switch, Input, Button, Modal } from '../components';
import VerificationCodeInput from '../components/VerificationCodeInput';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import {
  getProfile,
  updateProfile,
  updatePreferences,
  changePassword,
  getUserActivity,
  getTwoFactorStatus,
  setupTwoFactor,
  enableTwoFactor,
  disableTwoFactor,
  uploadAvatar,
  ActivityLog,
} from '../services/api/profile';

// 启用布局动画
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface MenuItem {
  id: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
  onPress: () => void;
  showArrow?: boolean;
  variant?: 'default' | 'danger';
}

interface InfoItem {
  label: string;
  value: string;
}

type ProfileScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Main'>;

const ProfileScreen: React.FC = () => {
  const { user, logout, refreshUser } = useAuth();
  const navigation = useNavigation<ProfileScreenNavigationProp>();
  const [activeTab, setActiveTab] = useState<'profile' | 'settings' | 'security'>('profile');
  const [isLoading, setIsLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [isLoadingActivities, setIsLoadingActivities] = useState(false);
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(false);
  const [isLoadingTwoFactor, setIsLoadingTwoFactor] = useState(false);
  const [showTwoFactorModal, setShowTwoFactorModal] = useState(false);
  const [showTwoFactorSetup, setShowTwoFactorSetup] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [twoFactorAction, setTwoFactorAction] = useState<'enable' | 'disable'>('enable');
  const [twoFactorSetupData, setTwoFactorSetupData] = useState<{
    qrCode: string;
    secret: string;
    url: string;
  } | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  
  // 偏好设置的乐观更新状态
  const [optimisticPreferences, setOptimisticPreferences] = useState({
    emailNotifications: user?.emailNotifications || false,
    pushNotifications: user?.pushNotifications || false,
    systemNotifications: user?.systemNotifications || false,
  });
  
  // 动画值
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const [formData, setFormData] = useState({
    email: user?.email || '',
    phone: user?.phone || '',
    displayName: user?.displayName || '',
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    locale: user?.locale || 'zh-CN',
    timezone: user?.timezone || 'Asia/Shanghai',
    gender: user?.gender || '',
    extra: user?.extra || '',
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // 加载用户资料
  React.useEffect(() => {
    if (user) {
      setFormData({
        email: user.email || '',
        phone: user.phone || '',
        displayName: user.displayName || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        locale: user.locale || 'zh-CN',
        timezone: user.timezone || 'Asia/Shanghai',
        gender: user.gender || '',
        extra: user.extra || '',
      });
      // 更新乐观状态
      setOptimisticPreferences({
        emailNotifications: user.emailNotifications || false,
        pushNotifications: user.pushNotifications || false,
        systemNotifications: user.systemNotifications || false,
      });
    }
  }, [user]);

  // 加载活动记录
  const loadActivities = async () => {
    setIsLoadingActivities(true);
    try {
      const response = await getUserActivity({ page: 1, limit: 10 });
      if (response.code === 200 && response.data) {
        setActivities(response.data.activities || []);
      }
    } catch (error: any) {
      console.error('Failed to load activities:', error);
    } finally {
      setIsLoadingActivities(false);
    }
  };

  // 加载两步验证状态
  const loadTwoFactorStatus = async () => {
    setIsLoadingTwoFactor(true);
    try {
      const response = await getTwoFactorStatus();
      if (response.code === 200 && response.data) {
        setTwoFactorEnabled(response.data.enabled || false);
      }
    } catch (error: any) {
      console.error('Failed to load two factor status:', error);
    } finally {
      setIsLoadingTwoFactor(false);
    }
  };

  React.useEffect(() => {
    if (activeTab === 'security') {
      loadActivities();
      loadTwoFactorStatus();
    }
  }, [activeTab]);

  // Tab切换动画
  React.useEffect(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, [activeTab]);

  // 保存用户资料
  const handleSave = async () => {
    setIsLoading(true);
    try {
      const response = await updateProfile(formData);
      if (response.code === 200) {
        await refreshUser();
        setIsEditing(false);
        Alert.alert('成功', '资料更新成功');
      } else {
        Alert.alert('错误', response.msg || '更新失败');
      }
    } catch (error: any) {
      console.error('Update profile error:', error);
      Alert.alert('错误', error.msg || error.message || '更新失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 修改密码
  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      Alert.alert('错误', '两次输入的密码不一致');
      return;
    }

    setIsLoading(true);
    try {
      const response = await changePassword(passwordData);
      if (response.code === 200) {
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setIsChangingPassword(false);
        Alert.alert('成功', '密码修改成功');
      } else {
        Alert.alert('错误', response.msg || '密码修改失败');
      }
    } catch (error: any) {
      console.error('Change password error:', error);
      Alert.alert('错误', error.msg || error.message || '密码修改失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 上传头像
  const handleAvatarUpload = async () => {
    try {
      // 请求图片库权限
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('权限错误', '需要访问图片库权限才能上传头像');
        return;
      }

      // 打开图片选择器
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        setIsUploadingAvatar(true);

        try {
          // 准备文件数据
          const file = {
            uri: asset.uri,
            type: 'image/jpeg',
            name: 'avatar.jpg',
          };

          const response = await uploadAvatar(file);
          
          if (response.code === 200 && response.data) {
            // 更新用户信息
            await refreshUser();
            Alert.alert('成功', '头像上传成功');
          } else {
            Alert.alert('错误', response.msg || '头像上传失败');
          }
        } catch (error: any) {
          console.error('Upload avatar error:', error);
          Alert.alert('错误', error.msg || error.message || '头像上传失败');
        } finally {
          setIsUploadingAvatar(false);
        }
      }
    } catch (error: any) {
      console.error('Image picker error:', error);
      Alert.alert('错误', '选择图片失败');
    }
  };

  // 更新偏好设置 - 乐观更新
  const handlePreferenceChange = async (key: string, value: boolean) => {
    // 立即更新UI（乐观更新）
    const previousValue = optimisticPreferences[key as keyof typeof optimisticPreferences];
    setOptimisticPreferences((prev) => ({
      ...prev,
      [key]: value,
    }));

    try {
      const response = await updatePreferences({ [key]: value });
      if (response.code === 200) {
        await refreshUser();
      } else {
        // 如果失败，回滚状态
        setOptimisticPreferences((prev) => ({
          ...prev,
          [key]: previousValue,
        }));
        Alert.alert('错误', response.msg || '更新失败');
      }
    } catch (error: any) {
      // 如果失败，回滚状态
      setOptimisticPreferences((prev) => ({
        ...prev,
        [key]: previousValue,
      }));
      console.error('Update preference error:', error);
      Alert.alert('错误', error.msg || error.message || '更新失败');
    }
  };

  const handleLogout = () => {
    Alert.alert(
      '确认退出',
      '您确定要退出登录吗？',
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '退出',
          style: 'destructive',
          onPress: async () => {
            await logout();
          },
        },
      ]
    );
  };

  const infoItems: InfoItem[] = [
    { label: '用户ID', value: `#${user?.id || 'N/A'}` },
    { label: '账户状态', value: '正常' },
  ];

  const menuItems: MenuItem[] = [
    {
      id: 'help',
      label: '帮助与反馈',
      icon: 'help-circle',
      onPress: () => {
        navigation.navigate('HelpFeedback' as never);
      },
    },
    {
      id: 'about',
      label: '关于我们',
      icon: 'info',
      onPress: () => {
        navigation.navigate('About' as never);
      },
    },
    {
      id: 'logout',
      label: '退出登录',
      icon: 'log-out',
      onPress: handleLogout,
      variant: 'danger',
    },
  ];

  const renderProfileTab = () => (
    <Card variant="default" padding="lg" style={styles.tabCard}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>基本信息</Text>
        {!isEditing ? (
          <Button variant="outline" size="sm" onPress={() => setIsEditing(true)}>
            <Feather name="edit-3" size={14} color="#1e293b" />
            <Text style={styles.editButtonText}>编辑</Text>
          </Button>
        ) : (
          <View style={styles.editActions}>
            <Button
              variant="outline"
              size="sm"
              onPress={() => {
                setIsEditing(false);
                setFormData({
                  email: user?.email || '',
                  phone: user?.phone || '',
                  displayName: user?.displayName || '',
                  firstName: user?.firstName || '',
                  lastName: user?.lastName || '',
                  locale: user?.locale || 'zh-CN',
                  timezone: user?.timezone || 'Asia/Shanghai',
                  gender: user?.gender || '',
                  extra: user?.extra || '',
                });
              }}
            >
              <Text>取消</Text>
            </Button>
            <Button variant="primary" size="sm" onPress={handleSave} disabled={isLoading}>
              <Text style={{ color: '#ffffff', fontSize: 13 }}>{isLoading ? '保存中...' : '保存'}</Text>
            </Button>
          </View>
        )}
      </View>
      <View style={styles.infoList}>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>显示名称</Text>
          {isEditing ? (
            <View style={styles.inputContainer}>
              <Input
                value={formData.displayName}
                onChangeText={(text) => setFormData({ ...formData, displayName: text })}
                placeholder="请输入显示名称"
                style={styles.input}
              />
            </View>
          ) : (
            <Text style={styles.infoValue}>{user?.displayName || '未设置'}</Text>
          )}
        </View>
        <View style={styles.infoItem}>
          <Text style={styles.infoLabel}>邮箱</Text>
          {isEditing ? (
            <View style={styles.inputContainer}>
              <Input
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
                placeholder="请输入邮箱"
                style={styles.input}
              />
            </View>
          ) : (
            <Text style={styles.infoValue}>{user?.email || '未设置'}</Text>
          )}
        </View>
        {isEditing && (
          <>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>手机号</Text>
              <View style={styles.inputContainer}>
                <Input
                  value={formData.phone}
                  onChangeText={(text) => setFormData({ ...formData, phone: text })}
                  placeholder="请输入手机号"
                  style={styles.input}
                />
              </View>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>名</Text>
              <View style={styles.inputContainer}>
                <Input
                  value={formData.firstName}
                  onChangeText={(text) => setFormData({ ...formData, firstName: text })}
                  placeholder="请输入名"
                  style={styles.input}
                />
              </View>
            </View>
            <View style={styles.infoItem}>
              <Text style={styles.infoLabel}>姓</Text>
              <View style={styles.inputContainer}>
                <Input
                  value={formData.lastName}
                  onChangeText={(text) => setFormData({ ...formData, lastName: text })}
                  placeholder="请输入姓"
                  style={styles.input}
                />
              </View>
            </View>
          </>
        )}
      </View>
    </Card>
  );

  const renderSettingsTab = () => (
    <Card variant="default" padding="lg" style={styles.tabCard}>
      <Text style={styles.sectionTitle}>偏好设置</Text>
      <View style={styles.settingsList}>
        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <View style={styles.settingIconContainer}>
              <Feather name="mail" size={18} color="#64748b" />
            </View>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>邮件通知</Text>
              <Text style={styles.settingDesc}>接收邮件通知</Text>
            </View>
          </View>
          <Switch
            checked={optimisticPreferences.emailNotifications}
            onCheckedChange={(checked: boolean) => handlePreferenceChange('emailNotifications', checked)}
          />
        </View>
        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <View style={styles.settingIconContainer}>
              <Feather name="bell" size={18} color="#64748b" />
            </View>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>推送通知</Text>
              <Text style={styles.settingDesc}>接收推送通知</Text>
            </View>
          </View>
          <Switch
            checked={optimisticPreferences.pushNotifications}
            onCheckedChange={(checked: boolean) => handlePreferenceChange('pushNotifications', checked)}
          />
        </View>
        <View style={styles.settingItem}>
          <View style={styles.settingLeft}>
            <View style={styles.settingIconContainer}>
              <Feather name="zap" size={18} color="#64748b" />
            </View>
            <View style={styles.settingText}>
              <Text style={styles.settingLabel}>系统通知</Text>
              <Text style={styles.settingDesc}>接收系统通知</Text>
            </View>
          </View>
          <Switch
            checked={optimisticPreferences.systemNotifications}
            onCheckedChange={(checked: boolean) => handlePreferenceChange('systemNotifications', checked)}
          />
        </View>
      </View>
    </Card>
  );

  const renderSecurityTab = () => (
    <Card variant="default" padding="lg" style={styles.tabCard}>
      <Text style={styles.sectionTitle}>安全设置</Text>
      <View style={styles.securityList}>
        <TouchableOpacity
          style={styles.securityItem}
          activeOpacity={0.7}
          onPress={() => setIsChangingPassword(!isChangingPassword)}
        >
          <View style={styles.securityLeft}>
            <View style={styles.securityIconContainer}>
              <Feather name="key" size={18} color="#ef4444" />
            </View>
            <View style={styles.securityText}>
              <Text style={styles.securityLabel}>更改密码</Text>
              <Text style={styles.securityDesc}>定期更新密码以保护账户安全</Text>
            </View>
          </View>
          <Feather name="chevron-right" size={20} color="#94a3b8" />
        </TouchableOpacity>
        
        {isChangingPassword && (
          <Card variant="default" padding="md" style={styles.passwordCard}>
            <Input
              label="当前密码"
              value={passwordData.currentPassword}
              onChangeText={(text) => setPasswordData({ ...passwordData, currentPassword: text })}
              placeholder="请输入当前密码"
              secureTextEntry
            />
            <Input
              label="新密码"
              value={passwordData.newPassword}
              onChangeText={(text) => setPasswordData({ ...passwordData, newPassword: text })}
              placeholder="请输入新密码"
              secureTextEntry
            />
            <Input
              label="确认新密码"
              value={passwordData.confirmPassword}
              onChangeText={(text) => setPasswordData({ ...passwordData, confirmPassword: text })}
              placeholder="请再次输入新密码"
              secureTextEntry
            />
            <View style={styles.passwordActions}>
              <Button
                variant="outline"
                onPress={() => {
                  setIsChangingPassword(false);
                  setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
                }}
                style={styles.passwordButton}
              >
                <Text>取消</Text>
              </Button>
              <Button
                variant="primary"
                onPress={handlePasswordChange}
                disabled={isLoading}
                style={styles.passwordButton}
              >
                <Text style={{ color: '#ffffff', fontSize: 13 }}>{isLoading ? '修改中...' : '确认修改'}</Text>
              </Button>
            </View>
          </Card>
        )}

        <View style={styles.securityItem}>
          <View style={styles.securityLeft}>
            <View style={styles.securityIconContainer}>
              <Feather name="shield" size={18} color="#64748b" />
            </View>
            <View style={styles.securityText}>
              <Text style={styles.securityLabel}>两步验证</Text>
              <Text style={styles.securityDesc}>
                {twoFactorEnabled ? '已启用' : '为您的账户添加额外的安全保护'}
              </Text>
            </View>
          </View>
          <Switch
            checked={twoFactorEnabled}
            onCheckedChange={async (checked: boolean) => {
              if (checked) {
                // 启用两步验证 - 先获取二维码
                setIsLoadingTwoFactor(true);
                try {
                  const setupResponse = await setupTwoFactor();
                  if (setupResponse.code === 200 && setupResponse.data) {
                    setTwoFactorSetupData(setupResponse.data);
                    setTwoFactorAction('enable');
                    setTwoFactorCode('');
                    setShowTwoFactorSetup(true);
                  } else {
                    Alert.alert('错误', setupResponse.msg || '设置失败');
                  }
                } catch (error: any) {
                  Alert.alert('错误', error.msg || '设置失败');
                } finally {
                  setIsLoadingTwoFactor(false);
                }
              } else {
                // 禁用两步验证 - 直接输入验证码
                setTwoFactorAction('disable');
                setTwoFactorCode('');
                setShowTwoFactorModal(true);
              }
            }}
            disabled={isLoadingTwoFactor}
          />
        </View>

        {/* 活动记录 */}
        <View style={styles.activitySection}>
          <Text style={styles.activityTitle}>最近活动</Text>
          {isLoadingActivities ? (
            <View style={styles.activityLoading}>
              <ActivityIndicator size="small" color="#64748b" />
              <Text style={styles.activityLoadingText}>加载中...</Text>
            </View>
          ) : activities.length === 0 ? (
            <Text style={styles.activityEmpty}>暂无活动记录</Text>
          ) : (
            <View style={styles.activityList}>
              {activities.map((activity) => (
                <View key={activity.id} style={styles.activityItem}>
                  <View style={styles.activityHeader}>
                    <Text style={styles.activityAction}>{activity.action}</Text>
                    <Text style={styles.activityTime}>
                      {new Date(activity.createdAt).toLocaleString('zh-CN')}
                    </Text>
                  </View>
                  <Text style={styles.activityTarget}>{activity.target}</Text>
                  {activity.details && (
                    <Text style={styles.activityDetails}>{activity.details}</Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </View>
    </Card>
  );

  return (
    <MainLayout
      navBarProps={{
        title: '我的',
      }}
      backgroundColor="#f8fafc"
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 用户信息卡片 */}
        <Card variant="default" padding="lg" style={styles.profileCard}>
          <View style={styles.profileHeader}>
            <TouchableOpacity
              onPress={handleAvatarUpload}
              disabled={isUploadingAvatar}
              activeOpacity={0.7}
            >
              <View style={styles.avatarContainer}>
                <Avatar
                  src={user?.avatar}
                  fallback={user?.displayName || user?.email || 'U'}
                  size="xl"
                  style={styles.avatar}
                />
                {isUploadingAvatar ? (
                  <View style={styles.avatarOverlay}>
                    <ActivityIndicator size="small" color="#ffffff" />
                  </View>
                ) : (
                  <View style={styles.avatarEditIcon}>
                    <Feather name="camera" size={16} color="#ffffff" />
                  </View>
                )}
              </View>
            </TouchableOpacity>
            <View style={styles.profileInfo}>
              <Text style={styles.displayName}>
                {user?.displayName || user?.email || '用户'}
              </Text>
              {user?.email && (
                <Text style={styles.email}>{user.email}</Text>
              )}
              <View style={styles.statusContainer}>
                <View style={styles.statusDot} />
                <Text style={styles.statusText}>在线</Text>
              </View>
            </View>
          </View>

          {/* 账户信息 */}
          <View style={styles.infoSection}>
            {infoItems.map((item, index) => (
              <View
                key={item.label}
                style={[
                  styles.infoRow,
                  index !== infoItems.length - 1 && styles.infoRowBorder,
                ]}
              >
                <Text style={styles.infoRowLabel}>{item.label}</Text>
                <Text style={styles.infoRowValue}>{item.value}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* 标签页切换 */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'profile' && styles.tabActive]}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setActiveTab('profile');
            }}
            activeOpacity={0.7}
          >
            <Feather
              name="user"
              size={16}
              color={activeTab === 'profile' ? '#a78bfa' : '#64748b'}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'profile' && styles.tabTextActive,
              ]}
            >
              个人资料
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'settings' && styles.tabActive]}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setActiveTab('settings');
            }}
            activeOpacity={0.7}
          >
            <Feather
              name="settings"
              size={16}
              color={activeTab === 'settings' ? '#a78bfa' : '#64748b'}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'settings' && styles.tabTextActive,
              ]}
            >
              偏好设置
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'security' && styles.tabActive]}
            onPress={() => {
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setActiveTab('security');
            }}
            activeOpacity={0.7}
          >
            <Feather
              name="shield"
              size={16}
              color={activeTab === 'security' ? '#a78bfa' : '#64748b'}
            />
            <Text
              style={[
                styles.tabText,
                activeTab === 'security' && styles.tabTextActive,
              ]}
            >
              安全设置
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tab内容 - 使用动画 */}
        <Animated.View
          style={[
            styles.tabContent,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {activeTab === 'profile' && renderProfileTab()}
          {activeTab === 'settings' && renderSettingsTab()}
          {activeTab === 'security' && renderSecurityTab()}
        </Animated.View>


        {/* 功能菜单 */}
        <Card variant="default" padding="none" style={styles.menuCard}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.menuItem,
                index !== menuItems.length - 1 && styles.menuItemBorder,
              ]}
              onPress={item.onPress}
              activeOpacity={0.7}
            >
              <View style={styles.menuItemLeft}>
                <View
                  style={[
                    styles.menuIconContainer,
                    item.variant === 'danger' && styles.menuIconContainerDanger,
                  ]}
                >
                  <Feather
                    name={item.icon}
                    size={18}
                    color={item.variant === 'danger' ? '#ef4444' : '#64748b'}
                  />
                </View>
                <Text
                  style={[
                    styles.menuLabel,
                    item.variant === 'danger' && styles.menuLabelDanger,
                  ]}
                >
                  {item.label}
                </Text>
              </View>
              {item.showArrow !== false && (
                <Feather
                  name="chevron-right"
                  size={18}
                  color="#94a3b8"
                />
              )}
            </TouchableOpacity>
          ))}
        </Card>

        {/* 底部间距 */}
        <View style={styles.footer} />
      </ScrollView>

      {/* 两步验证设置Modal - 显示二维码 */}
      <Modal
        isOpen={showTwoFactorSetup}
        onClose={() => {
          setShowTwoFactorSetup(false);
          setTwoFactorCode('');
          setTwoFactorSetupData(null);
        }}
        title="设置两步验证"
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalText}>
            请使用您的身份验证器应用（如 Google Authenticator、Microsoft Authenticator）扫描下面的二维码，然后输入生成的验证码。
          </Text>
          
          {twoFactorSetupData && (
            <View style={styles.qrCodeContainer}>
              <Image
                source={{ uri: twoFactorSetupData.qrCode }}
                style={styles.qrCode}
                resizeMode="contain"
              />
            </View>
          )}
          
          <View style={styles.verificationCodeContainer}>
            <Text style={styles.verificationCodeLabel}>验证码</Text>
            <VerificationCodeInput
              value={twoFactorCode}
              onChangeText={setTwoFactorCode}
              length={6}
            />
          </View>
          
          <View style={styles.modalActions}>
            <Button
              variant="outline"
              onPress={() => {
                setShowTwoFactorSetup(false);
                setTwoFactorCode('');
                setTwoFactorSetupData(null);
              }}
              style={styles.modalButton}
            >
              <Text>取消</Text>
            </Button>
            <Button
              variant="primary"
              onPress={async () => {
                if (twoFactorCode.length !== 6) {
                  Alert.alert('错误', '请输入6位验证码');
                  return;
                }

                setIsLoadingTwoFactor(true);
                try {
                  const enableResponse = await enableTwoFactor(twoFactorCode);
                  if (enableResponse.code === 200) {
                    setTwoFactorEnabled(true);
                    setShowTwoFactorSetup(false);
                    setTwoFactorCode('');
                    setTwoFactorSetupData(null);
                    Alert.alert('成功', '两步验证已启用');
                  } else {
                    Alert.alert('错误', enableResponse.msg || '启用失败');
                  }
                } catch (error: any) {
                  Alert.alert('错误', error.msg || error.message || '启用失败');
                } finally {
                  setIsLoadingTwoFactor(false);
                }
              }}
              disabled={isLoadingTwoFactor || twoFactorCode.length !== 6}
              style={styles.modalButton}
            >
              <Text style={{ color: '#ffffff' }}>
                {isLoadingTwoFactor ? '启用中...' : '启用'}
              </Text>
            </Button>
          </View>
        </View>
      </Modal>

      {/* 两步验证禁用Modal - 仅输入验证码 */}
      <Modal
        isOpen={showTwoFactorModal}
        onClose={() => {
          setShowTwoFactorModal(false);
          setTwoFactorCode('');
        }}
        title="禁用两步验证"
      >
        <View style={styles.modalContent}>
          <Text style={styles.modalText}>
            请输入6位验证码以确认禁用两步验证。禁用后将降低账户安全性。
          </Text>
          <View style={styles.verificationCodeContainer}>
            <Text style={styles.verificationCodeLabel}>验证码</Text>
            <VerificationCodeInput
              value={twoFactorCode}
              onChangeText={setTwoFactorCode}
              length={6}
            />
          </View>
          <View style={styles.modalActions}>
            <Button
              variant="outline"
              onPress={() => {
                setShowTwoFactorModal(false);
                setTwoFactorCode('');
              }}
              style={styles.modalButton}
            >
              <Text>取消</Text>
            </Button>
            <Button
              variant="primary"
              onPress={async () => {
                if (twoFactorCode.length !== 6) {
                  Alert.alert('错误', '请输入6位验证码');
                  return;
                }

                setIsLoadingTwoFactor(true);
                try {
                  const disableResponse = await disableTwoFactor(twoFactorCode);
                  if (disableResponse.code === 200) {
                    setTwoFactorEnabled(false);
                    setShowTwoFactorModal(false);
                    setTwoFactorCode('');
                    Alert.alert('成功', '两步验证已禁用');
                  } else {
                    Alert.alert('错误', disableResponse.msg || '禁用失败');
                  }
                } catch (error: any) {
                  Alert.alert('错误', error.msg || error.message || '禁用失败');
                } finally {
                  setIsLoadingTwoFactor(false);
                }
              }}
              disabled={isLoadingTwoFactor || twoFactorCode.length !== 6}
              style={styles.modalButton}
            >
              <Text style={{ color: '#ffffff' }}>
                {isLoadingTwoFactor ? '禁用中...' : '确认禁用'}
              </Text>
            </Button>
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
    padding: 16,
  },
  profileCard: {
    marginBottom: 16,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  avatarContainer: {
    position: 'relative',
    marginRight: 16,
  },
  avatar: {
    marginRight: 0,
  },
  avatarOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#a78bfa',
    borderRadius: 12,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#ffffff',
  },
  profileInfo: {
    flex: 1,
  },
  displayName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#10b981',
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#64748b',
  },
  infoSection: {
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  infoRowLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  infoRowValue: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '500',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 4,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    gap: 6,
  },
  tabActive: {
    backgroundColor: '#f1f5f9',
  },
  tabText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  tabTextActive: {
    color: '#a78bfa',
    fontWeight: '600',
  },
  tabContent: {
    minHeight: 200,
  },
  inputContainer: {
    flex: 1,
    marginLeft: 12,
  },
  input: {
    flex: 1,
  },
  tabCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
  },
  infoList: {
    gap: 16,
  },
  infoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  infoValue: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '500',
  },
  settingsList: {
    gap: 16,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  settingText: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
    marginBottom: 2,
  },
  settingDesc: {
    fontSize: 12,
    color: '#64748b',
  },
  securityList: {
    gap: 12,
  },
  securityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
  },
  securityLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  securityIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  securityText: {
    flex: 1,
  },
  securityLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
    marginBottom: 2,
  },
  securityDesc: {
    fontSize: 12,
    color: '#64748b',
  },
  menuCard: {
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  menuItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  menuIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  menuIconContainerDanger: {
    backgroundColor: '#fef2f2',
  },
  menuLabel: {
    fontSize: 15,
    color: '#1e293b',
    fontWeight: '500',
  },
  menuLabelDanger: {
    color: '#ef4444',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editButtonText: {
    fontSize: 13,
    color: '#1e293b',
    marginLeft: 4,
  },
  passwordCard: {
    marginTop: 12,
    marginBottom: 12,
  },
  passwordActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  passwordButton: {
    flex: 1,
  },
  activitySection: {
    marginTop: 24,
    paddingTop: 24,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  activityLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  activityLoadingText: {
    fontSize: 14,
    color: '#64748b',
  },
  activityEmpty: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    paddingVertical: 20,
  },
  activityList: {
    gap: 12,
  },
  activityItem: {
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
  },
  activityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  activityAction: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1e293b',
  },
  activityTime: {
    fontSize: 12,
    color: '#64748b',
  },
  activityTarget: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 4,
  },
  activityDetails: {
    fontSize: 12,
    color: '#94a3b8',
  },
  footer: {
    height: 20,
  },
  modalContent: {
    padding: 20,
  },
  modalText: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 16,
    lineHeight: 20,
  },
  modalInput: {
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
  },
  qrCodeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  qrCode: {
    width: 200,
    height: 200,
  },
  verificationCodeContainer: {
    marginBottom: 16,
  },
  verificationCodeLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 12,
  },
});

export default ProfileScreen;


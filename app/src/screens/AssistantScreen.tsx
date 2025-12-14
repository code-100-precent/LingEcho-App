/**
 * 助手列表页面
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
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { MainLayout, Card, Button, EmptyState, Modal, Input } from '../components';
import {
  getAssistantList,
  createAssistant,
  deleteAssistant,
  AssistantListItem,
  CreateAssistantForm,
} from '../services/api/assistant';

// 图标映射
const ICON_MAP: Record<string, keyof typeof Feather.glyphMap> = {
  Bot: 'message-circle',
  MessageCircle: 'message-circle',
  Users: 'users',
  Zap: 'zap',
  Circle: 'circle',
};

const ICON_COLORS: Record<string, string> = {
  Bot: '#a78bfa',
  MessageCircle: '#3b82f6',
  Users: '#10b981',
  Zap: '#f59e0b',
  Circle: '#64748b',
};

const AssistantScreen: React.FC = () => {
  const navigation = useNavigation();
  const [assistants, setAssistants] = useState<AssistantListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: 'Bot',
  });
  const [selectedAssistant, setSelectedAssistant] = useState<AssistantListItem | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // 加载助手列表
  const fetchAssistants = async () => {
    setIsLoading(true);
    try {
      const response = await getAssistantList();
      if (response.code === 200 && response.data) {
        setAssistants(response.data);
      } else {
        Alert.alert('错误', response.msg || '加载助手列表失败');
      }
    } catch (error: any) {
      console.error('Failed to load assistants:', error);
      if (error.code !== 401) {
        Alert.alert('错误', error.msg || '加载助手列表失败');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAssistants();
  }, []);

  // 创建助手
  const handleCreateAssistant = async () => {
    if (!formData.name.trim()) {
      Alert.alert('提示', '请输入助手名称');
      return;
    }

    setIsCreating(true);
    try {
      const createData: CreateAssistantForm = {
        name: formData.name.trim(),
        description: formData.description.trim() || undefined,
        icon: formData.icon,
      };
      const response = await createAssistant(createData);
      if (response.code === 200) {
        Alert.alert('成功', '助手创建成功');
        setShowAddModal(false);
        setFormData({ name: '', description: '', icon: 'Bot' });
        fetchAssistants();
      } else {
        Alert.alert('错误', response.msg || '创建失败');
      }
    } catch (error: any) {
      console.error('Create assistant error:', error);
      Alert.alert('错误', error.msg || error.message || '创建失败');
    } finally {
      setIsCreating(false);
    }
  };

  // 删除助手
  const handleDeleteAssistant = async () => {
    if (!selectedAssistant) return;

    try {
      const response = await deleteAssistant(selectedAssistant.id);
      if (response.code === 200) {
        Alert.alert('成功', '助手已删除');
        setShowDeleteConfirm(false);
        setSelectedAssistant(null);
        fetchAssistants();
      } else {
        Alert.alert('错误', response.msg || '删除失败');
      }
    } catch (error: any) {
      console.error('Delete assistant error:', error);
      Alert.alert('错误', error.msg || error.message || '删除失败');
    }
  };

  const getIconName = (icon: string): keyof typeof Feather.glyphMap => {
    return ICON_MAP[icon] || 'circle';
  };

  const getIconColor = (icon: string): string => {
    return ICON_COLORS[icon] || '#64748b';
  };

  return (
    <MainLayout
      navBarProps={{
        title: '智能助手',
        rightIcon: 'plus',
        onRightPress: () => setShowAddModal(true),
      }}
      backgroundColor="#f8fafc"
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#a78bfa" />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        ) : assistants.length === 0 ? (
          <EmptyState
            title="还没有助手"
            description="创建您的第一个智能助手，开始智能对话之旅"
            icon={<Feather name="message-circle" size={64} color="#a78bfa" />}
            action={{
              label: '创建助手',
              onPress: () => setShowAddModal(true),
            }}
          />
        ) : (
          <View style={styles.grid}>
            {assistants.map((assistant, index) => {
              const iconName = getIconName(assistant.icon);
              const iconColor = getIconColor(assistant.icon);

              return (
                <Card
                  key={assistant.id}
                  variant="elevated"
                  padding="lg"
                  style={styles.assistantCard}
                >
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      navigation.navigate('AssistantDetail' as never, {
                        assistantId: assistant.id,
                      } as never);
                    }}
                    style={styles.assistantTouchable}
                  >
                    <View style={styles.assistantBody}>
                      <View style={styles.assistantMain}>
                        <View
                          style={[
                            styles.iconContainer,
                            { backgroundColor: `${iconColor}15` },
                          ]}
                        >
                          <Feather name={iconName} size={28} color={iconColor} />
                        </View>
                        <View style={styles.assistantInfo}>
                          <View style={styles.assistantTitleRow}>
                            <Text style={styles.assistantName} numberOfLines={1}>
                              {assistant.name}
                            </Text>
                            {assistant.groupId && (
                              <View style={styles.groupBadge}>
                                <Feather name="users" size={12} color="#3b82f6" />
                                <Text style={styles.groupBadgeText}>组织</Text>
                              </View>
                            )}
                          </View>
                          {assistant.description && (
                            <Text style={styles.assistantDescription} numberOfLines={2}>
                              {assistant.description}
                            </Text>
                          )}
                        </View>
                      </View>
                      <View style={styles.assistantActions}>
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={(e) => {
                            e.stopPropagation();
                            // TODO: 导航到助手配置页
                            Alert.alert('提示', `配置助手: ${assistant.name}`);
                          }}
                          activeOpacity={0.7}
                        >
                          <Feather name="settings" size={18} color="#64748b" />
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[styles.actionButton, styles.deleteButton]}
                          onPress={(e) => {
                            e.stopPropagation();
                            setSelectedAssistant(assistant);
                            setShowDeleteConfirm(true);
                          }}
                          activeOpacity={0.7}
                        >
                          <Feather name="trash-2" size={18} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </TouchableOpacity>
                </Card>
              );
            })}
          </View>
        )}

        {/* 底部间距 */}
        <View style={styles.footer} />
      </ScrollView>

      {/* 创建助手Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setFormData({ name: '', description: '', icon: 'Bot' });
        }}
        title="创建助手"
      >
        <View style={styles.modalContent}>
          <Input
            label="助手名称 *"
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
            placeholder="请输入助手名称"
            style={styles.modalInput}
          />
          <Input
            label="助手描述"
            value={formData.description}
            onChangeText={(text) => setFormData({ ...formData, description: text })}
            placeholder="请输入助手描述（可选）"
            multiline
            numberOfLines={3}
            style={styles.modalInput}
          />

          <View style={styles.iconSelector}>
            <Text style={styles.iconSelectorLabel}>选择图标</Text>
            <View style={styles.iconOptions}>
              {Object.keys(ICON_MAP).map((iconKey) => (
                <TouchableOpacity
                  key={iconKey}
                  style={[
                    styles.iconOption,
                    formData.icon === iconKey && styles.iconOptionActive,
                  ]}
                  onPress={() => setFormData({ ...formData, icon: iconKey })}
                  activeOpacity={0.7}
                >
                  <View
                    style={[
                      styles.iconOptionIcon,
                      { backgroundColor: `${getIconColor(iconKey)}15` },
                    ]}
                  >
                    <Feather
                      name={getIconName(iconKey)}
                      size={20}
                      color={getIconColor(iconKey)}
                    />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.modalActions}>
            <Button
              variant="outline"
              onPress={() => {
                setShowAddModal(false);
                setFormData({ name: '', description: '', icon: 'Bot' });
              }}
              style={styles.modalButton}
            >
              <Text>取消</Text>
            </Button>
            <Button
              variant="primary"
              onPress={handleCreateAssistant}
              disabled={isCreating || !formData.name.trim()}
              style={styles.modalButton}
            >
              <Text style={{ color: '#ffffff' }}>
                {isCreating ? '创建中...' : '创建'}
              </Text>
            </Button>
          </View>
        </View>
      </Modal>

      {/* 删除确认Modal */}
      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => {
          setShowDeleteConfirm(false);
          setSelectedAssistant(null);
        }}
        title="确认删除"
      >
        <View style={styles.modalContent}>
          <Text style={styles.deleteConfirmText}>
            确定要删除助手 "{selectedAssistant?.name}" 吗？此操作不可恢复。
          </Text>
          <View style={styles.modalActions}>
            <Button
              variant="outline"
              onPress={() => {
                setShowDeleteConfirm(false);
                setSelectedAssistant(null);
              }}
              style={styles.modalButton}
            >
              <Text>取消</Text>
            </Button>
            <Button
              variant="destructive"
              onPress={handleDeleteAssistant}
              style={styles.modalButton}
            >
              <Text style={{ color: '#ffffff' }}>删除</Text>
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  assistantCard: {
    flex: 1,
    minWidth: '100%',
    maxWidth: '100%',
    marginBottom: 0,
  },
  assistantTouchable: {
    width: '100%',
  },
  assistantBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  assistantMain: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
    flexShrink: 0,
  },
  assistantInfo: {
    flex: 1,
    minWidth: 0,
  },
  assistantTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  assistantName: {
    fontSize: 17,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  groupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: '#dbeafe',
    gap: 4,
    flexShrink: 0,
  },
  groupBadgeText: {
    fontSize: 11,
    color: '#3b82f6',
    fontWeight: '500',
  },
  assistantDescription: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  assistantActions: {
    flexDirection: 'row',
    gap: 8,
    flexShrink: 0,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButton: {
    backgroundColor: '#fef2f2',
  },
  modalContent: {
    padding: 20,
  },
  modalInput: {
    marginBottom: 16,
  },
  iconSelector: {
    marginBottom: 20,
  },
  iconSelectorLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
    marginBottom: 12,
  },
  iconOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  iconOption: {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  iconOptionActive: {
    borderColor: '#a78bfa',
    backgroundColor: '#f5f3ff',
  },
  iconOptionIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
  },
  deleteConfirmText: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 20,
  },
  footer: {
    height: 20,
  },
});

export default AssistantScreen;

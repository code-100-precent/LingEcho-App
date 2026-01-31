/**
 * 代接方案标签页
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
  Modal,
  TextInput,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Card, Button, Badge } from '../../components';
import {
  getSchemes,
  deleteScheme,
  activateScheme,
  deactivateScheme,
  createScheme,
  updateScheme,
  Scheme,
} from '../../services/api/scheme';
import { getAssistantList, AssistantListItem } from '../../services/api/assistant';

const SchemeTab: React.FC = () => {
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingScheme, setEditingScheme] = useState<Scheme | null>(null);
  const [showAssistantPicker, setShowAssistantPicker] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    assistantId: undefined as number | undefined,
    autoAnswer: true,
    autoAnswerDelay: 0,
    openingMessage: '',
    fallbackMessage: '',
    recordingEnabled: true,
    recordingMode: 'full' as 'full' | 'message',
    messageEnabled: true,
    messageDuration: 20,
    messagePrompt: '',
    boundPhoneNumber: '',
  });
  const [assistants, setAssistants] = useState<AssistantListItem[]>([]);

  useEffect(() => {
    loadSchemes();
    loadAssistants();
  }, []);

  const loadSchemes = async () => {
    try {
      setIsLoading(true);
      const response = await getSchemes();
      if (response.code === 200) {
        setSchemes(response.data || []);
      } else {
        // 只在非空数据错误时显示提示
        if (response.code !== 404) {
          Alert.alert('错误', response.msg || '获取方案列表失败');
        } else {
          setSchemes([]);
        }
      }
    } catch (error: any) {
      // 网络错误或其他异常才显示错误
      console.error('获取方案列表失败', error);
      setSchemes([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadAssistants = async () => {
    try {
      const response = await getAssistantList();
      if (response.code === 200) {
        setAssistants(response.data || []);
      }
    } catch (error) {
      console.error('获取助手列表失败', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadSchemes();
    setIsRefreshing(false);
  };

  const handleCreate = () => {
    setEditingScheme(null);
    setFormData({
      name: '',
      description: '',
      assistantId: undefined,
      autoAnswer: true,
      autoAnswerDelay: 0,
      openingMessage: '',
      fallbackMessage: '',
      recordingEnabled: true,
      recordingMode: 'full',
      messageEnabled: true,
      messageDuration: 20,
      messagePrompt: '',
      boundPhoneNumber: '',
    });
    setShowForm(true);
  };

  const handleEdit = (scheme: Scheme) => {
    setEditingScheme(scheme);
    setFormData({
      name: scheme.schemeName,
      description: scheme.description || '',
      assistantId: scheme.assistantId,
      autoAnswer: scheme.autoAnswer ?? true,
      autoAnswerDelay: scheme.autoAnswerDelay ?? 0,
      openingMessage: scheme.openingMessage || '',
      fallbackMessage: scheme.fallbackMessage || '',
      recordingEnabled: scheme.recordingEnabled ?? true,
      recordingMode: scheme.recordingMode || 'full',
      messageEnabled: scheme.messageEnabled ?? true,
      messageDuration: scheme.messageDuration ?? 20,
      messagePrompt: scheme.messagePrompt || '',
      boundPhoneNumber: scheme.boundPhoneNumber || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      Alert.alert('提示', '请输入方案名称');
      return;
    }

    if (!formData.assistantId) {
      Alert.alert('提示', '请选择AI助手');
      return;
    }

    try {
      // 转换字段名以匹配后端API
      const submitData = {
        schemeName: formData.name,
        description: formData.description,
        assistantId: formData.assistantId,
        autoAnswer: formData.autoAnswer,
        autoAnswerDelay: formData.autoAnswerDelay,
        openingMessage: formData.openingMessage,
        fallbackMessage: formData.fallbackMessage,
        recordingEnabled: formData.recordingEnabled,
        recordingMode: formData.recordingMode,
        messageEnabled: formData.messageEnabled,
        messageDuration: formData.messageDuration,
        messagePrompt: formData.messagePrompt,
        boundPhoneNumber: formData.boundPhoneNumber,
      };

      const response = editingScheme
        ? await updateScheme(editingScheme.id, submitData)
        : await createScheme(submitData);

      if (response.code === 200) {
        Alert.alert('成功', editingScheme ? '更新成功' : '创建成功');
        setShowForm(false);
        loadSchemes();
      } else {
        Alert.alert('错误', response.msg || '操作失败');
      }
    } catch (error: any) {
      Alert.alert('错误', error.message || '操作失败');
    }
  };

  const handleDelete = (scheme: Scheme) => {
    Alert.alert('确认删除', `确定要删除方案"${scheme.schemeName}"吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            const response = await deleteScheme(scheme.id);
            if (response.code === 200) {
              Alert.alert('成功', '删除成功');
              loadSchemes();
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

  const handleToggleActive = async (scheme: Scheme) => {
    try {
      const response = scheme.isActive
        ? await deactivateScheme(scheme.id)
        : await activateScheme(scheme.id);

      if (response.code === 200) {
        Alert.alert('成功', scheme.isActive ? '已停用' : '已激活');
        loadSchemes();
      } else {
        Alert.alert('错误', response.msg || '操作失败');
      }
    } catch (error: any) {
      Alert.alert('错误', error.message || '操作失败');
    }
  };

  const activeScheme = schemes.find((s) => s.isActive);

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
      {/* 激活方案横幅 */}
      {activeScheme && (
        <Card variant="default" padding="md" style={styles.activeBanner}>
          <View style={styles.activeBannerContent}>
            <View style={styles.activeBannerLeft}>
              <View style={styles.activeBannerIcon}>
                <Feather name="zap" size={20} color="#a855f7" />
              </View>
              <View>
                <Text style={styles.activeBannerTitle}>当前激活方案</Text>
                <Text style={styles.activeBannerName}>{activeScheme.schemeName}</Text>
              </View>
            </View>
            <Badge variant="success">
              <Text style={styles.badgeText}>运行中</Text>
            </Badge>
          </View>
        </Card>
      )}

      {/* 创建按钮 */}
      <Button variant="primary" onPress={handleCreate} style={styles.createButton}>
        <Feather name="plus" size={18} color="#ffffff" />
        <Text style={styles.createButtonText}>创建方案</Text>
      </Button>

      {/* 方案列表 */}
      {schemes.length === 0 ? (
        <Card variant="default" padding="lg" style={styles.emptyCard}>
          <View style={styles.emptyState}>
            <Feather name="settings" size={48} color="#cbd5e1" />
            <Text style={styles.emptyText}>还没有代接方案</Text>
            <Text style={styles.emptySubtext}>创建您的第一个AI代接方案</Text>
          </View>
        </Card>
      ) : (
        <View style={styles.schemeList}>
          {schemes.map((scheme) => (
            <Card key={scheme.id} variant="elevated" padding="md" style={styles.schemeCard}>
              <View style={styles.schemeHeader}>
                <View style={styles.schemeHeaderLeft}>
                  <Text style={styles.schemeName}>{scheme.schemeName}</Text>
                  {scheme.isActive && (
                    <Badge variant="success" style={styles.activeBadge}>
                      <Text style={styles.badgeText}>激活中</Text>
                    </Badge>
                  )}
                </View>
                <TouchableOpacity
                  onPress={() => handleToggleActive(scheme)}
                  style={styles.iconButton}
                >
                  <Feather
                    name={scheme.isActive ? 'power' : 'power'}
                    size={20}
                    color={scheme.isActive ? '#10b981' : '#94a3b8'}
                  />
                </TouchableOpacity>
              </View>

              {scheme.description && (
                <Text style={styles.schemeDescription}>{scheme.description}</Text>
              )}

              <View style={styles.schemeActions}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleEdit(scheme)}
                >
                  <Feather name="edit-3" size={16} color="#64748b" />
                  <Text style={styles.actionButtonText}>编辑</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => handleDelete(scheme)}
                >
                  <Feather name="trash-2" size={16} color="#ef4444" />
                  <Text style={[styles.actionButtonText, { color: '#ef4444' }]}>删除</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))}
        </View>
      )}

      {/* 创建/编辑表单模态框 */}
      <Modal
        visible={showForm}
        transparent
        animationType="slide"
        onRequestClose={() => setShowForm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingScheme ? '编辑方案' : '创建方案'}
              </Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Feather name="x" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              {/* 基本信息 */}
              <Text style={styles.sectionTitle}>基本信息</Text>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>方案名称 *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="例如：工作模式、会议中、防骚扰"
                  value={formData.name}
                  onChangeText={(text) => setFormData({ ...formData, name: text })}
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>方案描述</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="简单描述这个方案的用途"
                  value={formData.description}
                  onChangeText={(text) => setFormData({ ...formData, description: text })}
                  multiline
                  numberOfLines={3}
                  placeholderTextColor="#94a3b8"
                />
              </View>

              {/* AI助手 */}
              <Text style={styles.sectionTitle}>AI助手</Text>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>选择AI助手 *</Text>
                <TouchableOpacity
                  style={styles.selectButton}
                  onPress={() => {
                    if (assistants.length === 0) {
                      Alert.alert('提示', '暂无可用的AI助手，请先创建助手');
                      return;
                    }
                    setShowAssistantPicker(true);
                  }}
                >
                  <Text style={[
                    styles.selectButtonText,
                    !formData.assistantId && styles.selectButtonPlaceholder
                  ]}>
                    {formData.assistantId
                      ? assistants.find((a) => a.id === formData.assistantId)?.name || '请选择助手'
                      : '请选择助手'}
                  </Text>
                  <Feather name="chevron-down" size={20} color="#64748b" />
                </TouchableOpacity>
                <Text style={styles.hint}>
                  助手的音色、大模型等配置在 Smart Assistant 中设置
                </Text>
              </View>

              {/* 自动接听 */}
              <Text style={styles.sectionTitle}>自动接听</Text>
              
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setFormData({ ...formData, autoAnswer: !formData.autoAnswer })}
              >
                <View style={[styles.checkbox, formData.autoAnswer && styles.checkboxChecked]}>
                  {formData.autoAnswer && <Feather name="check" size={14} color="#ffffff" />}
                </View>
                <Text style={styles.checkboxLabel}>启用自动接听</Text>
              </TouchableOpacity>

              {formData.autoAnswer && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>接听延迟（秒）</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    value={String(formData.autoAnswerDelay)}
                    onChangeText={(text) =>
                      setFormData({ ...formData, autoAnswerDelay: parseInt(text) || 0 })
                    }
                    keyboardType="numeric"
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              )}

              {/* AI回复配置 */}
              <Text style={styles.sectionTitle}>AI回复配置</Text>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>开场白</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="例如：您好，我是XX的助理，请问有什么可以帮您？"
                  value={formData.openingMessage}
                  onChangeText={(text) => setFormData({ ...formData, openingMessage: text })}
                  multiline
                  numberOfLines={3}
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>兜底回复</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="当没有匹配到关键词时的默认回复"
                  value={formData.fallbackMessage}
                  onChangeText={(text) => setFormData({ ...formData, fallbackMessage: text })}
                  multiline
                  numberOfLines={3}
                  placeholderTextColor="#94a3b8"
                />
              </View>

              {/* 录音设置 */}
              <Text style={styles.sectionTitle}>录音设置</Text>
              
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() =>
                  setFormData({ ...formData, recordingEnabled: !formData.recordingEnabled })
                }
              >
                <View
                  style={[styles.checkbox, formData.recordingEnabled && styles.checkboxChecked]}
                >
                  {formData.recordingEnabled && <Feather name="check" size={14} color="#ffffff" />}
                </View>
                <Text style={styles.checkboxLabel}>启用录音</Text>
              </TouchableOpacity>

              {formData.recordingEnabled && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>录音模式</Text>
                  <TouchableOpacity
                    style={[
                      styles.radioOption,
                      formData.recordingMode === 'full' && styles.radioOptionSelected,
                    ]}
                    onPress={() => setFormData({ ...formData, recordingMode: 'full' })}
                  >
                    <View style={styles.radioButton}>
                      {formData.recordingMode === 'full' && (
                        <View style={styles.radioButtonInner} />
                      )}
                    </View>
                    <View style={styles.radioContent}>
                      <Text style={styles.radioLabel}>全程录音</Text>
                      <Text style={styles.radioDesc}>记录完整的通话内容</Text>
                    </View>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.radioOption,
                      formData.recordingMode === 'message' && styles.radioOptionSelected,
                    ]}
                    onPress={() => setFormData({ ...formData, recordingMode: 'message' })}
                  >
                    <View style={styles.radioButton}>
                      {formData.recordingMode === 'message' && (
                        <View style={styles.radioButtonInner} />
                      )}
                    </View>
                    <View style={styles.radioContent}>
                      <Text style={styles.radioLabel}>仅留言录音</Text>
                      <Text style={styles.radioDesc}>只记录留言阶段的内容</Text>
                    </View>
                  </TouchableOpacity>
                </View>
              )}

              {/* 留言设置 */}
              <Text style={styles.sectionTitle}>留言设置</Text>
              
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() =>
                  setFormData({ ...formData, messageEnabled: !formData.messageEnabled })
                }
              >
                <View style={[styles.checkbox, formData.messageEnabled && styles.checkboxChecked]}>
                  {formData.messageEnabled && <Feather name="check" size={14} color="#ffffff" />}
                </View>
                <Text style={styles.checkboxLabel}>启用留言功能</Text>
              </TouchableOpacity>

              {formData.messageEnabled && (
                <>
                  <View style={styles.formGroup}>
                    <Text style={styles.label}>留言时长（秒）</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="20"
                      value={String(formData.messageDuration)}
                      onChangeText={(text) =>
                        setFormData({ ...formData, messageDuration: parseInt(text) || 20 })
                      }
                      keyboardType="numeric"
                      placeholderTextColor="#94a3b8"
                    />
                  </View>

                  <View style={styles.formGroup}>
                    <Text style={styles.label}>留言提示语</Text>
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      placeholder="例如：请在嘀声后留言"
                      value={formData.messagePrompt}
                      onChangeText={(text) => setFormData({ ...formData, messagePrompt: text })}
                      multiline
                      numberOfLines={2}
                      placeholderTextColor="#94a3b8"
                    />
                  </View>
                </>
              )}

              {/* 绑定号码 */}
              <Text style={styles.sectionTitle}>绑定号码</Text>
              
              <View style={styles.formGroup}>
                <Text style={styles.label}>手机号码（可选）</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+8613344444444"
                  value={formData.boundPhoneNumber}
                  onChangeText={(text) => setFormData({ ...formData, boundPhoneNumber: text })}
                  keyboardType="phone-pad"
                  placeholderTextColor="#94a3b8"
                />
                <Text style={styles.hint}>
                  绑定手机号后，来电到该号码时将使用此方案自动接听
                </Text>
              </View>

              <View style={styles.formFooter} />
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button
                variant="outline"
                onPress={() => setShowForm(false)}
                style={styles.modalButton}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </Button>
              <Button variant="primary" onPress={handleSubmit} style={styles.modalButton}>
                <Text style={styles.submitButtonText}>
                  {editingScheme ? '更新' : '创建'}
                </Text>
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.footer} />

      {/* 智能体选择器 Modal */}
      <Modal
        visible={showAssistantPicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAssistantPicker(false)}
      >
        <View style={styles.pickerOverlay}>
          <View style={styles.pickerContent}>
            <View style={styles.pickerHeader}>
              <Text style={styles.pickerTitle}>选择AI助手</Text>
              <TouchableOpacity onPress={() => setShowAssistantPicker(false)}>
                <Feather name="x" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.pickerBody} showsVerticalScrollIndicator={false}>
              {assistants.map((assistant) => (
                <TouchableOpacity
                  key={assistant.id}
                  style={[
                    styles.pickerItem,
                    formData.assistantId === assistant.id && styles.pickerItemSelected,
                  ]}
                  onPress={() => {
                    setFormData({ ...formData, assistantId: assistant.id });
                    setShowAssistantPicker(false);
                  }}
                >
                  <View style={styles.pickerItemContent}>
                    <View style={styles.pickerItemIcon}>
                      <Text style={styles.pickerItemIconText}>
                        {assistant.icon || '🤖'}
                      </Text>
                    </View>
                    <View style={styles.pickerItemText}>
                      <Text style={styles.pickerItemName}>{assistant.name}</Text>
                      {assistant.description && (
                        <Text style={styles.pickerItemDesc} numberOfLines={2}>
                          {assistant.description}
                        </Text>
                      )}
                    </View>
                  </View>
                  {formData.assistantId === assistant.id && (
                    <Feather name="check" size={20} color="#a855f7" />
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  activeBanner: {
    marginBottom: 16,
    backgroundColor: '#f3e8ff',
  },
  activeBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  activeBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  activeBannerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#e9d5ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeBannerTitle: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 2,
  },
  activeBannerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 16,
  },
  createButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
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
  },
  schemeList: {
    gap: 12,
  },
  schemeCard: {
    marginBottom: 0,
  },
  schemeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  schemeHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  schemeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  activeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
  },
  schemeDescription: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 12,
  },
  schemeActions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  modalBody: {
    padding: 20,
    maxHeight: 500,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1e293b',
    backgroundColor: '#ffffff',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginTop: 16,
    marginBottom: 12,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  checkboxChecked: {
    backgroundColor: '#a855f7',
    borderColor: '#a855f7',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '500',
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#ffffff',
  },
  radioOptionSelected: {
    borderColor: '#a855f7',
    backgroundColor: '#f3e8ff',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#a855f7',
  },
  radioContent: {
    flex: 1,
  },
  radioLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
    marginBottom: 2,
  },
  radioDesc: {
    fontSize: 12,
    color: '#64748b',
  },
  hint: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 6,
  },
  selectButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
  },
  selectButtonText: {
    fontSize: 14,
    color: '#1e293b',
    flex: 1,
  },
  selectButtonPlaceholder: {
    color: '#94a3b8',
  },
  formFooter: {
    height: 40,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  modalButton: {
    flex: 1,
  },
  cancelButtonText: {
    fontSize: 14,
    color: '#64748b',
  },
  submitButtonText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  footer: {
    height: 20,
  },
  // 智能体选择器样式
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pickerContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    width: '100%',
    maxHeight: '70%',
    overflow: 'hidden',
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  pickerBody: {
    maxHeight: 400,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  pickerItemSelected: {
    backgroundColor: '#f3e8ff',
  },
  pickerItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  pickerItemIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickerItemIconText: {
    fontSize: 20,
  },
  pickerItemText: {
    flex: 1,
  },
  pickerItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  pickerItemDesc: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
});

export default SchemeTab;

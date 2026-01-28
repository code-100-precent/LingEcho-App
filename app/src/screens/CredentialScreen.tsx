/**
 * 密钥管理页面
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
  Clipboard,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Key, Plus, Trash2, Download, Eye, EyeOff, Copy, ChevronDown } from '../components/Icons';
import { Button, Input, Card } from '../components';
import {
  fetchUserCredentials,
  createCredential,
  deleteCredential,
  type Credential,
  type CreateCredentialForm,
} from '../services/api/credential';
import {
  getTTSProviderOptions,
  getASRProviderOptions,
  getTTSProviderConfig,
  getASRProviderConfig,
  type ProviderField,
} from '../config/providerConfig';

const CredentialScreen: React.FC = () => {
  const navigation = useNavigation();
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [showAsrPicker, setShowAsrPicker] = useState(false);
  const [showTtsPicker, setShowTtsPicker] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<{
    name: string;
    apiKey: string;
    apiSecret: string;
  } | null>(null);
  
  // 表单状态
  const [form, setForm] = useState<CreateCredentialForm>({
    name: '',
    llmProvider: '',
    llmApiKey: '',
    llmApiUrl: '',
  });

  // ASR 和 TTS 配置
  const [asrProvider, setAsrProvider] = useState('');
  const [ttsProvider, setTtsProvider] = useState('');
  const [asrConfig, setAsrConfig] = useState<Record<string, any>>({});
  const [ttsConfig, setTtsConfig] = useState<Record<string, any>>({});

  // 显示/隐藏密钥
  const [visibleKeys, setVisibleKeys] = useState<{ [key: number]: boolean }>({});

  useEffect(() => {
    loadCredentials();
  }, []);

  const loadCredentials = async () => {
    try {
      setIsLoading(true);
      const response = await fetchUserCredentials();
      if (response.code === 200) {
        setCredentials(response.data);
      } else {
        Alert.alert('错误', response.msg || '获取密钥列表失败');
      }
    } catch (error: any) {
      Alert.alert('错误', error.message || '获取密钥列表失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadCredentials();
    setIsRefreshing(false);
  };

  const handleCreate = async () => {
    if (!form.name.trim()) {
      Alert.alert('提示', '请输入密钥名称');
      return;
    }

    setIsCreating(true);
    try {
      // 构建 ASR 和 TTS 配置
      const submitForm: CreateCredentialForm = {
        ...form,
        asrConfig: asrProvider
          ? { provider: asrProvider, ...asrConfig }
          : undefined,
        ttsConfig: ttsProvider
          ? { provider: ttsProvider, ...ttsConfig }
          : undefined,
      };

      const response = await createCredential(submitForm);
      if (response.code === 200) {
        setGeneratedKey({
          name: response.data.name,
          apiKey: response.data.apiKey,
          apiSecret: response.data.apiSecret,
        });
        setShowCreateModal(false);
        setShowKeyModal(true);
        setForm({
          name: '',
          llmProvider: '',
          llmApiKey: '',
          llmApiUrl: '',
        });
        setAsrProvider('');
        setTtsProvider('');
        setAsrConfig({});
        setTtsConfig({});
        await loadCredentials();
      } else {
        Alert.alert('错误', response.msg || '创建密钥失败');
      }
    } catch (error: any) {
      Alert.alert('错误', error.message || '创建密钥失败');
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = (id: number, name: string) => {
    Alert.alert(
      '确认删除',
      `确定要删除密钥 "${name}" 吗？此操作不可恢复。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await deleteCredential(id);
              if (response.code === 200) {
                Alert.alert('成功', '密钥已删除');
                await loadCredentials();
              } else {
                Alert.alert('错误', response.msg || '删除失败');
              }
            } catch (error: any) {
              Alert.alert('错误', error.message || '删除失败');
            }
          },
        },
      ]
    );
  };

  const toggleKeyVisibility = (id: number) => {
    setVisibleKeys(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const copyToClipboard = async (text: string, label: string) => {
    Clipboard.setString(text);
    Alert.alert('成功', `${label}已复制到剪贴板`);
  };

  const maskKey = (key: string) => {
    if (key.length <= 12) return '••••••••••••';
    return `${key.substring(0, 8)}...${key.substring(key.length - 4)}`;
  };

  // 渲染动态配置表单
  const renderProviderFields = (
    fields: ProviderField[],
    values: Record<string, any>,
    onChange: (key: string, value: any) => void
  ) => {
    return fields.map((field) => (
      <Input
        key={field.key}
        label={field.label + (field.required ? ' *' : '')}
        placeholder={field.placeholder}
        value={values[field.key] || ''}
        onChangeText={(text) => onChange(field.key, field.type === 'number' ? Number(text) : text)}
        secureTextEntry={field.type === 'password'}
        keyboardType={field.type === 'number' ? 'numeric' : 'default'}
        wrapperStyle={styles.inputWrapper}
      />
    ));
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#8b5cf6" />
        <Text style={styles.loadingText}>加载中...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 头部 */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Key size={24} color="#8b5cf6" />
          <Text style={styles.headerTitle}>密钥管理</Text>
        </View>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowCreateModal(true)}
        >
          <Plus size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* 统计卡片 */}
      <View style={styles.statsCard}>
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>总密钥数</Text>
          <Text style={styles.statValue}>{credentials.length}</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statLabel}>LLM 配置</Text>
          <Text style={styles.statValue}>
            {credentials.filter(c => c.llmProvider).length}
          </Text>
        </View>
      </View>

      {/* 密钥列表 */}
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        {credentials.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Key size={48} color="#d1d5db" />
            <Text style={styles.emptyTitle}>暂无密钥</Text>
            <Text style={styles.emptyText}>点击右上角 + 按钮创建新密钥</Text>
          </View>
        ) : (
          <View style={styles.listContainer}>
            {credentials.map((cred) => (
              <Card key={cred.id} style={styles.credentialCard}>
                <View style={styles.credentialHeader}>
                  <Text style={styles.credentialName}>{cred.name}</Text>
                  {cred.llmProvider && (
                    <View style={styles.providerBadge}>
                      <Text style={styles.providerText}>{cred.llmProvider}</Text>
                    </View>
                  )}
                </View>

                <View style={styles.credentialBody}>
                  <View style={styles.keyRow}>
                    <Text style={styles.keyLabel}>API Key:</Text>
                    <View style={styles.keyValueContainer}>
                      <Text style={styles.keyValue}>
                        {visibleKeys[cred.id] ? cred.apiKey : maskKey(cred.apiKey)}
                      </Text>
                      <TouchableOpacity
                        onPress={() => toggleKeyVisibility(cred.id)}
                        style={styles.iconButton}
                      >
                        {visibleKeys[cred.id] ? (
                          <EyeOff size={16} color="#6b7280" />
                        ) : (
                          <Eye size={16} color="#6b7280" />
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => copyToClipboard(cred.apiKey, 'API Key')}
                        style={styles.iconButton}
                      >
                        <Copy size={16} color="#6b7280" />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {cred.created_at && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>创建时间:</Text>
                      <Text style={styles.infoValue}>
                        {new Date(cred.created_at).toLocaleDateString('zh-CN')}
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.credentialActions}>
                  <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDelete(cred.id, cred.name)}
                  >
                    <Trash2 size={16} color="#ef4444" />
                    <Text style={styles.deleteButtonText}>删除</Text>
                  </TouchableOpacity>
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      {/* 创建密钥弹窗 */}
      <Modal
        visible={showCreateModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>创建新密钥</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <Input
                label="密钥名称"
                placeholder="请输入密钥名称"
                value={form.name}
                onChangeText={(text) => setForm({ ...form, name: text })}
                wrapperStyle={styles.inputWrapper}
              />

              <Text style={styles.sectionTitle}>LLM 配置（可选）</Text>

              <Input
                label="LLM Provider"
                placeholder="例如: openai, anthropic"
                value={form.llmProvider}
                onChangeText={(text) => setForm({ ...form, llmProvider: text })}
                wrapperStyle={styles.inputWrapper}
              />

              <Input
                label="LLM API Key"
                placeholder="请输入 API Key"
                value={form.llmApiKey}
                onChangeText={(text) => setForm({ ...form, llmApiKey: text })}
                secureTextEntry
                wrapperStyle={styles.inputWrapper}
              />

              <Input
                label="LLM API URL"
                placeholder="请输入 API URL"
                value={form.llmApiUrl}
                onChangeText={(text) => setForm({ ...form, llmApiUrl: text })}
                wrapperStyle={styles.inputWrapper}
              />

              <Text style={styles.sectionTitle}>ASR 配置（可选）</Text>

              <View style={styles.pickerWrapper}>
                <Text style={styles.pickerLabel}>服务商</Text>
                <TouchableOpacity
                  style={styles.picker}
                  onPress={() => setShowAsrPicker(true)}
                >
                  <Text style={styles.pickerText}>
                    {asrProvider
                      ? getASRProviderOptions().find((o) => o.value === asrProvider)?.label
                      : '请选择服务商'}
                  </Text>
                  <ChevronDown size={20} color="#6b7280" />
                </TouchableOpacity>
              </View>

              {asrProvider && getASRProviderConfig(asrProvider) && (
                <View style={styles.dynamicFields}>
                  {renderProviderFields(
                    getASRProviderConfig(asrProvider)!.fields,
                    asrConfig,
                    (key, value) => setAsrConfig({ ...asrConfig, [key]: value })
                  )}
                </View>
              )}

              <Text style={styles.sectionTitle}>TTS 配置（可选）</Text>

              <View style={styles.pickerWrapper}>
                <Text style={styles.pickerLabel}>服务商</Text>
                <TouchableOpacity
                  style={styles.picker}
                  onPress={() => setShowTtsPicker(true)}
                >
                  <Text style={styles.pickerText}>
                    {ttsProvider
                      ? getTTSProviderOptions().find((o) => o.value === ttsProvider)?.label
                      : '请选择服务商'}
                  </Text>
                  <ChevronDown size={20} color="#6b7280" />
                </TouchableOpacity>
              </View>

              {ttsProvider && getTTSProviderConfig(ttsProvider) && (
                <View style={styles.dynamicFields}>
                  {renderProviderFields(
                    getTTSProviderConfig(ttsProvider)!.fields,
                    ttsConfig,
                    (key, value) => setTtsConfig({ ...ttsConfig, [key]: value })
                  )}
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button
                variant="outline"
                onPress={() => setShowCreateModal(false)}
                style={styles.modalButton}
              >
                取消
              </Button>
              <Button
                variant="primary"
                onPress={handleCreate}
                loading={isCreating}
                style={styles.modalButton}
              >
                创建
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* 密钥生成成功弹窗 */}
      <Modal
        visible={showKeyModal}
        animationType="fade"
        transparent={true}
        onRequestClose={() => setShowKeyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.successHeader}>
              <View style={styles.successIcon}>
                <Text style={styles.successCheck}>✓</Text>
              </View>
              <Text style={styles.successTitle}>密钥创建成功</Text>
            </View>

            <Text style={styles.successText}>请妥善保存以下信息：</Text>

            {generatedKey && (
              <View style={styles.keyInfoContainer}>
                <View style={styles.keyInfoBox}>
                  <Text style={styles.keyInfoLabel}>API Key</Text>
                  <Text style={styles.keyInfoValue}>{generatedKey.apiKey}</Text>
                  <TouchableOpacity
                    onPress={() => copyToClipboard(generatedKey.apiKey, 'API Key')}
                    style={styles.copyButton}
                  >
                    <Copy size={16} color="#8b5cf6" />
                    <Text style={styles.copyButtonText}>复制</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.keyInfoBox}>
                  <Text style={styles.keyInfoLabel}>API Secret</Text>
                  <Text style={styles.keyInfoValue}>{generatedKey.apiSecret}</Text>
                  <TouchableOpacity
                    onPress={() => copyToClipboard(generatedKey.apiSecret, 'API Secret')}
                    style={styles.copyButton}
                  >
                    <Copy size={16} color="#8b5cf6" />
                    <Text style={styles.copyButtonText}>复制</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <Button
              variant="primary"
              onPress={() => {
                setShowKeyModal(false);
                setGeneratedKey(null);
              }}
              style={styles.confirmButton}
            >
              我已保存
            </Button>
          </View>
        </View>
      </Modal>

      {/* ASR 服务商选择器 */}
      <Modal
        visible={showAsrPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAsrPicker(false)}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={styles.pickerModalContent}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>选择 ASR 服务商</Text>
              <TouchableOpacity onPress={() => setShowAsrPicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              <TouchableOpacity
                style={[styles.pickerItem, !asrProvider && styles.pickerItemSelected]}
                onPress={() => {
                  setAsrProvider('');
                  setAsrConfig({});
                  setShowAsrPicker(false);
                }}
              >
                <Text style={[styles.pickerItemText, !asrProvider && styles.pickerItemTextSelected]}>
                  不配置
                </Text>
              </TouchableOpacity>
              {getASRProviderOptions().map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.pickerItem, asrProvider === opt.value && styles.pickerItemSelected]}
                  onPress={() => {
                    setAsrProvider(opt.value);
                    setAsrConfig({});
                    setShowAsrPicker(false);
                  }}
                >
                  <Text style={[styles.pickerItemText, asrProvider === opt.value && styles.pickerItemTextSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* TTS 服务商选择器 */}
      <Modal
        visible={showTtsPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowTtsPicker(false)}
      >
        <View style={styles.pickerModalOverlay}>
          <View style={styles.pickerModalContent}>
            <View style={styles.pickerModalHeader}>
              <Text style={styles.pickerModalTitle}>选择 TTS 服务商</Text>
              <TouchableOpacity onPress={() => setShowTtsPicker(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.pickerList}>
              <TouchableOpacity
                style={[styles.pickerItem, !ttsProvider && styles.pickerItemSelected]}
                onPress={() => {
                  setTtsProvider('');
                  setTtsConfig({});
                  setShowTtsPicker(false);
                }}
              >
                <Text style={[styles.pickerItemText, !ttsProvider && styles.pickerItemTextSelected]}>
                  不配置
                </Text>
              </TouchableOpacity>
              {getTTSProviderOptions().map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.pickerItem, ttsProvider === opt.value && styles.pickerItemSelected]}
                  onPress={() => {
                    setTtsProvider(opt.value);
                    setTtsConfig({});
                    setShowTtsPicker(false);
                  }}
                >
                  <Text style={[styles.pickerItemText, ttsProvider === opt.value && styles.pickerItemTextSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 8,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#8b5cf6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
  },
  statDivider: {
    width: 1,
    backgroundColor: '#e5e7eb',
    marginHorizontal: 16,
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
  },
  listContainer: {
    padding: 16,
  },
  credentialCard: {
    marginBottom: 16,
    padding: 16,
  },
  credentialHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  credentialName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  providerBadge: {
    backgroundColor: '#ddd6fe',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  providerText: {
    fontSize: 12,
    color: '#7c3aed',
    fontWeight: '500',
  },
  credentialBody: {
    marginBottom: 12,
  },
  keyRow: {
    marginBottom: 8,
  },
  keyLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  keyValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    padding: 8,
    borderRadius: 6,
  },
  keyValue: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#111827',
  },
  iconButton: {
    padding: 4,
    marginLeft: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  infoLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 12,
    color: '#111827',
  },
  credentialActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 12,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#fee2e2',
  },
  deleteButtonText: {
    fontSize: 14,
    color: '#ef4444',
    marginLeft: 4,
    fontWeight: '500',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '90%',
    maxHeight: '80%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalClose: {
    fontSize: 24,
    color: '#6b7280',
  },
  modalBody: {
    padding: 16,
  },
  inputWrapper: {
    marginBottom: 16,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  modalButton: {
    marginLeft: 8,
    minWidth: 80,
  },
  successHeader: {
    alignItems: 'center',
    padding: 16,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#d1fae5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  successCheck: {
    fontSize: 32,
    color: '#10b981',
    fontWeight: 'bold',
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
  },
  successText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  keyInfoContainer: {
    padding: 16,
  },
  keyInfoBox: {
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  keyInfoLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  keyInfoValue: {
    fontSize: 12,
    fontFamily: 'monospace',
    color: '#111827',
    marginBottom: 8,
  },
  copyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  copyButtonText: {
    fontSize: 12,
    color: '#8b5cf6',
    marginLeft: 4,
    fontWeight: '500',
  },
  confirmButton: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    marginBottom: 12,
  },
  pickerWrapper: {
    marginBottom: 16,
  },
  pickerLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  picker: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
  },
  pickerText: {
    fontSize: 14,
    color: '#111827',
  },
  dynamicFields: {
    marginTop: 8,
  },
  pickerModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  pickerModalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '70%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  pickerModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  pickerModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  pickerList: {
    maxHeight: 400,
  },
  pickerItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  pickerItemSelected: {
    backgroundColor: '#ede9fe',
  },
  pickerItemText: {
    fontSize: 16,
    color: '#111827',
  },
  pickerItemTextSelected: {
    color: '#7c3aed',
    fontWeight: '600',
  },
});

export default CredentialScreen;

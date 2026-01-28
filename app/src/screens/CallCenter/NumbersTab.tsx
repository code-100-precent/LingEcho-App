/**
 * 号码管理标签页
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
  getPhoneNumbers,
  deletePhoneNumber,
  setPrimaryPhoneNumber,
  bindScheme,
  unbindScheme,
  createPhoneNumber,
  updatePhoneNumber,
  PhoneNumber,
} from '../../services/api/phoneNumber';
import { getSchemes, Scheme } from '../../services/api/scheme';

const NumbersTab: React.FC = () => {
  const [numbers, setNumbers] = useState<PhoneNumber[]>([]);
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showBindModal, setShowBindModal] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [editingNumber, setEditingNumber] = useState<PhoneNumber | null>(null);
  const [bindingNumber, setBindingNumber] = useState<PhoneNumber | null>(null);
  const [formData, setFormData] = useState({
    phoneNumber: '',
    displayName: '',
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      await Promise.all([loadNumbers(), loadSchemes()]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadNumbers = async () => {
    try {
      const response = await getPhoneNumbers();
      if (response.code === 200) {
        setNumbers(response.data || []);
      } else {
        Alert.alert('错误', response.msg || '获取号码列表失败');
      }
    } catch (error: any) {
      Alert.alert('错误', error.message || '获取号码列表失败');
    }
  };

  const loadSchemes = async () => {
    try {
      const response = await getSchemes();
      if (response.code === 200) {
        setSchemes(response.data || []);
      }
    } catch (error) {
      console.error('获取方案列表失败', error);
    }
  };


  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const handleCreate = () => {
    setEditingNumber(null);
    setFormData({ phoneNumber: '', displayName: '' });
    setShowForm(true);
  };

  const handleEdit = (number: PhoneNumber) => {
    setEditingNumber(number);
    setFormData({
      phoneNumber: number.phoneNumber,
      displayName: number.displayName || '',
    });
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!formData.phoneNumber.trim()) {
      Alert.alert('提示', '请输入手机号码');
      return;
    }

    try {
      const response = editingNumber
        ? await updatePhoneNumber(editingNumber.id, formData)
        : await createPhoneNumber(formData);

      if (response.code === 200) {
        Alert.alert('成功', editingNumber ? '更新成功' : '添加成功');
        setShowForm(false);
        loadNumbers();
      } else {
        Alert.alert('错误', response.msg || '操作失败');
      }
    } catch (error: any) {
      Alert.alert('错误', error.message || '操作失败');
    }
  };

  const handleDelete = (number: PhoneNumber) => {
    Alert.alert('确认删除', `确定要删除号码"${number.phoneNumber}"吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            const response = await deletePhoneNumber(number.id);
            if (response.code === 200) {
              Alert.alert('成功', '删除成功');
              loadNumbers();
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

  const handleSetPrimary = async (number: PhoneNumber) => {
    try {
      const response = await setPrimaryPhoneNumber(number.id);
      if (response.code === 200) {
        Alert.alert('成功', '已设为主号码');
        loadNumbers();
      } else {
        Alert.alert('错误', response.msg || '设置失败');
      }
    } catch (error: any) {
      Alert.alert('错误', error.message || '设置失败');
    }
  };

  const handleBind = (number: PhoneNumber) => {
    setBindingNumber(number);
    setShowBindModal(true);
  };

  const handleBindScheme = async (schemeId: number) => {
    if (!bindingNumber) return;

    try {
      const response = await bindScheme(bindingNumber.id, schemeId);
      if (response.code === 200) {
        Alert.alert('成功', '绑定成功');
        setShowBindModal(false);
        setBindingNumber(null);
        loadNumbers();
      } else {
        Alert.alert('错误', response.msg || '绑定失败');
      }
    } catch (error: any) {
      Alert.alert('错误', error.message || '绑定失败');
    }
  };

  const handleUnbind = async (number: PhoneNumber) => {
    try {
      const response = await unbindScheme(number.id);
      if (response.code === 200) {
        Alert.alert('成功', '已解绑');
        loadNumbers();
      } else {
        Alert.alert('错误', response.msg || '解绑失败');
      }
    } catch (error: any) {
      Alert.alert('错误', error.message || '解绑失败');
    }
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
      {/* 操作按钮 */}
      <View style={styles.actionButtons}>
        <Button
          variant="outline"
          onPress={() => setShowGuide(true)}
          style={styles.actionButton}
        >
          <Feather name="info" size={16} color="#64748b" />
          <Text style={styles.actionButtonText}>呼叫转移指引</Text>
        </Button>
        <Button variant="primary" onPress={handleCreate} style={styles.actionButton}>
          <Feather name="plus" size={16} color="#ffffff" />
          <Text style={styles.createButtonText}>添加号码</Text>
        </Button>
      </View>

      {/* 号码列表 */}
      {numbers.length === 0 ? (
        <Card variant="default" padding="lg" style={styles.emptyCard}>
          <View style={styles.emptyState}>
            <Feather name="phone" size={48} color="#cbd5e1" />
            <Text style={styles.emptyText}>还没有添加号码</Text>
            <Text style={styles.emptySubtext}>添加您的手机号码，开始使用AI代接服务</Text>
          </View>
        </Card>
      ) : (
        <View style={styles.numberList}>
          {numbers.map((number) => (
            <Card key={number.id} variant="elevated" padding="md" style={styles.numberCard}>
              <View style={styles.numberHeader}>
                <View style={styles.numberHeaderLeft}>
                  <View style={styles.phoneIcon}>
                    <Feather name="phone" size={20} color="#3b82f6" />
                  </View>
                  <View style={styles.numberInfo}>
                    <View style={styles.numberTitleRow}>
                      <Text style={styles.phoneNumber}>{number.phoneNumber}</Text>
                      {number.isPrimary && (
                        <Badge variant="warning" style={styles.primaryBadge}>
                          <Feather name="star" size={10} color="#f59e0b" />
                          <Text style={styles.badgeText}>主号码</Text>
                        </Badge>
                      )}
                    </View>
                    {number.displayName && (
                      <Text style={styles.displayName}>{number.displayName}</Text>
                    )}
                  </View>
                </View>
              </View>

              {/* 绑定的方案 */}
              {number.schemeId && number.schemeName ? (
                <View style={styles.schemeInfo}>
                  <View style={styles.schemeInfoLeft}>
                    <Feather name="link" size={14} color="#10b981" />
                    <Text style={styles.schemeInfoText}>已绑定: {number.schemeName}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleUnbind(number)}>
                    <Feather name="x-circle" size={16} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.schemeInfo}>
                  <Text style={styles.noSchemeText}>未绑定方案</Text>
                </View>
              )}

              {/* 操作按钮 */}
              <View style={styles.numberActions}>
                {!number.isPrimary && (
                  <TouchableOpacity
                    style={styles.actionBtn}
                    onPress={() => handleSetPrimary(number)}
                  >
                    <Feather name="star" size={16} color="#64748b" />
                    <Text style={styles.actionBtnText}>设为主号</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleBind(number)}>
                  <Feather name="link" size={16} color="#64748b" />
                  <Text style={styles.actionBtnText}>绑定方案</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleEdit(number)}>
                  <Feather name="edit-3" size={16} color="#64748b" />
                  <Text style={styles.actionBtnText}>编辑</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionBtn} onPress={() => handleDelete(number)}>
                  <Feather name="trash-2" size={16} color="#ef4444" />
                  <Text style={[styles.actionBtnText, { color: '#ef4444' }]}>删除</Text>
                </TouchableOpacity>
              </View>
            </Card>
          ))}
        </View>
      )}

      {/* 添加/编辑表单模态框 */}
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
                {editingNumber ? '编辑号码' : '添加号码'}
              </Text>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Feather name="x" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>手机号码</Text>
                <TextInput
                  style={styles.input}
                  placeholder="请输入手机号码"
                  value={formData.phoneNumber}
                  onChangeText={(text) => setFormData({ ...formData, phoneNumber: text })}
                  keyboardType="phone-pad"
                  placeholderTextColor="#94a3b8"
                  editable={!editingNumber}
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>显示名称（可选）</Text>
                <TextInput
                  style={styles.input}
                  placeholder="请输入显示名称"
                  value={formData.displayName}
                  onChangeText={(text) => setFormData({ ...formData, displayName: text })}
                  placeholderTextColor="#94a3b8"
                />
              </View>
            </View>

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
                  {editingNumber ? '更新' : '添加'}
                </Text>
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* 绑定方案模态框 */}
      <Modal
        visible={showBindModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBindModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>绑定代接方案</Text>
              <TouchableOpacity onPress={() => setShowBindModal(false)}>
                <Feather name="x" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.bindHint}>
                为号码 <Text style={styles.bindNumber}>{bindingNumber?.phoneNumber}</Text>{' '}
                选择一个代接方案
              </Text>

              {schemes.length === 0 ? (
                <View style={styles.noSchemes}>
                  <Text style={styles.noSchemesText}>暂无可用方案，请先创建方案</Text>
                </View>
              ) : (
                <View style={styles.schemeList}>
                  {schemes.map((scheme) => (
                    <TouchableOpacity
                      key={scheme.id}
                      style={styles.schemeItem}
                      onPress={() => handleBindScheme(scheme.id)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.schemeItemContent}>
                        <View>
                          <Text style={styles.schemeItemName}>{scheme.name}</Text>
                          {scheme.description && (
                            <Text style={styles.schemeItemDesc}>{scheme.description}</Text>
                          )}
                        </View>
                        {scheme.isActive && (
                          <Badge variant="success">
                            <Text style={styles.badgeText}>激活中</Text>
                          </Badge>
                        )}
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>

      {/* 呼叫转移指引模态框 */}
      <Modal
        visible={showGuide}
        transparent
        animationType="slide"
        onRequestClose={() => setShowGuide(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>呼叫转移设置指引</Text>
              <TouchableOpacity onPress={() => setShowGuide(false)}>
                <Feather name="x" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.guideSection}>
                <Text style={styles.guideTitle}>什么是呼叫转移？</Text>
                <Text style={styles.guideText}>
                  呼叫转移可以将来电转接到AI助手，实现智能代接服务。
                </Text>
              </View>

              <View style={styles.guideSection}>
                <Text style={styles.guideTitle}>如何设置？</Text>
                <View style={styles.guideStep}>
                  <View style={styles.guideStepNumber}>
                    <Text style={styles.guideStepNumberText}>1</Text>
                  </View>
                  <Text style={styles.guideStepText}>
                    拨打运营商呼叫转移设置号码（如中国移动：**21*转移号码#）
                  </Text>
                </View>
                <View style={styles.guideStep}>
                  <View style={styles.guideStepNumber}>
                    <Text style={styles.guideStepNumberText}>2</Text>
                  </View>
                  <Text style={styles.guideStepText}>
                    在系统中添加您的手机号码并绑定代接方案
                  </Text>
                </View>
                <View style={styles.guideStep}>
                  <View style={styles.guideStepNumber}>
                    <Text style={styles.guideStepNumberText}>3</Text>
                  </View>
                  <Text style={styles.guideStepText}>
                    测试呼叫转移是否生效，AI助手将自动接听
                  </Text>
                </View>
              </View>

              <View style={styles.guideSection}>
                <Text style={styles.guideTitle}>常见运营商设置代码</Text>
                <View style={styles.guideTable}>
                  <View style={styles.guideTableRow}>
                    <Text style={styles.guideTableLabel}>中国移动</Text>
                    <Text style={styles.guideTableValue}>**21*号码#</Text>
                  </View>
                  <View style={styles.guideTableRow}>
                    <Text style={styles.guideTableLabel}>中国联通</Text>
                    <Text style={styles.guideTableValue}>**21*号码#</Text>
                  </View>
                  <View style={styles.guideTableRow}>
                    <Text style={styles.guideTableLabel}>中国电信</Text>
                    <Text style={styles.guideTableValue}>**21*号码#</Text>
                  </View>
                  <View style={styles.guideTableRow}>
                    <Text style={styles.guideTableLabel}>取消转移</Text>
                    <Text style={styles.guideTableValue}>##21#</Text>
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button
                variant="primary"
                onPress={() => setShowGuide(false)}
                style={styles.fullButton}
              >
                <Text style={styles.submitButtonText}>我知道了</Text>
              </Button>
            </View>
          </View>
        </View>
      </Modal>

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
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  actionButtonText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  createButtonText: {
    fontSize: 13,
    color: '#ffffff',
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
  numberList: {
    gap: 12,
  },
  numberCard: {
    marginBottom: 0,
  },
  numberHeader: {
    marginBottom: 12,
  },
  numberHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  phoneIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#dbeafe',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numberInfo: {
    flex: 1,
  },
  numberTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  phoneNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  primaryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  displayName: {
    fontSize: 13,
    color: '#64748b',
  },
  schemeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    marginBottom: 12,
  },
  schemeInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  schemeInfoText: {
    fontSize: 13,
    color: '#10b981',
    fontWeight: '500',
  },
  noSchemeText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  numberActions: {
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
  fullButton: {
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
  bindHint: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 16,
  },
  bindNumber: {
    fontWeight: '600',
    color: '#1e293b',
  },
  noSchemes: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  noSchemesText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  schemeList: {
    gap: 8,
  },
  schemeItem: {
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  schemeItemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  schemeItemName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  schemeItemDesc: {
    fontSize: 13,
    color: '#64748b',
  },
  guideSection: {
    marginBottom: 24,
  },
  guideTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 12,
  },
  guideText: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  guideStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  guideStepNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#a855f7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guideStepNumberText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },
  guideStepText: {
    flex: 1,
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  guideTable: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
  },
  guideTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  guideTableLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  guideTableValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    fontFamily: 'monospace',
  },
  footer: {
    height: 20,
  },
});

export default NumbersTab;

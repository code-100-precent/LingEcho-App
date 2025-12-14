/**
 * 设备管理页面
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { MainLayout, Card, Button, Badge, EmptyState, Modal, Input } from '../components';
import { useAuth } from '../context/AuthContext';
import {
  bindDevice,
  getUserDevices,
  unbindDevice,
  updateDevice,
  manualAddDevice,
  Device,
} from '../services/api/device';
import { getAssistantList, AssistantListItem } from '../services/api/assistant';

const DeviceManagementScreen: React.FC = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [devices, setDevices] = useState<Device[]>([]);
  const [assistants, setAssistants] = useState<AssistantListItem[]>([]);
  const [selectedAssistantId, setSelectedAssistantId] = useState<string | null>(null);
  const [showBindModal, setShowBindModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isBinding, setIsBinding] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [activationCode, setActivationCode] = useState('');
  const [addForm, setAddForm] = useState({
    macAddress: '',
    board: '',
    appVersion: '1.0.0',
  });
  const [editingDevice, setEditingDevice] = useState<Device | null>(null);
  const [editForm, setEditForm] = useState({
    alias: '',
    autoUpdate: 1,
  });

  // 加载助手列表 - 只在用户已登录时加载
  React.useEffect(() => {
    if (!user) {
      return; // 未登录，不加载
    }
    
    const loadAssistants = async () => {
      try {
        const response = await getAssistantList();
        if (response.code === 200 && response.data) {
          setAssistants(response.data);
          if (response.data.length > 0 && !selectedAssistantId) {
            setSelectedAssistantId(String(response.data[0].id));
          }
        }
      } catch (error: any) {
        console.error('Failed to load assistants:', error);
        // 401错误表示未授权，不显示错误提示，由路由守卫处理
        if (error.code !== 401) {
          Alert.alert('错误', error.msg || '加载助手列表失败');
        }
      }
    };
    loadAssistants();
  }, [user]);

  // 加载设备列表
  React.useEffect(() => {
    if (selectedAssistantId) {
      fetchDevices(selectedAssistantId);
    }
  }, [selectedAssistantId]);

  const fetchDevices = async (assistantId: string) => {
    setIsLoading(true);
    try {
      const response = await getUserDevices(assistantId);
      if (response.code === 200 && response.data) {
        setDevices(response.data);
      } else {
        Alert.alert('错误', response.msg || '加载设备列表失败');
      }
    } catch (error: any) {
      console.error('Failed to load devices:', error);
      Alert.alert('错误', error.msg || '加载设备列表失败');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBindDevice = async () => {
    if (!selectedAssistantId) {
      Alert.alert('提示', '请先选择助手');
      return;
    }
    if (!activationCode.trim()) {
      Alert.alert('提示', '请输入激活码');
      return;
    }

    setIsBinding(true);
    try {
      const response = await bindDevice(selectedAssistantId, activationCode.trim());
      if (response.code === 200) {
        Alert.alert('成功', '设备绑定成功');
        setShowBindModal(false);
        setActivationCode('');
        fetchDevices(selectedAssistantId);
      } else {
        Alert.alert('错误', response.msg || '绑定失败');
      }
    } catch (error: any) {
      console.error('Bind device error:', error);
      Alert.alert('错误', error.msg || error.message || '绑定失败');
    } finally {
      setIsBinding(false);
    }
  };

  const handleManualAdd = async () => {
    if (!selectedAssistantId) {
      Alert.alert('提示', '请先选择助手');
      return;
    }
    if (!addForm.macAddress.trim()) {
      Alert.alert('提示', '请输入MAC地址');
      return;
    }
    if (!addForm.board.trim()) {
      Alert.alert('提示', '请输入设备类型');
      return;
    }

    // 验证MAC地址格式
    const macPattern = /^([0-9A-Za-z]{2}[:-]){5}([0-9A-Za-z]{2})$/;
    if (!macPattern.test(addForm.macAddress)) {
      Alert.alert('错误', 'MAC地址格式不正确');
      return;
    }

    setIsAdding(true);
    try {
      const response = await manualAddDevice({
        agentId: selectedAssistantId,
        macAddress: addForm.macAddress.trim(),
        board: addForm.board.trim(),
        appVersion: addForm.appVersion || '1.0.0',
      });
      if (response.code === 200) {
        Alert.alert('成功', '设备添加成功');
        setShowAddModal(false);
        setAddForm({ macAddress: '', board: '', appVersion: '1.0.0' });
        fetchDevices(selectedAssistantId);
      } else {
        Alert.alert('错误', response.msg || '添加失败');
      }
    } catch (error: any) {
      console.error('Manual add device error:', error);
      Alert.alert('错误', error.msg || error.message || '添加失败');
    } finally {
      setIsAdding(false);
    }
  };

  const handleUnbindDevice = (device: Device) => {
    Alert.alert(
      '确认解绑',
      `确定要解绑设备 ${device.alias || device.macAddress} 吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '确定',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await unbindDevice({ deviceId: String(device.id) });
              if (response.code === 200) {
                Alert.alert('成功', '设备已解绑');
                if (selectedAssistantId) {
                  fetchDevices(selectedAssistantId);
                }
              } else {
                Alert.alert('错误', response.msg || '解绑失败');
              }
            } catch (error: any) {
              console.error('Unbind device error:', error);
              Alert.alert('错误', error.msg || error.message || '解绑失败');
            }
          },
        },
      ]
    );
  };

  const handleEditDevice = (device: Device) => {
    setEditingDevice(device);
    setEditForm({
      alias: device.alias || '',
      autoUpdate: device.autoUpdate,
    });
  };

  const handleUpdateDevice = async () => {
    if (!editingDevice) return;

    try {
      const response = await updateDevice(String(editingDevice.id), editForm);
      if (response.code === 200) {
        Alert.alert('成功', '设备信息已更新');
        setEditingDevice(null);
        if (selectedAssistantId) {
          fetchDevices(selectedAssistantId);
        }
      } else {
        Alert.alert('错误', response.msg || '更新失败');
      }
    } catch (error: any) {
      console.error('Update device error:', error);
      Alert.alert('错误', error.msg || error.message || '更新失败');
    }
  };

  const formatDate = (iso?: string) => {
    if (!iso) return '未知';
    return new Date(iso).toLocaleString('zh-CN');
  };

  return (
    <MainLayout
      navBarProps={{
        title: '设备管理',
      }}
      backgroundColor="#f8fafc"
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 助手选择 */}
        {assistants.length > 0 && (
          <View style={styles.assistantsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.assistantsScroll}>
              {assistants.map((assistant) => (
                <TouchableOpacity
                  key={assistant.id}
                  style={[
                    styles.assistantButton,
                    selectedAssistantId === String(assistant.id) && styles.assistantButtonActive,
                  ]}
                  onPress={() => setSelectedAssistantId(String(assistant.id))}
                  activeOpacity={0.7}
                >
                  <Feather
                    name="message-circle"
                    size={14}
                    color={selectedAssistantId === String(assistant.id) ? '#ffffff' : '#1e293b'}
                  />
                  <Text
                    style={[
                      styles.assistantButtonText,
                      selectedAssistantId === String(assistant.id) && styles.assistantButtonTextActive,
                    ]}
                  >
                    {assistant.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* 操作按钮 */}
        {selectedAssistantId && (
          <View style={styles.actionBar}>
            <Button
              variant="primary"
              size="md"
              onPress={() => setShowBindModal(true)}
              style={styles.actionButton}
            >
              <Feather name="key" size={16} color="#ffffff" />
              <Text style={styles.buttonText}>绑定设备</Text>
            </Button>
            <Button
              variant="outline"
              size="md"
              onPress={() => setShowAddModal(true)}
              style={styles.actionButton}
            >
              <Feather name="plus" size={16} color="#1e293b" />
              <Text style={[styles.buttonText, styles.buttonTextOutline]}>手动添加</Text>
            </Button>
          </View>
        )}

        {/* 设备列表 */}
        {!selectedAssistantId ? (
          <EmptyState
            title="请选择助手"
            description="请先选择一个助手来查看和管理设备"
          />
        ) : isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#64748b" />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        ) : devices.length === 0 ? (
          <EmptyState
            title="暂无设备"
            description="点击上方按钮绑定或添加设备"
          />
        ) : (
          <View style={styles.devicesGrid}>
            {devices.map((device) => (
              <Card key={device.id} variant="default" padding="md" style={styles.deviceCard}>
                <View style={styles.deviceHeader}>
                  <View style={styles.deviceTitleContainer}>
                    <Feather name="smartphone" size={20} color="#6366f1" />
                    <View style={styles.deviceTitle}>
                      <Text style={styles.deviceName} numberOfLines={1}>
                        {device.alias || device.macAddress}
                      </Text>
                      {device.alias && (
                        <Text style={styles.deviceMac} numberOfLines={1}>
                          {device.macAddress}
                        </Text>
                      )}
                    </View>
                  </View>
                  <View style={styles.deviceActions}>
                    <TouchableOpacity
                      style={styles.actionIcon}
                      onPress={() => handleEditDevice(device)}
                    >
                      <Feather name="edit-2" size={16} color="#64748b" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.actionIcon}
                      onPress={() => handleUnbindDevice(device)}
                    >
                      <Feather name="trash-2" size={16} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={styles.deviceInfo}>
                  <View style={styles.infoRow}>
                    <Feather name="wifi" size={14} color="#64748b" />
                    <Text style={styles.infoText}>{device.macAddress}</Text>
                  </View>
                  {device.board && (
                    <View style={styles.infoRow}>
                      <Feather name="cpu" size={14} color="#64748b" />
                      <Text style={styles.infoText}>{device.board}</Text>
                    </View>
                  )}
                  {device.appVersion && (
                    <View style={styles.infoRow}>
                      <Feather name="settings" size={14} color="#64748b" />
                      <Text style={styles.infoText}>版本: {device.appVersion}</Text>
                    </View>
                  )}
                  <View style={styles.infoRow}>
                    <Badge
                      variant={device.autoUpdate === 1 ? 'success' : 'secondary'}
                      style={styles.badge}
                    >
                      <Feather
                        name={device.autoUpdate === 1 ? 'check-circle' : 'x-circle'}
                        size={12}
                        color={device.autoUpdate === 1 ? '#10b981' : '#64748b'}
                      />
                      <Text style={styles.badgeText}>
                        自动更新: {device.autoUpdate === 1 ? '已启用' : '已禁用'}
                      </Text>
                    </Badge>
                  </View>
                  {device.lastConnected && (
                    <View style={styles.infoRow}>
                      <Feather name="calendar" size={14} color="#64748b" />
                      <Text style={styles.infoText}>
                        最后连接: {formatDate(device.lastConnected)}
                      </Text>
                    </View>
                  )}
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* 绑定设备模态框 */}
        <Modal
          isOpen={showBindModal}
          onClose={() => {
            setShowBindModal(false);
            setActivationCode('');
          }}
          title="绑定设备"
        >
          <View style={styles.modalContent}>
            <Input
              label="激活码"
              value={activationCode}
              onChangeText={setActivationCode}
              placeholder="请输入6位激活码"
              maxLength={6}
            />
            <Text style={styles.helperText}>
              请在设备上查看激活码并输入
            </Text>
            <View style={styles.modalActions}>
              <Button
                variant="outline"
                onPress={() => {
                  setShowBindModal(false);
                  setActivationCode('');
                }}
                style={styles.modalButton}
              >
                <Text>取消</Text>
              </Button>
                  <Button
                    variant="primary"
                    onPress={handleBindDevice}
                    disabled={!activationCode.trim() || isBinding}
                    style={styles.modalButton}
                  >
                    <Text style={styles.buttonText}>{isBinding ? '绑定中...' : '绑定'}</Text>
                  </Button>
            </View>
          </View>
        </Modal>

        {/* 手动添加设备模态框 */}
        <Modal
          isOpen={showAddModal}
          onClose={() => {
            setShowAddModal(false);
            setAddForm({ macAddress: '', board: '', appVersion: '1.0.0' });
          }}
          title="手动添加设备"
        >
          <View style={styles.modalContent}>
            <Input
              label="MAC地址 *"
              value={addForm.macAddress}
              onChangeText={(text) => setAddForm({ ...addForm, macAddress: text })}
              placeholder="例如: AA:BB:CC:DD:EE:FF"
            />
            <Input
              label="设备类型 *"
              value={addForm.board}
              onChangeText={(text) => setAddForm({ ...addForm, board: text })}
              placeholder="例如: Android, iOS"
            />
            <Input
              label="应用版本"
              value={addForm.appVersion}
              onChangeText={(text) => setAddForm({ ...addForm, appVersion: text })}
              placeholder="1.0.0"
            />
            <View style={styles.modalActions}>
              <Button
                variant="outline"
                onPress={() => {
                  setShowAddModal(false);
                  setAddForm({ macAddress: '', board: '', appVersion: '1.0.0' });
                }}
                style={styles.modalButton}
              >
                <Text>取消</Text>
              </Button>
              <Button
                variant="primary"
                onPress={handleManualAdd}
                disabled={isAdding}
                style={styles.modalButton}
              >
                <Text style={styles.buttonText}>{isAdding ? '添加中...' : '添加'}</Text>
              </Button>
            </View>
          </View>
        </Modal>

        {/* 编辑设备模态框 */}
        <Modal
          isOpen={!!editingDevice}
          onClose={() => setEditingDevice(null)}
          title="编辑设备"
        >
          {editingDevice && (
            <View style={styles.modalContent}>
              <Input
                label="设备别名"
                value={editForm.alias}
                onChangeText={(text) => setEditForm({ ...editForm, alias: text })}
                placeholder="请输入设备别名"
              />
              <View style={styles.selectContainer}>
                <Text style={styles.label}>自动更新</Text>
                <View style={styles.selectRow}>
                  <TouchableOpacity
                    style={[
                      styles.selectOption,
                      editForm.autoUpdate === 1 && styles.selectOptionActive,
                    ]}
                    onPress={() => setEditForm({ ...editForm, autoUpdate: 1 })}
                  >
                    <Text
                      style={[
                        styles.selectOptionText,
                        editForm.autoUpdate === 1 && styles.selectOptionTextActive,
                      ]}
                    >
                      启用
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.selectOption,
                      editForm.autoUpdate === 0 && styles.selectOptionActive,
                    ]}
                    onPress={() => setEditForm({ ...editForm, autoUpdate: 0 })}
                  >
                    <Text
                      style={[
                        styles.selectOptionText,
                        editForm.autoUpdate === 0 && styles.selectOptionTextActive,
                      ]}
                    >
                      禁用
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              <View style={styles.modalActions}>
                <Button
                  variant="outline"
                  onPress={() => setEditingDevice(null)}
                  style={styles.modalButton}
                >
                  <Text>取消</Text>
                </Button>
                <Button
                  variant="primary"
                  onPress={handleUpdateDevice}
                  style={styles.modalButton}
                >
                  <Text style={styles.buttonText}>保存</Text>
                </Button>
              </View>
            </View>
          )}
        </Modal>

        <View style={styles.footer} />
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
  actionBar: {
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
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  buttonTextOutline: {
    color: '#1e293b',
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
  devicesGrid: {
    gap: 12,
  },
  deviceCard: {
    marginBottom: 0,
  },
  deviceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  deviceTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  deviceTitle: {
    marginLeft: 8,
    flex: 1,
  },
  deviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  deviceMac: {
    fontSize: 12,
    color: '#64748b',
  },
  deviceActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionIcon: {
    padding: 4,
  },
  deviceInfo: {
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    fontSize: 12,
    color: '#64748b',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 11,
    color: '#1e293b',
  },
  modalContent: {
    gap: 16,
  },
  helperText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: -8,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  modalButton: {
    flex: 1,
  },
  footer: {
    height: 20,
  },
  assistantsContainer: {
    marginBottom: 16,
  },
  assistantsScroll: {
    flexDirection: 'row',
  },
  assistantButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginRight: 8,
    gap: 6,
  },
  assistantButtonActive: {
    backgroundColor: '#1e293b',
    borderColor: '#1e293b',
  },
  assistantButtonText: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '500',
  },
  assistantButtonTextActive: {
    color: '#ffffff',
  },
  selectContainer: {
    marginBottom: 16,
  },
  selectRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  selectOption: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
    alignItems: 'center',
  },
  selectOptionActive: {
    backgroundColor: '#1e293b',
    borderColor: '#1e293b',
  },
  selectOptionText: {
    fontSize: 14,
    color: '#1e293b',
    fontWeight: '500',
  },
  selectOptionTextActive: {
    color: '#ffffff',
  },
});

export default DeviceManagementScreen;


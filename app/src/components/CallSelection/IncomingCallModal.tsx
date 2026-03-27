/**
 * 来电方案选择弹窗 - React Native版本
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  getAvailableSchemesForCall,
  selectSchemeForCall,
  cancelCallSelection,
  getCallSelectionStatus,
  Scheme,
} from '../../services/api/callSelection';

interface IncomingCallModalProps {
  visible: boolean;
  callId: string;
  callerNumber: string;
  calledNumber: string;
  onClose: () => void;
  onSchemeSelected: (schemeId: number) => void;
}

const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  visible,
  callId,
  callerNumber,
  calledNumber,
  onClose,
  onSchemeSelected,
}) => {
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [selectedSchemeId, setSelectedSchemeId] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(8);
  const [loading, setLoading] = useState(false);
  const [isTimeout, setIsTimeout] = useState(false);

  // 加载可用方案
  useEffect(() => {
    if (visible && callId) {
      loadSchemes();
    }
  }, [visible, callId]);

  const loadSchemes = async () => {
    try {
      const response = await getAvailableSchemesForCall(callId);
      if (response.code === 0) {
        setSchemes(response.data || []);
        // 默认选中当前激活的方案
        const activeScheme = response.data?.find((s) => s.isActive);
        if (activeScheme) {
          setSelectedSchemeId(activeScheme.id);
        }
      }
    } catch (error: any) {
      console.error('加载方案列表失败:', error);
    }
  };

  // 倒计时和状态轮询
  useEffect(() => {
    if (!visible || !callId) return;

    const timer = setInterval(async () => {
      try {
        const response = await getCallSelectionStatus(callId);
        if (response.code === 0) {
          const { remainingSeconds: remaining, isTimeout: timeout, status } = response.data;

          setRemainingSeconds(remaining);
          setIsTimeout(timeout);

          // 如果已超时或已选择，关闭弹窗
          if (timeout || status !== 'pending') {
            clearInterval(timer);
            if (timeout) {
              console.log('选择超时，将使用默认方案');
            }
            onClose();
          }
        }
      } catch (error) {
        console.error('获取状态失败:', error);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [visible, callId, onClose]);

  // 选择方案
  const handleSelectScheme = async () => {
    if (!selectedSchemeId) {
      return;
    }

    setLoading(true);
    try {
      const response = await selectSchemeForCall(callId, selectedSchemeId);
      if (response.code === 0) {
        onSchemeSelected(selectedSchemeId);
        onClose();
      }
    } catch (error: any) {
      console.error('选择方案失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 取消选择
  const handleCancel = async () => {
    try {
      await cancelCallSelection(callId);
      onClose();
    } catch (error: any) {
      console.error('取消失败:', error);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* 头部 */}
          <View style={styles.header}>
            <View style={styles.headerContent}>
              <View style={styles.iconContainer}>
                <Feather name="phone-call" size={24} color="#fff" />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.title}>来电提醒</Text>
                <Text style={styles.subtitle}>请选择代接方案</Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleCancel} style={styles.closeButton}>
              <Feather name="x" size={24} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* 来电信息 */}
          <View style={styles.callInfo}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>来电号码:</Text>
              <Text style={styles.infoValue}>{callerNumber || '未知号码'}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>被叫号码:</Text>
              <Text style={styles.infoValue}>{calledNumber}</Text>
            </View>
          </View>

          {/* 倒计时 */}
          <View style={[styles.countdown, remainingSeconds <= 3 && styles.countdownUrgent]}>
            <Feather
              name="clock"
              size={20}
              color={remainingSeconds <= 3 ? '#ef4444' : '#f59e0b'}
            />
            <Text
              style={[
                styles.countdownText,
                remainingSeconds <= 3 && styles.countdownTextUrgent,
              ]}
            >
              剩余时间: {remainingSeconds} 秒
            </Text>
          </View>
          {remainingSeconds <= 3 && (
            <Text style={styles.urgentHint}>请尽快选择方案！</Text>
          )}

          {/* 方案列表 */}
          <View style={styles.schemesContainer}>
            <Text style={styles.schemesTitle}>选择代接方案:</Text>
            <ScrollView style={styles.schemesList} showsVerticalScrollIndicator={false}>
              {schemes.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyText}>暂无可用方案</Text>
                </View>
              ) : (
                schemes.map((scheme) => (
                  <TouchableOpacity
                    key={scheme.id}
                    onPress={() => setSelectedSchemeId(scheme.id)}
                    style={[
                      styles.schemeCard,
                      selectedSchemeId === scheme.id && styles.schemeCardSelected,
                    ]}
                  >
                    <View style={styles.schemeContent}>
                      <View style={styles.schemeInfo}>
                        <View style={styles.schemeHeader}>
                          <Text style={styles.schemeName}>{scheme.schemeName}</Text>
                          {scheme.isActive && (
                            <View style={styles.activeBadge}>
                              <Text style={styles.activeBadgeText}>当前激活</Text>
                            </View>
                          )}
                        </View>
                        {scheme.description && (
                          <Text style={styles.schemeDescription}>{scheme.description}</Text>
                        )}
                        {scheme.boundPhoneNumber && (
                          <Text style={styles.schemePhone}>
                            绑定号码: {scheme.boundPhoneNumber}
                          </Text>
                        )}
                      </View>
                      <View
                        style={[
                          styles.radio,
                          selectedSchemeId === scheme.id && styles.radioSelected,
                        ]}
                      >
                        {selectedSchemeId === scheme.id && (
                          <View style={styles.radioDot} />
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>

          {/* 底部按钮 */}
          <View style={styles.footer}>
            <TouchableOpacity
              onPress={handleCancel}
              style={[styles.button, styles.cancelButton]}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>拒接</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSelectScheme}
              disabled={!selectedSchemeId || loading || isTimeout}
              style={[
                styles.button,
                styles.confirmButton,
                (!selectedSchemeId || loading || isTimeout) && styles.buttonDisabled,
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.confirmButtonText}>确认接听</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
  },
  header: {
    backgroundColor: '#3b82f6',
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    padding: 12,
    borderRadius: 50,
    marginRight: 12,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  closeButton: {
    padding: 8,
  },
  callInfo: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  countdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#fef3c7',
    borderBottomWidth: 1,
    borderBottomColor: '#fde68a',
  },
  countdownUrgent: {
    backgroundColor: '#fee2e2',
    borderBottomColor: '#fecaca',
  },
  countdownText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400e',
    marginLeft: 8,
  },
  countdownTextUrgent: {
    color: '#991b1b',
  },
  urgentHint: {
    textAlign: 'center',
    fontSize: 12,
    color: '#ef4444',
    paddingVertical: 4,
    backgroundColor: '#fee2e2',
  },
  schemesContainer: {
    padding: 20,
    flex: 1,
  },
  schemesTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  schemesList: {
    maxHeight: 300,
  },
  emptyState: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  schemeCard: {
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
  },
  schemeCardSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  schemeContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  schemeInfo: {
    flex: 1,
    marginRight: 12,
  },
  schemeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  schemeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginRight: 8,
  },
  activeBadge: {
    backgroundColor: '#d1fae5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  activeBadgeText: {
    fontSize: 11,
    color: '#065f46',
    fontWeight: '500',
  },
  schemeDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  schemePhone: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#3b82f6',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    backgroundColor: '#f9fafb',
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    gap: 12,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  confirmButton: {
    backgroundColor: '#3b82f6',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  buttonDisabled: {
    backgroundColor: '#d1d5db',
  },
});

export default IncomingCallModal;

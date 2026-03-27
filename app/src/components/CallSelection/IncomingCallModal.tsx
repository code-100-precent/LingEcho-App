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
  mockSchemes?: Scheme[]; // 可选的模拟方案数据，用于测试
}

const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  visible,
  callId,
  callerNumber,
  calledNumber,
  onClose,
  onSchemeSelected,
  mockSchemes,
}) => {
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [selectedSchemeId, setSelectedSchemeId] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(8);
  const [loading, setLoading] = useState(false);
  const [isTimeout, setIsTimeout] = useState(false);

  // 加载可用方案
  useEffect(() => {
    if (visible && callId) {
      // 如果提供了模拟数据，直接使用
      if (mockSchemes && mockSchemes.length > 0) {
        setSchemes(mockSchemes);
        const activeScheme = mockSchemes.find((s) => s.isActive);
        if (activeScheme) {
          setSelectedSchemeId(activeScheme.id);
        }
      } else {
        loadSchemes();
      }
    }
  }, [visible, callId, mockSchemes]);

  const loadSchemes = async () => {
    try {
      const response = await getAvailableSchemesForCall(callId);
      console.log('加载方案列表响应:', response);
      if (response.code === 200) {
        setSchemes(response.data || []);
        console.log('设置方案列表:', response.data);
        // 默认选中当前激活的方案
        const activeScheme = response.data?.find((s) => s.isActive);
        if (activeScheme) {
          setSelectedSchemeId(activeScheme.id);
          console.log('默认选中方案:', activeScheme.id);
        }
      }
    } catch (error: any) {
      console.error('加载方案列表失败:', error);
    }
  };

  // 倒计时和状态轮询
  useEffect(() => {
    if (!visible || !callId) return;

    // 如果使用模拟数据，只做倒计时，不调用 API
    if (mockSchemes && mockSchemes.length > 0) {
      let seconds = 8;
      const timer = setInterval(() => {
        seconds -= 1;
        setRemainingSeconds(seconds);
        
        if (seconds <= 0) {
          clearInterval(timer);
          setIsTimeout(true);
          console.log('模拟倒计时结束');
        }
      }, 1000);
      
      return () => clearInterval(timer);
    }

    // 真实模式：调用 API 轮询状态
    const timer = setInterval(async () => {
      try {
        const response = await getCallSelectionStatus(callId);
        if (response.code === 200) {
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
  }, [visible, callId, onClose, mockSchemes]);

  // 选择方案
  const handleSelectScheme = async () => {
    if (!selectedSchemeId) {
      return;
    }

    setLoading(true);
    try {
      const response = await selectSchemeForCall(callId, selectedSchemeId);
      if (response.code === 200) {
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
            <View style={styles.headerLeft}>
              <Feather name="phone-call" size={24} color="#fff" style={styles.headerIcon} />
              <View>
                <Text style={styles.title}>来电提醒</Text>
                <Text style={styles.subtitle}>请选择代接方案</Text>
              </View>
            </View>
            <TouchableOpacity onPress={handleCancel}>
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
              size={18}
              color={remainingSeconds <= 3 ? '#ef4444' : '#f59e0b'}
            />
            <Text style={[styles.countdownText, remainingSeconds <= 3 && styles.countdownTextUrgent]}>
              剩余 {remainingSeconds} 秒
            </Text>
          </View>

          {/* 方案列表标题 */}
          <View style={styles.schemesHeader}>
            <Text style={styles.schemesTitle}>选择方案 ({schemes.length})</Text>
          </View>

          {/* 方案列表 - 使用固定高度的ScrollView */}
          <View style={styles.schemesWrapper}>
            {schemes.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>暂无可用方案</Text>
              </View>
            ) : (
              <ScrollView 
                style={styles.schemesList}
                contentContainerStyle={styles.schemesContent}
                showsVerticalScrollIndicator={true}
              >
                {schemes.map((scheme) => (
                  <TouchableOpacity
                    key={scheme.id}
                    onPress={() => {
                      console.log('选择方案:', scheme.id, scheme.schemeName);
                      setSelectedSchemeId(scheme.id);
                    }}
                    style={[
                      styles.schemeCard,
                      selectedSchemeId === scheme.id && styles.schemeCardSelected,
                    ]}
                    activeOpacity={0.7}
                  >
                    <View style={styles.schemeContent}>
                      <View style={styles.schemeInfo}>
                        <Text style={styles.schemeName}>{scheme.schemeName}</Text>
                        {scheme.description && (
                          <Text style={styles.schemeDescription}>{scheme.description}</Text>
                        )}
                      </View>
                      <View style={[
                        styles.radio,
                        selectedSchemeId === scheme.id && styles.radioSelected,
                      ]}>
                        {selectedSchemeId === scheme.id && (
                          <View style={styles.radioDot} />
                        )}
                      </View>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
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
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    width: '100%',
    maxWidth: 420,
    overflow: 'hidden',
  },
  header: {
    backgroundColor: '#3b82f6',
    padding: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIcon: {
    marginRight: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  subtitle: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  callInfo: {
    padding: 16,
    backgroundColor: '#f9fafb',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 13,
    color: '#6b7280',
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  countdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 10,
    backgroundColor: '#fef3c7',
  },
  countdownUrgent: {
    backgroundColor: '#fee2e2',
  },
  countdownText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#92400e',
    marginLeft: 6,
  },
  countdownTextUrgent: {
    color: '#991b1b',
  },
  schemesHeader: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    backgroundColor: '#fff',
  },
  schemesTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  schemesWrapper: {
    height: 240,
    backgroundColor: '#fff',
  },
  schemesList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  schemesContent: {
    paddingBottom: 8,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
  },
  schemeCard: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
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
  schemeName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  schemeDescription: {
    fontSize: 13,
    color: '#6b7280',
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
    padding: 16,
    backgroundColor: '#f9fafb',
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

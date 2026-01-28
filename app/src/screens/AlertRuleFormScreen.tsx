/**
 * 告警规则表单页面（完整版）
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { MainLayout, Card, Button, Input, Switch } from '../components';
import {
  createAlertRule,
  updateAlertRule,
  getAlertRule,
  AlertType,
  AlertSeverity,
  NotificationChannel,
  AlertCondition,
} from '../services/api/alert';
import type { RootStackParamList } from '../navigation/AppNavigator';

type AlertRuleFormRouteProp = RouteProp<RootStackParamList, 'AlertRuleForm'>;

const AlertRuleFormScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<AlertRuleFormRouteProp>();
  const { mode, ruleId } = route.params;
  const isEdit = mode === 'edit';

  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    alertType: 'quota_exceeded' as AlertType,
    severity: 'medium' as AlertSeverity,
    // 配额超限条件
    quotaType: 'llm_tokens',
    quotaThreshold: 80,
    // 系统错误条件
    errorCount: 10,
    errorWindow: 300,
    // 服务错误条件
    serviceName: '',
    failureRate: 20,
    responseTime: 3000,
    // 通知配置
    channels: ['internal'] as NotificationChannel[],
    webhookUrl: '',
    webhookMethod: 'POST',
    cooldown: 300,
    enabled: true,
  });

  useEffect(() => {
    if (isEdit && ruleId) {
      loadRule();
    }
  }, [isEdit, ruleId]);

  const loadRule = async () => {
    if (!ruleId) return;
    try {
      setIsLoading(true);
      const response = await getAlertRule(ruleId);
      if (response.code === 200 && response.data) {
        const rule = response.data;
        const conditions = JSON.parse(rule.conditions || '{}');
        const channels = JSON.parse(rule.channels || '["internal"]');
        setFormData({
          name: rule.name,
          description: rule.description || '',
          alertType: rule.alertType,
          severity: rule.severity,
          quotaType: conditions.quotaType || 'llm_tokens',
          quotaThreshold: conditions.quotaThreshold || 80,
          errorCount: conditions.errorCount || 10,
          errorWindow: conditions.errorWindow || 300,
          serviceName: conditions.serviceName || '',
          failureRate: conditions.failureRate || 20,
          responseTime: conditions.responseTime || 3000,
          channels,
          webhookUrl: rule.webhookUrl || '',
          webhookMethod: rule.webhookMethod || 'POST',
          cooldown: rule.cooldown || 300,
          enabled: rule.enabled,
        });
      } else {
        Alert.alert('错误', response.msg || '加载失败');
        navigation.goBack();
      }
    } catch (error: any) {
      Alert.alert('错误', error.message || '加载失败');
      navigation.goBack();
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('提示', '请输入规则名称');
      return;
    }

    if (formData.channels.length === 0) {
      Alert.alert('提示', '请至少选择一个通知渠道');
      return;
    }

    if (formData.channels.includes('webhook') && !formData.webhookUrl.trim()) {
      Alert.alert('提示', '选择 Webhook 渠道时必须填写 Webhook URL');
      return;
    }

    try {
      setIsSaving(true);
      const conditions: AlertCondition = {};

      // 根据告警类型设置条件
      if (formData.alertType === 'quota_exceeded') {
        conditions.quotaType = formData.quotaType;
        conditions.quotaThreshold = formData.quotaThreshold;
      } else if (formData.alertType === 'system_error') {
        conditions.errorCount = formData.errorCount;
        conditions.errorWindow = formData.errorWindow;
      } else if (formData.alertType === 'service_error') {
        conditions.serviceName = formData.serviceName;
        conditions.failureRate = formData.failureRate;
        conditions.responseTime = formData.responseTime;
      }

      const data = {
        name: formData.name,
        description: formData.description,
        alertType: formData.alertType,
        severity: formData.severity,
        conditions,
        channels: formData.channels,
        webhookUrl: formData.webhookUrl || undefined,
        webhookMethod: formData.webhookMethod,
        cooldown: formData.cooldown,
        enabled: formData.enabled,
      };

      if (isEdit && ruleId) {
        const response = await updateAlertRule(ruleId, data);
        if (response.code === 200) {
          Alert.alert('成功', '规则已更新');
          navigation.goBack();
        } else {
          Alert.alert('错误', response.msg || '更新失败');
        }
      } else {
        const response = await createAlertRule(data);
        if (response.code === 200) {
          Alert.alert('成功', '规则已创建');
          navigation.goBack();
        } else {
          Alert.alert('错误', response.msg || '创建失败');
        }
      }
    } catch (error: any) {
      Alert.alert('错误', error.message || '操作失败');
    } finally {
      setIsSaving(false);
    }
  };

  const handleChannelToggle = (channel: NotificationChannel) => {
    setFormData((prev) => {
      const channels = prev.channels.includes(channel)
        ? prev.channels.filter((c) => c !== channel)
        : [...prev.channels, channel];
      return { ...prev, channels };
    });
  };

  if (isLoading) {
    return (
      <MainLayout navBarProps={{ title: isEdit ? '编辑规则' : '创建规则' }}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#8b5cf6" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </MainLayout>
    );
  }

  return (
    <MainLayout navBarProps={{ title: isEdit ? '编辑规则' : '创建规则' }}>
      <ScrollView style={styles.container}>
        {/* 基本信息 */}
        <Card variant="default" padding="lg" style={styles.section}>
          <Text style={styles.sectionTitle}>基本信息</Text>
          <Input
            label="规则名称 *"
            placeholder="请输入规则名称"
            value={formData.name}
            onChangeText={(text) => setFormData({ ...formData, name: text })}
            wrapperStyle={styles.inputWrapper}
          />
          <Input
            label="描述"
            placeholder="请输入规则描述"
            value={formData.description}
            onChangeText={(text) => setFormData({ ...formData, description: text })}
            multiline
            numberOfLines={3}
            wrapperStyle={styles.inputWrapper}
          />
        </Card>

        {/* 告警类型和严重程度 */}
        <Card variant="default" padding="lg" style={styles.section}>
          <Text style={styles.sectionTitle}>告警配置</Text>
          
          <View style={styles.inputWrapper}>
            <Text style={styles.label}>告警类型 *</Text>
            <View style={styles.radioGroup}>
              {[
                { value: 'quota_exceeded', label: '配额超限' },
                { value: 'system_error', label: '系统错误' },
                { value: 'service_error', label: '服务错误' },
                { value: 'custom', label: '自定义' },
              ].map((item) => (
                <Button
                  key={item.value}
                  variant={formData.alertType === item.value ? 'primary' : 'outline'}
                  size="sm"
                  onPress={() =>
                    setFormData({ ...formData, alertType: item.value as AlertType })
                  }
                  style={styles.radioButton}
                >
                  {item.label}
                </Button>
              ))}
            </View>
          </View>

          <View style={styles.inputWrapper}>
            <Text style={styles.label}>严重程度 *</Text>
            <View style={styles.radioGroup}>
              {[
                { value: 'critical', label: '严重' },
                { value: 'high', label: '高' },
                { value: 'medium', label: '中' },
                { value: 'low', label: '低' },
              ].map((item) => (
                <Button
                  key={item.value}
                  variant={formData.severity === item.value ? 'primary' : 'outline'}
                  size="sm"
                  onPress={() =>
                    setFormData({ ...formData, severity: item.value as AlertSeverity })
                  }
                  style={styles.radioButton}
                >
                  {item.label}
                </Button>
              ))}
            </View>
          </View>
        </Card>

        {/* 触发条件 */}
        <Card variant="default" padding="lg" style={styles.section}>
          <Text style={styles.sectionTitle}>触发条件</Text>

          {formData.alertType === 'quota_exceeded' && (
            <>
              <View style={styles.inputWrapper}>
                <Text style={styles.label}>配额类型 *</Text>
                <View style={styles.selectWrapper}>
                  <TouchableOpacity
                    style={styles.select}
                    onPress={() => {
                      Alert.alert(
                        '选择配额类型',
                        '',
                        [
                          { text: '存储', onPress: () => setFormData({ ...formData, quotaType: 'storage' }) },
                          { text: 'LLM Tokens', onPress: () => setFormData({ ...formData, quotaType: 'llm_tokens' }) },
                          { text: 'LLM 调用次数', onPress: () => setFormData({ ...formData, quotaType: 'llm_calls' }) },
                          { text: 'API 调用次数', onPress: () => setFormData({ ...formData, quotaType: 'api_calls' }) },
                          { text: '通话时长', onPress: () => setFormData({ ...formData, quotaType: 'call_duration' }) },
                          { text: '通话次数', onPress: () => setFormData({ ...formData, quotaType: 'call_count' }) },
                          { text: 'ASR 时长', onPress: () => setFormData({ ...formData, quotaType: 'asr_duration' }) },
                          { text: 'ASR 次数', onPress: () => setFormData({ ...formData, quotaType: 'asr_count' }) },
                          { text: 'TTS 时长', onPress: () => setFormData({ ...formData, quotaType: 'tts_duration' }) },
                          { text: 'TTS 次数', onPress: () => setFormData({ ...formData, quotaType: 'tts_count' }) },
                          { text: '取消', style: 'cancel' },
                        ]
                      );
                    }}
                  >
                    <Text style={styles.selectText}>
                      {formData.quotaType === 'storage' && '存储'}
                      {formData.quotaType === 'llm_tokens' && 'LLM Tokens'}
                      {formData.quotaType === 'llm_calls' && 'LLM 调用次数'}
                      {formData.quotaType === 'api_calls' && 'API 调用次数'}
                      {formData.quotaType === 'call_duration' && '通话时长'}
                      {formData.quotaType === 'call_count' && '通话次数'}
                      {formData.quotaType === 'asr_duration' && 'ASR 时长'}
                      {formData.quotaType === 'asr_count' && 'ASR 次数'}
                      {formData.quotaType === 'tts_duration' && 'TTS 时长'}
                      {formData.quotaType === 'tts_count' && 'TTS 次数'}
                    </Text>
                    <Feather name="chevron-down" size={20} color="#6b7280" />
                  </TouchableOpacity>
                </View>
                <Text style={styles.hint}>选择要监控的配额类型</Text>
              </View>

              <Input
                label="告警阈值 (%) *"
                placeholder="80"
                value={String(formData.quotaThreshold)}
                onChangeText={(text) =>
                  setFormData({ ...formData, quotaThreshold: Number(text) || 80 })
                }
                keyboardType="numeric"
                wrapperStyle={styles.inputWrapper}
              />
              <Text style={styles.hint}>当配额使用率达到此百分比时触发告警（0-100）</Text>
            </>
          )}

          {formData.alertType === 'system_error' && (
            <>
              <Input
                label="错误次数阈值 *"
                placeholder="10"
                value={String(formData.errorCount)}
                onChangeText={(text) =>
                  setFormData({ ...formData, errorCount: Number(text) || 10 })
                }
                keyboardType="numeric"
                wrapperStyle={styles.inputWrapper}
              />
              <Text style={styles.hint}>在时间窗口内达到此错误次数时触发告警</Text>

              <Input
                label="时间窗口 (秒) *"
                placeholder="300"
                value={String(formData.errorWindow)}
                onChangeText={(text) =>
                  setFormData({ ...formData, errorWindow: Number(text) || 300 })
                }
                keyboardType="numeric"
                wrapperStyle={styles.inputWrapper}
              />
              <Text style={styles.hint}>统计错误次数的时间窗口（秒）</Text>
            </>
          )}

          {formData.alertType === 'service_error' && (
            <>
              <Input
                label="服务名称"
                placeholder="请输入服务名称"
                value={formData.serviceName}
                onChangeText={(text) => setFormData({ ...formData, serviceName: text })}
                wrapperStyle={styles.inputWrapper}
              />
              <Text style={styles.hint}>要监控的服务名称（可选）</Text>

              <Input
                label="失败率阈值 (%) *"
                placeholder="20"
                value={String(formData.failureRate)}
                onChangeText={(text) =>
                  setFormData({ ...formData, failureRate: Number(text) || 20 })
                }
                keyboardType="numeric"
                wrapperStyle={styles.inputWrapper}
              />
              <Text style={styles.hint}>服务失败率达到此百分比时触发告警（0-100）</Text>

              <Input
                label="响应时间阈值 (毫秒) *"
                placeholder="3000"
                value={String(formData.responseTime)}
                onChangeText={(text) =>
                  setFormData({ ...formData, responseTime: Number(text) || 3000 })
                }
                keyboardType="numeric"
                wrapperStyle={styles.inputWrapper}
              />
              <Text style={styles.hint}>服务响应时间超过此值时触发告警（毫秒）</Text>
            </>
          )}

          {formData.alertType === 'custom' && (
            <Text style={styles.hint}>自定义告警类型暂不支持配置条件</Text>
          )}
        </Card>

        {/* 通知配置 */}
        <Card variant="default" padding="lg" style={styles.section}>
          <Text style={styles.sectionTitle}>通知配置</Text>
          
          <View style={styles.inputWrapper}>
            <Text style={styles.label}>通知渠道 *</Text>
            <View style={styles.checkboxGroup}>
              {[
                { value: 'internal', label: '站内通知', icon: 'bell' },
                { value: 'email', label: '邮件通知', icon: 'mail' },
                { value: 'webhook', label: 'Webhook', icon: 'link' },
                { value: 'sms', label: '短信通知', icon: 'message-square' },
              ].map((item) => (
                <View key={item.value} style={styles.checkboxItem}>
                  <Switch
                    checked={formData.channels.includes(item.value as NotificationChannel)}
                    onCheckedChange={() =>
                      handleChannelToggle(item.value as NotificationChannel)
                    }
                  />
                  <Feather name={item.icon as any} size={16} color="#6b7280" style={{ marginLeft: 8 }} />
                  <Text style={styles.checkboxLabel}>{item.label}</Text>
                </View>
              ))}
            </View>
          </View>

          {formData.channels.includes('webhook') && (
            <>
              <Input
                label="Webhook URL *"
                placeholder="https://example.com/webhook"
                value={formData.webhookUrl}
                onChangeText={(text) => setFormData({ ...formData, webhookUrl: text })}
                wrapperStyle={styles.inputWrapper}
                autoCapitalize="none"
              />
              <Text style={styles.hint}>接收告警通知的 Webhook 地址</Text>

              <View style={styles.inputWrapper}>
                <Text style={styles.label}>请求方法</Text>
                <View style={styles.radioGroup}>
                  {['POST', 'PUT', 'PATCH'].map((method) => (
                    <Button
                      key={method}
                      variant={formData.webhookMethod === method ? 'primary' : 'outline'}
                      size="sm"
                      onPress={() => setFormData({ ...formData, webhookMethod: method })}
                      style={styles.radioButton}
                    >
                      {method}
                    </Button>
                  ))}
                </View>
              </View>
            </>
          )}

          <Input
            label="冷却时间 (秒)"
            placeholder="300"
            value={String(formData.cooldown)}
            onChangeText={(text) =>
              setFormData({ ...formData, cooldown: Number(text) || 300 })
            }
            keyboardType="numeric"
            wrapperStyle={styles.inputWrapper}
          />
          <Text style={styles.hint}>两次告警之间的最小间隔时间，防止重复告警（秒）</Text>

          <View style={styles.switchRow}>
            <View>
              <Text style={styles.label}>启用规则</Text>
              <Text style={styles.hint}>关闭后规则将不会触发告警</Text>
            </View>
            <Switch
              checked={formData.enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
            />
          </View>
        </Card>

        <View style={styles.actions}>
          <Button variant="outline" onPress={() => navigation.goBack()} style={styles.button}>
            取消
          </Button>
          <Button
            variant="primary"
            onPress={handleSave}
            loading={isSaving}
            style={styles.button}
          >
            {isSaving ? '保存中...' : '保存'}
          </Button>
        </View>
      </ScrollView>
    </MainLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
  section: {
    margin: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  inputWrapper: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  hint: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
  radioGroup: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  radioButton: {
    flex: 1,
    minWidth: 80,
  },
  selectWrapper: {
    marginBottom: 4,
  },
  select: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
  },
  selectText: {
    fontSize: 14,
    color: '#111827',
  },
  checkboxGroup: {
    gap: 12,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#374151',
    marginLeft: 8,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  button: {
    flex: 1,
  },
});

export default AlertRuleFormScreen;

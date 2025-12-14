import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { MainLayout, Card, Button, Input, Switch, Select, Slider } from '../components';
import {
  getAssistant,
  updateAssistant,
  getVoiceOptions,
  getLanguageOptions,
  getVoiceClones,
  VoiceOption,
  LanguageOption,
  Assistant,
  VoiceClone,
} from '../services/api/assistant';
import { getKnowledgeBaseByUser, KnowledgeInfo } from '../services/api/knowledge';
import { jsTemplateService, JSTemplate } from '../services/api/jsTemplate';

type AssistantControlPanelRouteParams = {
  AssistantControlPanel: {
    assistantId: number;
  };
};

const ICON_MAP = {
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

const AssistantControlPanelScreen: React.FC = () => {
  const route = useRoute<RouteProp<AssistantControlPanelRouteParams, 'AssistantControlPanel'>>();
  const navigation = useNavigation();
  const { assistantId } = route.params;

  const [assistant, setAssistant] = useState<Assistant | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 表单数据
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: 'Bot',
    systemPrompt: '',
    temperature: 0.6,
    maxTokens: 150,
    language: 'zh-cn',
    speaker: '101016',
    llmModel: '',
    apiKey: '',
    apiSecret: '',
    knowledgeBaseId: null as string | null,
    voiceCloneId: null as number | null,
    jsSourceId: '',
  });

  // 选项数据
  const [voiceOptions, setVoiceOptions] = useState<VoiceOption[]>([]);
  const [languageOptions, setLanguageOptions] = useState<LanguageOption[]>([]);
  const [voiceClones, setVoiceClones] = useState<VoiceClone[]>([]);
  const [knowledgeBases, setKnowledgeBases] = useState<Array<{ id: string; name: string }>>([]);
  const [jsTemplates, setJsTemplates] = useState<JSTemplate[]>([]);
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [loadingLanguages, setLoadingLanguages] = useState(false);
  const [loadingVoiceClones, setLoadingVoiceClones] = useState(false);
  const [loadingKnowledgeBases, setLoadingKnowledgeBases] = useState(false);
  const [loadingJsTemplates, setLoadingJsTemplates] = useState(false);

  // 展开/折叠状态
  const [expandedSections, setExpandedSections] = useState({
    api: true,
    call: true,
    assistant: true,
    knowledge: false,
    voiceClone: false,
  });

  // 加载助手信息
  useEffect(() => {
    const loadAssistant = async () => {
      try {
        setIsLoading(true);
        const response = await getAssistant(assistantId);
        if (response.code === 200 && response.data) {
          const data = response.data;
          setAssistant(data);
          setFormData({
            name: data.name || '',
            description: data.description || '',
            icon: data.icon || 'Bot',
            systemPrompt: data.systemPrompt || '',
            temperature: data.temperature || 0.6,
            maxTokens: data.maxTokens || 150,
            language: data.language || 'zh-cn',
            speaker: data.speaker || '101016',
            llmModel: data.llmModel || '',
            apiKey: data.apiKey || '',
            apiSecret: data.apiSecret || '',
            knowledgeBaseId: data.knowledgeBaseId || null,
            voiceCloneId: data.voiceCloneId || null,
            jsSourceId: data.jsSourceId || '',
          });

          // 加载音色和语言选项
          const ttsProvider = data.ttsProvider || 'tencent';
          loadVoiceOptions(ttsProvider, data.speaker);
          loadLanguageOptions(ttsProvider, data.language);
          
          // 加载其他选项
          loadVoiceClones();
          loadKnowledgeBases();
          loadJsTemplates();
        } else {
          Alert.alert('错误', response.msg || '加载助手信息失败');
          navigation.goBack();
        }
      } catch (error: any) {
        console.error('Load assistant error:', error);
        Alert.alert('错误', error.msg || error.message || '加载助手信息失败');
        navigation.goBack();
      } finally {
        setIsLoading(false);
      }
    };

    loadAssistant();
  }, [assistantId]);

  // 加载音色选项
  const loadVoiceOptions = async (provider: string, currentSpeaker?: string) => {
    if (!provider) return;

    setLoadingVoices(true);
    try {
      const response = await getVoiceOptions(provider);
      if (response.code === 200 && response.data?.voices) {
        setVoiceOptions(response.data.voices);
        if (currentSpeaker && !response.data.voices.find((v) => v.id === currentSpeaker)) {
          if (response.data.voices.length > 0) {
            setFormData((prev) => ({ ...prev, speaker: response.data.voices[0].id }));
          }
        }
      }
    } catch (error) {
      console.error('Load voice options error:', error);
    } finally {
      setLoadingVoices(false);
    }
  };

  // 加载语言选项
  const loadLanguageOptions = async (provider: string, currentLanguage?: string) => {
    setLoadingLanguages(true);
    try {
      const response = await getLanguageOptions(provider);
      if (response.code === 200 && response.data?.languages) {
        setLanguageOptions(response.data.languages);
        if (
          currentLanguage &&
          !response.data.languages.find((l) => l.code === currentLanguage)
        ) {
          if (response.data.languages.length > 0) {
            setFormData((prev) => ({ ...prev, language: response.data.languages[0].code }));
          }
        }
      }
    } catch (error) {
      console.error('Load language options error:', error);
    } finally {
      setLoadingLanguages(false);
    }
  };

  // 加载训练音色
  const loadVoiceClones = async () => {
    setLoadingVoiceClones(true);
    try {
      const response = await getVoiceClones();
      if (response.code === 200 && response.data) {
        setVoiceClones(response.data);
      }
    } catch (error) {
      console.error('Load voice clones error:', error);
    } finally {
      setLoadingVoiceClones(false);
    }
  };

  // 加载知识库
  const loadKnowledgeBases = async () => {
    setLoadingKnowledgeBases(true);
    try {
      const response = await getKnowledgeBaseByUser();
      console.log('Knowledge bases response:', response);
      if (response.code === 200 && Array.isArray(response.data)) {
        const transformedData = response.data
          .filter((item: any) => item && (item.key || item.knowledge_key || item.name || item.knowledge_name))
          .map((item: any) => ({
            id: item.key || item.knowledge_key || '',
            name: item.name || item.knowledge_name || '未命名知识库',
          }));
        console.log('Transformed knowledge bases:', transformedData);
        setKnowledgeBases(transformedData);
      } else {
        console.warn('Knowledge bases response format unexpected:', response);
        setKnowledgeBases([]);
      }
    } catch (error) {
      console.error('Load knowledge bases error:', error);
      setKnowledgeBases([]);
    } finally {
      setLoadingKnowledgeBases(false);
    }
  };

  // 加载JS模板
  const loadJsTemplates = async () => {
    setLoadingJsTemplates(true);
    try {
      const response = await jsTemplateService.getTemplates({ page: 1, limit: 100 });
      if (response.code === 200 && response.data) {
        setJsTemplates(response.data.data);
      }
    } catch (error) {
      console.error('Load JS templates error:', error);
    } finally {
      setLoadingJsTemplates(false);
    }
  };

  // 切换展开/折叠
  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // 保存设置
  const handleSave = async () => {
    if (!assistant) return;

    try {
      setIsSaving(true);
      const response = await updateAssistant(assistantId, {
        name: formData.name,
        description: formData.description,
        icon: formData.icon,
        systemPrompt: formData.systemPrompt,
        temperature: formData.temperature,
        maxTokens: formData.maxTokens,
        language: formData.language,
        speaker: formData.speaker,
        llmModel: formData.llmModel,
        apiKey: formData.apiKey,
        apiSecret: formData.apiSecret,
        knowledgeBaseId: formData.knowledgeBaseId,
        voiceCloneId: formData.voiceCloneId,
      });

      // 如果JS模板有变化，单独更新
      if (formData.jsSourceId !== assistant.jsSourceId) {
        try {
          await updateAssistantJS(assistantId, formData.jsSourceId || '');
        } catch (error: any) {
          console.error('Update JS template error:', error);
          // JS模板更新失败不影响其他设置
        }
      }

      if (response.code === 200) {
        Alert.alert('成功', '设置已保存');
        navigation.goBack();
      } else {
        Alert.alert('错误', response.msg || '保存失败');
      }
    } catch (error: any) {
      console.error('Save settings error:', error);
      Alert.alert('错误', error.msg || error.message || '保存失败');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <MainLayout
        navBarProps={{
          title: '控制面板',
          leftIcon: 'arrow-left',
          onLeftPress: () => navigation.goBack(),
        }}
        backgroundColor="#f8fafc"
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#a78bfa" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </MainLayout>
    );
  }

  if (!assistant) {
    return null;
  }

  return (
    <MainLayout
      navBarProps={{
        title: '控制面板',
        leftIcon: 'arrow-left',
        onLeftPress: () => navigation.goBack(),
      }}
      backgroundColor="#f8fafc"
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* API 密钥配置 */}
        <Card variant="default" padding="lg" style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => toggleSection('api')}
            activeOpacity={0.7}
          >
            <View style={styles.sectionHeaderLeft}>
              <Feather name="key" size={20} color="#64748b" />
              <Text style={styles.sectionTitle}>API 密钥</Text>
            </View>
            <Feather
              name={expandedSections.api ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#64748b"
            />
          </TouchableOpacity>

          {expandedSections.api && (
            <View style={styles.sectionContent}>
              <Input
                label="API Key"
                value={formData.apiKey}
                onChangeText={(text) => setFormData({ ...formData, apiKey: text })}
                placeholder="请输入 API Key"
                style={styles.input}
              />
              <Input
                label="API Secret"
                value={formData.apiSecret}
                onChangeText={(text) => setFormData({ ...formData, apiSecret: text })}
                placeholder="请输入 API Secret"
                secureTextEntry
                style={styles.input}
              />
            </View>
          )}
        </Card>

        {/* 通话设置 */}
        <Card variant="default" padding="lg" style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => toggleSection('call')}
            activeOpacity={0.7}
          >
            <View style={styles.sectionHeaderLeft}>
              <Feather name="settings" size={20} color="#64748b" />
              <Text style={styles.sectionTitle}>通话设置</Text>
            </View>
            <Feather
              name={expandedSections.call ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#64748b"
            />
          </TouchableOpacity>

          {expandedSections.call && (
            <View style={styles.sectionContent}>
              {/* 语言选择 */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>语言</Text>
                {loadingLanguages ? (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator size="small" color="#64748b" />
                    <Text style={styles.loadingText}>加载中...</Text>
                  </View>
                ) : languageOptions.length > 0 ? (
                  <Select
                    value={formData.language}
                    onValueChange={(value) => setFormData({ ...formData, language: value })}
                    options={languageOptions.map((lang) => ({
                      label: `${lang.name} (${lang.nativeName})`,
                      value: lang.code,
                    }))}
                    style={styles.select}
                  />
                ) : (
                  <TextInput
                    style={styles.textInput}
                    value={formData.language}
                    onChangeText={(text) => setFormData({ ...formData, language: text })}
                    placeholder="请输入语言代码"
                  />
                )}
              </View>

              {/* 发音人选择 */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>发音人</Text>
                {loadingVoices ? (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator size="small" color="#64748b" />
                    <Text style={styles.loadingText}>加载中...</Text>
                  </View>
                ) : voiceOptions.length > 0 ? (
                  <Select
                    value={formData.speaker}
                    onValueChange={(value) => setFormData({ ...formData, speaker: value })}
                    options={voiceOptions.map((voice) => ({
                      label: `${voice.name} - ${voice.description}`,
                      value: voice.id,
                    }))}
                    style={styles.select}
                  />
                ) : (
                  <TextInput
                    style={styles.textInput}
                    value={formData.speaker}
                    onChangeText={(text) => setFormData({ ...formData, speaker: text })}
                    placeholder="请输入发音人ID"
                  />
                )}
              </View>

              {/* 系统提示词 */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>系统提示词</Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  value={formData.systemPrompt}
                  onChangeText={(text) => setFormData({ ...formData, systemPrompt: text })}
                  placeholder="请输入系统提示词"
                  multiline
                  numberOfLines={3}
                />
              </View>

              {/* Temperature */}
              <View style={styles.inputGroup}>
                <View style={styles.sliderHeader}>
                  <Text style={styles.label}>Temperature</Text>
                  <Text style={styles.sliderValue}>{formData.temperature.toFixed(1)}</Text>
                </View>
                <Slider
                  value={formData.temperature}
                  onValueChange={(value) => setFormData({ ...formData, temperature: value })}
                  minimumValue={0}
                  maximumValue={1.5}
                  step={0.1}
                  style={styles.slider}
                />
                <TextInput
                  style={styles.sliderInput}
                  value={formData.temperature.toString()}
                  onChangeText={(text) => {
                    const value = parseFloat(text) || 0;
                    if (value >= 0 && value <= 1.5) {
                      setFormData({ ...formData, temperature: value });
                    }
                  }}
                  keyboardType="numeric"
                />
              </View>

              {/* Max Tokens */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Max Tokens</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.maxTokens.toString()}
                  onChangeText={(text) => {
                    const value = parseInt(text) || 0;
                    if (value >= 10 && value <= 2048) {
                      setFormData({ ...formData, maxTokens: value });
                    }
                  }}
                  placeholder="请输入最大Token数"
                  keyboardType="numeric"
                />
              </View>

              {/* LLM 模型 */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>LLM 模型</Text>
                <TextInput
                  style={styles.textInput}
                  value={formData.llmModel}
                  onChangeText={(text) => setFormData({ ...formData, llmModel: text })}
                  placeholder="请输入LLM模型名称"
                />
              </View>
            </View>
          )}
        </Card>

        {/* 助手设置 */}
        <Card variant="default" padding="lg" style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => toggleSection('assistant')}
            activeOpacity={0.7}
          >
            <View style={styles.sectionHeaderLeft}>
              <Feather name="user" size={20} color="#64748b" />
              <Text style={styles.sectionTitle}>助手设置</Text>
            </View>
            <Feather
              name={expandedSections.assistant ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#64748b"
            />
          </TouchableOpacity>

          {expandedSections.assistant && (
            <View style={styles.sectionContent}>
              <Input
                label="助手名称"
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="请输入助手名称"
                style={styles.input}
              />
              <Input
                label="助手描述"
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="请输入助手描述"
                multiline
                style={styles.input}
              />

              {/* 图标选择 */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>图标</Text>
                <View style={styles.iconGrid}>
                  {Object.keys(ICON_MAP).map((iconName) => {
                    const iconKey = iconName as keyof typeof ICON_MAP;
                    const iconFeatherName = ICON_MAP[iconKey] as keyof typeof Feather.glyphMap;
                    const iconColor = ICON_COLORS[iconName] || '#64748b';
                    const isSelected = formData.icon === iconName;

                    return (
                      <TouchableOpacity
                        key={iconName}
                        style={[
                          styles.iconOption,
                          isSelected && styles.iconOptionActive,
                          { borderColor: isSelected ? iconColor : '#e2e8f0' },
                        ]}
                        onPress={() => setFormData({ ...formData, icon: iconName })}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.iconOptionInner,
                            { backgroundColor: `${iconColor}15` },
                          ]}
                        >
                          <Feather name={iconFeatherName} size={24} color={iconColor} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
          )}
        </Card>

        {/* 知识库配置 */}
        <Card variant="default" padding="lg" style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => toggleSection('knowledge')}
            activeOpacity={0.7}
          >
            <View style={styles.sectionHeaderLeft}>
              <Feather name="book" size={20} color="#64748b" />
              <Text style={styles.sectionTitle}>知识库</Text>
            </View>
            <Feather
              name={expandedSections.knowledge ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#64748b"
            />
          </TouchableOpacity>

          {expandedSections.knowledge && (
            <View style={styles.sectionContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>选择知识库</Text>
                {loadingKnowledgeBases ? (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator size="small" color="#64748b" />
                    <Text style={styles.loadingText}>加载中...</Text>
                  </View>
                ) : (
                  <Select
                    value={formData.knowledgeBaseId || ''}
                    onValueChange={(value) =>
                      setFormData({ ...formData, knowledgeBaseId: value || null })
                    }
                    options={[
                      { label: '无', value: '' },
                      ...knowledgeBases.map((kb) => ({
                        label: kb.name,
                        value: kb.id,
                      })),
                    ]}
                    style={styles.select}
                  />
                )}
              </View>
            </View>
          )}
        </Card>

        {/* 训练音色配置 */}
        <Card variant="default" padding="lg" style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => toggleSection('voiceClone')}
            activeOpacity={0.7}
          >
            <View style={styles.sectionHeaderLeft}>
              <Feather name="mic" size={20} color="#64748b" />
              <Text style={styles.sectionTitle}>训练音色</Text>
            </View>
            <Feather
              name={expandedSections.voiceClone ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#64748b"
            />
          </TouchableOpacity>

          {expandedSections.voiceClone && (
            <View style={styles.sectionContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>选择训练音色</Text>
                {loadingVoiceClones ? (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator size="small" color="#64748b" />
                    <Text style={styles.loadingText}>加载中...</Text>
                  </View>
                ) : (
                  <Select
                    value={formData.voiceCloneId?.toString() || ''}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        voiceCloneId: value ? parseInt(value) : null,
                      })
                    }
                    options={[
                      { label: '无', value: '' },
                      ...voiceClones.map((vc) => ({
                        label: vc.voice_name,
                        value: vc.id.toString(),
                      })),
                    ]}
                    style={styles.select}
                  />
                )}
                <Text style={styles.hintText}>
                  训练音色优先级高于普通音色设置
                </Text>
              </View>
            </View>
          )}
        </Card>

        {/* JS模板配置 */}
        <Card variant="default" padding="lg" style={styles.sectionCard}>
          <TouchableOpacity
            style={styles.sectionHeader}
            onPress={() => toggleSection('assistant')}
            activeOpacity={0.7}
          >
            <View style={styles.sectionHeaderLeft}>
              <Feather name="code" size={20} color="#64748b" />
              <Text style={styles.sectionTitle}>JS模板</Text>
            </View>
            <Feather
              name={expandedSections.assistant ? 'chevron-up' : 'chevron-down'}
              size={20}
              color="#64748b"
            />
          </TouchableOpacity>

          {expandedSections.assistant && (
            <View style={styles.sectionContent}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>选择JS模板</Text>
                {loadingJsTemplates ? (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator size="small" color="#64748b" />
                    <Text style={styles.loadingText}>加载中...</Text>
                  </View>
                ) : (
                  <Select
                    value={formData.jsSourceId || ''}
                    onValueChange={(value) =>
                      setFormData({ ...formData, jsSourceId: value })
                    }
                    options={[
                      { label: '默认模板', value: '' },
                      ...jsTemplates.map((template) => ({
                        label: `${template.name} (${template.type === 'default' ? '默认' : '自定义'})`,
                        value: template.jsSourceId,
                      })),
                    ]}
                    style={styles.select}
                  />
                )}
                <Text style={styles.hintText}>
                  JS模板用于自定义助手行为逻辑
                </Text>
              </View>
            </View>
          )}
        </Card>

        {/* 保存按钮 */}
        <View style={styles.actions}>
          <Button
            variant="primary"
            fullWidth
            onPress={handleSave}
            loading={isSaving}
            style={styles.saveButton}
          >
            保存设置
          </Button>
        </View>

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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  sectionCard: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  sectionContent: {
    marginTop: 8,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
    marginBottom: 8,
  },
  input: {
    marginBottom: 0,
  },
  textInput: {
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
    minHeight: 80,
    textAlignVertical: 'top',
  },
  select: {
    marginBottom: 0,
  },
  loadingBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    gap: 8,
  },
  sliderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sliderValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#a78bfa',
  },
  slider: {
    marginBottom: 8,
  },
  sliderInput: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    color: '#1e293b',
    backgroundColor: '#ffffff',
    textAlign: 'center',
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  iconOption: {
    width: 64,
    height: 64,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  iconOptionActive: {
    borderWidth: 2,
  },
  iconOptionInner: {
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: {
    marginTop: 8,
  },
  saveButton: {
    marginBottom: 0,
  },
  hintText: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 6,
  },
  footer: {
    height: 20,
  },
});

export default AssistantControlPanelScreen;


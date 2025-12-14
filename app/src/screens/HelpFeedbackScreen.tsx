/**
 * 帮助与反馈页面
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Linking,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { MainLayout, Card, Button } from '../components';
import { useNavigation } from '@react-navigation/native';

const HelpFeedbackScreen: React.FC = () => {
  const navigation = useNavigation();
  const [feedbackType, setFeedbackType] = useState<'question' | 'bug' | 'suggestion' | 'other'>('question');
  const [feedbackText, setFeedbackText] = useState('');
  const [contactInfo, setContactInfo] = useState('');

  const handleSubmit = () => {
    if (!feedbackText.trim()) {
      Alert.alert('提示', '请输入反馈内容');
      return;
    }

    // TODO: 提交反馈到后端
    Alert.alert('成功', '感谢您的反馈，我们会尽快处理！');
    setFeedbackText('');
    setContactInfo('');
  };

  const faqItems = [
    {
      question: '如何创建智能助手？',
      answer: '在"助手"页面点击右上角的"+"按钮，填写助手名称、描述等信息即可创建。',
    },
    {
      question: '如何配置API密钥？',
      answer: '在助手详情页面点击设置按钮，进入控制面板，在"API密钥"部分配置您的API Key和Secret。',
    },
    {
      question: '支持哪些语音通话方式？',
      answer: '目前支持WebSocket和WebRTC两种通话方式，您可以在对话页面顶部切换。',
    },
    {
      question: '如何训练专属音色？',
      answer: '在"我的"页面找到"音色训练"功能，上传您的音频样本即可开始训练。',
    },
    {
      question: '如何查看使用统计？',
      answer: '在"账单"页面可以查看您的Token使用量、LLM调用次数等详细统计信息。',
    },
  ];

  return (
    <MainLayout
      navBarProps={{
        title: '帮助与反馈',
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
        {/* 常见问题 */}
        <Card variant="default" padding="lg" style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="help-circle" size={24} color="#64748b" />
            <Text style={styles.sectionTitle}>常见问题</Text>
          </View>
          <View style={styles.faqList}>
            {faqItems.map((item, index) => (
              <View key={index} style={styles.faqItem}>
                <Text style={styles.faqQuestion}>{item.question}</Text>
                <Text style={styles.faqAnswer}>{item.answer}</Text>
              </View>
            ))}
          </View>
        </Card>

        {/* 反馈表单 */}
        <Card variant="default" padding="lg" style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="message-square" size={24} color="#64748b" />
            <Text style={styles.sectionTitle}>意见反馈</Text>
          </View>

          {/* 反馈类型 */}
          <View style={styles.feedbackTypeContainer}>
            <Text style={styles.label}>反馈类型</Text>
            <View style={styles.typeButtons}>
              {[
                { key: 'question', label: '问题咨询', icon: 'help-circle' },
                { key: 'bug', label: '问题反馈', icon: 'alert-circle' },
                { key: 'suggestion', label: '功能建议', icon: 'lightbulb' },
                { key: 'other', label: '其他', icon: 'more-horizontal' },
              ].map((type) => (
                <TouchableOpacity
                  key={type.key}
                  style={[
                    styles.typeButton,
                    feedbackType === type.key && styles.typeButtonActive,
                  ]}
                  onPress={() => setFeedbackType(type.key as any)}
                  activeOpacity={0.7}
                >
                  <Feather
                    name={type.icon as any}
                    size={18}
                    color={feedbackType === type.key ? '#ffffff' : '#64748b'}
                  />
                  <Text
                    style={[
                      styles.typeButtonText,
                      feedbackType === type.key && styles.typeButtonTextActive,
                    ]}
                  >
                    {type.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 反馈内容 */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>反馈内容 *</Text>
            <TextInput
              style={styles.textArea}
              value={feedbackText}
              onChangeText={setFeedbackText}
              placeholder="请详细描述您的问题或建议..."
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={6}
              maxLength={500}
            />
            <Text style={styles.charCount}>
              {feedbackText.length} / 500
            </Text>
          </View>

          {/* 联系方式 */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>联系方式（可选）</Text>
            <TextInput
              style={styles.input}
              value={contactInfo}
              onChangeText={setContactInfo}
              placeholder="邮箱或手机号，方便我们联系您"
              placeholderTextColor="#94a3b8"
              keyboardType="email-address"
            />
          </View>

          <Button
            variant="primary"
            fullWidth
            onPress={handleSubmit}
            style={styles.submitButton}
          >
            提交反馈
          </Button>
        </Card>

        {/* 联系方式 */}
        <Card variant="default" padding="lg" style={styles.section}>
          <View style={styles.sectionHeader}>
            <Feather name="mail" size={24} color="#64748b" />
            <Text style={styles.sectionTitle}>联系我们</Text>
          </View>
          <View style={styles.contactList}>
            <TouchableOpacity
              style={styles.contactItem}
              onPress={() => Linking.openURL('mailto:support@lingecho.com')}
              activeOpacity={0.7}
            >
              <Feather name="mail" size={20} color="#a78bfa" />
              <Text style={styles.contactText}>support@lingecho.com</Text>
              <Feather name="chevron-right" size={20} color="#94a3b8" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.contactItem}
              onPress={() => Linking.openURL('https://github.com/lingecho')}
              activeOpacity={0.7}
            >
              <Feather name="github" size={20} color="#a78bfa" />
              <Text style={styles.contactText}>GitHub</Text>
              <Feather name="chevron-right" size={20} color="#94a3b8" />
            </TouchableOpacity>
          </View>
        </Card>
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
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1e293b',
  },
  faqList: {
    gap: 16,
  },
  faqItem: {
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  faqQuestion: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  faqAnswer: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
  },
  feedbackTypeContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#1e293b',
    marginBottom: 8,
  },
  typeButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  typeButtonActive: {
    backgroundColor: '#a78bfa',
    borderColor: '#a78bfa',
  },
  typeButtonText: {
    fontSize: 14,
    color: '#64748b',
    fontWeight: '500',
  },
  typeButtonTextActive: {
    color: '#ffffff',
  },
  inputGroup: {
    marginBottom: 16,
  },
  input: {
    height: 44,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#1e293b',
    backgroundColor: '#ffffff',
  },
  textArea: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1e293b',
    backgroundColor: '#ffffff',
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'right',
    marginTop: 4,
  },
  submitButton: {
    marginTop: 8,
  },
  contactList: {
    gap: 12,
  },
  contactItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
  },
  contactText: {
    flex: 1,
    fontSize: 15,
    color: '#1e293b',
  },
});

export default HelpFeedbackScreen;


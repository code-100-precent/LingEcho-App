/**
 * 助手详情页面 - 对话界面
 * 简化版：只支持文字输入和文本/语音输出
 */
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  TextInput,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { MainLayout } from '../components';
import { getAssistant, Assistant } from '../services/api/assistant';
import { plainTextStream, plainText, oneShotText, getAudioStatus, OneShotTextV2Request, OneShotTextRequest } from '../services/api/chat';
import { Audio } from 'expo-av';
import { getUploadsBaseURL } from '../config/apiConfig';

type AssistantDetailRouteParams = {
  AssistantDetail: {
    assistantId: number;
  };
};

interface ChatMessage {
  type: 'user' | 'agent';
  content: string;
  timestamp: string;
  id?: string;
  audioUrl?: string;
  isLoading?: boolean;
}

type OutputMode = 'text' | 'text+audio';

const AssistantDetailScreen: React.FC = () => {
  const route = useRoute<RouteProp<AssistantDetailRouteParams, 'AssistantDetail'>>();
  const navigation = useNavigation();
  const { assistantId } = route.params;

  const [assistant, setAssistant] = useState<Assistant | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [outputMode, setOutputMode] = useState<OutputMode>('text+audio'); // 默认文本+语音输出
  const scrollViewRef = useRef<ScrollView>(null);
  const currentAudioRef = useRef<Audio.Sound | null>(null);

  // 加载助手信息
  useEffect(() => {
    const loadAssistant = async () => {
      try {
        setIsLoading(true);
        const response = await getAssistant(assistantId);
        if (response.code === 200 && response.data) {
          setAssistant(response.data);
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

  // 滚动到底部
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages]);

  // 清理音频资源
  useEffect(() => {
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.unloadAsync();
      }
    };
  }, []);

  // 发送消息
  const handleSendMessage = async () => {
    if (!inputText.trim() || isLoading || !assistant) return;

    // 检查API密钥
    if (!assistant.apiKey || !assistant.apiSecret) {
      Alert.alert('提示', '请先在控制面板中设置API Key和API Secret');
      return;
    }

    const userMessage: ChatMessage = {
      type: 'user',
      content: inputText.trim(),
      timestamp: new Date().toLocaleTimeString(),
      id: `user-${Date.now()}`,
    };

    setMessages((prev) => [...prev, userMessage]);
    const messageToSend = inputText.trim();
    setInputText('');
    setIsLoading(true);

    // 生成或使用当前会话ID
    let sessionId = currentSessionId;
    if (!sessionId) {
      sessionId = `text_${Date.now()}`;
      setCurrentSessionId(sessionId);
    }

    // 添加AI加载消息
    const loadingMessageId = `loading-${Date.now()}`;
    const loadingMessage: ChatMessage = {
      type: 'agent',
      content: '',
      timestamp: new Date().toLocaleTimeString(),
      id: loadingMessageId,
      isLoading: true,
    };
    setMessages((prev) => [...prev, loadingMessage]);

    // 构建请求数据
    const requestData: OneShotTextV2Request = {
      apiKey: assistant.apiKey,
      apiSecret: assistant.apiSecret,
      text: messageToSend,
      assistantId: assistant.id,
      language: assistant.language || 'zh-cn',
      sessionId: sessionId,
      systemPrompt: assistant.systemPrompt || '',
      speaker: assistant.speaker || '101016',
      voiceCloneId: assistant.voiceCloneId || null,
      knowledgeBaseId: assistant.knowledgeBaseId || null,
      temperature: assistant.temperature || 0.6,
      maxTokens: assistant.maxTokens || 150,
      llmModel: assistant.llmModel || '',
    };

    try {
      let accumulatedText = '';
      let responseAudioUrl: string | undefined;
      let requestId: string | undefined;

      if (outputMode === 'text') {
        // 纯文本模式：使用 plain_text 接口
        const fullResponse = await plainText(requestData);
        
        if (fullResponse.code === 200 && fullResponse.data) {
          const responseText = fullResponse.data.text || '';
          
          // 模拟流式输出效果
          const words = responseText.split('');
          for (let i = 0; i < words.length; i++) {
            accumulatedText += words[i];
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === loadingMessageId
                  ? {
                      ...msg,
                      content: accumulatedText,
                      isLoading: false,
                    }
                  : msg
              )
            );
            await new Promise(resolve => setTimeout(resolve, 20));
          }
          
          setIsLoading(false);
        } else {
          throw new Error(fullResponse.msg || '请求失败');
        }
      } else {
        // 文本+语音模式：使用 one_shot_text 接口，然后轮询获取音频
        const oneShotRequest: OneShotTextRequest = {
          apiKey: requestData.apiKey,
          apiSecret: requestData.apiSecret,
          text: requestData.text,
          assistantId: requestData.assistantId,
          language: requestData.language,
          sessionId: requestData.sessionId,
          systemPrompt: requestData.systemPrompt,
          speaker: requestData.speaker,
          voiceCloneId: requestData.voiceCloneId,
          knowledgeBaseId: requestData.knowledgeBaseId,
          temperature: requestData.temperature,
          maxTokens: requestData.maxTokens,
        };

        const oneShotResponse = await oneShotText(oneShotRequest);
        
        if (oneShotResponse.code === 200 && oneShotResponse.data) {
          const responseText = oneShotResponse.data.text || '';
          requestId = oneShotResponse.data.requestId;
          
          // 先显示文本（模拟流式输出）
          const words = responseText.split('');
          for (let i = 0; i < words.length; i++) {
            accumulatedText += words[i];
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === loadingMessageId
                  ? {
                      ...msg,
                      content: accumulatedText,
                      isLoading: false,
                    }
                  : msg
              )
            );
            await new Promise(resolve => setTimeout(resolve, 20));
          }
          
          setIsLoading(false);
          
          // 如果有 requestId，开始轮询获取音频
          if (requestId) {
            pollAudioStatus(requestId, loadingMessageId);
          }
        } else {
          throw new Error(oneShotResponse.msg || '请求失败');
        }
      }
    } catch (error: any) {
      console.error('Send message error:', error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessageId
            ? {
                ...msg,
                content: `错误: ${error.message || '发送消息失败'}`,
                isLoading: false,
              }
            : msg
        )
      );
      setIsLoading(false);
      Alert.alert('错误', error.message || '发送消息失败');
    }
  };

  // 播放TTS音频
  const playTTSAudio = async (audioUrl: string) => {
    try {
      // 停止当前播放的音频
      if (currentAudioRef.current) {
        await currentAudioRef.current.unloadAsync();
        currentAudioRef.current = null;
      }

      const uploadsBaseURL = getUploadsBaseURL();
      const fullAudioUrl = audioUrl.startsWith('http')
        ? audioUrl
        : audioUrl.replace('/media/', `${uploadsBaseURL}/`);

      const { sound } = await Audio.Sound.createAsync(
        { uri: fullAudioUrl },
        { shouldPlay: true }
      );

      currentAudioRef.current = sound;

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          sound.unloadAsync();
          currentAudioRef.current = null;
        }
      });
    } catch (error) {
      console.error('Play TTS audio error:', error);
    }
  };

  // 停止当前音频
  const stopCurrentAudio = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.unloadAsync();
      currentAudioRef.current = null;
    }
  };

  // 轮询获取音频状态
  const pollAudioStatus = async (requestId: string, messageId: string) => {
    const maxAttempts = 30; // 最多轮询30次（30秒）
    let attempts = 0;

    const poll = async () => {
      if (attempts >= maxAttempts) {
        console.log('轮询超时，停止获取音频');
        return;
      }

      try {
        attempts++;
        const response = await getAudioStatus(requestId);
        
        if (response.code === 200 && response.data) {
          if (response.data.status === 'completed' && response.data.audioUrl) {
            // 获取音频URL
            const uploadsBaseURL = getUploadsBaseURL();
            const audioUrl = response.data.audioUrl.replace('/media/', `${uploadsBaseURL}/`);
            
            // 更新消息的音频URL
            setMessages((prev) =>
              prev.map((msg) =>
                msg.id === messageId
                  ? { ...msg, audioUrl: audioUrl }
                  : msg
              )
            );
            
            // 自动播放音频
            playTTSAudio(audioUrl);
          } else if (response.data.status === 'processing' || response.data.status === 'pending') {
            // 还在处理中，继续轮询
            setTimeout(poll, 1000); // 1秒后再次轮询
          } else {
            console.log('音频处理失败或状态未知:', response.data.status);
          }
        } else {
          console.error('获取音频状态失败:', response.msg);
        }
      } catch (error: any) {
        console.error('轮询音频状态错误:', error);
        // 即使出错也继续尝试
        if (attempts < maxAttempts) {
          setTimeout(poll, 1000);
        }
      }
    };

    // 开始轮询
    setTimeout(poll, 1000); // 1秒后开始第一次轮询
  };

  // 获取图标名称
  const getIconName = (icon: string): keyof typeof Feather.glyphMap => {
    const iconMap: Record<string, keyof typeof Feather.glyphMap> = {
      Bot: 'message-circle',
      MessageCircle: 'message-circle',
      Users: 'users',
      Zap: 'zap',
      Circle: 'circle',
    };
    return iconMap[icon] || 'message-circle';
  };

  // 获取图标颜色
  const getIconColor = (icon: string): string => {
    const colorMap: Record<string, string> = {
      Bot: '#a78bfa',
      MessageCircle: '#3b82f6',
      Users: '#10b981',
      Zap: '#f59e0b',
      Circle: '#64748b',
    };
    return colorMap[icon] || '#a78bfa';
  };

  if (isLoading && !assistant) {
    return (
      <MainLayout
        navBarProps={{
          title: '加载中...',
          leftIcon: 'arrow-left',
          onLeftPress: () => navigation.goBack(),
        }}
        backgroundColor="#ffffff"
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#a78bfa" />
          <Text style={styles.loadingText}>加载助手信息...</Text>
        </View>
      </MainLayout>
    );
  }

  if (!assistant) {
    return null;
  }

  const iconName = getIconName(assistant.icon);
  const iconColor = getIconColor(assistant.icon);

  return (
    <MainLayout
      navBarProps={{
        title: assistant.name,
        leftIcon: 'arrow-left',
        onLeftPress: () => navigation.goBack(),
        rightIcon: 'settings',
        onRightPress: () => {
          navigation.navigate('AssistantControlPanel' as never, {
            assistantId: assistant.id,
          } as never);
        },
      }}
      backgroundColor="#ffffff"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* 输出模式选择器 */}
        <View style={styles.modeSelectorContainer}>
          <View style={styles.modeSelector}>
            <TouchableOpacity
              style={[
                styles.modeButton,
                outputMode === 'text' && styles.modeButtonActive,
              ]}
              onPress={() => setOutputMode('text')}
              activeOpacity={0.7}
            >
              <Feather
                name="type"
                size={16}
                color={outputMode === 'text' ? '#a78bfa' : '#64748b'}
              />
              <Text
                style={[
                  styles.modeButtonText,
                  outputMode === 'text' && styles.modeButtonTextActive,
                ]}
              >
                纯文本
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.modeButton,
                outputMode === 'text+audio' && styles.modeButtonActive,
              ]}
              onPress={() => setOutputMode('text+audio')}
              activeOpacity={0.7}
            >
              <Feather
                name="volume-2"
                size={16}
                color={outputMode === 'text+audio' ? '#a78bfa' : '#64748b'}
              />
              <Text
                style={[
                  styles.modeButtonText,
                  outputMode === 'text+audio' && styles.modeButtonTextActive,
                ]}
              >
                文本+语音
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 消息列表 */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <View
                style={[styles.emptyIconContainer, { backgroundColor: `${iconColor}15` }]}
              >
                <Feather name={iconName} size={48} color={iconColor} />
              </View>
              <Text style={styles.emptyTitle}>开始对话</Text>
              <Text style={styles.emptyDescription}>
                在下方输入消息，与 {assistant.name} 开始对话
              </Text>
            </View>
          ) : (
            messages.map((message, index) => (
              <View
                key={message.id || index}
                style={[
                  styles.messageWrapper,
                  message.type === 'user' ? styles.messageWrapperUser : styles.messageWrapperAgent,
                ]}
              >
                {message.type === 'agent' && (
                  <View
                    style={[styles.avatarContainer, { backgroundColor: `${iconColor}15` }]}
                  >
                    <Feather name={iconName} size={20} color={iconColor} />
                  </View>
                )}
                <View
                  style={[
                    styles.messageBubble,
                    message.type === 'user' ? styles.messageBubbleUser : styles.messageBubbleAgent,
                  ]}
                >
                  {message.isLoading ? (
                    <View style={styles.loadingMessage}>
                      <ActivityIndicator size="small" color="#64748b" />
                      <Text style={styles.loadingText}>正在思考...</Text>
                    </View>
                  ) : (
                    <Text
                      style={[
                        styles.messageText,
                        message.type === 'user' ? styles.messageTextUser : styles.messageTextAgent,
                      ]}
                    >
                      {message.content}
                    </Text>
                  )}
                  {message.audioUrl && message.type === 'agent' && outputMode === 'text+audio' && (
                    <TouchableOpacity
                      style={styles.audioButton}
                      onPress={() => {
                        if (currentAudioRef.current) {
                          stopCurrentAudio();
                        } else {
                          playTTSAudio(message.audioUrl!);
                        }
                      }}
                    >
                      <Feather
                        name={currentAudioRef.current ? 'pause' : 'play'}
                        size={16}
                        color="#64748b"
                      />
                    </TouchableOpacity>
                  )}
                </View>
                {message.type === 'user' && (
                  <View style={[styles.avatarContainer, styles.avatarContainerUser]}>
                    <Feather name="user" size={20} color="#3b82f6" />
                  </View>
                )}
              </View>
            ))
          )}
        </ScrollView>

        {/* 输入区域 */}
        <View style={styles.inputContainer}>
          <View style={styles.inputWrapper}>
            <TextInput
              style={styles.textInput}
              value={inputText}
              onChangeText={setInputText}
              placeholder="输入消息..."
              placeholderTextColor="#94a3b8"
              multiline
              maxLength={500}
              editable={!isLoading}
            />
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  styles.sendButton,
                  (!inputText.trim() || isLoading) && styles.sendButtonDisabled,
                ]}
                onPress={handleSendMessage}
                disabled={!inputText.trim() || isLoading}
                activeOpacity={0.7}
              >
                <Feather
                  name="send"
                  size={18}
                  color={inputText.trim() ? '#ffffff' : '#94a3b8'}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </MainLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
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
  modeSelectorContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  modeSelector: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 20,
    padding: 3,
    gap: 3,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    gap: 6,
  },
  modeButtonActive: {
    backgroundColor: '#ffffff',
    shadowColor: '#a78bfa',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 2,
  },
  modeButtonText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
  },
  modeButtonTextActive: {
    color: '#a78bfa',
    fontWeight: '600',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 10,
  },
  emptyDescription: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
  },
  messageWrapper: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  messageWrapperUser: {
    justifyContent: 'flex-end',
  },
  messageWrapperAgent: {
    justifyContent: 'flex-start',
  },
  avatarContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 8,
    flexShrink: 0,
  },
  avatarContainerUser: {
    backgroundColor: '#e0e7ff',
  },
  messageBubble: {
    maxWidth: '75%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
  },
  messageBubbleUser: {
    backgroundColor: '#a78bfa',
    borderBottomRightRadius: 6,
  },
  messageBubbleAgent: {
    backgroundColor: '#f1f5f9',
    borderBottomLeftRadius: 6,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  messageTextUser: {
    color: '#ffffff',
  },
  messageTextAgent: {
    color: '#1e293b',
  },
  loadingMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  audioButton: {
    marginTop: 8,
    paddingVertical: 4,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 8,
    backgroundColor: '#f8fafc',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  textInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: '#1e293b',
    backgroundColor: 'transparent',
    borderWidth: 0,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButton: {
    backgroundColor: '#a78bfa',
  },
  sendButtonDisabled: {
    backgroundColor: '#e2e8f0',
    opacity: 0.5,
  },
});

export default AssistantDetailScreen;

/**
 * 音色克隆屏幕
 */
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
  RefreshControl,
  Modal,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { MainLayout, Card, Button } from '../components';
import {
  getVoiceClones,
  updateVoiceClone,
  deleteVoiceClone,
  synthesizeVoice,
  getSynthesisHistory,
  getTrainingTexts,
  createTrainingTask,
  submitTrainingAudio,
  queryTrainingTask,
  createVolcengineTask,
  submitVolcengineAudio,
  queryVolcengineTask,
  synthesizeVolcengineVoice,
  VoiceClone,
  SynthesisRecord,
  TrainingText,
  TrainingTextSegment,
  TrainingTask,
} from '../services/api/voiceClone';
import { get } from '../utils/request';
import { Audio } from 'expo-av';
import * as DocumentPicker from 'expo-document-picker';
import { Picker } from '@react-native-picker/picker';

const VoiceCloneScreen: React.FC = () => {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<'training' | 'clones' | 'history'>('training');
  const [selectedProvider, setSelectedProvider] = useState<'xunfei' | 'volcengine'>('xunfei');
  const [voiceClones, setVoiceClones] = useState<VoiceClone[]>([]);
  const [synthesisHistory, setSynthesisHistory] = useState<SynthesisRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 编辑音色
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingClone, setEditingClone] = useState<VoiceClone | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  // 合成语音
  const [showSynthesisModal, setShowSynthesisModal] = useState(false);
  const [selectedClone, setSelectedClone] = useState<VoiceClone | null>(null);
  const [synthesisText, setSynthesisText] = useState('');
  const [synthesizing, setSynthesizing] = useState(false);

  // 音频播放
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [playingId, setPlayingId] = useState<number | null>(null);

  // 训练相关状态
  const [trainingTexts, setTrainingTexts] = useState<TrainingText[]>([]);
  const [loadingTexts, setLoadingTexts] = useState(false);
  
  // 朗读克隆训练状态
  const [taskName, setTaskName] = useState('');
  const [sex, setSex] = useState<number>(1); // 1: female, 2: male
  const [ageGroup, setAgeGroup] = useState<number>(2); // 1: child, 2: youth, 3: middle, 4: old
  const [language, setLanguage] = useState('zh-CN');
  const [creating, setCreating] = useState(false);
  const [currentTask, setCurrentTask] = useState<TrainingTask | null>(null);
  const [selectedTextSegment, setSelectedTextSegment] = useState<TrainingTextSegment | null>(null);
  const [uploading, setUploading] = useState(false);
  
  // 音频克隆训练状态
  const [volcengineTaskName, setVolcengineTaskName] = useState('');
  const [volcengineCurrentTask, setVolcengineCurrentTask] = useState<{ taskId: string; speakerId: string } | null>(null);
  const [volcengineTaskStatus, setVolcengineTaskStatus] = useState<any>(null);
  const [volcengineCreating, setVolcengineCreating] = useState(false);
  const [querying, setQuerying] = useState(false);

  // 配置检查状态
  const [configChecked, setConfigChecked] = useState(false);
  const [xunfeiConfigured, setXunfeiConfigured] = useState(false);
  const [volcengineConfigured, setVolcengineConfigured] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  
  // 音频克隆配置表单
  const [volcengineConfig, setVolcengineConfig] = useState({
    app_id: '',
    token: '',
    cluster: 'volcano_icl',
    voice_type: '',
    encoding: 'pcm',
    frame_duration: '20ms',
  });
  const [savingConfig, setSavingConfig] = useState(false);

  useEffect(() => {
    loadData();
    checkConfig();
    return () => {
      if (sound) {
        sound.unloadAsync();
      }
    };
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      if (selectedProvider === 'xunfei') {
        await Promise.all([loadTrainingTexts(), loadVoiceClones(), loadSynthesisHistory()]);
      } else {
        await Promise.all([loadVoiceClones(), loadSynthesisHistory()]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const checkConfig = async () => {
    try {
      const response = await get('/system/init');
      if (response.code === 200 && response.data) {
        const xunfeiConfig = response.data.voiceClone?.xunfei;
        const volcengineConfigData = response.data.voiceClone?.volcengine;
        setXunfeiConfigured(xunfeiConfig?.configured || false);
        setVolcengineConfigured(volcengineConfigData?.configured || false);
        
        // 如果有配置数据，填充表单
        if (volcengineConfigData?.config) {
          setVolcengineConfig({
            app_id: volcengineConfigData.config.app_id || '',
            token: volcengineConfigData.config.token || '',
            cluster: volcengineConfigData.config.cluster || 'volcano_icl',
            voice_type: volcengineConfigData.config.voice_type || '',
            encoding: volcengineConfigData.config.encoding || 'pcm',
            frame_duration: volcengineConfigData.config.frame_duration || '20ms',
          });
        }
      }
      setConfigChecked(true);
    } catch (error) {
      console.error('检查配置失败:', error);
      setConfigChecked(true);
    }
  };

  const handleSaveVolcengineConfig = async () => {
    if (!volcengineConfig.app_id.trim() || !volcengineConfig.token.trim()) {
      Alert.alert('提示', '请填写 App ID 和 Token');
      return;
    }

    try {
      setSavingConfig(true);
      const response = await saveVoiceCloneConfig({
        provider: 'volcengine',
        config: volcengineConfig,
      });

      if (response.code === 200) {
        Alert.alert('成功', '配置保存成功');
        setVolcengineConfigured(true);
        await checkConfig();
      } else {
        Alert.alert('错误', response.msg || '保存配置失败');
      }
    } catch (error: any) {
      console.error('保存配置失败:', error);
      Alert.alert('错误', error.message || '保存配置失败');
    } finally {
      setSavingConfig(false);
    }
  };

  const loadTrainingTexts = async () => {
    try {
      setLoadingTexts(true);
      console.log('=== 开始获取训练文本 ===');
      console.log('API URL: /voice/training-texts');
      const response = await getTrainingTexts();
      console.log('=== 训练文本响应 ===');
      console.log('Response code:', response.code);
      console.log('Response msg:', response.msg);
      console.log('Response data:', JSON.stringify(response.data, null, 2));
      
      if (response.code === 200) {
        // 确保 data 是数组
        let list: TrainingText[] = [];
        if (Array.isArray(response.data)) {
          list = response.data;
        } else if (response.data && Array.isArray((response.data as any).data)) {
          list = (response.data as any).data;
        } else if (response.data && (response.data as any).list) {
          list = (response.data as any).list;
        } else if (response.data && typeof response.data === 'object') {
          // 如果返回的是单个对象，包装成数组
          list = [response.data as any];
        }
        
        // 处理字段名兼容（下划线转驼峰）
        list = list.map((text: any) => ({
          id: text.id || text.ID,
          textId: text.textId || text.text_id,
          textName: text.textName || text.text_name || '训练文本',
          language: text.language || 'zh-CN',
          isActive: text.isActive ?? text.is_active ?? true,
          textSegments: (text.textSegments || text.text_segments || []).map((seg: any) => ({
            id: seg.id || seg.ID,
            textId: seg.textId || seg.text_id,
            segId: seg.segId || seg.seg_id,
            segText: seg.segText || seg.seg_text || '',
            createdAt: seg.createdAt || seg.created_at,
          })),
        }));
        
        console.log('处理后的训练文本列表:', list.length, '条');
        if (list.length > 0) {
          console.log('第一条训练文本:', JSON.stringify(list[0], null, 2));
          console.log('第一条的段落数:', list[0].textSegments?.length || 0);
        }
        setTrainingTexts(list);
        
        if (list.length === 0) {
          Alert.alert('提示', '训练文本列表为空，但您仍可以直接上传音频文件进行训练');
        }
      } else {
        console.error('获取训练文本失败:', response.msg);
        Alert.alert('错误', response.msg || '获取训练文本失败');
      }
    } catch (error: any) {
      console.error('获取训练文本异常:', error);
      Alert.alert('错误', error.message || '获取训练文本失败');
    } finally {
      setLoadingTexts(false);
    }
  };

  const loadVoiceClones = async () => {
    try {
      const response = await getVoiceClones(selectedProvider);
      console.log('=== 音色列表响应 ===');
      console.log('Provider:', selectedProvider);
      console.log('Response:', JSON.stringify(response, null, 2));
      if (response.code === 200) {
        // 确保 data 是数组
        let list: VoiceClone[] = [];
        if (Array.isArray(response.data)) {
          list = response.data;
        } else if (response.data && Array.isArray((response.data as any).data)) {
          list = (response.data as any).data;
        } else if (response.data && (response.data as any).list) {
          list = (response.data as any).list;
        }
        
        // 处理字段名兼容（下划线转驼峰）
        list = list.map((clone: any) => ({
          id: clone.id || clone.ID,
          voiceName: clone.voiceName || clone.voice_name || '未命名音色',
          voiceDescription: clone.voiceDescription || clone.voice_description || '',
          audioUrl: clone.audioUrl || clone.audio_url || '',
          provider: clone.provider || selectedProvider,
          createdAt: clone.createdAt || clone.created_at || '',
        }));
        
        console.log('处理后的音色列表:', list.length, '条');
        setVoiceClones(list);
      }
    } catch (error) {
      console.error('获取音色列表失败', error);
    }
  };

  const loadSynthesisHistory = async () => {
    try {
      const response = await getSynthesisHistory(selectedProvider);
      if (response.code === 200) {
        // 确保 data 是数组
        let list: SynthesisRecord[] = [];
        if (Array.isArray(response.data)) {
          list = response.data;
        } else if (response.data && Array.isArray((response.data as any).data)) {
          list = (response.data as any).data;
        } else if (response.data && (response.data as any).list) {
          list = (response.data as any).list;
        }
        
        // 处理字段名兼容（下划线转驼峰）
        list = list.map((record: any) => ({
          id: record.id || record.ID,
          voiceCloneId: record.voiceCloneId || record.voice_clone_id,
          text: record.text || '',
          audioUrl: record.audioUrl || record.audio_url || '',
          createdAt: record.createdAt || record.created_at || '',
        }));
        
        setSynthesisHistory(list);
      }
    } catch (error) {
      console.error('获取合成历史失败', error);
    }
  };

  // 当提供商改变时重新加载数据
  useEffect(() => {
    if (!isLoading) {
      loadVoiceClones();
      loadSynthesisHistory();
      if (selectedProvider === 'xunfei') {
        loadTrainingTexts();
      }
    }
  }, [selectedProvider]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData();
    setIsRefreshing(false);
  };

  const handleCreateTask = async () => {
    if (!taskName.trim()) {
      Alert.alert('提示', '请输入任务名称');
      return;
    }

    try {
      setCreating(true);
      console.log('=== 创建训练任务 ===');
      console.log('参数:', { taskName, sex, ageGroup, language, provider: selectedProvider });
      const response = await createTrainingTask({
        taskName,
        sex,
        ageGroup,
        language,
        provider: selectedProvider,
      });
      console.log('响应:', JSON.stringify(response, null, 2));

      if (response.code === 200 && response.data) {
        // 后端返回的是 task_id，需要兼容处理
        const taskId = response.data.taskId || response.data.task_id;
        if (taskId) {
          setCurrentTask({ taskId, status: 2 });
          console.log('任务创建成功，taskId:', taskId);
          Alert.alert('成功', '任务创建成功！请上传音频文件进行训练');
        } else {
          console.error('响应中没有 taskId:', response.data);
          Alert.alert('错误', '创建任务失败：返回数据缺少任务ID');
        }
      } else {
        Alert.alert('错误', response.msg || '创建任务失败');
      }
    } catch (error: any) {
      console.error('创建任务失败:', error);
      Alert.alert('错误', error.message || '创建任务失败');
    } finally {
      setCreating(false);
    }
  };

  const handleQueryTask = async () => {
    if (!currentTask?.taskId) {
      Alert.alert('提示', '请先创建任务');
      return;
    }

    try {
      console.log('=== 查询任务状态 ===');
      console.log('任务ID:', currentTask.taskId);
      const response = await queryTrainingTask(currentTask.taskId);
      console.log('响应:', JSON.stringify(response, null, 2));
      if (response.code === 200 && response.data) {
        // 处理字段名兼容
        const taskData = {
          taskId: response.data.taskId || response.data.task_id || currentTask.taskId,
          status: response.data.status ?? 2,
          progress: response.data.progress,
          message: response.data.message || response.data.failed_reason,
        };
        setCurrentTask(taskData);
        
        if (taskData.status === 1) {
          Alert.alert('成功', '训练完成！请到"我的音色"标签页查看');
          loadVoiceClones(); // 刷新音色列表
        } else if (taskData.status === 0) {
          Alert.alert('失败', taskData.message || '训练失败');
        } else {
          Alert.alert('状态', `当前状态: ${getStatusText(taskData.status)}`);
        }
      }
    } catch (error: any) {
      console.error('查询失败:', error);
      Alert.alert('错误', error.message || '查询失败');
    }
  };

  // 直接上传音频（不选择文本段落）
  const handleDirectUploadAudio = async () => {
    if (!currentTask?.taskId) {
      Alert.alert('提示', '请先创建训练任务');
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      setUploading(true);
      console.log('=== 直接上传训练音频 ===');
      console.log('任务ID:', currentTask.taskId);
      console.log('文件:', result.assets[0].name);
      
      const formData = new FormData();
      formData.append('taskId', currentTask.taskId);
      formData.append('textSegId', '0'); // 使用 0 表示不指定文本段落
      formData.append('audio', {
        uri: result.assets[0].uri,
        type: result.assets[0].mimeType || 'audio/wav',
        name: result.assets[0].name,
      } as any);

      const response = await submitTrainingAudio({
        taskId: currentTask.taskId,
        textSegId: 0,
        audio: formData,
      });
      console.log('响应:', JSON.stringify(response, null, 2));

      if (response.code === 200) {
        Alert.alert('成功', '音频上传成功！可以继续上传更多音频或查询训练状态');
      } else {
        Alert.alert('错误', response.msg || '上传失败');
      }
    } catch (error: any) {
      console.error('上传失败:', error);
      Alert.alert('错误', error.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const handleUploadAudio = async () => {
    if (!currentTask?.taskId) {
      Alert.alert('提示', '请先创建任务');
      return;
    }
    if (!selectedTextSegment) {
      Alert.alert('提示', '请先选择训练文本段落');
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      setUploading(true);
      console.log('=== 上传训练音频 ===');
      console.log('任务ID:', currentTask.taskId);
      console.log('文本段落ID:', selectedTextSegment.id);
      console.log('文件:', result.assets[0].name);
      
      const formData = new FormData();
      formData.append('taskId', currentTask.taskId);
      formData.append('textSegId', selectedTextSegment.id.toString());
      formData.append('audio', {
        uri: result.assets[0].uri,
        type: result.assets[0].mimeType || 'audio/wav',
        name: result.assets[0].name,
      } as any);

      const response = await submitTrainingAudio({
        taskId: currentTask.taskId,
        textSegId: selectedTextSegment.id,
        audio: formData,
      });
      console.log('响应:', JSON.stringify(response, null, 2));

      if (response.code === 200) {
        Alert.alert('成功', '音频上传成功！可以继续上传其他段落或查询训练状态');
        // 清除选中的文本段落，方便继续上传
        setSelectedTextSegment(null);
      } else {
        Alert.alert('错误', response.msg || '上传失败');
      }
    } catch (error: any) {
      console.error('上传失败:', error);
      Alert.alert('错误', error.message || '上传失败');
    } finally {
      setUploading(false);
    }
  };

  const getStatusText = (status: number) => {
    switch (status) {
      case -1: return '训练中';
      case 0: return '失败';
      case 1: return '成功';
      case 2: return '排队中';
      default: return '未知';
    }
  };

  const getStatusColor = (status: number) => {
    switch (status) {
      case -1: return '#3b82f6';
      case 0: return '#ef4444';
      case 1: return '#10b981';
      case 2: return '#f59e0b';
      default: return '#64748b';
    }
  };

  const handleEdit = (clone: VoiceClone) => {
    setEditingClone(clone);
    setEditName(clone.voiceName);
    setEditDescription(clone.voiceDescription || '');
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingClone || !editName.trim()) {
      Alert.alert('提示', '请输入音色名称');
      return;
    }

    try {
      const response = await updateVoiceClone({
        id: editingClone.id,
        voiceName: editName,
        voiceDescription: editDescription,
      });

      if (response.code === 200) {
        Alert.alert('成功', '更新成功');
        setShowEditModal(false);
        loadVoiceClones();
      } else {
        Alert.alert('错误', response.msg || '更新失败');
      }
    } catch (error: any) {
      Alert.alert('错误', error.message || '更新失败');
    }
  };

  const handleDelete = (clone: VoiceClone) => {
    Alert.alert('确认删除', `确定要删除音色"${clone.voiceName}"吗？`, [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: async () => {
          try {
            const response = await deleteVoiceClone(clone.id);
            if (response.code === 200) {
              Alert.alert('成功', '删除成功');
              loadVoiceClones();
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

  const handleSynthesize = (clone: VoiceClone) => {
    setSelectedClone(clone);
    setSynthesisText('');
    setShowSynthesisModal(true);
  };

  const handleSubmitSynthesis = async () => {
    if (!selectedClone || !synthesisText.trim()) {
      Alert.alert('提示', '请输入要合成的文本');
      return;
    }

    try {
      setSynthesizing(true);
      
      if (selectedProvider === 'volcengine') {
        // 音频克隆使用 assetId
        const assetId = (selectedClone as any).assetId || selectedClone.voiceName;
        if (!assetId) {
          Alert.alert('错误', '音色ID不存在');
          return;
        }
        const response = await synthesizeVolcengineVoice({
          assetId,
          text: synthesisText,
          language: 'zh-CN',
        });
        if (response.code === 200) {
          Alert.alert('成功', '合成成功');
          setShowSynthesisModal(false);
          loadSynthesisHistory();
        } else {
          Alert.alert('错误', response.msg || '合成失败');
        }
      } else {
        // 朗读克隆
        const response = await synthesizeVoice({
          voiceCloneId: selectedClone.id,
          text: synthesisText,
          language: 'zh-CN',
        });
        if (response.code === 200) {
          Alert.alert('成功', '合成成功');
          setShowSynthesisModal(false);
          loadSynthesisHistory();
        } else {
          Alert.alert('错误', response.msg || '合成失败');
        }
      }
    } catch (error: any) {
      Alert.alert('错误', error.message || '合成失败');
    } finally {
      setSynthesizing(false);
    }
  };

  // 音频克隆：创建训练任务
  const handleVolcengineCreateTask = async () => {
    if (!volcengineTaskName.trim()) {
      Alert.alert('提示', '请输入任务名称');
      return;
    }

    try {
      setVolcengineCreating(true);
      console.log('=== 创建音频克隆训练任务 ===');
      console.log('参数:', { taskName: volcengineTaskName, language: 'zh-CN' });
      
      const response = await createVolcengineTask({
        taskName: volcengineTaskName,
        language: 'zh-CN',
      });
      
      console.log('响应:', JSON.stringify(response, null, 2));

      if (response.code === 200 && response.data) {
        const { taskId, speakerId } = response.data;
        setVolcengineCurrentTask({ taskId, speakerId });
        console.log('任务创建成功，taskId:', taskId, 'speakerId:', speakerId);
        Alert.alert('成功', '任务创建成功！请上传音频文件进行训练\n\n任务ID已自动保存，无需手动输入');
      } else {
        Alert.alert('错误', response.msg || '创建任务失败');
      }
    } catch (error: any) {
      console.error('创建任务失败:', error);
      Alert.alert('错误', error.message || '创建任务失败');
    } finally {
      setVolcengineCreating(false);
    }
  };

  // 音频克隆：提交音频
  const handleVolcengineUploadAudio = async () => {
    if (!volcengineCurrentTask) {
      Alert.alert('提示', '请先创建训练任务');
      return;
    }

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: 'audio/*',
        copyToCacheDirectory: true,
      });

      if (result.canceled) {
        return;
      }

      setUploading(true);
      const formData = new FormData();
      formData.append('taskId', volcengineCurrentTask.taskId);
      formData.append('language', 'zh-CN');
      formData.append('audio', {
        uri: result.assets[0].uri,
        type: result.assets[0].mimeType || 'audio/wav',
        name: result.assets[0].name,
      } as any);

      const response = await submitVolcengineAudio({
        audio: formData,
        taskId: volcengineCurrentTask.taskId,
        language: 'zh-CN',
      });

      if (response.code === 200) {
        Alert.alert('成功', '音频提交成功！\n\n可以继续上传更多音频（最多10次）或查询训练状态');
      } else {
        Alert.alert('错误', response.msg || '提交失败');
      }
    } catch (error: any) {
      Alert.alert('错误', error.message || '提交失败');
    } finally {
      setUploading(false);
    }
  };

  // 音频克隆：查询状态
  const handleVolcengineQueryStatus = async () => {
    if (!volcengineCurrentTask) {
      Alert.alert('提示', '请先创建训练任务');
      return;
    }

    try {
      setQuerying(true);
      const response = await queryVolcengineTask(volcengineCurrentTask.speakerId);
      if (response.code === 200 && response.data) {
        const statusData = {
          speakerId: response.data.speakerId,
          status: response.data.status ?? 0,
          failedDesc: response.data.failedDesc || '',
        };
        setVolcengineTaskStatus(statusData);
        
        const statusText = getVolcengineStatusText(statusData.status);
        let message = `状态: ${statusText}`;
        if (statusData.status === 2 || statusData.status === 4) {
          message += '\n\n训练已完成，可以在"我的音色"中使用该音色进行合成';
        }
        Alert.alert('查询成功', message);
        
        // 如果训练成功，刷新音色列表
        if (statusData.status === 2 || statusData.status === 4) {
          loadVoiceClones();
        }
      } else {
        Alert.alert('错误', response.msg || '查询失败');
      }
    } catch (error: any) {
      Alert.alert('错误', error.message || '查询失败');
    } finally {
      setQuerying(false);
    }
  };

  const getVolcengineStatusText = (status: number) => {
    switch (status) {
      case 0: return '未找到';
      case 1: return '训练中';
      case 2: return '成功';
      case 3: return '失败';
      case 4: return '可用';
      default: return '未知';
    }
  };

  const getVolcengineStatusColor = (status: number) => {
    switch (status) {
      case 0: return '#64748b';
      case 1: return '#3b82f6';
      case 2: return '#10b981';
      case 3: return '#ef4444';
      case 4: return '#10b981';
      default: return '#64748b';
    }
  };

  const playAudio = async (audioUrl: string, id: number) => {
    try {
      if (sound) {
        await sound.unloadAsync();
      }

      if (playingId === id) {
        setPlayingId(null);
        return;
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: audioUrl },
        { shouldPlay: true }
      );

      setSound(newSound);
      setPlayingId(id);

      newSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          setPlayingId(null);
        }
      });
    } catch (error) {
      console.error('播放音频失败', error);
      Alert.alert('错误', '播放失败');
    }
  };

  if (isLoading) {
    return (
      <MainLayout
        navBarProps={{
          title: '音色克隆',
          leftIcon: 'arrow-left',
          onLeftPress: () => navigation.goBack(),
        }}
      >
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#a855f7" />
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      navBarProps={{
        title: '音色克隆',
        leftIcon: 'arrow-left',
        onLeftPress: () => navigation.goBack(),
      }}
    >
      <View style={styles.container}>
        {/* 提供商选择 */}
        <View style={styles.providerSelector}>
          <TouchableOpacity
            style={[
              styles.providerButton,
              selectedProvider === 'xunfei' && styles.providerButtonActive,
            ]}
            onPress={() => setSelectedProvider('xunfei')}
          >
            <View
              style={[
                styles.providerIcon,
                selectedProvider === 'xunfei'
                  ? styles.providerIconXunfeiActive
                  : styles.providerIconXunfei,
              ]}
            >
              <Feather name="zap" size={20} color={selectedProvider === 'xunfei' ? '#ffffff' : '#7c3aed'} />
            </View>
            <View style={styles.providerInfo}>
              <Text
                style={[
                  styles.providerName,
                  selectedProvider === 'xunfei' && styles.providerNameActive,
                ]}
              >
                朗读克隆
              </Text>
              <Text style={styles.providerDesc}>高质量中文音色</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.providerButton,
              selectedProvider === 'volcengine' && styles.providerButtonActive,
            ]}
            onPress={() => setSelectedProvider('volcengine')}
          >
            <View
              style={[
                styles.providerIcon,
                selectedProvider === 'volcengine'
                  ? styles.providerIconVolcengineActive
                  : styles.providerIconVolcengine,
              ]}
            >
              <Feather name="activity" size={20} color={selectedProvider === 'volcengine' ? '#ffffff' : '#f97316'} />
            </View>
            <View style={styles.providerInfo}>
              <Text
                style={[
                  styles.providerName,
                  selectedProvider === 'volcengine' && styles.providerNameActive,
                ]}
              >
                音频克隆
              </Text>
              <Text style={styles.providerDesc}>多语言支持</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* 标签页切换 */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tab, activeTab === 'training' && styles.tabActive]}
            onPress={() => setActiveTab('training')}
          >
            <Feather
              name="upload"
              size={18}
              color={activeTab === 'training' ? '#a855f7' : '#64748b'}
            />
            <Text
              style={[styles.tabText, activeTab === 'training' && styles.tabTextActive]}
            >
              音色训练
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'clones' && styles.tabActive]}
            onPress={() => setActiveTab('clones')}
          >
            <Feather
              name="mic"
              size={18}
              color={activeTab === 'clones' ? '#a855f7' : '#64748b'}
            />
            <Text
              style={[styles.tabText, activeTab === 'clones' && styles.tabTextActive]}
            >
              我的音色
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tab, activeTab === 'history' && styles.tabActive]}
            onPress={() => setActiveTab('history')}
          >
            <Feather
              name="clock"
              size={18}
              color={activeTab === 'history' ? '#a855f7' : '#64748b'}
            />
            <Text
              style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}
            >
              合成历史
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
          }
        >
          {activeTab === 'training' ? (
            <View style={styles.tabContent}>
              {selectedProvider === 'xunfei' ? (
                // 朗读克隆训练界面
                <>
                  {/* 创建训练任务 */}
                  <Card variant="elevated" padding="md" style={styles.trainingCard}>
                    <Text style={styles.cardTitle}>创建训练任务</Text>
                    <Text style={styles.cardDescription}>填写任务信息开始训练</Text>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>任务名称 *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="请输入任务名称"
                    value={taskName}
                    onChangeText={setTaskName}
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                <View style={styles.formRow}>
                  <View style={styles.formHalf}>
                    <Text style={styles.label}>性别 *</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={sex}
                        onValueChange={(value) => setSex(value)}
                        style={styles.picker}
                      >
                        <Picker.Item label="女性" value={1} />
                        <Picker.Item label="男性" value={2} />
                      </Picker>
                    </View>
                  </View>

                  <View style={styles.formHalf}>
                    <Text style={styles.label}>年龄段 *</Text>
                    <View style={styles.pickerContainer}>
                      <Picker
                        selectedValue={ageGroup}
                        onValueChange={(value) => setAgeGroup(value)}
                        style={styles.picker}
                      >
                        <Picker.Item label="儿童" value={1} />
                        <Picker.Item label="青年" value={2} />
                        <Picker.Item label="中年" value={3} />
                        <Picker.Item label="老年" value={4} />
                      </Picker>
                    </View>
                  </View>
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>语言</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="zh-CN"
                    value={language}
                    onChangeText={setLanguage}
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                <Button
                  variant="primary"
                  onPress={handleCreateTask}
                  disabled={creating}
                  style={styles.createButton}
                >
                  {creating ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.buttonText}>创建任务</Text>
                  )}
                </Button>

                {/* 当前任务状态 */}
                {currentTask && (
                  <View style={styles.taskStatus}>
                    <View style={styles.taskStatusHeader}>
                      <Feather name="info" size={16} color="#a855f7" />
                      <Text style={styles.taskStatusTitle}>任务状态</Text>
                    </View>
                    <View style={styles.taskStatusItem}>
                      <Text style={styles.taskStatusLabel}>任务ID:</Text>
                      <Text style={styles.taskStatusValue}>{currentTask.taskId}</Text>
                    </View>
                    <View style={styles.taskStatusItem}>
                      <Text style={styles.taskStatusLabel}>状态:</Text>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: getStatusColor(currentTask.status) + '20' },
                        ]}
                      >
                        <Text
                          style={[
                            styles.statusBadgeText,
                            { color: getStatusColor(currentTask.status) },
                          ]}
                        >
                          {getStatusText(currentTask.status)}
                        </Text>
                      </View>
                    </View>
                    {currentTask.progress != null && (
                      <View style={styles.taskStatusItem}>
                        <Text style={styles.taskStatusLabel}>进度:</Text>
                        <Text style={styles.taskStatusValue}>{currentTask.progress}%</Text>
                      </View>
                    )}
                    {currentTask.message && (
                      <View style={styles.taskMessage}>
                        <Text style={styles.taskMessageText}>{currentTask.message}</Text>
                      </View>
                    )}
                    <Button
                      variant="outline"
                      onPress={handleQueryTask}
                      style={styles.queryButton}
                    >
                      <Text style={styles.queryButtonText}>查询状态</Text>
                    </Button>
                  </View>
                )}
              </Card>

              {/* 上传音频区域 - 独立卡片，始终显示在任务创建后 */}
              {currentTask && (
                <Card variant="elevated" padding="md" style={styles.trainingCard}>
                  <Text style={styles.cardTitle}>上传训练音频</Text>
                  <Text style={styles.cardDescription}>
                    {selectedTextSegment ? '已选择文本段落，上传对应音频' : '直接上传音频文件进行训练'}
                  </Text>

                  {/* 音频要求说明 */}
                  <View style={styles.audioRequirementsBox}>
                    <View style={styles.audioRequirementsHeader}>
                      <Feather name="info" size={16} color="#3b82f6" />
                      <Text style={styles.audioRequirementsTitle}>音频要求</Text>
                    </View>
                    <View style={styles.audioRequirementsList}>
                      <View style={styles.audioRequirementItem}>
                        <View style={styles.audioRequirementDot} />
                        <Text style={styles.audioRequirementText}>安静环境录制，无背景噪音</Text>
                      </View>
                      <View style={styles.audioRequirementItem}>
                        <View style={styles.audioRequirementDot} />
                        <Text style={styles.audioRequirementText}>采样率 16kHz 或更高</Text>
                      </View>
                      <View style={styles.audioRequirementItem}>
                        <View style={styles.audioRequirementDot} />
                        <Text style={styles.audioRequirementText}>单声道音频</Text>
                      </View>
                      <View style={styles.audioRequirementItem}>
                        <View style={styles.audioRequirementDot} />
                        <Text style={styles.audioRequirementText}>每段音频 3-10 秒</Text>
                      </View>
                      <View style={styles.audioRequirementItem}>
                        <View style={styles.audioRequirementDot} />
                        <Text style={styles.audioRequirementText}>需要上传多段音频（建议 10 段以上）</Text>
                      </View>
                    </View>
                  </View>

                  {selectedTextSegment ? (
                    // 选择了文本段落
                    <>
                      <View style={styles.selectedSegmentInfo}>
                        <Feather name="check-circle" size={18} color="#10b981" />
                        <View style={styles.selectedSegmentTextContainer}>
                          <Text style={styles.selectedSegmentLabel}>已选择段落</Text>
                          <Text style={styles.selectedSegmentPreview} numberOfLines={2}>
                            {selectedTextSegment.segText}
                          </Text>
                        </View>
                        <TouchableOpacity 
                          onPress={() => setSelectedTextSegment(null)}
                          style={styles.clearSelectionButton}
                        >
                          <Feather name="x" size={20} color="#64748b" />
                        </TouchableOpacity>
                      </View>
                      <Button
                        variant="primary"
                        onPress={handleUploadAudio}
                        disabled={uploading}
                        style={styles.uploadButton}
                      >
                        {uploading ? (
                          <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                          <View style={styles.uploadButtonContent}>
                            <Feather name="upload" size={18} color="#ffffff" />
                            <Text style={styles.buttonText}>上传音频文件</Text>
                          </View>
                        )}
                      </Button>
                    </>
                  ) : (
                    // 没有选择文本段落，提供直接上传
                    <>
                      <View style={styles.noTextHintBox}>
                        <Feather name="upload-cloud" size={20} color="#3b82f6" />
                        <View style={styles.noTextHintContent}>
                          <Text style={styles.noTextHintTitle}>直接上传音频</Text>
                          <Text style={styles.noTextHintDesc}>
                            {trainingTexts.length === 0 || (trainingTexts[0]?.textSegments?.length || 0) === 0
                              ? '训练文本为空，可以直接上传音频文件进行训练'
                              : '可以不选择文本段落，直接上传音频文件'}
                          </Text>
                        </View>
                      </View>
                      <Button
                        variant="primary"
                        onPress={handleDirectUploadAudio}
                        disabled={uploading}
                        style={styles.uploadButton}
                      >
                        {uploading ? (
                          <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                          <View style={styles.uploadButtonContent}>
                            <Feather name="upload" size={18} color="#ffffff" />
                            <Text style={styles.buttonText}>选择并上传音频</Text>
                          </View>
                        )}
                      </Button>
                      <Text style={styles.uploadHintText}>
                        支持 WAV、MP3 等格式，每个音频 3-10 秒，建议上传 10 段以上
                      </Text>
                    </>
                  )}
                </Card>
              )}

              {/* 训练文本列表 - 可选 */}
              <Card variant="elevated" padding="md" style={styles.trainingCard}>
                <View style={styles.cardHeader}>
                  <View>
                    <Text style={styles.cardTitle}>训练文本</Text>
                    <Text style={styles.cardDescription}>选择文本段落进行录音</Text>
                  </View>
                  <TouchableOpacity 
                    onPress={() => {
                      console.log('手动刷新训练文本');
                      loadTrainingTexts();
                    }} 
                    disabled={loadingTexts}
                  >
                    <Feather
                      name="refresh-cw"
                      size={20}
                      color={loadingTexts ? '#cbd5e1' : '#64748b'}
                    />
                  </TouchableOpacity>
                </View>

                {loadingTexts ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color="#a855f7" />
                    <Text style={styles.loadingText}>加载中...</Text>
                  </View>
                ) : trainingTexts.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Feather name="file-text" size={32} color="#cbd5e1" />
                    <Text style={styles.emptyText}>暂无训练文本</Text>
                    <Text style={styles.emptySubtext}>点击右上角刷新按钮获取训练文本</Text>
                  </View>
                ) : (
                  <View style={styles.textList}>
                    {Array.isArray(trainingTexts) && trainingTexts.map((text, textIndex) => (
                      <View key={text.id} style={styles.textItem}>
                        <View style={styles.textHeader}>
                          <View style={styles.textHeaderLeft}>
                            <View style={styles.textIndexBadge}>
                              <Text style={styles.textIndexText}>{textIndex + 1}</Text>
                            </View>
                            <View>
                              <Text style={styles.textName}>{text.textName}</Text>
                              <Text style={styles.textCount}>
                                {text.textSegments?.length || 0} 个段落
                              </Text>
                            </View>
                          </View>
                        </View>
                        
                        {Array.isArray(text.textSegments) && text.textSegments.map((segment, segmentIndex) => (
                          <TouchableOpacity
                            key={segment.id}
                            style={[
                              styles.segmentItem,
                              selectedTextSegment?.id === segment.id &&
                                styles.segmentItemSelected,
                            ]}
                            onPress={() => {
                              console.log('选择文本段落:', segment.id, segment.segText);
                              setSelectedTextSegment(segment);
                            }}
                            activeOpacity={0.7}
                          >
                            <View style={[
                              styles.segmentCheck,
                              selectedTextSegment?.id === segment.id &&
                                styles.segmentCheckSelected,
                            ]}>
                              {selectedTextSegment?.id === segment.id ? (
                                <Feather name="check" size={16} color="#ffffff" />
                              ) : (
                                <Text style={styles.segmentIndexText}>{segmentIndex + 1}</Text>
                              )}
                            </View>
                            <Text
                              style={[
                                styles.segmentText,
                                selectedTextSegment?.id === segment.id &&
                                  styles.segmentTextSelected,
                              ]}
                            >
                              {segment.segText}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    ))}
                  </View>
                )}
              </Card>
            </>
          ) : (
            // 音频克隆训练界面
            <>
                  {!volcengineConfigured ? (
                    // 配置表单
                    <Card variant="elevated" padding="md" style={styles.trainingCard}>
                      <Text style={styles.cardTitle}>配置音频克隆音色训练服务</Text>
                      <Text style={styles.cardDescription}>请填写以下配置信息以使用音色克隆功能</Text>

                      <View style={styles.formGroup}>
                        <Text style={styles.label}>App ID *</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="请输入 App ID"
                          value={volcengineConfig.app_id}
                          onChangeText={(text) => setVolcengineConfig({ ...volcengineConfig, app_id: text })}
                          placeholderTextColor="#94a3b8"
                        />
                      </View>

                      <View style={styles.formGroup}>
                        <Text style={styles.label}>Token *</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="请输入 Token"
                          value={volcengineConfig.token}
                          onChangeText={(text) => setVolcengineConfig({ ...volcengineConfig, token: text })}
                          secureTextEntry
                          placeholderTextColor="#94a3b8"
                        />
                      </View>

                      <View style={styles.formGroup}>
                        <Text style={styles.label}>Cluster</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="volcano_icl"
                          value={volcengineConfig.cluster}
                          onChangeText={(text) => setVolcengineConfig({ ...volcengineConfig, cluster: text })}
                          placeholderTextColor="#94a3b8"
                        />
                      </View>

                      <View style={styles.formGroup}>
                        <Text style={styles.label}>Voice Type</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="请输入音色类型"
                          value={volcengineConfig.voice_type}
                          onChangeText={(text) => setVolcengineConfig({ ...volcengineConfig, voice_type: text })}
                          placeholderTextColor="#94a3b8"
                        />
                      </View>

                      <View style={styles.formGroup}>
                        <Text style={styles.label}>Encoding</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="pcm"
                          value={volcengineConfig.encoding}
                          onChangeText={(text) => setVolcengineConfig({ ...volcengineConfig, encoding: text })}
                          placeholderTextColor="#94a3b8"
                        />
                      </View>

                      <View style={styles.formGroup}>
                        <Text style={styles.label}>Frame Duration</Text>
                        <TextInput
                          style={styles.input}
                          placeholder="20ms"
                          value={volcengineConfig.frame_duration}
                          onChangeText={(text) => setVolcengineConfig({ ...volcengineConfig, frame_duration: text })}
                          placeholderTextColor="#94a3b8"
                        />
                      </View>

                      <Button
                        variant="primary"
                        onPress={handleSaveVolcengineConfig}
                        disabled={savingConfig || !volcengineConfig.app_id.trim() || !volcengineConfig.token.trim()}
                        style={styles.createButton}
                      >
                        {savingConfig ? (
                          <ActivityIndicator size="small" color="#ffffff" />
                        ) : (
                          <View style={styles.uploadButtonContent}>
                            <Feather name="save" size={16} color="#ffffff" />
                            <Text style={styles.buttonText}>保存配置</Text>
                          </View>
                        )}
                      </Button>
                    </Card>
                  ) : (
                    <>
                      {/* 创建训练任务 */}
                      <Card variant="elevated" padding="md" style={styles.trainingCard}>
                        <Text style={styles.cardTitle}>步骤 1: 创建训练任务</Text>
                        <Text style={styles.cardDescription}>系统将自动生成唯一的音色ID，无需手动输入</Text>

                        <View style={styles.formGroup}>
                          <Text style={styles.label}>任务名称 *</Text>
                          <TextInput
                            style={styles.input}
                            placeholder="例如：我的声音"
                            value={volcengineTaskName}
                            onChangeText={setVolcengineTaskName}
                            placeholderTextColor="#94a3b8"
                            editable={!volcengineCurrentTask}
                          />
                        </View>

                        {volcengineCurrentTask && (
                          <View style={styles.infoBox}>
                            <Feather name="check-circle" size={16} color="#10b981" />
                            <Text style={styles.infoText}>
                              任务已创建: {volcengineCurrentTask.taskId.substring(0, 20)}...
                            </Text>
                          </View>
                        )}

                        <Button
                          variant="primary"
                          onPress={handleVolcengineCreateTask}
                          disabled={volcengineCreating || !volcengineTaskName.trim() || !!volcengineCurrentTask}
                          style={styles.createButton}
                        >
                          {volcengineCreating ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                          ) : (
                            <View style={styles.uploadButtonContent}>
                              <Feather name="plus" size={16} color="#ffffff" />
                              <Text style={styles.buttonText}>
                                {volcengineCurrentTask ? '任务已创建' : '创建任务'}
                              </Text>
                            </View>
                          )}
                        </Button>
                      </Card>

                      {/* 上传音频 */}
                      <Card variant="elevated" padding="md" style={styles.trainingCard}>
                        <Text style={styles.cardTitle}>步骤 2: 上传训练音频</Text>
                        <Text style={styles.cardDescription}>
                          可以上传多个音频样本（最多10次）
                        </Text>

                        <Button
                          variant="primary"
                          onPress={handleVolcengineUploadAudio}
                          disabled={uploading || !volcengineCurrentTask}
                          style={styles.createButton}
                        >
                          {uploading ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                          ) : (
                            <View style={styles.uploadButtonContent}>
                              <Feather name="upload" size={16} color="#ffffff" />
                              <Text style={styles.buttonText}>上传音频</Text>
                            </View>
                          )}
                        </Button>
                      </Card>

                      {/* 查询状态 */}
                      <Card variant="elevated" padding="md" style={styles.trainingCard}>
                        <Text style={styles.cardTitle}>步骤 3: 查询训练状态</Text>
                        <Text style={styles.cardDescription}>查询音色训练进度</Text>

                        <Button
                          variant="primary"
                          onPress={handleVolcengineQueryStatus}
                          disabled={querying || !volcengineCurrentTask}
                          style={styles.createButton}
                        >
                          {querying ? (
                            <ActivityIndicator size="small" color="#ffffff" />
                          ) : (
                            <View style={styles.uploadButtonContent}>
                              <Feather name="search" size={16} color="#ffffff" />
                              <Text style={styles.buttonText}>查询训练状态</Text>
                            </View>
                          )}
                        </Button>

                        {volcengineTaskStatus && (
                          <View style={styles.statusCard}>
                            <Text style={styles.statusLabel}>状态:</Text>
                            <Text style={styles.statusValue}>
                              {getVolcengineStatusText(volcengineTaskStatus.status)}
                            </Text>
                            {volcengineTaskStatus.failedDesc && (
                              <>
                                <Text style={styles.statusLabel}>失败原因:</Text>
                                <Text style={styles.statusValue}>{volcengineTaskStatus.failedDesc}</Text>
                              </>
                            )}
                          </View>
                        )}
                      </Card>
                    </>
                  )}
                </>
              )}
            </View>
          ) : activeTab === 'clones' ? (
            <View style={styles.tabContent}>
              {voiceClones.length === 0 ? (
                <Card variant="default" padding="lg" style={styles.emptyCard}>
                  <View style={styles.emptyState}>
                    <Feather name="mic" size={48} color="#cbd5e1" />
                    <Text style={styles.emptyText}>还没有音色</Text>
                    <Text style={styles.emptySubtext}>
                      训练完成后，音色会自动出现在这里
                    </Text>
                  </View>
                </Card>
              ) : (
                <View style={styles.cloneList}>
                  {Array.isArray(voiceClones) && voiceClones.map((clone) => (
                    <Card key={clone.id} variant="elevated" padding="md" style={styles.cloneCard}>
                      <View style={styles.cloneHeader}>
                        <View style={styles.cloneInfo}>
                          <Text style={styles.cloneName}>{clone.voiceName}</Text>
                          {clone.voiceDescription && (
                            <Text style={styles.cloneDescription}>
                              {clone.voiceDescription}
                            </Text>
                          )}
                        </View>
                      </View>

                      <View style={styles.cloneActions}>
                        {clone.audioUrl && (
                          <TouchableOpacity
                            style={styles.actionButton}
                            onPress={() => playAudio(clone.audioUrl!, clone.id)}
                          >
                            <Feather
                              name={playingId === clone.id ? 'pause' : 'play'}
                              size={16}
                              color="#64748b"
                            />
                            <Text style={styles.actionButtonText}>
                              {playingId === clone.id ? '暂停' : '试听'}
                            </Text>
                          </TouchableOpacity>
                        )}
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => handleSynthesize(clone)}
                        >
                          <Feather name="volume-2" size={16} color="#64748b" />
                          <Text style={styles.actionButtonText}>合成</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => handleEdit(clone)}
                        >
                          <Feather name="edit-3" size={16} color="#64748b" />
                          <Text style={styles.actionButtonText}>编辑</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.actionButton}
                          onPress={() => handleDelete(clone)}
                        >
                          <Feather name="trash-2" size={16} color="#ef4444" />
                          <Text style={[styles.actionButtonText, { color: '#ef4444' }]}>
                            删除
                          </Text>
                        </TouchableOpacity>
                      </View>
                    </Card>
                  ))}
                </View>
              )}
            </View>
          ) : (
            <View style={styles.tabContent}>
              {synthesisHistory.length === 0 ? (
                <Card variant="default" padding="lg" style={styles.emptyCard}>
                  <View style={styles.emptyState}>
                    <Feather name="clock" size={48} color="#cbd5e1" />
                    <Text style={styles.emptyText}>还没有合成记录</Text>
                  </View>
                </Card>
              ) : (
                <View style={styles.historyList}>
                  {Array.isArray(synthesisHistory) && synthesisHistory.map((record) => (
                    <Card key={record.id} variant="default" padding="md" style={styles.historyCard}>
                      <View style={styles.historyHeader}>
                        <Text style={styles.historyText} numberOfLines={2}>
                          {record.text}
                        </Text>
                        <TouchableOpacity
                          style={styles.playButton}
                          onPress={() => playAudio(record.audioUrl, record.id)}
                        >
                          <Feather
                            name={playingId === record.id ? 'pause' : 'play'}
                            size={20}
                            color="#a855f7"
                          />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.historyTime}>
                        {new Date(record.createdAt).toLocaleString()}
                      </Text>
                    </Card>
                  ))}
                </View>
              )}
            </View>
          )}
        </ScrollView>

        {/* 编辑音色Modal */}
        <Modal
          visible={showEditModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowEditModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>编辑音色</Text>
                <TouchableOpacity onPress={() => setShowEditModal(false)}>
                  <Feather name="x" size={24} color="#64748b" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <View style={styles.formGroup}>
                  <Text style={styles.label}>音色名称 *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="请输入音色名称"
                    value={editName}
                    onChangeText={setEditName}
                    placeholderTextColor="#94a3b8"
                  />
                </View>

                <View style={styles.formGroup}>
                  <Text style={styles.label}>音色描述</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="请输入音色描述"
                    value={editDescription}
                    onChangeText={setEditDescription}
                    multiline
                    numberOfLines={3}
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>

              <View style={styles.modalFooter}>
                <Button
                  variant="outline"
                  onPress={() => setShowEditModal(false)}
                  style={styles.modalButton}
                >
                  <Text style={styles.cancelButtonText}>取消</Text>
                </Button>
                <Button variant="primary" onPress={handleSaveEdit} style={styles.modalButton}>
                  <Text style={styles.submitButtonText}>保存</Text>
                </Button>
              </View>
            </View>
          </View>
        </Modal>

        {/* 合成语音Modal */}
        <Modal
          visible={showSynthesisModal}
          transparent
          animationType="slide"
          onRequestClose={() => setShowSynthesisModal(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>合成语音</Text>
                <TouchableOpacity onPress={() => setShowSynthesisModal(false)}>
                  <Feather name="x" size={24} color="#64748b" />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                {selectedClone && (
                  <View style={styles.selectedCloneInfo}>
                    <Text style={styles.selectedCloneLabel}>选中音色：</Text>
                    <Text style={styles.selectedCloneName}>{selectedClone.voiceName}</Text>
                  </View>
                )}

                <View style={styles.formGroup}>
                  <Text style={styles.label}>合成文本 *</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="请输入要合成的文本"
                    value={synthesisText}
                    onChangeText={setSynthesisText}
                    multiline
                    numberOfLines={5}
                    placeholderTextColor="#94a3b8"
                  />
                </View>
              </View>

              <View style={styles.modalFooter}>
                <Button
                  variant="outline"
                  onPress={() => setShowSynthesisModal(false)}
                  style={styles.modalButton}
                >
                  <Text style={styles.cancelButtonText}>取消</Text>
                </Button>
                <Button
                  variant="primary"
                  onPress={handleSubmitSynthesis}
                  style={styles.modalButton}
                  disabled={synthesizing}
                >
                  {synthesizing ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    <Text style={styles.submitButtonText}>合成</Text>
                  )}
                </Button>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </MainLayout>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#a855f7',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#a855f7',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 16,
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
    fontSize: 12,
    color: '#94a3b8',
  },
  cloneList: {
    gap: 12,
  },
  cloneCard: {
    marginBottom: 0,
  },
  cloneHeader: {
    marginBottom: 12,
  },
  cloneInfo: {
    flex: 1,
  },
  cloneName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  cloneDescription: {
    fontSize: 13,
    color: '#64748b',
  },
  cloneActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 6,
  },
  actionButtonText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  historyList: {
    gap: 12,
  },
  historyCard: {
    marginBottom: 0,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 8,
  },
  historyText: {
    flex: 1,
    fontSize: 14,
    color: '#1e293b',
    lineHeight: 20,
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#f3e8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyTime: {
    fontSize: 12,
    color: '#94a3b8',
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
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  selectedCloneInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f3e8ff',
    borderRadius: 8,
    marginBottom: 16,
  },
  selectedCloneLabel: {
    fontSize: 14,
    color: '#64748b',
    marginRight: 8,
  },
  selectedCloneName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#a855f7',
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
  trainingCard: {
    marginBottom: 16,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  cardDescription: {
    fontSize: 13,
    color: '#64748b',
  },
  formRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  formHalf: {
    flex: 1,
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 8,
    backgroundColor: '#ffffff',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  picker: {
    height: 50,
  },
  createButton: {
    marginTop: 8,
  },
  buttonText: {
    fontSize: 14,
    color: '#ffffff',
    fontWeight: '500',
  },
  taskStatus: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#f0fdf4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#86efac',
  },
  taskStatusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  taskStatusMainTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
  },
  taskInfoBox: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  taskInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  taskInfoLabel: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  taskInfoValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e293b',
    fontFamily: 'monospace',
  },
  nextStepBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  nextStepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  nextStepTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1e40af',
  },
  nextStepDesc: {
    fontSize: 12,
    color: '#1e40af',
    lineHeight: 18,
  },
  taskActionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  taskActionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  taskActionButtonText: {
    fontSize: 13,
    color: '#64748b',
  },
  taskStatusTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  taskStatusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  taskStatusLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  taskStatusValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1e293b',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  taskMessage: {
    marginTop: 8,
    padding: 8,
    backgroundColor: '#fef3c7',
    borderRadius: 6,
  },
  taskMessageText: {
    fontSize: 12,
    color: '#92400e',
  },
  queryButton: {
    marginTop: 12,
  },
  queryButtonText: {
    fontSize: 13,
    color: '#64748b',
  },
  textList: {
    gap: 16,
  },
  textItem: {
    marginBottom: 8,
  },
  textHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#f3e8ff',
    borderRadius: 12,
    marginBottom: 12,
  },
  textHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  textIndexBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#7c3aed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  textIndexText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  textName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#7c3aed',
    marginBottom: 2,
  },
  textCount: {
    fontSize: 12,
    color: '#a78bfa',
  },
  segmentItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  segmentItemSelected: {
    borderColor: '#a855f7',
    backgroundColor: '#faf5ff',
    shadowColor: '#a855f7',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  segmentCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#cbd5e1',
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  segmentCheckSelected: {
    borderColor: '#a855f7',
    backgroundColor: '#a855f7',
  },
  segmentIndexText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748b',
  },
  segmentText: {
    flex: 1,
    fontSize: 14,
    color: '#1e293b',
    lineHeight: 22,
  },
  segmentTextSelected: {
    color: '#7c3aed',
    fontWeight: '500',
  },
  uploadSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  selectedSegmentInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    backgroundColor: '#d1fae5',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#6ee7b7',
  },
  selectedSegmentTextContainer: {
    flex: 1,
  },
  selectedSegmentLabel: {
    fontSize: 13,
    color: '#065f46',
    fontWeight: '600',
    marginBottom: 4,
  },
  selectedSegmentPreview: {
    fontSize: 12,
    color: '#047857',
    lineHeight: 18,
  },
  clearSelectionButton: {
    padding: 4,
  },
  uploadButton: {
    marginBottom: 8,
  },
  uploadButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  uploadHint: {
    fontSize: 12,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 8,
  },
  uploadHintText: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    marginTop: 8,
  },
  noTextHintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  noTextHintContent: {
    flex: 1,
  },
  noTextHintTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
    marginBottom: 4,
  },
  noTextHintDesc: {
    fontSize: 12,
    color: '#1e40af',
    lineHeight: 18,
  },
  audioRequirementsBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  audioRequirementsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
  },
  audioRequirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e40af',
  },
  audioRequirementsList: {
    gap: 6,
  },
  audioRequirementItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  audioRequirementDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#3b82f6',
    marginTop: 7,
  },
  audioRequirementText: {
    flex: 1,
    fontSize: 12,
    color: '#1e40af',
    lineHeight: 18,
  },
  providerSelector: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  providerButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  providerButtonActive: {
    backgroundColor: '#faf5ff',
    borderColor: '#a855f7',
  },
  providerIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  providerIconXunfei: {
    backgroundColor: '#f3e8ff',
  },
  providerIconXunfeiActive: {
    backgroundColor: '#7c3aed',
  },
  providerIconVolcengine: {
    backgroundColor: '#ffedd5',
  },
  providerIconVolcengineActive: {
    backgroundColor: '#f97316',
  },
  providerInfo: {
    flex: 1,
  },
  providerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  providerNameActive: {
    color: '#7c3aed',
  },
  providerDesc: {
    fontSize: 12,
    color: '#64748b',
  },
  configPromptCard: {
    marginTop: 40,
  },
  configPromptContent: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  configPromptTitle: {
    marginTop: 16,
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    textAlign: 'center',
  },
  configPromptDesc: {
    marginTop: 8,
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  configPromptButton: {
    marginTop: 24,
    minWidth: 200,
  },
});

export default VoiceCloneScreen;

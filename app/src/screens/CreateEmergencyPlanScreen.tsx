import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import axios from 'axios';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';

const CreateEmergencyPlanScreen: React.FC = () => {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    enabled: true,
    timeWindow: 300,
    missedCallThreshold: 3,
    alarmVolume: 80,
    alarmDuration: 30,
    notifyWebhook: false,
    webhookUrl: '',
  });
  const [audioFile, setAudioFile] = useState<any>(null);

  const handleCreate = async () => {
    if (!formData.name.trim()) {
      Alert.alert('错误', '请输入方案名称');
      return;
    }

    if (formData.timeWindow < 60) {
      Alert.alert('错误', '时间窗口不能少于60秒');
      return;
    }

    if (formData.missedCallThreshold < 1) {
      Alert.alert('错误', '未接来电阈值不能少于1次');
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post('/api/emergency-calls/plans', formData);
      const planId = response.data.data.id;

      // 如果有音频文件，上传
      if (audioFile) {
        const formDataUpload = new FormData();
        formDataUpload.append('file', {
          uri: audioFile.uri,
          type: audioFile.mimeType || 'audio/mpeg',
          name: audioFile.name,
        } as any);

        await axios.post(`/api/emergency-calls/plans/${planId}/alarm-sound`, formDataUpload, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      Alert.alert('成功', '紧急呼叫方案创建成功', [
        { text: '确定', onPress: () => navigation.goBack() },
      ]);
    } catch (error: any) {
      Alert.alert('错误', error.response?.data?.msg || '创建失败');
    } finally {
      setLoading(false);
    }
  };

  const pickAudioFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setAudioFile(result.assets[0]);
      }
    } catch (error) {
      console.error('选择文件失败:', error);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.section}>
        <Text style={styles.label}>方案名称 *</Text>
        <TextInput
          style={styles.input}
          value={formData.name}
          onChangeText={(text) => setFormData({ ...formData, name: text })}
          placeholder="例如：家庭紧急呼叫"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>描述</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={formData.description}
          onChangeText={(text) => setFormData({ ...formData, description: text })}
          placeholder="方案描述（可选）"
          multiline
          numberOfLines={3}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.switchRow}>
          <Text style={styles.label}>启用方案</Text>
          <Switch
            value={formData.enabled}
            onValueChange={(value) => setFormData({ ...formData, enabled: value })}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>时间窗口（秒）*</Text>
        <TextInput
          style={styles.input}
          value={formData.timeWindow.toString()}
          onChangeText={(text) =>
            setFormData({ ...formData, timeWindow: parseInt(text) || 0 })
          }
          keyboardType="numeric"
          placeholder="300"
        />
        <Text style={styles.hint}>
          在此时间内检测未接来电次数（建议300-600秒）
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>未接来电阈值 *</Text>
        <TextInput
          style={styles.input}
          value={formData.missedCallThreshold.toString()}
          onChangeText={(text) =>
            setFormData({ ...formData, missedCallThreshold: parseInt(text) || 0 })
          }
          keyboardType="numeric"
          placeholder="3"
        />
        <Text style={styles.hint}>达到此次数时触发告警（建议2-3次）</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>闹铃音量（0-100）</Text>
        <TextInput
          style={styles.input}
          value={formData.alarmVolume.toString()}
          onChangeText={(text) =>
            setFormData({ ...formData, alarmVolume: parseInt(text) || 0 })
          }
          keyboardType="numeric"
          placeholder="80"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>闹铃时长（秒）</Text>
        <TextInput
          style={styles.input}
          value={formData.alarmDuration.toString()}
          onChangeText={(text) =>
            setFormData({ ...formData, alarmDuration: parseInt(text) || 0 })
          }
          keyboardType="numeric"
          placeholder="30"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>闹铃音频</Text>
        <TouchableOpacity style={styles.fileButton} onPress={pickAudioFile}>
          <Ionicons name="musical-notes" size={20} color="#007AFF" />
          <Text style={styles.fileButtonText}>
            {audioFile ? audioFile.name : '选择音频文件'}
          </Text>
        </TouchableOpacity>
        {audioFile && (
          <TouchableOpacity onPress={() => setAudioFile(null)}>
            <Text style={styles.removeFileText}>移除文件</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.hint}>支持 MP3、WAV、OGG、M4A 格式，最大10MB</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.switchRow}>
          <Text style={styles.label}>启用 Webhook 通知</Text>
          <Switch
            value={formData.notifyWebhook}
            onValueChange={(value) => setFormData({ ...formData, notifyWebhook: value })}
          />
        </View>
        {formData.notifyWebhook && (
          <TextInput
            style={[styles.input, { marginTop: 8 }]}
            value={formData.webhookUrl}
            onChangeText={(text) => setFormData({ ...formData, webhookUrl: text })}
            placeholder="https://example.com/webhook"
            keyboardType="url"
            autoCapitalize="none"
          />
        )}
      </View>

      <TouchableOpacity
        style={[styles.createButton, loading && styles.createButtonDisabled]}
        onPress={handleCreate}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.createButtonText}>创建方案</Text>
          </>
        )}
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  section: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  hint: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#007AFF',
    borderRadius: 8,
    padding: 12,
    gap: 8,
  },
  fileButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  removeFileText: {
    fontSize: 14,
    color: '#F44336',
    marginTop: 8,
    textAlign: 'center',
  },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    marginHorizontal: 16,
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  createButtonDisabled: {
    backgroundColor: '#ccc',
  },
  createButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
});

export default CreateEmergencyPlanScreen;

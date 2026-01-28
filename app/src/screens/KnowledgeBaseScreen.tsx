/**
 * 知识库页面
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { MainLayout, Card, Button, Badge } from '../components';
import {
  getKnowledgeBaseByUser,
  createKnowledgeBase,
  deleteKnowledgeBase,
  uploadKnowledgeBase,
  askKnowledgeBase,
  KnowledgeBase,
} from '../services/api/knowledge';
import { getGroupList, Group } from '../services/api/group';

const KnowledgeBaseScreen: React.FC = () => {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [filteredKnowledgeBases, setFilteredKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  
  // 模态框状态
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAskModal, setShowAskModal] = useState(false);
  const [currentItem, setCurrentItem] = useState<KnowledgeBase | null>(null);
  
  // 表单数据
  const [knowledgeName, setKnowledgeName] = useState('');
  const [selectedFile, setSelectedFile] = useState<any>(null);
  const [shareToGroup, setShareToGroup] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  
  // 上传文件
  const [uploadFile, setUploadFile] = useState<any>(null);
  
  // 提问
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState('');
  const [isAsking, setIsAsking] = useState(false);
  
  const [isCreating, setIsCreating] = useState(false);

  // 加载知识库列表
  useEffect(() => {
    fetchKnowledgeBases();
  }, []);

  // 搜索过滤
  useEffect(() => {
    if (!searchTerm) {
      setFilteredKnowledgeBases(knowledgeBases);
    } else {
      const filtered = knowledgeBases.filter(kb =>
        kb.knowledge_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        kb.knowledge_key.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredKnowledgeBases(filtered);
    }
  }, [searchTerm, knowledgeBases]);

  const fetchKnowledgeBases = async () => {
    try {
      setIsLoading(true);
      const response = await getKnowledgeBaseByUser();
      if (response.code === 200) {
        setKnowledgeBases(response.data || []);
        setFilteredKnowledgeBases(response.data || []);
      } else {
        Alert.alert('错误', response.msg || '获取知识库列表失败');
      }
    } catch (error: any) {
      Alert.alert('错误', error.message || '获取知识库列表失败');
    } finally {
      setIsLoading(false);
    }
  };

  // 加载组织列表
  const fetchGroups = async () => {
    try {
      const response = await getGroupList();
      if (response.code === 200) {
        setGroups(response.data || []);
      }
    } catch (error) {
      console.error('获取组织列表失败', error);
    }
  };

  // 打开创建模态框
  const handleCreate = () => {
    setKnowledgeName('');
    setSelectedFile(null);
    setShareToGroup(false);
    setSelectedGroupId(null);
    fetchGroups();
    setShowCreateModal(true);
  };

  // 选择文件
  const handlePickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setSelectedFile({
          uri: file.uri,
          name: file.name,
          type: file.mimeType || 'application/octet-stream',
        });
      }
    } catch (error) {
      Alert.alert('错误', '选择文件失败');
    }
  };

  // 创建知识库
  const handleCreateSubmit = async () => {
    if (!knowledgeName.trim()) {
      Alert.alert('提示', '请输入知识库名称');
      return;
    }

    if (!selectedFile) {
      Alert.alert('提示', '请选择文件');
      return;
    }

    if (knowledgeName.length > 10) {
      Alert.alert('提示', '知识库名称不能超过10个字符');
      return;
    }

    try {
      setIsCreating(true);
      const response = await createKnowledgeBase({
        knowledgeName: knowledgeName.trim(),
        file: selectedFile,
        groupId: shareToGroup && selectedGroupId ? selectedGroupId : null,
      });

      if (response.code === 200) {
        Alert.alert('成功', '创建知识库成功');
        setShowCreateModal(false);
        fetchKnowledgeBases();
      } else {
        Alert.alert('错误', response.msg || '创建知识库失败');
      }
    } catch (error: any) {
      Alert.alert('错误', error.message || '创建知识库失败');
    } finally {
      setIsCreating(false);
    }
  };

  // 打开上传模态框
  const handleShowUpload = (item: KnowledgeBase) => {
    setCurrentItem(item);
    setUploadFile(null);
    setShowUploadModal(true);
  };

  // 选择上传文件
  const handlePickUploadFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain', 'text/markdown'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        setUploadFile({
          uri: file.uri,
          name: file.name,
          type: file.mimeType || 'application/octet-stream',
        });
      }
    } catch (error) {
      Alert.alert('错误', '选择文件失败');
    }
  };

  // 上传文件
  const handleUploadSubmit = async () => {
    if (!uploadFile || !currentItem) return;

    try {
      const response = await uploadKnowledgeBase({
        file: uploadFile,
        knowledgeKey: currentItem.knowledge_key,
      });

      if (response.code === 200) {
        Alert.alert('成功', '上传文件成功');
        setShowUploadModal(false);
      } else {
        Alert.alert('错误', response.msg || '上传文件失败');
      }
    } catch (error: any) {
      Alert.alert('错误', error.message || '上传文件失败');
    }
  };

  // 打开提问模态框
  const handleShowAsk = (item: KnowledgeBase) => {
    setCurrentItem(item);
    setQuestion('');
    setAnswer('');
    setShowAskModal(true);
  };

  // 提问
  const handleAskSubmit = async () => {
    if (!question.trim() || !currentItem) return;

    try {
      setIsAsking(true);
      const response = await askKnowledgeBase({
        knowledgeKey: currentItem.knowledge_key,
        message: question.trim(),
      });

      if (response.code === 200) {
        setAnswer(response.data);
      } else {
        Alert.alert('错误', response.msg || '提问失败');
      }
    } catch (error: any) {
      Alert.alert('错误', error.message || '提问失败');
    } finally {
      setIsAsking(false);
    }
  };

  // 删除知识库
  const handleDelete = (item: KnowledgeBase) => {
    Alert.alert(
      '确认删除',
      `确定要删除知识库"${item.knowledge_name}"吗？此操作不可恢复。`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              const response = await deleteKnowledgeBase(item.knowledge_key);
              if (response.code === 200) {
                Alert.alert('成功', '删除知识库成功');
                fetchKnowledgeBases();
              } else {
                Alert.alert('错误', response.msg || '删除知识库失败');
              }
            } catch (error: any) {
              Alert.alert('错误', error.message || '删除知识库失败');
            }
          },
        },
      ]
    );
  };

  return (
    <MainLayout
      navBarProps={{
        title: '知识库',
        rightIcon: 'plus',
        onRightPress: handleCreate,
      }}
      backgroundColor="#f8fafc"
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 搜索框 */}
        <View style={styles.searchContainer}>
          <Feather name="search" size={18} color="#64748b" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="搜索知识库..."
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholderTextColor="#94a3b8"
          />
        </View>

        {/* 知识库列表 */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#a855f7" />
            <Text style={styles.loadingText}>加载中...</Text>
          </View>
        ) : filteredKnowledgeBases.length === 0 ? (
          <Card variant="default" padding="lg" style={styles.emptyCard}>
            <View style={styles.emptyState}>
              <Feather name="book-open" size={48} color="#94a3b8" />
              <Text style={styles.emptyText}>
                {searchTerm ? '没有找到匹配的知识库' : '还没有知识库'}
              </Text>
              {!searchTerm && (
                <Button variant="primary" onPress={handleCreate} style={styles.emptyButton}>
                  <Feather name="plus" size={16} color="#ffffff" />
                  <Text style={styles.emptyButtonText}>创建知识库</Text>
                </Button>
              )}
            </View>
          </Card>
        ) : (
          <View style={styles.list}>
            {filteredKnowledgeBases.map((kb) => (
              <Card key={kb.id} variant="elevated" padding="md" style={styles.card}>
                <View style={styles.cardHeader}>
                  <View style={styles.cardTitleContainer}>
                    <View style={styles.iconContainer}>
                      <Feather name="book-open" size={20} color="#a855f7" />
                    </View>
                    <View style={styles.cardTitleContent}>
                      <View style={styles.titleRow}>
                        <Text style={styles.cardTitle} numberOfLines={1}>
                          {kb.knowledge_name}
                        </Text>
                        {kb.group_id && (
                          <Badge variant="secondary" style={styles.badge}>
                            <Feather name="users" size={10} color="#64748b" />
                            <Text style={styles.badgeText}>组织</Text>
                          </Badge>
                        )}
                      </View>
                      <Text style={styles.cardKey} numberOfLines={1}>
                        {kb.knowledge_key}
                      </Text>
                    </View>
                  </View>
                </View>

                <View style={styles.cardActions}>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleShowUpload(kb)}
                  >
                    <Feather name="upload" size={16} color="#64748b" />
                    <Text style={styles.actionButtonText}>上传</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleShowAsk(kb)}
                  >
                    <Feather name="message-square" size={16} color="#64748b" />
                    <Text style={styles.actionButtonText}>提问</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => handleDelete(kb)}
                  >
                    <Feather name="trash-2" size={16} color="#ef4444" />
                    <Text style={[styles.actionButtonText, { color: '#ef4444' }]}>删除</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.cardFooter}>
                  <Text style={styles.cardDate}>
                    {new Date(kb.created_at).toLocaleDateString()}
                  </Text>
                </View>
              </Card>
            ))}
          </View>
        )}

        <View style={styles.footer} />
      </ScrollView>

      {/* 创建知识库模态框 */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>创建知识库</Text>
              <TouchableOpacity onPress={() => setShowCreateModal(false)}>
                <Feather name="x" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>知识库名称</Text>
                <TextInput
                  style={styles.input}
                  placeholder="请输入知识库名称（最多10个字符）"
                  value={knowledgeName}
                  onChangeText={setKnowledgeName}
                  maxLength={10}
                  placeholderTextColor="#94a3b8"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>选择文件</Text>
                <TouchableOpacity style={styles.fileButton} onPress={handlePickFile}>
                  <Feather name="file" size={20} color="#a855f7" />
                  <Text style={styles.fileButtonText}>
                    {selectedFile ? selectedFile.name : '选择文件'}
                  </Text>
                </TouchableOpacity>
                {selectedFile && (
                  <View style={styles.fileInfo}>
                    <Feather name="file-text" size={16} color="#3b82f6" />
                    <Text style={styles.fileName}>{selectedFile.name}</Text>
                  </View>
                )}
              </View>

              {groups.length > 0 && (
                <View style={styles.formGroup}>
                  <TouchableOpacity
                    style={styles.checkboxContainer}
                    onPress={() => setShareToGroup(!shareToGroup)}
                  >
                    <View style={[styles.checkbox, shareToGroup && styles.checkboxChecked]}>
                      {shareToGroup && <Feather name="check" size={14} color="#ffffff" />}
                    </View>
                    <Text style={styles.checkboxLabel}>共享到组织</Text>
                  </TouchableOpacity>

                  {shareToGroup && (
                    <View style={styles.selectContainer}>
                      <Text style={styles.selectLabel}>选择组织</Text>
                      <ScrollView style={styles.groupList}>
                        {groups.map((group) => (
                          <TouchableOpacity
                            key={group.id}
                            style={[
                              styles.groupItem,
                              selectedGroupId === group.id && styles.groupItemSelected,
                            ]}
                            onPress={() => setSelectedGroupId(group.id)}
                          >
                            <Text
                              style={[
                                styles.groupItemText,
                                selectedGroupId === group.id && styles.groupItemTextSelected,
                              ]}
                            >
                              {group.name}
                            </Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  )}
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button
                variant="outline"
                onPress={() => setShowCreateModal(false)}
                style={styles.modalButton}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </Button>
              <Button
                variant="primary"
                onPress={handleCreateSubmit}
                disabled={!knowledgeName.trim() || !selectedFile || isCreating}
                style={styles.modalButton}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitButtonText}>创建</Text>
                )}
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* 上传文件模态框 */}
      <Modal
        visible={showUploadModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowUploadModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                上传文件到 {currentItem?.knowledge_name}
              </Text>
              <TouchableOpacity onPress={() => setShowUploadModal(false)}>
                <Feather name="x" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>选择文件</Text>
                <TouchableOpacity style={styles.fileButton} onPress={handlePickUploadFile}>
                  <Feather name="file" size={20} color="#a855f7" />
                  <Text style={styles.fileButtonText}>
                    {uploadFile ? uploadFile.name : '选择文件'}
                  </Text>
                </TouchableOpacity>
                {uploadFile && (
                  <View style={styles.fileInfo}>
                    <Feather name="file-text" size={16} color="#3b82f6" />
                    <Text style={styles.fileName}>{uploadFile.name}</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.modalFooter}>
              <Button
                variant="outline"
                onPress={() => setShowUploadModal(false)}
                style={styles.modalButton}
              >
                <Text style={styles.cancelButtonText}>取消</Text>
              </Button>
              <Button
                variant="primary"
                onPress={handleUploadSubmit}
                disabled={!uploadFile}
                style={styles.modalButton}
              >
                <Text style={styles.submitButtonText}>上传</Text>
              </Button>
            </View>
          </View>
        </View>
      </Modal>

      {/* 提问模态框 */}
      <Modal
        visible={showAskModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowAskModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                向 {currentItem?.knowledge_name} 提问
              </Text>
              <TouchableOpacity onPress={() => setShowAskModal(false)}>
                <Feather name="x" size={24} color="#64748b" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalBody}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>问题</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="请输入您的问题..."
                  value={question}
                  onChangeText={setQuestion}
                  multiline
                  numberOfLines={4}
                  placeholderTextColor="#94a3b8"
                />
              </View>

              {answer && (
                <View style={styles.formGroup}>
                  <Text style={styles.label}>回答</Text>
                  <View style={styles.answerContainer}>
                    <Text style={styles.answerText}>{answer}</Text>
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <Button
                variant="outline"
                onPress={() => setShowAskModal(false)}
                style={styles.modalButton}
              >
                <Text style={styles.cancelButtonText}>关闭</Text>
              </Button>
              <Button
                variant="primary"
                onPress={handleAskSubmit}
                disabled={!question.trim() || isAsking}
                style={styles.modalButton}
              >
                {isAsking ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitButtonText}>提问</Text>
                )}
              </Button>
            </View>
          </View>
        </View>
      </Modal>
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 44,
    fontSize: 14,
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
    fontSize: 14,
    color: '#64748b',
    marginBottom: 20,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  emptyButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  list: {
    gap: 12,
  },
  card: {
    marginBottom: 0,
  },
  cardHeader: {
    marginBottom: 12,
  },
  cardTitleContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#f3e8ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitleContent: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
    color: '#64748b',
  },
  cardKey: {
    fontSize: 12,
    color: '#64748b',
  },
  cardActions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
  },
  actionButtonText: {
    fontSize: 13,
    color: '#64748b',
    fontWeight: '500',
  },
  cardFooter: {
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  cardDate: {
    fontSize: 12,
    color: '#94a3b8',
  },
  footer: {
    height: 20,
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
    maxHeight: '90%',
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
    maxHeight: 400,
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
  fileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  fileButtonText: {
    fontSize: 14,
    color: '#64748b',
  },
  fileInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    padding: 12,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
  },
  fileName: {
    fontSize: 13,
    color: '#3b82f6',
    flex: 1,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#a855f7',
    borderColor: '#a855f7',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#1e293b',
  },
  selectContainer: {
    marginTop: 12,
  },
  selectLabel: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 8,
  },
  groupList: {
    maxHeight: 150,
  },
  groupItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    marginBottom: 8,
  },
  groupItemSelected: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  groupItemText: {
    fontSize: 14,
    color: '#64748b',
  },
  groupItemTextSelected: {
    color: '#3b82f6',
    fontWeight: '500',
  },
  answerContainer: {
    padding: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
  },
  answerText: {
    fontSize: 14,
    color: '#1e293b',
    lineHeight: 20,
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
});

export default KnowledgeBaseScreen;

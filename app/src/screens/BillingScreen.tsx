/**
 * 账单页面
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { ActivityIndicator } from 'react-native';
import { MainLayout, Card, Tabs, TabsList, TabsTrigger, TabsContent, StatCard, Badge, Button } from '../components';
import {
  getUsageStatistics,
  getDailyUsageData,
  getUsageRecords,
  getBills,
  UsageStatistics,
  UsageRecord,
  Bill,
} from '../services/api/billing';
import { fetchUserCredentials, Credential } from '../services/api/credential';
import { getGroupList, Group } from '../services/api/group';

const BillingScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'statistics' | 'records' | 'bills'>('statistics');
  const [isLoading, setIsLoading] = useState(false);
  const [statistics, setStatistics] = useState<UsageStatistics | null>(null);
  const [usageRecords, setUsageRecords] = useState<UsageRecord[]>([]);
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [recordsPage, setRecordsPage] = useState(1);
  const [bills, setBills] = useState<Bill[]>([]);
  const [billsTotal, setBillsTotal] = useState(0);
  const [billsPage, setBillsPage] = useState(1);
  
  // 凭证和组织列表
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  
  // 筛选条件
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'custom'>('30d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [billingScope, setBillingScope] = useState<'personal' | 'organization'>('personal');
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [credentialFilter, setCredentialFilter] = useState<string>('all');
  const [usageTypeFilter, setUsageTypeFilter] = useState<string>('all');
  const [billStatusFilter, setBillStatusFilter] = useState<string>('all');
  
  // 选择器显示状态
  const [showScopeSelector, setShowScopeSelector] = useState(false);
  const [showGroupSelector, setShowGroupSelector] = useState(false);
  const [showDateRangeSelector, setShowDateRangeSelector] = useState(false);
  const [showCredentialSelector, setShowCredentialSelector] = useState(false);

  // 初始化日期范围
  React.useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  }, []);

  // 加载凭证列表
  React.useEffect(() => {
    const loadCredentials = async () => {
      try {
        const response = await fetchUserCredentials();
        if (response.code === 200) {
          setCredentials(response.data || []);
        }
      } catch (error) {
        console.error('Failed to load credentials', error);
      }
    };
    loadCredentials();
  }, []);

  // 加载组织列表
  React.useEffect(() => {
    const loadGroups = async () => {
      try {
        const response = await getGroupList();
        if (response.code === 200) {
          setGroups(response.data || []);
        }
      } catch (error) {
        console.error('Failed to load groups', error);
      }
    };
    loadGroups();
  }, []);

  // 更新日期范围
  React.useEffect(() => {
    const end = new Date();
    const start = new Date();
    
    switch (dateRange) {
      case '7d':
        start.setDate(start.getDate() - 7);
        break;
      case '30d':
        start.setDate(start.getDate() - 30);
        break;
      case '90d':
        start.setDate(start.getDate() - 90);
        break;
      case 'custom':
        return; // 不自动更新
    }
    
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  }, [dateRange]);

  // 加载统计数据
  const loadStatistics = async () => {
    setIsLoading(true);
    try {
      const params: any = {
        startTime: startDate,
        endTime: endDate,
      };
      if (credentialFilter !== 'all') {
        params.credentialId = parseInt(credentialFilter);
      }
      if (billingScope === 'organization' && selectedGroupId) {
        params.groupId = selectedGroupId;
      }
      
      const response = await getUsageStatistics(params);
      if (response.code === 200 && response.data) {
        setStatistics(response.data);
      } else {
        console.error('Failed to load statistics:', response.msg);
      }
    } catch (error: any) {
      console.error('Failed to load statistics:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 加载使用量记录
  const loadUsageRecords = async () => {
    setIsLoading(true);
    try {
      const params: any = {
        page: recordsPage,
        size: 20,
        startTime: startDate,
        endTime: endDate,
        orderBy: 'usageTime DESC',
      };
      if (credentialFilter !== 'all') {
        params.credentialId = parseInt(credentialFilter);
      }
      if (usageTypeFilter !== 'all') {
        params.usageType = usageTypeFilter;
      }
      if (billingScope === 'organization' && selectedGroupId) {
        params.groupId = selectedGroupId;
      }
      
      const response = await getUsageRecords(params);
      if (response.code === 200 && response.data) {
        setUsageRecords(response.data.list || []);
        setRecordsTotal(response.data.total || 0);
      } else {
        console.error('Failed to load usage records:', response.msg);
      }
    } catch (error: any) {
      console.error('Failed to load usage records:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 加载账单列表
  const loadBills = async () => {
    setIsLoading(true);
    try {
      const params: any = {
        page: billsPage,
        size: 20,
        orderBy: 'createdAt DESC',
      };
      if (credentialFilter !== 'all') {
        params.credentialId = parseInt(credentialFilter);
      }
      if (billStatusFilter !== 'all') {
        params.status = billStatusFilter;
      }
      if (billingScope === 'organization' && selectedGroupId) {
        params.groupId = selectedGroupId;
      }
      
      const response = await getBills(params);
      if (response.code === 200 && response.data) {
        setBills(response.data.list || []);
        setBillsTotal(response.data.total || 0);
      } else {
        console.error('Failed to load bills:', response.msg);
      }
    } catch (error: any) {
      console.error('Failed to load bills:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 根据当前tab加载数据
  React.useEffect(() => {
    if (activeTab === 'statistics') {
      loadStatistics();
    } else if (activeTab === 'records') {
      loadUsageRecords();
    } else if (activeTab === 'bills') {
      loadBills();
    }
  }, [activeTab, dateRange, startDate, endDate, credentialFilter, usageTypeFilter, billStatusFilter, recordsPage, billsPage, billingScope, selectedGroupId]);

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(2) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
    return num.toString();
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}秒`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`;
    return `${Math.floor(seconds / 3600)}小时${Math.floor((seconds % 3600) / 60)}分钟`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)}KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)}MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)}GB`;
  };

  const getUsageTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      llm: 'LLM',
      call: '通话',
      asr: '语音识别',
      tts: '语音合成',
      storage: '存储',
      api: 'API',
    };
    return labels[type] || type;
  };

  const getBillStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: '草稿',
      generated: '已生成',
      exported: '已导出',
      archived: '已归档',
    };
    return labels[status] || status;
  };

  const getBillStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      draft: '#64748b',
      generated: '#3b82f6',
      exported: '#10b981',
      archived: '#94a3b8',
    };
    return colors[status] || '#64748b';
  };

  return (
    <MainLayout
      navBarProps={{
        title: '账单',
      }}
      backgroundColor="#f8fafc"
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 筛选器 */}
        <Card variant="default" padding="md" style={styles.filterCard}>
          <View style={styles.filterRow}>
            {/* 账单范围 */}
            <View style={styles.filterItem}>
              <Text style={styles.filterLabel}>账单范围</Text>
              <TouchableOpacity
                style={styles.filterButton}
                onPress={() => setShowScopeSelector(true)}
              >
                <Feather name="user" size={14} color="#64748b" />
                <Text style={styles.filterButtonText}>
                  {billingScope === 'personal' ? '个人账单' : '组织账单'}
                </Text>
                <Feather name="chevron-down" size={14} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* 组织选择（仅组织账单时显示） */}
            {billingScope === 'organization' && (
              <View style={styles.filterItem}>
                <Text style={styles.filterLabel}>选择组织</Text>
                <TouchableOpacity
                  style={styles.filterButton}
                  onPress={() => setShowGroupSelector(true)}
                >
                  <Feather name="users" size={14} color="#64748b" />
                  <Text style={styles.filterButtonText}>
                    {selectedGroupId
                      ? groups.find(g => g.id === selectedGroupId)?.name || '请选择'
                      : '请选择'}
                  </Text>
                  <Feather name="chevron-down" size={14} color="#64748b" />
                </TouchableOpacity>
              </View>
            )}

            {/* 时间范围 */}
            <View style={styles.filterItem}>
              <Text style={styles.filterLabel}>时间范围</Text>
              <TouchableOpacity
                style={styles.filterButton}
                onPress={() => setShowDateRangeSelector(true)}
              >
                <Feather name="calendar" size={14} color="#64748b" />
                <Text style={styles.filterButtonText}>
                  {dateRange === '7d' && '最近7天'}
                  {dateRange === '30d' && '最近30天'}
                  {dateRange === '90d' && '最近90天'}
                  {dateRange === 'custom' && '自定义'}
                </Text>
                <Feather name="chevron-down" size={14} color="#64748b" />
              </TouchableOpacity>
            </View>

            {/* 凭证筛选（仅个人账单时显示） */}
            {billingScope === 'personal' && (
              <View style={styles.filterItem}>
                <Text style={styles.filterLabel}>凭证</Text>
                <TouchableOpacity
                  style={styles.filterButton}
                  onPress={() => setShowCredentialSelector(true)}
                >
                  <Feather name="key" size={14} color="#64748b" />
                  <Text style={styles.filterButtonText}>
                    {credentialFilter === 'all'
                      ? '全部'
                      : credentials.find(c => c.id.toString() === credentialFilter)?.name || '全部'}
                  </Text>
                  <Feather name="chevron-down" size={14} color="#64748b" />
                </TouchableOpacity>
              </View>
            )}
          </View>
        </Card>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
          <TabsList style={styles.tabsList}>
            <TabsTrigger value="statistics">
              <Feather name="bar-chart-2" size={14} color={activeTab === 'statistics' ? '#1e293b' : '#64748b'} />
              <Text style={[styles.tabText, activeTab === 'statistics' && styles.tabTextActive]}>
                统计
              </Text>
            </TabsTrigger>
            <TabsTrigger value="records">
              <Feather name="list" size={14} color={activeTab === 'records' ? '#1e293b' : '#64748b'} />
              <Text style={[styles.tabText, activeTab === 'records' && styles.tabTextActive]}>
                记录
              </Text>
            </TabsTrigger>
            <TabsTrigger value="bills">
              <Feather name="file-text" size={14} color={activeTab === 'bills' ? '#1e293b' : '#64748b'} />
              <Text style={[styles.tabText, activeTab === 'bills' && styles.tabTextActive]}>
                账单
              </Text>
            </TabsTrigger>
          </TabsList>

          {/* 统计概览 */}
          <TabsContent value="statistics">
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#64748b" />
                <Text style={styles.loadingText}>加载中...</Text>
              </View>
            ) : statistics ? (
              <View style={styles.statsContainer}>
                {/* 三个主要统计卡片 */}
                <Card variant="elevated" padding="lg" style={styles.statCard}>
                  <View style={styles.statHeader}>
                    <View style={[styles.statIconContainer, { backgroundColor: '#dbeafe' }]}>
                      <Feather name="cpu" size={20} color="#3b82f6" />
                    </View>
                    <Text style={styles.statTitle}>LLM统计</Text>
                  </View>
                  <View style={styles.statContent}>
                    <View style={styles.statRow}>
                      <Text style={styles.statLabel}>调用次数</Text>
                      <Text style={styles.statValue}>{formatNumber(statistics.llmCalls)}</Text>
                    </View>
                    <View style={styles.statRow}>
                      <Text style={styles.statLabel}>总Token数</Text>
                      <Text style={styles.statValue}>{formatNumber(statistics.llmTokens)}</Text>
                    </View>
                    <View style={styles.statRow}>
                      <Text style={styles.statLabel}>Prompt Tokens</Text>
                      <Text style={styles.statValue}>{formatNumber(statistics.promptTokens)}</Text>
                    </View>
                    <View style={styles.statRow}>
                      <Text style={styles.statLabel}>Completion Tokens</Text>
                      <Text style={styles.statValue}>{formatNumber(statistics.completionTokens)}</Text>
                    </View>
                  </View>
                </Card>

                <Card variant="elevated" padding="lg" style={styles.statCard}>
                  <View style={styles.statHeader}>
                    <View style={[styles.statIconContainer, { backgroundColor: '#e9d5ff' }]}>
                      <Feather name="mic" size={20} color="#a855f7" />
                    </View>
                    <Text style={styles.statTitle}>语音识别</Text>
                  </View>
                  <View style={styles.statContent}>
                    <View style={styles.statRow}>
                      <Text style={styles.statLabel}>调用次数</Text>
                      <Text style={styles.statValue}>{formatNumber(statistics.asrCount)}</Text>
                    </View>
                    <View style={styles.statRow}>
                      <Text style={styles.statLabel}>总时长</Text>
                      <Text style={styles.statValue}>{formatDuration(statistics.asrDuration)}</Text>
                    </View>
                  </View>
                </Card>

                <Card variant="elevated" padding="lg" style={styles.statCard}>
                  <View style={styles.statHeader}>
                    <View style={[styles.statIconContainer, { backgroundColor: '#fed7aa' }]}>
                      <Feather name="volume-2" size={20} color="#f97316" />
                    </View>
                    <Text style={styles.statTitle}>语音合成</Text>
                  </View>
                  <View style={styles.statContent}>
                    <View style={styles.statRow}>
                      <Text style={styles.statLabel}>调用次数</Text>
                      <Text style={styles.statValue}>{formatNumber(statistics.ttsCount)}</Text>
                    </View>
                    <View style={styles.statRow}>
                      <Text style={styles.statLabel}>总时长</Text>
                      <Text style={styles.statValue}>{formatDuration(statistics.ttsDuration)}</Text>
                    </View>
                  </View>
                </Card>

                {/* API调用统计 */}
                <Card variant="elevated" padding="lg" style={styles.statCard}>
                  <View style={styles.statHeader}>
                    <View style={[styles.statIconContainer, { backgroundColor: '#cffafe' }]}>
                      <Feather name="globe" size={20} color="#06b6d4" />
                    </View>
                    <Text style={styles.statTitle}>API调用</Text>
                  </View>
                  <View style={styles.statContent}>
                    <View style={styles.statRow}>
                      <Text style={styles.statLabel}>API调用次数</Text>
                      <Text style={styles.statValue}>{formatNumber(statistics.apiCalls)}</Text>
                    </View>
                  </View>
                </Card>
              </View>
            ) : (
              <Card variant="default" padding="lg" style={styles.emptyCard}>
                <View style={styles.emptyState}>
                  <Feather name="bar-chart-2" size={48} color="#94a3b8" />
                  <Text style={styles.emptyText}>暂无统计数据</Text>
                </View>
              </Card>
            )}
          </TabsContent>

          {/* 使用记录 */}
          <TabsContent value="records">
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#64748b" />
                <Text style={styles.loadingText}>加载中...</Text>
              </View>
            ) : (
              <Card variant="default" padding="none" style={styles.recordsCard}>
                {usageRecords.length === 0 ? (
                  <View style={styles.emptyState}>
                    <Feather name="inbox" size={48} color="#94a3b8" />
                    <Text style={styles.emptyText}>暂无使用记录</Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.recordsList}>
                      {usageRecords.map((record) => (
                        <View key={record.id} style={styles.recordItem}>
                          <View style={styles.recordHeader}>
                            <Badge variant="secondary">
                              <Text style={styles.badgeText}>{getUsageTypeLabel(record.usageType)}</Text>
                            </Badge>
                            <Text style={styles.recordTime}>
                              {new Date(record.usageTime).toLocaleString('zh-CN')}
                            </Text>
                          </View>
                          <View style={styles.recordInfo}>
                            {record.model && (
                              <Text style={styles.recordText}>模型: {record.model}</Text>
                            )}
                            {record.totalTokens > 0 && (
                              <Text style={styles.recordText}>Token: {formatNumber(record.totalTokens)}</Text>
                            )}
                            {(record.callDuration > 0 || record.audioDuration > 0) && (
                              <Text style={styles.recordText}>
                                时长: {formatDuration(record.callDuration || record.audioDuration)}
                              </Text>
                            )}
                            {record.audioSize > 0 && (
                              <Text style={styles.recordText}>
                                大小: {formatFileSize(record.audioSize)}
                              </Text>
                            )}
                          </View>
                        </View>
                      ))}
                    </View>
                    {/* 分页 */}
                    {recordsTotal > 20 && (
                      <View style={styles.pagination}>
                        <Button
                          variant="outline"
                          size="sm"
                          onPress={() => setRecordsPage(Math.max(1, recordsPage - 1))}
                          disabled={recordsPage === 1}
                        >
                          <Feather name="chevron-left" size={14} color="#1e293b" />
                          <Text style={styles.paginationText}>上一页</Text>
                        </Button>
                        <Text style={styles.paginationInfo}>
                          第 {recordsPage} 页，共 {Math.ceil(recordsTotal / 20)} 页
                        </Text>
                        <Button
                          variant="outline"
                          size="sm"
                          onPress={() => setRecordsPage(recordsPage + 1)}
                          disabled={recordsPage >= Math.ceil(recordsTotal / 20)}
                        >
                          <Text style={styles.paginationText}>下一页</Text>
                          <Feather name="chevron-right" size={14} color="#1e293b" />
                        </Button>
                      </View>
                    )}
                  </>
                )}
              </Card>
            )}
          </TabsContent>

          {/* 账单管理 */}
          <TabsContent value="bills">
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#64748b" />
                <Text style={styles.loadingText}>加载中...</Text>
              </View>
            ) : (
              <View style={styles.billsGrid}>
                {bills.length === 0 ? (
                  <Card variant="default" padding="lg" style={styles.emptyCard}>
                    <View style={styles.emptyState}>
                      <Feather name="file-text" size={48} color="#94a3b8" />
                      <Text style={styles.emptyText}>暂无账单</Text>
                    </View>
                  </Card>
                ) : (
                  <>
                    {bills.map((bill) => (
                  <Card key={bill.id} variant="default" padding="md" style={styles.billCard}>
                    <View style={styles.billHeader}>
                      <View style={styles.billTitleContainer}>
                        <Text style={styles.billTitle}>{bill.title}</Text>
                        <Text style={styles.billNo}>{bill.billNo}</Text>
                      </View>
                      <Badge
                        variant="secondary"
                        style={[styles.billBadge, { backgroundColor: getBillStatusColor(bill.status) + '20' }]}
                      >
                        <Text style={[styles.billBadgeText, { color: getBillStatusColor(bill.status) }]}>
                          {getBillStatusLabel(bill.status)}
                        </Text>
                      </Badge>
                    </View>
                    <View style={styles.billInfo}>
                      <View style={styles.billInfoRow}>
                        <Text style={styles.billInfoLabel}>时间范围</Text>
                        <Text style={styles.billInfoValue}>
                          {new Date(bill.startTime).toLocaleDateString()} - {new Date(bill.endTime).toLocaleDateString()}
                        </Text>
                      </View>
                      <View style={styles.billInfoRow}>
                        <Text style={styles.billInfoLabel}>LLM调用</Text>
                        <Text style={styles.billInfoValue}>{formatNumber(bill.totalLLMCalls)}</Text>
                      </View>
                      <View style={styles.billInfoRow}>
                        <Text style={styles.billInfoLabel}>总Token数</Text>
                        <Text style={styles.billInfoValue}>{formatNumber(bill.totalLLMTokens)}</Text>
                      </View>
                      <View style={styles.billInfoRow}>
                        <Text style={styles.billInfoLabel}>通话时长</Text>
                        <Text style={styles.billInfoValue}>{formatDuration(bill.totalCallDuration)}</Text>
                      </View>
                    </View>
                    <View style={styles.billActions}>
                      <Button variant="outline" size="sm" style={styles.billButton}>
                        <Feather name="eye" size={14} color="#1e293b" />
                        <Text style={styles.billButtonText}>查看</Text>
                      </Button>
                      <Button variant="outline" size="sm" style={styles.billButton}>
                        <Feather name="download" size={14} color="#1e293b" />
                        <Text style={styles.billButtonText}>导出</Text>
                      </Button>
                    </View>
                  </Card>
                    ))}
                    {/* 分页 */}
                    {billsTotal > 20 && (
                      <View style={styles.pagination}>
                        <Button
                          variant="outline"
                          size="sm"
                          onPress={() => setBillsPage(Math.max(1, billsPage - 1))}
                          disabled={billsPage === 1}
                        >
                          <Feather name="chevron-left" size={14} color="#1e293b" />
                          <Text style={styles.paginationText}>上一页</Text>
                        </Button>
                        <Text style={styles.paginationInfo}>
                          第 {billsPage} 页，共 {Math.ceil(billsTotal / 20)} 页
                        </Text>
                        <Button
                          variant="outline"
                          size="sm"
                          onPress={() => setBillsPage(billsPage + 1)}
                          disabled={billsPage >= Math.ceil(billsTotal / 20)}
                        >
                          <Text style={styles.paginationText}>下一页</Text>
                          <Feather name="chevron-right" size={14} color="#1e293b" />
                        </Button>
                      </View>
                    )}
                  </>
                )}
              </View>
            )}
          </TabsContent>
        </Tabs>

        <View style={styles.footer} />
      </ScrollView>

      {/* 账单范围选择器 */}
      <Modal
        visible={showScopeSelector}
        transparent
        animationType="fade"
        onRequestClose={() => setShowScopeSelector(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowScopeSelector(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>选择账单范围</Text>
            <TouchableOpacity
              style={[styles.modalOption, billingScope === 'personal' && styles.modalOptionActive]}
              onPress={() => {
                setBillingScope('personal');
                setSelectedGroupId(null);
                setShowScopeSelector(false);
              }}
            >
              <Feather name="user" size={18} color={billingScope === 'personal' ? '#3b82f6' : '#64748b'} />
              <Text style={[styles.modalOptionText, billingScope === 'personal' && styles.modalOptionTextActive]}>
                个人账单
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalOption, billingScope === 'organization' && styles.modalOptionActive]}
              onPress={() => {
                setBillingScope('organization');
                if (groups.length > 0 && !selectedGroupId) {
                  setSelectedGroupId(groups[0].id);
                }
                setShowScopeSelector(false);
              }}
            >
              <Feather name="users" size={18} color={billingScope === 'organization' ? '#3b82f6' : '#64748b'} />
              <Text style={[styles.modalOptionText, billingScope === 'organization' && styles.modalOptionTextActive]}>
                组织账单
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 组织选择器 */}
      <Modal
        visible={showGroupSelector}
        transparent
        animationType="fade"
        onRequestClose={() => setShowGroupSelector(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowGroupSelector(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>选择组织</Text>
            <ScrollView style={styles.modalScroll}>
              {groups.map((group) => (
                <TouchableOpacity
                  key={group.id}
                  style={[styles.modalOption, selectedGroupId === group.id && styles.modalOptionActive]}
                  onPress={() => {
                    setSelectedGroupId(group.id);
                    setShowGroupSelector(false);
                  }}
                >
                  <Text style={[styles.modalOptionText, selectedGroupId === group.id && styles.modalOptionTextActive]}>
                    {group.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 时间范围选择器 */}
      <Modal
        visible={showDateRangeSelector}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDateRangeSelector(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowDateRangeSelector(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>选择时间范围</Text>
            <TouchableOpacity
              style={[styles.modalOption, dateRange === '7d' && styles.modalOptionActive]}
              onPress={() => {
                setDateRange('7d');
                setShowDateRangeSelector(false);
              }}
            >
              <Text style={[styles.modalOptionText, dateRange === '7d' && styles.modalOptionTextActive]}>
                最近7天
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalOption, dateRange === '30d' && styles.modalOptionActive]}
              onPress={() => {
                setDateRange('30d');
                setShowDateRangeSelector(false);
              }}
            >
              <Text style={[styles.modalOptionText, dateRange === '30d' && styles.modalOptionTextActive]}>
                最近30天
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalOption, dateRange === '90d' && styles.modalOptionActive]}
              onPress={() => {
                setDateRange('90d');
                setShowDateRangeSelector(false);
              }}
            >
              <Text style={[styles.modalOptionText, dateRange === '90d' && styles.modalOptionTextActive]}>
                最近90天
              </Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 凭证选择器 */}
      <Modal
        visible={showCredentialSelector}
        transparent
        animationType="fade"
        onRequestClose={() => setShowCredentialSelector(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowCredentialSelector(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>选择凭证</Text>
            <ScrollView style={styles.modalScroll}>
              <TouchableOpacity
                style={[styles.modalOption, credentialFilter === 'all' && styles.modalOptionActive]}
                onPress={() => {
                  setCredentialFilter('all');
                  setShowCredentialSelector(false);
                }}
              >
                <Text style={[styles.modalOptionText, credentialFilter === 'all' && styles.modalOptionTextActive]}>
                  全部
                </Text>
              </TouchableOpacity>
              {credentials.map((cred) => (
                <TouchableOpacity
                  key={cred.id}
                  style={[styles.modalOption, credentialFilter === cred.id.toString() && styles.modalOptionActive]}
                  onPress={() => {
                    setCredentialFilter(cred.id.toString());
                    setShowCredentialSelector(false);
                  }}
                >
                  <Text style={[styles.modalOptionText, credentialFilter === cred.id.toString() && styles.modalOptionTextActive]}>
                    {cred.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
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
  tabsList: {
    marginBottom: 16,
  },
  tabText: {
    fontSize: 14,
    color: '#64748b',
    marginLeft: 6,
  },
  tabTextActive: {
    color: '#1e293b',
    fontWeight: '600',
  },
  statsContainer: {
    gap: 16,
  },
  statCard: {
    marginBottom: 0,
  },
  statHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  statContent: {
    gap: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  statLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
  },
  recordsCard: {
    marginTop: 0,
  },
  recordsList: {
    gap: 12,
    padding: 16,
  },
  recordItem: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  recordHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeText: {
    fontSize: 12,
    color: '#1e293b',
  },
  recordTime: {
    fontSize: 12,
    color: '#64748b',
  },
  recordInfo: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  recordText: {
    fontSize: 12,
    color: '#64748b',
  },
  billsGrid: {
    gap: 12,
  },
  billCard: {
    marginBottom: 0,
  },
  billHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  billTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  billTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  billNo: {
    fontSize: 12,
    color: '#64748b',
  },
  billBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  billBadgeText: {
    fontSize: 11,
    fontWeight: '500',
  },
  billInfo: {
    gap: 8,
    marginBottom: 12,
  },
  billInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  billInfoLabel: {
    fontSize: 13,
    color: '#64748b',
  },
  billInfoValue: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1e293b',
  },
  billActions: {
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  billButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  billButtonText: {
    fontSize: 13,
    color: '#1e293b',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#64748b',
  },
  emptyCard: {
    marginTop: 0,
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
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  paginationText: {
    fontSize: 13,
    color: '#1e293b',
    marginHorizontal: 4,
  },
  paginationInfo: {
    fontSize: 13,
    color: '#64748b',
  },
  footer: {
    height: 20,
  },
  filterCard: {
    marginBottom: 16,
  },
  filterRow: {
    gap: 12,
  },
  filterItem: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#1e293b',
    marginBottom: 6,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#f8fafc',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterButtonText: {
    flex: 1,
    fontSize: 14,
    color: '#1e293b',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    width: '80%',
    maxHeight: '70%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 16,
  },
  modalScroll: {
    maxHeight: 300,
  },
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#f8fafc',
  },
  modalOptionActive: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  modalOptionText: {
    fontSize: 15,
    color: '#64748b',
  },
  modalOptionTextActive: {
    color: '#3b82f6',
    fontWeight: '500',
  },
});

export default BillingScreen;


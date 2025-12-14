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
  
  // 日期范围
  const [dateRange, setDateRange] = useState<'7d' | '30d' | '90d' | 'custom'>('30d');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 初始化日期范围
  React.useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
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
      const response = await getUsageStatistics({
        startTime: startDate,
        endTime: endDate,
      });
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
      const response = await getUsageRecords({
        page: recordsPage,
        size: 20,
        startTime: startDate,
        endTime: endDate,
        orderBy: 'usageTime DESC',
      });
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
      const response = await getBills({
        page: billsPage,
        size: 20,
        orderBy: 'createdAt DESC',
      });
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
  }, [activeTab, dateRange, startDate, endDate, recordsPage, billsPage]);

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
                {/* 主要统计 - 大卡片 */}
                <View style={styles.mainStatsRow}>
                  <Card variant="elevated" padding="lg" style={styles.mainStatCard}>
                    <View style={styles.mainStatContent}>
                      <View style={[styles.mainStatIcon, { backgroundColor: '#ede9fe' }]}>
                        <Feather name="cpu" size={20} color="#a78bfa" />
                      </View>
                      <View style={styles.mainStatInfo}>
                        <Text style={styles.mainStatValue}>{formatNumber(statistics.llmCalls)}</Text>
                        <Text style={styles.mainStatLabel}>LLM调用</Text>
                      </View>
                    </View>
                  </Card>
                  <Card variant="elevated" padding="lg" style={styles.mainStatCard}>
                    <View style={styles.mainStatContent}>
                      <View style={[styles.mainStatIcon, { backgroundColor: '#dbeafe' }]}>
                        <Feather name="hash" size={20} color="#3b82f6" />
                      </View>
                      <View style={styles.mainStatInfo}>
                        <Text style={styles.mainStatValue}>{formatNumber(statistics.llmTokens)}</Text>
                        <Text style={styles.mainStatLabel}>总Token数</Text>
                      </View>
                    </View>
                  </Card>
                </View>

                {/* 次要统计 - 小卡片 */}
                <View style={styles.secondaryStatsGrid}>
                  <Card variant="elevated" padding="md" style={styles.secondaryStatCard}>
                    <View style={styles.secondaryStatContent}>
                      <View style={[styles.secondaryStatIcon, { backgroundColor: '#d1fae5' }]}>
                        <Feather name="phone" size={18} color="#10b981" />
                      </View>
                      <View style={styles.secondaryStatInfo}>
                        <Text style={styles.secondaryStatValue}>{formatNumber(statistics.callCount)}</Text>
                        <Text style={styles.secondaryStatLabel}>通话次数</Text>
                      </View>
                    </View>
                  </Card>
                  <Card variant="elevated" padding="md" style={styles.secondaryStatCard}>
                    <View style={styles.secondaryStatContent}>
                      <View style={[styles.secondaryStatIcon, { backgroundColor: '#d1fae5' }]}>
                        <Feather name="clock" size={18} color="#10b981" />
                      </View>
                      <View style={styles.secondaryStatInfo}>
                        <Text style={styles.secondaryStatValue}>{formatDuration(statistics.callDuration)}</Text>
                        <Text style={styles.secondaryStatLabel}>通话时长</Text>
                      </View>
                    </View>
                  </Card>
                  <Card variant="elevated" padding="md" style={styles.secondaryStatCard}>
                    <View style={styles.secondaryStatContent}>
                      <View style={[styles.secondaryStatIcon, { backgroundColor: '#fee2e2' }]}>
                        <Feather name="hard-drive" size={18} color="#ef4444" />
                      </View>
                      <View style={styles.secondaryStatInfo}>
                        <Text style={styles.secondaryStatValue}>{formatFileSize(statistics.storageSize)}</Text>
                        <Text style={styles.secondaryStatLabel}>存储大小</Text>
                      </View>
                    </View>
                  </Card>
                  <Card variant="elevated" padding="md" style={styles.secondaryStatCard}>
                    <View style={styles.secondaryStatContent}>
                      <View style={[styles.secondaryStatIcon, { backgroundColor: '#cffafe' }]}>
                        <Feather name="globe" size={18} color="#06b6d4" />
                      </View>
                      <View style={styles.secondaryStatInfo}>
                        <Text style={styles.secondaryStatValue}>{formatNumber(statistics.apiCalls)}</Text>
                        <Text style={styles.secondaryStatLabel}>API调用</Text>
                      </View>
                    </View>
                  </Card>
                </View>
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
                            {(record.audioSize > 0 || record.storageSize > 0) && (
                              <Text style={styles.recordText}>
                                大小: {formatFileSize(record.audioSize || record.storageSize)}
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
  mainStatsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  mainStatCard: {
    flex: 1,
  },
  mainStatContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  mainStatIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainStatInfo: {
    flex: 1,
  },
  mainStatValue: {
    fontSize: 11,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 4,
  },
  mainStatLabel: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '500',
  },
  secondaryStatsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  secondaryStatCard: {
    flex: 1,
    minWidth: '47%',
  },
  secondaryStatContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  secondaryStatIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryStatInfo: {
    flex: 1,
  },
  secondaryStatValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 2,
  },
  secondaryStatLabel: {
    fontSize: 12,
    color: '#64748b',
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
});

export default BillingScreen;


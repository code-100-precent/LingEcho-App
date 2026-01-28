import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Card from '@/components/UI/Card';
import Button from '@/components/UI/Button';
import Badge from '@/components/UI/Badge';
import { 
  Activity, 
  Clock, 
  Settings, 
  AlertTriangle, 
  CheckCircle, 
  XCircle,
  Calendar,
  TrendingUp,
  Wrench,
  Power,
  ArrowLeft,
  BarChart3,
  Zap,
  Shield,
  RefreshCw,
  Download,
  Plus,
  Edit,
  Trash2,
  Eye,
  Package
} from 'lucide-react';
import { showAlert } from '@/utils/notification';
import * as deviceLifecycleApi from '@/api/deviceLifecycle';

const DeviceLifecycle: React.FC = () => {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
  const [overview, setOverview] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [maintenance, setMaintenance] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (deviceId) {
      fetchLifecycleData();
    }
  }, [deviceId]);

  const fetchLifecycleData = async () => {
    try {
      setLoading(true);
      
      // 获取概览数据
      const overviewRes = await deviceLifecycleApi.getLifecycleOverview(deviceId!);
      if (overviewRes.code === 200) {
        setOverview(overviewRes.data);
      }

      // 获取历史数据
      try {
        const historyRes = await deviceLifecycleApi.getLifecycleHistory(deviceId!);
        if (historyRes.code === 200) {
          setHistory(historyRes.data);
        }
      } catch (error) {
        console.warn('Failed to fetch history:', error);
      }

      // 获取维护记录
      try {
        const maintenanceRes = await deviceLifecycleApi.getMaintenanceRecords(deviceId!);
        if (maintenanceRes.code === 200) {
          setMaintenance(maintenanceRes.data.records);
        }
      } catch (error) {
        console.warn('Failed to fetch maintenance:', error);
      }

      // 获取性能指标
      try {
        const metricsRes = await deviceLifecycleApi.getLifecycleMetrics(deviceId!, 30);
        if (metricsRes.code === 200) {
          setMetrics(metricsRes.data);
        }
      } catch (error) {
        console.warn('Failed to fetch metrics:', error);
      }
    } catch (error: any) {
      console.error('Failed to fetch lifecycle data:', error);
      showAlert(error.msg || '获取设备生命周期数据失败', 'error');
    } finally {
      setLoading(false);
    }
  };

  const refreshData = async () => {
    setRefreshing(true);
    await fetchLifecycleData();
    setRefreshing(false);
    showAlert('数据已刷新', 'success');
  };

  const getStatusColor = (status: string) => {
    const colors = {
      'manufacturing': 'bg-blue-500',
      'inventory': 'bg-purple-500',
      'activation_ready': 'bg-cyan-500',
      'activating': 'bg-blue-600',
      'configuring': 'bg-indigo-500',
      'active': 'bg-green-500',
      'maintenance': 'bg-yellow-500',
      'faulty': 'bg-red-500',
      'offline': 'bg-gray-500',
      'deactivated': 'bg-gray-400',
      'retired': 'bg-black'
    };
    return colors[status as keyof typeof colors] || 'bg-gray-500';
  };

  const getStatusIcon = (status: string) => {
    const icons = {
      'manufacturing': <Settings className="w-4 h-4" />,
      'inventory': <Package className="w-4 h-4" />,
      'activation_ready': <Zap className="w-4 h-4" />,
      'activating': <RefreshCw className="w-4 h-4" />,
      'configuring': <Settings className="w-4 h-4" />,
      'active': <CheckCircle className="w-4 h-4" />,
      'maintenance': <Wrench className="w-4 h-4" />,
      'faulty': <AlertTriangle className="w-4 h-4" />,
      'offline': <XCircle className="w-4 h-4" />,
      'deactivated': <Power className="w-4 h-4" />,
      'retired': <XCircle className="w-4 h-4" />
    };
    return icons[status as keyof typeof icons] || <Activity className="w-4 h-4" />;
  };

  const getPriorityColor = (priority: string) => {
    const colors = {
      'low': 'bg-green-100 text-green-800',
      'medium': 'bg-yellow-100 text-yellow-800',
      'high': 'bg-orange-100 text-orange-800',
      'critical': 'bg-red-100 text-red-800'
    };
    return colors[priority as keyof typeof colors] || 'bg-gray-100 text-gray-800';
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatUptime = (seconds: number) => {
    if (!seconds) return 'N/A';
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return `${days}天 ${hours}小时`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('zh-CN');
  };

  const formatDateShort = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('zh-CN');
  };

  const handleStatusTransition = async (toStatus: string, reason?: string) => {
    try {
      const response = await deviceLifecycleApi.transitionDeviceStatus(deviceId!, toStatus, reason);
      if (response.code === 200) {
        showAlert('设备状态更新成功', 'success');
        fetchLifecycleData(); // 刷新数据
      } else {
        showAlert(response.msg || '状态更新失败', 'error');
      }
    } catch (error: any) {
      console.error('Failed to transition status:', error);
      showAlert(error.msg || '网络错误，请稍后重试', 'error');
    }
  };

  const calculateAvailability = () => {
    if (!overview) return 0;
    const total = overview.totalUptime + overview.totalDowntime;
    return total > 0 ? (overview.totalUptime / total) * 100 : 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen dark:bg-neutral-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!overview) {
    return (
      <div className="min-h-screen dark:bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-500 mb-4">设备生命周期信息未找到</p>
          <Button onClick={() => navigate('/devices')}>返回设备列表</Button>
        </div>
      </div>
    );
  }

  const lifecycle = overview.lifecycle;

  return (
    <div className="min-h-screen dark:bg-neutral-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/devices')}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              返回设备列表
            </Button>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
                设备生命周期管理
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                设备ID: {deviceId} | MAC: {lifecycle.macAddress}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={refreshData}
              disabled={refreshing}
              leftIcon={<RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />}
            >
              刷新
            </Button>
            {/* 导出报告功能已移除 */}
          </div>
        </div>

        {/* 设备状态概览卡片 */}
        <Card className="mb-6">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                {getStatusIcon(lifecycle.status)}
                设备状态概览
              </h2>
              <Badge className={`${getStatusColor(lifecycle.status)} text-white px-3 py-1`}>
                {deviceLifecycleApi.getStatusLabel(lifecycle.status)}
              </Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600 mb-1">
                  {calculateAvailability().toFixed(2)}%
                </div>
                <p className="text-sm text-gray-600">可用性</p>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600 mb-1">
                  {formatUptime(overview.totalUptime)}
                </div>
                <p className="text-sm text-gray-600">总运行时间</p>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600 mb-1">
                  {overview.maintenanceCount}
                </div>
                <p className="text-sm text-gray-600">维护次数</p>
              </div>
              
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600 mb-1">
                  {overview.faultCount}
                </div>
                <p className="text-sm text-gray-600">故障次数</p>
              </div>

              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600 mb-1">
                  {formatDuration(overview.statusDuration * 3600)}
                </div>
                <p className="text-sm text-gray-600">当前状态持续</p>
              </div>
            </div>

            {/* 可用性进度条 */}
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">设备可用性</span>
                <span className="text-sm text-gray-600">
                  {calculateAvailability().toFixed(2)}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-green-500 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${calculateAvailability()}%` }}
                />
              </div>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-3 flex-wrap">
              {lifecycle.status === 'active' && (
                <>
                  <Button 
                    onClick={() => handleStatusTransition('maintenance', '手动进入维护模式')}
                    variant="outline"
                    leftIcon={<Wrench className="w-4 h-4" />}
                  >
                    进入维护模式
                  </Button>
                  <Button 
                    onClick={() => handleStatusTransition('deactivated', '用户主动停用')}
                    variant="destructive"
                    leftIcon={<Power className="w-4 h-4" />}
                  >
                    停用设备
                  </Button>
                </>
              )}
              
              {lifecycle.status === 'maintenance' && (
                <Button 
                  onClick={() => handleStatusTransition('active', '维护完成')}
                  variant="default"
                  leftIcon={<CheckCircle className="w-4 h-4" />}
                >
                  完成维护
                </Button>
              )}
              
              {lifecycle.status === 'deactivated' && (
                <Button 
                  onClick={() => handleStatusTransition('retired', '设备生命周期结束')}
                  variant="destructive"
                  leftIcon={<XCircle className="w-4 h-4" />}
                >
                  退役设备
                </Button>
              )}

              {/* 安排维护功能已移除 */}
            </div>
          </div>
        </Card>

        {/* 标签页导航 */}
        <div className="mb-6">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'overview', label: '详细信息', icon: Activity },
                { id: 'history', label: '状态历史', icon: Clock },
                { id: 'maintenance', label: '维护记录', icon: Wrench },
                { id: 'metrics', label: '性能指标', icon: BarChart3 }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* 标签页内容 */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 基本信息 */}
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Activity className="w-5 h-5" />
                  基本信息
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">设备ID:</span>
                    <span className="font-mono">{lifecycle.deviceId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">MAC地址:</span>
                    <span className="font-mono">{lifecycle.macAddress}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">当前状态:</span>
                    <Badge className={`${getStatusColor(lifecycle.status)} text-white`}>
                      {deviceLifecycleApi.getStatusLabel(lifecycle.status)}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">前一状态:</span>
                    <span>{deviceLifecycleApi.getStatusLabel(lifecycle.prevStatus)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">制造日期:</span>
                    <span>{formatDateShort(lifecycle.manufactureDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">激活日期:</span>
                    <span>{formatDateShort(lifecycle.activationDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">配置日期:</span>
                    <span>{formatDateShort(lifecycle.configurationDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">最后活跃:</span>
                    <span>{formatDate(lifecycle.lastActiveDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">创建时间:</span>
                    <span>{formatDate(lifecycle.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">更新时间:</span>
                    <span>{formatDate(lifecycle.updatedAt)}</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* 统计信息 */}
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  统计信息
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">总运行时长:</span>
                    <span className="text-green-600 font-semibold">{formatUptime(lifecycle.totalUptime)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">总停机时长:</span>
                    <span className="text-red-600 font-semibold">{formatUptime(lifecycle.totalDowntime)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">维护次数:</span>
                    <span className="text-blue-600 font-semibold">{lifecycle.maintenanceCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">故障次数:</span>
                    <span className="text-red-600 font-semibold">{lifecycle.faultCount}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">可用性:</span>
                    <span className="text-green-600 font-semibold">
                      {calculateAvailability().toFixed(2)}%
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">最后维护:</span>
                    <span>{formatDateShort(lifecycle.lastMaintenanceDate)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">下次维护:</span>
                    <span>{formatDateShort(lifecycle.nextMaintenanceDate)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">最后故障:</span>
                    <span>{formatDateShort(lifecycle.lastFaultDate)}</span>
                  </div>
                </div>
              </div>
            </Card>

            {/* 停用/退役信息 */}
            {(lifecycle.status === 'deactivated' || lifecycle.status === 'retired') && (
              <Card className="lg:col-span-2">
                <div className="p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    {lifecycle.status === 'deactivated' ? '停用信息' : '退役信息'}
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex justify-between">
                      <span className="text-gray-600">
                        {lifecycle.status === 'deactivated' ? '停用日期:' : '退役日期:'}
                      </span>
                      <span>{formatDate(lifecycle.status === 'deactivated' ? lifecycle.deactivationDate : lifecycle.retirementDate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">
                        {lifecycle.status === 'deactivated' ? '停用原因:' : '退役原因:'}
                      </span>
                      <span>{lifecycle.status === 'deactivated' ? lifecycle.deactivationReason : lifecycle.retirementReason}</span>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* 备注信息 */}
            {lifecycle.notes && (
              <Card className="lg:col-span-2">
                <div className="p-6">
                  <h3 className="text-lg font-semibold mb-4">备注信息</h3>
                  <p className="text-gray-700 dark:text-gray-300">{lifecycle.notes}</p>
                </div>
              </Card>
            )}
          </div>
        )}

        {activeTab === 'history' && (
          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  状态变更历史
                </h3>
                <span className="text-sm text-gray-500">共 {history.length} 条记录</span>
              </div>
              <div className="space-y-4">
                {history.map((item, index) => (
                  <div key={item.id} className="flex items-start gap-4 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <div className="flex-shrink-0 mt-1">
                      {getStatusIcon(item.toStatus)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">
                          {deviceLifecycleApi.getStatusLabel(item.fromStatus)}
                        </Badge>
                        <span className="text-gray-400">→</span>
                        <Badge className={`${getStatusColor(item.toStatus)} text-white text-xs`}>
                          {deviceLifecycleApi.getStatusLabel(item.toStatus)}
                        </Badge>
                        <span className="text-xs text-gray-500 ml-auto">
                          #{history.length - index}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{item.reason}</p>
                      <div className="flex items-center gap-4 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          持续时间: {formatDuration(item.duration)}
                        </span>
                        <span>触发方式: {item.triggerType === 'manual' ? '手动' : '自动'}</span>
                        <span>操作者: {item.triggerBy}</span>
                        <span>{formatDate(item.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                ))}
                {history.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    暂无状态变更历史
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {activeTab === 'maintenance' && (
          <Card>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Wrench className="w-5 h-5" />
                  维护记录
                </h3>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">共 {maintenance.length} 条记录</span>
                  {/* 新增维护功能已移除 */}
                </div>
              </div>
              <div className="space-y-4">
                {maintenance.map((item) => (
                  <div key={item.id} className="p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-lg">{item.title}</h4>
                      <div className="flex items-center gap-2">
                        <Badge 
                          className={getPriorityColor(item.priority)}
                        >
                          {deviceLifecycleApi.getMaintenancePriorityLabel(item.priority)}
                        </Badge>
                        <Badge 
                          variant={item.status === 'completed' ? 'default' : 'secondary'}
                        >
                          {item.status === 'completed' ? '已完成' : 
                           item.status === 'in_progress' ? '进行中' : 
                           item.status === 'scheduled' ? '已安排' : '待处理'}
                        </Badge>
                      </div>
                    </div>
                    
                    {item.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{item.description}</p>
                    )}
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-gray-500 mb-3">
                      <div>
                        <span className="font-medium">类型:</span> {deviceLifecycleApi.getMaintenanceTypeLabel(item.maintenanceType)}
                      </div>
                      <div>
                        <span className="font-medium">计划时间:</span> {formatDate(item.scheduledDate)}
                      </div>
                      <div>
                        <span className="font-medium">开始时间:</span> {formatDate(item.startDate)}
                      </div>
                      <div>
                        <span className="font-medium">完成时间:</span> {formatDate(item.endDate)}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-3 border-t">
                      <span className="text-xs text-gray-500">
                        创建时间: {formatDate(item.createdAt)}
                      </span>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="ghost" leftIcon={<Eye className="w-3 h-3" />}>
                          查看
                        </Button>
                        <Button size="sm" variant="ghost" leftIcon={<Edit className="w-3 h-3" />}>
                          编辑
                        </Button>
                        <Button size="sm" variant="ghost" leftIcon={<Trash2 className="w-3 h-3" />}>
                          删除
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {maintenance.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    暂无维护记录
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {activeTab === 'metrics' && (
          <div className="space-y-6">
            {/* 关键指标卡片 */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <div className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-600 mb-1">
                    {metrics.length > 0 ? metrics[metrics.length - 1].mtbf?.toFixed(1) : 'N/A'}
                  </div>
                  <p className="text-sm text-gray-600">MTBF (小时)</p>
                  <p className="text-xs text-gray-500 mt-1">平均故障间隔时间</p>
                </div>
              </Card>
              
              <Card>
                <div className="p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600 mb-1">
                    {metrics.length > 0 ? metrics[metrics.length - 1].mttr?.toFixed(1) : 'N/A'}
                  </div>
                  <p className="text-sm text-gray-600">MTTR (小时)</p>
                  <p className="text-xs text-gray-500 mt-1">平均修复时间</p>
                </div>
              </Card>
              
              <Card>
                <div className="p-4 text-center">
                  <div className="text-2xl font-bold text-yellow-600 mb-1">
                    {metrics.length > 0 ? (metrics[metrics.length - 1].errorRate * 100).toFixed(2) : 'N/A'}%
                  </div>
                  <p className="text-sm text-gray-600">错误率</p>
                  <p className="text-xs text-gray-500 mt-1">系统错误发生率</p>
                </div>
              </Card>
              
              <Card>
                <div className="p-4 text-center">
                  <div className="text-2xl font-bold text-green-600 mb-1">
                    {metrics.length > 0 ? (metrics[metrics.length - 1].successRate * 100).toFixed(2) : 'N/A'}%
                  </div>
                  <p className="text-sm text-gray-600">成功率</p>
                  <p className="text-xs text-gray-500 mt-1">操作成功率</p>
                </div>
              </Card>
            </div>

            {/* 性能指标详情 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    系统性能
                  </h3>
                  <div className="space-y-4">
                    {metrics.length > 0 && (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">平均CPU使用率:</span>
                          <span className="font-semibold">{metrics[metrics.length - 1].avgCpuUsage?.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">平均内存使用率:</span>
                          <span className="font-semibold">{metrics[metrics.length - 1].avgMemoryUsage?.toFixed(1)}%</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">平均温度:</span>
                          <span className="font-semibold">{metrics[metrics.length - 1].avgTemperature?.toFixed(1)}°C</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">平均网络延迟:</span>
                          <span className="font-semibold">{metrics[metrics.length - 1].avgNetworkLatency?.toFixed(0)}ms</span>
                        </div>
                      </>
                    )}
                    {metrics.length === 0 && (
                      <div className="text-center py-4 text-gray-500">
                        暂无性能数据
                      </div>
                    )}
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-6">
                  <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5" />
                    使用统计
                  </h3>
                  <div className="space-y-4">
                    {metrics.length > 0 && (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">活跃时长:</span>
                          <span className="font-semibold">{metrics[metrics.length - 1].activeHours?.toFixed(1)}小时</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">空闲时长:</span>
                          <span className="font-semibold">{metrics[metrics.length - 1].idleHours?.toFixed(1)}小时</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">交互次数:</span>
                          <span className="font-semibold">{metrics[metrics.length - 1].interactionCount}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-gray-600">用户满意度:</span>
                          <span className="font-semibold">{(metrics[metrics.length - 1].userSatisfactionScore * 100).toFixed(1)}%</span>
                        </div>
                      </>
                    )}
                    {metrics.length === 0 && (
                      <div className="text-center py-4 text-gray-500">
                        暂无使用统计
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            </div>

            {/* 维护成本统计 */}
            <Card>
              <div className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  维护成本统计
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600 mb-1">
                      {metrics.length > 0 ? metrics[metrics.length - 1].maintenanceHours?.toFixed(1) : 'N/A'}
                    </div>
                    <p className="text-sm text-gray-600">维护时长 (小时)</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600 mb-1">
                      ¥{metrics.length > 0 ? metrics[metrics.length - 1].maintenanceCost?.toFixed(0) : 'N/A'}
                    </div>
                    <p className="text-sm text-gray-600">维护成本</p>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600 mb-1">
                      {metrics.length > 0 ? (metrics[metrics.length - 1].uptimePercentage)?.toFixed(2) : 'N/A'}%
                    </div>
                    <p className="text-sm text-gray-600">可用性</p>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeviceLifecycle;
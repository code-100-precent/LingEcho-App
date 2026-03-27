import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface EmergencyCallPlan {
  id: number;
  name: string;
  description?: string;
  enabled: boolean;
  timeWindow: number;
  missedCallThreshold: number;
  alarmSoundUrl?: string;
  alarmVolume: number;
  alarmDuration: number;
  notifyEmail: boolean;
  notifySms: boolean;
  notifyWebhook: boolean;
  webhookUrl?: string;
  createdAt: string;
}

interface EmergencyCallAlarm {
  id: number;
  planId: number;
  callerPhone?: string;
  callerIp?: string;
  callerUri?: string;
  triggeredAt: string;
  missedCallCount: number;
  timeWindowSeconds: number;
  status: 'active' | 'acknowledged' | 'resolved';
  acknowledgedAt?: string;
  resolvedAt?: string;
}

const EmergencyCallManager: React.FC = () => {
  const [plans, setPlans] = useState<EmergencyCallPlan[]>([]);
  const [alarms, setAlarms] = useState<EmergencyCallAlarm[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
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

  useEffect(() => {
    fetchPlans();
    fetchAlarms();
  }, []);

  const fetchPlans = async () => {
    try {
      const response = await axios.get('/api/emergency-calls/plans');
      setPlans(response.data.data || []);
    } catch (error) {
      console.error('获取方案列表失败:', error);
    }
  };

  const fetchAlarms = async () => {
    try {
      const response = await axios.get('/api/emergency-calls/alarms?status=active');
      setAlarms(response.data.data || []);
    } catch (error) {
      console.error('获取告警列表失败:', error);
    }
  };

  const createPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post('/api/emergency-calls/plans', formData);
      setShowCreateForm(false);
      setFormData({
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
      fetchPlans();
    } catch (error) {
      console.error('创建方案失败:', error);
      alert('创建方案失败');
    } finally {
      setLoading(false);
    }
  };

  const uploadAlarmSound = async (planId: number, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      await axios.post(`/api/emergency-calls/plans/${planId}/alarm-sound`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      fetchPlans();
      alert('闹铃音频上传成功');
    } catch (error) {
      console.error('上传失败:', error);
      alert('上传失败');
    }
  };

  const togglePlan = async (planId: number, enabled: boolean) => {
    try {
      await axios.put(`/api/emergency-calls/plans/${planId}`, { enabled: !enabled });
      fetchPlans();
    } catch (error) {
      console.error('更新方案失败:', error);
    }
  };

  const deletePlan = async (planId: number) => {
    if (!confirm('确定要删除此方案吗？')) return;
    
    try {
      await axios.delete(`/api/emergency-calls/plans/${planId}`);
      fetchPlans();
    } catch (error) {
      console.error('删除方案失败:', error);
    }
  };

  const acknowledgeAlarm = async (alarmId: number) => {
    try {
      await axios.post(`/api/emergency-calls/alarms/${alarmId}/acknowledge`);
      fetchAlarms();
    } catch (error) {
      console.error('确认告警失败:', error);
    }
  };

  const resolveAlarm = async (alarmId: number) => {
    try {
      await axios.post(`/api/emergency-calls/alarms/${alarmId}/resolve`);
      fetchAlarms();
    } catch (error) {
      console.error('解决告警失败:', error);
    }
  };

  return (
    <div className="emergency-call-manager p-6">
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">紧急呼叫管理</h1>
          <button
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            {showCreateForm ? '取消' : '创建方案'}
          </button>
        </div>

        {showCreateForm && (
          <form onSubmit={createPlan} className="bg-white p-6 rounded-lg shadow mb-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block mb-2 font-medium">方案名称 *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block mb-2 font-medium">描述</label>
                <input
                  type="text"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block mb-2 font-medium">时间窗口（秒）*</label>
                <input
                  type="number"
                  required
                  min="60"
                  value={formData.timeWindow}
                  onChange={(e) => setFormData({ ...formData, timeWindow: parseInt(e.target.value) })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block mb-2 font-medium">未接来电阈值 *</label>
                <input
                  type="number"
                  required
                  min="1"
                  value={formData.missedCallThreshold}
                  onChange={(e) => setFormData({ ...formData, missedCallThreshold: parseInt(e.target.value) })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block mb-2 font-medium">闹铃音量（0-100）</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={formData.alarmVolume}
                  onChange={(e) => setFormData({ ...formData, alarmVolume: parseInt(e.target.value) })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div>
                <label className="block mb-2 font-medium">闹铃时长（秒）</label>
                <input
                  type="number"
                  min="1"
                  value={formData.alarmDuration}
                  onChange={(e) => setFormData({ ...formData, alarmDuration: parseInt(e.target.value) })}
                  className="w-full border rounded px-3 py-2"
                />
              </div>
              <div className="col-span-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={formData.notifyWebhook}
                    onChange={(e) => setFormData({ ...formData, notifyWebhook: e.target.checked })}
                    className="mr-2"
                  />
                  启用Webhook通知
                </label>
                {formData.notifyWebhook && (
                  <input
                    type="url"
                    placeholder="Webhook URL"
                    value={formData.webhookUrl}
                    onChange={(e) => setFormData({ ...formData, webhookUrl: e.target.value })}
                    className="w-full border rounded px-3 py-2 mt-2"
                  />
                )}
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="mt-4 bg-green-500 text-white px-6 py-2 rounded hover:bg-green-600 disabled:bg-gray-400"
            >
              {loading ? '创建中...' : '创建方案'}
            </button>
          </form>
        )}

        <div className="grid gap-4">
          <h2 className="text-xl font-semibold">方案列表</h2>
          {plans.length === 0 ? (
            <p className="text-gray-500">暂无方案</p>
          ) : (
            plans.map((plan) => (
              <div key={plan.id} className="bg-white p-4 rounded-lg shadow">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg">{plan.name}</h3>
                    {plan.description && <p className="text-gray-600 text-sm">{plan.description}</p>}
                    <div className="mt-2 text-sm text-gray-700">
                      <p>时间窗口: {plan.timeWindow}秒 ({Math.floor(plan.timeWindow / 60)}分钟)</p>
                      <p>未接阈值: {plan.missedCallThreshold}次</p>
                      <p>闹铃音量: {plan.alarmVolume}%</p>
                      <p>闹铃时长: {plan.alarmDuration}秒</p>
                      {plan.alarmSoundUrl && (
                        <p className="text-green-600">✓ 已上传闹铃音频</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => togglePlan(plan.id, plan.enabled)}
                      className={`px-3 py-1 rounded ${
                        plan.enabled ? 'bg-green-500 text-white' : 'bg-gray-300 text-gray-700'
                      }`}
                    >
                      {plan.enabled ? '已启用' : '已禁用'}
                    </button>
                    <label className="bg-blue-500 text-white px-3 py-1 rounded cursor-pointer hover:bg-blue-600">
                      上传音频
                      <input
                        type="file"
                        accept=".mp3,.wav,.ogg,.m4a"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) uploadAlarmSound(plan.id, file);
                        }}
                      />
                    </label>
                    <button
                      onClick={() => deletePlan(plan.id)}
                      className="bg-red-500 text-white px-3 py-1 rounded hover:bg-red-600"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div>
        <h2 className="text-xl font-semibold mb-4">活动告警</h2>
        {alarms.length === 0 ? (
          <p className="text-gray-500">暂无活动告警</p>
        ) : (
          <div className="grid gap-4">
            {alarms.map((alarm) => (
              <div key={alarm.id} className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-red-700">紧急告警 #{alarm.id}</h3>
                    <p className="text-sm mt-1">
                      来电: {alarm.callerPhone || alarm.callerIp || alarm.callerUri}
                    </p>
                    <p className="text-sm">
                      未接次数: {alarm.missedCallCount} 次（{alarm.timeWindowSeconds}秒内）
                    </p>
                    <p className="text-sm text-gray-600">
                      触发时间: {new Date(alarm.triggeredAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => acknowledgeAlarm(alarm.id)}
                      className="bg-yellow-500 text-white px-3 py-1 rounded hover:bg-yellow-600"
                    >
                      确认
                    </button>
                    <button
                      onClick={() => resolveAlarm(alarm.id)}
                      className="bg-green-500 text-white px-3 py-1 rounded hover:bg-green-600"
                    >
                      解决
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default EmergencyCallManager;

import React, { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import Badge from '@/components/UI/Badge';
import CallAudioPlayer from '@/components/CallAudioPlayer';

interface CallRecordingDetailProps {
  recording: any;
  recordingDetail: any;
}

const CallRecordingDetail: React.FC<CallRecordingDetailProps> = ({ recording, recordingDetail }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'metrics' | 'conversation' | 'charts'>('overview');

  // 格式化时长
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 格式化文件大小
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // 准备延迟趋势图数据
  const prepareDelayTrendData = () => {
    if (!recordingDetail?.conversationDetailsData?.turns) return [];
    
    return (recordingDetail.conversationDetailsData.turns || [])
      .filter((turn: any) => turn.type === 'ai' && turn.responseDelay)
      .map((turn: any, index: number) => ({
        turn: index + 1,
        responseDelay: turn.responseDelay,
        totalDelay: turn.totalDelay || 0,
        llmDelay: turn.llmDuration || 0,
        ttsDelay: turn.ttsDuration || 0,
      }));
  };

  // 准备性能分布图数据
  const preparePerformanceDistribution = () => {
    if (!recordingDetail?.timingMetricsData) return [];
    
    const metrics = recordingDetail.timingMetricsData;
    return [
      { name: 'ASR平均', value: metrics.asrAverageTime, color: '#3B82F6' },
      { name: 'LLM平均', value: metrics.llmAverageTime, color: '#10B981' },
      { name: 'TTS平均', value: metrics.ttsAverageTime, color: '#8B5CF6' },
    ];
  };

  // 准备对话流程数据
  const prepareConversationFlow = () => {
    if (!recordingDetail?.conversationDetailsData?.turns) return [];
    
    return (recordingDetail.conversationDetailsData.turns || []).map((turn: any, index: number) => ({
      turn: index + 1,
      type: turn.type,
      duration: turn.duration,
      timestamp: new Date(turn.timestamp).toLocaleTimeString(),
      content: turn.content.substring(0, 30) + (turn.content.length > 30 ? '...' : ''),
    }));
  };

  const delayTrendData = prepareDelayTrendData();
  const performanceData = preparePerformanceDistribution();
  const conversationFlowData = prepareConversationFlow();

  const COLORS = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B'];

  return (
    <div className="space-y-4">
      {/* 标签页导航 */}
      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
        {[
          { key: 'overview', label: '概览' },
          { key: 'metrics', label: '性能指标' },
          { key: 'conversation', label: '对话详情' },
          { key: 'charts', label: '图表分析' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab.key
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 标签页内容 */}
      <div className="min-h-[400px]">
        {activeTab === 'overview' && (
          <div className="space-y-4">
            {/* 基本信息 */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-gray-600 dark:text-gray-400">会话ID:</span>
                <p className="font-mono text-xs">{recording.sessionId}</p>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">通话时长:</span>
                <p>{formatDuration(recording.duration)}</p>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">音频质量:</span>
                <p>{(recording.audioQuality * 100).toFixed(1)}%</p>
              </div>
              <div>
                <span className="text-gray-600 dark:text-gray-400">文件大小:</span>
                <p>{formatFileSize(recording.audioSize)}</p>
              </div>
            </div>

            {/* 录音播放 */}
            <div>
              <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">录音播放:</h4>
              <CallAudioPlayer
                callId={recording.sessionId}
                audioUrl={recording.storageUrl || `/api/recordings/${recording.audioPath}`}
                hasAudio={true}
                durationSeconds={recording.duration}
              />
            </div>

            {/* 快速统计 */}
            {recordingDetail?.conversationDetailsData && (
              <div className="grid grid-cols-4 gap-4">
                <div className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="text-lg font-semibold">{recordingDetail.conversationDetailsData.totalTurns}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">总轮次</div>
                </div>
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-lg font-semibold text-blue-600">{recordingDetail.conversationDetailsData.userTurns}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">用户发言</div>
                </div>
                <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-lg font-semibold text-green-600">{recordingDetail.conversationDetailsData.aiTurns}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">AI回复</div>
                </div>
                <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="text-lg font-semibold text-red-600">{recordingDetail.conversationDetailsData.interruptions}</div>
                  <div className="text-xs text-gray-600 dark:text-gray-400">中断次数</div>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'metrics' && recordingDetail?.timingMetricsData && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div className="text-blue-600 dark:text-blue-400 font-medium mb-2">ASR 语音识别</div>
                <div className="space-y-1 text-sm">
                  <div>调用次数: {recordingDetail.timingMetricsData.asrCalls}</div>
                  <div>平均延迟: {recordingDetail.timingMetricsData.asrAverageTime}ms</div>
                  <div>最小/最大: {recordingDetail.timingMetricsData.asrMinTime}ms / {recordingDetail.timingMetricsData.asrMaxTime}ms</div>
                </div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <div className="text-green-600 dark:text-green-400 font-medium mb-2">LLM 语言模型</div>
                <div className="space-y-1 text-sm">
                  <div>调用次数: {recordingDetail.timingMetricsData.llmCalls}</div>
                  <div>平均延迟: {recordingDetail.timingMetricsData.llmAverageTime}ms</div>
                  <div>最小/最大: {recordingDetail.timingMetricsData.llmMinTime}ms / {recordingDetail.timingMetricsData.llmMaxTime}ms</div>
                </div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
                <div className="text-purple-600 dark:text-purple-400 font-medium mb-2">TTS 语音合成</div>
                <div className="space-y-1 text-sm">
                  <div>调用次数: {recordingDetail.timingMetricsData.ttsCalls}</div>
                  <div>平均延迟: {recordingDetail.timingMetricsData.ttsAverageTime}ms</div>
                  <div>最小/最大: {recordingDetail.timingMetricsData.ttsMinTime}ms / {recordingDetail.timingMetricsData.ttsMaxTime}ms</div>
                </div>
              </div>
            </div>
            
            {/* 响应延迟指标 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
                <div className="text-orange-600 dark:text-orange-400 font-medium mb-2">响应延迟</div>
                <div className="space-y-1 text-sm">
                  <div>平均延迟: {recordingDetail.timingMetricsData.averageResponseDelay}ms</div>
                  <div>最小/最大: {recordingDetail.timingMetricsData.minResponseDelay}ms / {recordingDetail.timingMetricsData.maxResponseDelay}ms</div>
                </div>
              </div>
              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg">
                <div className="text-red-600 dark:text-red-400 font-medium mb-2">总延迟</div>
                <div className="space-y-1 text-sm">
                  <div>平均延迟: {recordingDetail.timingMetricsData.averageTotalDelay}ms</div>
                  <div>最小/最大: {recordingDetail.timingMetricsData.minTotalDelay}ms / {recordingDetail.timingMetricsData.maxTotalDelay}ms</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'conversation' && recordingDetail?.conversationDetailsData && (
          <div className="space-y-4">
            {/* 对话轮次列表 */}
            <div className="max-h-80 overflow-y-auto space-y-2">
              {(recordingDetail.conversationDetailsData?.turns || []).map((turn: any, index: number) => (
                <div key={index} className={`p-3 rounded-lg ${turn.type === 'user' ? 'bg-blue-50 dark:bg-blue-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant={turn.type === 'user' ? 'primary' : 'success'} size="sm">
                        {turn.type === 'user' ? '用户' : 'AI'}
                      </Badge>
                      <span className="text-xs text-gray-500">
                        {new Date(turn.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500">
                      {turn.duration}ms
                      {turn.responseDelay && <span className="ml-2">响应: {turn.responseDelay}ms</span>}
                    </div>
                  </div>
                  <div className="text-sm">{turn.content}</div>
                  {(turn.asrDuration || turn.llmDuration || turn.ttsDuration) && (
                    <div className="mt-2 flex gap-4 text-xs text-gray-500">
                      {turn.asrDuration && <span>ASR: {turn.asrDuration}ms</span>}
                      {turn.llmDuration && <span>LLM: {turn.llmDuration}ms</span>}
                      {turn.ttsDuration && <span>TTS: {turn.ttsDuration}ms</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'charts' && (
          <div className="space-y-6">
            {/* 延迟趋势图 */}
            {delayTrendData.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">延迟趋势图</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={delayTrendData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="turn" />
                      <YAxis />
                      <Tooltip />
                      <Line type="monotone" dataKey="responseDelay" stroke="#3B82F6" name="响应延迟" />
                      <Line type="monotone" dataKey="totalDelay" stroke="#EF4444" name="总延迟" />
                      <Line type="monotone" dataKey="llmDelay" stroke="#10B981" name="LLM延迟" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* 性能分布图 */}
            {performanceData.length > 0 && (
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">性能分布 - 柱状图</h4>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={performanceData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="value" fill="#3B82F6" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">性能分布 - 饼图</h4>
                  <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={performanceData}
                          cx="50%"
                          cy="50%"
                          outerRadius={60}
                          fill="#8884d8"
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}ms`}
                        >
                          {performanceData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            )}

            {/* 对话流程可视化 */}
            {conversationFlowData.length > 0 && (
              <div>
                <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-3">对话流程可视化</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={conversationFlowData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="turn" />
                      <YAxis />
                      <Tooltip 
                        content={({ active, payload, label }) => {
                          if (active && payload && payload.length) {
                            const data = payload[0].payload;
                            return (
                              <div className="bg-white dark:bg-gray-800 p-3 border rounded shadow">
                                <p className="font-medium">轮次 {label}</p>
                                <p className="text-sm">类型: {data.type === 'user' ? '用户' : 'AI'}</p>
                                <p className="text-sm">时长: {data.duration}ms</p>
                                <p className="text-sm">时间: {data.timestamp}</p>
                                <p className="text-sm">内容: {data.content}</p>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar 
                        dataKey="duration" 
                        fill="#3B82F6"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CallRecordingDetail;
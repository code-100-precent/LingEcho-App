import React, { useState, useEffect } from 'react';
import { Phone, X, Clock } from 'lucide-react';
import { getAvailableSchemesForCall, selectSchemeForCall, cancelCallSelection, getCallSelectionStatus } from '@/api/callSelection';
import { useToast } from '@/components/UI/ToastContainer';

interface IncomingCallModalProps {
  callId: string;
  callerNumber: string;
  calledNumber: string;
  onClose: () => void;
  onSchemeSelected: (schemeId: number) => void;
}

interface Scheme {
  id: number;
  schemeName: string;
  description?: string;
  boundPhoneNumber: string;
  isActive: boolean;
}

const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  callId,
  callerNumber,
  calledNumber,
  onClose,
  onSchemeSelected
}) => {
  const toast = useToast();
  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [selectedSchemeId, setSelectedSchemeId] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(8);
  const [loading, setLoading] = useState(false);
  const [isTimeout, setIsTimeout] = useState(false);

  // 加载可用方案
  useEffect(() => {
    const loadSchemes = async () => {
      try {
        const response = await getAvailableSchemesForCall(callId);
        if (response.code === 0) {
          setSchemes(response.data || []);
          // 默认选中当前激活的方案
          const activeScheme = response.data?.find((s: Scheme) => s.isActive);
          if (activeScheme) {
            setSelectedSchemeId(activeScheme.id);
          }
        }
      } catch (error: any) {
        toast.error('加载失败', error.msg || '加载方案列表失败');
      }
    };
    loadSchemes();
  }, [callId, toast]);

  // 倒计时和状态轮询
  useEffect(() => {
    const timer = setInterval(async () => {
      try {
        const response = await getCallSelectionStatus(callId);
        if (response.code === 0) {
          const { remainingSeconds: remaining, isTimeout: timeout, status } = response.data;
          
          setRemainingSeconds(remaining);
          setIsTimeout(timeout);

          // 如果已超时或已选择，关闭弹窗
          if (timeout || status !== 'pending') {
            clearInterval(timer);
            if (timeout) {
              toast.warning('选择超时', '将使用默认方案');
            }
            onClose();
          }
        }
      } catch (error) {
        console.error('获取状态失败:', error);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [callId, onClose, toast]);

  // 选择方案
  const handleSelectScheme = async () => {
    if (!selectedSchemeId) {
      toast.warning('请选择方案', '请选择一个方案');
      return;
    }

    setLoading(true);
    try {
      const response = await selectSchemeForCall(callId, selectedSchemeId);
      if (response.code === 0) {
        toast.success('成功', '方案已选择并激活');
        onSchemeSelected(selectedSchemeId);
        onClose();
      } else {
        toast.error('失败', response.msg || '选择方案失败');
      }
    } catch (error: any) {
      toast.error('失败', error.msg || '选择方案失败');
    } finally {
      setLoading(false);
    }
  };

  // 取消选择
  const handleCancel = async () => {
    try {
      await cancelCallSelection(callId);
      toast.info('已取消', '已取消来电');
      onClose();
    } catch (error: any) {
      toast.error('失败', error.msg || '取消失败');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 animate-fade-in">
        {/* 头部 */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-6 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="bg-white bg-opacity-20 p-3 rounded-full animate-pulse">
                <Phone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">来电提醒</h3>
                <p className="text-sm text-blue-100">请选择代接方案</p>
              </div>
            </div>
            <button
              onClick={handleCancel}
              className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 来电信息 */}
        <div className="p-6 border-b border-gray-200">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">来电号码:</span>
              <span className="font-semibold text-lg">{callerNumber || '未知号码'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">被叫号码:</span>
              <span className="font-medium">{calledNumber}</span>
            </div>
          </div>
        </div>

        {/* 倒计时 */}
        <div className="px-6 py-4 bg-yellow-50 border-b border-yellow-100">
          <div className="flex items-center justify-center space-x-2">
            <Clock className={`w-5 h-5 ${remainingSeconds <= 3 ? 'text-red-500 animate-pulse' : 'text-yellow-600'}`} />
            <span className={`font-semibold ${remainingSeconds <= 3 ? 'text-red-500' : 'text-yellow-700'}`}>
              剩余时间: {remainingSeconds} 秒
            </span>
          </div>
          {remainingSeconds <= 3 && (
            <p className="text-center text-sm text-red-500 mt-1">请尽快选择方案！</p>
          )}
        </div>

        {/* 方案列表 */}
        <div className="p-6 max-h-80 overflow-y-auto">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">选择代接方案:</h4>
          <div className="space-y-2">
            {schemes.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <p>暂无可用方案</p>
              </div>
            ) : (
              schemes.map((scheme) => (
                <div
                  key={scheme.id}
                  onClick={() => setSelectedSchemeId(scheme.id)}
                  className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                    selectedSchemeId === scheme.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <h5 className="font-semibold text-gray-900">{scheme.schemeName}</h5>
                        {scheme.isActive && (
                          <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                            当前激活
                          </span>
                        )}
                      </div>
                      {scheme.description && (
                        <p className="text-sm text-gray-600 mt-1">{scheme.description}</p>
                      )}
                      {scheme.boundPhoneNumber && (
                        <p className="text-xs text-gray-500 mt-1">
                          绑定号码: {scheme.boundPhoneNumber}
                        </p>
                      )}
                    </div>
                    <div className="ml-3">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                          selectedSchemeId === scheme.id
                            ? 'border-blue-500 bg-blue-500'
                            : 'border-gray-300'
                        }`}
                      >
                        {selectedSchemeId === scheme.id && (
                          <div className="w-2 h-2 bg-white rounded-full"></div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 底部按钮 */}
        <div className="p-6 bg-gray-50 rounded-b-lg flex space-x-3">
          <button
            onClick={handleCancel}
            className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors font-medium"
            disabled={loading}
          >
            拒接
          </button>
          <button
            onClick={handleSelectScheme}
            disabled={!selectedSchemeId || loading || isTimeout}
            className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors ${
              selectedSchemeId && !loading && !isTimeout
                ? 'bg-blue-500 text-white hover:bg-blue-600'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            {loading ? '处理中...' : '确认接听'}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes fade-in {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
        .animate-fade-in {
          animation: fade-in 0.2s ease-out;
        }
      `}</style>
    </div>
  );
};

export default IncomingCallModal;

import React, { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import  Button  from '@/components/UI/Button';
import  Card  from '@/components/UI/Card';
import { Switch } from '@/components/UI/Switch';
import Badge from '@/components/UI/Badge';
import { X, Play, Pause, Settings, Plus, Trash2, Eye, EyeOff } from 'lucide-react';

interface DesktopPetPanelProps {
  isVisible: boolean;
  onClose: () => void;
}

export const DesktopPetPanel: React.FC<DesktopPetPanelProps> = ({
  isVisible,
  onClose
}) => {
  const [isPetVisible, setIsPetVisible] = useState(false);
  const [isClickThrough, setIsClickThrough] = useState(true);
  const [selectedPet] = useState<any>();
  const [petCount, setPetCount] = useState(0);

  useEffect(() => {
    if (isVisible) {
      // 检查桌宠状态
      checkPetStatus();
    }
  }, [isVisible]);

  const checkPetStatus = async () => {
    try {
      // 这里可以添加检查桌宠状态的逻辑
      setPetCount(1); // 临时设置
    } catch (error) {
      console.error('检查桌宠状态失败:', error);
    }
  };

  const handleShowPet = async () => {
    try {
      if (typeof window !== 'undefined' && window.__TAURI__) {
        await invoke('show_desktop_pet');
      }
      setIsPetVisible(true);
    } catch (error) {
      console.error('显示桌宠失败:', error);
      setIsPetVisible(true);
    }
  };

  const handleHidePet = async () => {
    try {
      if (typeof window !== 'undefined' && window.__TAURI__) {
        await invoke('hide_desktop_pet');
      }
      setIsPetVisible(false);
    } catch (error) {
      console.error('隐藏桌宠失败:', error);
      setIsPetVisible(false);
    }
  };

  const handleToggleClickThrough = async (enabled: boolean) => {
    try {
      if (typeof window !== 'undefined' && window.__TAURI__) {
        await invoke('set_desktop_pet_click_through', { clickThrough: enabled });
      }
      setIsClickThrough(enabled);
    } catch (error) {
      console.error('设置点击穿透失败:', error);
      setIsClickThrough(enabled);
    }
  };

  const handleAddPet = () => {
    // 这里可以添加新桌宠的逻辑
    console.log('添加桌宠:', selectedPet);
  };

  const handleRemovePet = () => {
    // 这里可以移除桌宠的逻辑
    console.log('移除桌宠');
  };

  const handlePlayAnimation = (animationName: string) => {
    // 这里可以添加播放特定动画的逻辑
    // 可以通过事件总线或状态管理来通知桌宠组件播放动画
    console.log('播放动画:', animationName);
    
    // 发送自定义事件来通知桌宠播放动画
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('playDesktopPetAnimation', {
        detail: { animationName }
      }));
    }
  };

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="p-6">
          {/* 头部 */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              桌宠控制面板
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* 状态信息 */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${isPetVisible ? 'bg-green-500' : 'bg-gray-400'}`} />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  桌宠状态
                </span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                {isPetVisible ? '运行中' : '已停止'}
              </p>
            </div>

            <div className="bg-sky-50 dark:bg-sky-900/20 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <Settings className="w-4 h-4 text-sky-600" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  桌宠数量
                </span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                {petCount} 只
              </p>
            </div>

            <div className="bg-orange-50 dark:bg-orange-900/20 p-4 rounded-lg">
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${isClickThrough ? 'bg-orange-500' : 'bg-gray-400'}`} />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  点击穿透
                </span>
              </div>
              <p className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                {isClickThrough ? '开启' : '关闭'}
              </p>
            </div>
          </div>

          {/* 控制按钮 */}
          <div className="flex flex-wrap gap-3 mb-6">
            <Button
              onClick={isPetVisible ? handleHidePet : handleShowPet}
              variant={isPetVisible ? "destructive" : "default"}
              className="flex items-center space-x-2"
            >
              {isPetVisible ? (
                <>
                  <Pause className="w-4 h-4" />
                  <span>隐藏桌宠</span>
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  <span>显示桌宠</span>
                </>
              )}
            </Button>

            <Button
              onClick={handleAddPet}
              variant="outline"
              className="flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>添加桌宠</span>
            </Button>

            <Button
              onClick={handleRemovePet}
              variant="outline"
              className="flex items-center space-x-2 text-red-600 hover:text-red-700"
            >
              <Trash2 className="w-4 h-4" />
              <span>移除桌宠</span>
            </Button>
          </div>

          {/* 动画控制 */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              动画控制
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button
                onClick={() => handlePlayAnimation('idle')}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <span>待机</span>
              </Button>
              <Button
                onClick={() => handlePlayAnimation('cry')}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <span>哭泣</span>
              </Button>
              <Button
                onClick={() => handlePlayAnimation('daze')}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <span>发呆</span>
              </Button>
              <Button
                onClick={() => handlePlayAnimation('sing')}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <span>唱歌</span>
              </Button>
              <Button
                onClick={() => handlePlayAnimation('flow')}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <span>流动</span>
              </Button>
              <Button
                onClick={() => handlePlayAnimation('hide')}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <span>隐藏</span>
              </Button>
              <Button
                onClick={() => handlePlayAnimation('sad')}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <span>悲伤</span>
              </Button>
              <Button
                onClick={() => handlePlayAnimation('falldown')}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <span>掉落</span>
              </Button>
            </div>
          </div>

          {/* 设置选项 */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              设置选项
            </h3>

            {/* 点击穿透设置 */}
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <div className="flex items-center space-x-3">
                {isClickThrough ? (
                  <EyeOff className="w-5 h-5 text-gray-600" />
                ) : (
                  <Eye className="w-5 h-5 text-gray-600" />
                )}
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    点击穿透模式
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    允许点击桌宠下方的内容
                  </p>
                </div>
              </div>
              <Switch
                checked={isClickThrough}
                onCheckedChange={handleToggleClickThrough}
              />
            </div>

            {/* 桌宠信息 */}
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                当前桌宠信息
              </h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">名称:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {selectedPet.name}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">类别:</span>
                  <Badge variant="secondary">
                    {selectedPet.category}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 dark:text-gray-400">状态数量:</span>
                  <span className="text-sm font-medium text-gray-900 dark:text-white">
                    {selectedPet.states.length} 种
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 操作提示 */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
              使用提示
            </h4>
            <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
              <li>• 拖拽桌宠可以移动它们的位置</li>
              <li>• 点击桌宠可以触发特殊动作</li>
              <li>• 桌宠会自动在桌面上移动和互动</li>
              <li>• 开启点击穿透模式可以正常使用其他应用</li>
            </ul>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default DesktopPetPanel;

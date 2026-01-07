import { useState } from 'react'
import { motion } from 'framer-motion'
import { Save, Bell, Shield, Database, Globe } from 'lucide-react'
import AdminLayout from '@/components/Layout/AdminLayout'
import Card from '@/components/UI/Card'
import Button from '@/components/UI/Button'
import Input from '@/components/UI/Input'
import { Switch } from '@/components/UI/Switch'

const Settings = () => {
  const [settings, setSettings] = useState({
    siteName: '灵语回响',
    siteDescription: '智能语音交互平台管理后台',
    emailNotifications: true,
    pushNotifications: false,
    twoFactorAuth: false,
    language: 'zh-CN',
    timezone: 'Asia/Shanghai',
  })

  const handleSave = () => {
    // 保存设置逻辑
    console.log('保存设置:', settings)
  }

  return (
    <AdminLayout
      title="系统设置"
      description="管理系统配置和偏好设置"
      actions={
        <Button variant="primary" leftIcon={<Save className="w-4 h-4" />} onClick={handleSave}>
          保存更改
        </Button>
      }
    >
      <div className="space-y-6">
        {/* 基本设置 */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
              <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                基本设置
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                配置系统基本信息
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                站点名称
              </label>
              <Input
                value={settings.siteName}
                onChange={(e) =>
                  setSettings({ ...settings, siteName: e.target.value })
                }
                placeholder="请输入站点名称"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                站点描述
              </label>
              <Input
                value={settings.siteDescription}
                onChange={(e) =>
                  setSettings({ ...settings, siteDescription: e.target.value })
                }
                placeholder="请输入站点描述"
              />
            </div>
          </div>
        </Card>

        {/* 通知设置 */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
              <Bell className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                通知设置
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                管理通知偏好
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  邮件通知
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  接收重要事件的邮件通知
                </p>
              </div>
              <Switch
                checked={settings.emailNotifications}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, emailNotifications: checked })
                }
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  推送通知
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  接收浏览器推送通知
                </p>
              </div>
              <Switch
                checked={settings.pushNotifications}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, pushNotifications: checked })
                }
              />
            </div>
          </div>
        </Card>

        {/* 安全设置 */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
              <Shield className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                安全设置
              </h3>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                管理账户安全选项
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-900 dark:text-white">
                  双因素认证
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  为账户添加额外的安全层
                </p>
              </div>
              <Switch
                checked={settings.twoFactorAuth}
                onCheckedChange={(checked) =>
                  setSettings({ ...settings, twoFactorAuth: checked })
                }
              />
            </div>
          </div>
        </Card>
      </div>
    </AdminLayout>
  )
}

export default Settings


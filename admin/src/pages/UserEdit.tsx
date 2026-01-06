import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save } from 'lucide-react'
import AdminLayout from '@/components/Layout/AdminLayout'
import Card from '@/components/UI/Card'
import Button from '@/components/UI/Button'
import Input from '@/components/UI/Input'
import { getUser, updateUser, User } from '@/services/adminApi'
import { showAlert } from '@/utils/notification'

const UserEdit = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    email: '',
    displayName: '',
    firstName: '',
    lastName: '',
    enabled: true,
    isStaff: false,
    isSuperUser: false,
  })

  useEffect(() => {
    if (id) {
      fetchUser(parseInt(id))
    }
  }, [id])

  const fetchUser = async (userId: number) => {
    try {
      setLoading(true)
      const user = await getUser(userId)
      setFormData({
        email: user.email || '',
        displayName: user.displayName || '',
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        enabled: user.enabled ?? true,
        isStaff: user.isStaff ?? false,
        isSuperUser: user.isSuperUser ?? false,
      })
    } catch (error) {
      console.error('获取用户详情失败:', error)
      showAlert('获取用户详情失败', 'error')
      navigate('/users')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!formData.email.trim()) {
      showAlert('请填写邮箱', 'error')
      return
    }
    try {
      setLoading(true)
      await updateUser(parseInt(id!), formData)
      showAlert('更新成功', 'success')
      navigate('/users')
    } catch (error) {
      showAlert('更新失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (loading && !formData.email) {
    return (
      <AdminLayout title="编辑用户">
        <Card className="p-12 text-center">
          <div className="text-slate-500">加载中...</div>
        </Card>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout
      title="编辑用户"
      description="编辑用户信息和权限"
    >
      <div className="space-y-6">
        {/* 操作栏 */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              leftIcon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => navigate('/users')}
            >
              返回列表
            </Button>
            <Button
              leftIcon={<Save className="w-4 h-4" />}
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? '保存中...' : '保存'}
            </Button>
          </div>
        </Card>

        {/* 表单 */}
        <Card className="p-6">
          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
                邮箱 <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full"
                placeholder="请输入邮箱"
                type="email"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
                显示名称
              </label>
              <Input
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                className="w-full"
                placeholder="请输入显示名称"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
                  名
                </label>
                <Input
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full"
                  placeholder="请输入名"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
                  姓
                </label>
                <Input
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full"
                  placeholder="请输入姓"
                />
              </div>
            </div>

            <div className="space-y-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                权限设置
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">启用账户</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isStaff}
                  onChange={(e) => setFormData({ ...formData, isStaff: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">管理员</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isSuperUser}
                  onChange={(e) => setFormData({ ...formData, isSuperUser: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">超级管理员</span>
              </label>
            </div>
          </div>
        </Card>
      </div>
    </AdminLayout>
  )
}

export default UserEdit


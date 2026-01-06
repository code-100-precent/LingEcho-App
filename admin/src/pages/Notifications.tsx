import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Bell, CheckCheck, Trash2, Search } from 'lucide-react'
import AdminLayout from '@/components/Layout/AdminLayout'
import Card from '@/components/UI/Card'
import Button from '@/components/UI/Button'
import Input from '@/components/UI/Input'
import ConfirmDialog from '@/components/UI/ConfirmDialog'
import { cn } from '@/utils/cn'
import { getNotifications, markAllNotificationsRead, deleteNotification, Notification } from '@/services/adminApi'
import { showAlert } from '@/utils/notification'

const Notifications = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all')
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [page] = useState(1)
  const [pageSize] = useState(20)

  useEffect(() => {
    fetchNotifications()
  }, [page, filter, searchQuery])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const response = await getNotifications({
        page,
        pageSize,
        search: searchQuery || undefined,
        filter: filter !== 'all' ? filter : undefined,
      })
      setNotifications(response.list || [])
    } catch (error) {
      console.error('获取通知列表失败:', error)
      setNotifications([])
    } finally {
      setLoading(false)
    }
  }

  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: number | null }>({ open: false, id: null })

  const handleMarkAllRead = async () => {
    try {
      await markAllNotificationsRead()
      showAlert('已全部标记为已读', 'success')
      fetchNotifications()
    } catch (error) {
      console.error('标记全部已读失败:', error)
      showAlert('操作失败', 'error')
    }
  }

  const handleDelete = async (id: number) => {
    setDeleteConfirm({ open: true, id })
  }

  const confirmDelete = async () => {
    if (!deleteConfirm.id) return
    try {
      await deleteNotification(deleteConfirm.id)
      showAlert('删除成功', 'success')
      fetchNotifications()
    } catch (error) {
      console.error('删除通知失败:', error)
      showAlert('删除失败', 'error')
    } finally {
      setDeleteConfirm({ open: false, id: null })
    }
  }

  const unreadCount = notifications?.filter(n => !n.read).length || 0

  const getTypeColor = (type?: string) => {
    switch (type) {
      case 'success':
        return 'bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400'
      case 'error':
        return 'bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400'
      case 'warning':
        return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600 dark:text-yellow-400'
      default:
        return 'bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
    }
  }

  return (
    <AdminLayout
      title="消息中心"
      description={`您有 ${unreadCount} 条未读消息`}
      actions={
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            leftIcon={<CheckCheck className="w-4 h-4" />}
            onClick={handleMarkAllRead}
          >
            全部已读
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* 搜索和筛选 */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="搜索消息..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
                className="w-full"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={filter === 'all' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setFilter('all')}
              >
                全部
              </Button>
              <Button
                variant={filter === 'unread' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setFilter('unread')}
              >
                未读
              </Button>
              <Button
                variant={filter === 'read' ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setFilter('read')}
              >
                已读
              </Button>
            </div>
          </div>
        </Card>

        {/* 消息列表 */}
        {loading ? (
          <Card className="p-12 text-center">
            <div className="text-slate-500">加载中...</div>
          </Card>
        ) : notifications.length === 0 ? (
          <Card className="p-12 text-center">
            <Bell className="w-12 h-12 text-slate-400 mx-auto mb-4" />
            <p className="text-slate-600 dark:text-slate-400">暂无消息</p>
          </Card>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className={cn(
                  "p-4 hover:shadow-md transition-shadow cursor-pointer",
                  !notification.read && "border-l-4 border-l-blue-500"
                )}>
                  <div className="flex items-start gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0",
                      getTypeColor(notification.type)
                    )}>
                      <Bell className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className={cn(
                              "font-semibold",
                              !notification.read ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-400"
                            )}>
                              {notification.title}
                            </h4>
                            {!notification.read && (
                              <span className="w-2 h-2 rounded-full bg-blue-500" />
                            )}
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                            {notification.content}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-500">
                            {new Date(notification.createdAt).toLocaleString('zh-CN')}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={<Trash2 className="w-4 h-4" />}
                            className="text-red-600 hover:text-red-700 dark:text-red-400"
                            onClick={() => handleDelete(notification.id)}
                          >
                            删除
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      <ConfirmDialog
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: null })}
        onConfirm={confirmDelete}
        title="确认删除"
        message="确定要删除这条通知吗？此操作不可恢复。"
        variant="danger"
        confirmText="删除"
      />
    </AdminLayout>
  )
}

export default Notifications

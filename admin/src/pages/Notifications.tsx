import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Bell, CheckCheck, Trash2, Search, CheckCircle2, AlertCircle, Info, XCircle } from 'lucide-react'
import AdminLayout from '@/components/Layout/AdminLayout'
import Card from '@/components/UI/Card'
import Button from '@/components/UI/Button'
import Input from '@/components/UI/Input'
import ConfirmDialog from '@/components/UI/ConfirmDialog'
import Badge from '@/components/UI/Badge'
import EmptyState from '@/components/UI/EmptyState'
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

  const getTypeIcon = (type?: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5" />
      case 'error':
        return <XCircle className="w-5 h-5" />
      case 'warning':
        return <AlertCircle className="w-5 h-5" />
      default:
        return <Info className="w-5 h-5" />
    }
  }

  const getTypeVariant = (type?: string): 'success' | 'error' | 'warning' | 'primary' => {
    switch (type) {
      case 'success':
        return 'success'
      case 'error':
        return 'error'
      case 'warning':
        return 'warning'
      default:
        return 'primary'
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
          <Card className="p-12">
            <EmptyState
              icon={Bell}
              title="暂无消息"
              description="您还没有收到任何通知"
            />
          </Card>
        ) : (
          <div className="space-y-3">
            {notifications.map((notification, index) => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <Card
                  variant={!notification.read ? 'elevated' : 'default'}
                  hover={true}
                  className={cn(
                    "transition-all duration-200",
                    !notification.read && "border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20"
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <Badge
                        variant={getTypeVariant(notification.type)}
                        size="md"
                        shape="pill"
                        icon={getTypeIcon(notification.type)}
                        className="w-12 h-12 flex items-center justify-center"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className={cn(
                              "text-base font-semibold",
                              !notification.read 
                                ? "text-slate-900 dark:text-white" 
                                : "text-slate-600 dark:text-slate-400"
                            )}>
                              {notification.title}
                            </h4>
                            {!notification.read && (
                              <Badge variant="primary" size="xs" shape="pill">
                                未读
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 leading-relaxed">
                            {notification.content}
                          </p>
                          <div className="flex items-center gap-3">
                            <p className="text-xs text-slate-500 dark:text-slate-500">
                              {new Date(notification.createdAt).toLocaleString('zh-CN', {
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                            {notification.type && (
                              <Badge variant="outline" size="xs">
                                {notification.type}
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={<Trash2 className="w-4 h-4" />}
                            className="text-red-600 hover:text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20"
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

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, Filter, Eye, CheckCircle, CreditCard } from 'lucide-react'
import AdminLayout from '@/components/Layout/AdminLayout'
import Card from '@/components/UI/Card'
import Button from '@/components/UI/Button'
import Input from '@/components/UI/Input'
import Modal from '@/components/UI/Modal'
import { cn } from '@/utils/cn'
import { getOrders, getOrder, updateOrderStatus, confirmPayment, Order } from '@/services/adminApi'
import { showAlert } from '@/utils/notification'

const Orders = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [page] = useState(1)
  const [pageSize] = useState(20)
  const [showDetail, setShowDetail] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)

  useEffect(() => {
    fetchOrders()
  }, [page, searchQuery, statusFilter])

  const fetchOrders = async () => {
    try {
      setLoading(true)
      const response = await getOrders({
        page,
        pageSize,
        search: searchQuery || undefined,
        status: statusFilter || undefined,
      })
      setOrders(response.list)
    } catch (error) {
      console.error('获取订单列表失败:', error)
      showAlert('获取订单列表失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleViewDetail = async (id: number) => {
    try {
      const order = await getOrder(id)
      setSelectedOrder(order)
      setShowDetail(true)
    } catch (error) {
      console.error('获取订单详情失败:', error)
      showAlert('获取订单详情失败', 'error')
    }
  }

  const handleConfirmPayment = async (id: number) => {
    try {
      await confirmPayment(id)
      showAlert('确认支付成功，订单已进入待开始状态', 'success')
      fetchOrders()
      if (selectedOrder && selectedOrder.id === id) {
        // 刷新详情
        handleViewDetail(id)
      }
    } catch (error: any) {
      console.error('确认支付失败:', error)
      showAlert(error.msg || '确认支付失败', 'error')
    }
  }

  const handleUpdateStatus = async (id: number, status: string) => {
    try {
      await updateOrderStatus(id, status)
      showAlert('订单状态更新成功', 'success')
      fetchOrders()
      if (selectedOrder && selectedOrder.id === id) {
        // 刷新详情
        handleViewDetail(id)
      }
    } catch (error: any) {
      console.error('更新订单状态失败:', error)
      showAlert(error.msg || '更新失败', 'error')
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'waiting_playmate_confirm':
        return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300'
      case 'pending_payment':
        return 'bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300'
      case 'pending_start':
        return 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300'
      case 'in_progress':
        return 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-800 dark:text-indigo-300'
      case 'completed':
        return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
      case 'cancelled':
      case 'refunded':
        return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
      default:
        return 'bg-gray-100 dark:bg-gray-900/20 text-gray-800 dark:text-gray-300'
    }
  }

  const getStatusText = (status: string) => {
    const statusMap: Record<string, string> = {
      'waiting_playmate_confirm': '等待陪玩确认',
      'pending_payment': '待支付',
      'pending_start': '待开始',
      'in_progress': '进行中',
      'completed': '已完成',
      'cancelled': '已取消',
      'refunded': '已退款',
    }
    return statusMap[status] || status
  }

  const getStatusProgress = (status: string): number => {
    switch (status) {
      case 'waiting_playmate_confirm':
        return 0
      case 'pending_payment':
        return 20
      case 'pending_start':
        return 40
      case 'in_progress':
        return 70
      case 'completed':
        return 100
      case 'cancelled':
      case 'refunded':
        return 0
      default:
        return 0
    }
  }

  const getStatusSteps = (status: string) => {
    const steps = [
      { label: '待确认', status: 'waiting_playmate_confirm' },
      { label: '待支付', status: 'pending_payment' },
      { label: '待开始', status: 'pending_start' },
      { label: '进行中', status: 'in_progress' },
      { label: '已完成', status: 'completed' }
    ]
    return steps.map((step, index) => {
      // 找到当前状态在步骤中的位置
      let currentIndex = -1
      if (status === 'waiting_playmate_confirm') currentIndex = 0
      else if (status === 'pending_payment') currentIndex = 1
      else if (status === 'pending_start') currentIndex = 2
      else if (status === 'in_progress') currentIndex = 3
      else if (status === 'completed') currentIndex = 4
      
      const isActive = currentIndex >= 0 && index <= currentIndex
      const isCurrent = index === currentIndex
      return { ...step, isActive, isCurrent }
    })
  }

  return (
    <AdminLayout
      title="订单管理"
      description="管理系统订单和交易记录"
    >
      <div className="space-y-6">
        <Card className="p-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="搜索订单号、用户..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />}
                  className="w-full"
                />
              </div>
              <Button 
                variant="outline" 
                leftIcon={<Filter className="w-4 h-4" />}
                onClick={() => setShowFilters(!showFilters)}
              >
                筛选
              </Button>
            </div>
            {showFilters && (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="">全部状态</option>
                  <option value="waiting_playmate_confirm">等待陪玩确认</option>
                  <option value="pending_payment">待支付</option>
                  <option value="pending_start">待开始</option>
                  <option value="in_progress">进行中</option>
                  <option value="completed">已完成</option>
                  <option value="cancelled">已取消</option>
                  <option value="refunded">已退款</option>
                </select>
              </div>
            )}
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">订单号</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">陪玩</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">客户</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">游戏</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">金额</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">状态</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">创建时间</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 dark:text-slate-400 uppercase">操作</th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-slate-900 divide-y divide-slate-200 dark:divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                      加载中...
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-8 text-center text-slate-500">
                      暂无数据
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <motion.tr
                      key={order.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                          {order.orderNo}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-white">
                        <div className="flex flex-col">
                          <span>{order.playmateName || '未知'}</span>
                          {order.playmateId && (
                            <span className="text-xs text-slate-500 dark:text-slate-400">ID: {order.playmateId}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900 dark:text-white">
                        <div className="flex flex-col">
                          <span>{order.customerName || '未知'}</span>
                          {order.customerId && (
                            <span className="text-xs text-slate-500 dark:text-slate-400">ID: {order.customerId}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600 dark:text-slate-400">
                        {order.gameName ? decodeURIComponent(order.gameName) : '未知'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 dark:text-white">
                        ¥{order.amount?.toFixed(2) || '0.00'}
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-2">
                          <span className={cn("px-2 py-1 text-xs font-medium rounded-full inline-block", getStatusColor(order.status))}>
                            {getStatusText(order.status)}
                          </span>
                          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                            <div
                              className={cn(
                                "h-2 rounded-full transition-all duration-300",
                                order.status === 'completed' ? 'bg-green-500' :
                                order.status === 'cancelled' || order.status === 'refunded' ? 'bg-red-500' :
                                'bg-blue-500'
                              )}
                              style={{ width: `${getStatusProgress(order.status)}%` }}
                            />
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                            {getStatusSteps(order.status).map((step, idx) => (
                              <div key={idx} className="flex items-center">
                                <div className={cn(
                                  "w-1.5 h-1.5 rounded-full",
                                  step.isActive ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'
                                )} />
                                {idx < getStatusSteps(order.status).length - 1 && (
                                  <div className={cn(
                                    "w-4 h-0.5",
                                    step.isActive ? 'bg-blue-500' : 'bg-slate-300 dark:bg-slate-600'
                                  )} />
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 dark:text-slate-400">
                        {new Date(order.createdAt).toLocaleString('zh-CN')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end gap-2">
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            leftIcon={<Eye className="w-4 h-4" />}
                            onClick={() => handleViewDetail(order.id)}
                          >
                            查看
                          </Button>
                          {/* 待付款状态：确认支付 */}
                          {order.status === 'pending_payment' && (
                            <Button 
                              variant="primary" 
                              size="sm" 
                              leftIcon={<CreditCard className="w-4 h-4" />}
                              onClick={() => handleConfirmPayment(order.id)}
                            >
                              确认支付
                            </Button>
                          )}
                          {/* 待开始状态：可以开始服务 */}
                          {order.status === 'pending_start' && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              leftIcon={<CheckCircle className="w-4 h-4" />}
                              onClick={() => handleUpdateStatus(order.id, 'in_progress')}
                            >
                              开始服务
                            </Button>
                          )}
                          {/* 进行中状态：可以完成订单 */}
                          {order.status === 'in_progress' && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              leftIcon={<CheckCircle className="w-4 h-4" />}
                              onClick={() => handleUpdateStatus(order.id, 'completed')}
                            >
                              完成订单
                            </Button>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* 订单详情模态框 */}
        <Modal isOpen={showDetail} onClose={() => setShowDetail(false)} size="lg">
          {selectedOrder && (
            <div className="p-6">
              <h2 className="text-2xl font-bold mb-4">订单详情</h2>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">订单号</label>
                    <p className="text-slate-900 dark:text-white">{selectedOrder.orderNo}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">状态</label>
                    <p>
                      <span className={cn("px-2 py-1 text-xs font-medium rounded-full", getStatusColor(selectedOrder.status))}>
                        {getStatusText(selectedOrder.status)}
                      </span>
                    </p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">陪玩</label>
                    <div className="flex flex-col">
                      <p className="text-slate-900 dark:text-white">{selectedOrder.playmateName || '未知'}</p>
                      {selectedOrder.playmateId && (
                        <p className="text-sm text-slate-500 dark:text-slate-400">ID: {selectedOrder.playmateId}</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">客户</label>
                    <div className="flex flex-col">
                      <p className="text-slate-900 dark:text-white">{selectedOrder.customerName || '未知'}</p>
                      {selectedOrder.customerId && (
                        <p className="text-sm text-slate-500 dark:text-slate-400">ID: {selectedOrder.customerId}</p>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">游戏</label>
                    <p className="text-slate-900 dark:text-white">{selectedOrder.gameName ? decodeURIComponent(selectedOrder.gameName) : '未知'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">金额</label>
                    <p className="text-slate-900 dark:text-white">¥{selectedOrder.amount?.toFixed(2) || '0.00'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">创建时间</label>
                    <p className="text-slate-900 dark:text-white">{new Date(selectedOrder.createdAt).toLocaleString('zh-CN')}</p>
                  </div>
                </div>
                
                {/* 操作按钮 */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-700 flex gap-2">
                  {/* 待付款状态：确认支付 */}
                  {selectedOrder.status === 'pending_payment' && (
                    <Button 
                      variant="primary" 
                      leftIcon={<CreditCard className="w-4 h-4" />}
                      onClick={() => {
                        handleConfirmPayment(selectedOrder.id)
                        setShowDetail(false)
                      }}
                    >
                      确认支付
                    </Button>
                  )}
                  {/* 待开始状态：开始服务 */}
                  {selectedOrder.status === 'pending_start' && (
                    <Button 
                      variant="primary" 
                      leftIcon={<CheckCircle className="w-4 h-4" />}
                      onClick={() => {
                        handleUpdateStatus(selectedOrder.id, 'in_progress')
                        setShowDetail(false)
                      }}
                    >
                      开始服务
                    </Button>
                  )}
                  {/* 进行中状态：完成订单 */}
                  {selectedOrder.status === 'in_progress' && (
                    <Button 
                      variant="primary" 
                      leftIcon={<CheckCircle className="w-4 h-4" />}
                      onClick={() => {
                        handleUpdateStatus(selectedOrder.id, 'completed')
                        setShowDetail(false)
                      }}
                    >
                      完成订单
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </AdminLayout>
  )
}

export default Orders

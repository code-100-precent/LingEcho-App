import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, Filter, CheckCircle, XCircle, Star, Plus, Trash2, Crown } from 'lucide-react'
import AdminLayout from '@/components/Layout/AdminLayout'
import Card from '@/components/UI/Card'
import Button from '@/components/UI/Button'
import Input from '@/components/UI/Input'
import ConfirmDialog from '@/components/UI/ConfirmDialog'
import Modal from '@/components/UI/Modal'
import { cn } from '@/utils/cn'
import { getPlaymates, approvePlaymate, rejectPlaymate, getPlaymateDetail, Playmate, getVIPFriends, addVIPFriend, deleteVIPFriend, VIPFriend, getUsers, User } from '@/services/adminApi'
import { showAlert } from '@/utils/notification'

const Playmates = () => {
  const [activeTab, setActiveTab] = useState<'playmates' | 'vip-friends'>('playmates')
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('pending') // 默认显示待审核
  const [showFilters, setShowFilters] = useState(true) // 默认显示筛选器
  const [playmates, setPlaymates] = useState<Playmate[]>([])
  const [loading, setLoading] = useState(true)
  const [page] = useState(1)
  const [pageSize] = useState(20)
  const [stats, setStats] = useState<Record<number, { orderCount: number; rating: number }>>({})
  const [showDetail, setShowDetail] = useState(false)
  const [selectedPlaymate, setSelectedPlaymate] = useState<Playmate | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)
  
  // 尊贵好友位相关状态
  const [vipFriends, setVipFriends] = useState<VIPFriend[]>([])
  const [loadingVIPFriends, setLoadingVIPFriends] = useState(false)
  const [showAddVIPModal, setShowAddVIPModal] = useState(false)
  const [ownerUserId, setOwnerUserId] = useState<number | ''>('')
  const [vipUserId, setVipUserId] = useState<number | ''>('')
  const [users, setUsers] = useState<User[]>([])
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [deleteVIPConfirm, setDeleteVIPConfirm] = useState<{ open: boolean; id: number | null }>({ open: false, id: null })

  useEffect(() => {
    if (activeTab === 'playmates') {
    fetchPlaymates()
    } else {
      fetchVIPFriends()
    }
  }, [page, searchQuery, statusFilter, activeTab])

  const fetchPlaymates = async () => {
    try {
      setLoading(true)
      const response = await getPlaymates({
        page,
        pageSize,
        search: searchQuery || undefined,
        status: statusFilter || undefined,
      })
      setPlaymates(response.list)
      
      // 处理统计数据
      if (response.stats) {
        const statsMap: Record<number, { orderCount: number; rating: number }> = {}
        response.stats.forEach((stat: any) => {
          statsMap[stat.userId] = {
            orderCount: stat.orderCount || 0,
            rating: stat.rating || 0
          }
        })
        setStats(statsMap)
      }
    } catch (error) {
      console.error('获取陪玩列表失败:', error)
      showAlert('获取陪玩列表失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  const [rejectConfirm, setRejectConfirm] = useState<{ open: boolean; id: number | null; reason: string }>({ 
    open: false, 
    id: null,
    reason: ''
  })

  const handleApprove = async (id: number) => {
    try {
      console.log('开始审核通过:', id)
      await approvePlaymate(id)
      showAlert('审核通过', 'success')
      fetchPlaymates()
    } catch (error) {
      console.error('审核失败:', error)
      showAlert('审核失败', 'error')
    }
  }

  const handleReject = async (id: number) => {
    console.log('开始拒绝申请:', id)
    setRejectConfirm({ open: true, id, reason: '' })
  }

  const confirmReject = async () => {
    if (!rejectConfirm.id) return
    try {
      await rejectPlaymate(rejectConfirm.id, rejectConfirm.reason)
      showAlert('已拒绝', 'success')
      fetchPlaymates()
    } catch (error) {
      console.error('操作失败:', error)
      showAlert('操作失败', 'error')
    } finally {
      setRejectConfirm({ open: false, id: null, reason: '' })
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'verified':
        return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
      case 'pending':
        return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300'
      case 'rejected':
        return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
      default:
        return 'bg-gray-100 dark:bg-gray-900/20 text-gray-800 dark:text-gray-300'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'verified':
        return '已认证'
      case 'pending':
        return '待审核'
      case 'rejected':
        return '已拒绝'
      default:
        return status
    }
  }

  const handleViewDetail = async (playmate: Playmate) => {
    try {
      setLoadingDetail(true)
      setSelectedPlaymate(playmate)
      // 尝试获取最新详情，如果失败则使用列表中的数据
      try {
        const detail = await getPlaymateDetail(playmate.id)
        setSelectedPlaymate(detail)
      } catch (error) {
        console.warn('获取详情失败，使用列表数据:', error)
        // 使用列表中的数据
      }
      setShowDetail(true)
    } catch (error) {
      console.error('打开详情失败:', error)
      showAlert('打开详情失败', 'error')
    } finally {
      setLoadingDetail(false)
    }
  }

  // 尊贵好友位相关方法
  const fetchVIPFriends = async () => {
    try {
      setLoadingVIPFriends(true)
      const result = await getVIPFriends()
      setVipFriends(result)
    } catch (error) {
      console.error('获取尊贵好友位失败:', error)
      showAlert('获取尊贵好友位失败', 'error')
    } finally {
      setLoadingVIPFriends(false)
    }
  }

  // 加载用户列表
  const fetchUsers = async () => {
    try {
      setLoadingUsers(true)
      const response = await getUsers({ page: 1, pageSize: 100 })
      setUsers(response.list)
    } catch (error) {
      console.error('获取用户列表失败:', error)
      showAlert('获取用户列表失败', 'error')
    } finally {
      setLoadingUsers(false)
    }
  }

  // 打开添加模态框时加载用户列表
  const handleOpenAddVIPModal = () => {
    setShowAddVIPModal(true)
    if (users.length === 0) {
      fetchUsers()
    }
  }

  const handleAddVIPFriend = async () => {
    if (!ownerUserId || ownerUserId === '') {
      showAlert('请选择为哪个用户设置', 'error')
      return
    }
    if (!vipUserId || vipUserId === '') {
      showAlert('请选择要设置为尊贵好友位的用户', 'error')
      return
    }
    if (ownerUserId === vipUserId) {
      showAlert('不能将自己设置为自己的尊贵好友位', 'error')
      return
    }
    try {
      await addVIPFriend({ ownerUserId: Number(ownerUserId), userId: Number(vipUserId) })
      showAlert('添加成功', 'success')
      setShowAddVIPModal(false)
      setOwnerUserId('')
      setVipUserId('')
      fetchVIPFriends()
    } catch (error: any) {
      console.error('添加尊贵好友位失败:', error)
      showAlert(error?.message || '添加失败', 'error')
    }
  }

  const handleDeleteVIPFriend = (id: number) => {
    setDeleteVIPConfirm({ open: true, id })
  }

  const confirmDeleteVIP = async () => {
    if (!deleteVIPConfirm.id) return
    try {
      await deleteVIPFriend(deleteVIPConfirm.id)
      showAlert('删除成功', 'success')
      fetchVIPFriends()
    } catch (error) {
      console.error('删除失败:', error)
      showAlert('删除失败', 'error')
    } finally {
      setDeleteVIPConfirm({ open: false, id: null })
    }
  }

  return (
    <AdminLayout
      title="陪玩管理"
      description="管理陪玩用户和认证申请"
    >
      <div className="space-y-6">
        {/* 标签页切换 */}
        <Card className="p-0">
          <div className="flex border-b border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setActiveTab('playmates')}
              className={cn(
                "flex-1 px-6 py-3 text-sm font-medium transition-colors",
                activeTab === 'playmates'
                  ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              陪玩管理
            </button>
            <button
              onClick={() => setActiveTab('vip-friends')}
              className={cn(
                "flex-1 px-6 py-3 text-sm font-medium transition-colors",
                activeTab === 'vip-friends'
                  ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              尊贵好友位
            </button>
          </div>
        </Card>

        {activeTab === 'playmates' ? (
          <>
        <Card className="p-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="搜索陪玩姓名、游戏..."
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
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setStatusFilter('pending')}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                      statusFilter === 'pending'
                        ? "bg-yellow-500 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    )}
                  >
                    待审核
                  </button>
                  <button
                    onClick={() => setStatusFilter('verified')}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                      statusFilter === 'verified'
                        ? "bg-green-500 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    )}
                  >
                    已认证
                  </button>
                  <button
                    onClick={() => setStatusFilter('rejected')}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                      statusFilter === 'rejected'
                        ? "bg-red-500 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    )}
                  >
                    已拒绝
                  </button>
                  <button
                    onClick={() => setStatusFilter('')}
                    className={cn(
                      "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                      statusFilter === ''
                        ? "bg-blue-500 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    )}
                  >
                    全部
                  </button>
                </div>
              </div>
            )}
          </div>
        </Card>

        {loading ? (
          <Card className="p-12 text-center">
            <div className="text-slate-500">加载中...</div>
          </Card>
        ) : playmates.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="text-slate-500">暂无数据</div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {playmates.map((playmate) => {
              const playmateStats = stats[playmate.id] || { orderCount: 0, rating: 0 }
              // 调试信息
              if (playmate.status === 'pending') {
                console.log('待审核陪玩:', playmate.id, playmate.status, playmate)
              }
              return (
                <motion.div
                  key={playmate.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className="p-6 hover:shadow-lg transition-shadow relative">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">
                          {playmate.displayName || playmate.name || playmate.email}
                        </h3>
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {playmate.gameName || '未设置'}
                        </p>
                      </div>
                      <span className={cn("px-2 py-1 text-xs font-medium rounded-full", getStatusColor(playmate.status))}>
                        {getStatusText(playmate.status)}
                      </span>
                    </div>
                    
                    {/* 显示申请信息（待审核状态） */}
                    {playmate.status === 'pending' && playmate.application && (
                      <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <div className="space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600 dark:text-slate-400">真实姓名</span>
                            <span className="font-medium text-slate-900 dark:text-white">{playmate.application.realName}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600 dark:text-slate-400">手机号</span>
                            <span className="font-medium text-slate-900 dark:text-white">{playmate.application.phoneNumber}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600 dark:text-slate-400">游戏ID</span>
                            <span className="font-medium text-slate-900 dark:text-white">{playmate.application.gameId || '未填写'}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-600 dark:text-slate-400">游戏水平</span>
                            <span className="font-medium text-slate-900 dark:text-white">{playmate.application.skillLevel || '未填写'}</span>
                          </div>
                          {playmate.application.gameExperience && (
                            <div className="mt-2 pt-2 border-t border-yellow-200 dark:border-yellow-800">
                              <span className="text-slate-600 dark:text-slate-400 text-xs">游戏经历：</span>
                              <p className="text-slate-900 dark:text-white text-xs mt-1">{playmate.application.gameExperience}</p>
                            </div>
                          )}
                          {playmate.application.profileDesc && (
                            <div className="mt-2 pt-2 border-t border-yellow-200 dark:border-yellow-800">
                              <span className="text-slate-600 dark:text-slate-400 text-xs">个人简介：</span>
                              <p className="text-slate-900 dark:text-white text-xs mt-1">{playmate.application.profileDesc}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">技能等级</span>
                        <span className="font-medium text-slate-900 dark:text-white">
                          {playmate.application?.skillLevel || playmate.skillLevel || '未设置'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">评分</span>
                        <div className="flex items-center gap-1">
                          <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                          <span className="font-medium text-slate-900 dark:text-white">
                            {playmateStats.rating > 0 ? playmateStats.rating.toFixed(1) : playmate.rating?.toFixed(1) || '0.0'}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">订单数</span>
                        <span className="font-medium text-slate-900 dark:text-white">
                          {playmateStats.orderCount > 0 ? playmateStats.orderCount : playmate.orderCount || 0}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-4 border-t border-slate-200 dark:border-slate-800 relative z-10">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        fullWidth
                        onClick={(e) => {
                          e.stopPropagation()
                          handleViewDetail(playmate)
                        }}
                        disabled={loadingDetail}
                      >
                        查看详情
                      </Button>
                      {(playmate.status === 'pending' || !playmate.status) && (
                        <>
                          <Button 
                            variant="primary" 
                            size="sm" 
                            fullWidth 
                            leftIcon={<CheckCircle className="w-4 h-4" />}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              console.log('点击通过按钮:', playmate.id, playmate.status)
                              handleApprove(playmate.id)
                            }}
                          >
                            通过
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            fullWidth 
                            leftIcon={<XCircle className="w-4 h-4" />} 
                            className="text-red-600"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              console.log('点击拒绝按钮:', playmate.id, playmate.status)
                              handleReject(playmate.id)
                            }}
                          >
                            拒绝
                          </Button>
                        </>
                      )}
                    </div>
                  </Card>
                </motion.div>
              )
            })}
          </div>
        )}
          </>
        ) : (
          <>
            {/* 尊贵好友位管理 */}
            <Card className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">尊贵好友位列表</h3>
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus className="w-4 h-4" />}
                  onClick={handleOpenAddVIPModal}
                >
                  添加好友位
                </Button>
              </div>

              {loadingVIPFriends ? (
                <div className="text-center py-12 text-slate-500">加载中...</div>
              ) : vipFriends.length === 0 ? (
                <div className="text-center py-12 text-slate-500">暂无尊贵好友位</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {vipFriends.map((vip) => (
                    <motion.div
                      key={vip.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                    >
                      <Card className="p-4 hover:shadow-lg transition-shadow">
                        <div className="flex items-center gap-3 mb-3">
                          <div className="relative">
                            <img
                              src={vip.avatar || '/static/default-avatar.png'}
                              alt={vip.userName}
                              className="w-12 h-12 rounded-full border-2 border-yellow-400"
                            />
                            <div className="absolute -top-1 -right-1 bg-yellow-400 rounded-full p-1">
                              <Crown className="w-3 h-3 text-yellow-900" />
                            </div>
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-slate-900 dark:text-white">{vip.userName}</h4>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{vip.userEmail}</p>
                          </div>
                        </div>
                        {vip.gameLevel && (
                          <div className="mb-2">
                            <span className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 rounded">
                              {vip.gameLevel}
                            </span>
                          </div>
                        )}
                        <div className="mb-2">
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            为: {vip.ownerUserName || `用户${vip.ownerUserId}`}
                          </p>
                        </div>
                        <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-700">
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            排序: {vip.sortOrder}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            leftIcon={<Trash2 className="w-4 h-4" />}
                            className="text-red-600"
                            onClick={() => handleDeleteVIPFriend(vip.id)}
                          >
                            删除
                          </Button>
                        </div>
                      </Card>
                    </motion.div>
                  ))}
                </div>
              )}
            </Card>
          </>
        )}
      </div>

      {/* 添加尊贵好友位模态框 */}
      <Modal
        isOpen={showAddVIPModal}
        onClose={() => {
          setShowAddVIPModal(false)
          setOwnerUserId('')
          setVipUserId('')
        }}
        title="添加尊贵好友位"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              为哪个用户设置
            </label>
            <select
              value={ownerUserId}
              onChange={(e) => setOwnerUserId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              disabled={loadingUsers}
            >
              <option value="">请选择用户</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName || user.email} (ID: {user.id})
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              选择要为哪个用户设置尊贵好友位
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              设置为尊贵好友位的用户
            </label>
            <select
              value={vipUserId}
              onChange={(e) => setVipUserId(e.target.value ? Number(e.target.value) : '')}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              disabled={loadingUsers}
            >
              <option value="">请选择用户</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName || user.email} (ID: {user.id})
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              选择要设置为尊贵好友位的用户
            </p>
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setShowAddVIPModal(false)
                setOwnerUserId('')
                setVipUserId('')
              }}
            >
              取消
            </Button>
            <Button variant="primary" onClick={handleAddVIPFriend} disabled={loadingUsers}>
              添加
            </Button>
          </div>
        </div>
      </Modal>

      {/* 删除确认对话框 */}
      <ConfirmDialog
        isOpen={deleteVIPConfirm.open}
        onClose={() => setDeleteVIPConfirm({ open: false, id: null })}
        onConfirm={confirmDeleteVIP}
        title="确认删除"
        message="确定要删除这个尊贵好友位吗？"
        variant="warning"
        confirmText="删除"
      />

      <ConfirmDialog
        isOpen={rejectConfirm.open}
        onClose={() => setRejectConfirm({ open: false, id: null, reason: '' })}
        onConfirm={confirmReject}
        title="确认拒绝"
        message={
          <div className="space-y-3">
            <p>确定要拒绝这个陪玩申请吗？</p>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                拒绝原因（可选）
              </label>
              <textarea
                value={rejectConfirm.reason}
                onChange={(e) => setRejectConfirm({ ...rejectConfirm, reason: e.target.value })}
                placeholder="请输入拒绝原因..."
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm resize-none"
                rows={3}
              />
            </div>
          </div>
        }
        variant="warning"
        confirmText="拒绝"
      />

      {/* 陪玩详情模态框 */}
      <Modal isOpen={showDetail} onClose={() => setShowDetail(false)} size="lg" title="陪玩详情">
        {selectedPlaymate && (
          <div className="space-y-6">
            {/* 基本信息 */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">基本信息</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-400">姓名</label>
                  <p className="text-slate-900 dark:text-white mt-1">
                    {selectedPlaymate.displayName || selectedPlaymate.name || selectedPlaymate.email}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-400">邮箱</label>
                  <p className="text-slate-900 dark:text-white mt-1">{selectedPlaymate.email}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-400">状态</label>
                  <p className="mt-1">
                    <span className={cn("px-2 py-1 text-xs font-medium rounded-full", getStatusColor(selectedPlaymate.status))}>
                      {getStatusText(selectedPlaymate.status)}
                    </span>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-400">游戏名称</label>
                  <p className="text-slate-900 dark:text-white mt-1">{selectedPlaymate.gameName || '未设置'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-400">技能等级</label>
                  <p className="text-slate-900 dark:text-white mt-1">
                    {selectedPlaymate.application?.skillLevel || selectedPlaymate.skillLevel || '未设置'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-400">创建时间</label>
                  <p className="text-slate-900 dark:text-white mt-1">
                    {new Date(selectedPlaymate.createdAt).toLocaleString('zh-CN')}
                  </p>
                </div>
              </div>
            </div>

            {/* 申请信息 */}
            {selectedPlaymate.application && (
              <div>
                <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">申请信息</h3>
                <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-slate-600 dark:text-slate-400">真实姓名</label>
                      <p className="text-slate-900 dark:text-white mt-1">{selectedPlaymate.application.realName}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-600 dark:text-slate-400">手机号</label>
                      <p className="text-slate-900 dark:text-white mt-1">{selectedPlaymate.application.phoneNumber}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-600 dark:text-slate-400">游戏ID</label>
                      <p className="text-slate-900 dark:text-white mt-1">
                        {selectedPlaymate.application.gameId || '未填写'}
                      </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-slate-600 dark:text-slate-400">游戏水平</label>
                      <p className="text-slate-900 dark:text-white mt-1">
                        {selectedPlaymate.application.skillLevel || '未填写'}
                      </p>
                    </div>
                  </div>
                  {selectedPlaymate.application.mainGames && (
                    <div>
                      <label className="text-sm font-medium text-slate-600 dark:text-slate-400">擅长游戏</label>
                      <p className="text-slate-900 dark:text-white mt-1">
                        {typeof selectedPlaymate.application.mainGames === 'string' 
                          ? selectedPlaymate.application.mainGames 
                          : JSON.parse(selectedPlaymate.application.mainGames || '[]').join('、')}
                      </p>
                    </div>
                  )}
                  {selectedPlaymate.application.gameExperience && (
                    <div>
                      <label className="text-sm font-medium text-slate-600 dark:text-slate-400">游戏经历</label>
                      <p className="text-slate-900 dark:text-white mt-1 whitespace-pre-wrap">
                        {selectedPlaymate.application.gameExperience}
                      </p>
                    </div>
                  )}
                  {selectedPlaymate.application.profileDesc && (
                    <div>
                      <label className="text-sm font-medium text-slate-600 dark:text-slate-400">个人简介</label>
                      <p className="text-slate-900 dark:text-white mt-1 whitespace-pre-wrap">
                        {selectedPlaymate.application.profileDesc}
                      </p>
                    </div>
                  )}
                  {selectedPlaymate.application.rejectionReason && (
                    <div className="mt-3 pt-3 border-t border-red-200 dark:border-red-800">
                      <label className="text-sm font-medium text-red-600 dark:text-red-400">拒绝原因</label>
                      <p className="text-red-700 dark:text-red-300 mt-1 whitespace-pre-wrap bg-red-50 dark:bg-red-900/20 p-2 rounded">
                        {selectedPlaymate.application.rejectionReason}
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium text-slate-600 dark:text-slate-400">申请时间</label>
                    <p className="text-slate-900 dark:text-white mt-1">
                      {new Date(selectedPlaymate.application.createdAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                  {selectedPlaymate.application.reviewedAt && (
                    <div>
                      <label className="text-sm font-medium text-slate-600 dark:text-slate-400">审核时间</label>
                      <p className="text-slate-900 dark:text-white mt-1">
                        {new Date(selectedPlaymate.application.reviewedAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 统计数据 */}
            <div>
              <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">统计数据</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-400">评分</label>
                  <div className="flex items-center gap-1 mt-1">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="text-slate-900 dark:text-white font-medium">
                      {stats[selectedPlaymate.id]?.rating > 0 
                        ? stats[selectedPlaymate.id].rating.toFixed(1) 
                        : selectedPlaymate.rating?.toFixed(1) || '0.0'}
                    </span>
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-600 dark:text-slate-400">订单数</label>
                  <p className="text-slate-900 dark:text-white mt-1">
                    {stats[selectedPlaymate.id]?.orderCount > 0 
                      ? stats[selectedPlaymate.id].orderCount 
                      : selectedPlaymate.orderCount || 0}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </AdminLayout>
  )
}

export default Playmates

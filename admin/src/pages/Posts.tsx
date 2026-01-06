import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Search, Filter, Eye, Edit2, Trash2, CheckCircle, XCircle, Plus, List, Grid } from 'lucide-react'
import AdminLayout from '@/components/Layout/AdminLayout'
import Card from '@/components/UI/Card'
import Button from '@/components/UI/Button'
import Input from '@/components/UI/Input'
import Modal from '@/components/UI/Modal'
import ConfirmDialog from '@/components/UI/ConfirmDialog'
import { cn } from '@/utils/cn'
import { getPosts, deletePost, approvePost, rejectPost, getPost, Post } from '@/services/adminApi'
import { showAlert } from '@/utils/notification'

type ViewMode = 'list' | 'card'

const Posts = () => {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [page] = useState(1)
  const [pageSize] = useState(20)
  const [viewMode, setViewMode] = useState<ViewMode>('list')
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState({
    status: '',
    isTop: '',
    isHot: '',
    isRecommended: '',
    startDate: '',
    endDate: ''
  })
  const [showDetail, setShowDetail] = useState(false)
  const [selectedPost, setSelectedPost] = useState<Post | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: number | null }>({ open: false, id: null })

  useEffect(() => {
    fetchPosts()
  }, [page, searchQuery, filters])

  const fetchPosts = async () => {
    try {
      setLoading(true)
      const response = await getPosts({
        page,
        pageSize,
        search: searchQuery || undefined,
        status: filters.status || undefined,
        isTop: filters.isTop === 'true' ? true : filters.isTop === 'false' ? false : undefined,
        isHot: filters.isHot === 'true' ? true : filters.isHot === 'false' ? false : undefined,
        isRecommended: filters.isRecommended === 'true' ? true : filters.isRecommended === 'false' ? false : undefined,
        startDate: filters.startDate || undefined,
        endDate: filters.endDate || undefined,
      })
      setPosts(response.list)
    } catch (error) {
      console.error('获取帖子列表失败:', error)
      showAlert('获取帖子列表失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: number) => {
    setDeleteConfirm({ open: true, id })
  }

  const confirmDelete = async () => {
    if (!deleteConfirm.id) return
    try {
      await deletePost(deleteConfirm.id)
      showAlert('删除成功', 'success')
      fetchPosts()
    } catch (error) {
      console.error('删除帖子失败:', error)
      showAlert('删除失败', 'error')
    } finally {
      setDeleteConfirm({ open: false, id: null })
    }
  }

  const handleApprove = async (id: number) => {
    try {
      await approvePost(id)
      showAlert('审核通过', 'success')
      fetchPosts()
    } catch (error) {
      console.error('审核失败:', error)
      showAlert('审核失败', 'error')
    }
  }

  const handleReject = async (id: number) => {
    try {
      await rejectPost(id)
      showAlert('已拒绝', 'success')
      fetchPosts()
    } catch (error) {
      console.error('操作失败:', error)
      showAlert('操作失败', 'error')
    }
  }

  const handleViewDetail = async (id: number) => {
    try {
      const post = await getPost(id)
      setSelectedPost(post)
      setShowDetail(true)
    } catch (error) {
      console.error('获取详情失败:', error)
      showAlert('获取详情失败', 'error')
    }
  }

  const handleEdit = (id: number) => {
    navigate(`/posts/${id}/edit`)
  }

  const handleCreate = () => {
    navigate('/posts/new')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'published':
        return 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-300'
      case 'pending':
        return 'bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300'
      case 'rejected':
        return 'bg-orange-100 dark:bg-orange-900/20 text-orange-800 dark:text-orange-300'
      case 'draft':
        return 'bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300'
      case 'deleted':
        return 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-300'
      default:
        return 'bg-gray-100 dark:bg-gray-900/20 text-gray-800 dark:text-gray-300'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'published':
        return '已发布'
      case 'pending':
        return '待审核'
      case 'rejected':
        return '已拒绝'
      case 'draft':
        return '草稿'
      case 'deleted':
        return '已删除'
      default:
        return status
    }
  }

  return (
    <AdminLayout
      title="帖子管理"
      description="管理系统帖子和内容审核"
    >
      <div className="space-y-6">
        <Card className="p-4">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="搜索帖子标题、作者..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  leftIcon={<Search className="w-4 h-4" />}
                  className="w-full"
                />
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  leftIcon={<Filter className="w-4 h-4" />}
                  onClick={() => setShowFilters(!showFilters)}
                >
                  筛选
                </Button>
                <Button 
                  variant="outline" 
                  leftIcon={viewMode === 'list' ? <Grid className="w-4 h-4" /> : <List className="w-4 h-4" />}
                  onClick={() => setViewMode(viewMode === 'list' ? 'card' : 'list')}
                >
                  {viewMode === 'list' ? '卡片' : '列表'}
                </Button>
                <Button leftIcon={<Plus className="w-4 h-4" />} onClick={handleCreate}>
                  新增
                </Button>
              </div>
            </div>
            {showFilters && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <select
                  value={filters.status}
                  onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                  className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="">全部状态</option>
                  <option value="published">已发布</option>
                  <option value="pending">待审核</option>
                  <option value="rejected">已拒绝</option>
                  <option value="draft">草稿</option>
                  <option value="deleted">已删除</option>
                </select>
                <select
                  value={filters.isTop}
                  onChange={(e) => setFilters({ ...filters, isTop: e.target.value })}
                  className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="">全部置顶</option>
                  <option value="true">置顶</option>
                  <option value="false">不置顶</option>
                </select>
                <select
                  value={filters.isHot}
                  onChange={(e) => setFilters({ ...filters, isHot: e.target.value })}
                  className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="">全部热门</option>
                  <option value="true">热门</option>
                  <option value="false">非热门</option>
                </select>
                <select
                  value={filters.isRecommended}
                  onChange={(e) => setFilters({ ...filters, isRecommended: e.target.value })}
                  className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="">全部推荐</option>
                  <option value="true">推荐</option>
                  <option value="false">不推荐</option>
                </select>
                <Input
                  type="date"
                  placeholder="开始日期"
                  value={filters.startDate}
                  onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  className="w-full"
                />
                <Input
                  type="date"
                  placeholder="结束日期"
                  value={filters.endDate}
                  onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  className="w-full"
                />
              </div>
            )}
          </div>
        </Card>

        {loading ? (
          <Card className="p-12 text-center">
            <div className="text-slate-500">加载中...</div>
          </Card>
        ) : posts.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="text-slate-500">暂无数据</div>
          </Card>
        ) : viewMode === 'list' ? (
          <div className="space-y-4">
            {posts.map((post) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                          {post.title}
                        </h3>
                        <span className={cn("px-2 py-1 text-xs font-medium rounded-full", getStatusColor(post.status))}>
                          {getStatusText(post.status)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400 mb-3">
                        <span>作者: {post.authorName || post.user?.displayName || post.user?.name || post.author || '未知'}</span>
                        <span>浏览: {post.views || post.viewCount || 0}</span>
                        <span>点赞: {post.likes || post.likeCount || 0}</span>
                        <span>{new Date(post.createdAt).toLocaleDateString('zh-CN')}</span>
                      </div>
                      {post.coverImageURL && (
                        <div className="mb-3">
                          <img 
                            src={post.coverImageURL} 
                            alt={post.title}
                            className="w-32 h-32 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
                          />
                        </div>
                      )}
                      {post.topics && post.topics.length > 0 && (
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xs text-slate-500 dark:text-slate-400">话题:</span>
                          {post.topics.map((topic: any) => (
                            <span
                              key={topic.id}
                              className="px-2 py-1 text-xs bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded"
                            >
                              #{topic.title}
                            </span>
                          ))}
                        </div>
                      )}
                      {post.tags && post.tags.length > 0 && (
                        <div className="flex items-center gap-2">
                          {post.tags.map((tag: any) => (
                            <span
                              key={tag.id || tag.name || tag}
                              className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded"
                            >
                              {tag.name || tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        leftIcon={<Eye className="w-4 h-4" />}
                        onClick={() => handleViewDetail(post.id)}
                      >
                        查看
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        leftIcon={<Edit2 className="w-4 h-4" />}
                        onClick={() => handleEdit(post.id)}
                      >
                        编辑
                      </Button>
                      {(post.status === 'pending' || post.status === 'draft') && (
                        <>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            leftIcon={<CheckCircle className="w-4 h-4" />}
                            onClick={() => handleApprove(post.id)}
                            className="text-green-600 hover:text-green-700 dark:text-green-400"
                          >
                            通过
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            leftIcon={<XCircle className="w-4 h-4" />} 
                            className="text-red-600 hover:text-red-700 dark:text-red-400"
                            onClick={() => handleReject(post.id)}
                          >
                            拒绝
                          </Button>
                        </>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<Trash2 className="w-4 h-4" />}
                        className="text-red-600 hover:text-red-700 dark:text-red-400"
                        onClick={() => handleDelete(post.id)}
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {posts.map((post) => (
              <motion.div
                key={post.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Card className="p-4 hover:shadow-lg transition-shadow h-full flex flex-col">
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white flex-1 line-clamp-2">
                      {post.title}
                    </h3>
                    <span className={cn("px-2 py-1 text-xs font-medium rounded-full ml-2 flex-shrink-0", getStatusColor(post.status))}>
                      {getStatusText(post.status)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 mb-3">
                    <span>浏览: {post.views || 0}</span>
                    <span>点赞: {post.likes || 0}</span>
                  </div>
                  {post.tags && post.tags.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap mb-4">
                      {post.tags.slice(0, 3).map((tag: any) => (
                        <span
                          key={tag.id || tag.name || tag}
                          className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded"
                        >
                          {tag.name || tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2 mt-auto pt-4 border-t border-slate-200 dark:border-slate-700">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      leftIcon={<Eye className="w-4 h-4" />}
                      onClick={() => handleViewDetail(post.id)}
                      className="flex-1"
                    >
                      查看
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      leftIcon={<Edit2 className="w-4 h-4" />}
                      onClick={() => handleEdit(post.id)}
                      className="flex-1"
                    >
                      编辑
                    </Button>
                    {(post.status === 'pending' || post.status === 'draft') && (
                      <>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          leftIcon={<CheckCircle className="w-4 h-4" />}
                          onClick={() => handleApprove(post.id)}
                          className="text-green-600 hover:text-green-700 dark:text-green-400"
                        >
                          通过
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          leftIcon={<XCircle className="w-4 h-4" />} 
                          className="text-red-600 hover:text-red-700 dark:text-red-400"
                          onClick={() => handleReject(post.id)}
                        >
                          拒绝
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Trash2 className="w-4 h-4" />}
                      className="text-red-600 hover:text-red-700 dark:text-red-400"
                      onClick={() => handleDelete(post.id)}
                    >
                      删除
                    </Button>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* 详情模态框 */}
        <Modal isOpen={showDetail} onClose={() => setShowDetail(false)} size="lg">
          {selectedPost && (
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <h2 className="text-2xl font-bold">{selectedPost.title}</h2>
                <span className={cn("px-3 py-1 text-sm font-medium rounded-full", getStatusColor(selectedPost.status))}>
                  {getStatusText(selectedPost.status)}
                </span>
              </div>
              <div className="space-y-4">
                <div className="flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                  <span>作者: {selectedPost.authorName || selectedPost.user?.displayName || selectedPost.user?.name || selectedPost.author || '未知'}</span>
                  <span>浏览: {selectedPost.views || selectedPost.viewCount || 0}</span>
                  <span>点赞: {selectedPost.likes || selectedPost.likeCount || 0}</span>
                  <span>{new Date(selectedPost.createdAt).toLocaleString('zh-CN')}</span>
                </div>
                <div className="prose dark:prose-invert max-w-none">
                  <div className="whitespace-pre-wrap">{selectedPost.content}</div>
                </div>
                {(selectedPost.status === 'pending' || selectedPost.status === 'draft') && (
                  <div className="flex items-center gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <Button 
                      leftIcon={<CheckCircle className="w-4 h-4" />}
                      onClick={() => {
                        handleApprove(selectedPost.id)
                        setShowDetail(false)
                      }}
                      className="flex-1"
                    >
                      审核通过
                    </Button>
                    <Button 
                      variant="outline"
                      leftIcon={<XCircle className="w-4 h-4" />} 
                      className="text-red-600 border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex-1"
                      onClick={() => {
                        handleReject(selectedPost.id)
                        setShowDetail(false)
                      }}
                    >
                      拒绝
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </Modal>


        {/* 删除确认对话框 */}
        <ConfirmDialog
          isOpen={deleteConfirm.open}
          onClose={() => setDeleteConfirm({ open: false, id: null })}
          onConfirm={confirmDelete}
          title="确认删除"
          message="确定要删除这个帖子吗？此操作不可恢复。"
          variant="danger"
          confirmText="删除"
        />
      </div>
    </AdminLayout>
  )
}

export default Posts

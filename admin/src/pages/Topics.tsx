import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, Plus, Edit2, Trash2, TrendingUp } from 'lucide-react'
import AdminLayout from '@/components/Layout/AdminLayout'
import Card from '@/components/UI/Card'
import Button from '@/components/UI/Button'
import Input from '@/components/UI/Input'
import Modal from '@/components/UI/Modal'
import ConfirmDialog from '@/components/UI/ConfirmDialog'
import { getTopics, deleteTopic, createTopic, updateTopic, Topic } from '@/services/adminApi'
import { showAlert } from '@/utils/notification'

const Topics = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    coverImage: '',
    isHot: false,
    sortOrder: 0
  })

  useEffect(() => {
    fetchTopics()
  }, [searchQuery])

  const fetchTopics = async () => {
    try {
      setLoading(true)
      const data = await getTopics({
        search: searchQuery || undefined,
      })
      setTopics(data)
    } catch (error) {
      console.error('获取话题列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = () => {
    setFormData({ title: '', description: '', coverImage: '', isHot: false, sortOrder: 0 })
    setSelectedTopic(null)
    setShowCreate(true)
  }

  const handleEdit = (topic: Topic) => {
    setSelectedTopic(topic)
    setFormData({
      title: topic.title,
      description: topic.description || '',
      coverImage: '',
      isHot: topic.isHot,
      sortOrder: topic.sortOrder || 0
    })
    setShowEdit(true)
  }

  const handleSave = async () => {
    if (!formData.title.trim()) {
      showAlert('请输入话题标题', 'error')
      return
    }
    try {
      if (showCreate) {
        await createTopic(formData)
        showAlert('创建成功', 'success')
      } else if (selectedTopic) {
        await updateTopic(selectedTopic.id, formData)
        showAlert('更新成功', 'success')
      }
      fetchTopics()
      setShowCreate(false)
      setShowEdit(false)
      setSelectedTopic(null)
    } catch (error) {
      showAlert(showCreate ? '创建失败' : '更新失败', 'error')
    }
  }

  const [deleteConfirm, setDeleteConfirm] = useState<{ open: boolean; id: number | null }>({ open: false, id: null })

  const handleDelete = async (id: number) => {
    setDeleteConfirm({ open: true, id })
  }

  const confirmDelete = async () => {
    if (!deleteConfirm.id) return
    try {
      await deleteTopic(deleteConfirm.id)
      showAlert('删除成功', 'success')
      fetchTopics()
    } catch (error) {
      console.error('删除话题失败:', error)
      showAlert('删除失败', 'error')
    } finally {
      setDeleteConfirm({ open: false, id: null })
    }
  }

  return (
    <AdminLayout
      title="话题管理"
      description="管理系统话题和讨论区"
      actions={
        <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />} onClick={handleCreate}>
          添加话题
        </Button>
      }
    >
      <div className="space-y-6">
        <Card className="p-4">
          <Input
            placeholder="搜索话题..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-4 h-4" />}
            className="w-full"
          />
        </Card>

        {loading ? (
          <Card className="p-12 text-center">
            <div className="text-slate-500">加载中...</div>
          </Card>
        ) : topics.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="text-slate-500">暂无数据</div>
          </Card>
        ) : (
          <div className="space-y-4">
            {topics.map((topic) => (
              <motion.div
                key={topic.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="p-6 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                          {topic.title}
                        </h3>
                        {topic.isHot && (
                          <span className="px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" />
                            热门
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                        {topic.description || '暂无描述'}
                      </p>
                      <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-500">
                        <span>帖子数: {topic.postCount || 0}</span>
                        <span>排序: {topic.sortOrder || 0}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button variant="ghost" size="sm" leftIcon={<Edit2 className="w-4 h-4" />} onClick={() => handleEdit(topic)}>
                        编辑
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<Trash2 className="w-4 h-4" />}
                        className="text-red-600 hover:text-red-700 dark:text-red-400"
                        onClick={() => handleDelete(topic.id)}
                      >
                        删除
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      {/* 新增/编辑模态框 */}
      <Modal
        isOpen={showCreate || showEdit}
        onClose={() => {
          setShowCreate(false)
          setShowEdit(false)
          setSelectedTopic(null)
        }}
        size="lg"
      >
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-4">{showCreate ? '新增话题' : '编辑话题'}</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">话题标题 <span className="text-red-500">*</span></label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full"
                placeholder="请输入话题标题"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">话题描述</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white min-h-[100px]"
                placeholder="请输入话题描述"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">封面图URL</label>
              <Input
                value={formData.coverImage}
                onChange={(e) => setFormData({ ...formData, coverImage: e.target.value })}
                className="w-full"
                placeholder="请输入封面图URL"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">排序值</label>
              <Input
                type="number"
                value={formData.sortOrder}
                onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
                className="w-full"
                placeholder="请输入排序值"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.isHot}
                  onChange={(e) => setFormData({ ...formData, isHot: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 dark:border-slate-600"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">设为热门话题</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
              <Button variant="outline" onClick={() => {
                setShowCreate(false)
                setShowEdit(false)
                setSelectedTopic(null)
              }}>
                取消
              </Button>
              <Button onClick={handleSave}>
                保存
              </Button>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={deleteConfirm.open}
        onClose={() => setDeleteConfirm({ open: false, id: null })}
        onConfirm={confirmDelete}
        title="确认删除"
        message="确定要删除这个话题吗？此操作不可恢复。"
        variant="danger"
        confirmText="删除"
      />
    </AdminLayout>
  )
}

export default Topics

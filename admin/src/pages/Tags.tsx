import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, Plus, Edit2, Trash2, TrendingUp, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import AdminLayout from '@/components/Layout/AdminLayout'
import Card from '@/components/UI/Card'
import Button from '@/components/UI/Button'
import Input from '@/components/UI/Input'
import Modal from '@/components/UI/Modal'
import ConfirmDialog from '@/components/UI/ConfirmDialog'
import { getTags, deleteTag, createTag, updateTag, Tag } from '@/services/adminApi'
import { showAlert } from '@/utils/notification'

type SortField = 'name' | 'postCount' | 'sortOrder'
type SortOrder = 'asc' | 'desc'

const Tags = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [tags, setTags] = useState<Tag[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [selectedTag, setSelectedTag] = useState<Tag | null>(null)
  const [sortField, setSortField] = useState<SortField>('sortOrder')
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc')
  const [formData, setFormData] = useState({
    name: '',
    isHot: false,
    sortOrder: 0
  })

  useEffect(() => {
    fetchTags()
  }, [searchQuery, sortField, sortOrder])

  const fetchTags = async () => {
    try {
      setLoading(true)
      const data = await getTags({
        search: searchQuery || undefined,
      })
      // 排序
      const sorted = [...data].sort((a, b) => {
        let aVal: any, bVal: any
        switch (sortField) {
          case 'name':
            aVal = a.name
            bVal = b.name
            break
          case 'postCount':
            aVal = a.postCount || 0
            bVal = b.postCount || 0
            break
          case 'sortOrder':
            aVal = a.sortOrder || 0
            bVal = b.sortOrder || 0
            break
        }
        if (sortOrder === 'asc') {
          return aVal > bVal ? 1 : aVal < bVal ? -1 : 0
        } else {
          return aVal < bVal ? 1 : aVal > bVal ? -1 : 0
        }
      })
      setTags(sorted)
    } catch (error) {
      console.error('获取标签列表失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('asc')
    }
  }

  const handleCreate = () => {
    setFormData({ name: '', isHot: false, sortOrder: 0 })
    setSelectedTag(null)
    setShowCreate(true)
  }

  const handleEdit = (tag: Tag) => {
    setSelectedTag(tag)
    setFormData({
      name: tag.name,
      isHot: tag.isHot,
      sortOrder: tag.sortOrder || 0
    })
    setShowEdit(true)
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      showAlert('请输入标签名称', 'error')
      return
    }
    try {
      if (showCreate) {
        await createTag(formData)
        showAlert('创建成功', 'success')
      } else if (selectedTag) {
        await updateTag(selectedTag.id, formData)
        showAlert('更新成功', 'success')
      }
      fetchTags()
      setShowCreate(false)
      setShowEdit(false)
      setSelectedTag(null)
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
      await deleteTag(deleteConfirm.id)
      showAlert('删除成功', 'success')
      fetchTags()
    } catch (error) {
      console.error('删除标签失败:', error)
      showAlert('删除失败', 'error')
    } finally {
      setDeleteConfirm({ open: false, id: null })
    }
  }

  return (
    <AdminLayout
      title="标签管理"
      description="管理系统标签和分类"
      actions={
        <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />} onClick={handleCreate}>
          添加标签
        </Button>
      }
    >
      <div className="space-y-6">
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="搜索标签..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
                className="w-full"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                leftIcon={sortField === 'name' ? (sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />) : <ArrowUpDown className="w-4 h-4" />}
                onClick={() => handleSort('name')}
              >
                按名称
              </Button>
              <Button
                variant="outline"
                size="sm"
                leftIcon={sortField === 'postCount' ? (sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />) : <ArrowUpDown className="w-4 h-4" />}
                onClick={() => handleSort('postCount')}
              >
                按帖子数
              </Button>
              <Button
                variant="outline"
                size="sm"
                leftIcon={sortField === 'sortOrder' ? (sortOrder === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />) : <ArrowUpDown className="w-4 h-4" />}
                onClick={() => handleSort('sortOrder')}
              >
                按排序
              </Button>
            </div>
          </div>
        </Card>

        {loading ? (
          <Card className="p-12 text-center">
            <div className="text-slate-500">加载中...</div>
          </Card>
        ) : tags.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="text-slate-500">暂无数据</div>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {tags.map((tag) => (
              <motion.div
                key={tag.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold text-slate-900 dark:text-white">
                        {tag.name}
                      </span>
                      {tag.isHot && (
                        <span className="px-2 py-0.5 text-xs bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-full flex items-center gap-1">
                          <TrendingUp className="w-3 h-3" />
                          热门
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="sm" leftIcon={<Edit2 className="w-4 h-4" />} onClick={() => handleEdit(tag)} />
                      <Button
                        variant="ghost"
                        size="sm"
                        leftIcon={<Trash2 className="w-4 h-4" />}
                        className="text-red-600 hover:text-red-700 dark:text-red-400"
                        onClick={() => handleDelete(tag.id)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-sm text-slate-600 dark:text-slate-400">
                    <span>帖子数: {tag.postCount || 0}</span>
                    <span>排序: {tag.sortOrder || 0}</span>
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
          setSelectedTag(null)
        }}
      >
        <div className="p-6">
          <h2 className="text-2xl font-bold mb-4">{showCreate ? '新增标签' : '编辑标签'}</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">标签名称 <span className="text-red-500">*</span></label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full"
                placeholder="请输入标签名称"
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
                <span className="text-sm text-slate-700 dark:text-slate-300">设为热门标签</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-700">
              <Button variant="outline" onClick={() => {
                setShowCreate(false)
                setShowEdit(false)
                setSelectedTag(null)
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
        message="确定要删除这个标签吗？此操作不可恢复。"
        variant="danger"
        confirmText="删除"
      />
    </AdminLayout>
  )
}

export default Tags

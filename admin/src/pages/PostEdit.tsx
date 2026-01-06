import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Save, X } from 'lucide-react'
import AdminLayout from '@/components/Layout/AdminLayout'
import Card from '@/components/UI/Card'
import Button from '@/components/UI/Button'
import Input from '@/components/UI/Input'
import FileUpload from '@/components/UI/FileUpload'
import { cn } from '@/utils/cn'
import { getPost, createPost, updatePost, getTags, getTopics, Tag, Topic, uploadImage } from '@/services/adminApi'
import { showAlert } from '@/utils/notification'

const PostEdit = () => {
  const navigate = useNavigate()
  const { id } = useParams<{ id?: string }>()
  const isEdit = !!id

  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [allTopics, setAllTopics] = useState<Topic[]>([])
  const [coverUploadKey, setCoverUploadKey] = useState(0)
  const [imagesUploadKey, setImagesUploadKey] = useState(0)
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    summary: '',
    coverImage: '',
    images: [] as string[],
    tagIds: [] as number[],
    topicIds: [] as number[],
    status: 'published' as 'published' | 'draft' | 'deleted',
    isTop: false,
    isHot: false,
    isRecommended: false
  })

  useEffect(() => {
    fetchTags()
    fetchTopics()
    if (isEdit && id) {
      fetchPost(parseInt(id))
    }
  }, [id, isEdit])

  const fetchTags = async () => {
    try {
      const tags = await getTags()
      setAllTags(tags)
    } catch (error) {
      console.error('获取标签列表失败:', error)
    }
  }

  const fetchTopics = async () => {
    try {
      const topics = await getTopics()
      setAllTopics(topics)
    } catch (error) {
      console.error('获取话题列表失败:', error)
    }
  }

  const fetchPost = async (postId: number) => {
    try {
      setLoading(true)
      const post = await getPost(postId)
      // 解析图片数据
      let images: string[] = []
      if (post.images) {
        if (typeof post.images === 'string') {
          try {
            const parsed = JSON.parse(post.images)
            if (Array.isArray(parsed)) {
              images = parsed.map((img: any) => img.url || img)
            }
          } catch {
            images = [post.images]
          }
        } else if (Array.isArray(post.images)) {
          images = post.images.map((img: any) => img.url || img)
        }
      }
      const tagIds = post.tags && Array.isArray(post.tags) ? post.tags.map((t: any) => t.id || t) : []
      const topicIds = post.topics && Array.isArray(post.topics) ? post.topics.map((t: any) => t.id || t) : []
      console.log('加载的帖子数据:', { tags: post.tags, topics: post.topics, tagIds, topicIds }) // 调试日志
      setFormData({
        title: post.title || '',
        content: post.content || '',
        summary: post.summary || '',
        coverImage: post.coverImage || '',
        images,
        tagIds,
        topicIds,
        status: post.status || 'published',
        isTop: post.isTop || false,
        isHot: post.isHot || false,
        isRecommended: post.isRecommended || false
      })
    } catch (error) {
      console.error('获取文章详情失败:', error)
      showAlert('获取文章详情失败', 'error')
      navigate('/posts')
    } finally {
      setLoading(false)
    }
  }

  const handleCoverImageUpload = async (files: File[]) => {
    if (files.length === 0) return
    try {
      setUploading(true)
      const url = await uploadImage(files[0])
      setFormData({ ...formData, coverImage: url })
      showAlert('封面上传成功', 'success')
      // 重置上传组件
      setCoverUploadKey(prev => prev + 1)
    } catch (error) {
      console.error('封面上传失败:', error)
      showAlert('封面上传失败', 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleImagesUpload = async (files: File[]) => {
    if (files.length === 0) return
    try {
      setUploading(true)
      const uploadPromises = files.map(file => uploadImage(file))
      const urls = await Promise.all(uploadPromises)
      setFormData({ ...formData, images: [...formData.images, ...urls] })
      showAlert('图片上传成功', 'success')
      // 重置上传组件
      setImagesUploadKey(prev => prev + 1)
    } catch (error) {
      console.error('图片上传失败:', error)
      showAlert('图片上传失败', 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveImage = (index: number) => {
    const newImages = formData.images.filter((_, i) => i !== index)
    setFormData({ ...formData, images: newImages })
  }

  const handleSave = async () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      showAlert('请填写标题和内容', 'error')
      return
    }
    try {
      setLoading(true)
      const submitData: any = {
        title: formData.title,
        content: formData.content,
        summary: formData.summary,
        coverImage: formData.coverImage,
        images: formData.images,
        tagIds: formData.tagIds || [],
        topicIds: formData.topicIds || [],
        status: formData.status === 'deleted' ? 'published' : formData.status,
        isTop: formData.isTop,
        isHot: formData.isHot,
        isRecommended: formData.isRecommended
      }
      console.log('提交数据:', submitData) // 调试日志
      if (isEdit && id) {
        await updatePost(parseInt(id), submitData)
        showAlert('更新成功', 'success')
      } else {
        await createPost(submitData)
        showAlert('创建成功', 'success')
      }
      navigate('/posts')
    } catch (error) {
      console.error('保存失败:', error) // 调试日志
      showAlert(isEdit ? '更新失败' : '创建失败', 'error')
    } finally {
      setLoading(false)
    }
  }

  if (loading && isEdit) {
    return (
      <AdminLayout title={isEdit ? '编辑文章' : '新增文章'}>
        <Card className="p-12 text-center">
          <div className="text-slate-500">加载中...</div>
        </Card>
      </AdminLayout>
    )
  }

  return (
    <AdminLayout
      title={isEdit ? '编辑文章' : '新增文章'}
      description={isEdit ? '编辑文章内容和设置' : '创建新的文章'}
    >
      <div className="space-y-6">
        {/* 操作栏 */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              leftIcon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => navigate('/posts')}
            >
              返回列表
            </Button>
            <Button
              leftIcon={<Save className="w-4 h-4" />}
              onClick={handleSave}
              disabled={loading || uploading}
            >
              {loading ? '保存中...' : '保存'}
            </Button>
          </div>
        </Card>

        {/* 表单 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：主要内容 */}
          <div className="lg:col-span-2 space-y-6">
            {/* 标题 */}
            <Card className="p-6">
              <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
                标题 <span className="text-red-500">*</span>
              </label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full"
                placeholder="请输入文章标题"
              />
            </Card>

            {/* 摘要 */}
            <Card className="p-6">
              <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
                摘要
              </label>
              <textarea
                value={formData.summary}
                onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white min-h-[100px]"
                placeholder="请输入文章摘要"
              />
            </Card>

            {/* 内容 */}
            <Card className="p-6">
              <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
                内容 <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white min-h-[400px]"
                placeholder="请输入文章内容"
              />
            </Card>

            {/* 封面图 */}
            <Card className="p-6">
              <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
                封面图
              </label>
              <FileUpload
                key={coverUploadKey}
                accept="image/*"
                multiple={false}
                maxSize={10}
                maxFiles={1}
                onFileSelect={handleCoverImageUpload}
                disabled={uploading}
                label="上传封面图"
              />
              {formData.coverImage && (
                <div className="mt-4">
                  <div className="relative inline-block">
                    <img
                      src={formData.coverImage}
                      alt="封面预览"
                      className="max-w-full h-48 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
                    />
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, coverImage: '' })}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </Card>

            {/* 图片列表 */}
            <Card className="p-6">
              <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
                图片列表
              </label>
              <FileUpload
                key={imagesUploadKey}
                accept="image/*"
                multiple={true}
                maxSize={10}
                maxFiles={9}
                onFileSelect={handleImagesUpload}
                disabled={uploading}
                label="上传图片"
              />
              {formData.images.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-4">
                  {formData.images.map((img, index) => (
                    <div key={index} className="relative">
                      <img
                        src={img}
                        alt={`图片${index + 1}`}
                        className="w-full h-32 object-cover rounded-lg border border-slate-200 dark:border-slate-700"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveImage(index)}
                        className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* 右侧：设置 */}
          <div className="space-y-6">
            {/* 状态和选项 */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">发布设置</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
                    状态
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  >
                    <option value="published">已发布</option>
                    <option value="draft">草稿</option>
                    <option value="deleted">已删除</option>
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    选项
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isTop}
                      onChange={(e) => setFormData({ ...formData, isTop: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-600"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">置顶</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isHot}
                      onChange={(e) => setFormData({ ...formData, isHot: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-600"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">热门</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.isRecommended}
                      onChange={(e) => setFormData({ ...formData, isRecommended: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-300 dark:border-slate-600"
                    />
                    <span className="text-sm text-slate-700 dark:text-slate-300">推荐</span>
                  </label>
                </div>
              </div>
            </Card>

            {/* 标签 */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">标签</h3>
              <div className="flex flex-wrap gap-2">
                {allTags.map(tag => (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => {
                      const tagIds = formData.tagIds.includes(tag.id)
                        ? formData.tagIds.filter(id => id !== tag.id)
                        : [...formData.tagIds, tag.id]
                      setFormData({ ...formData, tagIds })
                    }}
                    className={cn(
                      "px-3 py-1 rounded-full text-sm transition-colors",
                      formData.tagIds.includes(tag.id)
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    )}
                  >
                    {tag.name}
                  </button>
                ))}
              </div>
              {formData.tagIds.length > 0 && (
                <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  已选择 {formData.tagIds.length} 个标签
                </div>
              )}
            </Card>

            {/* 话题 */}
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">话题</h3>
              <div className="flex flex-wrap gap-2">
                {allTopics.map(topic => (
                  <button
                    key={topic.id}
                    type="button"
                    onClick={() => {
                      const topicIds = formData.topicIds.includes(topic.id)
                        ? formData.topicIds.filter(id => id !== topic.id)
                        : [...formData.topicIds, topic.id]
                      setFormData({ ...formData, topicIds })
                    }}
                    className={cn(
                      "px-3 py-1 rounded-full text-sm transition-colors",
                      formData.topicIds.includes(topic.id)
                        ? "bg-purple-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    )}
                  >
                    #{topic.title}
                  </button>
                ))}
              </div>
              {formData.topicIds.length > 0 && (
                <div className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  已选择 {formData.topicIds.length} 个话题
                </div>
              )}
              {allTopics.length === 0 && (
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  暂无话题，请先在话题管理中创建话题
                </div>
              )}
            </Card>
          </div>
        </div>
      </div>
    </AdminLayout>
  )
}

export default PostEdit


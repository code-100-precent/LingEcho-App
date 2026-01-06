import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, Users, UserPlus, UserMinus, Heart, Filter } from 'lucide-react'
import AdminLayout from '@/components/Layout/AdminLayout'
import Card from '@/components/UI/Card'
import Button from '@/components/UI/Button'
import Input from '@/components/UI/Input'
import { getFollows, getFollowers, SocialRelation } from '@/services/adminApi'
import { showAlert } from '@/utils/notification'

const Social = () => {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'follows' | 'followers'>('follows')
  const [data, setData] = useState<SocialRelation[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [pageSize] = useState(20)

  useEffect(() => {
    fetchData()
  }, [activeTab, page, searchQuery])

  const fetchData = async () => {
    try {
      setLoading(true)
      const response = activeTab === 'follows' 
        ? await getFollows({ page, pageSize, search: searchQuery || undefined })
        : await getFollowers({ page, pageSize, search: searchQuery || undefined })
      setData(response.list)
    } catch (error) {
      console.error('获取社交关系失败:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <AdminLayout
      title="社交管理"
      description="管理用户关注和粉丝关系"
    >
      <div className="space-y-6">
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="搜索用户..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
                className="w-full"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={activeTab === 'follows' ? 'primary' : 'outline'}
                onClick={() => setActiveTab('follows')}
              >
                关注关系
              </Button>
              <Button
                variant={activeTab === 'followers' ? 'primary' : 'outline'}
                onClick={() => setActiveTab('followers')}
              >
                粉丝关系
              </Button>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          {loading ? (
            <div className="text-center py-8 text-slate-500">加载中...</div>
          ) : data.length === 0 ? (
            <div className="text-center py-8 text-slate-500">暂无数据</div>
          ) : (
            <div className="space-y-4">
              {data.map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center justify-between p-4 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {(activeTab === 'follows' ? item.followingAvatar : item.followerAvatar) ? (
                      <img 
                        src={activeTab === 'follows' ? item.followingAvatar : item.followerAvatar} 
                        alt={activeTab === 'follows' ? item.followingName : item.followerName}
                        className="w-10 h-10 rounded-full object-cover border border-slate-200 dark:border-slate-700"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white font-medium">
                        {(() => {
                          const name = activeTab === 'follows' ? item.followingName : item.followerName
                          return name && name.length > 0 ? name[0].toUpperCase() : 'U'
                        })()}
                      </div>
                    )}
                    <div className="flex-1">
                      <p className="font-medium text-slate-900 dark:text-white">
                        {activeTab === 'follows' ? (item.followingName || '未知用户') : (item.followerName || '未知用户')}
                      </p>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {activeTab === 'follows' 
                          ? `${item.followerName || '未知'} 关注了 ${item.followingName || '未知'}` 
                          : `${item.followerName || '未知'} 是 ${item.followingName || '未知'} 的粉丝`}
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                        {new Date(item.createdAt).toLocaleString('zh-CN')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      leftIcon={<Users className="w-4 h-4" />}
                      onClick={() => {
                        const userId = activeTab === 'follows' ? item.followingId : item.followerId
                        window.open(`/users/${userId}/edit`, '_blank')
                      }}
                    >
                      查看用户
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
          {data.length > 0 && (
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-sm text-slate-500 dark:text-slate-400">
              <span>共 {data.length} 条记录</span>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  上一页
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setPage(p => p + 1)}
                >
                  下一页
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  )
}

export default Social

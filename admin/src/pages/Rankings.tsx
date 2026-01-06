import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Trophy, Medal, Award, TrendingUp } from 'lucide-react'
import AdminLayout from '@/components/Layout/AdminLayout'
import Card from '@/components/UI/Card'
import { cn } from '@/utils/cn'
import { getRankings, RankingsResponse } from '@/services/adminApi'

const Rankings = () => {
  const [activeTab, setActiveTab] = useState<'playmate' | 'post' | 'user'>('playmate')
  const [rankings, setRankings] = useState<RankingsResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchRankings()
  }, [activeTab])

  const fetchRankings = async () => {
    try {
      setLoading(true)
      const data = await getRankings(activeTab, 10)
      setRankings(data)
    } catch (error) {
      console.error('获取排行榜失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-5 h-5 text-yellow-500" />
    if (rank === 2) return <Medal className="w-5 h-5 text-gray-400" />
    if (rank === 3) return <Award className="w-5 h-5 text-orange-500" />
    return <span className="w-5 h-5 flex items-center justify-center text-slate-400 font-bold">{rank}</span>
  }

  const getValueLabel = () => {
    switch (activeTab) {
      case 'playmate':
        return '评分'
      case 'post':
        return '浏览量'
      case 'user':
        return '积分'
      default:
        return '数值'
    }
  }

  const getRankingsList = () => {
    if (!rankings) return []
    
    switch (activeTab) {
      case 'playmate':
        return rankings.playmate || []
      case 'post':
        return rankings.post || []
      case 'user':
        return rankings.user || []
      default:
        return []
    }
  }

  return (
    <AdminLayout
      title="排行榜"
      description="查看各类排行榜数据"
    >
      <div className="space-y-6">
        {/* 标签切换 */}
        <Card className="p-4">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('playmate')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                activeTab === 'playmate'
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              )}
            >
              陪玩排行
            </button>
            <button
              onClick={() => setActiveTab('post')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                activeTab === 'post'
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              )}
            >
              帖子排行
            </button>
            <button
              onClick={() => setActiveTab('user')}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                activeTab === 'user'
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              )}
            >
              用户排行
            </button>
          </div>
        </Card>

        {/* 排行榜列表 */}
        <Card className="p-6">
          {loading ? (
            <div className="text-center py-8 text-slate-500">加载中...</div>
          ) : getRankingsList().length === 0 ? (
            <div className="text-center py-8 text-slate-500">暂无数据</div>
          ) : (
            <div className="space-y-4">
              {getRankingsList().map((item: any, index: number) => {
                const rank = index + 1
                const value = activeTab === 'playmate' 
                  ? item.rating 
                  : activeTab === 'post' 
                    ? item.viewCount || item.views || 0
                    : 0
                const name = activeTab === 'playmate'
                  ? item.name
                  : activeTab === 'post'
                    ? item.title
                    : item.displayName || item.email || '未知'
                
                return (
                  <motion.div
                    key={item.id || item.userId || index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex items-center gap-4 p-4 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                  >
                    <div className="flex-shrink-0">
                      {getRankIcon(rank)}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-slate-900 dark:text-white">{name}</h4>
                      <div className="flex items-center gap-4 mt-1 text-sm text-slate-600 dark:text-slate-400">
                        <span>{getValueLabel()}: {value}</span>
                        {activeTab === 'playmate' && item.orderCount && (
                          <span>订单数: {item.orderCount}</span>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          )}
        </Card>
      </div>
    </AdminLayout>
  )
}

export default Rankings

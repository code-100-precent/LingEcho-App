import { motion } from 'framer-motion'
import { useMemo, useEffect, useState } from 'react'
import { Users, Activity, ArrowUpRight, ArrowDownRight } from 'lucide-react'
import AdminLayout from '@/components/Layout/AdminLayout'
import Card from '@/components/UI/Card'
import { cn } from '@/utils/cn'
import ReactECharts from 'echarts-for-react'
import { useThemeStore } from '@/stores/themeStore'
import { getDashboardStats, DashboardStats } from '@/services/adminApi'

const StatCard = ({ 
  title, 
  value, 
  change, 
  trend, 
  icon: Icon 
}: { 
  title: string
  value: string | number
  change?: string
  trend?: 'up' | 'down'
  icon: React.ComponentType<{ className?: string }>
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-shadow"
  >
    <div className="flex items-center justify-between">
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
          {title}
        </p>
        <p className="text-2xl font-bold text-slate-900 dark:text-white">
          {value}
        </p>
        {change && (
          <div className={cn(
            "flex items-center gap-1 mt-2 text-sm",
            trend === 'up' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          )}>
            {trend === 'up' ? (
              <ArrowUpRight className="w-4 h-4" />
            ) : (
              <ArrowDownRight className="w-4 h-4" />
            )}
            <span>{change}</span>
          </div>
        )}
      </div>
      <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
        <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
      </div>
    </div>
  </motion.div>
)

const Dashboard = () => {
  const { isDark } = useThemeStore()
  const [statsData, setStatsData] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true)
        const data = await getDashboardStats()
        setStatsData(data)
      } catch (error) {
        console.error('获取统计数据失败:', error)
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  // 深色模式下的文本颜色
  const textColor = isDark ? '#e2e8f0' : '#64748b'
  const axisLineColor = isDark ? '#475569' : '#e2e8f0'
  const splitLineColor = isDark ? '#334155' : '#f1f5f9'

  const stats = useMemo(() => {
    if (!statsData) {
      return [
        { title: '页面访问量 (PV)', value: '0', change: '0%', trend: 'up' as const, icon: Activity },
        { title: '独立访客 (UV)', value: '0', change: '0%', trend: 'up' as const, icon: Users },
        { title: 'API调用次数', value: '0', change: '0%', trend: 'up' as const, icon: Activity },
        { title: '活跃用户', value: '0', change: '0%', trend: 'up' as const, icon: Users },
      ]
    }
    
    // 使用新的数据格式
    const pv = statsData.pv?.today ?? 0
    const pvChange = statsData.pv?.change ?? 0
    const uv = statsData.uv?.today ?? 0
    const uvChange = statsData.uv?.change ?? 0
    const apiCalls = statsData.apiCalls?.today ?? 0
    const apiCallsChange = statsData.apiCalls?.change ?? 0
    const activeUsers = statsData.activeUsers?.today ?? 0
    
    // 兼容旧数据格式
    const totalUsers = statsData.totalUsers ?? 0
    const userGrowth = statsData.userGrowth ?? 0
    
    return [
      {
        title: '页面访问量 (PV)',
        value: pv.toLocaleString(),
        change: `${pvChange >= 0 ? '+' : ''}${pvChange.toFixed(1)}%`,
        trend: pvChange >= 0 ? 'up' as const : 'down' as const,
        icon: Activity,
      },
      {
        title: '独立访客 (UV)',
        value: uv.toLocaleString(),
        change: `${uvChange >= 0 ? '+' : ''}${uvChange.toFixed(1)}%`,
        trend: uvChange >= 0 ? 'up' as const : 'down' as const,
        icon: Users,
      },
      {
        title: 'API调用次数',
        value: apiCalls.toLocaleString(),
        change: `${apiCallsChange >= 0 ? '+' : ''}${apiCallsChange.toFixed(1)}%`,
        trend: apiCallsChange >= 0 ? 'up' as const : 'down' as const,
        icon: Activity,
      },
      {
        title: '活跃用户',
        value: activeUsers > 0 ? activeUsers.toLocaleString() : (totalUsers > 0 ? totalUsers.toLocaleString() : '0'),
        change: userGrowth !== 0 ? `${userGrowth >= 0 ? '+' : ''}${userGrowth.toFixed(1)}%` : '0%',
        trend: (userGrowth >= 0 || activeUsers > 0) ? 'up' as const : 'down' as const,
        icon: Users,
      },
    ]
  }, [statsData])

  // 访问趋势折线图配置 - 展示PV和UV的对比
  const visitTrendOption = useMemo(() => {
    // 如果没有visitTrend数据，使用PV和UV数据创建示例数据
    const visitData = statsData?.visitTrend || []
    const pvData = statsData?.pv ? [statsData.pv.yesterday || 0, statsData.pv.today || 0] : [0, 0]
    const uvData = statsData?.uv ? [statsData.uv.yesterday || 0, statsData.uv.today || 0] : [0, 0]
    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: isDark ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.8)',
        borderColor: 'transparent',
        textStyle: {
          color: '#fff'
        }
      },
      legend: visitData.length === 0 ? {
        data: ['PV (页面访问)', 'UV (独立访客)'],
        textStyle: {
          color: textColor
        },
        top: 10
      } : undefined,
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: visitData.length === 0 ? '15%' : '3%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        boundaryGap: false,
        data: visitData.length > 0 
          ? ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
          : ['昨天', '今天'],
        axisLine: {
          lineStyle: {
            color: axisLineColor
          }
        },
        axisLabel: {
          color: textColor
        }
      },
      yAxis: {
        type: 'value',
        axisLine: {
          lineStyle: {
            color: axisLineColor
          }
        },
        axisLabel: {
          color: textColor
        },
        splitLine: {
          lineStyle: {
            color: splitLineColor
          }
        }
      },
      series: visitData.length > 0 ? [
        {
          name: '访问量',
          type: 'line',
          smooth: true,
          data: visitData,
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
                { offset: 1, color: 'rgba(59, 130, 246, 0.05)' }
              ]
            }
          },
          lineStyle: {
            color: '#3b82f6',
            width: 3
          },
          itemStyle: {
            color: '#3b82f6'
          }
        }
      ] : [
        {
          name: 'PV (页面访问)',
          type: 'line',
          smooth: true,
          data: pvData,
          lineStyle: {
            color: '#3b82f6',
            width: 3
          },
          itemStyle: {
            color: '#3b82f6'
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
                { offset: 1, color: 'rgba(59, 130, 246, 0.05)' }
              ]
            }
          }
        },
        {
          name: 'UV (独立访客)',
          type: 'line',
          smooth: true,
          data: uvData,
          lineStyle: {
            color: '#10b981',
            width: 3
          },
          itemStyle: {
            color: '#10b981'
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(16, 185, 129, 0.3)' },
                { offset: 1, color: 'rgba(16, 185, 129, 0.05)' }
              ]
            }
          }
        }
      ]
    }
  }, [isDark, textColor, axisLineColor, splitLineColor, statsData])

  // 用户分布饼图配置
  const userDistributionOption = useMemo(() => ({
    tooltip: {
      trigger: 'item',
      backgroundColor: isDark ? 'rgba(0, 0, 0, 0.9)' : 'rgba(0, 0, 0, 0.8)',
      borderColor: 'transparent',
      textStyle: {
        color: '#fff'
      }
    },
    legend: {
      orient: 'vertical',
      left: 'left',
      textStyle: {
        color: textColor
      }
    },
    series: [
      {
        name: '用户分布',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        itemStyle: {
          borderRadius: 10,
          borderColor: '#fff',
          borderWidth: 2
        },
        label: {
          show: true,
          color: '#64748b'
        },
        emphasis: {
          label: {
            show: true,
            fontSize: 16,
            fontWeight: 'bold'
          }
        },
        data: (statsData?.userDistribution || []).map(item => ({
          value: item.value,
          name: item.name,
          itemStyle: { 
            color: item.name === '普通用户' ? '#3b82f6' :
                   item.name === 'VIP用户' ? '#10b981' : '#f59e0b'
          }
        }))
      }
    ]
  }), [isDark, textColor, statsData])


  return (
    <AdminLayout
      title="仪表板"
      description="查看系统概览和关键指标"
    >
      <div className="space-y-6 animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <StatCard {...stat} />
            </motion.div>
          ))}
        </div>

        {/* 图表区域 - 第一行 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              访问趋势
            </h3>
            <ReactECharts
              option={visitTrendOption}
              style={{ height: '300px', width: '100%' }}
              opts={{ renderer: 'svg' }}
            />
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              用户分布
            </h3>
            <ReactECharts
              option={userDistributionOption}
              style={{ height: '300px', width: '100%' }}
              opts={{ renderer: 'svg' }}
            />
          </Card>
        </div>


        {/* 最近活动 */}
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
            最近活动
          </h3>
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8 text-slate-500">加载中...</div>
            ) : statsData?.recentActivities && statsData.recentActivities.length > 0 ? (
              statsData.recentActivities.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-4 p-4 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">
                      {item.title}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {new Date(item.createdAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-500">暂无活动</div>
            )}
          </div>
        </Card>
      </div>
    </AdminLayout>
  )
}

export default Dashboard

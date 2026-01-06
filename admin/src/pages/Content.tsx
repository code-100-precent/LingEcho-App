import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, Search, Filter, Edit2, Trash2, Eye } from 'lucide-react'
import AdminLayout from '@/components/Layout/AdminLayout'
import Card from '@/components/UI/Card'
import Button from '@/components/UI/Button'
import Input from '@/components/UI/Input'

const Content = () => {
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <AdminLayout
      title="内容管理"
      description="管理系统内容和文章"
      actions={
        <Button variant="primary" leftIcon={<Plus className="w-4 h-4" />}>
          创建内容
        </Button>
      }
    >
      <div className="space-y-6">
        {/* 搜索和筛选 */}
        <Card className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="搜索内容..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                leftIcon={<Search className="w-4 h-4" />}
                className="w-full"
              />
            </div>
            <Button variant="outline" leftIcon={<Filter className="w-4 h-4" />}>
              筛选
            </Button>
          </div>
        </Card>

        {/* 内容列表 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <motion.div
              key={item}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: item * 0.1 }}
            >
              <Card className="p-6 hover:shadow-lg transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                      内容标题 {item}
                    </h3>
                    <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2">
                      这是内容的描述信息，可以显示多行文本内容...
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-700">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    2024-01-{15 + item}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" leftIcon={<Eye className="w-4 h-4" />}>
                      查看
                    </Button>
                    <Button variant="ghost" size="sm" leftIcon={<Edit2 className="w-4 h-4" />}>
                      编辑
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      leftIcon={<Trash2 className="w-4 h-4" />}
                      className="text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                    >
                      删除
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </AdminLayout>
  )
}

export default Content


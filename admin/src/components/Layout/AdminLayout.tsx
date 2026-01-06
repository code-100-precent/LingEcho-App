import { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import AdminSidebar from './AdminSidebar'
import { Bell, Search, Moon, Sun, Settings } from 'lucide-react'
import { useThemeStore } from '@/stores/themeStore'
import Button from '../UI/Button'
import { cn } from '@/utils/cn'

interface AdminLayoutProps {
  children: ReactNode
  title?: string
  description?: string
  actions?: ReactNode
}

const AdminLayout = ({ children, title, description, actions }: AdminLayoutProps) => {
  const { toggleMode, isDark } = useThemeStore()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <AdminSidebar />
      
      {/* 主内容区 */}
      <div className="lg:ml-[280px]">
        {/* 顶部导航栏 */}
        <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-800/50 shadow-sm">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              {/* 左侧：Logo、标题和描述 */}
              <div className="flex items-center gap-4 flex-1 min-w-0">
                {/* 移动端显示Logo */}
                <div className="lg:hidden flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg">
                    <img 
                      src="/logo.png" 
                      alt="Logo" 
                      className="w-6 h-6 object-contain"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement
                        target.style.display = 'none'
                        const parent = target.parentElement
                        if (parent) {
                          parent.innerHTML = '<svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>'
                        }
                      }}
                    />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  {title && (
                    <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
                      {title}
                    </h1>
                  )}
                  {description && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                      {description}
                    </p>
                  )}
                </div>
              </div>

              {/* 右侧：操作按钮 */}
              <div className="flex items-center gap-2">
                {/* 搜索按钮 */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden sm:flex"
                  leftIcon={<Search className="w-4 h-4" />}
                >
                  搜索
                </Button>

                {/* 通知按钮 */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="relative"
                  leftIcon={<Bell className="w-4 h-4" />}
                  onClick={() => navigate('/notifications')}
                >
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                </Button>

                {/* 主题切换 */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={toggleMode}
                  leftIcon={isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                />

                {/* 设置按钮 */}
                <Button
                  variant="ghost"
                  size="sm"
                  leftIcon={<Settings className="w-4 h-4" />}
                  onClick={() => navigate('/settings')}
                />

                {/* 自定义操作 */}
                {actions}
              </div>
            </div>
          </div>
        </header>

        {/* 页面内容 */}
        <main className="px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  )
}

export default AdminLayout


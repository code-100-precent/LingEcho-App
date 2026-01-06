import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Home, 
  Info, 
  Component, 
  Settings,
  ChevronLeft,
  ChevronRight,
  Bot,
  User as UserIcon,
  LogOut,
  Bell,
  BookOpen, // 加入文档图标
  Key, // 新增密钥图标
} from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import AuthModal from '../Auth/AuthModal'
import Button from '../UI/Button'

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const location = useLocation()
  const { user, isAuthenticated, logout } = useAuthStore()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const navigate = useNavigate()

  const navigation = [
    { name: '首页', href: '/', icon: Home },
    { name: '智能助手', href: '/voice-assistant', icon: Bot },
    { name: '音色训练', href: '/voice-training', icon: Settings },
    { name: '通知中心', href: '/notification', icon: Bell},
    { name: 'JS模板', href: '/js-templates', icon: Component },
    { name: '文档', href: '/docs', icon: BookOpen },
    { name: '关于', href: '/about', icon: Info },
  ]

  const publicNavs = ['首页','文档','关于']
  // 受保护页面名称
  const privateNavs = ['智能助手','音色训练','拨号管理','文件管理','通知中心','JS模板']

  const isActive = (path: string) => location.pathname === path

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 72 : 192 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="hidden lg:flex flex-col bg-background border-r border-border relative"
    >
      {/* 顶部 LOGO 区域 */}
      <div className="h-14 flex items-center border-b border-border px-3 relative">
        {!isCollapsed && (
          <Link to="/" className="flex items-center gap-2">
            <img
              src="https://cetide-1325039295.cos.ap-chengdu.myqcloud.com/folder/icon-192x192.ico"
              alt="LingEcho Logo"
              className="w-6 h-8 rounded"
            />
            <span
              className="relative inline-block text-sm font-extrabold tracking-wider"
            >
              <span className="block text-purple-600">LingEcho</span>
              <span className="absolute inset-0 bg-gradient-to-r from-purple-400 via-violet-400 to-purple-500 bg-clip-text text-transparent pointer-events-none select-none">
                LingEcho
              </span>
            </span>
          </Link>
        )}
        {/* 折叠/展开按钮 - 右侧小按钮，仅保留在折叠时显示按钮 */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute right-2 top-3 inline-flex items-center justify-center w-7 h-7 rounded-full hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title={isCollapsed ? '展开' : '折叠'}
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* 导航 */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navigation.filter(item => {
          if (publicNavs.includes(item.name)) return true;
          if (privateNavs.includes(item.name)) return isAuthenticated;
          return true;
        }).map(item => {
          const Icon = item.icon
          return (
            <Link
              key={item.name}
              to={item.href}
              className={`group relative flex items-center rounded-md font-medium transition-colors ${
                isActive(item.href)
                  ? 'text-foreground bg-accent'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              } ${isCollapsed ? 'justify-center px-2 py-3 hover:bg-accent/50' : 'px-3 py-2'}`}
              title={isCollapsed ? item.name : ''}
            >
              <Icon
                className={`${
                  isCollapsed 
                    ? 'w-5 h-5' 
                    : 'w-4 h-4 mr-3'
                } ${
                  isActive(item.href)
                    ? 'text-foreground'
                    : isCollapsed
                      ? 'text-foreground group-hover:text-foreground'
                      : 'text-muted-foreground group-hover:text-foreground'
                }`}
                style={{ 
                  display: 'block',
                  minWidth: isCollapsed ? '20px' : '16px',
                  minHeight: isCollapsed ? '20px' : '16px'
                }}
              />
              {!isCollapsed && (
                <motion.span
                  initial={false}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.2 }}
                  className="text-sm whitespace-nowrap"
                >
                  {item.name}
                </motion.span>
              )}
              {isActive(item.href) && !isCollapsed && (
                <motion.div
                  layoutId="activeSidebarItem"
                  className="absolute right-0 w-1 h-6 bg-primary rounded-l-full"
                  transition={{ type: 'spring', bounce: 0.2, duration: 0.3 }}
                />
              )}
            </Link>
          )
        })}
      </nav>
      {/* 底部功能区 */}
      <div className="mt-auto p-4 flex flex-col gap-2 relative">
        {/* 通知中心按钮已移除，只保留用户区相关 */}
        <div className="mt-2">
          {isAuthenticated && user ? (
            <div className="relative">
              <button
                className={`flex items-center w-full p-2 rounded hover:bg-accent transition-colors group text-muted-foreground hover:text-foreground ${isCollapsed ? 'justify-center' : ''}`}
                onClick={() => setShowDropdown((open) => !open)}
              >
                <img
                  src={user.avatar || `https://ui-avatars.com/api/?name=${user.displayName || 'U'}&background=0ea5e9&color=fff`}
                  alt={user.displayName}
                  className={`rounded-full ${isCollapsed ? 'w-9 h-9' : 'w-8 h-8 mr-2'}`}
                />
                {!isCollapsed && (
                  <span className="text-sm font-medium truncate max-w-[80px]">{user.displayName}</span>
                )}
              </button>
              {showDropdown && !isCollapsed && (
                <div className="absolute right-0 bottom-12 w-40 bg-popover rounded-md shadow-lg border z-50">
                  <div className="flex flex-col p-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex items-center gap-2 w-full justify-start text-sm px-3 py-2"
                      onClick={() => { setShowDropdown(false); navigate('/profile') }}
                      leftIcon={<UserIcon className="w-4 h-4" />}
                    >
                      个人中心
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex items-center gap-2 w-full justify-start text-sm px-3 py-2"
                      onClick={() => { setShowDropdown(false); navigate('/credential') }}
                      leftIcon={<Key className="w-4 h-4" />}
                    >
                      密钥管理
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex items-center gap-2 w-full justify-start text-sm px-3 py-2"
                      onClick={async () => { setShowDropdown(false); await logout(); }}
                      leftIcon={<LogOut className="w-4 h-4" />}
                    >
                      退出登录
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Button
              variant="primary"
              className="w-full justify-center"
              onClick={() => setShowAuthModal(true)}
              leftIcon={<UserIcon className="w-4 h-4" />}
            >
              {!isCollapsed && '登录 / 注册'}
            </Button>
          )}
          {/* 登录弹窗AuthModal */}
          <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
        </div>
      </div>
    </motion.aside>
  )
}

export default Sidebar
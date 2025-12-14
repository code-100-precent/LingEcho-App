import { useState, useEffect, startTransition } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
// import { Layout } from 'lucide-react'
import {Key, Menu, X, User, LogOut, Bell, BookOpen, Github} from 'lucide-react'
import Button from '../UI/Button'
import EnhancedThemeToggle from '../UI/EnhancedThemeToggle'
import { useAuthStore } from '@/stores/authStore.ts'
import { useNotificationStore } from '@/stores/notificationStore'
import AuthModal from '../Auth/AuthModal'
import { showAlert } from '@/utils/notification'
import { getAvatarUrl, getDefaultAvatarUrl } from '@/utils/avatar'

interface HeaderProps {
  logo?: {
    text?: string
    subtext?: string
    icon?: string
    image?: string
    href?: string
  }
  navigation?: Array<{
    name: string
    href: string
    exact?: boolean
  }>
  showLayoutSwitcher?: boolean
  showThemeToggle?: boolean
  showUserMenu?: boolean
  className?: string
}

const Header = ({
  logo = {
    text: '',
    subtext: '',
    icon: 'H',
    href: '/'
  },
  navigation = [],
  // showLayoutSwitcher = true,
  showThemeToggle = true,
  showUserMenu = true,
  className = ''
}: HeaderProps) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [showUserMenuDropdown, setShowUserMenuDropdown] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const location = useLocation()

  const { user, isAuthenticated, logout } = useAuthStore()
  const { unreadCount, fetchUnreadCount} = useNotificationStore()

  const isActive = (path: string, exact: boolean = false) => {
    if (exact) {
      return location.pathname === path
    }
    return location.pathname.startsWith(path) && path !== '/'
  }

  // 获取未读通知数量
  useEffect(() => {
    if (isAuthenticated) {
      startTransition(() => {
        fetchUnreadCount()
      })
      // 每30秒刷新一次未读数量
      const interval = setInterval(() => {
        startTransition(() => {
          fetchUnreadCount()
        })
      }, 30000)
      return () => clearInterval(interval)
    }
  }, [isAuthenticated, fetchUnreadCount])

  // 监听打开登录窗口事件
  useEffect(() => {
    const handleOpenAuthModal = () => {
      setShowAuthModal(true)
    }

    window.addEventListener('openAuthModal', handleOpenAuthModal)
    return () => {
      window.removeEventListener('openAuthModal', handleOpenAuthModal)
    }
  }, [])

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className={`sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 ${className}`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14">
          {/* Logo */}
          <div className="flex items-center space-x-3">
            <Link to={logo.href || '/'} className="flex items-center space-x-3">
              {logo.image ? (
                <img
                  src={logo.image}
                  alt={logo.text}
                  className="w-17 h-6 rounded-md object-cover"
                />
              ) : (
                <div className="w-7 h-7 bg-primary rounded-md flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-sm">{logo.icon}</span>
                </div>
              )}
              <div className="flex flex-col justify-center">
                <span className="text-base font-semibold text-foreground leading-none">
                  {logo.text}
                </span>
                {logo.subtext && (
                  <span className="text-xs text-muted-foreground leading-none">
                    {logo.subtext}
                  </span>
                )}
              </div>
            </Link>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {navigation.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive(item.href, item.exact)
                    ? 'text-foreground bg-accent'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                {item.name}
              </Link>
            ))}
          </nav>

          {/* Right side actions */}
          <div className="flex items-center space-x-1">
            {/* GitHub Link */}
            <a
              href="https://github.com/code-100-precent/LingEcho"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground p-2 rounded-md transition-colors"
              title="GitHub"
            >
              <Github className="w-4 h-4" />
            </a>

            {/* Documentation Link */}
            <a
              href="/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground p-2 rounded-md transition-colors"
              title="文档"
            >
              <BookOpen className="w-4 h-4" />
            </a>
            {/* Theme Toggle */}
            {showThemeToggle && <EnhancedThemeToggle />}

            {/* Notification Bell */}
            {isAuthenticated && (
              <Link to="/notifications">
                <button
                  className="relative p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                  title="通知中心"
                >
                  <Bell className="w-4 h-4" />
                  {unreadCount > 0 && (
                    <div className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full min-w-[16px] h-4 flex items-center justify-center font-medium">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </div>
                  )}
                </button>
              </Link>
            )}

            {/* User Menu or Auth Buttons */}
            {showUserMenu && (
              isAuthenticated ? (
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenuDropdown(!showUserMenuDropdown)}
                    className="flex items-center space-x-2 p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                  >
                    <img
                      src={user?.avatar ? getAvatarUrl(user.avatar) : getDefaultAvatarUrl(user?.displayName || 'User', 24)}
                      alt={user?.displayName}
                      className="w-6 h-6 rounded-full"
                    />
                    <span className="hidden sm:block text-sm font-medium">{user?.displayName}</span>
                  </button>

                  <AnimatePresence>
                    {showUserMenuDropdown && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        transition={{ duration: 0.2 }}
                        className="absolute right-0 top-full mt-2 w-40 bg-popover rounded-md shadow-lg border z-50"
                      >
                        <div className="p-1">
                          <Link
                            to="/profile"
                            className="flex items-center space-x-2 px-3 py-2 rounded-sm hover:bg-accent transition-colors"
                            onClick={() => setShowUserMenuDropdown(false)}
                          >
                            <User className="w-4 h-4"/>
                            <span className="text-sm">个人资料</span>
                          </Link>
                          <Link
                             to="/credential"
                             className="flex items-center space-x-2 px-3 py-2 rounded-sm hover:bg-accent transition-colors"
                             onClick={() => setShowUserMenuDropdown(false)}
                          >
                            <Key className="w-4 h-4"/>
                            <span className="text-sm">密钥管理</span>
                          </Link>
                          <hr className="my-1 border-border"/>
                          <button
                            onClick={() => {
                              logout()
                              setShowUserMenuDropdown(false)
                              showAlert('退出登录成功', 'success', '用户退出登录成功')
                            }}
                            className="flex items-center space-x-2 px-3 py-2 rounded-sm hover:bg-destructive/10 text-destructive transition-colors w-full"
                          >
                            <LogOut className="w-4 h-4"/>
                            <span className="text-sm">退出登录</span>
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowAuthModal(true)}
                >
                  登录/注册
                </Button>
              )
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="md:hidden p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
            >
              {isMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden border-t"
            >
              <div className="py-2 space-y-1">
                {navigation.map((item) => (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setIsMenuOpen(false)}
                    className={`block px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                      isActive(item.href, item.exact)
                        ? 'text-foreground bg-accent'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                  >
                    {item.name}
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modals */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
      />
    </motion.header>
  )
}

export default Header
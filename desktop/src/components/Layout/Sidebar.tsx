import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  Home,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

const Sidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const location = useLocation()

  const navigation = [
    { name: '首页', href: '/', icon: Home },
  ]

  const isActive = (path: string) => location.pathname === path

  return (
    <motion.aside
      initial={false}
      animate={{ width: isCollapsed ? 72 : 192 }}
      transition={{ duration: 0.3, ease: 'easeInOut' }}
      className="hidden lg:flex flex-col bg-background border-r border-border"
    >
      {/* Toggle Button */}
      <div className="p-4 border-b border-border">
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="w-full flex items-center justify-center p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
        >
          {isCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navigation.map((item) => {
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
    </motion.aside>
  )
}

export default Sidebar
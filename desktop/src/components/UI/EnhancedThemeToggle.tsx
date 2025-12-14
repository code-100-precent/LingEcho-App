import { motion } from 'framer-motion'
import { useThemeStore } from '@/stores/themeStore.ts'
import { cn } from '@/utils/cn.ts'
import { 
  Sun, 
  Moon
} from 'lucide-react'

interface EnhancedThemeToggleProps {
  className?: string
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const EnhancedThemeToggle = ({ 
  className = "",
  size = 'md'
}: EnhancedThemeToggleProps) => {
  const { toggleMode, isDark } = useThemeStore()

  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  }

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {/* 主题切换按钮 */}
        <motion.button
          onClick={toggleMode}
          className={cn(
            'relative flex items-center justify-center rounded-lg border border-gray-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md dark:border-gray-700 dark:bg-gray-800',
            sizeClasses[size],
            className
          )}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          title={`切换到${isDark ? '浅色' : '深色'}主题`}
        >
          <motion.div
            className={cn('relative', iconSizes[size])}
            initial={false}
            animate={{ rotate: isDark ? 180 : 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            {/* 太阳图标 */}
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: isDark ? 0 : 1 }}
              animate={{ opacity: isDark ? 0 : 1 }}
              transition={{ duration: 0.2 }}
            >
              <Sun className={cn('text-yellow-500', iconSizes[size])} />
            </motion.div>

            {/* 月亮图标 */}
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: isDark ? 1 : 0 }}
              animate={{ opacity: isDark ? 1 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <Moon className={cn('text-blue-400', iconSizes[size])} />
            </motion.div>
          </motion.div>
        </motion.button>
      </div>
    </div>
  )
}

export default EnhancedThemeToggle
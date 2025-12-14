// 主题适配器 - 统一管理主题样式
export const getThemeColors = () => {
  return {
    primary: 'blue',
    primaryHover: 'blue-700',
    primaryForeground: 'blue-50',
    secondary: 'gray',
    secondaryHover: 'gray-700',
    accent: 'blue-100',
    muted: 'gray-100',
    mutedForeground: 'gray-600',
    border: 'gray-200',
    background: 'white',
    foreground: 'gray-900'
  }
}

// 获取主题相关的CSS类名
export const getThemeClasses = (variant: 'primary' | 'secondary' | 'accent' | 'muted' = 'primary') => {
  const colors = getThemeColors()
  
  const variants = {
    primary: {
      bg: `bg-${colors.primary}`,
      hover: `hover:bg-${colors.primaryHover}`,
      text: `text-${colors.primaryForeground}`,
      border: `border-${colors.primary}`,
      ring: `ring-${colors.primary}`,
      shadow: `shadow-${colors.primary}/20`
    },
    secondary: {
      bg: `bg-${colors.secondary}`,
      hover: `hover:bg-${colors.secondaryHover}`,
      text: `text-${colors.primaryForeground}`,
      border: `border-${colors.secondary}`,
      ring: `ring-${colors.secondary}`,
      shadow: `shadow-${colors.secondary}/20`
    },
    accent: {
      bg: `bg-${colors.accent}`,
      hover: `hover:bg-${colors.primary}`,
      text: `text-${colors.primary}`,
      border: `border-${colors.accent}`,
      ring: `ring-${colors.primary}`,
      shadow: `shadow-${colors.primary}/10`
    },
    muted: {
      bg: `bg-${colors.muted}`,
      hover: `hover:bg-${colors.secondary}`,
      text: `text-${colors.mutedForeground}`,
      border: `border-${colors.border}`,
      ring: `ring-${colors.primary}`,
      shadow: `shadow-${colors.primary}/5`
    }
  }

  return variants[variant]
}

// 获取当前主题
export const getCurrentTheme = (): string => {
  if (typeof window === 'undefined') return 'default'
  
  const html = document.documentElement
  const theme = html.getAttribute('data-theme') || 
                html.classList.contains('dark') ? 'dark' : 'default'
  
  return theme
}

// 获取当前主题模式
export const getCurrentThemeMode = (): 'light' | 'dark' => {
  if (typeof window === 'undefined') return 'light'
  
  const html = document.documentElement
  return html.classList.contains('dark') ? 'dark' : 'light'
}

// 设置主题
export const setTheme = (theme: string) => {
  if (typeof window === 'undefined') return
  
  const html = document.documentElement
  html.setAttribute('data-theme', theme)
  
  // 更新CSS变量
  const colors = getThemeColors()
  Object.entries(colors).forEach(([key, value]) => {
    html.style.setProperty(`--${key}`, value)
  })
}

// 主题感知的样式生成器
export const createThemeAwareStyles = () => {
  const colors = getThemeColors()
  
  return {
    // 按钮样式
    button: {
      primary: `bg-${colors.primary} hover:bg-${colors.primaryHover} text-${colors.primaryForeground} border-${colors.primary} ring-${colors.primary}`,
      secondary: `bg-${colors.secondary} hover:bg-${colors.secondaryHover} text-${colors.primaryForeground} border-${colors.secondary} ring-${colors.secondary}`,
      outline: `border-${colors.border} text-${colors.foreground} hover:bg-${colors.muted} hover:border-${colors.primary}`,
      ghost: `text-${colors.foreground} hover:bg-${colors.muted} hover:text-${colors.primary}`
    },
    
    // 卡片样式
    card: {
      default: `bg-${colors.background} border-${colors.border} text-${colors.foreground}`,
      elevated: `bg-${colors.background} border-${colors.border} shadow-lg hover:shadow-xl`,
      filled: `bg-${colors.muted} border-${colors.border} text-${colors.foreground}`,
      glass: `bg-${colors.background}/80 backdrop-blur-sm border-${colors.border}/20`
    },
    
    // 输入框样式
    input: {
      default: `border-${colors.border} bg-${colors.background} text-${colors.foreground} focus:border-${colors.primary} focus:ring-${colors.primary}`,
      filled: `border-${colors.border} bg-${colors.muted} text-${colors.foreground} focus:border-${colors.primary} focus:ring-${colors.primary}`
    },
    
    // 徽章样式
    badge: {
      primary: `bg-${colors.primary} text-${colors.primaryForeground}`,
      secondary: `bg-${colors.secondary} text-${colors.primaryForeground}`,
      accent: `bg-${colors.accent} text-${colors.primary}`,
      muted: `bg-${colors.muted} text-${colors.mutedForeground}`
    }
  }
}

// 响应式主题切换Hook
export const useTheme = () => {
  const [theme, setThemeState] = useState(getCurrentTheme())
  
  useEffect(() => {
    const handleThemeChange = () => {
      setThemeState(getCurrentTheme())
    }
    
    // 监听主题变化
    const observer = new MutationObserver(handleThemeChange)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class']
    })
    
    return () => observer.disconnect()
  }, [])
  
  const changeTheme = (newTheme: string) => {
    setTheme(newTheme)
    setThemeState(newTheme)
  }
  
  return {
    theme,
    changeTheme,
    colors: getThemeColors(),
    classes: getThemeClasses()
  }
}

// 导入React hooks
import { useState, useEffect } from 'react'
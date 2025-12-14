import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'light' | 'dark' | 'system'

export type Theme = {
  mode: ThemeMode
}

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  setMode: (mode: ThemeMode) => void
  isDark: boolean
  toggleMode: () => void
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: { mode: 'system' },
      isDark: false,
      
      setTheme: (theme: Theme) => {
        set({ theme })
        const isDark = theme.mode === 'dark' || (theme.mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
        set({ isDark })
        
        // 更新 DOM
        updateThemeClasses(theme.mode, isDark)
      },
      
      setMode: (mode: ThemeMode) => {
        const { theme } = get()
        const newTheme = { ...theme, mode }
        get().setTheme(newTheme)
      },
      
      toggleMode: () => {
        const { theme } = get()
        const newMode = theme.mode === 'light' ? 'dark' : 'light'
        get().setMode(newMode)
      },
    }),
    {
      name: 'theme-storage',
      onRehydrateStorage: () => (state) => {
        if (state) {
          const isDark = state.theme.mode === 'dark' || (state.theme.mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
          state.isDark = isDark
          
          updateThemeClasses(state.theme.mode, isDark)
        }
      },
    }
  )
)

// 更新主题类名的辅助函数
function updateThemeClasses(mode: ThemeMode, isDark: boolean) {
  const root = document.documentElement
  
  // 清除所有主题类
  root.classList.remove('dark', 'light')
  
  // 添加模式类
  if (isDark) {
    root.classList.add('dark')
  } else {
    root.classList.add('light')
  }
}
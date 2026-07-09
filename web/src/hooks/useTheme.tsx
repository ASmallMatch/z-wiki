import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export type Theme = 'archive' | 'draft'

const STORAGE_KEY = 'theme'

// 初值读 documentElement.data-theme（index.html 的 FOUC 内联脚本在 React 挂载前已设好），
// 保证 React 状态与 DOM 一致，首屏不二次跳动。
function readTheme(): Theme {
  const attr = document.documentElement.getAttribute('data-theme')
  if (attr === 'draft' || attr === 'archive') return attr
  return 'archive'
}

interface ThemeContextValue {
  theme: Theme
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

// 唯一 theme state 持有者:ThemeToggle 与 Home 等所有 useTheme 消费者共享,
// 避免各自独立 useState 导致切换不同步(BookShelf3D 收不到新 theme 不换皮)。
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(readTheme)

  // 切换时同步 DOM data-theme（驱动 CSS）+ 持久化到 localStorage
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // localStorage 不可用(隐私模式等)时静默降级：仅当前会话生效，不持久化
    }
  }, [theme])

  const toggle = useCallback(() => {
    setTheme((t) => (t === 'archive' ? 'draft' : 'archive'))
  }, [])

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme 必须在 ThemeProvider 内使用')
  return ctx
}

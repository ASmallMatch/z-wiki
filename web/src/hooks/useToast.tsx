import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

// toast 自动消失时长(ms)
const TOAST_DURATION = 2500

interface ToastContextValue {
  show: (msg: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

// 全局 toast:底部居中,主题化(随 Archive/Draft 切换)。单条,新覆盖旧。
// 用于 wikilink 点击指向不存在页时的"该页未在书本中"提示等瞬时反馈。
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const show = useCallback((m: string) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setMsg(m)
    timerRef.current = setTimeout(() => {
      setMsg(null)
      timerRef.current = null
    }, TOAST_DURATION)
  }, [])

  const dismiss = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setMsg(null)
  }, [])

  // 卸载时清定时器,避免 setState on unmounted
  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      {msg && (
        <div className="toast" role="status" onClick={dismiss}>
          {msg}
        </div>
      )}
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast 必须在 ToastProvider 内使用')
  return ctx
}

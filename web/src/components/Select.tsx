import { type KeyboardEvent, useEffect, useRef, useState } from 'react'

/* ═══════════════════════════════════════════════════
   Select — 自定义下拉:替换原生 <select>,让展开列表也走设计 token。
   受控(value/onChange)+ 键盘导航(↑↓ Enter Esc)+ 点击外部关闭 + a11y。
   trigger 复用 .settings-input 样式,与同表单的 input 视觉一致。
   ═══════════════════════════════════════════════════ */

interface Option {
  value: string
  label: string
}

interface SelectProps {
  id: string
  value: string
  options: Option[]
  onChange: (value: string) => void
  ariaLabel?: string
}

export default function Select({ id, value, options, onChange, ariaLabel }: SelectProps) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listboxId = `${id}-listbox`
  const selected = options.find((o) => o.value === value)

  // 打开时把 active 指到当前选中项
  useEffect(() => {
    if (!open) return
    const idx = options.findIndex((o) => o.value === value)
    setActive(idx >= 0 ? idx : 0)
  }, [open, value, options])

  // 点击外部关闭
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const choose = (v: string) => {
    onChange(v)
    setOpen(false)
  }

  const onKey = (e: KeyboardEvent) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        setOpen(true)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % options.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i - 1 + options.length) % options.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const opt = options[active]
      if (opt) choose(opt.value)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setOpen(false)
    }
  }

  return (
    <div className="settings-select" ref={rootRef}>
      <button
        type="button"
        id={id}
        className="settings-select-trigger settings-input"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onKey}
      >
        <span className="settings-select-value">{selected?.label ?? ''}</span>
        <svg
          className="settings-select-arrow"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div id={listboxId} role="listbox" className="settings-select-list">
          {options.map((o, i) => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={o.value === value}
              className={`settings-select-option ${i === active ? 'active' : ''} ${o.value === value ? 'selected' : ''}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(o.value)}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

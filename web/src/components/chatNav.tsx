import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'

/** 对话区右侧导航:纯函数 + 组件(参照 chatScroll.ts 的抽离做法)。
 *  currentIdx 是 scroll 位置的镜像(视口最靠顶 user 行),非用户选中态。 */

export interface NavState {
  streaming: boolean
  userCount: number
  currentIdx: number
}

/** 视口最靠顶的 user 行索引:第一个 top >= containerTop 的行;
 *  全部已滚出顶部(停在 assistant 长回复中间)-> 最后一条;无 user 行 -> -1。
 *  入参 userRowTops 是各 user 行 getBoundingClientRect().top,containerTop 是滚动容器同坐标系 top。 */
export function computeCurrentIndex(userRowTops: number[], containerTop: number): number {
  if (userRowTops.length === 0) return -1
  for (let i = 0; i < userRowTops.length; i++) {
    if (userRowTops[i] >= containerTop) return i
  }
  return userRowTops.length - 1
}

/** 两按钮 disabled:流式或单条(<=1)-> 双向禁用;否则按 currentIdx 边界。 */
export function navDisabled({ streaming, userCount, currentIdx }: NavState): {
  up: boolean
  down: boolean
} {
  if (streaming || userCount <= 1) return { up: true, down: true }
  return {
    up: currentIdx <= 0,
    down: currentIdx >= userCount - 1,
  }
}

/** 对话区右侧悬浮导航:在 user 消息间上下跳转。
 *  currentIdx 是 scroll 位置的镜像(视口最靠顶 user 行),非用户选中态;
 *  流式期间双按钮灰显;显示与否只看 userCount >= 1。 */
export function ChatNav({
  scrollRef,
  userCount,
  streaming,
}: {
  scrollRef: RefObject<HTMLDivElement | null>
  userCount: number
  streaming: boolean
}) {
  const [currentIdx, setCurrentIdx] = useState(-1)
  const rafRef = useRef<number | null>(null)

  // 视口最靠顶 user 行索引:扫 [data-role="user"] 的视口 top,交纯函数算。
  const recalc = useCallback(() => {
    const container = scrollRef.current
    if (!container) return
    const rows = container.querySelectorAll<HTMLElement>('[data-role="user"]')
    const containerTop = container.getBoundingClientRect().top
    const tops = Array.from(rows, (r) => r.getBoundingClientRect().top)
    setCurrentIdx(computeCurrentIndex(tops, containerTop))
  }, [scrollRef])

  // scroll 时 rAF 节流更新 currentIdx;mount 即算一次。
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const onScroll = () => {
      if (rafRef.current != null) return
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null
        recalc()
      })
    }
    container.addEventListener('scroll', onScroll, { passive: true })
    recalc()
    return () => {
      container.removeEventListener('scroll', onScroll)
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [scrollRef, recalc])

  // 流式结束补算一次:防流式期间未触发 scroll 的边界,确保恢复可用时边界正确。
  useEffect(() => {
    if (!streaming) recalc()
  }, [streaming, recalc])

  if (userCount < 1) return null

  const disabled = navDisabled({ streaming, userCount, currentIdx })

  const go = (target: number) => {
    const container = scrollRef.current
    if (!container) return
    const rows = container.querySelectorAll<HTMLElement>('[data-role="user"]')
    const row = rows[target]
    if (!row) return
    const containerRect = container.getBoundingClientRect()
    const paddingTop = parseFloat(getComputedStyle(container).paddingTop) || 0
    // 目标行顶部贴 container 上 padding 内沿:当前偏移 + (目标相对视口顶 - padding)
    const targetTop =
      container.scrollTop + (row.getBoundingClientRect().top - containerRect.top - paddingTop)
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    container.scrollTo({ top: targetTop, behavior: reduceMotion ? 'auto' : 'smooth' })
  }

  return (
    <div className="chat-nav">
      <button
        type="button"
        className="chat-nav-btn"
        onClick={() => go(currentIdx - 1)}
        disabled={disabled.up}
        aria-label="上一条用户消息"
      >
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m18 15-6-6-6 6" />
        </svg>
      </button>
      <button
        type="button"
        className="chat-nav-btn"
        onClick={() => go(currentIdx + 1)}
        disabled={disabled.down}
        aria-label="下一条用户消息"
      >
        <svg
          aria-hidden="true"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>
    </div>
  )
}

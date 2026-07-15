// useChat 的命令式 switch 向外发的副作用信号(类型化事件 seam)。
// 底层仍是 window.dispatchEvent(保留解耦的生产/消费模型:生产方 useChat 与消费方
// usePages/Settings 在不同子树,Settings 甚至是路由级非始终挂载),但事件名 + payload
// 类型化:rename 或改 payload 形状 -> 编译错误,不再静默断。

/** kb 重建/切库完成:消费方(usePages)重拉 /api/pages。无 payload。 */
export const KB_UPDATED = 'kb-updated' as const

/** ingest 活跃态变化:消费方(Settings)据此禁用切库。 */
export const INGEST_STATE = 'ingest-state' as const
export interface IngestStatePayload {
  active: boolean
}

/** 发 kb-updated 信号(kb 重建或切库后,通知重拉 pages)。 */
export function emitKbUpdated(): void {
  window.dispatchEvent(new CustomEvent(KB_UPDATED))
}

/** 发 ingest-state 信号(ingest 开始/结束/失败时,通知 Settings 切库禁用态)。 */
export function emitIngestState(payload: IngestStatePayload): void {
  window.dispatchEvent(new CustomEvent(INGEST_STATE, { detail: payload }))
}

/** 监听 kb-updated(返回取消监听函数,供 useEffect cleanup 用)。 */
export function onKbUpdated(handler: () => void): () => void {
  window.addEventListener(KB_UPDATED, handler)
  return () => window.removeEventListener(KB_UPDATED, handler)
}

/** 监听 ingest-state(返回取消监听函数)。 */
export function onIngestState(handler: (payload: IngestStatePayload) => void): () => void {
  const listener = (e: Event) => handler((e as CustomEvent<IngestStatePayload>).detail)
  window.addEventListener(INGEST_STATE, listener)
  return () => window.removeEventListener(INGEST_STATE, listener)
}

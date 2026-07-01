import { useState, useRef, useCallback, useEffect } from 'react'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  tool?: string
  error?: boolean
}

interface ServerMsg {
  type: 'text_delta' | 'tool_start' | 'tool_end' | 'done' | 'error' | 'system' | 'kb_updated' | 'ingest_done' | 'ingest_error'
  text?: string
  tool?: string
  error?: boolean
  changed?: number
  total?: number
  raw?: string
}

let counter = 0
const nextId = () => `m${Date.now()}-${counter++}`

export function useChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [streaming, setStreaming] = useState(false)
  const [connected, setConnected] = useState(false)
  const wsRef = useRef<WebSocket | null>(null)
  // 当前正在流式累加的 assistant 消息 id
  const streamingIdRef = useRef<string | null>(null)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${proto}//${window.location.host}/ws`)
    wsRef.current = ws

    ws.onopen = () => setConnected(true)
    ws.onclose = () => {
      setConnected(false)
      // 仅当仍是当前连接时才清空,避免 StrictMode 双挂载下
      // 旧 ws 的异步 onclose 覆盖新 ws 的引用
      if (wsRef.current === ws) wsRef.current = null
    }
    ws.onerror = () => setConnected(false)
    ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data as string) as ServerMsg
      switch (msg.type) {
        case 'text_delta': {
          // 累加到当前 assistant 消息
          setMessages(prev => {
            const id = streamingIdRef.current
            if (!id) return prev
            return prev.map(m => (m.id === id ? { ...m, text: m.text + (msg.text ?? '') } : m))
          })
          break
        }
        case 'tool_start':
          setMessages(prev => [
            ...prev,
            { id: nextId(), role: 'system', text: `调用工具 ${msg.tool}`, tool: msg.tool },
          ])
          break
        case 'tool_end':
          // 工具结束可标记,这里简化为不单独处理
          break
        case 'done':
          streamingIdRef.current = null
          setStreaming(false)
          break
        case 'kb_updated':
          // 知识库已重建,通知 useData 重拉 pages.json
          window.dispatchEvent(new CustomEvent('kb-updated', { detail: msg }))
          break
        case 'ingest_done':
          setMessages(prev => [
            ...prev,
            { id: nextId(), role: 'system', text: `已处理上传文件 ${msg.raw},知识库已更新` },
          ])
          break
        case 'ingest_error':
          setMessages(prev => [
            ...prev,
            { id: nextId(), role: 'system', text: `处理 ${msg.raw} 失败:${msg.text}`, error: true },
          ])
          break
        case 'error':
          setMessages(prev => [
            ...prev,
            { id: nextId(), role: 'system', text: msg.text ?? '未知错误', error: true },
          ])
          setStreaming(false)
          streamingIdRef.current = null
          break
        case 'system':
          // 连接系统消息,忽略
          break
      }
    }
  }, [])

  useEffect(() => {
    connect()
    return () => wsRef.current?.close()
  }, [connect])

  const send = useCallback(
    (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || !wsRef.current || streaming) return
      // 推入用户消息,并预建一条空 assistant 消息用于流式累加
      const assistantId = nextId()
      streamingIdRef.current = assistantId
      setMessages(prev => [
        ...prev,
        { id: nextId(), role: 'user', text: trimmed },
        { id: assistantId, role: 'assistant', text: '' },
      ])
      setStreaming(true)
      wsRef.current.send(JSON.stringify({ text: trimmed }))
    },
    [streaming]
  )

  const upload = useCallback(async (file: File) => {
    if (!file) return
    setMessages(prev => [
      ...prev,
      { id: nextId(), role: 'system', text: `上传 ${file.name} 中…` },
    ])
    const form = new FormData()
    form.append('file', file)
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (!res.ok) {
        setMessages(prev => [
          ...prev,
          { id: nextId(), role: 'system', text: `上传失败:${data.error ?? res.status}`, error: true },
        ])
      } else {
        setMessages(prev => [
          ...prev,
          { id: nextId(), role: 'system', text: `${file.name} 已上传,后台编译中…` },
        ])
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        { id: nextId(), role: 'system', text: `上传出错:${err instanceof Error ? err.message : String(err)}`, error: true },
      ])
    }
  }, [])

  return { messages, streaming, connected, send, upload }
}

import { useState, useRef, useEffect, type KeyboardEvent, type ChangeEvent } from 'react'
import { useChat, type ChatMessage } from '../hooks/useChat'

function MessageBubble({ msg }: { msg: ChatMessage }) {
  if (msg.role === 'system') {
    return (
      <div className={`chat-msg chat-msg-system ${msg.error ? 'chat-msg-error' : ''}`}>
        {msg.error ? '⚠️ ' : '🔧 '}
        {msg.text}
      </div>
    )
  }
  return (
    <div className={`chat-msg chat-msg-${msg.role}`}>
      <div className="chat-role">{msg.role === 'user' ? '我' : '助手'}</div>
      <div className="chat-text">{msg.text || (msg.role === 'assistant' ? '…' : '')}</div>
    </div>
  )
}

interface ChatPanelProps {
  onClose: () => void
}

export default function ChatPanel({ onClose }: ChatPanelProps) {
  const { messages, streaming, connected, send, upload } = useChat()
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) void upload(f)
    e.target.value = ''
  }

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const handleKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const submit = () => {
    if (!input.trim()) return
    send(input)
    setInput('')
  }

  return (
    <div className="chat-panel">
      <div className="chat-drawer-header">
        <span className="chat-status">
          {connected ? '● 已连接' : '○ 未连接'}
        </span>
        <button
          type="button"
          className="chat-drawer-close"
          onClick={onClose}
          aria-label="关闭对话"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>
      <div className="chat-messages" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="chat-empty">向知识库智能体提问,它会按工作流检索 wiki 并回答。</div>
        ) : (
          messages.map(m => <MessageBubble key={m.id} msg={m} />)
        )}
      </div>
      <div className="chat-input-row">
        <textarea
          className="chat-input"
          placeholder={connected ? '输入消息,Enter 发送,Shift+Enter 换行' : '正在连接...'}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKey}
          rows={2}
          disabled={!connected || streaming}
        />
        <input
          ref={fileRef}
          type="file"
          accept=".md"
          onChange={handleFile}
          style={{ display: 'none' }}
        />
        <button
          className="chat-upload"
          onClick={() => fileRef.current?.click()}
          disabled={!connected}
          title="上传 .md 到 raw/,自动编译"
        >
          上传
        </button>
        <button
          className="chat-send"
          onClick={submit}
          disabled={!connected || streaming || !input.trim()}
        >
          {streaming ? '回复中' : '发送'}
        </button>
      </div>
    </div>
  )
}

import { useState, type ReactNode } from 'react'
import { Routes, Route } from 'react-router-dom'
import { usePages } from './hooks/useData'
import Header from './components/Header'
import Home from './components/Home'
import Article from './components/Article'
import Settings from './components/Settings'
import FloatingActions from './components/FloatingActions'
import ChatDrawer from './components/ChatDrawer'

export default function App() {
  const { pages, loading, error } = usePages()
  const [chatOpen, setChatOpen] = useState(false)

  // /settings 路由绕过 pages 的 loading/error 门控(设置页不依赖知识库内容)
  const gate: ReactNode = error ? (
    <div className="app-error">
      <p>无法加载数据: {error}</p>
      <p className="app-error-hint">知识库数据尚未生成,启动 server 后将由 agent 自动构建。</p>
    </div>
  ) : loading ? (
    <div className="loading-state">
      <div className="spinner" />
      <p>加载中...</p>
    </div>
  ) : null

  return (
    <>
      <Header pages={pages} chatOpen={chatOpen} onToggleChat={() => setChatOpen(true)} />
      <main className="app-main">
        <Routes>
          <Route path="/settings" element={<Settings />} />
          <Route path="/" element={gate ?? <Home pages={pages} />} />
          <Route path="/pages/:stem" element={gate ?? <Article pages={pages} />} />
        </Routes>
      </main>
      <FloatingActions />

      <ChatDrawer open={chatOpen} onClose={() => setChatOpen(false)} />
    </>
  )
}

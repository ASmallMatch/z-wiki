import ChatPanel from './ChatPanel'

/* ═══════════════════════════════════════════════════
   ChatDrawer — 右侧半屏对话抽屉
   常驻挂载(保持 ChatPanel 连接/消息/流式状态),用 .open class 控制显隐
   关闭方式:遮罩点击 / 面板内关闭按钮。失焦不关闭。
   ═══════════════════════════════════════════════════ */

interface ChatDrawerProps {
  open: boolean
  onClose: () => void
}

export default function ChatDrawer({ open, onClose }: ChatDrawerProps) {
  return (
    <div className={`chat-drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
      <div className="chat-drawer-overlay" onClick={onClose} />
      <div
        className="chat-drawer-panel"
        onMouseDown={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
      >
        <ChatPanel onClose={onClose} />
      </div>
    </div>
  )
}

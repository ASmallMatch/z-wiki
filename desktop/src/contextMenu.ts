// contextMenu.ts - 右键菜单模板(桌面风格,替代浏览器默认;切片 06)。
// 纯函数构造 MenuItemConstructorOptions[],由 main.ts 的 webContents('context-menu') 弹出。
// role 项(undo/cut/copy/paste 等)由 Electron 按焦点元素自动启用/禁用 + 本地化快捷键;
// back/forward 无 role,按 canGoBack/canGoForward 启用,click 走注入的回调(webContents.goBack/goForward)。
import type { MenuItemConstructorOptions } from 'electron'

export interface ContextMenuParams {
  /** 是否可后退(webContents.navigationHistory.canGoBack)。 */
  canGoBack: boolean
  /** 是否可前进。 */
  canGoForward: boolean
  /** 后退回调(主进程注入 webContents.goBack)。 */
  onBack: () => void
  /** 前进回调。 */
  onForward: () => void
}

/**
 * 构造右键菜单模板。结构(标签/role/separator/enabled)是纯数据,可单测;
 * click 回调由调用方注入(webContents 绑定),不在纯函数内闭包 Electron 对象。
 */
export function buildContextMenuTemplate(params: ContextMenuParams): MenuItemConstructorOptions[] {
  return [
    { role: 'undo', label: '撤销' },
    { role: 'redo', label: '重做' },
    { type: 'separator' },
    { role: 'cut', label: '剪切' },
    { role: 'copy', label: '复制' },
    { role: 'paste', label: '粘贴' },
    { role: 'selectAll', label: '全选' },
    { type: 'separator' },
    { label: '后退', enabled: params.canGoBack, click: params.onBack },
    { label: '前进', enabled: params.canGoForward, click: params.onForward },
    { type: 'separator' },
    { role: 'reload', label: '重新加载' },
    { role: 'toggleDevTools', label: '开发者工具' },
  ]
}

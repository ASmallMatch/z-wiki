// preload.cjs — 渲染进程与主进程之间的桥(contextIsolation 下唯一入口)。
// CommonJS:sandbox 模式下 preload 加载器只支持 require,不支持 ESM import(否则静默不执行)。
// 暴露桌面能力到 window.desktop,前端经此调主进程 IPC,不直接 require 其他 node 模块。
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktop', {
  // 在系统文件管理器中打开 vault 的 kb 目录(只读,不改 fs/config)。
  // 成功返回空串,失败返回错误字符串,前端据此回显。
  openVault: (vaultPath) => ipcRenderer.invoke('vault:open', vaultPath),
})

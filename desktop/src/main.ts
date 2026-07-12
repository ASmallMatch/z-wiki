// main.ts — Electron 主进程:首次启动初始化 + 嵌入 server + 开窗口显示 SPA。
// 切片 04:路径切到 UserDataDir(ADR-0003 D3),首次启动从 bundle 复制 kb_example + 铺放 rg/fd(D4/D8)。
// 依赖方向单向(D9):只 import createServer,不深入 server 内部模块。
import './env.js' // 副作用:必须在 pi SDK import 前设 PI_CODING_AGENT_DIR + PI_OFFLINE(见 env.ts 注释)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from 'electron'
import type { MenuItemConstructorOptions } from 'electron'
import { createServer } from '@z-wiki/server'
import { resolveDesktopPaths } from './paths.js'
import { ensureFirstRun } from './firstRun.js'
import { ensureToolBins } from './toolBins.js'
import { loadWindowBounds, saveWindowBounds } from './windowState.js'

// 应用名:覆盖 Electron 默认"Electron"(macOS 应用菜单/Dock 显示名)。打包后由 Info.plist 接管。
app.setName('z-wiki')

// preload.js 与 main.js 同在 dist/(tsc 编译 ESM,__dirname 用 import.meta.url 推导)。
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const preloadPath = path.join(__dirname, 'preload.cjs')

let interaction: Awaited<ReturnType<typeof createServer>> | null = null
let mainWindow: BrowserWindow | null = null
let configPath = ''

/** 持久化当前窗口尺寸/位置到 config.json(若窗口仍存活)。两条退出路径都调,幂等。 */
function persistWindowBounds(): void {
  if (!mainWindow || mainWindow.isDestroyed()) return
  const [x, y] = mainWindow.getPosition()
  const [width, height] = mainWindow.getSize()
  saveWindowBounds(configPath, { x, y, width, height, maximized: mainWindow.isMaximized() })
}

async function bootstrap(): Promise<void> {
  const paths = resolveDesktopPaths()
  configPath = paths.configPath

  // 首次启动:从 bundle 复制首个 Vault + 写初始 config.json(ADR-0003 D4)。
  ensureFirstRun(paths)
  // 铺放 rg/fd 到 pi 的 getBinDir()(D8),版本不一致才重铺。
  ensureToolBins(paths)

  // 打开 vault 目录(系统文件管理器):前端经 window.desktop.openVault → IPC → shell.openPath。
  // 只读,不改 fs/config。成功返回空串,失败返回错误字符串,前端回显。
  ipcMain.handle('vault:open', (_event, vaultPath: string) => shell.openPath(vaultPath))

  // 弹原生文件夹选择器选 vault 父目录:返回选中路径(取消/窗口未就绪返回空串)。
  ipcMain.handle('dialog:select-vault-path', async () => {
    if (!mainWindow) return ''
    const result = await dialog.showOpenDialog(mainWindow, {
      title: '选择知识库存放目录',
      properties: ['openDirectory', 'createDirectory'],
    })
    if (result.canceled || result.filePaths.length === 0) return ''
    return result.filePaths[0]
  })

  interaction = await createServer({
    kbRoot: paths.kbRoot,
    agentDir: paths.agentDir,
    webDistPath: paths.webDist,
    kbExamplePath: paths.kbExamplePath,
  })

  // listen 随机端口(ADR-0003 D2):port:0 取空闲端口,避免冲突,端口注入 loadURL。
  await interaction.app.listen({ port: 0, host: '127.0.0.1' })
  const address = interaction.app.server.address()
  const port = typeof address === 'object' && address ? address.port : null
  if (!port) throw new Error('server listen 后未拿到端口')
  interaction.log.info({ port }, 'embedded server listening')

  const bounds = loadWindowBounds(paths.configPath)
  // 窗口图标:Windows/Linux 走 BrowserWindow.icon;macOS 开发模式该选项不生效,
  // 用下方 app.dock.setIcon 设 Dock 图标。打包后由 build/icon.icns 接管。
  // 文件不存在则回落默认(Electron logo),不阻塞启动。
  const iconPath = path.join(__dirname, '..', 'build', 'icon.png')
  const iconExists = fs.existsSync(iconPath)
  mainWindow = new BrowserWindow({
    width: bounds?.width ?? 1280,
    height: bounds?.height ?? 800,
    x: bounds?.x,
    y: bounds?.y,
    icon: iconExists ? iconPath : undefined,
    // 隐藏顶部默认菜单栏(File/Edit/View/Window/Help),按 Alt 可临时唤出(保留快捷键可访问性)。
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: preloadPath,
    },
  })
  if (iconExists && process.platform === 'darwin') {
    app.dock?.setIcon(iconPath)
  }
  if (bounds?.maximized) mainWindow.maximize()

  // 诊断:preload 加载/执行失败时 Electron 不打主进程日志,显式监听抓错误。
  mainWindow.webContents.on('preload-error', (_e, p, error) => {
    console.error('[preload-error]', p, error?.message ?? error)
  })

  await mainWindow.loadURL(`http://127.0.0.1:${port}/`)

  // 外链走系统浏览器,不在 app 内导航(桌面习惯;SPA 内部路由不受影响)。
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  // 关窗口按钮路径:close 事件时窗口仍存活,此处持久化(验收:重启后保留)。
  mainWindow.on('close', () => persistWindowBounds())
}

/** 应用菜单:顶层标题中文,子项用 role 保留系统行为与快捷键(role 在中文系统会自动本地化子项标签)。 */
function setAppMenu(): void {
  const template: MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [{ role: 'quit', label: '退出' }],
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
      ],
    },
    {
      label: '视图',
      submenu: [
        { role: 'reload', label: '重新加载' },
        { role: 'forceReload', label: '强制重新加载' },
        { role: 'toggleDevTools', label: '开发者工具' },
        { type: 'separator' },
        { role: 'resetZoom', label: '重置缩放' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
      ],
    },
    {
      label: '窗口',
      submenu: [
        { role: 'minimize', label: '最小化' },
        { role: 'zoom', label: '缩放' },
        { role: 'close', label: '关闭' },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于 z-wiki',
          click: () => {
            if (!mainWindow || mainWindow.isDestroyed()) return
            void dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于 z-wiki',
              message: 'z-wiki',
              detail: `版本 ${app.getVersion()}\nElectron ${process.versions.electron}`,
            })
          },
        },
      ],
    },
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(() => {
  setAppMenu()
  void bootstrap().catch((err) => {
    console.error('desktop bootstrap failed:', err)
    app.quit()
  })
})

let shuttingDown = false

/** 统一退出路径:持久化窗口 + graceful 关 server + app.exit 强制退出。 */
async function shutdown(): Promise<void> {
  if (shuttingDown) return
  shuttingDown = true
  persistWindowBounds()
  if (interaction) {
    try {
      await interaction.app.close()
    } catch (err) {
      console.error('server close error:', err)
    }
  }
  // app.exit 强制退出,兜底 fastify listen socket 阻止进程退出(dev 形态 start() 同问题)。
  app.exit(0)
}

// 关窗口 = 退出 app(ADR-0003 D1:原生窗口天然解决"关窗口=关 app"生命周期,无遗留进程)。
app.on('window-all-closed', () => {
  void shutdown()
})

// Cmd+Q 路径:before-quit 时窗口尚未关闭,先持久化再退出(防 close 事件被 preventDefault 跳过)。
app.on('before-quit', (event) => {
  if (shuttingDown) return
  event.preventDefault()
  void shutdown()
})

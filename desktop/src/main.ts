// main.ts — Electron 主进程:首次启动初始化 + 嵌入 server + 开窗口显示 SPA。
// 切片 04:路径切到 UserDataDir(ADR-0003 D3),首次启动从 bundle 复制 kb_example + 铺放 rg/fd(D4/D8)。
// 依赖方向单向(D9):只 import createServer,不深入 server 内部模块。
import './env.js' // 副作用:必须在 pi SDK import 前设 PI_CODING_AGENT_DIR + PI_OFFLINE(见 env.ts 注释)
import { app, BrowserWindow, shell } from 'electron'
import { createServer } from '@z-wiki/server'
import { resolveDesktopPaths } from './paths.js'
import { ensureFirstRun } from './firstRun.js'
import { ensureToolBins } from './toolBins.js'
import { loadWindowBounds, saveWindowBounds } from './windowState.js'

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

  interaction = await createServer({
    kbRoot: paths.kbRoot,
    agentDir: paths.agentDir,
    webDistPath: paths.webDist,
  })

  // listen 随机端口(ADR-0003 D2):port:0 取空闲端口,避免冲突,端口注入 loadURL。
  await interaction.app.listen({ port: 0, host: '127.0.0.1' })
  const address = interaction.app.server.address()
  const port = typeof address === 'object' && address ? address.port : null
  if (!port) throw new Error('server listen 后未拿到端口')
  interaction.log.info({ port }, 'embedded server listening')

  const bounds = loadWindowBounds(paths.configPath)
  mainWindow = new BrowserWindow({
    width: bounds?.width ?? 1280,
    height: bounds?.height ?? 800,
    x: bounds?.x,
    y: bounds?.y,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
  if (bounds?.maximized) mainWindow.maximize()

  await mainWindow.loadURL(`http://127.0.0.1:${port}/`)

  // 外链走系统浏览器,不在 app 内导航(桌面习惯;SPA 内部路由不受影响)。
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url)
    return { action: 'deny' }
  })

  // 关窗口按钮路径:close 事件时窗口仍存活,此处持久化(验收:重启后保留)。
  mainWindow.on('close', () => persistWindowBounds())
}

app.whenReady().then(() => {
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

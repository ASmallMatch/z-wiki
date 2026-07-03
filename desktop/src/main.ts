// main.ts — Electron 主进程:嵌入 server + 开窗口显示 SPA(ADR-0003 D1/D2/D2.1)。
// 切片 03:dev 形态,复用项目根 .pi/agent + config.json + kb/(切片 04 改传 UserDataDir)。
// 依赖方向单向(D9):只 import createServer,不深入 server 内部模块。
import { app, BrowserWindow, shell } from 'electron'
import path from 'node:path'
import { createServer } from '@z-wiki/server'
import { loadWindowBounds, saveWindowBounds, configPathFor } from './windowState.js'

// 禁用 pi 下载分支(ADR-0003 D8):必须在 buildAgentContext 之前。
// server 顶层模块代码不读 PI_OFFLINE;pi SDK 在 buildAgentContext→ensureTool 时才读,
// 故此赋值在 createServer 调用前即可生效。
process.env.PI_OFFLINE = '1'

interface DesktopPaths {
  kbRoot: string
  agentDir: string
  webDist: string
  configPath: string
}

/**
 * 解析桌面运行路径。切片 03 默认项目根(dev 形态),切片 04 改 UserDataDir 时
 * 覆盖 ZWIKI_* 环境变量即可,无需重构此处(ADR-0003 D3 路径可配)。
 */
function resolveDesktopPaths(): DesktopPaths {
  // app.getAppPath() = desktop/ 目录(electron . 加载点);repoRoot = 上一级。
  const repoRoot = path.resolve(app.getAppPath(), '..')
  const agentDir = process.env.ZWIKI_AGENT_DIR ?? path.join(repoRoot, '.pi/agent')
  const kbRoot = process.env.ZWIKI_KB_ROOT ?? path.join(repoRoot, 'kb')
  const webDist = process.env.ZWIKI_WEB_DIST ?? path.join(repoRoot, 'web/dist')
  return { kbRoot, agentDir, webDist, configPath: configPathFor(agentDir) }
}

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

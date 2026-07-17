// applyPendingBoot.ts — 副作用模块:win 待应用更新(staging)在启动最早时机替换。
// 必须紧跟 env.js 之后、@z-wiki/server import 链之前被 import(ESM 按声明顺序求值):
// 此时 app/node_modules 的 native .node 尚未被本进程 LoadLibrary,win rename 不撞文件锁
// (ADR-0018 后果:win .node 锁定 -> 重启时早期替换;Ticket 06)。top-level await 阻塞
// 后续 import 求值,保证替换完成才加载 server。无 staging 时一次 stat 即返回,零启动开销。
import { app } from 'electron'
import path from 'node:path'
import { applyPendingUpdate } from './updater.js'

// relaunch 后旧进程句柄释放有窗口,rename 撞锁短重试;耗尽则 staging 保留,下次启动再试。
const RETRY_TIMES = 10
const RETRY_INTERVAL_MS = 300

if (app.isPackaged) {
  const userDataDir = app.getPath('userData')
  const stagingDir = path.join(userDataDir, 'update-staging')
  const statePath = path.join(userDataDir, '.update-state.json')
  for (let attempt = 0; attempt <= RETRY_TIMES; attempt++) {
    try {
      await applyPendingUpdate(stagingDir, process.resourcesPath, statePath)
      break
    } catch (err) {
      if (attempt === RETRY_TIMES) console.error('apply pending update failed:', err)
      else await new Promise((resolve) => setTimeout(resolve, RETRY_INTERVAL_MS))
    }
  }
}

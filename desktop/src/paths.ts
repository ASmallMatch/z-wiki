// paths.ts — 桌面运行路径解析(ADR-0003 D3)。
// 切片 04:从切片 03 的"项目根"切到 UserDataDir。所有路径派生自 app.getPath('userData'),
// 不写死。纯函数 + DesktopPaths 接口在 pathUtils.ts(不依赖 electron,可单测);
// 此文件只保留调 electron app 的 resolveDesktopPaths。
import { app } from 'electron'
import path from 'node:path'
import { agentDirFor, binDirFor, kbRootFor, platformArch } from './pathUtils.js'
import type { DesktopPaths } from './pathUtils.js'

export { agentDirFor, binDirFor, kbRootFor, platformArch } from './pathUtils.js'
export type { DesktopPaths } from './pathUtils.js'

/**
 * 解析桌面运行所需全部路径。userData 用 app.getPath(Electron 跨平台可写目录,ADR-0003 D3)。
 * app.getName 在 getPath 前调,统一为 'z-wiki'(避免 package.json name '@z-wiki/desktop' 带斜杠)。
 * app.setName 实际由 env.ts(本文件被 import 前执行)调,此处仅兜底。
 */
export function resolveDesktopPaths(): DesktopPaths {
  const userDataDir = app.getPath('userData')
  const agentDir = agentDirFor(userDataDir)
  const repoRoot = path.resolve(app.getAppPath(), '..')

  // bundle 资源:dev 从仓库根读;prod(app.isPackaged)从 process.resourcesPath 读(切片 06 配 extraResources)。
  const bundleRoot = app.isPackaged ? process.resourcesPath : repoRoot
  return {
    userDataDir,
    kbRoot: kbRootFor(userDataDir),
    agentDir,
    binDir: binDirFor(agentDir),
    webDist: path.join(repoRoot, 'web/dist'),
    configPath: path.join(userDataDir, 'config.json'),
    kbExamplePath: path.join(bundleRoot, 'kb_example'),
    toolBinsPath: path.join(bundleRoot, 'desktop', 'resources', 'bin', platformArch()),
  }
}

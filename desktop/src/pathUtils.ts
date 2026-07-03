// pathUtils.ts — 路径纯函数 + DesktopPaths 接口(不依赖 electron,可在纯 Node 测试用)。
// paths.ts 的 resolveDesktopPaths 调 electron app 取 userData,运行时在 electron 主进程。
import path from 'node:path'

/** 当前平台的 bundle 标识(用于选 rg/fd 二进制目录,切片 06 打包按平台过滤)。 */
export function platformArch(): string {
  return `${process.platform}-${process.arch}`
}

/** UserDataDir 下首个 Vault 的 kb/ 路径(首版单 Vault 放 UserDataDir 下)。 */
export function kbRootFor(userDataDir: string): string {
  return path.join(userDataDir, 'kb')
}

/** UserDataDir 下全局 agent 目录(pi 约定 .pi/agent),含 models.json/sessions/bin。 */
export function agentDirFor(userDataDir: string): string {
  return path.join(userDataDir, '.pi', 'agent')
}

/** pi 的 getBinDir() = <agentDir>/bin,预打进 rg/fd 铺放于此(ADR-0003 D8)。 */
export function binDirFor(agentDir: string): string {
  return path.join(agentDir, 'bin')
}

export interface DesktopPaths {
  userDataDir: string
  kbRoot: string
  agentDir: string
  binDir: string
  webDist: string
  configPath: string
  /** bundle 内 kb_example 路径(dev=仓库根,prod=resourcesPath,切片 06 接)。 */
  kbExamplePath: string
  /** bundle 内 rg/fd 二进制目录(desktop/resources/bin/<platform>-<arch>)。 */
  toolBinsPath: string
}

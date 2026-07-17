// updater.ts - 自建增量更新决策 + 本地状态(ADR-0018 D2)。
// 纯函数 selectUpdatePackage:本地三版本号 + 远程 latest.json -> 该下哪档包。
// .update-state.json 读写:记录已安装的三版本号,供下次比对。
// 不含 IO(下载/覆盖/重启)--Ticket 04 接入。
import fs from 'node:fs/promises'
import path from 'node:path'

/** 本地已安装状态(存 .update-state.json)。platform = process.platform。 */
export interface LocalState {
  appVersion: string
  depsVersion: string
  baselineVersion: string
  platform: string
}

/** 单个包的下载信息。 */
export interface PackageInfo {
  url: string
  sha512: string
  size: number
}

/** 远程 latest.json(ADR-0018 决策 3)。full 按平台 map(Ticket 06 填)。 */
export interface RemoteManifest {
  appVersion: string
  depsVersion: string
  baselineVersion: string
  packages: {
    code?: PackageInfo
    app?: PackageInfo
    full?: Record<string, PackageInfo>
  }
}

/** 更新决策:下哪档包 + 对应包信息。 */
export interface UpdatePlan {
  action: 'none' | 'full' | 'app' | 'code'
  package: PackageInfo | null
}

/**
 * 三档比对从重到轻选包(ADR-0018 D2):
 * - 无变化 -> none
 * - linux:AppImage 只读(D6),任何更新都走完整包
 * - baselineVersion 变(runtime/二进制升级)-> full
 * - depsVersion 变(第三方依赖升级)-> app
 * - appVersion 变(项目代码)-> code
 * full 档 package 选取(按平台 map)在 Ticket 06,此处返回 null。
 */
export function selectUpdatePackage(local: LocalState, remote: RemoteManifest): UpdatePlan {
  const hasUpdate =
    local.appVersion !== remote.appVersion ||
    local.depsVersion !== remote.depsVersion ||
    local.baselineVersion !== remote.baselineVersion
  if (!hasUpdate) return { action: 'none', package: null }

  // linux:AppImage 只读不能覆盖内部(D6),任何更新都下完整 AppImage。
  if (local.platform === 'linux') return { action: 'full', package: null }

  if (local.baselineVersion !== remote.baselineVersion) {
    return { action: 'full', package: null }
  }
  if (local.depsVersion !== remote.depsVersion) {
    return { action: 'app', package: remote.packages.app ?? null }
  }
  if (local.appVersion !== remote.appVersion) {
    return { action: 'code', package: remote.packages.code ?? null }
  }
  return { action: 'none', package: null }
}

/** 读本地 .update-state.json;不存在/解析失败返回 null。 */
export async function readUpdateState(filePath: string): Promise<LocalState | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    return JSON.parse(content) as LocalState
  } catch {
    return null
  }
}

/** 写本地 .update-state.json(原子:tmp + rename)。 */
export async function writeUpdateState(filePath: string, state: LocalState): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true })
  const tmp = `${filePath}.tmp`
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), 'utf-8')
  await fs.rename(tmp, filePath)
}

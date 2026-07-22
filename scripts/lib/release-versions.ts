// release-versions.ts — 发布版本计算共享模块。
// 仅纯函数 + IO 读文件;不处理 stdout/配置/业务逻辑。
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

/** computeVersions 的输入 */
export interface VersionInputs {
  appVersion: string
  electronVersion: string
  rg: string
  fd: string
  pandoc: string
  lockHash: string
}

/** 三版本号(ADR-0018 D2) */
export interface Versions {
  appVersion: string
  depsVersion: string
  baselineVersion: string
}

/** 算三版本号(纯函数) */
export function computeVersions(input: VersionInputs): Versions {
  return {
    appVersion: input.appVersion,
    depsVersion: input.lockHash.slice(0, 12),
    baselineVersion: `e${input.electronVersion}_p${input.pandoc}_r${input.rg}_f${input.fd}`,
  }
}

/** 读 desktop/package.json 的 version + electron 版本。 */
export function readDesktopPkg(repoRoot: string): { version: string; electron: string } {
  const pkg = JSON.parse(readFileSync(path.join(repoRoot, 'desktop', 'package.json'), 'utf-8'))
  return { version: pkg.version, electron: pkg.devDependencies?.electron ?? '' }
}

/** 读工具二进制版本(任一 platformArch 下的 version.json)。 */
export function readToolVersions(repoRoot: string): { rg: string; fd: string; pandoc: string } {
  const binRoot = path.join(repoRoot, 'desktop', 'resources', 'bin')
  const dir = existsSync(binRoot)
    ? readdirSync(binRoot).find((d) => existsSync(path.join(binRoot, d, 'version.json')))
    : undefined
  if (!dir) throw new Error('未找到工具版本:请先跑 tsx scripts/fetch-tool-bins.ts')
  return JSON.parse(readFileSync(path.join(binRoot, dir, 'version.json'), 'utf-8'))
}

/** 读 package-lock.json 取 sha256 hex。 */
export function readLockHash(repoRoot: string): string {
  return createHash('sha256')
    .update(readFileSync(path.join(repoRoot, 'package-lock.json'), 'utf-8'))
    .digest('hex')
}

/** 从 repo 文件计算当前三版本号(IO 聚合)。 */
export function computeCurrentVersions(repoRoot: string): Versions {
  const desktop = readDesktopPkg(repoRoot)
  const tools = readToolVersions(repoRoot)
  const lockHash = readLockHash(repoRoot)
  return computeVersions({
    appVersion: desktop.version,
    electronVersion: desktop.electron,
    rg: tools.rg,
    fd: tools.fd,
    pandoc: tools.pandoc,
    lockHash,
  })
}

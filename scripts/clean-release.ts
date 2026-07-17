// clean-release.ts - 清理 release/:删其他平台完整包,保留当前 arch 完整包 + app/code 包 +
// latest.json + unpacked 缓存(ADR-0018 D7)。
import { readdirSync, readFileSync, rmSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/** 完整包命名:z-wiki-{ver}-{os}-{arch}.{ext}[.blockmap]。os=mac/win/linux,arch=arm64/x64。 */
const COMPLETE_PKG_RE = /^z-wiki-(\d+\.\d+\.\d+)-(mac|win|linux)-(arm64|x64)\./

/** 应用包/代码包命名:z-wiki-{app|code}-{ver}.tar.gz(跨平台,无 os-arch 段)。 */
const TIER_PKG_RE = /^z-wiki-(?:app|code)-(\d+\.\d+\.\d+)\.tar\.gz$/

export interface CleanPlan {
  keep: string[]
  delete: string[]
}

/**
 * 规划清理:只留"当前版本 + 当前 arch"的产物。
 * - 完整包(含 .blockmap):版本或 os-arch 不匹配即删
 * - app/code 档包:版本不匹配即删(跨平台,无需 arch 过滤)
 * - 其余(latest.json、unpacked 目录、builder-debug.yml 等)全保留
 * entries 为 releaseDir 下的名字(相对),纯函数不碰 fs。
 */
export function planCleanRelease(
  entries: string[],
  currentOsArch: string,
  currentVersion: string,
): CleanPlan {
  const keep: string[] = []
  const del: string[] = []
  for (const name of entries) {
    const m = name.match(COMPLETE_PKG_RE)
    if (m) {
      const [, version, os, arch] = m
      if (version === currentVersion && `${os}-${arch}` === currentOsArch) keep.push(name)
      else del.push(name)
      continue
    }
    const tier = name.match(TIER_PKG_RE)
    if (tier) {
      if (tier[1] === currentVersion) keep.push(name)
      else del.push(name)
      continue
    }
    keep.push(name)
  }
  return { keep, delete: del }
}

/** process.platform + process.arch -> 命名用的 os-arch(mac-arm64 / win-x64 / linux-x64)。 */
export function currentOsArch(platform: string, arch: string): string {
  const os = platform === 'darwin' ? 'mac' : platform === 'win32' ? 'win' : 'linux'
  return `${os}-${arch}`
}

// ===== IO main(make clean-release 调) =====

function main(): void {
  const repoRoot = path.resolve(import.meta.dirname, '..')
  const releaseDir = path.join(repoRoot, 'release')
  // 当前版本取 desktop/package.json(与 electron-builder 产物版本同源)
  const version = JSON.parse(readFileSync(path.join(repoRoot, 'desktop', 'package.json'), 'utf-8'))
    .version as string
  const entries = readdirSync(releaseDir)
  const plan = planCleanRelease(entries, currentOsArch(process.platform, process.arch), version)
  for (const name of plan.delete) {
    rmSync(path.join(releaseDir, name), { recursive: true, force: true })
  }
  process.stdout.write(
    `保留 ${plan.keep.length} 项,删除 ${plan.delete.length} 项:\n` +
      (plan.delete.length ? `${plan.delete.map((d) => `  - ${d}`).join('\n')}\n` : '') +
      `release/ 清理完成。\n`,
  )
}

const isMain = process.argv[1] === fileURLToPath(import.meta.url)
if (isMain) main()

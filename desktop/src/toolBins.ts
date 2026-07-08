// toolBins.ts - rg/fd/pandoc 二进制预打进(ADR-0003 D8 + ADR-0007 决策 3)。
// bundle 内 resources/bin/<platform>-<arch>/ 含 rg/fd/pandoc + version.json;
// 启动时检测 <binDir>/.version.json 是否一致 -> 不一致或缺失则重新铺放(支持升级)。
// pi 的 getToolPath 优先查 <agentDir>/bin(= binDir),PI_OFFLINE=1 禁下载,故 rg/fd 必走预打进;
// pandoc 经 spawnHook 注入 binDir 到 PATH(bash 调 pandoc),同样需在此铺放。
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import type { DesktopPaths } from './pathUtils.js'

// 预打进的工具二进制:
// - rg/fd:pi 工具集(AGENT_TOOLS 中 grep->rg / find->fd),pi getToolPath 查 agentDir/bin。
// - pandoc:z-wiki bash 命令(ADR-0007 决策 3),spawnHook 注入 agentDir/bin 到 PATH。
const TOOLS = ['rg', 'fd', 'pandoc'] as const

/** 平台相关二进制名(win 带 .exe,pi getToolPath 同样拼 .exe)。 */
function binaryName(tool: string): string {
  return process.platform === 'win32' ? `${tool}.exe` : tool
}

/** 版本文件名:bundle 用 version.json,目标用 .version.json(隐藏文件,避免污染 bin 目录可视)。 */
const BUNDLE_VERSION_FILE = 'version.json'
const TARGET_VERSION_FILE = '.version.json'

interface ToolVersion {
  rg: string
  fd: string
  pandoc: string
}

/** 读版本 JSON;文件不存在或解析失败返回 null(视为需铺放)。 */
function readVersion(filePath: string): ToolVersion | null {
  if (!existsSync(filePath)) return null
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as ToolVersion
  } catch {
    return null
  }
}

/** 目标 bin 目录下二进制是否齐全。 */
function binariesPresent(binDir: string): boolean {
  return TOOLS.every((t) => existsSync(path.join(binDir, binaryName(t))))
}

/**
 * 判断是否需重新铺放:bundle 版本与目标版本不一致,或目标二进制缺失。
 * bundle 缺失(version.json 没有)-> 抛错(打包/开发期遗漏,失败快)。
 */
export function needsRelayout(toolBinsPath: string, binDir: string): boolean {
  const bundleVersion = readVersion(path.join(toolBinsPath, BUNDLE_VERSION_FILE))
  if (!bundleVersion) {
    throw new Error(
      `bundle 缺少版本文件:${path.join(toolBinsPath, BUNDLE_VERSION_FILE)}\n` +
        '请运行 tsx scripts/fetch-tool-bins.ts 预打进 rg/fd/pandoc 二进制。',
    )
  }
  const targetVersion = readVersion(path.join(binDir, TARGET_VERSION_FILE))
  if (!targetVersion) return true
  if (
    targetVersion.rg !== bundleVersion.rg ||
    targetVersion.fd !== bundleVersion.fd ||
    targetVersion.pandoc !== bundleVersion.pandoc
  )
    return true
  return !binariesPresent(binDir)
}

/** 从 bundle 复制 rg/fd/pandoc 到 binDir + 写目标版本文件 + chmod +x(unix)。 */
export function layoutToolBins(toolBinsPath: string, binDir: string): void {
  mkdirSync(binDir, { recursive: true })
  for (const tool of TOOLS) {
    const src = path.join(toolBinsPath, binaryName(tool))
    if (!existsSync(src)) {
      throw new Error(`bundle 缺少二进制:${src}\n请运行 tsx scripts/fetch-tool-bins.ts 重新打进。`)
    }
    const dest = path.join(binDir, binaryName(tool))
    copyFileSync(src, dest)
    // unix 二进制需可执行权限;cpSync/copyFileSync 不保证保留模式,显式 chmod。
    if (process.platform !== 'win32') chmodSync(dest, 0o755)
  }
  // 写目标版本文件(与 bundle 同内容,供下次启动比对)。
  const bundleVersion = readVersion(path.join(toolBinsPath, BUNDLE_VERSION_FILE))
  const tmp = path.join(binDir, `${TARGET_VERSION_FILE}.tmp`)
  writeFileSync(tmp, JSON.stringify(bundleVersion, null, 2), 'utf-8')
  renameSync(tmp, path.join(binDir, TARGET_VERSION_FILE))
}

/**
 * 启动时编排:版本不一致或缺失则重新铺放;一致则跳过(验收:二次启动不重复复制)。
 * bundle 版本文件缺失时抛错(开发期未跑 fetch 脚本)。
 */
export function ensureToolBins(paths: DesktopPaths): void {
  if (!needsRelayout(paths.toolBinsPath, paths.binDir)) return
  layoutToolBins(paths.toolBinsPath, paths.binDir)
}

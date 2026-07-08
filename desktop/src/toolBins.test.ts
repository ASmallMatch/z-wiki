import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { ensureToolBins, layoutToolBins, needsRelayout } from './toolBins.js'
import type { DesktopPaths } from './pathUtils.js'

// 平台相关二进制名(与 toolBins.ts binaryName 一致)。
const RG = process.platform === 'win32' ? 'rg.exe' : 'rg'
const FD = process.platform === 'win32' ? 'fd.exe' : 'fd'
const PANDOC = process.platform === 'win32' ? 'pandoc.exe' : 'pandoc'

interface Bundle {
  rg: string
  fd: string
  pandoc: string
}

// 造 bundle 目录:rg/fd/pandoc 假二进制(内容标记版本便于区分)+ version.json。
async function makeBundle(bundleDir: string, version: Bundle): Promise<void> {
  await fs.mkdir(bundleDir, { recursive: true })
  await fs.writeFile(path.join(bundleDir, RG), `rg-${version.rg}`, 'utf-8')
  await fs.writeFile(path.join(bundleDir, FD), `fd-${version.fd}`, 'utf-8')
  await fs.writeFile(path.join(bundleDir, PANDOC), `pandoc-${version.pandoc}`, 'utf-8')
  await fs.writeFile(path.join(bundleDir, 'version.json'), JSON.stringify(version), 'utf-8')
}

async function makePaths(
  version: Bundle,
): Promise<{ paths: DesktopPaths; cleanup: () => Promise<void> }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zwiki-toolbins-'))
  const userDataDir = path.join(root, 'userData')
  const bundleDir = path.join(root, 'bundle')
  await makeBundle(bundleDir, version)
  const agentDir = path.join(userDataDir, '.pi/agent')
  const paths: DesktopPaths = {
    userDataDir,
    kbRoot: '',
    agentDir,
    binDir: path.join(agentDir, 'bin'),
    webDist: '',
    configPath: '',
    kbExamplePath: '',
    toolBinsPath: bundleDir,
  }
  return { paths, cleanup: () => fs.rm(root, { recursive: true, force: true }) }
}

test('needsRelayout: 目标无版本文件 -> true(首次需铺放)', async () => {
  const { paths, cleanup } = await makePaths({ rg: '14.1.0', fd: '10.1.0', pandoc: '3.10' })
  try {
    assert.equal(needsRelayout(paths.toolBinsPath, paths.binDir), true)
  } finally {
    await cleanup()
  }
})

test('needsRelayout: 版本一致且二进制齐全 -> false(跳过)', async () => {
  const { paths, cleanup } = await makePaths({ rg: '14.1.0', fd: '10.1.0', pandoc: '3.10' })
  try {
    layoutToolBins(paths.toolBinsPath, paths.binDir)
    assert.equal(needsRelayout(paths.toolBinsPath, paths.binDir), false)
  } finally {
    await cleanup()
  }
})

test('needsRelayout: 版本不一致 -> true(需升级)', async () => {
  const { paths, cleanup } = await makePaths({ rg: '14.1.0', fd: '10.1.0', pandoc: '3.10' })
  try {
    layoutToolBins(paths.toolBinsPath, paths.binDir)
    // bundle 升级 pandoc 版本,目标仍是旧版 -> 需重铺
    await makeBundle(paths.toolBinsPath, { rg: '14.1.0', fd: '10.1.0', pandoc: '3.11' })
    assert.equal(needsRelayout(paths.toolBinsPath, paths.binDir), true)
  } finally {
    await cleanup()
  }
})

test('needsRelayout: 版本一致但二进制缺失 -> true(需重铺)', async () => {
  const { paths, cleanup } = await makePaths({ rg: '14.1.0', fd: '10.1.0', pandoc: '3.10' })
  try {
    layoutToolBins(paths.toolBinsPath, paths.binDir)
    await fs.rm(path.join(paths.binDir, PANDOC))
    assert.equal(needsRelayout(paths.toolBinsPath, paths.binDir), true)
  } finally {
    await cleanup()
  }
})

test('needsRelayout: bundle 缺版本文件 -> 抛错(开发期未跑 fetch 脚本)', async () => {
  const { paths, cleanup } = await makePaths({ rg: '14.1.0', fd: '10.1.0', pandoc: '3.10' })
  try {
    await fs.rm(path.join(paths.toolBinsPath, 'version.json'))
    assert.throws(() => needsRelayout(paths.toolBinsPath, paths.binDir), /bundle 缺少版本文件/)
  } finally {
    await cleanup()
  }
})

test('layoutToolBins: 复制 rg/fd/pandoc + 写 .version.json + unix 二进制可执行', async () => {
  const { paths, cleanup } = await makePaths({ rg: '14.1.0', fd: '10.1.0', pandoc: '3.10' })
  try {
    layoutToolBins(paths.toolBinsPath, paths.binDir)
    assert.ok(existsSync(path.join(paths.binDir, RG)), 'rg 已复制')
    assert.ok(existsSync(path.join(paths.binDir, FD)), 'fd 已复制')
    assert.ok(existsSync(path.join(paths.binDir, PANDOC)), 'pandoc 已复制')
    assert.ok(existsSync(path.join(paths.binDir, '.version.json')), '版本文件已写')
    const v = JSON.parse(
      await fs.readFile(path.join(paths.binDir, '.version.json'), 'utf-8'),
    ) as Bundle
    assert.equal(v.rg, '14.1.0')
    assert.equal(v.fd, '10.1.0')
    assert.equal(v.pandoc, '3.10')

    // unix 二进制必须可执行(pi spawn + bash 调 pandoc 需要 +x)
    if (process.platform !== 'win32') {
      const mode = statSync(path.join(paths.binDir, PANDOC)).mode
      assert.ok(mode & 0o755, 'pandoc 应有可执行权限')
    }
  } finally {
    await cleanup()
  }
})

test('ensureToolBins: 首次铺放 -> 二次(版本一致)跳过不重写', async () => {
  const { paths, cleanup } = await makePaths({ rg: '14.1.0', fd: '10.1.0', pandoc: '3.10' })
  try {
    ensureToolBins(paths)
    assert.ok(existsSync(path.join(paths.binDir, PANDOC)))
    // 记录 mtime,二次启动不应重写
    const mtimeBefore = statSync(path.join(paths.binDir, PANDOC)).mtimeMs
    await new Promise((r) => setTimeout(r, 20))
    ensureToolBins(paths)
    const mtimeAfter = statSync(path.join(paths.binDir, PANDOC)).mtimeMs
    assert.equal(mtimeAfter, mtimeBefore, '版本一致时不得重新复制')
  } finally {
    await cleanup()
  }
})

test('ensureToolBins: 版本升级 -> 重新铺放(内容更新)', async () => {
  const { paths, cleanup } = await makePaths({ rg: '14.1.0', fd: '10.1.0', pandoc: '3.10' })
  try {
    ensureToolBins(paths)
    const before = await fs.readFile(path.join(paths.binDir, PANDOC), 'utf-8')
    assert.match(before, /pandoc-3\.10/)
    // bundle 升级 pandoc
    await makeBundle(paths.toolBinsPath, { rg: '14.1.0', fd: '10.1.0', pandoc: '3.11' })
    ensureToolBins(paths)
    const after = await fs.readFile(path.join(paths.binDir, PANDOC), 'utf-8')
    assert.match(after, /pandoc-3\.11/, '升级后二进制内容已更新')
  } finally {
    await cleanup()
  }
})

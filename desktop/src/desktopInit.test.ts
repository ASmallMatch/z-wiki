// desktopInit.test.ts — 端到端验证桌面首次启动初始化流程。
// 造空 UserDataDir + 真实 bundle(kb_example + rg/fd)→ ensureFirstRun + ensureToolBins +
// createServer → 验证首个 Vault 创建、rg/fd 铺放、server 起来、/api/pages 返回 kb 内容。
// 用动态 import server 确保在 PI_CODING_AGENT_DIR 设好后才加载 pi(否则 TOOLS_DIR 用默认值)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { ensureFirstRun } from './firstRun.js'
import { ensureToolBins } from './toolBins.js'
import { agentDirFor, kbRootFor, platformArch } from './pathUtils.js'
import type { DesktopPaths } from './pathUtils.js'

const REPO_ROOT = path.resolve(import.meta.dirname, '../..')
const REAL_KB_EXAMPLE = path.join(REPO_ROOT, 'kb_example')
const REAL_TOOL_BINS = path.join(REPO_ROOT, 'desktop', 'resources', 'bin', platformArch())

async function makePaths(): Promise<{ paths: DesktopPaths; cleanup: () => Promise<void> }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zwiki-init-'))
  const userDataDir = path.join(root, 'userData')
  const bundleDir = path.join(root, 'bundle')
  await fs.mkdir(userDataDir, { recursive: true })
  await fs.mkdir(bundleDir, { recursive: true })
  // 复制真实 bundle:kb_example + rg/fd(若未跑 fetch 脚本则 skip 整个测试)。
  await fs.cp(REAL_KB_EXAMPLE, path.join(bundleDir, 'kb_example'), { recursive: true })
  await fs.cp(REAL_TOOL_BINS, path.join(bundleDir, 'bin'), { recursive: true })
  const agentDir = agentDirFor(userDataDir)
  const paths: DesktopPaths = {
    userDataDir,
    kbRoot: kbRootFor(userDataDir),
    agentDir,
    binDir: path.join(agentDir, 'bin'),
    webDist: '',
    configPath: path.join(userDataDir, 'config.json'),
    kbExamplePath: path.join(bundleDir, 'kb_example'),
    toolBinsPath: path.join(bundleDir, 'bin'),
  }
  return { paths, cleanup: () => fs.rm(root, { recursive: true, force: true }) }
}

test('桌面首次启动:空 UserDataDir → 首个 Vault + rg/fd + config.json + server 起来', async (t) => {
  if (!existsSync(REAL_TOOL_BINS)) {
    t.skip('未跑 tsx scripts/fetch-tool-bins.ts,跳过端到端验证')
    return
  }
  const { paths, cleanup } = await makePaths()
  // 设 env(必须在 import server 前;createServer 触发 pi 加载,TOOLS_DIR 此时求值)。
  process.env.PI_CODING_AGENT_DIR = paths.agentDir
  process.env.PI_OFFLINE = '1'
  try {
    ensureFirstRun(paths)
    ensureToolBins(paths)

    // 首个 Vault:kb_example 内容已复制
    assert.ok(existsSync(path.join(paths.kbRoot, 'index.md')), 'kb/index.md 已复制')
    assert.ok(existsSync(path.join(paths.kbRoot, 'wiki')), 'kb/wiki 目录已复制')

    // rg/fd 已铺放到 pi 的 getBinDir()
    const rgName = process.platform === 'win32' ? 'rg.exe' : 'rg'
    const fdName = process.platform === 'win32' ? 'fd.exe' : 'fd'
    assert.ok(existsSync(path.join(paths.binDir, rgName)), 'rg 已铺放')
    assert.ok(existsSync(path.join(paths.binDir, fdName)), 'fd 已铺放')
    assert.ok(existsSync(path.join(paths.binDir, '.version.json')), '版本文件已写')

    // config.json 写入(空 apiKey + 默认 provider/model + currentVault)
    const cfg = JSON.parse(await fs.readFile(paths.configPath, 'utf-8')) as Record<string, unknown>
    assert.equal(cfg.provider, 'ark')
    assert.equal(cfg.model, 'ark-code-latest')
    assert.equal(cfg.apiKey, '')
    assert.equal(cfg.currentVault, paths.kbRoot)

    // createServer 成功(空 apiKey 不再阻止 server 起,ADR-0003 决策 4)
    const { createServer } = await import('@z-wiki/server')
    const interaction = await createServer({ kbRoot: paths.kbRoot, agentDir: paths.agentDir })
    try {
      const res = await interaction.app.inject({ method: 'GET', url: '/api/pages' })
      assert.equal(res.statusCode, 200)
      // kb_example/wiki/.gitkeep 无 view:true 文章,pages 为空数组(但 server 正常响应)
      assert.ok(Array.isArray(res.json()), '/api/pages 返回数组')
    } finally {
      await interaction.app.close()
    }
  } finally {
    await cleanup()
  }
})

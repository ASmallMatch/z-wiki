import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import {
  copyKbExample,
  ensureFirstRun,
  initialConfig,
  isFirstRun,
  writeInitialConfig,
} from './firstRun.js'
import type { DesktopPaths } from './pathUtils.js'

// 造一个最小 kb_example 结构(含子目录与文件),验证递归复制。
async function makeKbExample(src: string): Promise<void> {
  await fs.mkdir(path.join(src, 'wiki'), { recursive: true })
  await fs.mkdir(path.join(src, 'raw'), { recursive: true })
  await fs.writeFile(path.join(src, 'index.md'), '# index\n', 'utf-8')
  await fs.writeFile(path.join(src, 'wiki/01-foo.md'), '---\nview: true\n---\n# Foo\n', 'utf-8')
  await fs.writeFile(path.join(src, 'raw/.gitkeep'), '', 'utf-8')
}

// 构造 DesktopPaths 指向临时 userData 目录,kbExamplePath 指向临时 bundle。
async function makePaths(): Promise<{ paths: DesktopPaths; cleanup: () => Promise<void> }> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zwiki-firstrun-'))
  const userDataDir = path.join(root, 'userData')
  const bundleDir = path.join(root, 'bundle')
  await fs.mkdir(userDataDir, { recursive: true })
  await fs.mkdir(bundleDir, { recursive: true })
  await makeKbExample(path.join(bundleDir, 'kb_example'))
  const kbRoot = path.join(userDataDir, 'kb')
  const agentDir = path.join(userDataDir, '.pi/agent')
  const paths: DesktopPaths = {
    userDataDir,
    kbRoot,
    agentDir,
    binDir: path.join(agentDir, 'bin'),
    webDist: '',
    configPath: path.join(userDataDir, 'config.json'),
    kbExamplePath: path.join(bundleDir, 'kb_example'),
    toolBinsPath: '',
  }
  return { paths, cleanup: () => fs.rm(root, { recursive: true, force: true }) }
}

test('isFirstRun: config.json 不存在 → true;存在 → false', async () => {
  const { paths, cleanup } = await makePaths()
  try {
    assert.equal(isFirstRun(paths.configPath), true)
    await fs.writeFile(paths.configPath, '{}', 'utf-8')
    assert.equal(isFirstRun(paths.configPath), false)
  } finally {
    await cleanup()
  }
})

test('initialConfig: 默认 ark + 空 apiKey + currentVault 指向 kbRoot', () => {
  const cfg = initialConfig('/data/kb')
  assert.equal(cfg.provider, 'ark')
  assert.equal(cfg.model, 'ark-code-latest')
  assert.equal(cfg.apiKey, '')
  assert.equal(cfg.currentVault, '/data/kb')
  assert.deepEqual(cfg.vaults, [{ path: '/data/kb', name: '默认' }])
  assert.deepEqual(cfg.preferences, {})
})

test('copyKbExample: 递归复制目录结构(含子目录与 .gitkeep)', async () => {
  const { paths, cleanup } = await makePaths()
  try {
    copyKbExample(paths.kbExamplePath, paths.kbRoot)
    assert.ok(existsSync(path.join(paths.kbRoot, 'index.md')))
    assert.ok(existsSync(path.join(paths.kbRoot, 'wiki/01-foo.md')))
    assert.ok(existsSync(path.join(paths.kbRoot, 'raw/.gitkeep')))
    const body = await fs.readFile(path.join(paths.kbRoot, 'wiki/01-foo.md'), 'utf-8')
    assert.match(body, /# Foo/)
  } finally {
    await cleanup()
  }
})

test('copyKbExample: bundle 缺失 → 失败快(明确报错)', async () => {
  const { paths, cleanup } = await makePaths()
  try {
    assert.throws(
      () => copyKbExample(path.join(paths.userDataDir, 'no-such'), paths.kbRoot),
      /bundle 内 kb_example 不存在/,
    )
  } finally {
    await cleanup()
  }
})

test('writeInitialConfig: 原子写 config.json,内容可被 readConfig 接受', async () => {
  const { paths, cleanup } = await makePaths()
  try {
    writeInitialConfig(paths.configPath, paths.kbRoot)
    const cfg = JSON.parse(await fs.readFile(paths.configPath, 'utf-8')) as Record<string, unknown>
    assert.equal(cfg.provider, 'ark')
    assert.equal(cfg.model, 'ark-code-latest')
    assert.equal(cfg.apiKey, '')
    assert.equal(cfg.currentVault, paths.kbRoot)
    // tmp 文件不应残留(原子写 rename 后清理)
    assert.ok(!existsSync(`${paths.configPath}.tmp`))
  } finally {
    await cleanup()
  }
})

test('ensureFirstRun: 首次启动 → 复制 kb_example + 写 config.json', async () => {
  const { paths, cleanup } = await makePaths()
  try {
    ensureFirstRun(paths)
    assert.ok(existsSync(path.join(paths.kbRoot, 'wiki/01-foo.md')), 'kb 内容已复制')
    assert.ok(existsSync(paths.configPath), 'config.json 已写入')
  } finally {
    await cleanup()
  }
})

test('ensureFirstRun: 二次启动不重复复制(config.json 已存在 → 直接返回)', async () => {
  const { paths, cleanup } = await makePaths()
  try {
    ensureFirstRun(paths)
    // 模拟用户改动 config(如填了 apiKey),二次启动不应覆盖
    const userCfg = JSON.parse(await fs.readFile(paths.configPath, 'utf-8')) as {
      apiKey: string
    }
    userCfg.apiKey = 'user-secret'
    await fs.writeFile(paths.configPath, JSON.stringify(userCfg), 'utf-8')

    ensureFirstRun(paths)
    const after = JSON.parse(await fs.readFile(paths.configPath, 'utf-8')) as { apiKey: string }
    assert.equal(after.apiKey, 'user-secret', '二次启动不得覆盖用户已填的 apiKey')
  } finally {
    await cleanup()
  }
})

import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { loadWindowBounds, saveWindowBounds, configPathFor } from './windowState.js'

async function withConfig(initial: Record<string, unknown>): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'zwiki-win-'))
  const cfgPath = path.join(dir, 'config.json')
  await fs.writeFile(cfgPath, JSON.stringify(initial), 'utf-8')
  return cfgPath
}

test('saveWindowBounds → loadWindowBounds: roundtrip 读回所写尺寸/位置', async () => {
  const cfgPath = await withConfig({ apiKey: 'k', provider: 'ark', model: 'm' })
  try {
    saveWindowBounds(cfgPath, { x: 10, y: 20, width: 800, height: 600, maximized: false })
    const loaded = loadWindowBounds(cfgPath)
    assert.deepEqual(loaded, { x: 10, y: 20, width: 800, height: 600, maximized: false })
  } finally {
    await fs.rm(path.dirname(cfgPath), { recursive: true, force: true })
  }
})

test('saveWindowBounds: 保留 config.json 其他字段(不丢 apiKey)', async () => {
  const cfgPath = await withConfig({
    apiKey: 'secret-key',
    provider: 'ark',
    model: 'ark-code-latest',
  })
  try {
    saveWindowBounds(cfgPath, { x: 0, y: 0, width: 1280, height: 800 })
    const cfg = JSON.parse(await fs.readFile(cfgPath, 'utf-8')) as Record<string, unknown>
    assert.equal(cfg.apiKey, 'secret-key', 'apiKey 必须保留')
    assert.equal(cfg.provider, 'ark')
    assert.equal(cfg.model, 'ark-code-latest')
    assert.deepEqual(cfg.preferences, {
      windowBounds: { x: 0, y: 0, width: 1280, height: 800 },
    })
  } finally {
    await fs.rm(path.dirname(cfgPath), { recursive: true, force: true })
  }
})

test('saveWindowBounds: 不覆盖已有 preferences 兄弟字段', async () => {
  const cfgPath = await withConfig({
    apiKey: 'k',
    preferences: { theme: 'dark', windowBounds: { x: 1, y: 2, width: 3, height: 4 } },
  })
  try {
    saveWindowBounds(cfgPath, { x: 100, y: 200, width: 1000, height: 700, maximized: true })
    const cfg = JSON.parse(await fs.readFile(cfgPath, 'utf-8')) as {
      preferences?: { theme?: string; windowBounds?: unknown }
    }
    assert.equal(cfg.preferences?.theme, 'dark', '兄弟字段 theme 保留')
    assert.deepEqual(cfg.preferences?.windowBounds, {
      x: 100,
      y: 200,
      width: 1000,
      height: 700,
      maximized: true,
    })
  } finally {
    await fs.rm(path.dirname(cfgPath), { recursive: true, force: true })
  }
})

test('loadWindowBounds: config.json 无 preferences → 返回 null(用默认尺寸)', async () => {
  const cfgPath = await withConfig({ apiKey: 'k', provider: 'ark', model: 'm' })
  try {
    assert.equal(loadWindowBounds(cfgPath), null)
  } finally {
    await fs.rm(path.dirname(cfgPath), { recursive: true, force: true })
  }
})

test('loadWindowBounds: 文件不存在 → 返回 null,不抛错', async () => {
  assert.equal(loadWindowBounds('/nonexistent/path/config.json'), null)
})

test('configPathFor: agentDir 上两级 + config.json', () => {
  // agentDir = <appRoot>/.pi/agent → appRoot = <appRoot>
  const agentDir = path.join('/data', 'app', '.pi', 'agent')
  assert.equal(configPathFor(agentDir), path.join('/data', 'app', 'config.json'))
})

// updater.test.ts - selectUpdatePackage 决策纯函数 + .update-state.json 读写(ADR-0018 D2,Seam 1)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import { readUpdateState, selectUpdatePackage, writeUpdateState } from './updater.js'
import type { LocalState, RemoteManifest } from './updater.js'

const LOCAL: LocalState = {
  appVersion: '0.1.0',
  depsVersion: 'aaa',
  baselineVersion: 'bbb',
  platform: 'darwin',
}

const REMOTE: RemoteManifest = {
  appVersion: '0.1.0',
  depsVersion: 'aaa',
  baselineVersion: 'bbb',
  packages: {
    code: { url: 'code-url', sha512: 'code-sha', size: 5 },
    app: { url: 'app-url', sha512: 'app-sha', size: 45 },
  },
}

test('selectUpdatePackage: 无变化 -> none', () => {
  assert.deepEqual(selectUpdatePackage(LOCAL, REMOTE), { action: 'none', package: null })
})

test('selectUpdatePackage: appVersion 变 -> code', () => {
  const r = { ...REMOTE, appVersion: '0.2.0' }
  assert.deepEqual(selectUpdatePackage(LOCAL, r), {
    action: 'code',
    package: REMOTE.packages.code,
  })
})

test('selectUpdatePackage: depsVersion 变 -> app', () => {
  const r = { ...REMOTE, depsVersion: 'ccc' }
  assert.deepEqual(selectUpdatePackage(LOCAL, r), {
    action: 'app',
    package: REMOTE.packages.app,
  })
})

test('selectUpdatePackage: baselineVersion 变 -> full', () => {
  const r = { ...REMOTE, baselineVersion: 'ddd' }
  assert.deepEqual(selectUpdatePackage(LOCAL, r), { action: 'full', package: null })
})

test('selectUpdatePackage: deps + appVersion 都变 -> 选重的 app', () => {
  const r = { ...REMOTE, depsVersion: 'ccc', appVersion: '0.2.0' }
  assert.deepEqual(selectUpdatePackage(LOCAL, r), {
    action: 'app',
    package: REMOTE.packages.app,
  })
})

test('selectUpdatePackage: baseline + appVersion 都变 -> 选最重的 full', () => {
  const r = { ...REMOTE, baselineVersion: 'ddd', appVersion: '0.2.0' }
  assert.deepEqual(selectUpdatePackage(LOCAL, r), { action: 'full', package: null })
})

test('selectUpdatePackage: linux 无变化 -> none', () => {
  const linuxLocal = { ...LOCAL, platform: 'linux' }
  assert.deepEqual(selectUpdatePackage(linuxLocal, REMOTE), { action: 'none', package: null })
})

test('selectUpdatePackage: linux 有变化 -> 总 full(不走增量,AppImage 只读)', () => {
  const linuxLocal = { ...LOCAL, platform: 'linux' }
  assert.deepEqual(selectUpdatePackage(linuxLocal, { ...REMOTE, appVersion: '0.2.0' }), {
    action: 'full',
    package: null,
  })
  assert.deepEqual(selectUpdatePackage(linuxLocal, { ...REMOTE, depsVersion: 'ccc' }), {
    action: 'full',
    package: null,
  })
})

test('selectUpdatePackage: code 包缺失时 appVersion 变 -> code 但 package null', () => {
  const r = { ...REMOTE, appVersion: '0.2.0', packages: {} }
  assert.deepEqual(selectUpdatePackage(LOCAL, r), { action: 'code', package: null })
})

test('writeUpdateState + readUpdateState: 读写一致', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'zwiki-update-state-'))
  try {
    const file = path.join(dir, '.update-state.json')
    await writeUpdateState(file, LOCAL)
    const read = await readUpdateState(file)
    assert.deepEqual(read, LOCAL)
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

test('readUpdateState: 文件不存在 -> null', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'zwiki-update-state-'))
  try {
    const read = await readUpdateState(path.join(dir, 'nope.json'))
    assert.equal(read, null)
  } finally {
    await fs.rm(dir, { recursive: true, force: true })
  }
})

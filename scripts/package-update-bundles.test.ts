// package-update-bundles.test.ts - 打包纯函数测试(ADR-0018 D2/D3,Seam 2)。
// 测 computeVersions / collectCodePatchEntries / buildManifest 纯函数;
// main(IO:tar/sha512/读 package.json)不测,靠 make package 手动验证。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildManifest,
  collectCodePatchEntries,
  computeVersions,
} from './package-update-bundles.js'

test('computeVersions: depsVersion = lockHash 前 12 位, baselineVersion 拼接', () => {
  const v = computeVersions({
    appVersion: '0.2.0',
    electronVersion: '38.8.6',
    rg: '14.1.1',
    fd: '10.1.0',
    pandoc: '3.10',
    lockHash: 'a1b2c3d4e5f67890abcdef',
  })
  assert.equal(v.appVersion, '0.2.0')
  assert.equal(v.depsVersion, 'a1b2c3d4e5f6')
  assert.equal(v.baselineVersion, 'e38.8.6_p3.10_r14.1.1_f10.1.0')
})

test('computeVersions: lockHash 不足 12 位时取全部', () => {
  const v = computeVersions({
    appVersion: '0.1.0',
    electronVersion: '38.0.0',
    rg: '14.0.0',
    fd: '10.0.0',
    pandoc: '3.0',
    lockHash: 'short',
  })
  assert.equal(v.depsVersion, 'short')
})

test('collectCodePatchEntries: 返回 4 处路径(app/dist + @z-wiki/server + web/dist + package.json)', () => {
  const res = '/fake/unpacked/resources'
  const entries = collectCodePatchEntries(res)
  assert.equal(entries.length, 4)
  assert.deepEqual(
    entries.map((e) => e.dest).sort(),
    ['app/dist', 'app/node_modules/@z-wiki/server', 'app/package.json', 'web/dist'].sort(),
  )
  for (const e of entries) {
    assert.ok(e.src.startsWith(res), `${e.src} 应以 resources 开头`)
  }
})

test('buildManifest: 生成 latest.json 结构(三版本号 + code 条目)', () => {
  const manifest = buildManifest(
    {
      appVersion: '0.2.0',
      depsVersion: 'a1b2c3d4e5f6',
      baselineVersion: 'e38.8.6_p3.10_r14.1.1_f10.1.0',
    },
    {
      url: 'https://release/z-wiki-code-0.2.0.tar.gz',
      sha512: 'abc',
      size: 5000000,
    },
  )
  assert.equal(manifest.appVersion, '0.2.0')
  assert.equal(manifest.depsVersion, 'a1b2c3d4e5f6')
  assert.equal(manifest.baselineVersion, 'e38.8.6_p3.10_r14.1.1_f10.1.0')
  assert.equal(manifest.packages.code?.url, 'https://release/z-wiki-code-0.2.0.tar.gz')
  assert.equal(manifest.packages.code?.sha512, 'abc')
  assert.equal(manifest.packages.code?.size, 5000000)
  // app/full 档未定义(Ticket 05/06 补)
  assert.equal(manifest.packages.app, undefined)
  assert.equal(manifest.packages.full, undefined)
})

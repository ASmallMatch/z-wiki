// vaultLayout.test.ts - vault 命名契约单测(slugify 派生目录名 + vaultDisplayName 显示名)。
// 从 interaction.ts 闭包外提为模块级纯函数后的行为锁定(中文保留正则、合并/兜底、显示名查找)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { slugify, vaultDisplayName } from './vaultLayout.js'

// ── slugify ───────────────────────────────────────────────────────

test('slugify: 中文保留(一-龥 范围不替)', () => {
  assert.equal(slugify('我的知识库'), '我的知识库')
})

test('slugify: 特殊字符替成 -,合并 -+,去首尾 -', () => {
  assert.equal(slugify('my vault!@#'), 'my-vault')
})

test('slugify: 路径分隔符 / 替成 -', () => {
  assert.equal(slugify('工作/库'), '工作-库')
})

test('slugify: 多个连续分隔符合并成一个 -', () => {
  assert.equal(slugify('--already--dashed--'), 'already-dashed')
})

test('slugify: 空串/纯空白 -> 兜底 vault', () => {
  assert.equal(slugify(''), 'vault')
  assert.equal(slugify('   '), 'vault')
})

test('slugify: 保留点号与下划线(\\w 与 . 不替)', () => {
  assert.equal(slugify('my.vault_name'), 'my.vault_name')
})

// ── vaultDisplayName ──────────────────────────────────────────────

test('vaultDisplayName: config.vaults 命中 -> 返回显示名', () => {
  assert.equal(
    vaultDisplayName('/path/to/my-kb', {
      vaults: [{ path: '/path/to/my-kb', name: '我的库' }],
    }),
    '我的库',
  )
})

test('vaultDisplayName: 未命中 -> 取 kb/ 父目录名', () => {
  assert.equal(
    vaultDisplayName('/path/to/my-kb', {
      vaults: [{ path: '/other', name: 'x' }],
    }),
    'to',
  )
})

test('vaultDisplayName: vaults 缺省/空 -> 取父目录名', () => {
  assert.equal(vaultDisplayName('/path/to/my-kb', {}), 'to')
  assert.equal(vaultDisplayName('/path/to/my-kb', { vaults: [] }), 'to')
})

test('vaultDisplayName: 父目录名为空(kb/ 在根下)-> 兜底返回 kbRootPath', () => {
  // dirname('/my-kb') = '/', basename('/') = '' -> 兜底 kbRootPath
  assert.equal(vaultDisplayName('/my-kb', {}), '/my-kb')
})

test('vaultDisplayName: 命中但 name 缺省 -> 取父目录名', () => {
  assert.equal(
    vaultDisplayName('/path/to/my-kb', {
      vaults: [{ path: '/path/to/my-kb' }],
    }),
    'to',
  )
})

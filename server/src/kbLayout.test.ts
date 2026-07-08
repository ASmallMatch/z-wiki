import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { isRawPath, isWritablePath, kbRoot, rawDir, wikiDir } from './kbLayout.js'

const ROOT = '/proj'
const KB = kbRoot(ROOT) // /proj/kb(模拟当前 Vault 的 kb/ 根;多 Vault 下名可为任意 slug)

test('isRawPath: raw/ 下文件 -> true', () => {
  assert.equal(isRawPath(path.join(rawDir(KB), 'x.md'), KB), true)
})

test('isRawPath: raw/ 子目录 -> true(全层只读)', () => {
  assert.equal(isRawPath(path.join(rawDir(KB), 'sub', 'y.md'), KB), true)
})

test('isRawPath: raw.txt(根级同名伪匹配)-> false', () => {
  assert.equal(isRawPath(path.join(ROOT, 'raw.txt'), KB), false)
})

test('isRawPath: wiki/raw-x.md(伪 raw 前缀)-> false', () => {
  assert.equal(isRawPath(path.join(wikiDir(KB), 'raw-x.md'), KB), false)
})

test('isRawPath: wiki/ 下 -> false', () => {
  assert.equal(isRawPath(path.join(wikiDir(KB), '01-主题.md'), KB), false)
})

test('isRawPath: kb/ 外(server 文件)-> false', () => {
  assert.equal(isRawPath(path.join(ROOT, 'server', 'src', 'x.ts'), KB), false)
})

test('isWritablePath: raw/ 下 -> false(只读)', () => {
  assert.equal(isWritablePath(path.join(rawDir(KB), 'x.md'), KB), false)
})

test('isWritablePath: wiki/ 下 -> true', () => {
  assert.equal(isWritablePath(path.join(wikiDir(KB), '01-主题.md'), KB), true)
})

test('isWritablePath: output/ 下 -> true', () => {
  assert.equal(isWritablePath(path.join(KB, 'output', 'r.md'), KB), true)
})

test('isWritablePath: index.md / log.md -> true', () => {
  assert.equal(isWritablePath(path.join(KB, 'index.md'), KB), true)
  assert.equal(isWritablePath(path.join(KB, 'log.md'), KB), true)
})

test('isWritablePath: kb/ 外(server/web)-> false(非 layer1)', () => {
  assert.equal(isWritablePath(path.join(ROOT, 'server', 'x.ts'), KB), false)
})

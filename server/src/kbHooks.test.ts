import assert from 'node:assert/strict'
import { test } from 'node:test'
import { shouldBlockRead } from './kbHooks.js'

// read 拦非 md(ADR-0011):后缀在 ALLOWED_UPLOAD_EXTS 且非 .md -> block,提示用 pandoc 工具。
// 防止 agent 用 read 读 docx/xlsx 等拿二进制乱码。

test('shouldBlockRead: .md 放行', () => {
  assert.equal(shouldBlockRead('raw/x.md'), null)
  assert.equal(shouldBlockRead('wiki/01-foo.md'), null)
})

test('shouldBlockRead: pandoc 可转格式 block', () => {
  for (const ext of [
    '.docx',
    '.xlsx',
    '.pptx',
    '.odt',
    '.epub',
    '.html',
    '.rtf',
    '.csv',
    '.json',
  ]) {
    const r = shouldBlockRead(`raw/report${ext}`)
    assert.ok(r, `${ext} 应 block`)
    // biome-ignore lint/style/noNonNullAssertion: 前有 assert.ok(r) 保证非空,TS 不自动窄化 assert.ok
    assert.match(r!.reason, /pandoc/, `${ext} reason 应提示 pandoc`)
  }
})

test('shouldBlockRead: 大写后缀 block', () => {
  assert.ok(shouldBlockRead('raw/X.DOCX'))
})

test('shouldBlockRead: 非白名单后缀放行(.txt 等)', () => {
  assert.equal(shouldBlockRead('raw/notes.txt'), null)
  assert.equal(shouldBlockRead('raw/data.bin'), null)
})

test('shouldBlockRead: 无后缀/空路径放行', () => {
  assert.equal(shouldBlockRead('raw/README'), null)
  assert.equal(shouldBlockRead(''), null)
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { shouldBlockRead, shouldBlockReadPath, shouldBlockWritePath } from './kbHooks.js'

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

// shouldBlockReadPath:读工具(read/grep/find/ls)路径越界(ADR-0016)。读边界含 raw/(ingest 刚需)。
const KB = '/srv/kb'

test('shouldBlockReadPath: kb/ 内放行(含 raw/)', () => {
  assert.equal(shouldBlockReadPath('wiki/01-foo.md', KB), null)
  assert.equal(shouldBlockReadPath('raw/x.md', KB), null)
  assert.equal(shouldBlockReadPath('output/report.md', KB), null)
  assert.equal(shouldBlockReadPath('index.md', KB), null)
})

test('shouldBlockReadPath: kb/ 根本身放行(ls . / grep .)', () => {
  // rel='' 时 isWithinKb 须返回 true(kb/ 根算在内),不能照搬 isWritablePath 的 rel!=='' 排除
  assert.equal(shouldBlockReadPath('.', KB), null)
  assert.equal(shouldBlockReadPath('./wiki/01-foo.md', KB), null)
})

test('shouldBlockReadPath: kb/ 外绝对路径 block', () => {
  const r = shouldBlockReadPath('/etc/passwd', KB)
  assert.ok(r)
  // biome-ignore lint/style/noNonNullAssertion: 前有 assert.ok(r) 保证非空,TS 不自动窄化 assert.ok
  assert.match(r!.reason, /知识库目录.*之外/)
})

test('shouldBlockReadPath: ../ 逃逸 block', () => {
  const r = shouldBlockReadPath('../../etc/passwd', KB)
  assert.ok(r)
  // biome-ignore lint/style/noNonNullAssertion: 前有 assert.ok(r) 保证非空,TS 不自动窄化 assert.ok
  assert.match(r!.reason, /知识库目录.*之外/)
  // kb/ 外同级目录
  assert.ok(shouldBlockReadPath('../server/src/x.ts', KB))
})

test('shouldBlockReadPath: 空/缺失放行(默认 cwd)', () => {
  assert.equal(shouldBlockReadPath('', KB), null)
  assert.equal(shouldBlockReadPath(undefined, KB), null)
})

// shouldBlockWritePath:写工具(write/edit)路径越界(ADR-0016)。写边界=kb/ 内非 raw/。

test('shouldBlockWritePath: raw/ block(只读源)', () => {
  const r = shouldBlockWritePath('raw/x.md', KB)
  assert.ok(r)
  // biome-ignore lint/style/noNonNullAssertion: 前有 assert.ok(r) 保证非空,TS 不自动窄化 assert.ok
  assert.match(r!.reason, /只读/)
})

test('shouldBlockWritePath: 可写区放行(wiki/output/index/log)', () => {
  assert.equal(shouldBlockWritePath('wiki/01-foo.md', KB), null)
  assert.equal(shouldBlockWritePath('output/report.md', KB), null)
  assert.equal(shouldBlockWritePath('index.md', KB), null)
  assert.equal(shouldBlockWritePath('log.md', KB), null)
})

test('shouldBlockWritePath: kb/ 外 block', () => {
  const r = shouldBlockWritePath('/etc/passwd', KB)
  assert.ok(r)
  // biome-ignore lint/style/noNonNullAssertion: 前有 assert.ok(r) 保证非空,TS 不自动窄化 assert.ok
  assert.match(r!.reason, /知识库目录.*之外/)
})

test('shouldBlockWritePath: ../ 逃逸 block', () => {
  assert.ok(shouldBlockWritePath('../../etc/passwd', KB))
  assert.ok(shouldBlockWritePath('../server/src/x.ts', KB))
})

test('shouldBlockWritePath: 空/缺失放行(默认 cwd)', () => {
  assert.equal(shouldBlockWritePath('', KB), null)
  assert.equal(shouldBlockWritePath(undefined, KB), null)
})

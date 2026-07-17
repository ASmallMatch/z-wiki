import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { createServer } from './index.js'
import { CONFIG_JSON, makeVault } from './testFixtures.js'
import { ALLOWED_UPLOAD_EXTS, PLAINTEXT_EXTS, checkUploadExt } from './uploadExts.js'

// 集成测试 /api/upload 后缀白名单(ADR-0007 决策 1 + 决策 5)。
// 白名单逻辑由 checkUploadExt 纯函数覆盖(快,无 server/ingest);
// 端点集成测 pdf 415 + 1 个放行落 raw/(代表格式;触发后台 ingest 是既有模式,见 vault.test.ts)。
process.env.NODE_ENV = 'production'
process.env.LOG_LEVEL = 'error'

/** 构造单文件字段 multipart body。 */
function multipart(boundary: string, filename: string, content: string): string {
  return [
    `--${boundary}`,
    `Content-Disposition: form-data; name="file"; filename="${filename}"`,
    'Content-Type: application/octet-stream',
    '',
    content,
    `--${boundary}--`,
    '',
  ].join('\r\n')
}

// ── checkUploadExt 纯函数(白名单逻辑,不触发 server/ingest)──────────

test('checkUploadExt: 白名单后缀放行(返回 null)', async () => {
  for (const ext of ALLOWED_UPLOAD_EXTS) {
    assert.equal(checkUploadExt(ext), null, `${ext} 应放行`)
  }
})

test('checkUploadExt: 纯文本后缀(.txt/.text/.log)放行(ADR-0018)', async () => {
  for (const ext of PLAINTEXT_EXTS) {
    assert.equal(checkUploadExt(ext), null, `${ext} 应放行`)
  }
})

test('checkUploadExt: .pdf -> { error: "pdf 暂不支持" }', async () => {
  assert.deepEqual(checkUploadExt('.pdf'), { error: 'pdf 暂不支持' })
})

test('checkUploadExt: 非白名单 -> { error: "不支持 X 文件..." }', async () => {
  const r = checkUploadExt('.exe')
  assert.ok(r !== null, '.exe 应被拒绝')
  assert.match(r.error, /不支持 \.exe/)
})

// ── /api/upload 端点集成(校验 + 落 raw/)──────────────────────────

test('POST /api/upload: .pdf -> 415 "pdf 暂不支持"', async () => {
  const vault = await makeVault()
  const interaction = await createServer({ kbRoot: vault.kbRoot, agentDir: vault.agentDir })
  try {
    const res = await interaction.app.inject({
      method: 'POST',
      url: '/api/upload',
      headers: { 'content-type': 'multipart/form-data; boundary=b' },
      payload: multipart('b', 'doc.pdf', '%PDF-1.4 fake'),
    })
    assert.equal(res.statusCode, 415)
    assert.equal((res.json() as { error: string }).error, 'pdf 暂不支持')
  } finally {
    await interaction.app.close()
    await fs.rm(vault.root, { recursive: true, force: true })
  }
})

test('POST /api/upload: 白名单格式 -> 200 落 raw/(以 .xlsx 为代表)', async () => {
  const vault = await makeVault()
  const interaction = await createServer({ kbRoot: vault.kbRoot, agentDir: vault.agentDir })
  try {
    const res = await interaction.app.inject({
      method: 'POST',
      url: '/api/upload',
      headers: { 'content-type': 'multipart/form-data; boundary=b' },
      payload: multipart('b', 'sheet.xlsx', 'fake content'),
    })
    assert.equal(res.statusCode, 200)
    assert.ok(existsSync(path.join(vault.kbRoot, 'raw', 'sheet.xlsx')), '应落 raw/')
  } finally {
    await interaction.app.close()
    await fs.rm(vault.root, { recursive: true, force: true })
  }
})

test('POST /api/upload: .txt -> 200 落 raw/(纯文本,ADR-0018)', async () => {
  const vault = await makeVault()
  const interaction = await createServer({ kbRoot: vault.kbRoot, agentDir: vault.agentDir })
  try {
    const res = await interaction.app.inject({
      method: 'POST',
      url: '/api/upload',
      headers: { 'content-type': 'multipart/form-data; boundary=b' },
      payload: multipart('b', 'notes.txt', '纯文本内容'),
    })
    assert.equal(res.statusCode, 200)
    assert.ok(existsSync(path.join(vault.kbRoot, 'raw', 'notes.txt')), '应落 raw/')
  } finally {
    await interaction.app.close()
    await fs.rm(vault.root, { recursive: true, force: true })
  }
})

test('POST /api/upload: 多 Vault(kb 目录非 kb 名)raw 落当前库 raw/', async () => {
  // 真实多 Vault:同一根下库目录名是 slug(如 test-kb),非固定 'kb'。
  // 回归 bug:rawDir(dirname(kbRoot)) 错拼 dirname/kb/raw,应落 kbRoot/raw。
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zwiki-multi-'))
  const kbRoot = path.join(root, 'test-kb')
  const agentDir = path.join(root, '.pi/agent')
  await fs.mkdir(kbRoot, { recursive: true })
  await fs.mkdir(agentDir, { recursive: true })
  await fs.writeFile(path.join(root, 'config.json'), JSON.stringify(CONFIG_JSON), 'utf-8')
  const interaction = await createServer({ kbRoot, agentDir })
  try {
    const res = await interaction.app.inject({
      method: 'POST',
      url: '/api/upload',
      headers: { 'content-type': 'multipart/form-data; boundary=b' },
      payload: multipart('b', 'sheet.xlsx', 'fake content'),
    })
    assert.equal(res.statusCode, 200)
    assert.ok(existsSync(path.join(kbRoot, 'raw', 'sheet.xlsx')), 'raw 应落当前库 test-kb/raw')
    assert.ok(
      !existsSync(path.join(root, 'kb', 'raw', 'sheet.xlsx')),
      '不应落错误的 dirname/kb/raw',
    )
  } finally {
    await interaction.app.close()
    await fs.rm(root, { recursive: true, force: true })
  }
})

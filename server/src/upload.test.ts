import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { createServer } from './index.js'
import { makeVault } from './testFixtures.js'
import { ALLOWED_UPLOAD_EXTS, checkUploadExt } from './uploadExts.js'

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

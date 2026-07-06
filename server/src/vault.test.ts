import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { createServer } from './index.js'

// 集成测试 Vault 管理 + 切库端点(ADR-0003 D4/D5/D7/D3.1)。
// HTTP 用 app.inject();WS vault_changed 用真实 listen + WebSocket 客户端验证推送。
process.env.NODE_ENV = 'production'
process.env.LOG_LEVEL = 'error'

const CONFIG_JSON = {
  apiKey: 'test-key',
  baseUrl: 'https://ark.cn-beijing.volces.com/api/coding',
  api: 'anthropic-messages',
  model: 'ark-code-latest',
}

interface Vault {
  kbRoot: string
  agentDir: string
  root: string
}

/** 构造临时 vault:kb/wiki/<file> + .pi/agent/ + config.json(落 appRoot)。 */
async function makeVault(wikiFiles: Record<string, string>): Promise<Vault> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'zwiki-vault-'))
  const kbRoot = path.join(root, 'kb')
  const agentDir = path.join(root, '.pi/agent')
  await fs.mkdir(kbRoot, { recursive: true })
  for (const [rel, content] of Object.entries(wikiFiles)) {
    const abs = path.join(kbRoot, rel)
    await fs.mkdir(path.dirname(abs), { recursive: true })
    await fs.writeFile(abs, content, 'utf-8')
  }
  await fs.mkdir(agentDir, { recursive: true })
  await fs.writeFile(path.join(root, 'config.json'), JSON.stringify(CONFIG_JSON), 'utf-8')
  return { kbRoot, agentDir, root }
}

/** 构造最小 kb_example 样板(供 POST /api/vault 新建 Vault 时复制)。 */
async function makeKbExample(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'zwiki-kbex-'))
  await fs.mkdir(path.join(dir, 'wiki'), { recursive: true })
  await fs.mkdir(path.join(dir, 'raw'), { recursive: true })
  await fs.writeFile(path.join(dir, 'index.md'), '# index\n', 'utf-8')
  await fs.writeFile(
    path.join(dir, 'wiki/01-sample.md'),
    '---\nview: true\n---\n# Sample\n',
    'utf-8',
  )
  return dir
}

const VIEW_TRUE = (title: string, body: string) => `---\nview: true\n---\n# ${title}\n\n${body}\n`

// ── GET /api/vaults ──────────────────────────────────────────────

test('GET /api/vaults: 返回 config.vaults + 当前 Vault(currentKbRoot)', async () => {
  const vault = await makeVault({})
  // config.json 加 vaults 列表 + currentVault
  const cfgPath = path.join(vault.root, 'config.json')
  const cfg = {
    ...CONFIG_JSON,
    vaults: [{ path: vault.kbRoot, name: '默认' }],
    currentVault: vault.kbRoot,
  }
  await fs.writeFile(cfgPath, JSON.stringify(cfg), 'utf-8')

  const interaction = await createServer({ kbRoot: vault.kbRoot, agentDir: vault.agentDir })
  try {
    const res = await interaction.app.inject({ method: 'GET', url: '/api/vaults' })
    assert.equal(res.statusCode, 200)
    const body = res.json() as {
      vaults: Array<{ path: string; name: string }>
      currentVault: string
    }
    assert.equal(body.vaults.length, 1)
    assert.equal(body.vaults[0].name, '默认')
    assert.equal(body.currentVault, vault.kbRoot)
  } finally {
    await interaction.app.close()
    await fs.rm(vault.root, { recursive: true, force: true })
  }
})

// ── POST /api/vault(新建)──────────────────────────────────────────

test('POST /api/vault: 从 kb_example 复制新 Vault + 加入 config.vaults(不自动切换)', async () => {
  const vault = await makeVault({})
  const kbExample = await makeKbExample()
  const interaction = await createServer({
    kbRoot: vault.kbRoot,
    agentDir: vault.agentDir,
    kbExamplePath: kbExample,
  })
  try {
    const res = await interaction.app.inject({
      method: 'POST',
      url: '/api/vault',
      payload: { name: 'work' },
    })
    assert.equal(res.statusCode, 201)
    const body = res.json() as { vault: { path: string; name: string } }
    assert.equal(body.vault.name, 'work')
    // 新 Vault 的 kb/ 路径在 appRoot 下派生
    assert.equal(body.vault.path, path.join(vault.root, 'work-kb'))
    assert.ok(existsSync(path.join(body.vault.path, 'wiki/01-sample.md')), 'kb_example 内容已复制')
    assert.ok(existsSync(path.join(body.vault.path, 'index.md')), 'index.md 已复制')

    // config.vaults 已追加
    const cfg = JSON.parse(await fs.readFile(path.join(vault.root, 'config.json'), 'utf-8')) as {
      vaults: Array<{ path: string }>
      currentVault: string
    }
    assert.equal(cfg.vaults.length, 1)
    assert.equal(cfg.vaults[0].path, body.vault.path)
    // 未自动切换:currentVault 仍为原值(无)
    assert.equal(cfg.currentVault, undefined)
  } finally {
    await interaction.app.close()
    await fs.rm(vault.root, { recursive: true, force: true })
    await fs.rm(kbExample, { recursive: true, force: true })
  }
})

test('POST /api/vault: 无 kbExamplePath → 503(dev 形态不支持新建)', async () => {
  const vault = await makeVault({})
  const interaction = await createServer({ kbRoot: vault.kbRoot, agentDir: vault.agentDir })
  try {
    const res = await interaction.app.inject({
      method: 'POST',
      url: '/api/vault',
      payload: { name: 'work' },
    })
    assert.equal(res.statusCode, 503)
  } finally {
    await interaction.app.close()
    await fs.rm(vault.root, { recursive: true, force: true })
  }
})

test('POST /api/vault: 目标路径已存在 → 409(不覆盖既有库)', async () => {
  const vault = await makeVault({})
  const kbExample = await makeKbExample()
  const interaction = await createServer({
    kbRoot: vault.kbRoot,
    agentDir: vault.agentDir,
    kbExamplePath: kbExample,
  })
  try {
    // 已存在的目标:用当前 vault 的 kbRoot(必然存在)
    const res = await interaction.app.inject({
      method: 'POST',
      url: '/api/vault',
      payload: { path: vault.kbRoot },
    })
    assert.equal(res.statusCode, 409)
  } finally {
    await interaction.app.close()
    await fs.rm(vault.root, { recursive: true, force: true })
    await fs.rm(kbExample, { recursive: true, force: true })
  }
})

// ── PUT /api/config/apikey ───────────────────────────────────────

test('POST /api/config/llm: 写 config + 冷重载(reload + setModel)→ 200', async () => {
  const vault = await makeVault({})
  const cfgPath = path.join(vault.root, 'config.json')
  const interaction = await createServer({ kbRoot: vault.kbRoot, agentDir: vault.agentDir })
  try {
    const res = await interaction.app.inject({
      method: 'POST',
      url: '/api/config/llm',
      payload: {
        baseUrl: 'https://api.example.com/v1',
        api: 'openai-completions',
        model: 'gpt-4o',
        apiKey: 'new-secret-key',
      },
    })
    assert.equal(res.statusCode, 200)
    // config.json 写入(4 字段)
    const cfg = JSON.parse(await fs.readFile(cfgPath, 'utf-8')) as Record<string, unknown>
    assert.equal(cfg.apiKey, 'new-secret-key')
    assert.equal(cfg.baseUrl, 'https://api.example.com/v1')
    assert.equal(cfg.api, 'openai-completions')
    assert.equal(cfg.model, 'gpt-4o')
    // models.json 重写(reloadAgentConfig 调 writeModelsJson + refresh 重读)
    const modelsJson = JSON.parse(
      await fs.readFile(path.join(vault.agentDir, 'models.json'), 'utf-8'),
    ) as { providers: { custom: { models: Array<{ id: string }> } } }
    assert.equal(modelsJson.providers.custom.models[0].id, 'gpt-4o')
  } finally {
    await interaction.app.close()
    await fs.rm(vault.root, { recursive: true, force: true })
  }
})

test('POST /api/config/llm: 空 apiKey → 400(不重载)', async () => {
  const vault = await makeVault({})
  const interaction = await createServer({ kbRoot: vault.kbRoot, agentDir: vault.agentDir })
  try {
    const res = await interaction.app.inject({
      method: 'POST',
      url: '/api/config/llm',
      payload: { baseUrl: 'https://h/v1', api: 'openai-completions', model: 'gpt-4o', apiKey: '' },
    })
    assert.equal(res.statusCode, 400)
  } finally {
    await interaction.app.close()
    await fs.rm(vault.root, { recursive: true, force: true })
  }
})

test('POST /api/config/llm: 空 baseUrl → 400', async () => {
  const vault = await makeVault({})
  const interaction = await createServer({ kbRoot: vault.kbRoot, agentDir: vault.agentDir })
  try {
    const res = await interaction.app.inject({
      method: 'POST',
      url: '/api/config/llm',
      payload: { baseUrl: '', api: 'openai-completions', model: 'gpt-4o', apiKey: 'k' },
    })
    assert.equal(res.statusCode, 400)
  } finally {
    await interaction.app.close()
    await fs.rm(vault.root, { recursive: true, force: true })
  }
})

test('POST /api/config/llm: baseUrl 规范化(写入时剥尾部 suffix)', async () => {
  const vault = await makeVault({})
  const cfgPath = path.join(vault.root, 'config.json')
  const interaction = await createServer({ kbRoot: vault.kbRoot, agentDir: vault.agentDir })
  try {
    const res = await interaction.app.inject({
      method: 'POST',
      url: '/api/config/llm',
      payload: {
        baseUrl: 'https://api.example.com/v1/chat/completions',
        api: 'openai-completions',
        model: 'gpt-4o',
        apiKey: 'k',
      },
    })
    assert.equal(res.statusCode, 200)
    const cfg = JSON.parse(await fs.readFile(cfgPath, 'utf-8')) as { baseUrl: string }
    assert.equal(cfg.baseUrl, 'https://api.example.com/v1')
  } finally {
    await interaction.app.close()
    await fs.rm(vault.root, { recursive: true, force: true })
  }
})

test('GET /api/specs: 返回 api 规范 manifest + exposed 子集', async () => {
  const vault = await makeVault({})
  const interaction = await createServer({ kbRoot: vault.kbRoot, agentDir: vault.agentDir })
  try {
    const res = await interaction.app.inject({ method: 'GET', url: '/api/specs' })
    assert.equal(res.statusCode, 200)
    const body = JSON.parse(res.body) as {
      specs: Array<{ id: string; label: string; suffix: string }>
      exposed: string[]
    }
    assert.ok(body.specs.length >= 2)
    assert.ok(body.specs.some((s) => s.id === 'openai-completions'))
    assert.ok(body.specs.some((s) => s.id === 'anthropic-messages'))
    assert.deepEqual(body.exposed, ['openai-completions', 'anthropic-messages'])
  } finally {
    await interaction.app.close()
    await fs.rm(vault.root, { recursive: true, force: true })
  }
})

test('GET /api/config/status: 返回 baseUrl/api/model + hasApiKey + exposedApiSpecs', async () => {
  const vault = await makeVault({})
  const interaction = await createServer({ kbRoot: vault.kbRoot, agentDir: vault.agentDir })
  try {
    const res = await interaction.app.inject({ method: 'GET', url: '/api/config/status' })
    assert.equal(res.statusCode, 200)
    const body = JSON.parse(res.body) as Record<string, unknown>
    assert.equal(body.baseUrl, 'https://ark.cn-beijing.volces.com/api/coding')
    assert.equal(body.api, 'anthropic-messages')
    assert.equal(body.model, 'ark-code-latest')
    assert.equal(body.hasApiKey, true)
    // apiKey 明文回传(ADR-0003 D3.1 威胁模型:loopback 单用户,掩码只防肩窥非安全边界)
    assert.equal(body.apiKey, 'test-key')
    // apiKey 掩码:test-key(8 字符)→ 固定 8 圆点(ADR-0004 D1)
    assert.equal(body.apiKeyMasked, '••••••••')
    assert.ok(Array.isArray(body.exposedApiSpecs))
  } finally {
    await interaction.app.close()
    await fs.rm(vault.root, { recursive: true, force: true })
  }
})

// ── POST /api/vault/switch ───────────────────────────────────────

test('POST /api/vault/switch: 切换到另一 Vault → 200,/api/pages 返回新库内容', async () => {
  const vaultA = await makeVault({ 'wiki/01-aaa.md': VIEW_TRUE('AAA', '内容 A') })
  const vaultB = await makeVault({ 'wiki/01-bbb.md': VIEW_TRUE('BBB', '内容 B') })
  const interaction = await createServer({ kbRoot: vaultA.kbRoot, agentDir: vaultA.agentDir })
  try {
    // 切换前:pages 含 01-aaa
    const before = await interaction.app.inject({ method: 'GET', url: '/api/pages' })
    const stemsBefore = (before.json() as Array<{ stem: string }>).map((p) => p.stem)
    assert.ok(stemsBefore.includes('01-aaa'))

    // 切换到 vaultB
    const switchRes = await interaction.app.inject({
      method: 'POST',
      url: '/api/vault/switch',
      payload: { path: vaultB.kbRoot },
    })
    assert.equal(switchRes.statusCode, 200)
    const body = switchRes.json() as { vault: { path: string } }
    assert.equal(body.vault.path, vaultB.kbRoot)

    // 切换后:pages 含 01-bbb,不含 01-aaa
    const after = await interaction.app.inject({ method: 'GET', url: '/api/pages' })
    const stemsAfter = (after.json() as Array<{ stem: string }>).map((p) => p.stem)
    assert.ok(stemsAfter.includes('01-bbb'), '切换后应见新库内容')
    assert.ok(!stemsAfter.includes('01-aaa'), '旧库内容应消失')

    // config.currentVault 已同步
    const cfg = JSON.parse(await fs.readFile(path.join(vaultA.root, 'config.json'), 'utf-8')) as {
      currentVault: string
    }
    assert.equal(cfg.currentVault, vaultB.kbRoot)
  } finally {
    await interaction.app.close()
    await Promise.all([
      fs.rm(vaultA.root, { recursive: true, force: true }),
      fs.rm(vaultB.root, { recursive: true, force: true }),
    ])
  }
})

test('POST /api/vault/switch: 目标不存在 → 400', async () => {
  const vault = await makeVault({})
  const interaction = await createServer({ kbRoot: vault.kbRoot, agentDir: vault.agentDir })
  try {
    const res = await interaction.app.inject({
      method: 'POST',
      url: '/api/vault/switch',
      payload: { path: path.join(vault.root, 'no-such-kb') },
    })
    assert.equal(res.statusCode, 400)
  } finally {
    await interaction.app.close()
    await fs.rm(vault.root, { recursive: true, force: true })
  }
})

test('POST /api/vault/switch: 目标=当前 → 400', async () => {
  const vault = await makeVault({})
  const interaction = await createServer({ kbRoot: vault.kbRoot, agentDir: vault.agentDir })
  try {
    const res = await interaction.app.inject({
      method: 'POST',
      url: '/api/vault/switch',
      payload: { path: vault.kbRoot },
    })
    assert.equal(res.statusCode, 400)
  } finally {
    await interaction.app.close()
    await fs.rm(vault.root, { recursive: true, force: true })
  }
})

test('POST /api/vault/switch: 活跃 ingest 中 → 409(D5)', async () => {
  const vault = await makeVault({ 'wiki/01-aaa.md': VIEW_TRUE('AAA', 'x') })
  const vaultB = await makeVault({ 'wiki/01-bbb.md': VIEW_TRUE('BBB', 'x') })
  const interaction = await createServer({ kbRoot: vault.kbRoot, agentDir: vault.agentDir })
  try {
    // 构造合法 multipart body 触发 /api/upload → runIngest(同步 ++activeIngestCount 后才 await 网络)
    const boundary = 'zwiki-test-boundary'
    const fileContent = '# 上传测试\n\n触发 ingest。\n'
    const multipartBody = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="file"; filename="upload-test.md"',
      'Content-Type: text/markdown',
      '',
      fileContent,
      `--${boundary}--`,
      '',
    ].join('\r\n')

    const uploadRes = await interaction.app.inject({
      method: 'POST',
      url: '/api/upload',
      headers: { 'content-type': `multipart/form-data; boundary=${boundary}` },
      payload: multipartBody,
    })
    assert.equal(uploadRes.statusCode, 200, '上传应成功归档 raw/')

    // 上传响应后 activeIngestCount 已 ++(runIngest 同步段),ingest 的网络调用是 macrotask 尚在飞行
    const activeRes = await interaction.app.inject({ method: 'GET', url: '/api/ingest/active' })
    assert.equal((activeRes.json() as { active: boolean }).active, true, 'ingest 应处于活跃状态')

    // 活跃 ingest 中切库 → 409
    const switchRes = await interaction.app.inject({
      method: 'POST',
      url: '/api/vault/switch',
      payload: { path: vaultB.kbRoot },
    })
    assert.equal(switchRes.statusCode, 409)
    assert.match((switchRes.json() as { error: string }).error, /上传正在处理/)
  } finally {
    await interaction.app.close()
    await Promise.all([
      fs.rm(vault.root, { recursive: true, force: true }),
      fs.rm(vaultB.root, { recursive: true, force: true }),
    ])
  }
})

// ── WS vault_changed(真实 listen + WebSocket 客户端)──────────────

test('WS: 切库时 chatClients 收到 vault_changed 事件 + 连接被关闭(D7)', async () => {
  const vaultA = await makeVault({ 'wiki/01-aaa.md': VIEW_TRUE('AAA', 'x') })
  const vaultB = await makeVault({ 'wiki/01-bbb.md': VIEW_TRUE('BBB', 'x') })
  const interaction = await createServer({ kbRoot: vaultA.kbRoot, agentDir: vaultA.agentDir })
  try {
    await interaction.app.listen({ port: 0, host: '127.0.0.1' })
    const address = interaction.app.server.address()
    const port = typeof address === 'object' && address ? address.port : null
    assert.ok(port, '未拿到端口')

    // 连一个 WS 客户端(模拟前端 useChat)
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`)
    const received: unknown[] = []
    let closed = false
    const wsOpen = new Promise<void>((resolve) => {
      ws.onopen = () => resolve()
    })
    ws.onmessage = (ev) => received.push(JSON.parse(ev.data as string))
    ws.onclose = () => {
      closed = true
    }
    await wsOpen

    // 切库:server 推 vault_changed → close 所有连接
    const switchRes = await fetch(`http://127.0.0.1:${port}/api/vault/switch`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path: vaultB.kbRoot }),
    })
    assert.equal(switchRes.status, 200)

    // 等待 WS 收到 vault_changed(带超时)
    const vaultChanged = await new Promise<boolean>((resolve) => {
      const start = Date.now()
      const tick = () => {
        if (received.some((m) => (m as { type: string }).type === 'vault_changed'))
          return resolve(true)
        if (Date.now() - start > 2000) return resolve(false)
        setTimeout(tick, 20)
      }
      tick()
    })
    assert.ok(vaultChanged, 'WS 应在 2s 内收到 vault_changed 事件')

    // 等待连接被 server 关闭
    const closedOk = await new Promise<boolean>((resolve) => {
      const start = Date.now()
      const tick = () => {
        if (closed) return resolve(true)
        if (Date.now() - start > 2000) return resolve(false)
        setTimeout(tick, 20)
      }
      tick()
    })
    assert.ok(closedOk, 'WS 连接应被 server 关闭(复用 on-close dispose)')

    ws.close()
  } finally {
    await interaction.app.close()
    await Promise.all([
      fs.rm(vaultA.root, { recursive: true, force: true }),
      fs.rm(vaultB.root, { recursive: true, force: true }),
    ])
  }
})

// ── POST /api/vault/delete ───────────────────────────────────────

test('POST /api/vault/delete: 删除非当前库 → 200,config 移除 + 目录删除', async () => {
  const vaultA = await makeVault({ 'wiki/01-aaa.md': VIEW_TRUE('AAA', 'x') })
  const vaultB = await makeVault({ 'wiki/01-bbb.md': VIEW_TRUE('BBB', 'x') })
  const cfgPath = path.join(vaultA.root, 'config.json')
  await fs.writeFile(
    cfgPath,
    JSON.stringify({
      ...CONFIG_JSON,
      vaults: [
        { path: vaultA.kbRoot, name: 'A' },
        { path: vaultB.kbRoot, name: 'B' },
      ],
      currentVault: vaultA.kbRoot,
    }),
    'utf-8',
  )
  const interaction = await createServer({ kbRoot: vaultA.kbRoot, agentDir: vaultA.agentDir })
  try {
    const res = await interaction.app.inject({
      method: 'POST',
      url: '/api/vault/delete',
      payload: { path: vaultB.kbRoot },
    })
    assert.equal(res.statusCode, 200)
    // config.vaults 已移除 vaultB,currentVault 不变
    const cfg = JSON.parse(await fs.readFile(cfgPath, 'utf-8')) as {
      vaults: Array<{ path: string }>
      currentVault: string
    }
    assert.equal(cfg.vaults.length, 1)
    assert.ok(!cfg.vaults.some((v) => v.path === vaultB.kbRoot), 'vaultB 应已从 config 移除')
    assert.equal(cfg.currentVault, vaultA.kbRoot)
    // 目录已删除
    assert.ok(!existsSync(vaultB.kbRoot), 'vaultB 的 kb/ 目录应已删除')
  } finally {
    await interaction.app.close()
    await Promise.all([
      fs.rm(vaultA.root, { recursive: true, force: true }),
      fs.rm(vaultB.root, { recursive: true, force: true }),
    ])
  }
})

test('POST /api/vault/delete: 删当前库 → 400(不删 config/目录)', async () => {
  const vault = await makeVault({})
  const cfgPath = path.join(vault.root, 'config.json')
  await fs.writeFile(
    cfgPath,
    JSON.stringify({
      ...CONFIG_JSON,
      vaults: [{ path: vault.kbRoot, name: '当前' }],
      currentVault: vault.kbRoot,
    }),
    'utf-8',
  )
  const interaction = await createServer({ kbRoot: vault.kbRoot, agentDir: vault.agentDir })
  try {
    const res = await interaction.app.inject({
      method: 'POST',
      url: '/api/vault/delete',
      payload: { path: vault.kbRoot },
    })
    assert.equal(res.statusCode, 400)
    assert.match((res.json() as { error: string }).error, /不能删除当前/)
    // 未动 config 与目录
    const cfg = JSON.parse(await fs.readFile(cfgPath, 'utf-8')) as { vaults: unknown[] }
    assert.equal(cfg.vaults.length, 1)
    assert.ok(existsSync(vault.kbRoot), '当前库目录应保留')
  } finally {
    await interaction.app.close()
    await fs.rm(vault.root, { recursive: true, force: true })
  }
})

test('POST /api/vault/delete: 不存在的 path → 404', async () => {
  const vault = await makeVault({})
  const interaction = await createServer({ kbRoot: vault.kbRoot, agentDir: vault.agentDir })
  try {
    const res = await interaction.app.inject({
      method: 'POST',
      url: '/api/vault/delete',
      payload: { path: path.join(vault.root, 'no-such-kb') },
    })
    assert.equal(res.statusCode, 404)
  } finally {
    await interaction.app.close()
    await fs.rm(vault.root, { recursive: true, force: true })
  }
})

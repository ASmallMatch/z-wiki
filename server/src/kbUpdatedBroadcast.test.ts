// 回归测试:ingest 后广播的 kb_updated 必须是对象,不能是双重 JSON.stringify 的字符串。
// bug:triggerBuild 曾 broadcast(JSON.stringify(msg)),broadcast 内部再 JSON.stringify,
// 前端 JSON.parse 得到字符串(msg.type 为 undefined),kb_updated 被忽略 -> ingest 后首页不刷新。
// 通过 opts.sessions 注入 mock createIngestSession(写一篇新 wiki 让 buildView 变化 -> hasIndexChanged=true
// -> triggerBuild 广播 kb_updated),验证 WS 收到的是对象。ingest 路径 notify=null,只走 broadcast(正是 bug 路径)。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createServer } from './index.js'
import { makeVault } from './testFixtures.js'

process.env.NODE_ENV = 'production'
process.env.LOG_LEVEL = 'error'

/** 构造单文件字段 multipart body(复用 upload.test.ts 的形态)。 */
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

const mockStats = () => ({
  tokens: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  cost: 0,
  contextUsage: null,
})

test('ingest 后 kb_updated 广播为对象(回归双重编码 bug)', async () => {
  const vault = await makeVault({ 'wiki/01-foo.md': '# Foo\n\n正文\n' })

  // mock createIngestSession:prompt 写一篇新 wiki(让 buildView 结果变化,hasIndexChanged=true),
  // 不调 LLM。runIngest 随后广播 ingest_done + triggerBuild(null) -> broadcast(kb_updated)。
  const mockCreateIngestSession = async (opts: { kbRoot: string }) => {
    const { kbRoot } = opts
    return {
      prompt: async () => {
        await fs.writeFile(path.join(kbRoot, 'wiki/02-bar.md'), '# Bar\n\n正文\n', 'utf-8')
      },
      dispose: () => {},
      getSessionStats: mockStats,
      setModel: async () => {},
    }
  }
  // mock createChatSession:WS 连接用,prompt 立即 resolve(不调 LLM)
  const mockCreateChatSession = async () => ({
    prompt: async () => {},
    dispose: () => {},
    getSessionStats: mockStats,
    setModel: async () => {},
    // thinking 相关(ADR-0004 D8):session_init 推送时 serializeThinking 读 level + available。
    thinkingLevel: 'off' as const,
    getAvailableThinkingLevels: () => ['off'],
    setThinkingLevel: () => {},
  })

  const interaction = await createServer({
    kbRoot: vault.kbRoot,
    agentDir: vault.agentDir,
    sessions: {
      createChatSession: mockCreateChatSession as never,
      createIngestSession: mockCreateIngestSession as never,
    },
  })
  try {
    await interaction.app.listen({ port: 0, host: '127.0.0.1' })
    const address = interaction.app.server.address()
    const port = typeof address === 'object' && address ? address.port : null
    if (!port) throw new Error('listen 未拿到端口')

    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`)
    const msgs: string[] = []
    await new Promise<void>((resolve) => {
      const timer = setTimeout(resolve, 5000)
      ws.onopen = () => {
        // 等 session_init 后再上传,确保 chatSessions 已注册(否则 broadcast 无人收)
        setTimeout(async () => {
          await interaction.app.inject({
            method: 'POST',
            url: '/api/upload',
            headers: { 'content-type': 'multipart/form-data; boundary=b' },
            payload: multipart('b', 'test.md', '# Test\n\n内容\n'),
          })
        }, 200)
      }
      ws.onmessage = (ev: MessageEvent) => {
        msgs.push(typeof ev.data === 'string' ? ev.data : String(ev.data))
      }
      ws.onerror = () => {
        clearTimeout(timer)
        resolve()
      }
    })
    try {
      ws.close()
    } catch {
      /* ignore */
    }

    // 修复后:JSON.parse(d) 是对象,type='kb_updated'
    // bug 时:JSON.parse(d) 是字符串(双重编码),type 为 undefined,find 找不到 -> assert.ok 失败
    const kbUpdatedRaw = msgs.find((d) => {
      try {
        return (JSON.parse(d) as { type?: string }).type === 'kb_updated'
      } catch {
        return false
      }
    })
    assert.ok(kbUpdatedRaw, `应收到 kb_updated 消息;实际收到: ${JSON.stringify(msgs)}`)
    const parsed = JSON.parse(kbUpdatedRaw) as { type: string; total: number }
    assert.equal(typeof parsed, 'object', 'kb_updated 应为对象,不应是双重编码字符串')
    assert.equal(parsed.type, 'kb_updated')
    assert.equal(typeof parsed.total, 'number')
  } finally {
    await interaction.app.close()
    await fs.rm(vault.root, { recursive: true, force: true })
  }
})

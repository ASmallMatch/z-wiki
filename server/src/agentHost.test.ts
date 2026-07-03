import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import type { AgentSession } from '@earendil-works/pi-coding-agent'
import type { Api, Model } from '@earendil-works/pi-ai'
import { reloadAgentConfig, applyModelToSessions, type AgentContext } from './agentHost.js'

const mkTempAgentDir = async (): Promise<{ tmp: string; agentDir: string }> => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'zwiki-agent-'))
  const agentDir = path.join(tmp, '.pi/agent')
  await fs.mkdir(agentDir, { recursive: true })
  return { tmp, agentDir }
}

/** 构造 mock AgentContext:modelRegistry/authStorage 用 spy,agentDir 真实(验证 writeModelsJson)。 */
const mkMockCtx = (
  agentDir: string,
  opts: { findModel?: Model<Api> | undefined } = {},
): AgentContext => {
  const mockModel = opts.findModel
  return {
    agentDir,
    appRoot: path.dirname(path.dirname(agentDir)),
    config: { apiKey: '', baseUrl: '', api: 'openai-completions', model: '' },
    modelRegistry: {
      refresh: () => {},
      find: () => mockModel,
    },
    authStorage: { setRuntimeApiKey: () => {} },
  } as unknown as AgentContext
}

test('reloadAgentConfig: 写 models.json + refresh + setRuntimeApiKey + 更新 ctx.config + 返回 model', async () => {
  const { tmp, agentDir } = await mkTempAgentDir()
  try {
    const mockModel = { id: 'gpt-4o', provider: 'custom' } as unknown as Model<Api>
    const refreshCalls: number[] = []
    const setKeyCalls: Array<{ provider: string; key: string }> = []
    const ctx = {
      agentDir,
      appRoot: tmp,
      config: { apiKey: '', baseUrl: '', api: 'openai-completions', model: '' },
      modelRegistry: {
        refresh: () => {
          refreshCalls.push(1)
        },
        find: (provider: string, id: string) =>
          provider === 'custom' && id === 'gpt-4o' ? mockModel : undefined,
      },
      authStorage: {
        setRuntimeApiKey: (provider: string, key: string) => setKeyCalls.push({ provider, key }),
      },
    } as unknown as AgentContext

    const config = {
      apiKey: 'new-key',
      baseUrl: 'https://h/v1',
      api: 'openai-completions',
      model: 'gpt-4o',
    }
    const result = await reloadAgentConfig(ctx, config)

    assert.equal(result, mockModel, '应返回 resolveModel 找到的 model')
    assert.equal(refreshCalls.length, 1, 'modelRegistry.refresh 应被调一次')
    assert.deepEqual(
      setKeyCalls,
      [{ provider: 'custom', key: 'new-key' }],
      'setRuntimeApiKey 用 custom + 新 key',
    )
    assert.equal(ctx.config, config, 'ctx.config 应更新为新 config(后续 resolveModel 读最新)')

    // models.json 写入 agentDir(喂给 refresh 重读)
    const onDisk = JSON.parse(await fs.readFile(path.join(agentDir, 'models.json'), 'utf-8'))
    assert.equal(onDisk.providers.custom.models[0].id, 'gpt-4o')
  } finally {
    await fs.rm(tmp, { recursive: true, force: true })
  }
})

test('reloadAgentConfig: model 找不到 → 抛错(resolveModel 不吞)', async () => {
  const { tmp, agentDir } = await mkTempAgentDir()
  try {
    const ctx = mkMockCtx(agentDir, { findModel: undefined })
    const config = {
      apiKey: 'k',
      baseUrl: 'https://h/v1',
      api: 'openai-completions',
      model: 'unknown-model',
    }
    await assert.rejects(() => reloadAgentConfig(ctx, config), /模型未找到/)
  } finally {
    await fs.rm(tmp, { recursive: true, force: true })
  }
})

test('reloadAgentConfig: baseUrl 规范化兜底(generateModelsJson 内调 normalizeBaseUrl)', async () => {
  const { tmp, agentDir } = await mkTempAgentDir()
  try {
    const mockModel = { id: 'gpt-4o' } as unknown as Model<Api>
    const ctx = {
      ...mkMockCtx(agentDir, { findModel: mockModel }),
      // 覆盖 find 让它对 gpt-4o 返回 mockModel
      modelRegistry: {
        refresh: () => {},
        find: () => mockModel,
      },
    } as unknown as AgentContext

    // 手编 config 带 suffix(未经 writeConfig 规范化)
    const config = {
      apiKey: 'k',
      baseUrl: 'https://h/v1/chat/completions',
      api: 'openai-completions',
      model: 'gpt-4o',
    }
    await reloadAgentConfig(ctx, config)

    const onDisk = JSON.parse(await fs.readFile(path.join(agentDir, 'models.json'), 'utf-8'))
    assert.equal(
      onDisk.providers.custom.baseUrl,
      'https://h/v1',
      'models.json 的 baseUrl 应被规范化',
    )
  } finally {
    await fs.rm(tmp, { recursive: true, force: true })
  }
})

test('applyModelToSessions: 遍历所有 session.setModel(每个调一次)', async () => {
  const mockModel = { id: 'gpt-4o' } as unknown as Model<Api>
  const setModelCalls: unknown[] = []
  const sessions = Array.from({ length: 3 }, () => ({
    setModel: async (m: unknown) => {
      setModelCalls.push(m)
    },
  })) as unknown as AgentSession[]

  await applyModelToSessions(sessions, mockModel)

  assert.equal(setModelCalls.length, 3)
  for (const call of setModelCalls) {
    assert.equal(call, mockModel)
  }
})

test('applyModelToSessions: setModel 抛错 → reject(不吞,让调用方感知)', async () => {
  const mockModel = { id: 'gpt-4o' } as unknown as Model<Api>
  const sessions = [
    {
      setModel: async () => {
        throw new Error('No API key for custom/gpt-4o')
      },
    },
  ] as unknown as AgentSession[]

  await assert.rejects(() => applyModelToSessions(sessions, mockModel), /No API key/)
})

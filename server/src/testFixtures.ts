// testFixtures.ts - 集成测试共享辅助:临时 vault 构造 + 测试用 LLM 配置。
// vault.test.ts / upload.test.ts 共用,避免辅助漂移(DRY)。
// 非 .test.ts 故会被 server build 编译进 dist,但生产代码不引用,无副作用。

import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

/** 测试用 LLM 配置(假 apiKey,仅满足 config.json 结构,不发起真实网络调用)。 */
export const CONFIG_JSON = {
  apiKey: 'test-key',
  baseUrl: 'https://ark.cn-beijing.volces.com/api/coding',
  api: 'anthropic-messages',
  model: 'ark-code-latest',
}

export interface Vault {
  kbRoot: string
  agentDir: string
  root: string
}

/**
 * 构造临时 vault:kb/(可选 wiki 文件)+ .pi/agent/ + config.json(落 appRoot)。
 * 调用方在 finally 用 fs.rm(vault.root, { recursive: true, force: true }) 清理。
 */
export async function makeVault(wikiFiles: Record<string, string> = {}): Promise<Vault> {
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

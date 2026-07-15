// configReload.ts - 冷重载编排(Interaction sibling helper,类比 relayEvent.ts)。
// 把 POST /api/config/llm 的"写 config -> reload -> apply"编排从 interaction.ts 闭包外提,
// 可隔离测(mock agentCtx + mock sessions,验证顺序与双失败路径)。不广播 -- 广播是 Interaction 职责,
// 且 serializeThinking 依赖活跃 chat session(闭包状态),不入此模块。
//
// 这是 Interaction 的业务编排(workflow:序列 + 失败 staging),不是 AgentHost 的"pi SDK 封装/mechanism"。
// AgentHost 提供 primitive(updateConfig 写步 / reloadAgentConfig reload 步 / applyModelToSessions apply 步),
// 此处组合它们 + 给失败分 stage。不改 ADR-0001 的 AgentHost/Interaction seam。
import type { Api, Model } from '@earendil-works/pi-ai'
import type { AgentSession } from '@earendil-works/pi-coding-agent'
import {
  type AgentContext,
  applyModelToSessions,
  reloadAgentConfig,
  updateConfig,
} from './agentHost.js'
import type { ConfigJson } from './config.js'

export interface ReloadDeps {
  configPath: string
  agentCtx: AgentContext
  /** 取当前所有活跃 session(chat + ingest),reload 后遍历 setModel(不丢上下文,ADR-0004 D5)。 */
  getSessions: () => Iterable<AgentSession>
}

/**
 * 冷重载失败。区分 stage 供端点映射不同 HTTP 提示;config 已写盘(reload/apply 都在 updateConfig 之后)。
 *
 * 用 `reason` 而非 `cause`:ES2022 Error 已有内置 `cause?: unknown`,改用 reason 给端点类型安全的
 * `.message` 访问(无需窄化)。
 */
export class ConfigReloadError extends Error {
  constructor(
    readonly stage: 'reload' | 'apply',
    readonly reason: Error,
  ) {
    super(
      stage === 'reload'
        ? `配置已保存但重载失败:${reason.message}`
        : `配置已保存且重载成功,但部分会话换 model 失败:${reason.message}`,
    )
    this.name = 'ConfigReloadError'
  }
}

/**
 * 冷重载 LLM 配置(ADR-0004 D5):updateConfig(写 + readback 规范化)-> reloadAgentConfig
 * (writeModelsJson + refresh + setRuntimeApiKey + resolveModel)-> applyModelToSessions(遍历 setModel,
 * 不清 messages,对话上下文保留)。
 *
 * 成功返回新 model 供端点广播 session_init;失败抛 ConfigReloadError(stage),端点映射 HTTP。
 * mutator 编排不感知字段语义(改哪些字段由端点的 mutator 决定),此处只负责"写 -> reload -> apply"序列。
 */
export async function reloadLlmConfig(
  deps: ReloadDeps,
  mutator: (cfg: ConfigJson) => ConfigJson,
): Promise<Model<Api>> {
  const cfg = await updateConfig(deps.configPath, mutator)
  let model: Model<Api>
  try {
    model = await reloadAgentConfig(deps.agentCtx, cfg)
  } catch (err) {
    throw new ConfigReloadError('reload', err instanceof Error ? err : new Error(String(err)))
  }
  try {
    await applyModelToSessions(deps.getSessions(), model)
  } catch (err) {
    throw new ConfigReloadError('apply', err instanceof Error ? err : new Error(String(err)))
  }
  return model
}

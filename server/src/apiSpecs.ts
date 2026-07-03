// apiSpecs.ts — LLM api 规范元数据 manifest + baseUrl 规范化。
// 首版只暴露 openai-completions + anthropic-messages(覆盖自定义 OpenAI/Anthropic 兼容端点,
// 含 ark)。bedrock/google-vertex 等需 env/OAuth 的规范不在此列——它们的额外字段(region/
// projectId 等)无法从 models.json 喂入 pi(见 ADR-0004 D2),想用的人编辑 config.json 的
// exposedApiSpecs + 配 env var,绕过 UI。
import type { KnownApi } from '@earendil-works/pi-ai'

// ── manifest:UI 暴露的 api 规范 + 各自的 URL 后缀(用于 baseUrl 规范化)────────
// suffix = pi 底层 SDK 自动追加的 path:
//   openai SDK → new OpenAI({ baseURL }) + POST /chat/completions
//   anthropic SDK → new Anthropic({ baseURL }) + POST /v1/messages
// 用户若把完整 URL(含 suffix)粘进 baseUrl,写入时会被 normalizeBaseUrl 剥掉(ADR-0004 D3)。
export interface ApiSpecEntry {
  id: KnownApi
  /** UI 下拉框显示名。 */
  label: string
  /** pi SDK 自动追加的 path,用于 normalizeBaseUrl 剥尾部。 */
  suffix: string
}

export const API_SPECS: readonly ApiSpecEntry[] = [
  { id: 'openai-completions', label: 'OpenAI 兼容', suffix: '/chat/completions' },
  { id: 'anthropic-messages', label: 'Anthropic 兼容', suffix: '/v1/messages' },
] as const

/** 默认暴露的 api 规范(开箱即用,config.example.json 的 exposedApiSpecs 默认值)。 */
export const DEFAULT_EXPOSED_SPECS: KnownApi[] = ['openai-completions', 'anthropic-messages']

/**
 * 规范化 baseUrl:剥尾部已知 suffix + trailing slash(ADR-0004 D3)。
 * - 只剥 api 对应的 suffix(openai-completions 剥 /chat/completions,anthropic-messages 剥 /v1/messages)。
 * - 后缀跟 api 不匹配(如选 anthropic 但 URL 尾部是 /chat/completions)→ 不剥,原样返回。
 * - 未知 api(不在 API_SPECS,如 bedrock-converse-stream)→ 不处理。
 * - 不智能推断中间路径(如 /v1),只剥尾部。
 */
export function normalizeBaseUrl(baseUrl: string, api: string): string {
  const spec = API_SPECS.find((s) => s.id === api)
  if (!spec) return baseUrl
  const trimmed = baseUrl.trim()
  const withoutTrailingSlash = trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed
  const withoutSuffix = withoutTrailingSlash.endsWith(spec.suffix)
    ? withoutTrailingSlash.slice(0, -spec.suffix.length)
    : withoutTrailingSlash
  return withoutSuffix
}

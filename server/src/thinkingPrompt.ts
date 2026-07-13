// 思考语言约束 extension(ADR-0012):思考模式开启时,把 KB_THINKING_LANG_PROMPT
// 追加到该轮 system prompt;off 时不注入(无 thinking token 作用对象,段A 已约束输出语言)。
//
// 为什么用 before_agent_start 而非 appendSystemPrompt:appendSystemPrompt 是 resourceLoader
// 级、共享、buildAgentContext 时定死,拿不到 session 级 thinkingLevel;而思考模式状态是
// session 级的(setThinkingLevel 改单个 session)。before_agent_start 每轮触发,此时
// pi.getThinkingLevel() 已反映最新切换,故无状态读 level 即可。段B 与思考模式切换通过
// pi 事件闭环(需求3 setThinkingLevel -> 下一轮 before_agent_start 读新 level),无需 z-wiki 自己同步状态。
import type { ExtensionFactory } from '@earendil-works/pi-coding-agent'
import { KB_THINKING_LANG_PROMPT } from './prompt.js'

/** 思考语言注入 extension:仅当 thinkingLevel !== 'off' 时追加段B 到该轮 systemPrompt。 */
export const thinkingPromptFactory: ExtensionFactory = (pi) => {
  pi.on('before_agent_start', async (event) => {
    // off 时不注入段B:无 thinking token 作用对象,且段A(appendSystemPrompt)已约束输出语言。
    if (pi.getThinkingLevel() === 'off') return
    return { systemPrompt: `${event.systemPrompt}\n\n${KB_THINKING_LANG_PROMPT}` }
  })
}

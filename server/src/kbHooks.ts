// 知识库钩子:迁移自 share_wsl/.claude/settings.json 的两个钩子。
// - UserPromptSubmit → input 事件:未命中"外部知识"关键词时,transform 注入知识库模式引导语
// - Stop → agent_end 事件:检测 wiki/raw 有变更时,记录日志(server 侧)并提醒
//
// 通过 DefaultResourceLoader({ extensionFactories }) 内联注入,无需独立 .pi/extensions 文件。
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import type { ExtensionFactory } from '@earendil-works/pi-coding-agent'
import { SUBSEAM_DIRS, isRawPath } from './kbLayout.js'
import { ALLOWED_UPLOAD_EXTS } from './uploadExts.js'

// 命中以下任一关键词则视为用户主动要求外部知识,不注入引导
const EXTERNAL_KW =
  /(外部知识|外部资源|搜索网络|web.?search|网上搜索|google|bing|搜索引擎|联网|在线查询|fetch|抓取|爬取|external|internet|在线)/i

const KB_GUIDE =
  '⚠️ 知识库模式:用户未指定使用外部知识,请优先按照知识库工作流执行' +
  '(读 index.md → 定位 wiki/raw → 合成回答 → 判断回写 → 更新 log.md → 触发 build)。如需外部信息,先确认用户意图。'

/** 检测 kb/ 下 sub-seam 是否有变更(git status)。cwd 是 KB_ROOT。返回变更摘要或 null。 */
function detectKbChanges(cwd: string): string | null {
  try {
    const out = execFileSync(
      'git',
      ['-C', cwd, 'status', '--porcelain', ...SUBSEAM_DIRS.map((d) => `${d}/`)],
      { encoding: 'utf-8', timeout: 5000 },
    ).trim()
    return out || null
  } catch {
    return null
  }
}

/** 写操作的目标路径落入 raw/ 则拦截(ADR-0002 决策 2)。cwd 即 kb/ 根(agent cwd = kbRoot)。 */
function isWriteToRaw(filePath: string, cwd: string): boolean {
  if (!filePath) return false
  const abs = path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath)
  return isRawPath(abs, cwd)
}

/**
 * 判断 read 工具是否应拦截(ADR-0011):非 md 的 pandoc 可转格式用 pandoc 工具,
 * read 读会拿二进制乱码。后缀在 ALLOWED_UPLOAD_EXTS 且非 .md -> block。
 * .md 放行;非白名单后缀(如 .txt)放行(read 能读纯文本)。纯函数,便于单测。
 */
export function shouldBlockRead(filePath: string): { reason: string } | null {
  if (!filePath) return null
  const ext = path.extname(filePath).toLowerCase()
  if (!ext || ext === '.md') return null
  if (ALLOWED_UPLOAD_EXTS.includes(ext)) {
    return {
      reason: `${ext} 是非 md 文件,read 会拿二进制乱码。请用 pandoc 工具转文本:pandoc({ filePath: "<路径>" })。`,
    }
  }
  return null
}

/** 知识库钩子 extension factory。 */
export const kbHooksFactory: ExtensionFactory = (pi) => {
  // input 事件:用户输入进 agent loop 前拦截
  pi.on('input', async (event) => {
    // 后台 ingest agent 自己注入的消息(source=extension)不再二次引导
    if (event.source === 'extension') {
      return { action: 'continue' }
    }
    if (EXTERNAL_KW.test(event.text)) {
      return { action: 'continue' }
    }
    return { action: 'transform', text: `${event.text}\n\n${KB_GUIDE}` }
  })

  // agent_end 事件:回合结束,检测知识库变更
  pi.on('agent_end', async (_event, ctx) => {
    const changes = detectKbChanges(ctx.cwd)
    if (changes) {
      // 第一阶段(1:1 迁移):仅记录,不自动 build。
      // build 由 server 在 WS relayEvent 的 agent_end 时统一触发(任务4)。
      // 这里通过 ctx.ui.notify 提醒(若有 UI);无 UI 时静默,日志走 stderr。
      try {
        ctx.ui?.notify('知识库有变更,记得更新 log.md', 'info')
      } catch {
        /* 无 UI 模式忽略 */
      }
    }
  })

  // tool_call 事件:拦 read 对非 md(ADR-0011,提示用 pandoc 工具)+ write/edit 对 raw/ 的写(raw/ 只读,ADR-0002 决策 2)
  pi.on('tool_call', async (event, ctx) => {
    if (event.toolName === 'read') {
      const input = event.input as { file_path?: string; path?: string }
      const filePath = input.file_path ?? input.path ?? ''
      const block = shouldBlockRead(filePath)
      if (block) return { block: true, reason: block.reason }
    }
    if (event.toolName !== 'write' && event.toolName !== 'edit') return
    const filePath = (event.input as { file_path?: string }).file_path
    if (filePath && isWriteToRaw(filePath, ctx.cwd)) {
      return {
        block: true,
        reason:
          'raw/ 是只读源(raw/ is read-only Source)。原始来源不可修改;如需修订内容,请写到 wiki/ 或 output/。',
      }
    }
  })
}

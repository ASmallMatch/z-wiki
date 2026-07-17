// 知识库钩子:迁移自 share_wsl/.claude/settings.json 的两个钩子。
// - UserPromptSubmit → input 事件:未命中"外部知识"关键词时,transform 注入知识库模式引导语
// - Stop → agent_end 事件:检测 wiki/raw 有变更时,记录日志(server 侧)并提醒
//
// 通过 DefaultResourceLoader({ extensionFactories }) 内联注入,无需独立 .pi/extensions 文件。
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import type { ExtensionFactory } from '@earendil-works/pi-coding-agent'
import { SUBSEAM_DIRS, isRawPath, isWithinKb, isWritablePath } from './kbLayout.js'
import { ALLOWED_UPLOAD_EXTS, PLAINTEXT_EXTS } from './uploadExts.js'

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

/**
 * 读工具(read/grep/find/ls)路径越界检查(ADR-0016):解析 agent 传入路径,落在 kb/ 外 -> block。
 * 读边界含 raw/(ingest 要读 raw/),用 isWithinKb。空/缺失放行(默认 cwd=kb/,安全)。纯函数,便于单测。
 */
export function shouldBlockReadPath(
  filePath: string | undefined,
  cwd: string,
): { reason: string } | null {
  if (!filePath) return null
  const abs = path.resolve(cwd, filePath)
  if (!isWithinKb(abs, cwd)) {
    return {
      reason: `路径 ${abs} 在当前知识库目录(kb/)之外。工具仅限操作当前知识库,请用相对 cwd 的路径(如 "wiki/01-x.md")。`,
    }
  }
  return null
}

/**
 * 写工具(write/edit)路径越界检查(ADR-0016):raw/ -> block(只读源,ADR-0002 决策 2);
 * kb/ 外 -> block(越界)。空/缺失放行(默认 cwd=kb/,安全)。纯函数,便于单测。
 */
export function shouldBlockWritePath(
  filePath: string | undefined,
  cwd: string,
): { reason: string } | null {
  if (!filePath) return null
  const abs = path.resolve(cwd, filePath)
  if (isRawPath(abs, cwd)) {
    return {
      reason:
        'raw/ 是只读源(raw/ is read-only Source)。原始来源不可修改;如需修订内容,请写到 wiki/ 或 output/。',
    }
  }
  if (!isWritablePath(abs, cwd)) {
    return {
      reason: `路径 ${abs} 在当前知识库目录(kb/)之外。工具仅限操作当前知识库,请用相对 cwd 的路径(如 "wiki/01-x.md")。`,
    }
  }
  return null
}

/**
 * 判断 read 工具是否应拦截(ADR-0011 + ADR-0018):pandoc 可转格式用 pandoc 工具,
 * read 读会拿二进制乱码。后缀在 ALLOWED_UPLOAD_EXTS 且非 md/纯文本 -> block。
 * .md 与纯文本(.txt/.text/.log,PLAINTEXT_EXTS)放行 read 直读;其他非白名单后缀(如 .bin)也放行。纯函数,便于单测。
 */
export function shouldBlockRead(filePath: string): { reason: string } | null {
  if (!filePath) return null
  const ext = path.extname(filePath).toLowerCase()
  if (!ext || ext === '.md' || PLAINTEXT_EXTS.includes(ext)) return null
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

  // tool_call 事件(ADR-0011 + ADR-0016):
  // - read:非 md 后缀 block(提示 pandoc)+ 路径越界 block
  // - grep/find/ls:路径越界 block(读边界=kb/ 内含 raw/)
  // - write/edit:raw/ 写 block(只读源)+ 路径越界 block(写边界=kb/ 内非 raw/)
  pi.on('tool_call', async (event, ctx) => {
    const { toolName } = event

    if (toolName === 'read') {
      const input = event.input as { file_path?: string; path?: string }
      const filePath = input.file_path ?? input.path ?? ''
      const pathBlock = shouldBlockReadPath(filePath, ctx.cwd)
      if (pathBlock) return { block: true, reason: pathBlock.reason }
      const suffixBlock = shouldBlockRead(filePath)
      if (suffixBlock) return { block: true, reason: suffixBlock.reason }
    }

    if (toolName === 'grep' || toolName === 'find' || toolName === 'ls') {
      const filePath = (event.input as { path?: string }).path
      const block = shouldBlockReadPath(filePath, ctx.cwd)
      if (block) return { block: true, reason: block.reason }
    }

    if (toolName === 'write' || toolName === 'edit') {
      const filePath = (event.input as { file_path?: string }).file_path
      const block = shouldBlockWritePath(filePath, ctx.cwd)
      if (block) return { block: true, reason: block.reason }
    }
  })
}

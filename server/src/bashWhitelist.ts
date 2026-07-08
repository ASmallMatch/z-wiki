// bash 命令白名单(ADR-0007 决策 2):agent 的 bash 工具仅限文档解析(pandoc),
// 禁 shell 元字符防 `pandoc x; rm -rf` 绕过。由 kbHooks 的 tool_call 事件调用,物理 block 非白名单命令。

const ALLOWED_COMMANDS = new Set(['pandoc'])

// shell 元字符:命令分隔(; 换行)、管道(|)、逻辑(&)、重定向(< >)、
// 命令替换/子 shell(( ) $ `)。引号不禁(文件名含空格用引号;$ 已禁,`"$(rm)"` 会被 $ 命中)。
const SHELL_METACHARS = /[;|&<>()$`\n]/

export interface BashWhitelistResult {
  ok: boolean
  reason?: string
}

/** 判定 bash 命令是否在文档解析白名单内。纯函数,不碰 fs/pi。 */
export function isAllowedBashCommand(command: string): BashWhitelistResult {
  const cmd = command.trim()
  if (!cmd) {
    return { ok: false, reason: 'bash 命令为空' }
  }

  // 禁 shell 元字符:防止 `pandoc x; rm -rf`、`pandoc x | grep`、`$(rm)` 等绕过
  if (SHELL_METACHARS.test(cmd)) {
    return { ok: false, reason: 'bash 禁止 shell 元字符(; | & < > ( ) $ ` 换行),仅限单条命令' }
  }

  // 白名单:只放行 pandoc 开头(agent read 工具已能读纯文本,无需 cat)
  const firstToken = cmd.split(/\s+/)[0]
  if (!ALLOWED_COMMANDS.has(firstToken)) {
    return {
      ok: false,
      reason: `bash 仅限文档解析命令(${[...ALLOWED_COMMANDS].join('/')}),禁止 ${firstToken}`,
    }
  }

  return { ok: true }
}

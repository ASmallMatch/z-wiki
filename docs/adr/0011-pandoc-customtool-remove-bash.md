# ADR-0011: pandoc 走 customTool,bash+白名单移除

- 状态:accepted
- 日期:2026-07-13
- 关联:supersedes ADR-0007 决策 2;extends ADR-0003 D6

ADR-0007 决策 2 让 agent 经 pi bash 工具(走 `/bin/sh -c`)调 pandoc,kbHooks 白名单拦元字符/非 pandoc 命令。但 bash 经 shell 执行,元字符注入面真实存在(`pandoc x; rm -rf`),白名单是在 shell 层之上打补丁。改:pandoc 走 customTool(`makePandocTool`),`execute` 里 `spawn(pandocBin, args)` argv 不经 shell,从根上无注入面,bashWhitelist 整层删除。bash 工具彻底移除(回到 ADR-0003 D6 默认),`AGENT_TOOLS` 去 `'bash'` 加 `'pandoc'`。kbHooks 加 `read` 拦非 md(后缀在 `ALLOWED_UPLOAD_EXTS` 且非 `.md` -> block,提示用 pandoc 工具),防 agent 用 read 读 docx 拿二进制乱码。

## Considered Options

- **customTool spawn(选)**:argv 不经 shell,无注入面;参数 schema 化(`{ filePath, from?, to=markdown }`);删白名单层。代价:失去 pi bash 的 stdout 截断/超时/进程管理(自写最小版)。
- **bash+白名单(被取代,ADR-0007 决策 2)**:复用 pi bash 现成能力,LLM 拼命令灵活。但 shell 注入面在,白名单是补丁;LLM 灵活度对固定用法(转 markdown)是多余的。

## Consequences

- `bashWhitelist.ts` + 测试删除;`makeBashTool` + spawnHook 删除;kbHooks bash 白名单分支删除。
- `AGENT_TOOLS` 从 `['read','edit','write','grep','find','ls','bash']` 改为 `['read','edit','write','grep','find','ls','pandoc']`;chat/ingest 的 customTools 以 `makePandocTool` 替 `makeBashTool`。
- kbHooks `tool_call` 加 `read` 分支(拦非 md),与 write/edit 拦 raw/ 同构。
- ingest/系统 prompt:`bash: pandoc raw/x.docx -t markdown` -> `pandoc` 工具调用。
- pandoc 二进制定位(ADR-0007 决策 3 内置)不变,从 spawnHook 注入 PATH 改为 customTool spawn 绝对路径。

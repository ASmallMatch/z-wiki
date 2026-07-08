Status: ready-for-agent

# 01 — docx 上传→编译端到端 tracer bullet(开发形态)

## Parent

ADR-0007(`docs/adr/0007-non-md-bash-pandoc.md`)—— 非 md 上传走 bash+pandoc 的总决策。

## What to build

打通最窄端到端通路:用户在聊天区上传 `.docx` → 归档到 `raw/` → ingest agent 用 bash 调 pandoc 转成 md 文本 → 按 Ingest 工作流编译进 wiki → 可视层可见。

这是 tracer bullet:通路要端到端跑通 docx,各环节可粗糙,但必须 demoable。**先落安全地基(bash 白名单纯函数 + 单测),再接端到端**——白名单单测作为本 slice 第一步先落地,可独立 `npm test` 验证,不依赖 pandoc/pi。

实现要点(决策已在 ADR-0007 定,此处只点落点):

- **bash 白名单纯函数 + 单测(先做,安全地基)**:导出判定函数,入参 command 字符串,返回 `{ ok: boolean; reason?: string }`。规则:只放行 `pandoc` 开头的单条命令(agent read 已能读纯文本,无需 cat);禁止 shell 元字符(`;` `&&` `||` `|` `$()` `` ` `` `>` `<`),防止 `pandoc x; rm -rf` 绕过。纯函数,不依赖 pandoc/pi。单测覆盖三类:白名单放行(`pandoc raw/x.docx -t markdown`)、含元字符 block(`pandoc x; rm -rf` / `pandoc x | grep` / `$(rm)`)、非白名单 block(`rm -rf` / `cat /etc/passwd`)。
- **pandoc 开发形态下载管理**:查平台 → 从 jgm/pandoc GitHub releases 下载对应便携包(linux tar.gz / macos zip / windows zip)→ 解压到 UserDataDir/bin。pi 的 `ensureTool` 硬编码 `"fd" | "rg"` 不能复用,自行实现。
- **bash 工具注册**:当前 `AGENT_TOOLS` 是字符串数组(`agentHost.ts`)。改为 `customTools: [createBashToolDefinition(cwd, { spawnHook })]` 注册 bash——字符串 `'bash'` 无 spawnHook 配置入口。spawnHook 注入 UserDataDir/bin 到 `env.PATH`,让 pandoc 可达。
- **kbHooks 接白名单**:在 `kbHooks` 的 `tool_call` 事件里,对 `toolName === 'bash'` 调白名单纯函数,非白名单返回 `{ block: true, reason }`(复用现有 write/edit 拦截模式,`kbHooks.ts`)。
- **`/api/upload` 收 .docx**(`interaction.ts`):去掉"仅 .md"校验,改为白名单含 .docx,落 raw/。
- **前端 ChatPanel accept 加 .docx**(`ChatPanel.tsx` 的 `accept=".md"`)。
- **ingest prompt 引导**(`prompt.ts`):对非 md 文件,引导 agent 用 `pandoc raw/x.docx -t markdown` 读文本(而非 `read`,`read` 读非 md 拿二进制乱码)。可选:kbHooks 拦 `read` 对非 md 后缀,提示改用 bash pandoc。
- **buildView 适配 raw/ 异质**:raw/ 不再全是 md(混 .docx),`buildView` 遍历 raw/ 时跳过非 md。

## Acceptance criteria

- [ ] bash 白名单纯函数 + 单测通过(放行 / 元字符绕过 block / 非白名单 block 三类 case)
- [ ] pandoc 开发形态下载管理:首次用 bash 解析时自动下载对应平台 pandoc 到 UserDataDir/bin
- [ ] bash 经 `customTools` 注册 + spawnHook 注入 PATH,pandoc 在 bash 里可达
- [ ] kbHooks 对 bash 非白名单命令物理 block(`{ block: true }`)
- [ ] `/api/upload` 收 .docx 落 raw/(不再 415)
- [ ] 前端 accept 含 .docx,文件选择器可选 docx
- [ ] ingest agent 对 `raw/` 的 docx 用 bash pandoc 转 md 并编译进 wiki
- [ ] buildView 跳过 raw/ 非 md(不报错、不混入可视)
- [ ] 端到端 demo:上传 docx → 可视层出现编译产物
- [ ] `make typecheck` + `make lint` + `npm test` 通过

## Blocked by

None — 可立即开始。

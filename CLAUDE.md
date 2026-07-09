# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 架构契约(必读)

z-wiki 是三层架构 + 已落地的架构决策。**改任何架构前,先读 `CONTEXT.md`(领域词汇)与 `docs/adr/`(决策记录),不要重新 litigate 已定决策。**

- `CONTEXT.md` —— 领域词汇表(layer1/2/3、sub-seam、桌面形态术语)。输出里用词不要漂移成 service/component/api。
- `docs/adr/0001-server-seams.md` —— server 内部 seam:AgentHost(pi SDK 封装)+ Interaction(编排+HTTP+WS),buildView 走 HTTP 不写盘。
- `docs/adr/0002-layer1-contract.md` —— layer1 契约:`kb/` 收拢、`raw/` 只读走代码(kbHooks 拦 write/edit)、sub-seam 命名集中在 `kbLayout.ts`。
- `docs/adr/0003-desktop-form.md` —— 桌面化决策(Electron + 不破坏三层)。
- `docs/adr/0004-llm-config.md` —— LLM 配置:干掉 provider 预设,`baseUrl`/`api`/`model`/`apiKey` 可配。
- `docs/adr/0005-theme-system.md` —— 主题系统(明暗 + 陶土浅色)。
- `docs/adr/0006-draft-clay-accent-and-shelf-theming.md` —— Draft 陶土橙 accent + 书架随主题浅化。
- `docs/adr/0007-non-md-bash-pandoc.md` —— 非 md 上传走 bash+pandoc(agent 侧按需转,bash 白名单限 pandoc)。
- `docs/adr/0008-platform-branches-keep-inline.md` —— 平台分支就地判断,不抽平台分发表/统一 adapter。

三层物理边界不动:`kb/`(layer1 数据)/ `web/`(layer2 SPA)/ `server/`(layer3 Fastify+pi agent)各自独立,不互写文件系统。桌面化是在三层之外加 `desktop/` shell,不穿透。

## 常用命令

```bash
make dev          # 同时启动 server(:3000)+ web(:5173),开发模式
make typecheck    # 全量类型检查(server + web + scripts + desktop 四个 tsconfig)
npm test          # 跑 server + desktop 的 *.test.ts(tsx --test)
make lint         # Biome lint(不修改)
make format       # Biome 格式化(写入)
make health       # 知识库健康检查(断链/孤儿/空文件)
make build        # 构建前端 + 后端产物
make desktop      # 构建 web+server+desktop 并启动 Electron 桌面壳
```

`make typecheck` 抓类型错误(server + web + scripts + desktop 四个 tsconfig),`make lint` 抓风格/质量问题(a11y、非空断言等)。改完代码先跑 `make typecheck` 与 `make format`。

## 非显然约定

- **`kb/` gitignored,由 agent 维护**。起步用 `cp -r kb_example kb`。server 启动检查 `kb/` 存在,缺失即报错。不要把 `kb/` 内容提交。
- **agent 的 cwd = `kb/`**。prompt 与工具调用里的路径都相对 `kb/`(如 `read wiki/01-x.md`)。改 `agentHost.ts` 的 cwd 会破坏 prompt 路径语义。
- **buildView 是纯函数**:只读 fs 返回 `{pages, fragments}`,**不写盘**。可视数据由 Interaction 内存缓存经 `/api/pages` 暴露。不要再加写盘逻辑。
- **`config.json` 是单一真相源**(ADR-0003 D3.1 + ADR-0004):含 `apiKey`/`baseUrl`/`api`/`model`/`contextWindow`/`vaults`/`currentVault`/`shellPath`(无 `provider`,已删)。dev 形态放项目根(从 `config.example.json` 复制起步),桌面形态放 UserDataDir。`buildAgentContext` 从 appRoot(= agentDir 上两级)读它,启动生成 `.pi/agent/models.json`(派生产物),apiKey 经 `setRuntimeApiKey` 运行时注入——**`auth.json` 不落盘**。不再读 `.env`。
- **`raw/` 只读是双层防御**:prompt 引导(第一道)+ `kbHooks` 的 tool_call 拦截(兜底):write/edit 拦 raw 写,bash 走白名单(只放行 `pandoc`、禁元字符,ADR-0007)。
- **pi agent 工具集含 bash**(ADR-0003 D6 基线 + ADR-0007 扩展):`tools: ["read","edit","write","grep","find","ls","bash"]`。bash 经 `bashWhitelist.ts` 限定为单条 `pandoc`(禁元字符),用于非 md 源按需转文本;agent 不是通用 shell。

## 代码风格

- TypeScript ESM(`type: module`)。**无分号,单引号,2 空格缩进**——由 `biome.json` 强制,改完跑 `make format`。
- 注释用中文。commit message 用 conventional commits(`fix(server): ...`),直接提交 `main`。
- 改现有文件时若风格不符,先跑 `make format` 统一,再改逻辑,避免格式 diff 混入逻辑 diff。

## Worktree 注意

当前可能在 git worktree 下。所有命令在当前目录跑,**不要 `cd` 到主仓库**。git stash 与主仓库共享,不要用裸 `git stash`/`git stash pop`(可能 pop 其他 session 的改动)。

`biome.json` 的 `files.includes` 已排除 `!**/.claude/worktrees`,避免 worktree 嵌套 `biome.json` 阻塞 `make lint`/`make format`。

## Agent skills

### Issue tracker

Issues 与 PRD 以 markdown 文件形式存在 `.scratch/<feature-slug>/` 下。详见 `docs/agents/issue-tracker.md`。

### Triage labels

五个角色用默认字符串(needs-triage / needs-info / ready-for-agent / ready-for-human / wontfix)。详见 `docs/agents/triage-labels.md`。

### Domain docs

Single-context:`CONTEXT.md` + `docs/adr/` 在仓库根。详见 `docs/agents/domain.md`。

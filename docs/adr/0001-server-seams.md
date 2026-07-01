# ADR-0001: server 内部 seam —— buildView 走 HTTP、AgentHost 窄封装

- 状态:accepted
- 日期:2026-07-01
- 范围:server/src/ 内部模块边界(对应三层理想的 layer3 拆分)

## 背景

z-wiki 早期 server 是单 module:`index.ts` 同时承担 Fastify 接入、WS 事件桥、上传归档、ingest 编排、`triggerBuild`,并直接把 buildView 产物写进 `web/public/`(layer2 的目录)。`agent.ts` 封装 pi SDK。

两层耦合:
1. **layer3→layer2 文件系统焊死** —— `buildView` 硬编码 `path.join(projectRoot, "web", "public")` 写盘,server 必须知道 web 目录结构。
2. **Interaction 与 pi SDK 混杂** —— `index.ts` 既管 HTTP/WS,又直接编排 agent session,无法脱离 LLM 单测。

## 决策

### 决策 1:buildView 是纯函数,产物经 HTTP 暴露,不再写盘

`buildView(projectRoot)` 改为无状态纯函数,返回 `{ pages: PageMeta[], fragments: Map<stem, html> }`,不接触文件系统写入。

Interaction 持有内存缓存,`agent_end` 后调 buildView 刷新缓存;HTTP 暴露:
- `GET /api/pages` —— pages 索引
- `GET /api/pages/:stem` —— 文章 html 片段

web 运行时 fetch 这两个端点(vite proxy 已有 `/api`)。

**为什么不是构建步骤写静态文件**:那样 seam 落在文件位置约定,server 仍耦合 web 目录。HTTP 接口让 seam 落在可测、可 mock 的窄 interface,server 不再知道 web 的存在。个人知识库规模小,全量内存缓存可接受(YAGNI 按需现算)。

**变更判断**:buildView 不返回 `changed`。"是否广播 kb_updated"是 Interaction 的业务判断 —— `hasIndexChanged` 对比新旧 fragments(逐项内容)。之所以对比 fragments 而非 pages 索引:`PageMeta.updated` 截断到天,同日编辑会使索引序列化不变、漏判;而 pages 的 title/summary/toc 都是 fragment 内容的派生,对比 fragments 充分且正确。比对逻辑放 Interaction(缓存持有者),不放 buildView(否则逼它持状态,破坏纯函数)。

### 决策 2:AgentHost 窄封装,runIngest / triggerBuild 归 Interaction

- **AgentHost**(`agentHost.ts`) = pi SDK 的全部封装:`buildAgentContext` + `createChatSession`/`createIngestSession` 工厂 + `withFileLock`。不知道 web、HTTP、广播的存在。
- **Interaction**(`interaction.ts`) = 一切外部接入 + 业务编排:Fastify、WS 桥、text_delta 攒批、`/api/upload`、`runIngest`、`triggerBuild`、内存缓存、广播。通过 AgentHost 的窄 interface 碰 agent。

`runIngest` 归 Interaction 而非 AgentHost:ingest 是"用 agent 做业务"的编排,与 chat 同为 agent session 的用法,差异只在 prompt/触发源。AgentHost 只提供 session 工厂,不参与业务编排。

**为什么不让 ingest 成为独立 agent 角色/服务**:chat 与 ingest 共享同一 system prompt、同一工具集、同一 resourceLoader,真实差异仅 prompt 与持久化路径。两套配置是 premature structure。AgentHost 提供工厂,Interaction 用不同 prompt 唤起 —— 这是当前真实复杂度。

## 测试边界(the interface is the test surface)

- `buildView` 纯函数单测:fixture 目录 → 断言输出结构(frontmatter view 过滤、output ≥30 行、TOC、wikilink)。这是决策 1 的 seam 契约。
- `hasIndexChanged(oldPages, newPages)` 纯函数单测:决策 1 的广播判断。
- AgentHost 暂不单测:它包的是 pi SDK,测它等于测第三方,mock 成本高收益低。其正确性由 Interaction 集成时验证。
- WS/HTTP 集成暂不测:mock 成本高,YAGNI。

## 文件结构

`server/src/` 扁平 6 文件(不建子目录,文件数不够多):
- `buildView.ts` —— 纯函数
- `agentHost.ts` —— pi SDK 封装(原 agent.ts)
- `interaction.ts` —— 编排主体(从 index.ts 抽出)
- `kbHooks.ts` —— 不变
- `prompt.ts` —— 不变
- `index.ts` —— 薄入口,只 app 装配 + listen

## 后果

- server 不再写 `web/public/`,`.gitignore` 与 `Makefile clean` 中 `web/public/pages` 相关条目删除。
- web 的 `useData.ts` fetch 路径:`/pages.json` → `/api/pages`、`/pages/${stem}.html` → `/api/pages/${stem}`。
- 生产前端静态托管(@fastify/static)仍待打包阶段接入,本 ADR 不涉及。
- 后续 ③(layer1 sub-seam 命名)、④(layer1 可强制 interface)若与此 ADR 冲突,另起 ADR。

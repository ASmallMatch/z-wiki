Status: ready-for-agent

# wikilink 点击拦截 + Article 404 兜底(接线)

## What to build

新建 `web/src/hooks/useWikiLinkNav.ts`:容器点击委托 hook。在 Article prose 容器与 ChatPanel 消息容器各挂一份。

hook 行为:

- 委托监听容器内 `a.wl` 点击。
- 修饰键放行:`e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey` -> 不拦截,让浏览器原生新标签页打开(配合 SPA fallback)。
- pages 为空(loading)-> 放行 navigate 不 tip。
- 提取 href(`/pages/${p}` 形式)解析 stem。
- `stem ∈ pages` -> `navigate('/pages/'+stem)`(SPA 内跳转,不刷新)。
- 不在 -> `show('该页未在书本中')` + `preventDefault`,不跳转。

接入:

- **App.tsx**:`pages` prop drilling 透传 `ChatDrawer` -> `ChatPanel`(ChatDrawer/ChatPanel 加 `pages` prop)。
- **Article.tsx**:挂 `useWikiLinkNav(proseRef, pages)`。
- **ChatPanel.tsx**:消息容器加 ref,挂 `useWikiLinkNav(containerRef, pages)`。
- **Article.tsx 404 兜底**:`usePageContent` 收 404 / `content === null && !loading` -> 渲染"该页未在书本中"提示(覆盖新标签页/分享链接打开断链)。

## Acceptance criteria

- [ ] `web/src/hooks/useWikiLinkNav.ts` 新建,导出 `useWikiLinkNav(containerRef, pages)`
- [ ] 修饰键(Ctrl/Cmd/Shift/Alt + 中键)点击放行原生行为,左键才拦截
- [ ] pages 为空时放行 navigate 不 tip
- [ ] 左键点正常 wikilink -> SPA 内 `navigate('/pages/'+stem)`,不整页刷新
- [ ] 左键点导航页/断链 wikilink -> `preventDefault` + `show('该页未在书本中')`,不跳转
- [ ] Article `proseRef` 容器挂拦截器
- [ ] ChatPanel 消息容器挂拦截器,`pages` 经 App->ChatDrawer->ChatPanel 透传
- [ ] Article 404 兜底:`usePageContent` 404/null(非 loading)-> 渲染"该页未在书本中"
- [ ] 新标签页打开 `/pages/00-知识库导航` -> Article 兜底提示(非空白卡住)
- [ ] `make typecheck` 通过;`make format` 无 diff;`npm test` 全绿

## 不测

DOM 事件委托 + react-router navigate,无 web 组件测试基础设施。手动验证三类链接(正常/导航页/断链)× 两种路径(左键/新标签页)。

## Blocked by

- 01 - markdown.ts href 修正(拦截器解析 `/pages/` 前缀的 href)
- 02 - useToast 组件(拦截器与 404 兜底调 `show`)

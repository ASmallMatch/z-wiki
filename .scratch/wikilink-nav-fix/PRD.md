Status: ready-for-agent

# wikilink 点击导航修复(SPA 内跳转 + 不存在页 tip 兜底)

## Problem Statement

`server/src/markdown.ts:26-31` 把 wikilink `[[XX]]` / `[[XX|label]]` 渲染成 `<a href="./XX.html" class="wl">label</a>`。但 web 是 react-router SPA,文章路由是 `/pages/:stem`(`web/src/App.tsx`,无 `.html`、无 `*.html` 通配)。web 层无任何点击拦截,点这个 `<a>` 就是浏览器原生整页跳转到 `./XX.html`--相对当前 `/pages/YY` 解析成 `/pages/XX.html`,既不在路由表、磁盘也无此文件,404/报错。

`markdown.ts` 前后端共用(`buildView` 编译 wiki 文章正文 + `ChatPanel` 渲染 chat 回复),故文章正文与 chat 回复里的 wikilink 都受影响。

导航页 `00-知识库导航` 叠加第二层:ADR-0010 把它从 `buildView.shouldPublish` hardcode 排除(`buildView.ts:102`),即使路由修对,`/pages/00-知识库导航` 也无可视数据 -> 空页。

## Solution

三层修复:

1. **href 语义修正**:`markdown.ts` wikilink href `./${p}.html` -> `/pages/${p}`(`raw/` 纯文本分支不动)。`.html` 后缀是旧 Python 静态站遗留,可视层已走 HTTP(ADR-0001),无指代对象。
2. **SPA 点击拦截**:新建 `useWikiLinkNav` hook,在 Article prose 容器与 ChatPanel 消息容器各挂一份点击委托。提取 `a.wl` href 解析 stem -> 查 pages -> 在则 `navigate('/pages/'+stem)` SPA 内跳转,不在则 tip 不跳转。
3. **tip 兜底(主题化 toast)**:新建 `useToast`(Provider + hook,对齐 `useTheme.tsx`)。stem 不在 pages 时 `show('该页未在书本中')`,底部居中、2.5s 自动消失、可点击关闭、单条覆盖、主题变量随 Archive/Draft 切换。Article 加 404 兜底(`usePageContent` 收 404 / content=null 且非 loading -> 同款提示),覆盖新标签页/分享链接打开断链。

## Implementation Decisions

### 决策 1:修复策略 = C(改 href + 拦截器)

改 href 成 `/pages/${p}`(语义正确、可右键复制、无障碍)+ 挂点击拦截走 SPA 导航不刷新。纯改 href 不够(BrowserRouter 下原生 `<a>` 整页刷新丢 SPA 状态);纯拦截不改 href 留 `./XX.html` 误导形式。C 两者一起收拾。

### 决策 2:tip 触发时机 = a1(拦截器当场判断)

拦截器同步查 `stem ∈ pages`,不在就 tip 不跳转。优于 a2(navigate 后 Article 检测 404):即时反馈、不跳转不闪屏、不污染浏览器历史;chat 里点断链原地冒 tip 不被踢到空 Article。chat 侧当前不可达 pages(`usePages` 无缓存,裸调重复请求),故 `pages` 从 App prop drilling 透传(`App`->`ChatDrawer`->`ChatPanel`),沿用既有数据流模式,不引入 PagesContext(YAGNI,两消费者)。

tip 文案统一"该页未在书本中",不区分导航页 vs 断链(用户视角都是"点不开",web 侧不 hardcode 导航页 stem,那是 buildView 的事)。

### 决策 3:toast 组件设计

`ToastProvider` + `useToast()` hook,对齐 `useTheme.tsx`。App 顶层挂 Provider(`ThemeProvider` 内)。底部居中(避开 header / FloatingActions 右下 / chat 输入框)。2.5s 自动消失 + 可点击关闭,不做悬停暂停。单条覆盖(新替旧)。主题变量(`--surface-alt`/`--text`/`--border`/`--shadow-md`/`--r-md`)随主题切换。文件 `web/src/hooks/useToast.tsx`。

### 决策 4:拦截器形态

抽 `useWikiLinkNav(containerRef, pages)` hook(Article + ChatPanel 复用,DRY),内部 `useNavigate()` + `useToast()`。修饰键(Ctrl/Cmd/Shift/Alt + 中键)放行给浏览器原生新标签页(配合已有 SPA fallback `interaction.ts:699-705`)。pages 为空(loading)放行 navigate 不 tip(让 Article 走正常流程,边界极罕见)。

Article 加 404 兜底:覆盖新标签页/分享链接打开断链(新 session 无拦截器)。两条路径(左键原地 tip / 新标签页 Article 兜底)同款文案。

### 决策 5:markdown.ts 改动范围

`markdown.ts:28` 的 `./${p}.html` -> `/pages/${p}`。连带更新 `buildView.test.ts` wikilink 断言。`raw/` 分支(markdown.ts:27 返回纯文本)不动。

### 决策 6:不写 ADR、不改 CONTEXT.md

href 修正、拦截器、toast、404 兜底都是易 reversible 的 web 层实现细节,不 surprising,无真实架构权衡 -> 够不上 ADR 三门槛,skip。wikilink 是通用概念不入 CONTEXT glossary,语法细节属 prompt/代码契约;"导航页不在可视层"Compiled 条目已记。

## Testing

### Seam 1 - `markdown.ts` wikilink 渲染(纯函数,TDD)

`buildView.test.ts` 已有 wikilink 用例(`[[02-bar]] -> <a href="./02-bar.html">`)。先改断言为 `/pages/02-bar`(红),再改 `markdown.ts:28`(绿)。`raw/` 降级纯文本的用例保持。`markdown.ts` 零依赖纯函数,前后端共用,测试在 server 侧 `tsx --test` 跑。

### 不测

- toast 组件:纯展示 + context,对齐 `useTheme.tsx` 无测试。手动验证。
- 拦截器:DOM 事件委托 + react-router navigate,无 web 组件测试基础设施。手动验证三类链接(正常/导航页/断链)× 两种路径(左键/新标签页)。
- Article 404 兜底:手动验证。

## Out of Scope

- `output/` 路径含 `/` 的 wikilink 在 `:stem` 路由下匹配异常:既有问题,本次 href 修正不引入也不解决。
- resume / 持久化:不涉及。
- E2E 测试:server 与 web 两进程,无 E2E 基础设施。

## Further Notes

- SPA fallback 已存在(`interaction.ts:699-705`):非 `/api`/`/ws` 的 GET 回退 `index.html`。新标签页/分享链接打开 `/pages/XX` 可用,无需新增服务端逻辑。
- `usePages` 无缓存(裸 `useState`+`useEffect`):ChatPanel 不直接调,靠 prop drilling 拿 App 已加载的 pages,避免重复请求与状态不同步。
- 拦截器只拦裸左键(`e.button === 0 && 无修饰键`),带修饰键放行 -> 新标签页打开走 SPA fallback + Article 404 兜底,两条路径都有提示。

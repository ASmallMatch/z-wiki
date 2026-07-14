Status: ready-for-agent

# markdown.ts wikilink href 修正(./XX.html -> /pages/XX)

## What to build

`server/src/markdown.ts:28` 的 wikilink 渲染 `./${p}.html` -> `/pages/${p}`。这是旧 Python 静态站遗留形式,可视层已走 HTTP(ADR-0001),`.html` 后缀无指代对象。`raw/` 纯文本分支(markdown.ts:27)不动。

`markdown.ts` 是前后端共用纯函数(`buildView` 编译 wiki 文章 + `ChatPanel` 渲染 chat 回复),改一处两处生效。

## Acceptance criteria

- [ ] `markdown.ts:28` wikilink href 从 `./${p}.html` 改为 `/pages/${p}`
- [ ] `raw/` 开头仍返回纯文本(不生成链接),行为不变
- [ ] `buildView.test.ts` wikilink 断言更新:`[[02-bar]] -> <a href="/pages/02-bar" class="wl">02-bar</a>`(原 `./02-bar.html`)
- [ ] `raw/` 降级纯文本的测试用例保持通过
- [ ] `npm test` 全绿
- [ ] `make typecheck` 通过

## TDD seam

`markdown.ts` 是零依赖纯函数。`buildView.test.ts` 已有 wikilink 用例。先改测试断言(红),再改 `markdown.ts:28`(绿)。

## Blocked by

无。

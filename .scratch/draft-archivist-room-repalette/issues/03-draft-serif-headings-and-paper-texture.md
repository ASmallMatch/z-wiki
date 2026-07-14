# 03: Draft 标题衬线 + mono 扩大 + 纸纹提强

- 状态:`ready-for-agent`
- 父 PRD:`.scratch/draft-archivist-room-repalette/PRD.md`
- 关联 ADR:`docs/adr/0013-draft-archivist-room-repalette.md`(待 issue 05 创建)

## What to build

在 `web/src/styles/global.css` 新增 `--serif` 字体栈与语义 token `--heading-font`,让 Draft 标题换衬线(档案出版物气质),正文保 sans(中文可读),mono 扩大到档案标签语义元素;body 纸纹提强到可见。

**字体 token:**
- `:root` 新增 `--serif: Georgia, "Songti SC", "STSong", "SimSun", "Noto Serif SC", serif`(macOS Songti SC / Windows SimSun / Noto Serif SC / 默认 serif 逐级回落)。
- `:root` 新增 `--heading-font: var(--sans)`(默认 = sans,Archive 继承)。
- `:root[data-theme="draft"]` 覆盖 `--heading-font: var(--serif)`。
- 标题规则 `.prose h1` / `.prose h2` / `.prose h3` / `.hero h1` / `.card-title` / `.section-heading` 的 `font-family` 改 `var(--heading-font)`(若现继承 body 则显式加)。
- 正文 `.prose` / body 保持 `var(--sans)` 不动。
- `--heading-font` 是对 ADR-0005 D2「Draft 块仅覆盖颜色」的小扩展(Draft 块也覆盖字体语义 token),ADR-0013 记录。

**mono 扩大(档案标签语义统一 mono):**
- 现已用 mono 的:`.hero-meta` / `.settings-title` / `.chat-role` / `.bottom-drawer-title` / `.header-logo-mono` / `.chat-turn-tokens` / `.chat-model-name` 等(保留)。
- 扩大到:`.card-sections`(accent-bg pill,加 `font-family: var(--mono)`)、`.page-nav-direction`(已 uppercase,加 mono)、`.bottom-drawer-section-title`(已 uppercase,加 mono)、`.bottom-drawer-count` / `.bottom-drawer-section-count`(计数标签,加 mono)。
- 判断标准:凡「戳印 / 编号 / 元数据 / 计数 / 警戒带文字」语义的标签用 mono;正文与标题不用。

**纸纹:**
- body 背景噪点 SVG 的 `opacity` 从 `0.022` 改 `0.04`(可见但不抢,纸像纸)。
- `.hero-bg` 横线纹理保留(登记本格线语义),不动。

## Acceptance criteria

- [ ] `--serif` 栈定义含 `Georgia` + 中文宋体逐级回落。
- [ ] `--heading-font`:`:root` = `var(--sans)`,Draft 覆盖 = `var(--serif)`。
- [ ] 标题(prose h1/h2/h3、hero h1、card-title、section-heading)用 `var(--heading-font)`。
- [ ] 切 Draft:标题衬线;切 Archive:标题 sans(零回归)。
- [ ] 正文切两主题都 sans(不动)。
- [ ] 档案标签语义元素(card-sections / page-nav-direction / bottom-drawer-section-title / 计数标签)用 mono。
- [ ] body 纸纹 opacity `0.04`,肉眼可见但不抢正文。
- [ ] `make typecheck` 与 `make format` 通过。

## Blocked by

02(同改 `global.css`,串行避免格式 diff 冲突)

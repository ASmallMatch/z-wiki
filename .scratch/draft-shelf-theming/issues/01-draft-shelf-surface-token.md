# 01: Draft 展台底色随主题浅化(CSS token)

- 状态:`ready-for-agent`
- 父 PRD:`.scratch/draft-shelf-theming/PRD.md`
- 关联 ADR:`docs/adr/0006-draft-clay-accent-and-shelf-theming.md`(D3')

## What to build

把首页 3D 书架的展台底色 `--surface-shelf` 从"两主题都继承 `:root` 恒深色"改为"Draft 下覆盖为浅 manilla"。这是 ADR-0006 D3' 的 CSS 半边,也是全浅书架的视觉地基。

ADR-0005 D3 原把 `--surface-shelf` 留在 `:root` 不进 Draft 覆盖块(恒深)。ADR-0006 D3' 推翻:Draft 下展台也要浅化。

端到端行为:

- `:root` 的 `--surface-shelf: #12121a` 保留(Archive 不变)。
- `:root[data-theme="draft"]` 覆盖块内新增 `--surface-shelf: #eeece6`(manilla 信封色)。
- `.book-shelf-3d` 背景 = `var(--surface-shelf)` 自然随主题:Archive 深、Draft 浅米。
- 3D scene 未设 `scene.background`(透明),直接显示 CSS 底色,无需改 canvas 代码。

**此 slice 完成后,切到 Draft 首页会看到:书架画布区变浅米色,但书本身仍是深色 canvas 绘制的**——对比突兀是预期,slice 02/03 修书本身。

## Acceptance criteria

- [ ] `--surface-shelf` 在 `:root[data-theme="draft"]` 块内,值为 `#eeece6`。
- [ ] `:root` 的 `--surface-shelf: #12121a` 保留(Archive 视觉零变化)。
- [ ] 切 Draft → 书架画布区背景变浅米色;切 Archive → 回深色。
- [ ] `make typecheck` 与 `make format` 通过。
- [ ] 无回归:Archive 主题下首页、设置页、文章页外观不变。

## Blocked by

None - can start immediately

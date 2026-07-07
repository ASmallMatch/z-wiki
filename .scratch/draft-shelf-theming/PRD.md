# PRD: Draft 主题书架随主题浅化

- 父 ADR:`docs/adr/0006-draft-clay-accent-and-shelf-theming.md`(accepted)
- 取代:`docs/adr/0005-theme-system.md` 的 D1(共享靛青 accent)、D3(书架恒深色展台)
- 关联:`CONTEXT.md`「主题」节

## 背景

ADR-0005 原定 Draft 与 Archive 共享靛青 accent、且 Draft 下书架画布恒深色展台。两件事触发修订:

1. Draft 配色参考改为 Claude Code 文档浅色(实测抓取其 CSS 变量),accent 改陶土橙 `#d97757`(ADR-0006 D1')。第一轮已落地 `web/src/styles/global.css` 的 Draft token + hero/drawer-pull 硬编码光晕改 `color-mix`。
2. 全浅书架需求:Draft 主背景已是暖米白 `#f0efea`,书架区若仍恒深 `#12121a`,浅外围嵌黑舞台对比突兀。ADR-0006 D3' 把书架改为随主题浅化。

## 决议(ADR-0006 已定,本 PRD 只做实现)

| 层 | Archive(暗,不动) | Draft(浅,新) |
|----|-------------------|----------------|
| 展台底 `--surface-shelf` | `#12121a` | `#eeece6`(manilla) |
| 书皮底 | `#12121a` | `#e4d1c2`(kraft) |
| 纸边 | `#e8ddd0` | `#fdfdf7` |
| 书 accent 色板 | 靛青系 6 色 | 陶土橙系 6 色(`#d97757`/`#c66b5a`/`#b88a5a`/`#8a8a5a`/`#5a8a8a`/`#8a6a7a`) |
| 灯光 DirectionalLight | 1.1 | 0.8 |
| 灯光 rim PointLight | `0x6b8fc7` 靛青 | `0xd97757` 陶土橙 |

层次:页面 `#f0efea` < 展台 `#eeece6` < 书皮 `#e4d1c2`,纸边 `#fdfdf7` 最浅跳出。

实现机制(ADR-0006 D2'):`BookShelf3D` 加 `theme` prop,主 `useEffect` 依赖不变(不重建场景),副 `useEffect([theme])` 用现成换皮机制换 ARCHIVE/DRAFT 两套 skin 池。

## 实现切片(见 issues/)

- `01-draft-shelf-surface-token.md` — CSS:展台底色随主题
- `02-bookshelf3d-theme-prop-swap.md` — 3D:theme prop + 换皮机制(不重建)
- `03-draft-book-clay-palette.md` — 3D:Draft 书皮陶土配色 + 色板

依赖链:01 → 02 → 03。

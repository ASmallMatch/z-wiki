# 02: BookShelf3D 消费 theme prop + 换皮机制(不重建场景)

- 状态:`ready-for-agent`
- 父 PRD:`.scratch/draft-shelf-theming/PRD.md`
- 关联 ADR:`docs/adr/0006-draft-clay-accent-and-shelf-theming.md`(D2')

## What to build

让首页 3D 书架在主题切换时换书皮 texture,而不重建整个 WebGL 场景。这是 ADR-0006 D2' 的核心机制切片——先用占位 Draft 配色验证换皮通路,真正陶土色板在 slice 03 填。

`BookShelf3D` 已有滚动虚拟化换皮机制(`book.coverMat.uniforms.uTexture.value = skin.cover` + `needsUpdate`)。复用它做主题换皮。

端到端行为:

- `BookShelf3DProps` 加 `theme: 'archive' | 'draft'` 字段。
- `Home.tsx` 用 `useTheme()` 取 `theme`,传给 `BookShelf3D`。
- 主 `useEffect` 依赖数组 **不变**(仍 `[pages, onBookClick]`)——尊重 `Home.tsx` 注释刻意避免 WebGL 场景重建/重播入场的设计。**不把 theme 加进主依赖**。
- 新增副 `useEffect([theme])`:按 theme 选 ARCHIVE/DRAFT 两套 skin 池,用现成换皮机制替换每本书的 cover/spine/back/topBot texture;灯光参数(DirectionalLight 强度、rim PointLight 颜色)一并按 theme 切。
- 几何/相机/动画时间轴不动。
- **Draft skin 池此 slice 可临时复用 ARCHIVE 配色**(只要换皮通路跑通,颜色对不对留给 03)。

被否的备选(记入 ADR-0006 D2'):theme 进主 `useEffect` 依赖 → 切换时整场景重建 + 重播入场。实现更简但破坏 Home.tsx 避免重建的刻意设计。

## Acceptance criteria

- [ ] `BookShelf3DProps` 加 `theme: 'archive' | 'draft'`;`Home.tsx` 用 `useTheme().theme` 传入。
- [ ] 主 `useEffect` 依赖数组仍是 `[pages, onBookClick]`(未加 theme)。
- [ ] 切主题时 3D 场景不重建、入场动画不重播(肉眼验证:切走再切回,书不重新落位、不闪)。
- [ ] 书皮 texture 确实切换(切 Draft 后书皮换了一套,即便颜色暂同也要可观察到 `needsUpdate` 触发)。
- [ ] 灯光按 theme 切(Draft 下 DirectionalLight 强度降低、rim PointLight 颜色变)。
- [ ] 纹理资源不泄漏:切走时旧 skin 池的 cover/spine/back texture 调 `dispose()`(参考现有 `skinPool.forEach(skin => skin.cover.dispose())` 模式)。
- [ ] `make typecheck` 与 `make format` 通过。
- [ ] 无回归:Archive 主题下书架外观与入场动画不变。

## Blocked by

- `.scratch/draft-shelf-theming/issues/01-draft-shelf-surface-token.md`(展台底色先浅化,否则此 slice 的换皮在深展台上无意义)

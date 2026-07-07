# 03: Draft 书皮陶土配色 + 色板

- 状态:`ready-for-agent`
- 父 PRD:`.scratch/draft-shelf-theming/PRD.md`
- 关联 ADR:`docs/adr/0006-draft-clay-accent-and-shelf-theming.md`(D3' 配色 + 灯光)

## What to build

填入 ADR-0006 D3' 定的 Draft 书皮配色常量,替换 slice 02 的占位 Draft 配色。让 Draft 主题下 3D 书架呈现 Claude 文档档案材质语言:浅 manilla 展台 + kraft 牛皮纸书皮 + 暖白纸边 + 陶土橙 accent 色板。

配色取自 firecrawl 实测抓取的 Claude 文档 CSS 变量:`--constant-manilla`(信封)、`--constant-kraft`(牛皮纸)、`--constant-clay`(陶土)、`--accent-brand`(陶土橙)。

端到端行为:

- Draft 主题下,`BookShelf3D` 的 Draft skin 池用以下配色(替换 slice 02 的占位):
  - 书皮底 `#e4d1c2`(kraft 牛皮纸,对应 `DARK_BASE` 的 Draft 值)
  - 纸边 `#fdfdf7`(暖白纸页,对应 `PAPER_CREAM` 的 Draft 值)
  - 书 accent 色板 6 色(替换 `ARCHIVE_ACCENTS`):`#d97757`(陶土橙,主,对齐 Draft accent)/ `#c66b5a`(砖红)/ `#b88a5a`(赭石)/ `#8a8a5a`(橄榄)/ `#5a8a8a`(鸭蛋青,冷色平衡)/ `#8a6a7a`(紫褐)
- 灯光:Draft 下 `DirectionalLight` 强度 0.8(Archive 仍 1.1);rim `PointLight` 颜色 `0xd97757` 陶土橙(Archive 仍 `0x6b8fc7` 靛青)。
- `hashAccent` 按 theme 选 ARCHIVE/DRAFT 色板。

层次(ADR-0006 D3' 已定):页面 `#f0efea` < 展台 `#eeece6` < 书皮 `#e4d1c2`,纸边 `#fdfdf7` 最浅跳出。书皮比展台略深,让书从展台立住轮廓(浅底同色会糊,必须分层)。

## Acceptance criteria

- [ ] Draft 下书皮底 `#e4d1c2`、纸边 `#fdfdf7`、accent 主色 `#d97757`。
- [ ] 6 色陶土色板按书名 hash 分配,每本书不同色(`hashAccent` 选 DRAFT 色板)。
- [ ] Draft 下 `DirectionalLight` 强度 0.8、rim `PointLight` 颜色 `0xd97757`。
- [ ] 切 Archive → 书回深色 `#12121a` + 靛青色板 + Archive 灯光(无回归,slice 02 机制保证不重建)。
- [ ] 层次可辨:页面 < 展台 < 书皮,纸边最浅;书从展台立住轮廓不糊。
- [ ] 封面文字对比度可读(Draft 浅书皮上 accent 胶带、标题、`CAUTION` 文字清晰)。
- [ ] `make typecheck` 与 `make format` 通过。

## Blocked by

- `.scratch/draft-shelf-theming/issues/02-bookshelf3d-theme-prop-swap.md`(换皮机制先就位,此 slice 才有 Draft skin 池可填配色)

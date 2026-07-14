# 04: BookShelf3D Draft 配色改案卷色板

- 状态:`ready-for-agent`
- 父 PRD:`.scratch/draft-archivist-room-repalette/PRD.md`
- 关联 ADR:`docs/adr/0013-draft-archivist-room-repalette.md`(待 issue 05 创建)

## What to build

重写 `web/src/components/BookShelf3D.tsx` 的 `DRAFT_COLORS` 与 `DRAFT_ACCENTS` 常量,从陶土色板改案卷色板(泛黄纸书皮 + 蓝黑墨水书脊 + 档案案卷色板)。`ARCHIVE_COLORS` / `ARCHIVE_ACCENTS` 零改动。换皮机制(ADR-0006 D2',theme prop + 副 `useEffect([theme])` 换 texture)不动。

**`DRAFT_COLORS` 目标值:**

| 字段 | 现值(陶土) | 新值(案卷) |
|------|-----------|------------|
| `darkBase`(书皮底) | `#e4d1c2`(kraft) | `#e8e0cc`(泛黄纸书皮) |
| `paper`(纸边) | `#fdfdf7` | `#fdfdf5`(最亮纸白,书顶/书底/书边跳出) |
| `topAccent`(书脊装饰线) | `#d97757`(陶土橙) | `#2b4a6f`(蓝黑墨水) |
| `dirLightIntensity` | `0.8` | `0.8`(不变) |
| `rimLightColor` | `0xd97757`(陶土橙) | `0x2b4a6f`(墨水) |

**`DRAFT_ACCENTS` 案卷色板(替换陶土土系 6 色):**

| 色值 | 语义 |
|------|------|
| `#2b4a6f` | 蓝黑墨水(主,对齐 Draft accent) |
| `#5a7a5a` | 档案局墨绿 |
| `#8a3a2f` | 朱砂戳印红(偶发暖) |
| `#b88a4a` | 陶土橙(偶发暖,ADR-0006 材质正色传承) |
| `#6a5a8a` | 墨紫 |
| `#4a6a6a` | 灰青 |

层次:页面 `#f7f3ec` < 展台 `#ece4d2` < 书皮 `#e8e0cc`,纸边 `#fdfdf5` 最浅跳出。书皮比展台略深,让书从展台立住轮廓(浅底同色会糊,必须分层--沿 ADR-0006 D3' 的分层原则)。

封面文字色(`contrastColor` 逻辑)不动:浅书皮 `#e8e0cc` 亮度 > 0.55,自动选深字 `#1c1917`,可读。

## Acceptance criteria

- [ ] `DRAFT_COLORS` 与 `DRAFT_ACCENTS` 按上表。
- [ ] `ARCHIVE_COLORS` / `ARCHIVE_ACCENTS` 零改动。
- [ ] 切 Draft:书架书皮泛黄纸 + 墨水书脊装饰线 + 6 色案卷板(含陶土橙一席)。
- [ ] 切 Archive:书架靛青色板零回归。
- [ ] 换皮机制不动(切主题不重建 WebGL 场景,动画不重播)。
- [ ] 书皮文字可读(深字 on 浅书皮)。
- [ ] `make typecheck` 与 `make format` 通过。

## Blocked by

01(`topAccent` / `rimLightColor` 色值需与 Draft `--accent` `#2b4a6f` 对齐)

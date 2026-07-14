# 01: Draft 配色 token 重写(泛黄纸 + 蓝黑墨水)

- 状态:`ready-for-agent`
- 父 PRD:`.scratch/draft-archivist-room-repalette/PRD.md`
- 关联 ADR:`docs/adr/0013-draft-archivist-room-repalette.md`(待 issue 05 创建)

## What to build

重写 `web/src/styles/global.css` 的 `:root[data-theme="draft"]` 覆盖块颜色 token,从「暖纸陶土」改「档案室:泛黄纸 + 蓝黑墨水」。`:root`(Archive)块零改动。

token 目标值:

| token | 现值(陶土) | 新值(档案室) |
|------|-----------|--------------|
| `--surface` | `#f0efea` | `#f7f3ec`(泛黄纸) |
| `--surface-alt` | `#fdfdf7` | `#fdfbf5`(亮纸卡片) |
| `--surface-hover` | `#e8e6df` | `#efe9da` |
| `--surface-code` | `#e8e6df` | `#efe9da` |
| `--surface-nav` | `rgba(240,239,234,0.88)` | `rgba(247,243,236,0.9)` |
| `--surface-shelf` | `#eeece6`(manilla) | `#ece4d2`(展台,比页面略深让书立住) |
| `--accent` | `#d97757`(陶土橙) | `#2b4a6f`(蓝黑墨水) |
| `--accent-soft` | `#d4a27f` | `#4a6b8f` |
| `--accent-bright` | `#e88a6a` | `#3a5d85` |
| `--accent-bg` | `rgba(217,119,87,0.12)` | `rgba(43,74,111,0.08)` |
| `--accent-border` | `rgba(217,119,87,0.5)` | `rgba(43,74,111,0.4)` |
| `--border` | `#e7e5e4` | `#d9d2c0`(暖灰纸边) |
| `--border-light` | `#f0eeec` | `#e4dfd0` |
| `--rule` | `#e7e5e4` | `#d9d2c0` |
| `--shadow-sm` | `0 1px 3px rgba(60,40,30,0.08)` | `0 1px 3px rgba(40,40,50,0.08)` |
| `--shadow-md` | `0 4px 14px rgba(60,40,30,0.1)` | `0 4px 14px rgba(40,40,50,0.1)` |
| `--shadow-lg` | `0 8px 32px rgba(60,40,30,0.14)` | `0 8px 32px rgba(40,40,50,0.14)` |
| `--selection` | `rgba(217,119,87,0.3)` | `rgba(43,74,111,0.3)` |
| `--card-hover` | `rgba(217,119,87,0.05)` | `rgba(43,74,111,0.05)` |
| `--header-stripe` | `rgba(30,22,18,0.7)` | `rgba(43,74,111,0.5)`(墨水) |

代码高亮 `--code-*` 重调一套(蓝黑墨水底下的可读色):

| token | 新值 |
|------|------|
| `--code-kw` | `#5a4a8a` |
| `--code-str` | `#2f7a4a` |
| `--code-num` | `#8a5a2a` |
| `--code-fn` | `#2a5a8a` |
| `--code-cmt` | `#78716c` |
| `--code-op` | `#6a4a7a` |

不动的 token(层级靠明度,无需改):`--text` `#1c1917` / `--text-bright` `#0e0e0e` / `--text-muted` `#57534e` / `--text-faint` `#78716c` / `--border-inner` / `--track-bg`。

`--glow-accent` 的值改写(去发光,改墨水描边):`0 0 0 1px var(--accent-border)`(去掉原 `0 0 14px rgba(...)` 发光段)。

## Acceptance criteria

- [ ] `:root[data-theme="draft"]` 覆盖块所有颜色 token 按上表。
- [ ] `:root`(Archive)块零改动。
- [ ] 切 Draft:泛黄纸底 + 蓝黑墨水 accent + 暖灰纸边,无暖褐烟熏。
- [ ] 切 Archive:零回归(靛青 accent、深色 surface 全保留)。
- [ ] 代码块切 Draft 仍可读(高亮色对比度足够)。
- [ ] `make typecheck` 与 `make format` 通过。

## Blocked by

None - can start immediately

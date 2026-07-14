# 02: Draft 光晕去除 + 扫描动效转墨迹

- 状态:`ready-for-agent`
- 父 PRD:`.scratch/draft-archivist-room-repalette/PRD.md`
- 关联 ADR:`docs/adr/0013-draft-archivist-room-repalette.md`(待 issue 05 创建)

## What to build

去除浅色(Draft)下的装饰辉光(烟熏直接成因),把 Archive 招牌扫描动效的语义从「发光亮峰」转「墨迹实色细线」。深色 Archive 的辉光与扫描发光全保留不动。

改动点(`web/src/styles/global.css`,通过 `:root[data-theme="draft"]` 作用域覆盖或调整既有规则):

**光晕去除(浅色下):**
- `.hero h1` 的 `text-shadow: 0 0 40px color-mix(var(--accent) 14%, transparent)` -- Draft 下去除(`text-shadow: none`)。`.hero:hover h1` 的 60px/35% 同理去除。
- `.drawer-pull-knob` 的 `box-shadow` 中 `0 0 10px` 与 `0 0 18px` 发光段 -- Draft 下去除,只留 `0 0 0 2px var(--surface-alt)` 描边。实色 `radial-gradient` 底保留(那是墨点不是发光)。
- `.drawer-pull-line` 与 `.drawer-pull-line::after` 的 `box-shadow` 发光段 -- Draft 下去除。
- `.hero:hover .drawer-pull-line` / `.hero:hover .drawer-pull-knob` 的 hover 发光 -- Draft 下去除。
- `--glow-accent`(focus/hover ring)-- 已在 issue 01 改值为墨水描边,此处确认所有消费 `--glow-accent` 的组件在 Draft 下无发光。

**扫描动效转墨迹(浅色下):**
- `.hero::before` / `.hero::after` 扫描亮峰:background 从 `linear-gradient(90deg, transparent, var(--accent-border) 50%, transparent)`(发光光束感)改为蓝黑墨水实色细线--中间用 `var(--accent)` 实色带(如 `transparent, var(--accent) 45%, var(--accent) 55%, transparent`)而非渐变峰;hover 的 `var(--accent-bright)` 同理改实色;透明度上限下调(现 hover `0.9` -> 约 `0.5`),去亮峰发光感。动画 `@keyframes hero-scan-ltr/rtl` 周期与位移不动。
- `.chat-row-fairy::before` 垂直扫描:同 hero,`accent-border` 渐变 -> `accent` 实色细线,降透明度,去发光。`@keyframes fairy-scan-ttb` 不动。
- `.hero:hover::before/::after` 的 `var(--accent-bright)` 亮峰 -- Draft 下改实色墨迹,非发光。

**保留不动(档案语言,非光晕):**
- `.header::after` 45° 警戒带斜纹(封条语言,issue 01 已把 `--header-stripe` 改墨水色)。
- `.section-heading::before` accent 渐变条(色块非发光,随 accent 改墨水)。
- `.hero-bg` 横线纹理(登记本格线)。

## Acceptance criteria

- [ ] 切 Draft:`.hero h1` 无 text-shadow(烟熏消除)。
- [ ] 切 Draft:hero 扫描线是墨水实色细线扫过,非透明渐变亮峰。
- [ ] 切 Draft:`.drawer-pull-knob` 是实色墨点,无 `0 0 10px/18px` 辉光。
- [ ] 切 Draft:`.chat-row-fairy` 扫描是墨迹,无发光。
- [ ] 切 Draft:focus/hover ring 是墨水描边(`0 0 0 1px`),无 `0 0 14px` 发光。
- [ ] 切 Archive:hero h1 text-shadow、knob 辉光、扫描亮峰、fairy 发光全保留,零回归。
- [ ] 动画周期与位移未改(切换主题时扫描不突现/突灭)。
- [ ] `make typecheck` 与 `make format` 通过。

## Blocked by

01(动效颜色消费 `--accent` / `--accent-border` / `--accent-bright` token,需先落地)

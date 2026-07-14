# 05: ADR-0013 + CONTEXT.md 更新

- 状态:`ready-for-agent`
- 父 PRD:`.scratch/draft-archivist-room-repalette/PRD.md`

## What to build

写 ADR-0013 记录 Draft 配色方向从「暖纸陶土」改「档案室:泛黄纸 + 蓝黑墨水」,并更新 CONTEXT.md 主题节。issue 01-04 落地后,本 issue 把决策记进领域模型。

**ADR-0013(`docs/adr/0013-draft-archivist-room-repalette.md`):**

- 状态:accepted
- 范围:layer2(web)Draft 主题配色方向从陶土橙暖纸改档案室(泛黄纸 + 蓝黑墨水);supersedes ADR-0006 D1'(陶土橙 accent)与 D3'(牛皮纸书皮 + 陶土色板);保留 0006 D2'(换皮机制)、0005 D2/D4/D5。
- 背景:ADR-0006(2026-07-07)定 Draft 走 Anthropic 档案材质色(陶土橙 + kraft/manilla)。执行后观感「烟熏 + 老旧」:浅底上陶土橙辉光发糊;三层暖褐无冷暖对比;只取材质色名未做真复古质感(纸纹不可见、全 sans、无做旧)。一次 grilling 厘清:问题不是「配色丑」本身,是方向只走到取色、没走到质感,且暖橙满铺与浅色阅读氛围冲突。
- 决策:
  - **D1''**:Draft accent 改蓝黑墨水 `#2b4a6f`(supersedes 0006 D1')。与深色 Archive 靛青 `#6b8fc7` 同源蓝系,切换 accent 不再跳变(修掉 0006 D1' 的「跳变有意」副作用)。陶土橙 `#d97757` 降级为 `DRAFT_ACCENTS` 色板一席偶发暖点缀,不彻底删除(材质正色传承)。
  - **D3''**:Draft 书皮改泛黄纸 `#e8e0cc` + 墨水书脊 + 案卷色板(supersedes 0006 D3')。色板:蓝黑墨水 / 档案局墨绿 / 朱砂戳印红 / 陶土橙 / 墨紫 / 灰青。
  - **D4''**:动效--装饰辉光浅色下去除(治烟熏);扫描动效(hero/fairy)结构保留,语义转墨迹实色细线(切换连贯,浅色有独立动效身份)。
  - **D5''**:字体--新增 `--serif` 栈,`--heading-font` 语义 token(`:root` = sans,Draft = serif);标题衬线、正文 sans、mono 扩大为档案标签语言。这是对 ADR-0005 D2「Draft 块仅覆盖颜色」的小扩展(Draft 块也覆盖字体语义 token)。
  - **D6''**:纸纹 body 噪点 opacity `0.022` -> `0.04`(可见纸感)。
- 后果:0006 D1'/D3' 被 supersede;浅深 accent 同源不跳变;陶土橙降级非删除;Draft 覆盖块扩展到字体 token;深色 Archive 零改动。

**ADR-0006 文件内标注:** 在 `docs/adr/0006-draft-clay-accent-and-shelf-theming.md` 的 D1' 与 D3' 段首加 `> **[2026-07-13 superseded by ADR-0013]**` 标注(沿 0005 被 0006 标注的先例)。0006 D2' 继续 accepted,不动。

**CONTEXT.md(`CONTEXT.md` 第 66-67 行):**
- 第 66 行 Draft 定义:从「暖纸陶土风浅色主题。暖米白底 + 暖深字 + 陶土橙 accent(对齐 Anthropic 文档浅色);浅色归档案材质正色。accent 与 Archive 不同源(靛青↔陶土橙),切换时品牌色跳变是有意为之。」改「档案室风浅色主题。略泛黄纸底 + 蓝黑墨水 accent;陶土橙降级为书架色板偶发暖点缀(材质正色传承)。accent 与 Archive 同源蓝系(蓝黑墨水↔靛青),切换时不跳变。」
- 第 67 行书架随主题:「陶土封面色板」改「案卷色板(蓝黑墨水/墨绿/朱砂/陶土橙/墨紫/灰青)」。

## Acceptance criteria

- [ ] `docs/adr/0013-draft-archivist-room-repalette.md` 存在,状态 accepted,含上述决策段。
- [ ] `docs/adr/0006-...md` 的 D1' 与 D3' 段首有「superseded by ADR-0013」标注;D2' 未被标注。
- [ ] `CONTEXT.md` 第 66-67 行按上更新。
- [ ] PRD.md 头部「父 ADR」行回填为 accepted 引用。
- [ ] `make typecheck` 通过(文档改动,跑一遍确认无副作用)。

## Blocked by

01, 02, 03, 04(决策落地后再记 ADR)

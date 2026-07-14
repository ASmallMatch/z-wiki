# PRD: Draft 主题改「档案室」配色(泛黄纸 + 蓝黑墨水)

- 父 ADR:`docs/adr/0013-draft-archivist-room-repalette.md`(accepted)
- 取代:`docs/adr/0006-draft-clay-accent-and-shelf-theming.md` 的 D1'(陶土橙 accent)、D3'(牛皮纸书皮 + 陶土色板)
- 保留:`docs/adr/0006` D2'(换皮机制)、`docs/adr/0005-theme-system.md` D2/D4/D5
- 关联:`CONTEXT.md`「主题」节、`docs/adr/0005-theme-system.md`

## Problem Statement

作为 z-wiki 读者,我在浅色(Draft)主题下阅读时,整体观感「老旧 + 烟熏」,既不像复古,也谈不上好看。具体三层不适:

1. **烟熏**:hero 标题、drawer-pull 拉绳、fairy 对话行等处用陶土橙做的「辉光」(text-shadow / box-shadow glow / 扫描亮峰),在浅底上不是发光而是发糊,标题周围一圈橙褐烟雾。
2. **配色浑浊**:页面暖米白 `#f0efea` + 书架展台 manilla `#eeece6` + 书皮 kraft `#e4d1c2` + 陶土橙 accent,全挤在暖褐窄带里,无冷暖对比,灰扑扑。
3. **假复古**:ADR-0006 只借了 Anthropic 材质色名(clay/kraft/manilla),没做真复古的任何质感(纸纹不可见、全 sans 无衬线、无做旧),是「挂复古名的暖褐脏色」。

深色 Archive 主题无此问题,不在本次范围。

## Solution

把 Draft 从「暖纸陶土风」改为「档案室(Registrar's Office)」:深色 Archive = 档案库夜灯(不动),浅色 Draft = 档案室日灯。四个方向:

- **基调**:略泛黄纸 `#f7f3ec` + 蓝黑墨水 `#2b4a6f` accent。冷暖对比治发糊。陶土橙 `#d97757` 从主 accent 降级为书架色板的偶发暖点缀(不丢 ADR-0006 材质正色传承,只不当主 accent)。蓝黑墨水与深色 Archive 靛青 `#6b8fc7` 同源蓝系,切换主题 accent 不再跳变(修掉 ADR-0006 D1' 的「accent 跳变」副作用)。
- **动效**:装饰辉光全去(治烟熏);Archive 招牌扫描动效(hero 横扫、fairy 竖扫)结构保留,语义从「发光亮峰」转「墨迹实色细线」--切换主题时动效不戛然而止,浅色有自己的动效身份(墨迹)。
- **字体**:新增 `--serif` 字体栈,标题(prose h1/h2/h3、hero h1、card-title、section-heading)换衬线(档案出版物气质);正文保 sans(中文长文可读);mono 扩大到所有档案标签语义(打字机档案语言)。
- **纸纹**:body 噪点从 opacity `0.022`(基本不可见)提到 `0.04`(可见但不抢),让纸像纸。

## User Stories

1. 作为 wiki 读者,我想在浅色主题下阅读时不受标题周围橙色烟雾干扰,以便长时间阅读不疲劳。
2. 作为 wiki 读者,我想浅色主题的配色有冷暖对比(泛黄纸 + 蓝黑墨水),以便界面利落不浑浊。
3. 作为 wiki 读者,我想标题用衬线字体,以便浅色主题有档案出版物气质而非普通 SaaS 浅色。
4. 作为 wiki 读者,我想正文保持无衬线,以便中文长文在屏幕上清晰可读。
5. 作为 wiki 读者,我想首页 3D 书架的书皮是泛黄纸 + 墨水书脊的案卷配色,以便书架与档案室主题统一。
6. 作为 wiki 读者,我想书架上的书有少量陶土橙/朱砂红等暖色点缀,以便不丢失 ADR-0006 的材质正色传承。
7. 作为主题切换用户,我想切到深色 Archive 时所有靛青辉光与扫描动效完整保留,以便深色体验零回归。
8. 作为主题切换用户,我想切主题时 accent 从蓝黑墨水到靛青是同源蓝系过渡,以便品牌色不突兀跳变。
9. 作为主题切换用户,我想 hero 扫描线在浅色下变为墨迹扫过而非消失,以便切换时动效不戛然而止。
10. 作为 wiki 读者,我想浅色主题的 focus/hover 反馈是墨水描边而非辉光,以便交互反馈不烟熏。
11. 作为 wiki 读者,我想浅色背景有可见的纸张纹理,以便有「真纸」质感而非假复古。
12. 作为 wiki 读者,我想 header 警戒带斜纹在浅色下保留(改墨色),以便档案封条语言不丢。
13. 作为 wiki 读者,我想代码块在浅色下仍可读(蓝黑墨水底下的高亮重调),以便阅读代码不费眼。
14. 作为 wiki 维护者,我想这次改动不触碰深色 Archive 任何 token,以便深色用户零感知。
15. 作为 wiki 维护者,我想配色决策有 ADR 记录(取代 ADR-0006 D1'/D3'),以便后人理解为何放弃陶土橙。

## Implementation Decisions

- **改动范围**:仅 layer2 web。`web/src/styles/global.css`(Draft 覆盖块 + 少量通用规则)+ `web/src/components/BookShelf3D.tsx`(`DRAFT_COLORS` / `DRAFT_ACCENTS` 常量)。不改 layer1 `kb/`、layer3 server、desktop shell。
- **Draft 配色 token 重写**(`:root[data-theme="draft"]` 覆盖块):surface 泛黄纸系(`#f7f3ec` 主 / `#fdfbf5` 亮纸卡片 / `#ece4d2` 展台)、accent 蓝黑墨水系(`#2b4a6f` / `--accent-soft #4a6b8f` / `--accent-bright #3a5d85`)、border 暖灰纸边(`#d9d2c0`)、阴影从暖褐 `rgba(60,40,30,…)` 改中性偏冷 `rgba(40,40,50,…)`、`--header-stripe` 改墨水、代码高亮 `--code-*` 重调一套。`:root`(Archive)零改动。具体色值见 issues/01。
- **陶土橙降级**:`#d97757` 从 Draft 主 accent 降级为 `DRAFT_ACCENTS` 案卷色板的一席偶发暖点缀(保留材质正色传承,不彻底删除)。
- **光晕去除**:`.hero h1` text-shadow 浅色下去除(深色保留)、`.drawer-pull-knob` 的 radial glow 保留实色但去 box-shadow 辉光、`--glow-accent`(focus/hover ring)改墨水描边 `0 0 0 1px var(--accent-border)` 去发光。
- **扫描动效转墨迹**:`.hero::before/::after` 与 `.chat-row-fairy::before` 的亮峰,从 `transparent -> accent-border -> transparent` 渐变(发光光束感)改蓝黑墨水实色细线、降透明度上限、去亮峰发光感。动画结构与周期不动(切换连贯)。
- **字体**:新增 `--serif` 栈(`Georgia, "Songti SC", "STSong", "SimSun", "Noto Serif SC", serif`)与语义 token `--heading-font`(`:root` = `var(--sans)`,`Draft` 覆盖 = `var(--serif)`);标题规则改 `font-family: var(--heading-font)`。这是对 ADR-0005 D2「Draft 块仅覆盖颜色」的小扩展--Draft 块也覆盖字体语义 token(ADR-0013 记录)。
- **mono 扩大**:把档案标签语义元素(hero-meta / settings-title / chat-role / bottom-drawer-title / card-sections / page-nav-direction / bottom-drawer-section-title 等)统一 mono,强化打字机档案语言。
- **纸纹**:body 噪点 opacity `0.022` -> `0.04`;`.hero-bg` 横线纹理保留作「登记本格线」。
- **BookShelf3D 配色**:`DRAFT_COLORS` 书皮 `#e8e0cc`(泛黄纸)/ 纸边 `#fdfbf5` / `topAccent` + `rimLightColor` `#2b4a6f`(墨水);`DRAFT_ACCENTS` 案卷色板 6 色:`#2b4a6f` 蓝黑墨水(主)/ `#5a7a5a` 档案局墨绿 / `#8a3a2f` 朱砂戳印红 / `#b88a4a` 陶土橙(材质正色传承)/ `#6a5a8a` 墨紫 / `#4a6a6a` 灰青。换皮机制(ADR-0006 D2')不动。`ARCHIVE_COLORS` / `ARCHIVE_ACCENTS` 零改动。
- **ADR-0013**:记录 Draft 改「档案室」方向,supersede ADR-0006 D1'/D3';保留 0006 D2' + 0005 D2/D4/D5。ADR-0006 文件内 D1'/D3' 加「被 0013 supersede」标注(沿 0005 被 0006 标注的先例)。
- **CONTEXT.md**:第 66 行 Draft 定义从「暖纸陶土风」改「档案室:泛黄纸 + 蓝黑墨水」;第 67 行书架随主题描述从「陶土封面色板」改「案卷色板」。

## Testing Decisions

- **零新建自动化 seam**。理由:特性是纯视觉配色 / 字体 / 动效语义变更,无外部行为或逻辑变化;layer2 web 无视觉回归测试基建(仅 `useChat.test.ts`,不相关);项目工具链偏好 playwright 不截图(无视觉断言能力);主题切换机制(ADR-0006 D2' theme prop + 换皮不重建)已实现且本次不动,无需回归测;ADR-0006 先例纯视觉特性 PRD 无 Testing Decisions 段,靠人工视觉验收。
- **验证 = 人工视觉验收清单 + `make typecheck` + `make format`**。各 issue 的 Acceptance criteria 即视觉验收点。
- **好测试标准**:只测外部行为,不测实现细节。此特性无新的可自动化外部行为,故不新增测试。若未来 layer2 引入视觉回归基建(截图快照),可补 Draft 配色快照,属独立议题。
- **深色 Archive 零回归是硬性验收**:切 Archive 后靛青 accent、glow、扫描线、sans 标题全保留。

## Out of Scope

- 深色 Archive 主题的任何 token / 色板 / 动效 / 字体改动(完全不动)。
- 主题切换机制(theme prop 传递、换皮不重建场景)的逻辑改动--ADR-0006 D2' 已实现,本次只换色值。
- 正文字体从 sans 换衬线(中文衬线小字号发虚,排除)。
- 全衬线方案(同上排除)。
- 老印刷品(letterpress)/ 旧书店(bookshop)等其他复古形态(grilling 已选定档案室)。
- layer1 `kb/` 或 layer3 server 的任何改动。
- 视觉回归自动化基建的引入(本次靠人工验收)。
- 历史会话 / resume 等无关功能。

## Further Notes

- **设计共识来自一次 grilling session(五轮)**:留复古补质感(B)-> 档案室形态(a)-> 泛黄纸 + 蓝黑墨水基调(ii)-> 动效转墨迹(ii)-> 衬线标题 + sans 正文 + mono 标签(ii)。每轮都给了推荐答案并由用户拍板。
- **陶土橙不彻底拿掉**:作为 ADR-0006 材质正色传承,降级到书架案卷色板的一席偶发暖点缀。后人若问「为何浅色留一抹陶土橙」--答案是材质正色传承,非遗漏。
- **蓝黑墨水与靛青同源**:`#2b4a6f` 与深色 Archive `#6b8fc7` 同源蓝系,切换 accent 不再跳变--这是对 ADR-0006 D1'「accent 跳变是有意为之」的修正(净改进)。
- **中文字体跨系统差异**:`--serif` 栈需 macOS `Songti SC` / Windows `SimSun` / `Noto Serif SC` / `serif` 逐级回落;无宋体系统回落默认衬线仍比 sans 有出版物气质。
- **实现切片依赖**:01(token,无依赖)-> 02(光晕/动效,blocked by 01,同文件 + 用 accent token)-> 03(字体/纸纹,blocked by 02,同文件串行);04(书架,blocked by 01 色值对齐,独立文件可与 02/03 并行);05(ADR + CONTEXT,blocked by 01-04)。

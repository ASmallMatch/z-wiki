# ADR-0015: N=1,2 补虚拟位凑奇数 slots,保留 slot0 体系

- 状态:accepted
- 日期:2026-07-16
- 范围:layer2(web)`BookShelf3D.tsx` slots 计算与 currentSlot 量化。N=1,2 补虚拟空位到 slots=3,N≥3 不变。
- 关联:ADR-0006(D2' 书架换皮不重建场景)、CONTEXT.md「书架槽位」

## 背景

`BookShelf3D` slots 计算 `Math.min(N, 17, Math.max(N-1, 3))` + 奇数化(`if (slots%2===0) slots-=1`)。奇数化保 slot0 钉几何中心、half=(slots−1)/2 整数--是 currentSlot(`Math.round` 整数)、slotMap(整数键)、dataIndex(`slotIndex mod N`)、reflow/snap/clamp 全部的几何基石。

N=2 时 min=2、奇偶化砍成 1,只建 1 个书对象,第二本丢失(用户 bug:上传 2 本只见 1 本)。N=1 走 `slots<=1` 单本特殊路径(独立橡皮筋动画)。根因:奇数化与 N=1,2 冲突。N≥3 原逻辑正常(N=3 满窗;N≥4 `slots=N−1` 奇 + virtual reflow 遍历)。

## 决策

### D1:slots 下限 3(补虚拟凑奇,只影响 N=1,2)

`computeShelfSlots` 改 `slots = max(3, 原结果)`。N=1,2(原 slots=1)补到 3;N≥3 原结果≥3 零变化。统一规则(非 N=2 特例):slots 下限就是 3。

### D2:虚拟位空槽(左边缘 −half),不建对象

N=1,2 时 slotIndex=−half 不建 mesh、不进 `allSlots`/`slotMap`。N=2:虚拟 −1、真书 {0,+1};N=1:补 2 虚拟(±1 皆空,1 本无法只左空)、真书 {0}。沿用 `dataIndex = slotIndex mod N`,−half 恰是 mod 重复位,跳过即去重,真书无重复。

### D3:currentSlot 量化真书槽集(realSlots)

`currentSlot = round(−rot/effStep)` clamp 到 realSlots 范围,永不着陆虚拟位。虚拟位因 `isCurrent = book.slotIndex === currentSlot` 永假,自动不抽出/不光泽/不命中/不点击--无需每处判 isVirtual。

### D4:clamp/snap 同步 realSlots(防新 bug)

`clampRot` 夹 rot 到 realSlots 区间、`snapTarget` 吸 realSlots。否则 rot 连续滑到虚拟位 a=0 时几何中心瞬时留空(虚拟不渲染)。currentSlot 量化(离散)不足以防--rot 连续,须 rot 层也挡。D3+D4 是硬约定。

### D5:删除单本路径

N=1 走多本(slots=3)后,`soloElasticRot`/`SOLO_PIXEL_TO_ANGLE`/`SOLO_DRAG_CLAMP`/`SOLO_MAX_ROT`/`computeSoloMaxRot` 及 `snapTarget`·`orbitAlignTarget`·`snapToNearest` 的 `slots<=1` 分支全删。单本橡皮筋被多本 clamp/snap 取代(N=1 真书 {0},拖拽 clamp、松手吸 0)。

## 被否备选

- **改 slotIndex 编址支持偶数 half**:动 currentSlot/slotMap/dataIndex/reflow/snap/clamp 整条链(slotIndex 半整数 -> dataIndex 浮点崩 + currentSlot 整数永不匹配半整 slotIndex)。改动最大,半解。
- **所有偶数补 1**:N≥14 补后满窗 `virtual=false`,缓冲区(±7,±8)真书不可见不可达;奇偶行为跳跃(N 偶满窗/N 奇 reflow);破坏 reflow 小窗口遍历设计;N≥18 仍 reflow + 虚拟位换皮复杂。
- **虚拟位渲染假书**:数量不一致(N=2 见 3 本),违反"数量一致"诉求。
- **N=2 slots=3 重复真书(mod 不跳)**:真1 左右重复,数量不一致。
- **N=1 保留单本路径**:与 D5 冲突,单本/多本两套动画维护成本高。

## 后果

- **N=1,2 有虚拟空位**:N=2 左边缘 1 空;N=1 两侧空。视觉数量 = N(一致),布局非对称(偶数真书无法以 slot0 对称)。
- **clamp/snap/currentSlot 须同步 realSlots**:任一不同步引入"虚拟滑中心留空"或"currentSlot 落空位"新 bug。
- **单本路径代码删除**:`slots<=1` 分支不再可达。
- **N≥3 零变化**:原 reflow/virtual 不动,零回归。
- **虚拟位是 layer2 视觉概念**:不进 layer1 `/api/pages`,只在 `BookShelf3D` 内部凑 slots。

## 验证

- `computeShelfSlots` 测试:N=1,2 -> slots=3;N=3/4/18 不变(锚点)。
- currentSlot 量化测试:永落 realSlots,不落 −half。
- N=2 渲染 2 本、N=1 渲染 1 本(虚拟空位不渲染)。
- 现有 `bookShelfReflow`/`bookShelfInteraction` 测试不破(N≥3 路径不变)。
- `make typecheck` / `make format` 通过。

# ADR-0015: N≤9 补虚拟满窗,保留 slot0 体系

- 状态:accepted
- 日期:2026-07-16
- 范围:layer2(web)`BookShelf3D.tsx` slots 计算与 currentSlot 量化。N≤9 补虚拟满窗(slots=2N−1),N≥10 原 reflow。
- 关联:ADR-0006(D2' 书架换皮不重建场景)、CONTEXT.md「书架槽位」

## 背景

`BookShelf3D` slots 计算 `Math.min(N, 17, Math.max(N-1, 3))` + 奇数化(`if (slots%2===0) slots-=1`)。奇数化保 slot0 钉几何中心、half=(slots−1)/2 整数--是 currentSlot(`Math.round` 整数)、slotMap(整数键)、dataIndex(`slotIndex mod N`)、reflow/snap/clamp 全部的几何基石。

N=2 时 min=2、奇偶化砍成 1,只建 1 个书对象,第二本丢失(用户 bug:上传 2 本只见 1 本)。N=1 走 `slots<=1` 单本特殊路径(独立橡皮筋动画)。根因:奇数化与 N=1,2 冲突。N=3 满窗不崩但顺序乱(slotIndex=−1 映射 dataIndex 2 最旧,向右拖第一->第三跳过第二);N≥4 `slots=N−1` 奇 + virtual reflow 遍历(小窗口,用户期望 N 本全显而非滑动遍历)。

## 决策

### D1:N≤9 补虚拟满窗 + realSlots 正侧顺序对

`computeShelfSlots`:
- N≤9:`slots = max(3, 2N−1)`。N=1,2->3;N=3->5;…;N=9->17。realSlots 正侧 [0..N−1],向左拖 第一->…->第N 顺序对(slot0 钉中心 + mod 编址,正侧优先占位使负侧 mod 重复成虚拟位)。
- N≥10:`slots = min(N, 17, max(N−1,3))` 奇数化(原 reflow 设计,滑动遍历)。

满窗而非原 reflow:原 N≥4 `slots=N−1` 小窗口滑动遍历,用户期望 N 本全显。N≤9 满窗 slots=2N−1(补虚拟),N 本全建不 reflow。代价:N=8,9 正侧 7,8 落缓冲区(可见槽位 13=slotIndex±6),静态不可见但拖动到 currentSlot=7/8 可入中心。N=10 slots=19 超 SLOT_COUNT(17),走 reflow。

N=3 补到 5(非 3):slots=3 时 realSlots=[−1,0,1],slotIndex=−1 映射最旧,向右拖第一->第三 跳过第二(顺序乱);补到 5 realSlots=[0,1,2] 正侧顺序对。

### D2:虚拟位空槽(mod 重复位),不建对象

N≤9 补虚拟时,slotIndex mod N 重复位不建 mesh、不进 `allSlots`/`slotMap`(`computeRealSlots` 去重,正侧优先)。N=1:虚拟 ±1、真书 {0};N=2:虚拟 −1、真书 {0,+1};N=3:虚拟 −1,−2、真书 {0,+1,+2};…;N=9:虚拟 −1..−8、真书 {0..+8}。−half 恰是 mod 重复位,跳过即去重,真书无重复。

### D3:currentSlot 量化真书槽集(realSlots)

`currentSlot = round(−rot/effStep)` clamp 到 realSlots 范围(virtual=true 时 round 无 clamp--reflow 使 slotIndex ≡ currentSlot mod slots 落回窗口)。永不着陆虚拟位。虚拟位因 `isCurrent = book.slotIndex === currentSlot` 永假,自动不抽出/不光泽/不命中/不点击--无需每处判 isVirtual。

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
- **N=3 保持 slots=3 满窗**:顺序乱(向右跳第三),用户反馈不可接受;补到 5 牺牲对称(2 空位)换顺序对。
- **N<11 满窗**:N=10 slots=19 超 SLOT_COUNT(17),不可行;临界收到 9。
- **N≤7 满窗(静态全显)**:N=8,9 退回 reflow,行为跳跃;选 N≤9 接受 8,9 静态部分缓冲(拖动可达)。

## 后果

- **N≤9 有虚拟空位**:负侧 mod 重复位空。视觉数量 = N(一致),布局非对称(正侧占用使负侧空)。
- **N=8,9 静态部分缓冲**:正侧 7,8 落可见槽位外(slotIndex±6),静态不可见,拖动 currentSlot=7/8 可入中心。
- **clamp/snap/currentSlot 须同步 realSlots**:任一不同步引入"虚拟滑中心留空"或"currentSlot 落空位"新 bug。
- **virtual=true 时 currentSlot 不 clamp**:currentSlot 是自由逻辑槽(reflow 处理窗口),clamp 会与 reflow slotIndex 错位致 isCurrent 失败(曾引入 N≥4 崩,已修)。
- **单本路径代码删除**:`slots<=1` 分支不再可达。
- **N≥10 reflow**:原 `slots=N−1` 滑动遍历,零变化。
- **虚拟位是 layer2 视觉概念**:不进 layer1 `/api/pages`,只在 `BookShelf3D` 内部凑 slots。

## 验证

- `computeShelfSlots` 测试:N=1,2->3;N=3->5;N=4->7;N=9->17;N=10->9(reflow);N=18->17。
- `computeRealSlots` 测试:N=4 slots=7->[0,1,2,3];N=9 slots=17->[0..8](正侧顺序对)。
- currentSlot 量化测试:virtual=false 永落 realSlots,virtual=true 自由。
- N=2 渲染 2 本、N=3 渲染 3 本、N=9 渲染 9 本(虚拟空位不渲染)。
- 现有 `bookShelfReflow` 测试不破(N≥10 reflow 路径不变)。
- `make typecheck` / `make format` 通过。

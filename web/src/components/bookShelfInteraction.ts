// BookShelf3D 交互状态机的纯决策函数（参照 bookShelfReflow.ts 模式）。
// 从主 useEffect 闭包抽出的纯逻辑：snap/clamp/速度采样/fly/orbit 对齐/click 阈值。
// 只算"目标值"，rot 对象/snapping 布尔/gsap 调用留 useEffect--纯函数不知道 gsap 存在。

export const CLICK_MOVE_PX = 6 // 位移阈值：小于此判定为点击而非拖拽

// 槽位规划（从 BookShelf3D 主 useEffect 抽出的纯决策）：slot0 钉中心。
// N≤3：补虚拟满窗，realSlots 正侧 [0..N-1] 顺序对（向左拖 第一->第二->第三…）。
//   N=1,2 -> slots=3；N=3 -> slots=5（2 虚拟）。ADR-0015 D1 + N=3 补到 5。
// N≥4：slots=N-1 留 reflow 空间（virtual=true，自由拖滚遍），奇数化保 slot0。
export function computeShelfSlots(
  n: number,
  slotCount: number,
): { slots: number; half: number; virtual: boolean } {
  let slots = n <= 3 ? Math.max(3, 2 * n - 1) : Math.min(n, slotCount, Math.max(n - 1, 3))
  if (slots % 2 === 0) slots -= 1
  const half = (slots - 1) / 2
  const virtual = n > slots
  return { slots, half, virtual }
}

// 真书槽集（ADR-0015 D2/D3）：slots 个槽位中去掉虚拟位后的真实 slotIndex 集合（升序）。
// 虚拟位 = dataIndex(slotIndex mod n) 重复的槽--补虚拟凑奇时 N<slots 导致 mod 重复。
// 占位顺序 slot0 -> +1..+half -> -1..-half：正侧优先，-half（左边缘）作为重复位被跳过。
export function computeRealSlots(slots: number, n: number): number[] {
  const half = (slots - 1) / 2
  const seen = new Set<number>()
  const order: number[] = [0]
  for (let i = 1; i <= half; i++) order.push(i)
  for (let i = 1; i <= half; i++) order.push(-i)
  const real: number[] = []
  for (const si of order) {
    const di = ((si % n) + n) % n
    if (!seen.has(di)) {
      seen.add(di)
      real.push(si)
    }
  }
  return real.sort((a, b) => a - b)
}

// 吸附 rot 到最近真书槽（中心对齐到一本）。virtual 时不收敛（靠 reflow 收敛 pos）；
// 非 virtual 收敛到 realSlots [realMin, realMax] 防 rot 累积飞出后松手不回（7ea7aa6 根因）。
// D3/D4（ADR-0015）：clamp 到 realSlots 而非 [-half, half]--N=1,2 时虚拟位 -half 不在 realSlots，
// 吸附永不着陆虚拟。N≥3 realSlots=[-half, half]，与原行为一致。
export function snapTarget(
  rotVal: number,
  effStep: number,
  half: number,
  virtual: boolean,
  realMin: number = -half,
  realMax: number = half,
): number {
  const targetSlot = Math.round(-rotVal / effStep)
  const slot = virtual ? targetSlot : Math.max(realMin, Math.min(realMax, targetSlot))
  return slot === 0 ? 0 : -slot * effStep
}

// rot 硬夹到真书槽区间（墙=最远真书槽的半槽边界，松手 snap 对齐），防 x=sin(a)*RADIUS 飞出视口
// 且防 currentSlot 落虚拟位。D4（ADR-0015）：取「防飞视口 ±half*effStep」与「防落虚拟 realSlots
// 区间」的紧交集。N≥3 realMin=-half/realMax=half -> realSlots 区间 ±(half+0.5)*effStep（松于 ±half）
// 退化为原 ±half*effStep；N=1,2 realSlots 子集 -> 非对称夹（虚拟方向挡）。
export function clampRot(
  val: number,
  effStep: number,
  half: number,
  realMin: number = -half,
  realMax: number = half,
): number {
  const winLimit = half * effStep
  const lo = Math.max(-winLimit, -(realMax + 0.5) * effStep)
  const hi = Math.min(winLimit, -(realMin - 0.5) * effStep)
  return Math.max(lo, Math.min(hi, val))
}

// 松手前近 100ms 速度采样算惯性初速（弧度/秒）。span 下限 16ms，防 up 与最后一次 move
// 间隔过小把抖动放大成猛烈甩动。空样本 -> 0。
export function velocityFromSamples(
  samples: { t: number; dx: number }[],
  now: number,
  pixelToAngle: number,
): number {
  if (samples.length === 0) return 0
  const sumDx = samples.reduce((s, v) => s + v.dx, 0)
  const span = Math.max(16, now - samples[0].t)
  return (sumDx * pixelToAngle) / (span / 1000)
}

// 点击演出参数：tween rot 到目标槽（最短弧 target=-targetSlot*effStep），时长按距离缩放
// duration=min(0.8, 0.4+steps*0.05)，远距封顶 0.8s。
export function flyToTarget(
  rotVal: number,
  targetSlot: number,
  effStep: number,
): { target: number; duration: number } {
  const target = -targetSlot * effStep
  const steps = Math.abs(target - rotVal) / effStep
  const duration = Math.min(0.8, 0.4 + steps * 0.05)
  return { target, duration }
}

// 进入轨道球：对齐 rot 到最近真书槽（稳定 currentSlot）。
// D4（ADR-0015）：clamp 到 realSlots [realMin, realMax]，不落虚拟。
export function orbitAlignTarget(
  rotVal: number,
  effStep: number,
  realMin: number,
  realMax: number,
): number {
  const slot = Math.max(realMin, Math.min(realMax, Math.round(-rotVal / effStep)))
  return slot === 0 ? 0 : -slot * effStep
}

// 位移是否在点击阈值内（<=CLICK_MOVE_PX）：true 表示应视为点击、不触发拖拽。
export function isClickMove(clientX: number, dragStartX: number): boolean {
  return Math.abs(clientX - dragStartX) <= CLICK_MOVE_PX
}

import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  snapTarget,
  clampRot,
  velocityFromSamples,
  flyToTarget,
  orbitAlignTarget,
  isClickMove,
  computeShelfSlots,
  computeRealSlots,
  cursorForState,
  CLICK_MOVE_PX,
} from './bookShelfInteraction.js'

// 参数对齐 BookShelf3D：SLOT_COUNT=17（half=8），ANGLE_STEP=0.05（spreadP=0 时 effStep=0.05）
const HALF = 8
const SLOTS = 17
const EFF_STEP = 0.05

// ---------- snapTarget ----------

test('snapTarget 多本无 virtual、rot 累积飞出窗口 -> 收敛回 [-half,half]（7ea7aa6 根因）', () => {
  // rotVal=-0.5 -> targetSlot=round(0.5/0.05)=10，超 half=8；无 virtual 应夹到 slot=8
  const target = snapTarget(-0.5, EFF_STEP, HALF, false)
  const slot = -target / EFF_STEP
  assert.ok(slot >= -HALF, `slot=${slot} 应 >= -half=${-HALF}`)
  assert.ok(slot <= HALF, `slot=${slot} 应 <= half=${HALF}`)
})

test('snapTarget 多本 virtual -> 不收敛，靠 reflow 收敛 pos', () => {
  const target = snapTarget(-0.5, EFF_STEP, HALF, true)
  assert.equal(-target / EFF_STEP, 10) // 不夹，原样 round(10)
})

test('snapTarget 两槽正中 -> round 半数向 +Inf（JS Math.round 行为）', () => {
  // rotVal=-0.025 -> -rotVal/effStep=0.5 -> Math.round(0.5)=1
  const target = snapTarget(-0.025, EFF_STEP, HALF, true)
  assert.equal(-target / EFF_STEP, 1)
})

test('snapTarget N=2 realSlots=[0,1] -> 不吸虚拟 -1（吸 slot0）', () => {
  // realMin=0, realMax=1, half=1。rotVal=0.05 -> targetSlot=round(-1)=-1 -> clamp(-1,0,1)=0 -> 0
  assert.equal(snapTarget(0.05, EFF_STEP, 1, false, 0, 1), 0)
  // rotVal=0.025 -> targetSlot=round(-0.5)=0（JS 向 +Inf）-> 0
  assert.equal(snapTarget(0.025, EFF_STEP, 1, false, 0, 1), 0)
  // rotVal=-0.05 -> targetSlot=1 -> clamp(1,0,1)=1 -> -0.05（吸 slot1）
  assert.equal(snapTarget(-0.05, EFF_STEP, 1, false, 0, 1), -0.05)
})

// ---------- clampRot ----------

test('clampRot 窗口内 -> 原值', () => {
  // limit = half*effStep = 8*0.05 = 0.4
  assert.equal(clampRot(0, EFF_STEP, HALF), 0)
  assert.equal(clampRot(0.1, EFF_STEP, HALF), 0.1)
})

test('clampRot 超出 -> 夹到 ±limit（limit=half*effStep）', () => {
  assert.equal(clampRot(1, EFF_STEP, HALF), 0.4)
  assert.equal(clampRot(-1, EFF_STEP, HALF), -0.4)
})

test('clampRot 边界值 ±limit -> 原值（不夹）', () => {
  assert.equal(clampRot(0.4, EFF_STEP, HALF), 0.4)
  assert.equal(clampRot(-0.4, EFF_STEP, HALF), -0.4)
})

test('clampRot N=2 realSlots=[0,1] -> 非对称夹，防落虚拟 -1', () => {
  // realMin=0, realMax=1, half=1, effStep=0.05
  // winLimit=0.05; lo=max(-0.05, -(1.5)*0.05=-0.075)=-0.05; hi=min(0.05, -(-0.5)*0.05=0.025)=0.025
  // 正向（向虚拟 -1）夹到 hi=0.025；负向（向真1）夹到 lo=-0.05
  assert.equal(clampRot(0.05, EFF_STEP, 1, 0, 1), 0.025)
  assert.equal(clampRot(-0.05, EFF_STEP, 1, 0, 1), -0.05)
  assert.equal(clampRot(1, EFF_STEP, 1, 0, 1), 0.025)
  assert.equal(clampRot(-1, EFF_STEP, 1, 0, 1), -0.05)
})

// ---------- velocityFromSamples ----------

test('velocityFromSamples 空样本 -> 0', () => {
  assert.equal(velocityFromSamples([], 1000, 0.012), 0)
})

test('velocityFromSamples 正常采样 -> 平均速度（弧度/秒）', () => {
  // sumDx=30, span=max(16, 1010-900)=110ms, vel=30*0.012/0.11
  const samples = [
    { t: 900, dx: 10 },
    { t: 1000, dx: 20 },
  ]
  const vel = velocityFromSamples(samples, 1010, 0.012)
  assert.ok(Math.abs(vel - (30 * 0.012) / 0.11) < 1e-9, `vel=${vel}`)
})

test('velocityFromSamples span<16ms -> 用 16ms 下限（防抖动放大成甩动）', () => {
  // span=max(16, 1005-1000)=16, vel=10*0.012/0.016=7.5
  const samples = [{ t: 1000, dx: 10 }]
  const vel = velocityFromSamples(samples, 1005, 0.012)
  assert.ok(Math.abs(vel - 7.5) < 1e-9, `vel=${vel} 应=7.5`)
})

// ---------- flyToTarget ----------

test('flyToTarget target = -targetSlot*effStep', () => {
  const r = flyToTarget(0, 3, EFF_STEP)
  assert.equal(r.target, -3 * EFF_STEP)
})

test('flyToTarget duration 按距离缩放、远距封顶 0.8', () => {
  // steps=3, duration=0.4+3*0.05=0.55
  const r1 = flyToTarget(0, 3, EFF_STEP)
  assert.ok(Math.abs(r1.duration - 0.55) < 1e-9, `duration=${r1.duration}`)
  // steps=20, duration=min(0.8, 0.4+20*0.05=1.4)=0.8
  const r2 = flyToTarget(0, 20, EFF_STEP)
  assert.equal(r2.duration, 0.8)
})

// ---------- orbitAlignTarget ----------

test('orbitAlignTarget 多本 -> 对齐最近真书槽', () => {
  // rotVal=-0.12 -> round(0.12/0.05)=round(2.4)=2 -> clamp(2,-8,8)=2 -> -2*0.05=-0.1
  assert.equal(orbitAlignTarget(-0.12, EFF_STEP, -HALF, HALF), -0.1)
})

test('orbitAlignTarget N=2 -> 不对齐虚拟 -1（对齐 slot0）', () => {
  // rotVal=0.05 -> round(-1)=-1 -> clamp(-1,0,1)=0 -> 0
  assert.equal(orbitAlignTarget(0.05, EFF_STEP, 0, 1), 0)
  // rotVal=-0.05 -> round(1)=1 -> clamp(1,0,1)=1 -> -0.05
  assert.equal(orbitAlignTarget(-0.05, EFF_STEP, 0, 1), -0.05)
})

// ---------- isClickMove ----------

test('isClickMove |dx|<阈值 -> true（点击）', () => {
  assert.equal(isClickMove(100, 102), true) // dx=2 < 6
})

test('isClickMove |dx|>阈值 -> false（拖拽）', () => {
  assert.equal(isClickMove(100, 110), false) // dx=10 > 6
})

test('isClickMove |dx|=阈值 -> true（<=算点击）', () => {
  assert.equal(isClickMove(100, 100 + CLICK_MOVE_PX), true)
  assert.equal(isClickMove(100, 100 - CLICK_MOVE_PX), true)
})

// ---------- computeShelfSlots ----------

test('computeShelfSlots N=1 -> 补虚拟位到 3（slots=3, half=1, virtual=false）', () => {
  const r = computeShelfSlots(1, SLOTS)
  assert.equal(r.slots, 3)
  assert.equal(r.half, 1)
  assert.equal(r.virtual, false)
})

test('computeShelfSlots N=2 -> 补虚拟位到 3（slots=3, half=1, virtual=false）', () => {
  const r = computeShelfSlots(2, SLOTS)
  assert.equal(r.slots, 3)
  assert.equal(r.half, 1)
  assert.equal(r.virtual, false)
})

test('computeShelfSlots N=3 -> 满窗 3 槽（virtual=false）', () => {
  const r = computeShelfSlots(3, SLOTS)
  assert.equal(r.slots, 3)
  assert.equal(r.half, 1)
  assert.equal(r.virtual, false)
})

test('computeShelfSlots N=4 -> slots=3 + virtual（reflow 换皮遍 4 本）', () => {
  const r = computeShelfSlots(4, SLOTS)
  assert.equal(r.slots, 3)
  assert.equal(r.virtual, true)
})

test('computeShelfSlots N>SLOT_COUNT -> 封顶 17 + virtual', () => {
  const r = computeShelfSlots(18, SLOTS)
  assert.equal(r.slots, 17)
  assert.equal(r.virtual, true)
})

// ---------- computeRealSlots ----------

test('computeRealSlots N=1 slots=3 -> [0]（±1 皆虚拟，1 本无法只左空）', () => {
  assert.deepEqual(computeRealSlots(3, 1), [0])
})

test('computeRealSlots N=2 slots=3 -> [0,1]（左边缘 -1 虚拟）', () => {
  assert.deepEqual(computeRealSlots(3, 2), [0, 1])
})

test('computeRealSlots N=3 slots=3 -> [-1,0,1]（满窗无虚拟）', () => {
  assert.deepEqual(computeRealSlots(3, 3), [-1, 0, 1])
})

test('computeRealSlots N=4 slots=3 -> [-1,0,1]（virtual reflow，窗口内无虚拟）', () => {
  assert.deepEqual(computeRealSlots(3, 4), [-1, 0, 1])
})

test('computeRealSlots N=6 slots=5 -> [-2,-1,0,1,2]', () => {
  assert.deepEqual(computeRealSlots(5, 6), [-2, -1, 0, 1, 2])
})

test('computeRealSlots N=17 slots=17 -> [-8..8] 全真（17 项）', () => {
  const r = computeRealSlots(17, 17)
  assert.equal(r.length, 17)
  assert.equal(r[0], -8)
  assert.equal(r[16], 8)
})

// ---------- cursorForState ----------

test('cursorForState 默认（全 false）-> ""（清空 inline,让位 CSS 默认 grab）', () => {
  assert.equal(cursorForState({ orbiting: false, dragging: false, currentHovered: false }), '')
})

test('cursorForState hover 中心抽出本 -> pointer（独占「能打开」信号,CSS 做不到 3D 命中）', () => {
  assert.equal(
    cursorForState({ orbiting: false, dragging: false, currentHovered: true }),
    'pointer',
  )
})

test('cursorForState 拖拽中 -> ""（让位 CSS :active grabbing）', () => {
  assert.equal(cursorForState({ orbiting: false, dragging: true, currentHovered: false }), '')
})

test('cursorForState 拖拽中压过 hover（从中心本上起拖即让位 :active）', () => {
  assert.equal(cursorForState({ orbiting: false, dragging: true, currentHovered: true }), '')
})

test('cursorForState 轨道球 -> ""（让位 CSS .orbiting grabbing,主分支版本）', () => {
  assert.equal(cursorForState({ orbiting: true, dragging: false, currentHovered: false }), '')
})

test('cursorForState 轨道球压过 hover 残留（进出轨道球 inline 必清空,CSS class 才生效）', () => {
  assert.equal(cursorForState({ orbiting: true, dragging: false, currentHovered: true }), '')
})

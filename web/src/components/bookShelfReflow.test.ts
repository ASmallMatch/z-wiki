import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reflowSlot } from './bookShelfReflow.js'

// 参数对齐 BookShelf3D：SLOT_COUNT=17（half=8），ANGLE_STEP=0.05（spreadP=0 时 effStep=0.05）
const HALF = 8
const SLOTS = 17
const EFF_STEP = 0.05

// reflow 后书的逻辑位置 newPos = newSlot + rotVal/effStep 必须落回窗口内，
// 否则 a = newSlot*effStep + rotVal 会算出超大值，position.x = sin(a)*RADIUS 飞出滑轨、
// rotation.y 偏离书脊朝前（用户现象：快速拖动书脱离固定区域、书脊不向前、散落）
function newPos(slotIndex: number, rotVal: number): number {
  const r = reflowSlot(slotIndex, rotVal, EFF_STEP, HALF, SLOTS)
  return r.slotIndex + rotVal / EFF_STEP
}

test('缓慢拖动（pos 单窗口超出）-> 单次移动即收敛回窗口内', () => {
  // pos = 0 + 0.45/0.05 = 9（刚超 half+0.5=8.5）
  const np = newPos(0, 0.45)
  assert.ok(np <= HALF + 0.5, `newPos=${np} 应 ≤ ${HALF + 0.5}`)
  assert.ok(np >= -HALF - 0.5, `newPos=${np} 应 ≥ ${-HALF - 0.5}`)
})

test('快速拖动一帧 rot 大跳（pos 跨多窗口）-> 应一次收敛回窗口内', () => {
  // pos = 0 + 1.5/0.05 = 30（跨约 2 个窗口宽）：快速划过时一帧内 pointermove 累积大 dx 的典型量级
  const np = newPos(0, 1.5)
  assert.ok(np <= HALF + 0.5, `newPos=${np} 应 ≤ ${HALF + 0.5}（当前单次 if 会滞留窗外致书飞出）`)
  assert.ok(np >= -HALF - 0.5, `newPos=${np} 应 ≥ ${-HALF - 0.5}`)
})

test('快速拖动反向（pos 负向跨多窗口）-> 应一次收敛回窗口内', () => {
  const np = newPos(0, -1.5)
  assert.ok(np <= HALF + 0.5, `newPos=${np} 应 ≤ ${HALF + 0.5}`)
  assert.ok(np >= -HALF - 0.5, `newPos=${np} 应 ≥ ${-HALF - 0.5}`)
})

test('pos 在窗口内 -> 不动', () => {
  const r = reflowSlot(0, 0.25, EFF_STEP, HALF, SLOTS) // pos=5
  assert.equal(r.moved, false)
  assert.equal(r.slotIndex, 0)
  assert.equal(r.dataOffset, 0)
})

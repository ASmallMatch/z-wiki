import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeCurrentIndex, navDisabled } from './chatNav.js'

test('computeCurrentIndex: 无 user 行 -> -1', () => {
  assert.equal(computeCurrentIndex([], 100), -1)
})

test('computeCurrentIndex: 第一条贴顶 -> 0', () => {
  assert.equal(computeCurrentIndex([100, 300, 500], 100), 0)
})

test('computeCurrentIndex: 第一条在顶下 -> 0', () => {
  assert.equal(computeCurrentIndex([120, 300, 500], 100), 0)
})

test('computeCurrentIndex: 前两条滚出、第三条贴顶 -> 2', () => {
  assert.equal(computeCurrentIndex([80, 90, 100, 300], 100), 2)
})

test('computeCurrentIndex: 第一条刚滚出、第二条在视口 -> 1', () => {
  assert.equal(computeCurrentIndex([95, 200, 400], 100), 1)
})

test('computeCurrentIndex: 全滚出顶部(停在 assistant 中间)-> 最后一条', () => {
  assert.equal(computeCurrentIndex([50, 60, 70], 100), 2)
})

test('navDisabled: userCount=0 -> 双禁用', () => {
  assert.deepEqual(navDisabled({ streaming: false, userCount: 0, currentIdx: -1 }), {
    up: true,
    down: true,
  })
})

test('navDisabled: 单条 user -> 双禁用', () => {
  assert.deepEqual(navDisabled({ streaming: false, userCount: 1, currentIdx: 0 }), {
    up: true,
    down: true,
  })
})

test('navDisabled: 流式中(即使多条)-> 双禁用', () => {
  assert.deepEqual(navDisabled({ streaming: true, userCount: 3, currentIdx: 1 }), {
    up: true,
    down: true,
  })
})

test('navDisabled: 多条、在第一条 -> 仅 up 禁用', () => {
  assert.deepEqual(navDisabled({ streaming: false, userCount: 3, currentIdx: 0 }), {
    up: true,
    down: false,
  })
})

test('navDisabled: 多条、在最后一条 -> 仅 down 禁用', () => {
  assert.deepEqual(navDisabled({ streaming: false, userCount: 3, currentIdx: 2 }), {
    up: false,
    down: true,
  })
})

test('navDisabled: 多条、中间 -> 都可用', () => {
  assert.deepEqual(navDisabled({ streaming: false, userCount: 3, currentIdx: 1 }), {
    up: false,
    down: false,
  })
})

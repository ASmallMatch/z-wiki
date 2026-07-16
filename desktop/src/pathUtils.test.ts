import { test } from 'node:test'
import assert from 'node:assert/strict'
import { needsWindowsGpuSandboxFallback } from './pathUtils.js'

test('needsWindowsGpuSandboxFallback: Win10 1809(build 17763)-> true(需禁 GPU/沙箱)', () => {
  assert.equal(needsWindowsGpuSandboxFallback('win32', '10.0.17763'), true)
})

test('needsWindowsGpuSandboxFallback: Win10 1909(build 18363)-> true(2004 以下均禁)', () => {
  assert.equal(needsWindowsGpuSandboxFallback('win32', '10.0.18363'), true)
})

test('needsWindowsGpuSandboxFallback: Win10 2004(build 19041)-> false(保 GPU/3D)', () => {
  assert.equal(needsWindowsGpuSandboxFallback('win32', '10.0.19041'), false)
})

test('needsWindowsGpuSandboxFallback: Win11(build 22000)-> false', () => {
  assert.equal(needsWindowsGpuSandboxFallback('win32', '10.0.22000'), false)
})

test('needsWindowsGpuSandboxFallback: mac/linux -> false(不受影响)', () => {
  assert.equal(needsWindowsGpuSandboxFallback('darwin', '23.0.0'), false)
  assert.equal(needsWindowsGpuSandboxFallback('linux', '6.6.0'), false)
})

test('needsWindowsGpuSandboxFallback: release 解析失败 -> false(不冒险禁)', () => {
  assert.equal(needsWindowsGpuSandboxFallback('win32', ''), false)
  assert.equal(needsWindowsGpuSandboxFallback('win32', 'garbage'), false)
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { selectPandocAsset, getPandocBinDir, getPandocPath } from './pandocManager.js'

// pandoc 下载管理单测(ADR-0007 决策 3):平台→asset 映射纯函数。
// ensurePandoc 涉及网络下载 + 系统解压,不单测(靠 selectPandocAsset 保证平台映射正确)。

test('selectPandocAsset: linux amd64/arm64 → tar.gz', () => {
  assert.deepEqual(selectPandocAsset('linux', 'x64'), {
    asset: 'pandoc-3.10-linux-amd64.tar.gz',
    binary: 'pandoc',
  })
  assert.deepEqual(selectPandocAsset('linux', 'arm64'), {
    asset: 'pandoc-3.10-linux-arm64.tar.gz',
    binary: 'pandoc',
  })
})

test('selectPandocAsset: macOS arm64/x86_64 → zip', () => {
  assert.deepEqual(selectPandocAsset('darwin', 'arm64'), {
    asset: 'pandoc-3.10-arm64-macOS.zip',
    binary: 'pandoc',
  })
  assert.deepEqual(selectPandocAsset('darwin', 'x64'), {
    asset: 'pandoc-3.10-x86_64-macOS.zip',
    binary: 'pandoc',
  })
})

test('selectPandocAsset: windows → zip + pandoc.exe', () => {
  assert.deepEqual(selectPandocAsset('win32', 'x64'), {
    asset: 'pandoc-3.10-windows-x86_64.zip',
    binary: 'pandoc.exe',
  })
})

test('selectPandocAsset: 不支持的平台抛错', () => {
  assert.throws(() => selectPandocAsset('solaris', 'x64'), /不支持的平台/)
})

test('getPandocBinDir / getPandocPath: 基于 agentDir 派生', () => {
  assert.equal(getPandocBinDir('/x/.pi/agent'), '/x/.pi/agent/bin')
  // getPandocPath 依赖 process.platform(windows 用 pandoc.exe)
  const expected = process.platform === 'win32' ? 'pandoc.exe' : 'pandoc'
  assert.equal(getPandocPath('/x/.pi/agent'), `/x/.pi/agent/bin/${expected}`)
})

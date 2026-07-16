import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildContextMenuTemplate } from './contextMenu.js'

// 模板项含 click 函数(不可深比较),断言只看结构字段(role/label/type/enabled)。
function find(items: ReturnType<typeof buildContextMenuTemplate>, label: string) {
  return items.find((i) => 'label' in i && i.label === label)
}

test('buildContextMenuTemplate: 含编辑 role 项(撤销/剪切/复制/粘贴/全选)', () => {
  const t = buildContextMenuTemplate({
    canGoBack: false,
    canGoForward: false,
    onBack: () => {},
    onForward: () => {},
  })
  assert.equal(find(t, '撤销')?.role, 'undo')
  assert.equal(find(t, '剪切')?.role, 'cut')
  assert.equal(find(t, '复制')?.role, 'copy')
  assert.equal(find(t, '粘贴')?.role, 'paste')
  assert.equal(find(t, '全选')?.role, 'selectAll')
})

test('buildContextMenuTemplate: 含视图 role 项(重新加载/开发者工具)', () => {
  const t = buildContextMenuTemplate({
    canGoBack: false,
    canGoForward: false,
    onBack: () => {},
    onForward: () => {},
  })
  assert.equal(find(t, '重新加载')?.role, 'reload')
  assert.equal(find(t, '开发者工具')?.role, 'toggleDevTools')
})

test('buildContextMenuTemplate: back/forward 按 canGoBack/canGoForward 启用', () => {
  const t = buildContextMenuTemplate({
    canGoBack: true,
    canGoForward: false,
    onBack: () => {},
    onForward: () => {},
  })
  assert.equal(find(t, '后退')?.enabled, true)
  assert.equal(find(t, '前进')?.enabled, false)
})

test('buildContextMenuTemplate: click 回调被注入(back 调 onBack,forward 调 onForward)', () => {
  let backCalls = 0
  let fwdCalls = 0
  const t = buildContextMenuTemplate({
    canGoBack: true,
    canGoForward: true,
    onBack: () => {
      backCalls++
    },
    onForward: () => {
      fwdCalls++
    },
  })
  const back = find(t, '后退')
  const fwd = find(t, '前进')
  // click 签名 (menuItem, window, event) => void;调用方按需传参,此处直接调验证绑定。
  ;(back?.click as (a: unknown, b: unknown, c: unknown) => void)?.(undefined, undefined, undefined)
  ;(fwd?.click as (a: unknown, b: unknown, c: unknown) => void)?.(undefined, undefined, undefined)
  assert.equal(backCalls, 1)
  assert.equal(fwdCalls, 1)
})

test('buildContextMenuTemplate: 含分隔符(role 项与自定义项之间)', () => {
  const t = buildContextMenuTemplate({
    canGoBack: false,
    canGoForward: false,
    onBack: () => {},
    onForward: () => {},
  })
  const separators = t.filter((i) => 'type' in i && i.type === 'separator')
  // 编辑组 / 导航组 / 视图组 之间共 3 个分隔符
  assert.ok(separators.length >= 3, '至少 3 个分隔符分隔编辑/导航/视图组')
})

import assert from 'node:assert/strict'
import { test } from 'node:test'
import { isAllowedBashCommand } from './bashWhitelist.js'

// bash 命令白名单纯函数单测(ADR-0007 决策 2):只放行 pandoc 单条命令,禁元字符,防 rm -rf 绕过。

test('isAllowedBashCommand: pandoc 单条命令放行', () => {
  assert.deepEqual(isAllowedBashCommand('pandoc raw/x.docx -t markdown'), { ok: true })
  assert.deepEqual(isAllowedBashCommand('pandoc file.epub -t markdown'), { ok: true })
  assert.deepEqual(isAllowedBashCommand('pandoc raw/report.xlsx -t markdown -o -'), { ok: true })
  // 前后空格容忍
  assert.deepEqual(isAllowedBashCommand('  pandoc raw/x.docx -t markdown  '), { ok: true })
})

test('isAllowedBashCommand: 非 pandoc 命令 block', () => {
  const r1 = isAllowedBashCommand('rm -rf /')
  assert.equal(r1.ok, false)
  assert.match(r1.reason ?? '', /pandoc/)

  const r2 = isAllowedBashCommand('cat /etc/passwd')
  assert.equal(r2.ok, false)
  assert.match(r2.reason ?? '', /pandoc/)

  const r3 = isAllowedBashCommand('ls -la')
  assert.equal(r3.ok, false)
})

test('isAllowedBashCommand: shell 元字符绕过 block', () => {
  const cases = [
    'pandoc x.docx -t markdown; rm -rf /',
    'pandoc x.docx -t markdown | grep foo',
    'pandoc x.docx -t markdown && rm -rf',
    'pandoc x.docx -t markdown || rm -rf',
    'pandoc x.docx > /etc/passwd',
    'pandoc x.docx < /etc/passwd',
    '$(rm -rf /)',
    'pandoc x.docx -t markdown\nrm -rf',
    '`rm -rf`',
  ]
  for (const cmd of cases) {
    const r = isAllowedBashCommand(cmd)
    assert.equal(r.ok, false, `应 block 含元字符的命令: ${JSON.stringify(cmd)}`)
    assert.match(r.reason ?? '', /元字符/, `reason 应提及元字符: ${JSON.stringify(cmd)}`)
  }
})

test('isAllowedBashCommand: 空命令 block', () => {
  assert.equal(isAllowedBashCommand('').ok, false)
  assert.equal(isAllowedBashCommand('   ').ok, false)
})

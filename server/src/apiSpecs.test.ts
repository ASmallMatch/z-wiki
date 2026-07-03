import { test } from 'node:test'
import assert from 'node:assert/strict'
import { API_SPECS, DEFAULT_EXPOSED_SPECS, normalizeBaseUrl } from './apiSpecs.js'

test('API_SPECS: 首版暴露 openai-completions + anthropic-messages', () => {
  const ids = API_SPECS.map((s) => s.id)
  assert.deepEqual(ids, ['openai-completions', 'anthropic-messages'])
})

test('API_SPECS: 每项有 label + 以 / 开头的 suffix', () => {
  for (const spec of API_SPECS) {
    assert.ok(spec.label, `${spec.id} 缺 label`)
    assert.ok(spec.suffix.startsWith('/'), `${spec.id} 的 suffix 应以 / 开头`)
  }
})

test('DEFAULT_EXPOSED_SPECS: 与 API_SPECS 的 id 对齐', () => {
  assert.deepEqual(DEFAULT_EXPOSED_SPECS, ['openai-completions', 'anthropic-messages'])
})

test('normalizeBaseUrl: openai-completions 剥尾部 /chat/completions', () => {
  assert.equal(
    normalizeBaseUrl('https://host/v1/xxx/chat/completions', 'openai-completions'),
    'https://host/v1/xxx',
  )
})

test('normalizeBaseUrl: anthropic-messages 剥尾部 /v1/messages', () => {
  assert.equal(normalizeBaseUrl('https://host/v1/messages', 'anthropic-messages'), 'https://host')
})

test('normalizeBaseUrl: trailing slash 剥', () => {
  assert.equal(normalizeBaseUrl('https://host/v1/', 'openai-completions'), 'https://host/v1')
})

test('normalizeBaseUrl: suffix + trailing slash 同时剥(先 slash 后 suffix)', () => {
  assert.equal(
    normalizeBaseUrl('https://host/v1/chat/completions/', 'openai-completions'),
    'https://host/v1',
  )
})

test('normalizeBaseUrl: 已是正确形态不剥', () => {
  assert.equal(normalizeBaseUrl('https://host/v1', 'openai-completions'), 'https://host/v1')
  assert.equal(normalizeBaseUrl('https://host', 'anthropic-messages'), 'https://host')
})

test('normalizeBaseUrl: 后缀跟 api 不匹配 → 不剥', () => {
  // 选 anthropic 但 URL 尾部是 openai 的 suffix → 不剥,原样返回
  assert.equal(
    normalizeBaseUrl('https://host/v1/chat/completions', 'anthropic-messages'),
    'https://host/v1/chat/completions',
  )
})

test('normalizeBaseUrl: 未知 api → 不处理', () => {
  assert.equal(
    normalizeBaseUrl('https://host/v1/chat/completions', 'bedrock-converse-stream'),
    'https://host/v1/chat/completions',
  )
})

test('normalizeBaseUrl: 空字符串 → 空字符串', () => {
  assert.equal(normalizeBaseUrl('', 'openai-completions'), '')
})

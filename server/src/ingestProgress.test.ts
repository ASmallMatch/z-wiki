// ingestProgress.test.ts - ingest 里程碑进度纯函数单测(ADR-0019)。
// classifyMilestone:tool_execution_start + 工具/路径 -> 里程碑百分比;nextAnchor:锚点序列下一。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { classifyMilestone, nextAnchor, INGEST_PROGRESS_ANCHORS } from './ingestProgress.js'

// ── classifyMilestone:非 tool_execution_start -> null ─────────────────

test('classifyMilestone: 非 tool_execution_start -> null', () => {
  for (const type of ['message_update', 'tool_execution_end', 'agent_end']) {
    assert.equal(
      classifyMilestone({ type, toolName: 'read', args: { file_path: 'raw/x.docx' } }),
      null,
      `${type} 应 null`,
    )
  }
})

// ── classifyMilestone:各里程碑命中 ────────────────────────────────────

test('classifyMilestone: read/pandoc raw -> 15(pandoc 用 filePath 字段)', () => {
  assert.equal(
    classifyMilestone({
      type: 'tool_execution_start',
      toolName: 'read',
      args: { file_path: 'raw/x.docx' },
    }),
    15,
  )
  assert.equal(
    classifyMilestone({
      type: 'tool_execution_start',
      toolName: 'pandoc',
      args: { filePath: 'raw/x.docx' },
    }),
    15,
  )
})

test('classifyMilestone: write/edit wiki -> 50', () => {
  assert.equal(
    classifyMilestone({
      type: 'tool_execution_start',
      toolName: 'write',
      args: { file_path: 'wiki/01-note.md' },
    }),
    50,
  )
  assert.equal(
    classifyMilestone({
      type: 'tool_execution_start',
      toolName: 'edit',
      args: { file_path: 'wiki/01-note.md' },
    }),
    50,
  )
})

test('classifyMilestone: write/edit index.md -> 70', () => {
  assert.equal(
    classifyMilestone({
      type: 'tool_execution_start',
      toolName: 'edit',
      args: { file_path: 'index.md' },
    }),
    70,
  )
})

test('classifyMilestone: write/edit output -> 82', () => {
  assert.equal(
    classifyMilestone({
      type: 'tool_execution_start',
      toolName: 'write',
      args: { file_path: 'output/report.md' },
    }),
    82,
  )
  assert.equal(
    classifyMilestone({
      type: 'tool_execution_start',
      toolName: 'edit',
      args: { file_path: 'output/report.md' },
    }),
    82,
  )
})

test('classifyMilestone: write/edit log.md -> 92', () => {
  assert.equal(
    classifyMilestone({
      type: 'tool_execution_start',
      toolName: 'edit',
      args: { file_path: 'log.md' },
    }),
    92,
  )
})

// ── classifyMilestone:边界 ────────────────────────────────────────────

test('classifyMilestone: read 非 raw(wiki/index)-> null(只 raw 算读取源里程碑)', () => {
  assert.equal(
    classifyMilestone({
      type: 'tool_execution_start',
      toolName: 'read',
      args: { file_path: 'wiki/01.md' },
    }),
    null,
  )
  assert.equal(
    classifyMilestone({
      type: 'tool_execution_start',
      toolName: 'read',
      args: { file_path: 'index.md' },
    }),
    null,
  )
})

test('classifyMilestone: 大写路径小写化匹配', () => {
  assert.equal(
    classifyMilestone({
      type: 'tool_execution_start',
      toolName: 'read',
      args: { file_path: 'RAW/X.DOCX' },
    }),
    15,
  )
})

test('classifyMilestone: 无 toolName / 无 args / 无路径 -> null', () => {
  assert.equal(
    classifyMilestone({ type: 'tool_execution_start', args: { file_path: 'raw/x' } }),
    null,
  )
  assert.equal(classifyMilestone({ type: 'tool_execution_start', toolName: 'read' }), null)
  assert.equal(
    classifyMilestone({ type: 'tool_execution_start', toolName: 'read', args: {} }),
    null,
  )
})

// ── nextAnchor ────────────────────────────────────────────────────────

test('nextAnchor: 锚点序列下一,末尾或超出 -> 100(由 ingest_done 承担)', () => {
  assert.equal(nextAnchor(0), 15)
  assert.equal(nextAnchor(15), 50)
  assert.equal(nextAnchor(50), 70)
  assert.equal(nextAnchor(70), 82)
  assert.equal(nextAnchor(82), 92)
  assert.equal(nextAnchor(92), 100)
  assert.equal(nextAnchor(95), 100)
})

test('INGEST_PROGRESS_ANCHORS: 5 锚点单调递增,不含 100', () => {
  assert.deepEqual([...INGEST_PROGRESS_ANCHORS], [15, 50, 70, 82, 92])
})

// kbLayout.ts - layer1(知识层)的目录契约集中点。
// 定义 kb/ 根、四条 sub-seam 路径(Source=raw / Compiled=wiki / Metadata=index+log / Reports=output)
// 及可强制规则(raw/ 只读)。buildView/kbHooks/interaction/agentHost 引用此处,不再硬编码字符串。
// 详见 ADR-0002、CONTEXT.md。
//
// 路径函数接收 kbRoot(当前 Vault 的 kb/ 根,随切库切换,ADR-0003 D7),直接拼 sub-seam,
// 不再假设 kb/ 目录固定叫 "kb"(单库遗留--多 Vault 下 kb/ 名是任意 slug 如 test-kb)。
// kbRoot() 派生函数仅用于启动定位默认库。
import path from 'node:path'

/**
 * 默认 kb/ 根路径(`<projectRoot>/kb`)。仅用于启动时定位默认库(ADR-0002 决策 0);
 * sub-seam 路径函数直接接收 kbRoot,不经此。多 Vault 下当前库由 config.currentVault 决定。
 */
export function kbRoot(projectRoot: string): string {
  return path.join(projectRoot, 'kb')
}

// ── sub-seam 路径(相对 kbRoot 的绝对路径)─────────────────────────
/** sub-seam 目录名(相对 kb/),供 git pathspec 等需相对名的场景用。 */
export const SUBSEAM_DIRS = ['raw', 'wiki', 'output'] as const
export const SUBSEAM_FILES = ['index.md', 'log.md'] as const

export function rawDir(kbRoot: string): string {
  return path.join(kbRoot, 'raw')
}
export function wikiDir(kbRoot: string): string {
  return path.join(kbRoot, 'wiki')
}
export function outputDir(kbRoot: string): string {
  return path.join(kbRoot, 'output')
}
export function indexFile(kbRoot: string): string {
  return path.join(kbRoot, 'index.md')
}
export function logFile(kbRoot: string): string {
  return path.join(kbRoot, 'log.md')
}

/**
 * 判断绝对路径是否落在 Source(raw/) 下。raw/ 全层只读(ADR-0002 决策 2)。
 * 用 relative + 非 .. 前缀判断,避免 raw.txt / wiki/raw-x.md 这类伪匹配。
 */
export function isRawPath(absPath: string, kbRoot: string): boolean {
  const rel = path.relative(rawDir(kbRoot), absPath)
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
}

/**
 * 判断绝对路径是否在 kb/ 内(含 raw/,读工具边界,ADR-0016)。
 * 读工具(read/grep/find/ls/pandoc)允许读 raw/(ingest 刚需),只判 kb/ 内外,不排除 raw/。
 * 与 isWritablePath 对称,只差不排除 raw/(写边界排除 raw/)。
 */
export function isWithinKb(absPath: string, kbRoot: string): boolean {
  const rel = path.relative(kbRoot, absPath)
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
}

/**
 * 判断绝对路径是否在 layer1 可写区(wiki/output/index.md/log.md)。
 * raw/ 下只读,返回 false;kb/ 外(如 server/web)非 layer1,返回 false。
 */
export function isWritablePath(absPath: string, kbRoot: string): boolean {
  if (isRawPath(absPath, kbRoot)) return false
  const rel = path.relative(kbRoot, absPath)
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel)
}

// uploadExts.ts - /api/upload 后缀接受集(ADR-0007 决策 1 + ADR-0018 三分模型)。
// 前后端共用此单一常量,避免漂移:server 是后端校验真相源,前端 accept 消费。
//
// layer1 Source 读法三分(ADR-0018):
// - md(.md)-- 原样 read
// - 纯文本(.txt/.text/.log,PLAINTEXT_EXTS)-- 原样 read
// - pandoc 格式(docx/xlsx/...,ALLOWED_UPLOAD_EXTS 非 md 项)-- pandoc 工具转文本
// pdf 不在(ADR-0007 决策 5)。

/** pandoc 原生支持的输入后缀(ADR-0007 决策 1),含 .md(md 走 read 不走 pandoc,但上传接受)。
 *  shouldBlockRead/buildIngestPrompt 据此识别"pandoc 可转格式"(非 md 项走 pandoc)。 */
export const ALLOWED_UPLOAD_EXTS: readonly string[] = [
  '.md',
  '.docx',
  '.xlsx',
  '.pptx',
  '.odt',
  '.epub',
  '.html',
  '.rtf',
  '.csv',
  '.tsv',
  '.json',
  '.xml',
  '.org',
  '.rst',
  '.latex',
  '.tex',
  '.asciidoc',
  '.adoc',
]

/** 纯文本后缀(ADR-0018):read 直读,不走 pandoc。纯文本走 pandoc 仅透传无增益,
 *  且若加进 ALLOWED_UPLOAD_EXTS 会触发 shouldBlockRead 反直觉拦截(非 md 白名单后缀逼 pandoc)。 */
export const PLAINTEXT_EXTS: readonly string[] = ['.txt', '.text', '.log']

/** /api/upload 接受的后缀(pandoc 格式 ∪ 纯文本)。前端 accept 与 checkUploadExt 共用。 */
export const ACCEPTED_UPLOAD_EXTS: readonly string[] = [...ALLOWED_UPLOAD_EXTS, ...PLAINTEXT_EXTS]

/**
 * 校验上传后缀:放行返回 null,拒绝返回 { error }(调用方回 415)。
 * pdf 单独消息(ADR-0007 决策 5);其余非接受集回通用"不支持"消息。纯函数,便于单测。
 */
export function checkUploadExt(ext: string): { error: string } | null {
  if (ext === '.pdf') return { error: 'pdf 暂不支持' }
  if (!ACCEPTED_UPLOAD_EXTS.includes(ext)) {
    return { error: `不支持 ${ext} 文件,支持:${ACCEPTED_UPLOAD_EXTS.join(', ')}` }
  }
  return null
}

// uploadExts.ts - /api/upload 后缀白名单(ADR-0007 决策 1)。
// 前后端共用此单一常量,避免漂移:server 是后端校验真相源,前端 accept 消费。
// 含 pandoc 原生支持的输入格式(含同格式常见后缀变体,如 .tex 对应 latex);pdf 不在(决策 5)。

/** /api/upload 接受的后缀白名单。pdf 不在,遇 .pdf 由 checkUploadExt 单独回 415 "pdf 暂不支持"。 */
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

/**
 * 校验上传后缀:放行返回 null,拒绝返回 { error }(调用方回 415)。
 * pdf 单独消息(ADR-0007 决策 5);其余非白名单回通用"不支持"消息。纯函数,便于单测。
 */
export function checkUploadExt(ext: string): { error: string } | null {
  if (ext === '.pdf') return { error: 'pdf 暂不支持' }
  if (!ALLOWED_UPLOAD_EXTS.includes(ext)) {
    return { error: `不支持 ${ext} 文件,支持:${ALLOWED_UPLOAD_EXTS.join(', ')}` }
  }
  return null
}

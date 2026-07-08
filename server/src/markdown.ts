// markdown.ts - md -> html 纯函数渲染器(行内 + 块级,1:1 平移自原 Python 版)。
// 从 buildView.ts 抽离以便前后端共用:server 编译 wiki 文章片段,web 渲染 chat 回复。
// 零依赖(纯字符串操作),浏览器端可安全 import。文本经 escapeHtml 转义,XSS 安全。

/** 分离 frontmatter:首行 `---` 起到下一个 `---` 为 fm,其余为 body。无 frontmatter 返回原文。 */
export function splitFrontmatter(text: string): { body: string; fm: string } {
  const lines = text.split('\n')
  if (lines[0]?.trim() !== '---') return { body: text, fm: '' }
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      return { body: lines.slice(i + 1).join('\n'), fm: lines.slice(1, i).join('\n') }
    }
  }
  return { body: text, fm: '' }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function parseInline(text: string): string {
  let t = escapeHtml(text)
  // 图片 ![alt](url)
  t = t.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
  // wikilink [[a|b]] / [[a]]
  const wikilink = (p: string, label: string): string => {
    if (p.startsWith('raw/') || p.startsWith('./raw/')) return label
    return `<a href="./${p}.html" class="wl">${label}</a>`
  }
  t = t.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (_m, p, lbl) => wikilink(p, lbl))
  t = t.replace(/\[\[([^\]]+)\]\]/g, (_m, p) => wikilink(p, p))
  // 链接 [text](url)
  t = t.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
  // 加粗 / 斜体 / 行内代码 / 删除线
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  t = t.replace(/__(.+?)__/g, '<strong>$1</strong>')
  t = t.replace(/\*(.+?)\*/g, '<em>$1</em>')
  t = t.replace(/_(.+?)_/g, '<em>$1</em>')
  t = t.replace(/`([^`]+)`/g, '<code>$1</code>')
  t = t.replace(/~~(.+?)~~/g, '<del>$1</del>')
  return t
}

function isHr(line: string): boolean {
  return /^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())
}

interface Lines {
  arr: string[]
  i: number
}

function parseFencedCode(ln: Lines): string {
  const fence = ln.arr[ln.i].trim()
  const lang = fence.slice(3).trim()
  const langAttr = lang ? ` class="language-${escapeHtml(lang)}"` : ''
  const dataLang = lang ? ` data-lang="${escapeHtml(lang)}"` : ''
  const out = [`<pre${dataLang}><code${langAttr}>`]
  ln.i++
  while (ln.i < ln.arr.length && !ln.arr[ln.i].trim().startsWith('```')) {
    out.push(escapeHtml(ln.arr[ln.i]))
    ln.i++
  }
  ln.i++ // 跳过结束 ```
  out.push('</code></pre>')
  return out.join('\n')
}

function parseTable(ln: Lines): string {
  const rows: string[] = []
  while (ln.i < ln.arr.length && ln.arr[ln.i].trim().startsWith('|')) {
    rows.push(ln.arr[ln.i].trim())
    ln.i++
  }
  if (rows.length < 2) return ''
  const headers = rows[0]
    .split('|')
    .slice(1, -1)
    .map((c) => c.trim())
  const parts = ['<table>', '<thead><tr>']
  for (const h of headers) parts.push(`<th>${parseInline(h)}</th>`)
  parts.push('</tr></thead><tbody>')
  for (const row of rows.slice(2)) {
    const cells = row
      .split('|')
      .slice(1, -1)
      .map((c) => c.trim())
    parts.push('<tr>')
    for (const c of cells) parts.push(`<td>${parseInline(c)}</td>`)
    parts.push('</tr>')
  }
  parts.push('</tbody></table>')
  return parts.join('\n')
}

function parseBlockquote(ln: Lines): string {
  const content: string[] = []
  while (ln.i < ln.arr.length && ln.arr[ln.i].startsWith('>')) {
    content.push(ln.arr[ln.i].slice(1).trim())
    ln.i++
  }
  const html = parseInline(content.join(' '))
  const callouts: Record<string, RegExp> = {
    note: /^\s*<strong>(?:note|注意|说明)<\/strong>/i,
    warning: /^\s*<strong>(?:warning|warn|警告|当心)<\/strong>/i,
    tip: /^\s*<strong>(?:tip|提示|技巧)<\/strong>/i,
    info: /^\s*<strong>(?:info|信息|相关信息)<\/strong>/i,
    key: /^\s*<strong>(?:关键|重点|核心)<\/strong>/i,
  }
  for (const [cls, pat] of Object.entries(callouts)) {
    if (pat.test(html)) return `<blockquote class="callout callout-${cls}">${html}</blockquote>`
  }
  return `<blockquote>${html}</blockquote>`
}

function parseList(ln: Lines, ordered: boolean): string {
  const tag = ordered ? 'ol' : 'ul'
  const items: string[] = []
  while (ln.i < ln.arr.length) {
    const raw = ln.arr[ln.i]
    const s = raw.replace(/^\s+/, '')
    if (ordered && /^\d+\.\s/.test(s)) {
      items.push(s.replace(/^\d+\.\s/, ''))
      ln.i++
    } else if (!ordered && /^[-*+]\s/.test(s)) {
      items.push(s.replace(/^[-*+]\s/, ''))
      ln.i++
    } else if (s === '') {
      ln.i++
    } else {
      break
    }
  }
  const out = [`<${tag}>`]
  for (const it of items) out.push(`<li>${parseInline(it)}</li>`)
  out.push(`</${tag}>`)
  return out.join('\n')
}

export function mdToHtml(mdText: string): string {
  const { body } = splitFrontmatter(mdText)
  const arr = body.split('\n')
  const ln: Lines = { arr, i: 0 }
  const out: string[] = []

  while (ln.i < arr.length) {
    const s = arr[ln.i].trim()
    if (s === '') {
      ln.i++
      continue
    }
    if (s.startsWith('```')) {
      out.push(parseFencedCode(ln))
      continue
    }
    if (isHr(arr[ln.i])) {
      out.push('<hr />')
      ln.i++
      continue
    }
    if (s.startsWith('>')) {
      out.push(parseBlockquote(ln))
      continue
    }
    if (s.startsWith('|')) {
      const start = ln.i
      const tbl = parseTable(ln)
      if (tbl) {
        out.push(tbl)
        continue
      }
      ln.i = start // 不是表,回退
    }
    const hm = /^(#{1,6})\s+(.+)$/.exec(s)
    if (hm) {
      const level = hm[1].length
      out.push(`<h${level}>${parseInline(hm[2])}</h${level}>`)
      ln.i++
      continue
    }
    if (/^[-*+]\s/.test(s)) {
      out.push(parseList(ln, false))
      continue
    }
    if (/^\d+\.\s/.test(s)) {
      out.push(parseList(ln, true))
      continue
    }
    // 段落
    const para: string[] = []
    while (ln.i < arr.length) {
      const cl = arr[ln.i]
      const cs = cl.trim()
      if (cs === '') {
        ln.i++
        break
      }
      if (
        cs.startsWith('```') ||
        cs.startsWith('|') ||
        cs.startsWith('>') ||
        cs.startsWith('#') ||
        /^[-*+]\s/.test(cs) ||
        /^\d+\.\s/.test(cs) ||
        isHr(cl)
      )
        break
      para.push(cs)
      ln.i++
    }
    if (para.length) out.push(`<p>${parseInline(para.join(' '))}</p>`)
  }
  return out.join('\n')
}

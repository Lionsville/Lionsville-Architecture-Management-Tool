// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The little Markdown the help's background is written in, read into blocks:
 * paragraphs, lists, tables and fenced code, with bold, italic, code and links
 * inside them. Not the documentation's renderer, which draws diagrams and
 * pictures and is not wanted in a page that must open at once; and never HTML,
 * so nothing in the text can become markup.
 */
export type Inline =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'strong' | 'em'; readonly children: readonly Inline[] }
  | { readonly kind: 'code'; readonly text: string }
  | { readonly kind: 'link'; readonly href: string; readonly children: readonly Inline[] }

export type Block =
  | { readonly kind: 'p'; readonly inline: readonly Inline[] }
  | { readonly kind: 'ul' | 'ol'; readonly items: readonly (readonly Inline[])[] }
  | { readonly kind: 'table'; readonly head: readonly (readonly Inline[])[]; readonly rows: readonly (readonly (readonly Inline[])[])[] }
  | { readonly kind: 'code'; readonly text: string }

export function readMarkdown(source: string): readonly Block[] {
  const blocks: Block[] = []
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  let at = 0
  while (at < lines.length) {
    const line = lines[at]
    if (line.trim() === '') { at += 1; continue }
    const fence = /^(`{3,})/.exec(line.trim())
    if (fence) {
      const body: string[] = []
      at += 1
      while (at < lines.length && !lines[at].trim().startsWith(fence[1])) body.push(lines[at++])
      at += 1
      blocks.push({ kind: 'code', text: body.join('\n') })
      continue
    }
    if (/^\s*\|/.test(line)) {
      const rows: string[] = []
      while (at < lines.length && /^\s*\|/.test(lines[at])) rows.push(lines[at++])
      const cells = rows.filter((row) => !/^\s*\|[\s|:-]+\|\s*$/.test(row)).map(cellsOf)
      blocks.push({ kind: 'table', head: cells[0] ?? [], rows: cells.slice(1) })
      continue
    }
    const listItem = /^\s*([-*]|\d+\.)\s+/
    if (listItem.test(line)) {
      const ordered = /^\s*\d+\./.test(line)
      const items: string[] = []
      while (at < lines.length && lines[at].trim() !== '') {
        if (listItem.test(lines[at])) items.push(lines[at].replace(listItem, ''))
        else items[items.length - 1] += ` ${lines[at].trim()}`
        at += 1
      }
      blocks.push({ kind: ordered ? 'ol' : 'ul', items: items.map(readInline) })
      continue
    }
    const para: string[] = []
    while (at < lines.length && lines[at].trim() !== '' && !listItem.test(lines[at]) && !/^\s*\|/.test(lines[at])) para.push(lines[at++].trim())
    blocks.push({ kind: 'p', inline: readInline(para.join(' ').replace(/^#+\s*/, '')) })
  }
  return blocks
}

function cellsOf(row: string): readonly (readonly Inline[])[] {
  return row.trim().replace(/^\||\|$/g, '').split('|').map((cell) => readInline(cell.trim()))
}

/** Bold, italic, code and links; anything else is text as written. */
export function readInline(text: string): readonly Inline[] {
  const out: Inline[] = []
  let plain = ''
  const flush = () => { if (plain) { out.push({ kind: 'text', text: plain }); plain = '' } }
  let at = 0
  while (at < text.length) {
    const rest = text.slice(at)
    const code = /^`([^`]+)`/.exec(rest)
    if (code) { flush(); out.push({ kind: 'code', text: code[1] }); at += code[0].length; continue }
    const strong = /^\*\*(.+?)\*\*/.exec(rest)
    if (strong) { flush(); out.push({ kind: 'strong', children: readInline(strong[1]) }); at += strong[0].length; continue }
    const em = /^\*([^*\s][^*]*?)\*/.exec(rest)
    if (em) { flush(); out.push({ kind: 'em', children: readInline(em[1]) }); at += em[0].length; continue }
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)/.exec(rest)
    if (link) {
      flush()
      if (/^https:\/\//.test(link[2])) out.push({ kind: 'link', href: link[2], children: readInline(link[1]) })
      else out.push(...readInline(link[1]))
      at += link[0].length
      continue
    }
    const auto = /^<(https?:\/\/[^>\s]+)>/.exec(rest)
    if (auto) { flush(); out.push({ kind: 'link', href: auto[1], children: [{ kind: 'text', text: auto[1] }] }); at += auto[0].length; continue }
    plain += text[at]
    at += 1
  }
  flush()
  return out
}

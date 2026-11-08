// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a writer's keys and buttons do to markdown, as text in and text out.
 *
 * The file stays what the writer would have typed: nothing here converts,
 * and nothing is stored but the characters. Every answer is the whole next
 * text and where the selection goes, so the editor has one way to apply it and
 * a test needs no textarea.
 *
 * Pure.
 */
import { stripInline } from './documentation'

/** The text and the selection after a change. */
export type Edit = { text: string; start: number; end: number }

/** The text and the selection as they stand. */
export type Selected = { text: string; start: number; end: number }

const lineStart = (text: string, at: number) => text.lastIndexOf('\n', at - 1) + 1
const lineEnd = (text: string, at: number) => {
  const end = text.indexOf('\n', at)
  return end < 0 ? text.length : end
}

function selectedLines({ text, start, end }: Selected): { from: number; to: number } {
  // A selection ending at a line's very start does not take that line along.
  const last = end > start && text[end - 1] === '\n' ? end - 1 : end
  return { from: lineStart(text, start), to: lineEnd(text, last) }
}

/** Whether a position lies inside a code fence: what is typed there is its content, and no mark means anything. */
export function inFence(text: string, at: number): boolean {
  let open = false
  for (const line of text.slice(0, lineStart(text, at)).split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) open = !open
  }
  return open
}

// --- marks on a selection ------------------------------------------------------

/** Wrap the selection in a mark, or take the mark off where it is already wrapped. With nothing selected, the caret lands between the two. */
export function toggleInline({ text, start, end }: Selected, mark: string): Edit {
  const size = mark.length
  const inside = text.slice(start, end)
  if (inside.length >= size * 2 && inside.startsWith(mark) && inside.endsWith(mark)) {
    const bare = inside.slice(size, -size)
    return { text: text.slice(0, start) + bare + text.slice(end), start, end: start + bare.length }
  }
  if (text.slice(start - size, start) === mark && text.slice(end, end + size) === mark) {
    return { text: text.slice(0, start - size) + inside + text.slice(end + size), start: start - size, end: end - size }
  }
  // The second press of a pair typed with nothing selected ends it: the caret steps past the closing mark (GitHub, Typora).
  if (start === end && text.slice(start, start + size) === mark && opensBefore(text, start, mark)) {
    return { text, start: start + size, end: start + size }
  }
  return { text: text.slice(0, start) + mark + inside + mark + text.slice(end), start: start + size, end: end + size }
}

/** Whether a mark of this kind stands open before the caret on its line: an odd number of them lie between the line's start and the caret. */
function opensBefore(text: string, at: number, mark: string): boolean {
  return text.slice(lineStart(text, at), at).split(mark).length % 2 === 0
}

const LINK_PLACEHOLDER = 'https://'

/** A link around the selection with its address selected to type over; with nothing selected, the words are what is selected. */
export function insertLink({ text, start, end }: Selected, words: string): Edit {
  const inside = text.slice(start, end)
  const shown = inside || words
  const made = `[${shown}](${LINK_PLACEHOLDER})`
  const next = text.slice(0, start) + made + text.slice(end)
  return inside
    ? { text: next, start: start + shown.length + 3, end: start + shown.length + 3 + LINK_PLACEHOLDER.length }
    : { text: next, start: start + 1, end: start + 1 + shown.length }
}

const LONE_ADDRESS = /^(?:https?:\/\/|mailto:)\S+$/i

/**
 * An address pasted over selected words links them. Anything else pasted,
 * words already inside a link's brackets, or several lines selected, is left
 * to be an ordinary paste.
 */
export function linkOnPaste({ text, start, end }: Selected, pasted: string): Edit | undefined {
  const address = pasted.trim()
  const inside = text.slice(start, end)
  if (start === end || !LONE_ADDRESS.test(address) || inside.includes('\n')) return undefined
  if (LONE_ADDRESS.test(inside.trim()) || (text[start - 1] === '[' && text.slice(end, end + 2) === '](')) return undefined
  const made = `[${inside}](${address})`
  const after = start + made.length
  return { text: text.slice(0, start) + made + text.slice(end), start: after, end: after }
}

// --- marks on whole lines ------------------------------------------------------

export type LineMark = 'bullet' | 'number' | 'task' | 'quote'

const MARK_OF: Record<LineMark, RegExp> = {
  bullet: /^(\s*)[-*+] (?!\[[ xX]\] )/,
  number: /^(\s*)\d+[.)] /,
  task: /^(\s*)[-*+] \[[ xX]\] /,
  quote: /^(\s*)> ?/,
}
const ANY_MARK = /^(\s*)(?:[-*+] \[[ xX]\] |[-*+] |\d+[.)] |> ?)/

/** A list or quote mark on each selected line, in place of whatever mark it had, or off where every line has this one. */
export function toggleLineMark(state: Selected, mark: LineMark): Edit {
  const { text } = state
  const { from, to } = selectedLines(state)
  const lines = text.slice(from, to).split('\n')
  const filled = lines.filter((line) => line.trim() !== '')
  const taking = filled.length > 0 && filled.every((line) => MARK_OF[mark].test(line))
  let counted = 0
  const marked = lines.map((line) => {
    if (taking) return line.replace(MARK_OF[mark], '$1')
    if (lines.length > 1 && line.trim() === '') return line
    counted += 1
    const bare = line.replace(ANY_MARK, '$1')
    const indent = /^\s*/.exec(bare)![0]
    const word = { bullet: '- ', number: `${counted}. `, task: '- [ ] ', quote: '> ' }[mark]
    return indent + word + bare.slice(indent.length)
  }).join('\n')
  const next = text.slice(0, from) + marked + text.slice(to)
  if (lines.length === 1) {
    const moved = marked.length - lines[0]!.length
    const caret = Math.max(from, state.start + moved)
    return { text: next, start: caret, end: Math.max(caret, state.end + moved) }
  }
  return { text: next, start: from, end: from + marked.length }
}

/** The line's heading level moved on: none, `##`, `###`, and back to none. */
export function cycleHeading(state: Selected): Edit {
  const { text, start, end } = state
  const from = lineStart(text, start)
  const to = lineEnd(text, start)
  const line = text.slice(from, to)
  const level = /^(#{1,6}) /.exec(line)?.[1]?.length ?? 0
  const bare = line.replace(/^#{1,6} /, '')
  const nextLevel = level === 0 ? 2 : level === 2 ? 3 : level === 1 ? 2 : 0
  const made = nextLevel ? `${'#'.repeat(nextLevel)} ${bare}` : bare
  const moved = made.length - line.length
  return { text: text.slice(0, from) + made + text.slice(to), start: Math.max(from, start + moved), end: Math.max(from, end + moved) }
}

// --- blocks --------------------------------------------------------------------

const AT = '\u0001'
const TO = '\u0002'

/**
 * Text put in on lines of its own. A mark in the snippet says what ends up
 * selected, so a table arrives with its first heading ready to type over.
 */
export function insertBlock({ text, start, end }: Selected, snippet: string): Edit {
  const head = text.slice(0, start)
  const tail = text.slice(end)
  const lead = head === '' || head.endsWith('\n\n') ? '' : head.endsWith('\n') ? '\n' : '\n\n'
  const trail = tail.startsWith('\n\n') ? '' : tail.startsWith('\n') ? '\n' : tail === '' ? '\n' : '\n\n'
  const from = snippet.indexOf(AT)
  const to = snippet.indexOf(TO)
  const bare = snippet.replace(AT, '').replace(TO, '')
  const made = head + lead + bare + trail + tail
  const base = head.length + lead.length
  if (from < 0) { const after = base + bare.length + trail.length; return { text: made, start: after, end: after } }
  return { text: made, start: base + from, end: base + (to < 0 ? from : to - 1) }
}

/** Text put in where the selection is, with the caret by the same marks as {@link insertBlock}. */
export function insertInline({ text, start, end }: Selected, snippet: string): Edit {
  const from = snippet.indexOf(AT)
  const to = snippet.indexOf(TO)
  const bare = snippet.replace(AT, '').replace(TO, '')
  const made = text.slice(0, start) + bare + text.slice(end)
  if (from < 0) { const after = start + bare.length; return { text: made, start: after, end: after } }
  return { text: made, start: start + from, end: start + (to < 0 ? from : to - 1) }
}

export type BlockSnippet = { key: string; snippet: string; block: boolean }

/**
 * The blocks `/` and the toolbar offer, in the order a writer reaches for them.
 * Each is only what would have been typed: the renderer draws it because of
 * the marks in the text.
 */
export const BLOCK_SNIPPETS: readonly BlockSnippet[] = [
  { key: 'heading2', snippet: '## ', block: false },
  { key: 'heading3', snippet: '### ', block: false },
  { key: 'bullet', snippet: '- ', block: false },
  { key: 'number', snippet: '1. ', block: false },
  { key: 'task', snippet: '- [ ] ', block: false },
  { key: 'quote', snippet: '> ', block: false },
  { key: 'table', snippet: `| ${AT}Heading${TO} | Heading |\n|---|---|\n|  |  |`, block: true },
  { key: 'code', snippet: `\`\`\`\n${AT}${TO}\n\`\`\``, block: true },
  { key: 'mermaid', snippet: `\`\`\`mermaid\n${AT}flowchart LR\n  A --> B${TO}\n\`\`\``, block: true },
  { key: 'bpmn', snippet: `\`\`\`bpmn\n${AT}${TO}\n\`\`\``, block: true },
  { key: 'rule', snippet: '---', block: true },
]

/** The snippet of the toolbar's table button. */
export const TABLE_SNIPPET = BLOCK_SNIPPETS.find((one) => one.key === 'table')!.snippet

/** `/` at the start of a line, or after a line's own mark, and the word after it. Elsewhere a slash is a slash. */
export function slashAt(text: string, caret: number): { start: number; query: string } | undefined {
  const line = text.slice(lineStart(text, caret), caret)
  const found = /^(\s*(?:[-*+] |\d+[.)] |> )?)\/([^\s/]{0,30})$/.exec(line)
  if (!found || inFence(text, caret)) return undefined
  return { start: caret - found[2]!.length - 1, query: found[2]! }
}

/** A template's `##` sections, each with what stands under its heading: a section can be put in on its own. */
export function templateSections(template: string): { title: string; body: string }[] {
  const parts = template.split(/^(?=## )/m).filter((part) => part.startsWith('## '))
  return parts.map((part) => ({ title: part.slice(3, part.indexOf('\n') < 0 ? undefined : part.indexOf('\n')).trim(), body: part.trimEnd() }))
}

/** The sections of a template a text does not have yet, matched by heading. */
export function missingSections(template: string, text: string): { title: string; body: string }[] {
  const have = new Set(headingsAt(text).map((heading) => heading.text.toLowerCase()))
  return templateSections(template).filter((section) => !have.has(stripInline(section.title).toLowerCase()))
}

// --- the keys ------------------------------------------------------------------

const LIST_LINE = /^(\s*)((?:[-*+] \[[ xX]\] )|(?:[-*+] )|(?:\d+[.)] )|(?:> ?))(.*)$/

function nextMark(mark: string): string {
  const number = /^(\d+)([.)]) $/.exec(mark)
  if (number) return `${Number(number[1]) + 1}${number[2]} `
  return mark.replace(/\[[xX]\]/, '[ ]')
}

const isTableLine = (line: string) => /^\s*\|.*\|\s*$/.test(line)
const tableCells = (line: string) => line.trim().slice(1, -1).split(/(?<!\\)\|/)

/**
 * Enter: a list, a quote and a table go on. The next line takes the mark, a
 * number counts up, and a task starts unticked. Enter on an item with nothing
 * in it ends the list rather than making another empty one. `undefined`: an
 * ordinary new line, with the line's indent kept inside a fence.
 */
export function continueOnEnter(state: Selected): Edit | undefined {
  const { text, start, end } = state
  if (start !== end) return undefined
  const from = lineStart(text, start)
  const to = lineEnd(text, start)
  const line = text.slice(from, to)
  if (inFence(text, start)) return undefined
  const insert = (made: string): Edit => {
    const caret = start + made.length
    return { text: text.slice(0, start) + made + text.slice(start), start: caret, end: caret }
  }
  // A blank line stands between: text straight under a list or a table would still be part of it.
  const ended = (): Edit => {
    const gap = from > 0 ? '\n' : ''
    return { text: text.slice(0, from) + gap + text.slice(to), start: from + gap.length, end: from + gap.length }
  }
  if (isTableLine(line)) {
    const cells = tableCells(line)
    if (cells.every((cell) => cell.trim() === '')) return ended()
    if (start !== to) return undefined
    const row = `| ${cells.map(() => '').join(' | ')} |`
    return { text: `${text.slice(0, start)}\n${row}${text.slice(start)}`, start: start + 3, end: start + 3 }
  }
  const list = LIST_LINE.exec(line)
  if (!list) return undefined
  const [, indent, mark, rest] = list as unknown as [string, string, string, string]
  if (rest.trim() === '') return start === to ? ended() : undefined
  if (start - from < indent.length + mark.length) return undefined
  return insert(`\n${indent}${nextMark(mark)}`)
}

const INDENT = '  '

/**
 * Tab, where it means something: an item goes in or out a level, a table's
 * caret goes to the next cell, and in a fence it is two spaces. `undefined`
 * anywhere else, so that Tab leaves the field as it does everywhere and the
 * keyboard is never kept in here.
 */
export function tabIn(state: Selected, back: boolean): Edit | undefined {
  const { text, start } = state
  const { from, to } = selectedLines(state)
  const fence = inFence(text, start)
  const line = text.slice(from, lineEnd(text, start))
  if (!fence && isTableLine(text.slice(lineStart(text, start), lineEnd(text, start)))) {
    return tableTab(state, back)
  }
  if (!fence && !LIST_LINE.test(line)) return undefined
  if (back && !text.slice(from, to).split('\n').some((one) => one.startsWith(INDENT) || one.startsWith('\t'))) return fence ? { ...state } : undefined
  const lines = text.slice(from, to).split('\n')
  const made = lines.map((one) => {
    if (!back) return one.trim() === '' ? one : INDENT + one
    return one.startsWith(INDENT) ? one.slice(INDENT.length) : one.replace(/^\t/, '')
  })
  const body = made.join('\n')
  const moved = made[0]!.length - lines[0]!.length
  if (lines.length === 1) {
    const caret = Math.max(from, state.start + moved)
    return { text: text.slice(0, from) + body + text.slice(to), start: caret, end: Math.max(caret, state.end + moved) }
  }
  return { text: text.slice(0, from) + body + text.slice(to), start: from, end: from + body.length }
}

/** Where a table line's cells are bounded: its unescaped bars. */
function barsOf(text: string, from: number, to: number): number[] {
  const marks: number[] = []
  for (let at = from; at < to; at += 1) {
    if (text[at] === '|' && text[at - 1] !== '\\') marks.push(at)
  }
  return marks
}

const isDelimiterLine = (line: string) => /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/.test(line)

/** A cell's words selected, the caret placed in an empty one. */
function intoCell(text: string, open: number, close: number): Edit {
  const bare = text.slice(open, close)
  const lead = bare.length - bare.trimStart().length
  const words = bare.trim().length
  const caret = words === 0 ? Math.min(open + 1, close) : open + lead
  return { text, start: caret, end: caret + words }
}

/** The table line next to this one, the delimiter row passed over; undefined where the table ends. */
function rowBeside(text: string, from: number, to: number, back: boolean): { from: number; to: number } | undefined {
  let at = back ? from : to
  for (;;) {
    if (back ? at === 0 : at >= text.length) return undefined
    const lineFrom = back ? lineStart(text, at - 1) : at + 1
    const lineTo = lineEnd(text, lineFrom)
    const line = text.slice(lineFrom, lineTo)
    if (!isTableLine(line)) return undefined
    if (!isDelimiterLine(line)) return { from: lineFrom, to: lineTo }
    at = back ? lineFrom : lineTo
  }
}

/**
 * Tab in a table: the next cell, then the next row's first, and past the last row a
 * new one, as GitHub's and Confluence's tables do. A cell arrives with its words
 * selected, so a selection that is exactly a cell's words is a caret in that cell.
 * The way out is a row left empty: Tab from its last cell leaves the field, and so
 * does Shift+Tab from the table's first cell.
 */
function tableTab({ text, start, end }: Selected, back: boolean): Edit | undefined {
  const from = lineStart(text, start)
  const to = lineEnd(text, start)
  const marks = barsOf(text, from, to)
  const cell = marks.filter((at) => at < start).length - 1
  if (cell < 0 || cell >= marks.length - 1) return undefined
  if (end !== start && (end > marks[cell + 1]! || text.slice(start, end) !== text.slice(marks[cell]! + 1, marks[cell + 1]).trim())) return undefined
  const target = cell + (back ? -1 : 1)
  if (target >= 0 && target < marks.length - 1) return intoCell(text, marks[target]! + 1, marks[target + 1]!)
  const row = rowBeside(text, from, to, back)
  if (row) {
    const bars = barsOf(text, row.from, row.to)
    if (bars.length < 2) return undefined
    const at = back ? bars.length - 2 : 0
    return intoCell(text, bars[at]! + 1, bars[at + 1]!)
  }
  if (back || text.slice(from, to).replace(/[|\s]/g, '') === '') return undefined
  const made = `\n|${'  |'.repeat(marks.length - 1)}`
  const next = text.slice(0, to) + made + text.slice(to)
  return { text: next, start: to + 3, end: to + 3 }
}

// --- reading the text ----------------------------------------------------------

/** How many words the text reads as: marks and what a fence holds do not count. */
export function wordCount(text: string): number {
  const out: string[] = []
  let fence = false
  for (const line of text.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) { fence = !fence; continue }
    if (!fence && !/^\s*\|?[\s:|-]+\|?\s*$/.test(line)) out.push(line)
  }
  const words = out
    .map((line) => stripInline(line.replace(/^\s*(?:#{1,6} |[-*+] (?:\[[ xX]\] )?|\d+[.)] |> ?)/, '').replace(/\|/g, ' ')))
    .join(' ')
    .split(/\s+/)
  return words.filter((word) => /[\p{L}\p{N}]/u.test(word)).length
}

export type HeadingAt = { level: number; text: string; at: number }

/** The headings, with where each line starts in the text: what the outline moves the caret to. */
export function headingsAt(text: string): HeadingAt[] {
  const found: HeadingAt[] = []
  let at = 0
  let fence = false
  for (const line of text.split('\n')) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence
    else if (!fence) {
      const match = /^\s*(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
      if (match) found.push({ level: match[1]!.length, text: stripInline(match[2]!), at })
    }
    at += line.length + 1
  }
  return found
}

/** The heading the caret is under, in the list {@link headingsAt} gave. */
export function headingOfCaret(headings: readonly HeadingAt[], caret: number): number {
  let index = -1
  headings.forEach((heading, at) => { if (heading.at <= caret) index = at })
  return index
}

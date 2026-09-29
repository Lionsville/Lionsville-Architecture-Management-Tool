// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a value looks like once it is a file.
 *
 * ADR-0003 put the project in a folder of text files so that a change reads as
 * a change. That only holds if the writing is *stable*: two saves of a project
 * nobody edited must produce the same bytes, or every autosave is a diff and
 * the whole point is lost. Stability is not something a `JSON.stringify` call
 * gives you for free — key order follows insertion order, which follows
 * whichever spread rebuilt the object last.
 *
 * So the encodings a scope's folder uses beyond JSON (`projects/text.ts`) live
 * here, as pure functions with the round trip pinned by tests: a markdown body
 * as a file, and **front matter** for the fields that sit above one — a
 * deliberately small subset of YAML, written and read by this file alone.
 *
 * Nothing here knows what a scope is. That is `folderFormat.ts`.
 */
import { parseJson } from './text'

/**
 * A markdown body as a file, and back.
 *
 * Exactly one trailing newline is added and exactly one is taken away, so a
 * description that itself ends in a blank line survives the round trip. Every
 * other scheme — "add one unless there is one already", "trim the end" — loses
 * that, and a lossy writer in a document tool is worse than an ugly one.
 */
export function markdownFile(body: string): string {
  return `${body}\n`
}

export function markdownBody(text: string): string {
  return text.endsWith('\n') ? text.slice(0, -1) : text
}

export type FrontMatterScalar = string | number | boolean
export type FrontMatterRow = Record<string, FrontMatterScalar | undefined>
export type FrontMatterValue = FrontMatterScalar | FrontMatterRow[]
export type FrontMatter = Record<string, FrontMatterValue | undefined>

const BOOLISH = /^(true|false)$/
const NUMBERISH = /^-?\d+(\.\d+)?$/
/** What may stand unquoted: no colon, no leading digit-only meaning, no edges of whitespace. */
const PLAIN = /^[A-Za-z0-9][A-Za-z0-9 ._/@#()[\]-]*$/

function scalarText(value: FrontMatterScalar): string {
  if (typeof value !== 'string') return String(value)
  const plain = PLAIN.test(value) && !value.endsWith(' ')
    && !BOOLISH.test(value) && !NUMBERISH.test(value)
  // JSON quoting rather than YAML's: the escapes are the same for the strings
  // this format carries, and it is the one quoting rule already in the file.
  return plain ? value : JSON.stringify(value)
}

function readScalar(raw: string): FrontMatterScalar {
  const text = raw.trim()
  if (text.startsWith('"')) {
    const parsed = parseJson(text)
    return typeof parsed === 'string' ? parsed : text
  }
  if (BOOLISH.test(text)) return text === 'true'
  if (NUMBERISH.test(text)) return Number(text)
  return text
}

/**
 * Fields above a markdown body, in the order they were given.
 *
 * Deliberately not sorted, unlike JSON: this is the header a person reads
 * first, and `title` before `status` before `date` is worth more than
 * alphabetical order. The set of keys is fixed by the writer, so the order is
 * stable anyway — the property the sorting was for.
 *
 * A field whose value is `undefined` is left out entirely rather than written
 * as an empty one, so an absent field reads back absent.
 */
export function frontMatterText(fields: FrontMatter): string {
  const lines: string[] = ['---']
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue
    if (Array.isArray(value)) {
      if (value.length === 0) continue
      lines.push(`${key}:`)
      for (const row of value) {
        const entries = Object.entries(row)
          .filter((entry): entry is [string, FrontMatterScalar] => entry[1] !== undefined)
        if (entries.length === 0) continue
        entries.forEach(([field, held], i) => {
          lines.push(`${i === 0 ? '  - ' : '    '}${field}: ${scalarText(held)}`)
        })
      }
      continue
    }
    lines.push(`${key}: ${scalarText(value)}`)
  }
  lines.push('---', '')
  return lines.join('\n')
}

/**
 * The fields and the body of a file that may or may not have front matter.
 *
 * A file without the opening `---` is all body, which is the honest reading of
 * a markdown file somebody wrote by hand: it has no fields, not broken ones.
 */
export function readFrontMatter(text: string): { fields: FrontMatter; body: string } {
  if (!text.startsWith('---\n')) return { fields: {}, body: text }
  const end = text.indexOf('\n---\n', 3)
  if (end === -1) return { fields: {}, body: text }

  const fields: FrontMatter = {}
  let list: Record<string, FrontMatterScalar>[] | undefined
  let row: Record<string, FrontMatterScalar> | undefined

  for (const line of text.slice(4, end + 1).split('\n')) {
    if (!line.trim()) continue
    const item = /^ {2}- (\w+): ?(.*)$/.exec(line)
    if (item && list) {
      row = { [item[1]]: readScalar(item[2]) }
      list.push(row)
      continue
    }
    const continued = /^ {4}(\w+): ?(.*)$/.exec(line)
    if (continued && row) {
      row[continued[1]] = readScalar(continued[2])
      continue
    }
    const field = /^(\w+):(?: (.*))?$/.exec(line)
    if (!field) continue
    if (field[2] === undefined) {
      // `key:` with nothing after it opens a list; the rows follow, indented.
      list = []
      row = undefined
      fields[field[1]] = list
      continue
    }
    list = undefined
    row = undefined
    fields[field[1]] = readScalar(field[2])
  }
  return { fields, body: text.slice(end + 5) }
}

/** One field, when the caller knows what it should be. Absent stays absent. */
export function frontMatterString(fields: FrontMatter, key: string): string | undefined {
  const held = fields[key]
  if (typeof held === 'string') return held
  return typeof held === 'number' || typeof held === 'boolean' ? String(held) : undefined
}

export function frontMatterNumber(fields: FrontMatter, key: string): number | undefined {
  const held = fields[key]
  if (typeof held === 'number') return held
  return typeof held === 'string' && NUMBERISH.test(held) ? Number(held) : undefined
}

export function frontMatterRows(fields: FrontMatter, key: string): Record<string, FrontMatterScalar>[] {
  const held = fields[key]
  return Array.isArray(held) ? (held as Record<string, FrontMatterScalar>[]) : []
}

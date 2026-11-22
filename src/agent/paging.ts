// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A list read, cut into pages (ADR-0007, amended 22 November 2026).
 *
 * Every list read answers its whole list to this file, which answers one
 * page of it: `limit` rows, the `fields` asked for, and a `next` cursor while
 * there are more. Done once here rather than in each read, so a list cannot
 * be cut short without a way on: before this, thirteen reads took a limit
 * and answered `{ total, shown }` with no way to ask for the rest, and six
 * took none.
 *
 * **The cursor is opaque and carries what it needs to be checked.** The
 * position, a fingerprint of the question (the arguments but the page's own)
 * and a fingerprint of the list as it stood when that page was answered —
 * every row, as read — with the key of the last row shown. A cursor from
 * another question is refused. Where the list is as it was, the next page
 * follows on. Where it changed — something written to the scope between two
 * pages — the next page starts after the row the last one ended on, wherever
 * that row is now, and says `moved: true`: rows added or removed before it
 * are not in the pages already read, which a caller that needs the list
 * whole reads again without a cursor. Where that row is gone, the place is
 * not known and the call is refused (`agent.pageMoved`).
 *
 * The fingerprint is of the rows rather than of the scope's revision, so a
 * change elsewhere in the scope, a list across the whole tree, and a host
 * whose revision moves with every author all page the same way.
 */
import type { AgentAnswer, AgentRequest, ListPage, ToolName } from './tools'
import { LISTS, checkArguments, json, pagingArguments, refused } from './tools'

type Args = Record<string, unknown>

/** What a list read was asked about its page, and the question without it. */
export type Paging = {
  readonly tool: ToolName
  readonly page: ListPage
  readonly limit: number
  readonly fields?: readonly string[]
  readonly cursor?: Cursor
  /** The arguments the read itself is handed: the page's taken out. */
  readonly args: Args
  /** The question, as a fingerprint: what a cursor is held to. */
  readonly asked: string
}

type Cursor = { readonly at: number; readonly list: string; readonly asked: string; readonly last?: string }

const PREFIX = 'p1'

/**
 * The page asked of a list read: nothing for any other tool, a refusal for a
 * page argument that is wrong, else what to hand the read and how to cut its
 * answer.
 */
export function pagingOf(request: Pick<AgentRequest, 'tool' | 'args'>): Paging | AgentAnswer | undefined {
  const page = LISTS[request.tool as ToolName]
  if (!page) return undefined
  const given = (request.args && typeof request.args === 'object' && !Array.isArray(request.args) ? request.args : {}) as Args
  const { cursor, fields, limit, ...args } = given
  const wrong = checkArguments(
    { type: 'object', properties: pagingArguments(page), additionalProperties: false },
    { cursor, fields, limit },
  )
  if (wrong) return refused('agent.badArguments', wrong)
  const asked = fingerprint(stable(args))
  const read = typeof cursor === 'string' ? cursorOf(cursor) : undefined
  if (typeof cursor === 'string' && !read) return refused('agent.badArguments', '"cursor" is not one this server answered: ask again without it')
  if (read && read.asked !== asked) {
    return refused('agent.badArguments', '"cursor" answered another question: ask it with the arguments of the page that gave it, or without cursor')
  }
  return {
    tool: request.tool as ToolName, page, args, asked,
    limit: typeof limit === 'number' ? limit : page.limit,
    ...(Array.isArray(fields) ? { fields: fields as string[] } : {}),
    ...(read ? { cursor: read } : {}),
  }
}

/** One page of a read's whole answer; a refusal, a picture, or an answer with no list of rows is passed as it is. */
export function paged(answer: AgentAnswer, paging: Paging): AgentAnswer {
  if (!answer.ok || answer.content.length !== 1 || answer.content[0].type !== 'text') return answer
  let whole: unknown
  try {
    whole = JSON.parse(answer.content[0].text)
  } catch {
    return answer
  }
  if (!whole || typeof whole !== 'object' || Array.isArray(whole)) return answer
  const said = whole as Args
  const key = rowsKey(said, paging)
  if (key === undefined) return answer
  const rows = said[key] as unknown[]
  const list = fingerprint(JSON.stringify(rows))
  const start = startOf(rows, list, paging.cursor)
  if (start === undefined) return refused('agent.pageMoved')
  const shown = rows.slice(start, start + paging.limit)
  const end = start + shown.length
  const next = end < rows.length
    ? cursorText({ at: end, list, asked: paging.asked, ...lastOf(shown) })
    : undefined
  return json({
    ...said,
    [key]: paging.fields ? shown.map((row) => only(row, paging.fields!)) : shown,
    total: rows.length,
    shown: shown.length,
    ...(next !== undefined ? { next } : {}),
    ...(paging.cursor && paging.cursor.list !== list ? { moved: true } : {}),
  })
}

/** The key the rows are under: the first of the page's candidates — the tool's noun, then `some` — that holds a list. */
function rowsKey(said: Args, paging: Paging): string | undefined {
  const noun = paging.tool.slice(0, paging.tool.indexOf('.'))
  const candidates = paging.page.rows ?? [noun, 'some']
  return candidates.find((key) => Array.isArray(said[key]))
}

/** Where the page starts: on from the cursor while the list is as it was, after its last row once it moved, unknown once that row is gone. */
function startOf(rows: readonly unknown[], list: string, cursor: Cursor | undefined): number | undefined {
  if (!cursor) return 0
  if (cursor.list === list) return Math.min(cursor.at, rows.length)
  if (cursor.last === undefined) return undefined
  const at = rows.findIndex((row) => keyOf(row) === cursor.last)
  return at < 0 ? undefined : at + 1
}

function lastOf(shown: readonly unknown[]): { last?: string } {
  const last = shown.length ? keyOf(shown[shown.length - 1]) : undefined
  return last === undefined ? {} : { last }
}

/** What names a row whatever else changed about it: its scope with its id, path, key or file, as it has them. */
function keyOf(row: unknown): string | undefined {
  if (!row || typeof row !== 'object') return typeof row === 'string' ? row : undefined
  const held = row as Args
  const parts = ['scope', 'path', 'id', 'key', 'file', 'at'].filter((name) => typeof held[name] === 'string' || typeof held[name] === 'number')
  if (!parts.some((name) => name !== 'scope')) return undefined
  return parts.map((name) => String(held[name])).join('\u0000')
}

/** A row with only the fields asked for, and its id. */
function only(row: unknown, fields: readonly string[]): unknown {
  if (!row || typeof row !== 'object' || Array.isArray(row)) return row
  return Object.fromEntries(Object.entries(row as Args).filter(([name]) => name === 'id' || fields.includes(name)))
}

function cursorText(cursor: Cursor): string {
  const last = cursor.last === undefined ? '' : `.${encodeURIComponent(cursor.last)}`
  return `${PREFIX}.${cursor.at}.${cursor.list}.${cursor.asked}${last}`
}

function cursorOf(text: string): Cursor | undefined {
  const [prefix, at, list, asked, ...rest] = text.split('.')
  if (prefix !== PREFIX || !/^\d+$/.test(at ?? '') || !list || !asked) return undefined
  try {
    return { at: Number(at), list, asked, ...(rest.length ? { last: decodeURIComponent(rest.join('.')) } : {}) }
  } catch {
    return undefined
  }
}

/** JSON with the keys in order, so the same question is the same text. */
function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().filter((key) => (value as Args)[key] !== undefined)
      .map((key) => `${JSON.stringify(key)}:${stable((value as Args)[key])}`).join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

/** FNV-1a, 32 bits, as hex: a fingerprint, not a secret. */
function fingerprint(text: string): string {
  let hash = 0x811c9dc5
  for (let at = 0; at < text.length; at++) {
    hash ^= text.charCodeAt(at)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A list read cut into pages: a cursor that continues, and what it does when
 * the list moved between two pages; the fields asked for; a limit on every
 * list. The handler's half is in `mcpProtocol.e2e.test.ts`.
 */
import { describe, expect, it } from 'vitest'
import { paged, pagingOf } from './paging'
import type { Paging } from './paging'
import { LISTS, TOOLS, json } from './tools'
import type { AgentAnswer } from './tools'

const rows = (ids: readonly string[]) => ids.map((id) => ({ id, name: id.toUpperCase(), kind: 'application' }))

function ask(args: Record<string, unknown>, tool = 'elements.list'): Paging {
  const paging = pagingOf({ tool, args })
  if (!paging || !('tool' in paging)) throw new Error(`not a page: ${JSON.stringify(paging)}`)
  return paging
}

const parsed = (out: AgentAnswer) => {
  if (!out.ok || out.content[0].type !== 'text') throw new Error(JSON.stringify(out))
  return JSON.parse(out.content[0].text) as { elements: { id: string; name?: string }[]; total: number; shown: number; next?: string; moved?: true }
}

describe('a list read, in pages', () => {
  it('gives every list read a cursor, fields and a limit with a default and a maximum', () => {
    const lists = TOOLS.filter((tool) => tool.name.endsWith('.list'))
    expect(lists.map((tool) => tool.name).filter((name) => !(name in LISTS))).toEqual([])
    for (const tool of lists) {
      const { cursor, fields, limit } = tool.inputSchema.properties
      expect(cursor, tool.name).toBeDefined()
      expect(fields, tool.name).toBeDefined()
      expect(limit, tool.name).toMatchObject({ type: 'integer', minimum: 1, maximum: LISTS[tool.name]!.max })
    }
  })

  it('hands the read the question without the page, and is nothing for a tool that is not a list', () => {
    expect(ask({ kind: 'application', limit: 2, fields: ['name'] }).args).toEqual({ kind: 'application' })
    expect(pagingOf({ tool: 'element.describe', args: { id: 'a' } })).toBeUndefined()
    expect(pagingOf({ tool: 'elements.list', args: { limit: 0 } })).toMatchObject({ ok: false, refusal: 'agent.badArguments' })
    expect(pagingOf({ tool: 'elements.list', args: { limit: 2001 } })).toMatchObject({ ok: false, refusal: 'agent.badArguments' })
  })

  it('pages a list to its end, the default limit where none is asked', () => {
    const whole = json({ elements: rows(['a', 'b', 'c', 'd', 'e']) })
    const first = parsed(paged(whole, ask({ limit: 2 })))
    expect(first).toMatchObject({ total: 5, shown: 2, elements: [{ id: 'a' }, { id: 'b' }] })
    const second = parsed(paged(whole, ask({ limit: 2, cursor: first.next })))
    expect(second.elements.map((one) => one.id)).toEqual(['c', 'd'])
    const last = parsed(paged(whole, ask({ limit: 2, cursor: second.next })))
    expect(last.elements.map((one) => one.id)).toEqual(['e'])
    expect(last.next).toBeUndefined()
    expect(parsed(paged(whole, ask({}))).shown).toBe(5)
  })

  it('answers only the fields asked for, and the id', () => {
    const out = parsed(paged(json({ elements: rows(['a']) }), ask({ fields: ['name'] })))
    expect(out.elements).toEqual([{ id: 'a', name: 'A' }])
  })

  it('refuses a cursor from another question, or one it never answered', () => {
    const first = parsed(paged(json({ elements: rows(['a', 'b']) }), ask({ limit: 1 })))
    expect(pagingOf({ tool: 'elements.list', args: { kind: 'actor', limit: 1, cursor: first.next } }))
      .toMatchObject({ ok: false, refusal: 'agent.badArguments' })
    expect(pagingOf({ tool: 'elements.list', args: { cursor: 'nonsense' } })).toMatchObject({ ok: false, refusal: 'agent.badArguments' })
  })

  it('goes on after the row the last page ended on when the list moved, and says so', () => {
    const first = parsed(paged(json({ elements: rows(['a', 'b', 'c', 'd']) }), ask({ limit: 2 })))
    // Something was written between the two pages: a row before the cut and one after.
    const moved = json({ elements: rows(['a', 'aa', 'b', 'c', 'cc', 'd']) })
    const second = parsed(paged(moved, ask({ limit: 2, cursor: first.next })))
    expect(second).toMatchObject({ moved: true, total: 6 })
    expect(second.elements.map((one) => one.id)).toEqual(['c', 'cc'])
    // From there on the list is as that page read it, and the pages follow on.
    const third = parsed(paged(moved, ask({ limit: 2, cursor: second.next })))
    expect(third.elements.map((one) => one.id)).toEqual(['d'])
    expect(third.moved).toBeUndefined()
  })

  it('refuses when the row the last page ended on is gone, rather than guess where to go on', () => {
    const first = parsed(paged(json({ elements: rows(['a', 'b', 'c']) }), ask({ limit: 2 })))
    expect(paged(json({ elements: rows(['a', 'c']) }), ask({ limit: 2, cursor: first.next })))
      .toEqual({ ok: false, refusal: 'agent.pageMoved' })
  })

  it('finds the rows under the key its list says, and leaves an answer with none as it is', () => {
    const views = pagingOf({ tool: 'views.list', args: { limit: 1 } }) as Paging
    expect(parsed(paged(json({ total: 2, some: [{ scope: '', id: 'a' }, { scope: 'x', id: 'a' }] }), views)))
      .toMatchObject({ total: 2, shown: 1, some: [{ scope: '', id: 'a' }] })
    const thread = json({ about: { kind: 'decision', id: 'adr-1' }, count: 0 })
    expect(paged(thread, pagingOf({ tool: 'comments.list', args: {} }) as Paging)).toBe(thread)
  })
})

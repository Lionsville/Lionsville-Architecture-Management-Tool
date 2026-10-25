// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it, vi } from 'vitest'
import { fromArrays } from '../model/normalised'
import type { AgentAnswer } from './tools'
import { listChanges } from './changes'
import type { ChangesOf } from './changes'

const model = fromArrays({
  name: 'Acme', elements: [], relations: [], diagrams: [],
  observations: [{ id: 'ob-1', number: 7, title: 'Seen', date: '2026-10-01', impact: 'minor', seen: 1, body: '', history: [] }],
})
const parse = (held: AgentAnswer) => {
  if (!held.ok || held.content[0].type !== 'text') throw new Error(JSON.stringify(held))
  return JSON.parse(held.content[0].text) as Record<string, unknown>
}
const changesOf: ChangesOf = vi.fn(async () => ({
  changes: [{ at: Date.UTC(2026, 9, 20), by: 'Bo', via: 'An agent', what: 'changed tone' }, { at: Date.UTC(2026, 9, 1), by: 'Ada', what: 'Created' }],
  more: false,
}))
const session = (over: Partial<Parameters<typeof listChanges>[1]> = {}) => ({ indexed: () => model, scopePath: () => 'acme', changesOf, ...over })

describe('changes.list (ADR-0038, amended §11)', () => {
  it('answers a record\'s changes, found by its label, newest first, with who and via', async () => {
    const said = parse(await listChanges({ about: { kind: 'observation', id: 'OB-0007' } }, session()))
    expect(said.about).toEqual({ kind: 'observation', id: 'ob-1' })
    expect(said.changes).toEqual([
      { at: '2026-10-20T00:00:00.000Z', by: 'Bo', via: 'An agent', what: 'changed tone' },
      { at: '2026-10-01T00:00:00.000Z', by: 'Ada', what: 'Created' },
    ])
    expect(changesOf).toHaveBeenCalledWith({ kind: 'observation', id: 'ob-1' }, undefined, 20)
  })

  it('reads another scope\'s record by its id', async () => {
    await listChanges({ about: { kind: 'decision', id: 'adr-1' }, scope: 'acme/rail', limit: 5 }, session())
    expect(changesOf).toHaveBeenLastCalledWith({ kind: 'decision', id: 'adr-1' }, 'acme/rail', 5)
  })

  it('says so where the source keeps no history, and refuses a record the scope does not hold', async () => {
    expect(parse(await listChanges({ about: { kind: 'observation', id: 'ob-1' } }, session({ changesOf: undefined })))).toMatchObject({ kept: false, changes: [] })
    const missing = await listChanges({ about: { kind: 'observation', id: 'ob-9' } }, session())
    expect(missing).toMatchObject({ ok: false, refusal: 'command.unknownRecord' })
  })
})

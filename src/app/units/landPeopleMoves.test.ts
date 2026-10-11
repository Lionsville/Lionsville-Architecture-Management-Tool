// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The people's moves written as one step (ADR-0036 §6), over memory: the
 * open scope's part through its session — one step, which undo takes back
 * whole — the other scopes' in one apply, a barrier on the open scope's step
 * where others were written, nothing at all where a scope may not be
 * written, and what is gone since the list was drawn passed over.
 */
import { describe, expect, it } from 'vitest'
import { memoryRepositories } from '../../adapters/memory/memoryRepositories'
import type { Command } from '../../model/commands'
import type { HostModel } from '../../model/hostModel'
import { assignmentList, fromArrays } from '../../model/normalised'
import type { Model } from '../../model/normalised'
import { apply } from '../../model/reducer'
import type { Assignment } from '../../model/units'
import { placeWhole, readScope } from '../../projects/scopeAccess'
import { emptyContent } from '../../projects/scopeState'
import { landPeopleMoves, MOVE_BARRIER, stepIn } from './landPeopleMoves'
import type { MovePeopleDeps } from './landPeopleMoves'

const as = (id: string, unitId: string, person: string, over: Partial<Assignment> = {}): Assignment => ({
  id, unitId, roleId: 'ro-lead', person: { person }, ...over,
})
const EVE = '2026-12-31'
const DAY = '2027-01-01'

const content = (name: string, over: Partial<HostModel> = {}) => {
  const empty = emptyContent(name)
  return { ...empty, model: { ...empty.model, ...over } }
}

/** A session held here: its model changed by the model's own writer, with the stack an undo would read. */
function session(start: HostModel) {
  let model: Model = fromArrays(start)
  const dispatched: Command[] = []
  const undo: Command[] = []
  return {
    indexed: () => model,
    dispatch: (command: Command) => {
      const result = apply(model, command)
      if (!result.ok) return undefined
      dispatched.push(command)
      undo.push(result.inverse)
      model = result.model
      return model
    },
    undo: () => {
      const inverse = undo.pop()
      const result = inverse && apply(model, inverse)
      if (result?.ok) model = result.model
    },
    model: () => model,
    dispatched,
  }
}

const SHIPPING: HostModel = { ...content('Shipping').model, assignments: [as('as-1', 'parcel-freight', 'pe-omar'), as('as-2', 'parcel-freight', 'pe-sanne')] }

async function deps(open: ReturnType<typeof session>, over: Partial<MovePeopleDeps> = {}): Promise<MovePeopleDeps & { saved: number[] }> {
  const repositories = memoryRepositories()
  await placeWhole(repositories.scopes, '', content('Acme', { assignments: [as('as-9', 'data', 'pe-eva', { roleId: 'ro-rel' })] }))
  await placeWhole(repositories.scopes, 'shipping', { ...content('Shipping'), model: SHIPPING })
  const saved: number[] = []
  return {
    scope: 'shipping', scopes: repositories.scopes, session: open, writable: () => true,
    save: () => { saved.push(1); return Promise.resolve() }, saved, ...over,
  }
}

const ends = (id: string): Command => ({ type: 'assignment.update', id, patch: { until: EVE } })
const begins = (id: string, person: string): Command => ({ type: 'assignment.add', assignment: as(id, 'parcel', person, { from: DAY }) })

describe('writing the people\'s moves', () => {
  it('writes the open scope\'s part as one step through its session, which undo takes back whole', async () => {
    const open = session(SHIPPING)
    const landed = await landPeopleMoves(await deps(open), new Map([['shipping', [ends('as-1'), begins('as-new-1', 'pe-omar'), ends('as-2')]]]))
    expect(landed).toEqual({ ok: true, changed: ['shipping'], ended: 2, begun: 1 })
    expect(open.dispatched).toHaveLength(1)
    expect(open.dispatched[0]).toMatchObject({ type: 'transaction' })
    expect(open.dispatched[0]).not.toHaveProperty('barrier')
    expect(assignmentList(open.model()).map((one) => [one.id, one.until ?? one.from])).toEqual([
      ['as-1', EVE], ['as-2', EVE], ['as-new-1', DAY],
    ])
    open.undo()
    expect(assignmentList(open.model())).toEqual(SHIPPING.assignments)
  })

  it('writes the other scopes in one apply, and puts a barrier on the open scope\'s step', async () => {
    const open = session(SHIPPING)
    const held = await deps(open)
    const landed = await landPeopleMoves(held, new Map([
      ['shipping', [ends('as-1')]],
      ['', [{ type: 'assignment.update', id: 'as-9', patch: { until: EVE } }]],
    ]))
    expect(landed).toEqual({ ok: true, changed: ['', 'shipping'], ended: 2, begun: 0 })
    expect((await readScope(held.scopes, ''))!.model.assignments![0].until).toBe(EVE)
    expect(open.dispatched[0]).toMatchObject({ type: 'assignment.update', barrier: MOVE_BARRIER })
    expect(held.saved).toEqual([1])
  })

  it('writes nothing where a scope it writes may only be read, or the open scope refuses its part', async () => {
    const open = session(SHIPPING)
    const readOnly = await deps(open, { writable: (path) => path !== '' })
    expect(await landPeopleMoves(readOnly, new Map([['shipping', [ends('as-1')]], ['', [ends('as-9')]]])))
      .toEqual({ ok: false, reason: 'shell.scopeReadOnly', scope: '' })
    const backwards: Command = { type: 'assignment.update', id: 'as-1', patch: { from: '2027-02-01', until: EVE } }
    expect(await landPeopleMoves(await deps(open), new Map([['shipping', [backwards]], ['', [ends('as-9')]]])))
      .toEqual({ ok: false, reason: 'command.datesOutOfOrder', scope: 'shipping' })
    expect(open.dispatched).toEqual([])
  })

  it('passes over what is gone since the list was drawn, and says when nothing was left', async () => {
    const model = fromArrays(SHIPPING)
    expect(stepIn(model, [ends('as-7'), begins('as-1', 'pe-omar')])).toBeUndefined()
    expect(stepIn(model, [ends('as-7'), ends('as-1')])).toEqual(ends('as-1'))
    const open = session(SHIPPING)
    expect(await landPeopleMoves(await deps(open), new Map([['shipping', [ends('as-7')]]]))).toEqual({ ok: false, reason: 'unchanged' })
  })
})

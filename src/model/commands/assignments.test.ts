// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Assignments at the writer (ADR-0036 §4): added, corrected, ended and
 * removed, with the inverse that puts each back, the write key it names, the
 * line the Activity list says — which names the unit and never the person —
 * and a record each in a version's history.
 */
import { describe, expect, it } from 'vitest'
import { summarise } from '../activity'
import { transaction } from '../commands'
import type { Command } from '../commands'
import { diffModels } from '../diff'
import { assignmentList, fromArrays, toArrays } from '../normalised'
import type { Model } from '../normalised'
import { personIdsIn } from '../person'
import { recordsChanged } from '../recordKey'
import { apply, writesOf } from '../reducer'
import { restoreCommand } from '../restore'
import type { Assignment } from '../units'
import type { DesignElement } from '../types'

const webshop: DesignElement = {
  id: 'webshop', kind: 'actor', name: 'Webshop', unitTypeId: 'ut-team', lifecycle: 'live', isManaged: false, aspects: {},
}
const femke: Assignment = { id: 'as-1', unitId: 'webshop', roleId: 'ro-po', person: { person: 'pe-femke' }, from: '2022-01-01' }
const bram: Assignment = { id: 'as-2', unitId: 'webshop', roleId: 'ro-dev', person: { person: 'pe-bram' }, share: 0.5 }

function scope(over: Partial<Parameters<typeof fromArrays>[0]> = {}): Model {
  return fromArrays({ name: 'Customer', elements: [webshop], relations: [], diagrams: [], ...over })
}

function applied(model: Model, command: Command): Model {
  const result = apply(model, command)
  if (!result.ok) throw new Error(result.reason)
  return result.model
}

describe('an assignment at the writer', () => {
  it('adds one, and undoing it leaves no list behind', () => {
    const empty = scope()
    const result = apply(empty, { type: 'assignment.add', assignment: femke })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(toArrays(result.model).assignments).toEqual([femke])
    const undone = apply(result.model, result.inverse)
    expect(undone.ok && undone.model).toStrictEqual(empty)
    expect(undone.ok && 'assignments' in toArrays(undone.model)).toBe(false)
  })

  it('refuses a second on an id that is taken, and days that run backwards', () => {
    const held = scope({ assignments: [femke] })
    expect(apply(held, { type: 'assignment.add', assignment: { ...bram, id: 'as-1' } })).toEqual({ ok: false, reason: 'command.taken' })
    expect(apply(held, { type: 'assignment.add', assignment: { ...bram, from: '2026-02-01', until: '2026-01-31' } }))
      .toEqual({ ok: false, reason: 'command.datesOutOfOrder' })
    expect(apply(held, { type: 'assignment.update', id: 'as-1', patch: { until: '2021-12-31' } }))
      .toEqual({ ok: false, reason: 'command.datesOutOfOrder' })
  })

  it('ends one by its last day, and undo takes the day off again', () => {
    const held = scope({ assignments: [femke] })
    const result = apply(held, { type: 'assignment.update', id: 'as-1', patch: { until: '2026-10-11' } })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(assignmentList(result.model)).toEqual([{ ...femke, until: '2026-10-11' }])
    expect(result.inverse).toEqual({ type: 'assignment.update', id: 'as-1', patch: { until: undefined } })
    expect(applied(result.model, result.inverse)).toStrictEqual(held)
  })

  it('refuses a field an assignment does not have, and answers one that is gone as gone', () => {
    const held = scope({ assignments: [femke] })
    expect(apply(held, { type: 'assignment.update', id: 'as-1', patch: { name: 'Femke' } as never }))
      .toEqual({ ok: false, reason: 'command.notAField' })
    expect(apply(held, { type: 'assignment.remove', id: 'nope' })).toEqual({ ok: false, reason: 'command.gone' })
    expect(apply(held, { type: 'assignment.update', id: 'nope', patch: { share: 1 } })).toEqual({ ok: false, reason: 'command.gone' })
  })

  it('removes one and puts it back where it stood', () => {
    const held = scope({ assignments: [femke, bram] })
    const result = apply(held, { type: 'assignment.remove', id: 'as-1' })
    expect(result.ok && result.inverse).toEqual({ type: 'assignment.add', assignment: femke, at: 0 })
    const undone = result.ok ? apply(result.model, result.inverse) : result
    expect(undone.ok && undone.model.order.assignments).toEqual(['as-1', 'as-2'])
  })

  it('writes the fields it names, and the whole record where it adds or removes', () => {
    expect(writesOf({ type: 'assignment.update', id: 'as-1', patch: { until: '2026-10-11', share: 0.5 } }))
      .toEqual(['assignment/as-1/until', 'assignment/as-1/share'])
    expect(writesOf({ type: 'assignment.add', assignment: femke })).toEqual(['assignment/as-1'])
    expect(writesOf({ type: 'assignment.remove', id: 'as-2' })).toEqual(['assignment/as-2'])
  })

  it('holds a person as an id the register answers for, and nothing else', () => {
    const held = scope({ assignments: [femke, bram] })
    expect([...personIdsIn(toArrays(held))]).toEqual(['pe-femke', 'pe-bram'])
    expect(JSON.stringify(toArrays(held))).not.toMatch(/Femke|Bram/)
  })
})

describe('what a step about assignments is called', () => {
  const held = scope({ assignments: [femke, bram] })

  it('names the unit and never the person', () => {
    expect(summarise([{ type: 'assignment.add', assignment: { ...femke, id: 'as-3' } }], held))
      .toEqual({ key: 'activity.assignmentAdded', name: 'Webshop' })
    expect(summarise([{ type: 'assignment.update', id: 'as-1', patch: { until: '2026-10-11' } }], held))
      .toEqual({ key: 'activity.assignmentEnded', name: 'Webshop' })
    expect(summarise([{ type: 'assignment.update', id: 'as-1', patch: { share: 0.5 } }], held))
      .toEqual({ key: 'activity.assignmentChanged', name: 'Webshop' })
    expect(summarise([{ type: 'assignment.remove', id: 'as-2' }], held)).toEqual({ key: 'activity.assignmentRemoved', name: 'Webshop' })
    expect(summarise([{ type: 'assignment.add', assignment: { ...femke, id: 'as-9', unitId: 'gone' } }], held))
      .toEqual({ key: 'activity.assignmentAdded', name: 'gone' })
  })

  it('counts several ends, or several new ones, in one step', () => {
    const ends = transaction([
      { type: 'assignment.update', id: 'as-1', patch: { until: '2026-10-11' } },
      { type: 'assignment.update', id: 'as-2', patch: { until: '2026-10-11' } },
    ])
    expect(summarise([ends], held)).toEqual({ key: 'activity.assignmentsEnded', count: 2 })
    const adds = transaction([
      { type: 'assignment.add', assignment: { ...femke, id: 'as-3' } },
      { type: 'assignment.add', assignment: { ...bram, id: 'as-4' } },
    ])
    expect(summarise([adds], held)).toEqual({ key: 'activity.assignmentsAdded', count: 2 })
  })
})

describe('assignments in a version\'s history', () => {
  it('are a record each, in the diff by their unit, in what a step touched and in a restore', () => {
    const before = scope({ assignments: [femke] })
    const after = applied(
      applied(before, { type: 'assignment.update', id: 'as-1', patch: { until: '2026-10-11' } }),
      { type: 'assignment.add', assignment: bram },
    )
    expect(recordsChanged(before, after)).toEqual([{ kind: 'assignment', id: 'as-1' }, { kind: 'assignment', id: 'as-2' }])
    expect(diffModels(toArrays(before), toArrays(after)).map((change) => [change.kind, change.what, change.name]))
      .toEqual([['changed', 'assignment', 'Webshop'], ['added', 'assignment', 'Webshop']])
    const back = restoreCommand(before, after, undefined, '2026-10-01')
    expect(back.ok).toBe(true)
    if (!back.ok) return
    expect(applied(after, back.command)).toStrictEqual({ ...before, order: { ...before.order } })
  })
})

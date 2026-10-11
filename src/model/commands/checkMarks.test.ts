// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A finding marked as intended at the writer (ADR-0036, amended 11 October
 * 2026): made and taken back, each the other's exact inverse; a fix refused
 * whoever sends it; the write key each names, the line the Activity list says
 * — by the check's name, in the language on screen — and a record each in a
 * version's history.
 */
import { describe, expect, it } from 'vitest'
import { summarise } from '../activity'
import type { CheckMark } from '../checkMarks'
import { checkMarkId } from '../checkMarks'
import type { Command } from '../commands'
import { diffModels } from '../diff'
import { checkMarkList, fromArrays, toArrays } from '../normalised'
import type { Model } from '../normalised'
import { recordsChanged } from '../recordKey'
import { apply, writesOf } from '../reducer'
import { restoreCommand } from '../restore'
import type { DesignElement, Relation } from '../types'

const actor = (id: string, name: string): DesignElement => ({
  id, kind: 'actor', name, unitTypeId: 'ut-team', lifecycle: 'live', isManaged: false, aspects: {},
})
const together: Relation = { id: 'i-1', type: 'interacts', sourceId: 'web', targetId: 'ip', mode: 'collaboration' }
const designTogether: CheckMark = {
  check: 'check.interactionUnused', key: 'i-1 web ip', reason: 'They design the API together', on: '2026-10-11',
}
const vacancy: CheckMark = { check: 'check.roleVacant', key: 'web ro-sm', on: '2026-10-12' }

function scope(over: Partial<Parameters<typeof fromArrays>[0]> = {}): Model {
  return fromArrays({
    name: 'Customer', elements: [actor('web', 'Webshop'), actor('ip', 'Integration Platform')], relations: [together], diagrams: [], ...over,
  })
}

function applied(model: Model, command: Command): Model {
  const result = apply(model, command)
  if (!result.ok) throw new Error(result.reason)
  return result.model
}

describe('a mark at the writer', () => {
  it('is made, and undoing it leaves no list behind', () => {
    const empty = scope()
    const result = apply(empty, { type: 'checkMark.add', mark: designTogether })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(toArrays(result.model).checkMarks).toEqual([designTogether])
    expect(result.inverse).toEqual({ type: 'checkMark.remove', id: 'check.interactionUnused i-1 web ip' })
    const undone = apply(result.model, result.inverse)
    expect(undone.ok && undone.model).toStrictEqual(empty)
    expect(undone.ok && 'checkMarks' in toArrays(undone.model)).toBe(false)
  })

  it('is taken back and put back where it stood, exactly', () => {
    const held = scope({ checkMarks: [designTogether, vacancy] })
    const result = apply(held, { type: 'checkMark.remove', id: checkMarkId(designTogether) })
    expect(result.ok && checkMarkList(result.model)).toEqual([vacancy])
    expect(result.ok && result.inverse).toEqual({ type: 'checkMark.add', mark: designTogether, at: 0 })
    const undone = result.ok ? apply(result.model, result.inverse) : result
    expect(undone.ok && undone.model).toStrictEqual(held)
  })

  it('refuses a fix, whoever sends it, and a check nobody here knows the weight of', () => {
    const held = scope()
    const fix: CheckMark = { check: 'check.unitMisplaced', key: 'web ut-cluster', on: '2026-10-11' }
    expect(apply(held, { type: 'checkMark.add', mark: fix })).toEqual({ ok: false, reason: 'command.markFix' })
    expect(apply(held, { type: 'checkMark.add', mark: { ...fix, check: 'check.somethingNew' as never } }))
      .toEqual({ ok: false, reason: 'command.markFix' })
    // Inside a transaction the whole step is refused, and nothing is marked.
    expect(apply(held, { type: 'transaction', commands: [{ type: 'checkMark.add', mark: vacancy }, { type: 'checkMark.add', mark: fix }] }))
      .toEqual({ ok: false, reason: 'command.markFix' })
  })

  it('refuses one instance marked twice, and answers a mark that is not there as gone', () => {
    const held = scope({ checkMarks: [designTogether] })
    expect(apply(held, { type: 'checkMark.add', mark: { ...designTogether, reason: 'Said again' } })).toEqual({ ok: false, reason: 'command.taken' })
    expect(apply(held, { type: 'checkMark.remove', id: checkMarkId(vacancy) })).toEqual({ ok: false, reason: 'command.gone' })
  })

  it('writes the one mark it makes or takes back', () => {
    expect(writesOf({ type: 'checkMark.add', mark: designTogether })).toEqual(['checkMark/check.interactionUnused i-1 web ip'])
    expect(writesOf({ type: 'checkMark.remove', id: checkMarkId(vacancy) })).toEqual(['checkMark/check.roleVacant web ro-sm'])
  })
})

describe('what a step about a mark is called', () => {
  it('names the check, as a key the language on screen says, and not the instance', () => {
    const held = scope({ checkMarks: [designTogether] })
    expect(summarise([{ type: 'checkMark.add', mark: vacancy }], held))
      .toEqual({ key: 'activity.checkMarkAdded', typeKey: 'check.name.roleVacant' })
    expect(summarise([{ type: 'checkMark.remove', id: checkMarkId(designTogether) }], held))
      .toEqual({ key: 'activity.checkMarkRemoved', typeKey: 'check.name.interactionUnused' })
    expect(summarise([{ type: 'checkMark.remove', id: 'check.notDrawn gone' }], held)).toEqual({ key: 'activity.checkMarkRemoved' })
  })
})

describe('marks in a version’s history', () => {
  it('are a record each, in the diff by what their first subject is called, in what a step touched and in a restore', () => {
    const before = scope({ checkMarks: [designTogether] })
    const after = applied(
      applied(applied(before, { type: 'checkMark.remove', id: checkMarkId(designTogether) }),
        { type: 'checkMark.add', mark: { ...designTogether, reason: 'Only while the API is designed' } }),
      { type: 'checkMark.add', mark: vacancy },
    )
    expect(recordsChanged(before, after)).toEqual([
      { kind: 'checkMark', id: checkMarkId(designTogether) }, { kind: 'checkMark', id: checkMarkId(vacancy) },
    ])
    expect(diffModels(toArrays(before), toArrays(after)).map((change) => [change.kind, change.what, change.name, change.fields]))
      .toEqual([
        ['changed', 'checkMark', 'Webshop → Integration Platform', ['reason']],
        ['added', 'checkMark', 'Webshop', undefined],
      ])
    const back = restoreCommand(before, after, undefined, '2026-10-01')
    expect(back.ok).toBe(true)
    if (!back.ok) return
    expect(toArrays(applied(after, back.command)).checkMarks).toEqual([designTogether])
  })
})

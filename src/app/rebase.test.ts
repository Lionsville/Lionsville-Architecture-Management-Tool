/**
 * The stack arithmetic a rebase is made of, over plain objects in node.
 *
 * It lives apart from the hook so that the question these tests ask — does a
 * run of steps survive being lifted off a model and put back on over somebody
 * else's change — is asked without a render in it.
 */
import { describe, expect, it } from 'vitest'
import { apply, fromArrays } from '../model'
import type { Command, Model } from '../model'
import { element, model as designModel } from '../model/testFixtures'
import { flatten, newestOwn, pickRun, rewind, unwind } from './rebase'
import type { StepFold, StepRun } from './rebase'

const start = (): Model => fromArrays(designModel({
  elements: [element('billing', { name: 'Billing' }), element('crm', { name: 'CRM' })],
  relations: [],
  diagrams: [],
}))

const rename = (id: string, name: string): Command =>
  ({ type: 'element.update', id, patch: { name } })

/**
 * One fold, as the session would have recorded it: applied, with its inverse
 * kept — and the one-fold step around it, for the tests that ask by step.
 */
function step(
  model: Model, stepId: string, ...commands: Command[]
): { step: StepRun; fold: StepFold; model: Model } {
  let next = model
  const inverses: Command[] = []
  for (const command of commands) {
    const result = applyOrThrow(next, command)
    next = result.model
    inverses.unshift(result.inverse)
  }
  const fold: StepFold = { changeId: `${stepId}-1`, commands, inverses }
  return { step: { stepId, folds: [fold] }, fold, model: next }
}

/** A fold that applies nothing, for the tests that only ask which one was picked. */
const empty = (changeId: string): StepFold => ({ changeId, commands: [], inverses: [] })

function applyOrThrow(model: Model, command: Command) {
  const result = apply(model, command)
  if (!result.ok) throw new Error(result.reason)
  return result
}

const nameOf = (model: Model, id: string) => model.elements[id].name

/** A coalescing step, as the session grows one: three announcements, one step. */
const typed: StepRun = { stepId: 'typed', folds: [empty('k1'), empty('k2'), empty('k3')] }

describe('pickRun', () => {
  it('keeps the stack’s own order, whatever order the ids arrive in', () => {
    const steps: StepRun[] = [
      { stepId: 'a', folds: [empty('a-1')] },
      { stepId: 'b', folds: [empty('b-1')] },
      { stepId: 'c', folds: [empty('c-1')] },
    ]
    expect(pickRun(steps, ['c', 'a']).run.map((fold) => fold.stepId)).toEqual(['a', 'c'])
  })

  it('reports an id that names nothing rather than refusing the run', () => {
    const steps: StepRun[] = [{ stepId: 'a', folds: [empty('a-1')] }]
    const picked = pickRun(steps, ['a', 'gone'])
    expect(picked.run).toHaveLength(1)
    expect(picked.unknown).toEqual(['gone'])
  })

  it('takes every fold of a step named by its own id', () => {
    const picked = pickRun([typed], ['typed'])
    expect(picked.run.map((fold) => fold.changeId)).toEqual(['k1', 'k2', 'k3'])
    expect(picked.run.every((fold) => fold.stepId === 'typed')).toBe(true)
    expect(picked.unknown).toEqual([])
  })

  it('takes one fold of a step named by its changeId, and says whose it is', () => {
    // The keystrokes before it were answered for already; only the last is
    // still in flight, so only the last comes off the model.
    const picked = pickRun([typed], ['k3'])
    expect(picked.run.map((fold) => fold.changeId)).toEqual(['k3'])
    expect(picked.run[0].stepId).toBe('typed')
  })

  it('names a fold once when its step is asked for as well', () => {
    const picked = pickRun([typed], ['typed', 'k2'])
    expect(picked.run.map((fold) => fold.changeId)).toEqual(['k1', 'k2', 'k3'])
    expect(picked.unknown).toEqual([])
  })
})

describe('flatten', () => {
  it('reads a step forwards in the order its folds were made', () => {
    const a = rename('billing', 'One')
    const b = rename('billing', 'Two')
    const folds: StepFold[] = [
      { changeId: 'f1', commands: [a], inverses: [rename('billing', 'Billing')] },
      { changeId: 'f2', commands: [b], inverses: [a] },
    ]
    expect(flatten(folds).commands).toEqual([a, b])
    // Undo order: the newest fold's inverse first, so the field ends up saying
    // what it said before the first keystroke.
    expect(flatten(folds).inverses).toEqual([a, rename('billing', 'Billing')])
  })
})

describe('unwind', () => {
  it('takes a run off newest first, leaving the model the run was made against', () => {
    const before = start()
    const first = step(before, 's1', rename('billing', 'Billing v2'))
    const second = step(first.model, 's2', rename('billing', 'Billing v3'))
    const back = unwind(second.model, [first.fold, second.fold])
    expect(back.ok).toBe(true)
    if (back.ok) expect(nameOf(back.model, 'billing')).toBe('Billing')
  })

  it('takes nothing off when one inverse no longer applies', () => {
    const before = start()
    const made = step(before, 's1', rename('crm', 'CRM v2'))
    // The row the inverse names is gone: another author removed it.
    const removed = applyOrThrow(made.model, { type: 'element.delete', id: 'crm' }).model
    const back = unwind(removed, [made.fold])
    expect(back.ok).toBe(false)
    if (!back.ok) expect(back.reason).toBe('command.gone')
  })
})

describe('rewind', () => {
  it('puts a run back oldest first, over what happened underneath it', () => {
    const before = start()
    const mine = step(before, 's1', rename('billing', 'Billing v2'))
    // Somebody else renamed the other row while ours was off the model.
    const theirs = applyOrThrow(before, rename('crm', 'Customers')).model
    const back = rewind(theirs, [mine.fold])
    expect(back.dropped).toEqual([])
    expect(nameOf(back.model, 'billing')).toBe('Billing v2')
    expect(nameOf(back.model, 'crm')).toBe('Customers')
  })

  it('drops the one step the reducer now refuses and keeps the rest', () => {
    const before = start()
    const doomed = step(before, 's1', rename('crm', 'CRM v2'))
    const other = step(doomed.model, 's2', rename('billing', 'Billing v2'))
    const withoutCrm = applyOrThrow(before, { type: 'element.delete', id: 'crm' }).model
    const back = rewind(withoutCrm, [doomed.fold, other.fold])
    expect(back.dropped).toEqual([{ changeId: 's1-1', reason: 'command.gone' }])
    expect(back.kept.map((fold) => fold.changeId)).toEqual(['s2-1'])
    expect(nameOf(back.model, 'billing')).toBe('Billing v2')
  })

  it('recomputes the inverse of a step it put back, against the model it now undoes', () => {
    const before = start()
    const mine = step(before, 's1', rename('billing', 'Billing v2'))
    const theirs = applyOrThrow(before, rename('billing', 'Invoicing')).model
    const back = rewind(theirs, [mine.fold])
    const undone = unwind(back.model, back.kept)
    expect(undone.ok).toBe(true)
    // Not 'Billing', which is what the original inverse would have given back.
    if (undone.ok) expect(nameOf(undone.model, 'billing')).toBe('Invoicing')
  })
})

describe('newestOwn', () => {
  it('steps over another author’s step and keeps walking', () => {
    expect(newestOwn([{}, { origin: 'remote' }, {}, { origin: 'remote' }])).toBe(2)
  })

  it('answers -1 when every step on the stack is somebody else’s', () => {
    expect(newestOwn([{ origin: 'remote' }, { origin: 'remote' }])).toBe(-1)
    expect(newestOwn([])).toBe(-1)
  })
})

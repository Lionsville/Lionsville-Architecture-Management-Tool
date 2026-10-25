// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A building block's requirements and a scope's evaluation of it (ADR-0043
 * §2–§5): what holds together, what a scope needs, and the fit, worked out
 * openly.
 */
import { describe, expect, it } from 'vitest'
import { blockRefusal, nextLevel, withChapters, withoutCapability } from './buildingBlock'
import {
  blockOfEvaluationId, choicesAccepted, drivenBy, evaluationId, evaluationRefusal, fitOf, needsOf, percent, ranking, startedEvaluation,
} from './evaluation'
import type { Evaluation } from './evaluation'
import { apply } from './reducer'
import { fromArrays, evaluationsOf } from './normalised'
import type { DesignElement } from './types'

/** A message gateway: three capabilities, two uses, three solutions. */
const GATEWAY: DesignElement = {
  id: 'blk-gw', kind: 'buildingBlock', name: 'Message gateway', lifecycle: 'live', isManaged: false, aspects: {},
  capabilities: [
    { id: 'cap-route', text: 'Routes by content' },
    { id: 'cap-audit', text: 'Keeps an audit trail', must: true },
    { id: 'cap-retry', text: 'Retries what failed' },
  ],
  contexts: [
    { id: 'cx-partners', name: 'Many partners, high volume', needs: { 'cap-route': 4, 'cap-retry': 3 } },
    { id: 'cx-filings', name: 'Regulatory filings', needs: { 'cap-audit': 4, 'cap-route': 1 } },
  ],
  sbbs: [
    { id: 'sb-a', name: 'Broker A', sort: 'product', status: 'candidate' },
    { id: 'sb-b', name: 'Managed bus', sort: 'service', status: 'evaluated' },
    { id: 'sb-c', name: 'Our own', sort: 'inHouse', status: 'retired' },
  ],
}

const HERE: Evaluation = {
  id: evaluationId({ scope: 'topics/integration', id: 'blk-gw' }), block: { scope: 'topics/integration', id: 'blk-gw' },
  contexts: ['cx-partners', 'cx-filings'], options: ['sb-a', 'sb-b'],
  coverage: {
    'sb-a': { 'cap-route': { level: 4 }, 'cap-audit': { level: 3, how: 'Logs, not signed' }, 'cap-retry': { level: 2 } },
    'sb-b': { 'cap-route': { level: 2 }, 'cap-audit': { level: 4 }, 'cap-retry': { level: 3 } },
  },
}

describe('a building block', () => {
  it('holds together: ids once each, names, needs of its own capabilities at a level, solutions of a sort', () => {
    expect(blockRefusal(GATEWAY)).toBeUndefined()
    expect(blockRefusal({ ...GATEWAY, capabilities: [...GATEWAY.capabilities!, { id: 'cap-route', text: 'Again' }] })).toBe('command.badBlock')
    expect(blockRefusal({ ...GATEWAY, contexts: [{ id: 'cx', name: 'Use', needs: { 'cap-gone': 2 } }] })).toBe('command.badBlock')
    expect(blockRefusal({ ...GATEWAY, contexts: [{ id: 'cx', name: 'Use', needs: { 'cap-route': 5 as never } }] })).toBe('command.badBlock')
    expect(blockRefusal({ ...GATEWAY, sbbs: [{ id: 'sb', name: ' ', sort: 'product', status: 'candidate' }] })).toBe('command.badBlock')
    // Only a building block carries them; any other element with none is fine.
    expect(blockRefusal({ kind: 'application', capabilities: [] })).toBe('command.badBlock')
    expect(blockRefusal({ kind: 'application' })).toBeUndefined()
  })

  it('writes a chapter for each usage context that has none, and leaves one that has', () => {
    expect(withChapters('', [{ name: 'Regulatory filings', description: 'Once a quarter.' }])).toBe('## Regulatory filings\n\nOnce a quarter.\n')
    const written = withChapters('What it is.\n', [{ name: 'Regulatory filings' }, { name: 'Partners' }])
    expect(written).toBe('What it is.\n\n## Regulatory filings\n\n## Partners\n')
    expect(withChapters(written, [{ name: 'Partners' }])).toBe(written)
  })

  it('moves a ball a quarter at a time, round from full to empty, and takes a capability out of every need', () => {
    expect([nextLevel(0), nextLevel(4), nextLevel(0, -1)]).toEqual([1, 0, 4])
    expect(withoutCapability(GATEWAY.contexts!, 'cap-route').map((one) => one.needs)).toEqual([{ 'cap-retry': 3 }, { 'cap-audit': 4 }])
  })
})

describe('a scope\'s evaluation', () => {
  it('is named by its block, the organisation as - and a path\'s slashes as dots, and read back', () => {
    expect(evaluationId({ scope: '', id: 'blk-1' })).toBe('-~blk-1')
    expect(HERE.id).toBe('topics.integration~blk-gw')
    expect(blockOfEvaluationId(HERE.id)).toEqual(HERE.block)
    expect(blockOfEvaluationId('-~blk-1')).toEqual({ scope: '', id: 'blk-1' })
    expect(blockOfEvaluationId('nothing')).toBeUndefined()
  })

  it('holds together: named by its block, balls on the levels, a choice among its options', () => {
    expect(evaluationRefusal(HERE)).toBeUndefined()
    expect(evaluationRefusal({ ...HERE, id: 'other~blk-gw' })).toBe('command.badEvaluation')
    expect(evaluationRefusal({ ...HERE, chosen: 'sb-c' })).toBe('command.badEvaluation')
    expect(evaluationRefusal({ ...HERE, coverage: { 'sb-a': { 'cap-route': { level: 7 as never } } } })).toBe('command.badEvaluation')
  })

  it('needs of each capability the most any of its contexts needs, and says which contexts drive it', () => {
    expect(needsOf(GATEWAY, HERE.contexts)).toEqual({ 'cap-route': 4, 'cap-retry': 3, 'cap-audit': 4 })
    expect(needsOf(GATEWAY, ['cx-filings'])).toEqual({ 'cap-audit': 4, 'cap-route': 1 })
    expect(drivenBy(GATEWAY, HERE.contexts, 'cap-route')).toEqual(['Many partners, high volume'])
    expect(drivenBy(GATEWAY, ['cx-partners'], 'cap-audit')).toEqual([])
  })

  it('fits each option as Σ min(coverage, need) ÷ Σ need, and fails a must not covered fully', () => {
    const a = fitOf(GATEWAY, HERE, 'sb-a')
    // route 4/4, audit 3/4, retry 2/3: 9 of 11.
    expect([a.covered, a.needed, percent(a.fit!), a.failsMust]).toEqual([9, 11, 82, ['cap-audit']])
    const b = fitOf(GATEWAY, HERE, 'sb-b')
    expect([b.covered, b.needed, percent(b.fit!), b.failsMust]).toEqual([9, 11, 82, []])
    // Coverage past the need counts as the need.
    expect(fitOf(GATEWAY, { contexts: ['cx-filings'], coverage: HERE.coverage }, 'sb-a').terms.find((one) => one.capability === 'cap-route'))
      .toEqual({ capability: 'cap-route', need: 1, coverage: 4, counted: 1 })
    // Nothing needed, no fit.
    expect(fitOf(GATEWAY, { contexts: [], coverage: {} }, 'sb-a').fit).toBeUndefined()
  })

  it('ranks the options a failed must last, then by fit, leaving out one the block no longer lists', () => {
    expect(ranking(GATEWAY, HERE).map((one) => one.sbb.id)).toEqual(['sb-b', 'sb-a'])
    expect(ranking(GATEWAY, { ...HERE, options: ['sb-gone', 'sb-a'] }).map((one) => one.sbb.id)).toEqual(['sb-a'])
  })

  it('starts as its own, copying another scope\'s options and balls where asked, never its choice', () => {
    const copied = startedEvaluation({ scope: 'topics/integration', id: 'blk-gw' }, ['cx-filings'], { ...HERE, chosen: 'sb-b', decidedBy: 'adr-1' })
    expect(copied).toEqual({ id: HERE.id, block: HERE.block, contexts: ['cx-filings'], options: ['sb-a', 'sb-b'], coverage: HERE.coverage })
    expect(copied.coverage).not.toBe(HERE.coverage)
    expect(startedEvaluation({ scope: '', id: 'blk-gw' }, [])).toEqual({ id: '-~blk-gw', block: { scope: '', id: 'blk-gw' }, contexts: [], options: [], coverage: {} })
  })
})

describe('the steps', () => {
  const model = () => fromArrays({ name: 'Integration', elements: [GATEWAY], relations: [], diagrams: [] })

  it('refuses a building block whose fields do not hold together, made or changed', () => {
    const made = apply(fromArrays({ name: 'x', elements: [], relations: [], diagrams: [] }), {
      type: 'element.create', element: { ...GATEWAY, contexts: [{ id: 'cx', name: 'Use', needs: { nope: 1 } }] },
    })
    expect(made).toMatchObject({ ok: false, reason: 'command.badBlock' })
    expect(apply(model(), { type: 'element.update', id: 'blk-gw', patch: { kind: 'application' } })).toMatchObject({ ok: false, reason: 'command.badBlock' })
    expect(apply(model(), { type: 'element.update', id: 'blk-gw', patch: { sbbs: [] } }).ok).toBe(true)
  })

  it('starts an evaluation once per block, refuses one that does not hold together, and undoes each', () => {
    const started = apply(model(), { type: 'evaluation.add', evaluation: HERE })
    expect(started.ok && evaluationsOf(started.model)[HERE.id]).toEqual(HERE)
    if (!started.ok) return
    expect(apply(started.model, { type: 'evaluation.add', evaluation: HERE })).toMatchObject({ ok: false, reason: 'command.taken' })
    expect(apply(started.model, { type: 'evaluation.update', id: HERE.id, patch: { chosen: 'sb-c' } })).toMatchObject({ ok: false, reason: 'command.badEvaluation' })
    const chose = apply(started.model, { type: 'evaluation.update', id: HERE.id, patch: { chosen: 'sb-b', decidedBy: 'adr-1' } })
    expect(chose.ok && evaluationsOf(chose.model)[HERE.id]?.chosen).toBe('sb-b')
    if (!chose.ok) return
    const undone = apply(chose.model, chose.inverse)
    expect(undone.ok && evaluationsOf(undone.model)[HERE.id]?.chosen).toBeUndefined()
    const removed = apply(started.model, { type: 'evaluation.remove', id: HERE.id })
    expect(removed.ok && evaluationsOf(removed.model)).toEqual({})
  })

  it('writes the choice of a decision accepted now that chooses in an evaluation here, and nothing else', () => {
    const proposed = { id: 'adr-7', number: 7, title: 'Choose the gateway', status: 'proposed' as const, date: '2026-10-25', body: '', signers: [], chooses: { evaluation: HERE.id, option: 'sb-b' } }
    const accepted = { ...proposed, status: 'accepted' as const }
    const held = { [HERE.id]: HERE }
    expect(choicesAccepted(held, [proposed], [accepted])).toEqual([{ type: 'evaluation.update', id: HERE.id, patch: { chosen: 'sb-b', decidedBy: 'adr-7' } }])
    // Accepted already, not this step's; a choice it does not weigh, or an evaluation not here, writes nothing.
    expect(choicesAccepted(held, [accepted], [accepted])).toEqual([])
    expect(choicesAccepted(held, [proposed], [{ ...accepted, chooses: { evaluation: HERE.id, option: 'sb-c' } }])).toEqual([])
    expect(choicesAccepted({}, [proposed], [accepted])).toEqual([])
  })
})

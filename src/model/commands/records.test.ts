// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What the one writer does with a decision record's and a plan's moves
 * (ADR-0008 and ADR-0009, amended 28 September 2026): nothing but write them.
 * The locks and gates are the page's and the agent's to ask. A log of steps
 * replayed through `applyGuarded` has to arrive where it arrived, and a step
 * written before a rule existed is still a step.
 */
import { describe, expect, it } from 'vitest'
import type { Adr } from '../adr'
import type { Command } from '../commands'
import { fromArrays } from '../normalised'
import type { Model } from '../normalised'
import { applyGuarded } from '../reducer'
import type { Transition } from '../transition'
import { element } from '../testFixtures'

const record = (over: Partial<Adr>): Adr => ({
  id: 'adr-1', number: 1, title: 'Use one queue', status: 'proposed', date: '2026-09-01', body: '', signers: [], ...over,
})

const plan = (over: Partial<Transition> = {}): Transition => ({
  id: 'tr-1', number: 1, title: 'Move the ledger', status: 'draft',
  from: '2027-01-01', to: '2027-06-30', owner: 'Finance IT',
  elements: [{ elementId: 'ledger', role: 'changes' }], decisions: ['adr-2'], milestones: [], body: '',
  ...over,
})

function scope(decisions: Adr[], transitions: Transition[] = []): Model {
  return fromArrays({
    name: 'Finance', elements: [element('ledger', { name: 'Ledger' })], relations: [], diagrams: [], decisions, transitions,
  })
}

describe('a decision record, at the writer', () => {
  it('replays a change to an accepted record and a move no gate would allow today', () => {
    const held = scope([record({ status: 'accepted' }), record({ id: 'adr-2', number: 2 })])
    const rewrite: Command = { type: 'decision.update', id: 'adr-1', patch: { title: 'Use two queues' } }
    expect(applyGuarded(held, rewrite).ok).toBe(true)
    // Accepted with nobody approving, as a record could be before the gate.
    const accept: Command = { type: 'decision.update', id: 'adr-2', patch: { status: 'accepted' } }
    expect(applyGuarded(held, accept).ok).toBe(true)
  })

  it('carries the fields a supersession and a withdrawal write', () => {
    const held = scope([record({})])
    const patch = { supersedes: ['adr-0'], proposedBy: 'Kim', reason: 'Not now.', status: 'rejected' as const }
    const result = applyGuarded(held, { type: 'decision.update', id: 'adr-1', patch })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.model.decisions?.['adr-1']).toMatchObject(patch)
  })
})

describe('a plan, at the writer', () => {
  it('replays an agreement to a plan resting on a proposal, and carries the done day', () => {
    const held = scope([record({ id: 'adr-2' })], [plan()])
    expect(applyGuarded(held, { type: 'transition.update', id: 'tr-1', patch: { status: 'agreed' } }).ok).toBe(true)
    const done = applyGuarded(held, { type: 'transition.update', id: 'tr-1', patch: { status: 'done', doneOn: '2027-06-30' } })
    expect(done.ok).toBe(true)
    if (!done.ok) return
    expect(done.model.transitions?.['tr-1']?.doneOn).toBe('2027-06-30')
  })
})

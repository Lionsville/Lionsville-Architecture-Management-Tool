// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** A whole agent session as one thing to take back (ADR-0019, amended). */
import { describe, expect, it } from 'vitest'
import type { Command } from '../model/commands'
import { agentRun, putBackRun, runInverses } from './agentRun'

const inverse = (id: string): Command => ({ type: 'element.delete', id })

type Step = {
  stepId: string; at: number; inverses: Command[]
  origin?: string; by?: string; via?: string; barrier?: string
}

function step(id: string, at: number, over: Partial<Step> = {}): Step {
  return { stepId: id, inverses: [inverse(id)], at, ...over }
}
const agent = (id: string, at: number, over: Partial<Step> = {}) => step(id, at, { origin: 'agent', ...over })
const ids = (run: { steps: readonly Step[] }) => run.steps.map((one) => one.stepId)

describe('the run', () => {
  it('is the session\'s steps at the top of the history, newest first', () => {
    expect(ids(agentRun([step('mine', 1), agent('a', 2), agent('b', 3)]))).toEqual(['b', 'a'])
  })

  it('is nothing the moment anybody else\'s step is on top: a person\'s, or a colleague\'s', () => {
    expect(ids(agentRun([agent('a', 2), step('mine', 3)]))).toEqual([])
    expect(ids(agentRun([agent('a', 2), step('theirs', 3, { origin: 'remote', by: 'A. Author' })]))).toEqual([])
    expect(ids(agentRun([]))).toEqual([])
  })

  it('stops at the session\'s start, so an earlier session\'s steps are not swept up', () => {
    expect(ids(agentRun([agent('old', 1), agent('a', 5), agent('b', 6)], { since: 5 }))).toEqual(['b', 'a'])
  })

  it('stops at a two-scope gesture, and says so', () => {
    const run = agentRun([agent('a', 1), agent('both', 2, { barrier: 'shell.scopeMoved' }), agent('b', 3)])
    expect(ids(run)).toEqual(['b'])
    expect(run.barrier).toBe('shell.scopeMoved')
    expect(ids(agentRun([agent('both', 2, { barrier: 'shell.scopeMoved' })]))).toEqual([])
  })

  it('on a server, is the steps that arrived under that author and client', () => {
    const remote = (id: string, at: number, by: string, via: string) => step(id, at, { origin: 'remote', by, via })
    const history = [remote('a', 1, 'Ada', 'Claude'), remote('b', 2, 'Ada', 'Claude')]
    expect(ids(agentRun(history, { remote: { by: 'Ada', via: 'Claude' } }))).toEqual(['b', 'a'])
    expect(ids(agentRun(history, { remote: { by: 'Bram', via: 'Claude' } }))).toEqual([])
    expect(ids(agentRun([...history, remote('c', 3, 'Ada', 'Browser')], { remote: { by: 'Ada', via: 'Claude' } }))).toEqual([])
  })
})

describe('Put back', () => {
  it('is one new step that applies every inverse, newest first, and says whose work it put back', () => {
    const run = agentRun([agent('a', 1), agent('b', 2)])
    expect(runInverses(run)).toEqual([inverse('b'), inverse('a')])
    expect(putBackRun(run, 'Claude', '2026-11-07')).toEqual({
      type: 'restore',
      restored: { what: 'agentSession', name: 'Claude', asOf: '2026-11-07' },
      commands: [inverse('b'), inverse('a')],
    })
  })
})

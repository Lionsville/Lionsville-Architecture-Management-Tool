// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A scope's Activity follows its identity through a move, and says the move
 * (`HistoryEntry.moved`): read off the history where a history is kept, and
 * off the source's own log where that says moves itself.
 */
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, screen } from '@testing-library/react'
import { installReactFlowMocks } from '../editor/reactFlowTestSetup'
import { memoryRepositories } from '../adapters/memory/memoryRepositories'
import { addCrews, step } from '../ports/Repositories.contract'
import type { HistoryEntry } from '../ports/HistoryRepository'
import type { SourceActivityLine } from '../platform/sourceProvider'
import { placeWhole, readScope } from '../projects/scopeAccess'
import { emptyContent } from '../projects/scopeState'
import { scopeActivity } from './activityMoves'
import { renderApp } from './testing/renderShell'

afterEach(() => cleanup())
beforeAll(() => installReactFlowMocks())

const entry = (over: Partial<HistoryEntry>): HistoryEntry => ({ id: '1', scope: 'rail', at: 10, by: 'Ada', labels: [], ...over })
const history = (entries: HistoryEntry[]) => ({ entries: () => Promise.resolve({ entries }) })

describe('what the list asks of a scope', () => {
  it('is the moves its history holds, by its identity, where the source keeps no log', async () => {
    const asked = scopeActivity('rail', undefined, history([
      entry({ id: '2', at: 20, moved: { from: 'acme/rail', to: 'globex/rail' } }), entry({ subject: 'Snapshot' }),
    ]))
    expect(await asked?.()).toEqual([{ summary: { key: 'activity.scopeMoved', from: 'acme/rail', to: 'globex/rail' }, at: 20, by: 'Ada' }])
  })

  it('is nothing to add where the history holds no move, and nothing to ask where there is no scope', async () => {
    expect(await scopeActivity('rail', undefined, history([entry({})]))?.()).toBeUndefined()
    expect(scopeActivity(undefined, undefined, history([]))).toBeUndefined()
    expect(scopeActivity('rail', undefined, undefined)).toBeUndefined()
  })

  it('asks the source’s log by identity, and takes its word for the moves where it says them', async () => {
    const said: string[] = []
    const line: SourceActivityLine = { summary: { key: 'activity.scopeMoved', from: 'a', to: 'b' }, at: 5 }
    const log = (scope: string) => { said.push(scope); return Promise.resolve([line]) }
    const moved = history([entry({ moved: { from: 'a', to: 'b' } })])
    expect(await scopeActivity('rail', log, moved)?.()).toEqual([line])
    expect(said).toEqual(['rail'])
  })

  it('keeps the moves where the log could not be asked', async () => {
    const lines = await scopeActivity('rail', () => Promise.reject(new Error('gone')), history([entry({ moved: { from: 'a', to: 'b' } })]))?.()
    expect(lines?.map((one) => one.summary.key)).toEqual(['activity.scopeMoved'])
  })
})

describe('the Activity list of a scope that moved', () => {
  it('says the move, and who made it, when the scope is opened at its new address', async () => {
    const repositories = memoryRepositories()
    const rail = await placeWhole(repositories.scopes, 'acme/rail', emptyContent('Rail'))
    await repositories.scopes.apply([{ scope: rail, steps: [step(addCrews)] }])
    await repositories.history.record({ subject: 'Crews in' })
    const moved = await repositories.scopes.move(rail, 'globex/rail')
    expect('refused' in moved).toBe(false)
    renderApp({ repositories, boot: { initialProject: await readScope(repositories.scopes, 'globex/rail') } })
    await act(async () => { fireEvent.click(await screen.findByText('Activity')) })
    const lines = (await screen.findAllByTestId('activity-summary')).map((one) => one.textContent)
    expect(lines).toContain('Moved from acme/rail to globex/rail')
  })
})

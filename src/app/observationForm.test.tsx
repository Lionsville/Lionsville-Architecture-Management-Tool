// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * One submit is one step (ADR-0032 §6, ADR-0002): the observations page over
 * a real session, as the workspace wires it — the page hands its lists back
 * whole and `useAnalysisActions` makes what moved one transaction — so an
 * observation recorded with two new causes and a link is one line on the
 * stack, and one ⌘Z takes all four back.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, within } from '@testing-library/react'
import { translator } from '../i18n'
import { causeList, observationList } from '../model'
import type { HostModel } from '../model/hostModel'
import type { ScopeSnapshot } from '../projects/scope'
import { MarkdownView } from '../documentation/ui/MarkdownView'
import { ObservationsPage } from '../observations/ui/ObservationsPage'
import { renderShell } from './testing/renderShell'
import { useModelSession } from './useModelSession'
import type { ModelSession } from './useModelSession'
import { useAnalysisActions } from './useAnalysisActions'

afterEach(() => cleanup())

const s = translator('en')

const model: HostModel = {
  name: 'Warehouse', elements: [], relations: [], diagrams: [],
  observations: [{
    id: 'o1', number: 1, title: 'Stock counts differ', date: '2026-09-01', where: 'Shop', by: 'Inventory', impact: 'major',
    seen: 1, body: '', history: [{ date: '2026-09-01', kind: 'recorded' }],
  }],
  causes: [{ id: 'c1', number: 1, title: 'Scanners send their own format', state: 'assumed', body: '', explains: [] }],
}
const snapshot: ScopeSnapshot = { path: 'warehouse', model, activeDiagramId: '', logoLibrary: [] }

let held: ModelSession | undefined
let ids = 0
function Page() {
  const session = useModelSession({ initialProject: snapshot, notify: vi.fn(), s })
  const makeId = (prefix: string) => `${prefix}-${++ids}`
  const actions = useAnalysisActions({ session, makeId, today: () => '2026-09-30', s })
  held = session
  return (
    <ObservationsPage
      open onClose={() => {}} model={session.model} groupName="Acme" onChange={actions.onAnalysisChange}
      s={s} language="en" makeId={makeId} today={() => '2026-09-30'} renderMarkdown={(md) => <MarkdownView markdown={md} />}
    />
  )
}

describe('the observation form over a session', () => {
  it('records an observation with two new causes and one link as one undo step', () => {
    renderShell(<Page />)
    fireEvent.click(screen.getByRole('button', { name: '+ New observation' }))
    fireEvent.change(screen.getByTestId('form-title'), { target: { value: 'Pick lists print twice' } })
    fireEvent.change(screen.getByTestId('form-where'), { target: { value: 'Pick station 3' } })
    fireEvent.change(screen.getByTestId('form-by'), { target: { value: 'Shift lead' } })
    for (const title of ['The WMS re-sends a split list', 'Splits are not modelled']) {
      fireEvent.click(screen.getByTestId('form-new-cause'))
      fireEvent.change(screen.getByTestId('cause-draft-title'), { target: { value: title } })
      fireEvent.click(screen.getByTestId('form-cause-add'))
    }
    fireEvent.click(screen.getByTestId('form-existing-cause'))
    fireEvent.click(within(screen.getByTestId('cause-picker')).getByRole('button', { name: 'Add CA-0001 Scanners send their own format' }))
    fireEvent.click(screen.getByRole('button', { name: 'Record observation with 2 new causes and 1 link' }))

    const session = held!
    const indexed = session.indexed()
    expect(observationList(indexed).map((one) => one.title)).toEqual(['Stock counts differ', 'Pick lists print twice'])
    expect(causeList(indexed).map((one) => [one.title, one.explains.length])).toEqual([
      ['Scanners send their own format', 1], ['The WMS re-sends a split list', 1], ['Splits are not modelled', 1],
    ])
    expect(session.history()).toHaveLength(1)
    act(() => session.undo())
    expect(observationList(session.indexed())).toEqual(model.observations)
    expect(causeList(session.indexed())).toEqual(model.causes)
  })
})

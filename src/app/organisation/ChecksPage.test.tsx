// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The Checks page (3.6.1, scene 9): every check by category with its weight
 * and how many are found, the notes hidden until shown; a check picked says
 * why it matters and how to fix it, lists every instance in its scope, each
 * opening where it is fixed and markable where it may be, and what was marked
 * as intended with *Take back* — a fix says it cannot be marked, and a check
 * only an open scope works out says so rather than a count.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { translator } from '../../i18n'
import type { HostModel } from '../../model/hostModel'
import type { KeptCheckMark } from '../../model/checkMarks'
import { indexScopes } from '../../projects/scopeIndex'
import { NO_WINDOW_CHROME } from '../../platform/windowChrome'
import { axeFindings } from '../testing/axe'
import { renderShell } from '../testing/renderShell'
import { CheckMarkingContext } from '../checkMarking'
import type { CheckMarking } from '../checkMarking'
import type { AttentionItem } from './attention'
import { ChecksPage } from './ChecksPage'
import type { ChecksPageProps } from './ChecksPage'
import { checksByCategory, splitInstances, treeInstances } from './treeChecks'

afterEach(() => cleanup())

const t = translator('en')
const ROOT: HostModel = {
  name: 'Acme Logistics',
  elements: [
    { id: 'ops', kind: 'actor', name: 'Operations', unitTypeId: 'ut-team', lifecycle: 'live', isManaged: false, aspects: {} },
    { id: 'sales', kind: 'actor', name: 'Sales', unitTypeId: 'ut-team', lifecycle: 'live', isManaged: false, aspects: {} },
  ],
  relations: [{ id: 'i-1', type: 'interacts', sourceId: 'ops', targetId: 'sales', mode: 'service' }],
  diagrams: [],
  unitTypes: [{ id: 'ut-team', name: 'Team', top: true, within: [], slots: [] }],
}
const index = indexScopes([{ path: '', model: ROOT }])
const ATTENTION: AttentionItem[] = [
  { key: 'check.unattributed', kind: 'unattributed', scope: 'retail', id: 'post', text: 'Post office is outside the organisation and nobody has said whose it is' },
  { key: 'check.conflict', kind: 'conflict', scope: 'retail', id: 'erp', text: 'ERP is defined both here and in Finance' },
]
const instances = treeInstances({ attention: ATTENTION, models: [], at: '', today: '2026-10-12', index, home: ROOT, t })

function page(over: Partial<ChecksPageProps> = {}, marks: KeptCheckMark[] = [], marking?: Partial<CheckMarking>) {
  const split = splitInstances(instances, marks)
  const counts = { fix: 1, review: split.shown.filter((one) => one.key === 'check.unattributed').length, note: split.shown.filter((one) => one.key === 'check.interactionUnused').length }
  const props: ChecksPageProps = {
    open: true, onClose: vi.fn(), rows: checksByCategory(split), counts, remember: 'checks\u0000', scopeName: (path) => (path === '' ? 'the organisation' : 'Retail'),
    onGo: vi.fn(), s: t, windowChrome: NO_WINDOW_CHROME, ...over,
  }
  const handed: CheckMarking = {
    marks, markableIn: (finding) => ('scope' in finding ? finding.scope : ''), mark: vi.fn(), mayTakeBack: () => true, takeBack: vi.fn(),
    mayChange: () => true, removeAssignment: vi.fn(), ...marking,
  }
  renderShell(<CheckMarkingContext.Provider value={handed}><ChecksPage {...props} /></CheckMarkingContext.Provider>)
  return { props, marking: handed }
}

const row = (key: string) => screen.queryByTestId(`checks-row-${key}`)

describe('the Checks page', () => {
  it('lists every check by category with its count, the notes hidden until shown, and opens on the first with anything found', async () => {
    page()
    expect(screen.getByTestId('checks-counts').textContent).toBe('1 to fix · 1 to review · 1 note')
    expect(screen.getAllByRole('heading', { level: 2 }).map((one) => one.textContent).slice(0, 4))
      .toEqual(['The landscape', 'Plans and dates', 'The organisation', 'Teams and systems'])
    expect(row('check.conflict')!.textContent).toMatch(/Two scopes define the same thing1$/)
    expect(row('check.drift')!.textContent).toMatch(/0$/)
    expect(row('check.interactionUnused')).toBeNull()
    // The first check with anything found, in the page's order.
    expect(screen.getByTestId('checks-detail').dataset.check).toBe('check.conflict')
    expect(row('check.conflict')!.getAttribute('aria-pressed')).toBe('true')
    expect(await axeFindings()).toEqual([])
    fireEvent.click(screen.getByTestId('checks-weight-note'))
    expect(row('check.interactionUnused')).not.toBeNull()
  })

  it('says of a check picked why it matters, how to fix it, and each instance in its scope, opening where it is fixed', () => {
    const { props } = page()
    fireEvent.click(row('check.unattributed')!)
    const detail = screen.getByTestId('checks-detail')
    expect(within(detail).getByTestId('checks-name').textContent).toBe('An outside application with no party')
    expect(within(detail).getByTestId('checks-why').textContent).not.toBe('')
    expect(within(detail).getByTestId('checks-how').textContent).not.toBe('')
    expect(within(detail).getByRole('heading', { name: 'Found (1)' })).toBeTruthy()
    expect(detail.textContent).toContain('in Retail')
    const instance = within(detail).getByTestId('attention-retail-post')
    expect(instance.dataset.finding).toBe('unattributed')
    fireEvent.click(instance)
    expect(props.onGo).toHaveBeenCalledWith({ scope: 'retail', page: { page: 'element', id: 'post' } })
  })

  it('marks an instance of a review or a note as intended where it may, and says a fix cannot be', () => {
    const { marking } = page()
    expect(within(screen.getByTestId('checks-detail')).getByTestId('checks-never').textContent).toContain('A fix cannot be marked as intended')
    expect(within(screen.getByTestId('checks-detail')).queryByTestId('finding-mark')).toBeNull()
    fireEvent.click(row('check.unattributed')!)
    fireEvent.click(within(screen.getByTestId('checks-detail')).getByTestId('finding-mark'))
    fireEvent.change(screen.getByTestId('finding-mark-reason'), { target: { value: 'A supplier of ours' } })
    fireEvent.click(screen.getByTestId('finding-mark-confirm'))
    expect(marking.mark).toHaveBeenCalledWith(ATTENTION[0], 'A supplier of ours', undefined)
  })

  it('lists what was marked as intended under the check, with Take back', () => {
    const mark = { check: 'check.interactionUnused' as const, key: 'i-1 ops sales', on: '2026-10-02', reason: 'They design the API together' }
    const { marking } = page({}, [{ scope: '', mark }])
    fireEvent.click(screen.getByTestId('checks-weight-note'))
    fireEvent.click(row('check.interactionUnused')!)
    const detail = screen.getByTestId('checks-detail')
    expect(within(detail).getByRole('heading', { name: 'Found (0)' })).toBeTruthy()
    const accepted = within(detail).getByTestId('checks-accepted')
    expect(accepted.textContent).toContain('Operations and Sales declare As a service, and no interface runs between them. (in the organisation)')
    expect(within(accepted).getByTestId('accepted-reason').textContent).toContain('“They design the API together”')
    fireEvent.click(within(accepted).getByTestId('finding-take-back'))
    expect(marking.takeBack).toHaveBeenCalledWith({ scope: '', mark })
  })

  it('says of a check only an open scope works out where it is found, rather than a count', () => {
    page()
    expect(row('check.notDrawn')).toBeNull()
    fireEvent.click(screen.getByTestId('checks-weight-note'))
    expect(row('check.notDrawn')!.textContent).toMatch(/Not counted here$/)
    // Said to a screen reader in a box of one pixel, never one as wide as the row (the theme reads 1 as all of it).
    expect(getComputedStyle(within(row('check.notDrawn')!).getByText('Not counted here')).width).toBe('1px')
    fireEvent.click(row('check.notDrawn')!)
    expect(screen.getByTestId('checks-where-open').textContent).toContain('found where the scope is open')
  })

  it('picks the check it is asked for, showing its weight, and keeps the weights shown for the session', () => {
    page({ request: { select: 'check.interactionUnused' } })
    expect(screen.getByTestId('checks-detail').dataset.check).toBe('check.interactionUnused')
    expect(screen.getByTestId('checks-weight-note').getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByTestId('checks-weight-fix'))
    expect(row('check.conflict')).toBeNull()
    expect(screen.getByTestId('checks-weight-fix').getAttribute('aria-pressed')).toBe('false')
  })

  // A unit deleted before its assignments went with it left them naming nothing (ADR-0036, amended 12 October 2026).
  it('offers Remove the assignment on one whose unit is not there, ended or not, opening the person, where the scope may be changed', () => {
    const left: AttentionItem[] = [{
      key: 'check.assignmentOrphaned', kind: 'assignmentOrphaned', scope: 'retail', id: 'as-1', person: 'pe-ada', fields: ['as-1'],
      text: 'Ada still holds Team lead in a unit that is not there',
    }]
    const rows = checksByCategory(splitInstances(treeInstances({ attention: left, models: [], at: '', today: '2026-10-12', index, home: ROOT, t }), []))
    const { props, marking } = page({ rows, request: { select: 'check.assignmentOrphaned' } })
    const detail = screen.getByTestId('checks-detail')
    expect(within(detail).getByTestId('checks-name').textContent).toBe('An assignment in a unit that is not there')
    fireEvent.click(within(detail).getByTestId('checks-remove-assignment'))
    expect(marking.removeAssignment).toHaveBeenCalledWith('retail', 'as-1')
    fireEvent.click(within(detail).getByTestId('attention-retail-as-1'))
    expect(props.onGo).toHaveBeenCalledWith({ person: 'pe-ada' })
    cleanup()
    page({ rows, request: { select: 'check.assignmentOrphaned' } }, [], { mayChange: () => false })
    expect(screen.queryByTestId('checks-remove-assignment')).toBeNull()
  })

  it('closes from its bar', () => {
    const { props } = page()
    fireEvent.click(within(screen.getByTestId('checks-topbar')).getAllByRole('button', { name: 'Close' })[0]!)
    expect(props.onClose).toHaveBeenCalledOnce()
  })
})

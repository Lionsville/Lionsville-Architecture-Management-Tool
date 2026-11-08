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
import { CHECK_CATALOGUE } from '../../model/checkCatalogue'
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
    index, today: '2026-10-12', onGo: vi.fn(), s: t, windowChrome: NO_WINDOW_CHROME, ...over,
  }
  const handed: CheckMarking = {
    marks, markableIn: (finding) => ('scope' in finding ? finding.scope : ''), mark: vi.fn(), mayTakeBack: () => true, takeBack: vi.fn(),
    mayChange: () => true, removeAssignment: vi.fn(), markAll: vi.fn(() => Promise.resolve([])), takeBackAll: vi.fn(() => Promise.resolve()), write: vi.fn(() => Promise.resolve(true)), ...marking,
  }
  renderShell(<CheckMarkingContext.Provider value={handed}><ChecksPage {...props} /></CheckMarkingContext.Provider>)
  return { props, marking: handed }
}

const listRow = (name: string | RegExp) => screen.queryByRole('row', { name })
const detail = () => screen.getByTestId('checks-detail')
const instanceRow = (name: string | RegExp) => within(screen.getByTestId('checks-instances')).getByRole('row', { name })

describe('the Checks page', () => {
  it('is a work list: what was found first, a fix before a review, opening on the first fix, and the notes folded', async () => {
    page()
    expect(screen.getByTestId('checks-counts').textContent).toBe('1 to fix. 1 to review. 1 note.')
    const heads = screen.getAllByRole('row').filter((one) => one.getAttribute('aria-expanded') !== null).map((one) => one.textContent)
    expect(heads[0]).toContain('To fix')
    expect(heads[1]).toContain('To review')
    expect(heads[2]).toContain('Notes')
    expect(heads[3]).toContain('Checks that found nothing')
    expect(heads[4]).toContain('Count only where the scope is open')
    expect(detail().dataset.check).toBe('check.conflict')
    // Folded: none of what is under Notes or Found nothing is on the screen.
    expect(listRow(/Interaction not used/)).toBeNull()
    expect(await axeFindings()).toEqual([])
    fireEvent.click(screen.getAllByRole('row').find((one) => one.textContent?.includes('Notes'))!)
    expect(listRow(/Interaction not used/)).not.toBeNull()
  })

  it('wraps the name of a check in its narrow list rather than clipping it', () => {
    page()
    expect(document.querySelector('[data-guide="checks.row"]')?.closest('.kit-list')?.hasAttribute('data-wrap')).toBe(true)
  })

  it('lists every check by category, the ones that found nothing too, when asked to group so', () => {
    page()
    fireEvent.click(screen.getByRole('button', { name: /Group: Weight/ }))
    fireEvent.click(screen.getByRole('radio', { name: 'Category' }))
    // The menu stays up over the list, so what is under it is asked for as hidden.
    const heads = screen.getAllByRole('row', { hidden: true }).filter((one) => one.getAttribute('aria-expanded') !== null).map((one) => one.textContent)
    expect(heads.slice(0, 4).map((one) => one?.split(' · ')[0])).toEqual(['The landscape', 'Plans and dates', 'The organisation', 'Teams and systems'])
    expect(screen.getByTestId('checks-row-check.conflict').textContent).toMatch(/1$/)
    expect(screen.getByTestId('checks-row-check.drift').textContent).toMatch(/0$/)
  })

  it('says of a check picked why it matters and how to fix it, and each finding by its subject, with the way to where it is fixed', () => {
    const { props } = page()
    fireEvent.click(listRow(/An outside application with no party/)!)
    expect(within(detail()).getByRole('heading', { name: 'An outside application with no party' })).toBeTruthy()
    expect(within(detail()).getByTestId('checks-why').textContent).not.toBe('')
    expect(within(detail()).getByTestId('checks-how').textContent).not.toBe('')
    expect(within(detail()).getByRole('tab', { name: /Found/ }).textContent).toContain('1')
    const row = instanceRow(/Post office is outside/)
    expect(row.textContent).toContain('Retail')
    fireEvent.click(row)
    fireEvent.click(within(screen.getByTestId('checks-row-actions')).getByRole('button', { name: /Open/ }))
    expect(props.onGo).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'retail' }),
      expect.objectContaining({ key: 'check.unattributed' }),
      expect.objectContaining({ id: 'check.unattributed|retail|post' }),
    )
  })

  it('marks ticked findings with one reason and stays on the check, offering Put back; a fix has no box', async () => {
    const made = [{ scope: 'retail', mark: { check: 'check.unattributed' as const, key: 'post', on: '2026-10-12' } }]
    const { marking } = page({}, [], { markAll: vi.fn(() => Promise.resolve(made)) })
    expect(within(detail()).getByTestId('checks-never').textContent).toContain('A fix cannot be marked as intended')
    expect(within(screen.getByTestId('checks-instances')).queryByRole('checkbox')).toBeNull()
    fireEvent.click(listRow(/An outside application with no party/)!)
    fireEvent.click(within(screen.getByTestId('checks-instances')).getByRole('checkbox', { name: /Post office/ }))
    fireEvent.change(within(screen.getByTestId('checks-mark-form')).getByRole('textbox'), { target: { value: 'A supplier of ours' } })
    fireEvent.click(screen.getByTestId('checks-mark'))
    expect(marking.markAll).toHaveBeenCalledWith([{ finding: ATTENTION[0], checkedIn: undefined }], 'A supplier of ours')
    fireEvent.click(await screen.findByRole('button', { name: /Put back/ }))
    expect(marking.takeBackAll).toHaveBeenCalledWith(made)
    expect(detail().dataset.check).toBe('check.unattributed')
  })

  it('offers no box and no mark to a reader', () => {
    page({}, [], { markableIn: () => undefined, mayChange: () => false, mayTakeBack: () => false })
    fireEvent.click(listRow(/An outside application with no party/)!)
    expect(within(screen.getByTestId('checks-instances')).queryByRole('checkbox')).toBeNull()
    fireEvent.click(instanceRow(/Post office is outside/))
    expect(within(screen.getByTestId('checks-row-actions')).queryByRole('button', { name: /intended/ })).toBeNull()
  })

  it('lists what was marked under Accepted, with Take back', () => {
    const mark = { check: 'check.interactionUnused' as const, key: 'i-1 ops sales', on: '2026-10-02', reason: 'They design the API together' }
    const { marking } = page({ request: { select: 'check.interactionUnused' } }, [{ scope: '', mark }])
    fireEvent.click(within(detail()).getByRole('tab', { name: /Accepted/ }))
    const accepted = within(detail()).getByTestId('checks-accepted')
    expect(within(accepted).getByTestId('accepted-reason').textContent).toContain('“They design the API together”')
    // The sentence and Take back come with the line pressed, as on Found.
    fireEvent.click(within(accepted).getAllByRole('row')[1] as HTMLElement)
    expect(accepted.textContent).toContain('Operations and Sales declare As a service, and no interface runs between them.')
    fireEvent.click(within(accepted).getByTestId('finding-take-back'))
    expect(marking.takeBack).toHaveBeenCalledWith({ scope: '', mark })
  })

  it('keeps what was accepted in sight: the head counts it, its check is listed under Accepted as intended, and a press opens it there', () => {
    const mark = { check: 'check.interactionUnused' as const, key: 'i-1 ops sales', on: '2026-10-02', reason: 'They design the API together' }
    page({}, [{ scope: '', mark }])
    // Not among the checks that found nothing, which would say 0 of it.
    const heads = screen.getAllByRole('row').filter((one) => one.getAttribute('aria-expanded') !== null).map((one) => one.textContent)
    expect(heads.some((one) => one?.includes('Accepted as intended'))).toBe(true)
    expect(listRow(/Interaction not used by any interface/)?.textContent).toContain('1 accepted')
    fireEvent.click(screen.getByTestId('checks-accepted-count'))
    expect(screen.getByTestId('checks-accepted-count').textContent).toBe('1 accepted as intended')
    expect(detail().dataset.check).toBe('check.interactionUnused')
    expect(within(detail()).getByTestId('accepted-reason').textContent).toContain('They design the API together')
  })

  it('says of a check only an open scope works out where it is found, in words and with a way there, and no count', () => {
    const onOpenScope = vi.fn()
    page({ request: { select: 'check.notDrawn' }, onOpenScope })
    expect(screen.getByTestId('checks-where-open').textContent).toContain('found where the scope is open')
    // Under its own heading, which says it once; and Found says no number it does not have.
    expect(listRow(new RegExp(t(CHECK_CATALOGUE['check.notDrawn'].name)))?.textContent).not.toContain('Open the scope to count')
    expect(within(detail()).getByRole('tab', { name: /Found/ }).textContent).toBe('Found')
    fireEvent.click(within(detail()).getByRole('button', { name: 'Open the scope to count' }))
    expect(onOpenScope).toHaveBeenCalledOnce()
  })

  it('says nothing was found in words that read as a sentence', () => {
    page({ rows: [], counts: { fix: 0, review: 0, note: 0 } })
    expect(screen.getByText('No findings in the whole organisation')).toBeTruthy()
  })

  it('picks the check it is asked for, and the finding to come back to under it', () => {
    page({ request: { select: 'check.unattributed', finding: 'check.unattributed|retail|post' } })
    expect(detail().dataset.check).toBe('check.unattributed')
    expect(within(screen.getByTestId('checks-row-actions')).getByText(/Post office is outside/)).toBeTruthy()
  })

  // A unit deleted before its assignments went with it left them naming nothing (ADR-0036, amended 12 October 2026).
  it('offers Remove the assignment on one whose unit is not there, with Put back, opening the person, where the scope may be changed', async () => {
    const left: AttentionItem[] = [{
      key: 'check.assignmentOrphaned', kind: 'assignmentOrphaned', scope: 'retail', id: 'as-1', person: 'pe-ada', fields: ['as-1'], subject: 'Ada',
      text: 'Ada still holds Team lead in a unit that is not there',
    }]
    const assignment = { id: 'as-1', unitId: 'gone', roleId: 'r', person: { person: 'pe-ada' } }
    const held = { ...index, lookup: index.lookup, rowsOf: index.rowsOf, units: index.units, assignments: () => [{ scope: 'retail', assignment }] }
    const rows = checksByCategory(splitInstances(treeInstances({ attention: left, models: [], at: '', today: '2026-10-12', index, home: ROOT, t }), []))
    const { props, marking } = page({ rows, index: held as never, request: { select: 'check.assignmentOrphaned' } })
    expect(within(detail()).getByRole('heading', { name: 'An assignment in a unit that is not there' })).toBeTruthy()
    fireEvent.click(instanceRow(/Ada/))
    fireEvent.click(within(detail()).getByTestId('checks-remove-assignment'))
    expect(marking.write).toHaveBeenCalledWith('retail', [{ type: 'assignment.remove', id: 'as-1' }])
    fireEvent.click(await screen.findByRole('button', { name: /Put back/ }))
    expect(marking.write).toHaveBeenLastCalledWith('retail', [{ type: 'assignment.add', assignment }])
    fireEvent.click(within(screen.getByTestId('checks-row-actions')).getByRole('button', { name: /Open/ }))
    expect(props.onGo).toHaveBeenCalledWith({ person: 'pe-ada' }, expect.anything(), expect.anything())
    cleanup()
    page({ rows, index: held as never, request: { select: 'check.assignmentOrphaned' } }, [], { mayChange: () => false })
    fireEvent.click(instanceRow(/Ada/))
    expect(screen.queryByTestId('checks-remove-assignment')).toBeNull()
  })
})

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * Where a mark as intended is written, and how a list draws the marks: the
 * open scope's through its session, any other's as that scope's step under
 * its rights, nothing for a fix, a scope only read or a finding the tree
 * knows nowhere to keep — and a list split into what is still shown and
 * *Accepted*, with *Mark as intended…* only where a mark may be made.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import type { ScopeCommand } from '../projects/scopeState'
import type { ConwayFinding } from '../model/conway'
import type { HostModel } from '../model/hostModel'
import type { ScopeSnapshot } from '../projects/scope'
import { indexScopes } from '../projects/scopeIndex'
import { renderShell } from './testing/renderShell'
import { checkMarking, CheckMarkingContext, useFindingMarks } from './checkMarking'
import type { CheckMarking } from './checkMarking'
import type { WriteIn } from './units/writeIn'

afterEach(() => cleanup())

const TODAY = '2026-10-12'
const model = (over: Partial<HostModel> = {}): HostModel => ({ name: 'Scope', elements: [], relations: [], diagrams: [], ...over })
const RETAIL = model({
  name: 'Retail',
  elements: [{ id: 'pos', kind: 'application', name: 'Point of sale', lifecycle: 'live', isManaged: true, aspects: {} }],
})
const index = indexScopes([{ path: '', model: model({ name: 'Acme' }) }, { path: 'retail', model: RETAIL }])

const vacant = { key: 'check.roleVacant' as const, scope: 'retail', id: 'u-carriers', fields: ['ro-po'] }
const conflict = { key: 'check.conflict' as const, scope: 'retail', id: 'erp' }
const unowned: ConwayFinding = { kind: 'unowned', applicationId: 'pos' }
const unused: ConwayFinding = { kind: 'unused', interaction: { id: 'i-new', sourceId: 'ops', targetId: 'sales' } }

/** A write to another scope that applies the change to what that scope holds, and says it landed. */
function writing(held: Record<string, HostModel>) {
  const written: { path: string; commands: readonly ScopeCommand[] }[] = []
  const writeIn: WriteIn = (path, change) => {
    const commands = change({ path, model: held[path]!, activeDiagramId: '', logoLibrary: [] } satisfies ScopeSnapshot)
    if (!commands) return Promise.resolve({ ok: false, reason: 'unchanged' })
    written.push({ path, commands })
    return Promise.resolve({ ok: true })
  }
  return { writeIn, written }
}

describe('where a mark is written', () => {
  it('goes through the open scope\'s session, as one command with the day and the reason', () => {
    const dispatch = vi.fn()
    const marking = checkMarking({ index, open: { scope: 'retail', model: RETAIL, dispatch, writable: true }, writable: () => true, today: TODAY })
    expect(marking.markableIn(vacant)).toBe('retail')
    marking.mark(vacant, ' Interim: covered by the cluster ')
    expect(dispatch).toHaveBeenCalledWith({
      type: 'checkMark.add', mark: { check: 'check.roleVacant', key: 'u-carriers ro-po', reason: 'Interim: covered by the cluster', on: TODAY },
    })
    marking.takeBack({ scope: 'retail', mark: { check: 'check.roleVacant', key: 'u-carriers ro-po', on: TODAY } })
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'checkMark.remove', id: 'check.roleVacant u-carriers ro-po' })
  })

  it('is another scope\'s own step where that scope keeps it, and nothing where it holds the mark already', async () => {
    const { writeIn, written } = writing({ retail: RETAIL })
    const dispatch = vi.fn()
    const marking = checkMarking({ index, open: { scope: '', model: model(), dispatch, writable: true }, writable: () => true, writeIn, today: TODAY })
    expect(marking.markableIn(unowned)).toBe('retail')
    marking.mark(unowned, '')
    await waitFor(() => expect(written).toEqual([{ path: 'retail', commands: [{ type: 'checkMark.add', mark: { check: 'check.applicationUnowned', key: 'pos', on: TODAY } }] }]))
    expect(dispatch).not.toHaveBeenCalled()
    const marked = { ...RETAIL, checkMarks: [{ check: 'check.applicationUnowned' as const, key: 'pos', on: TODAY }] }
    const again = writing({ retail: marked })
    checkMarking({ index, writable: () => true, writeIn: again.writeIn, today: TODAY }).mark(unowned, '')
    await Promise.resolve()
    expect(again.written).toEqual([])
  })

  it('offers nothing for a fix, a scope only read, a finding kept nowhere, or another scope with no way to write it', () => {
    const { writeIn } = writing({ retail: RETAIL })
    const readOnly = checkMarking({ index, writable: (path) => path !== 'retail', writeIn, today: TODAY })
    expect(readOnly.markableIn(conflict)).toBeUndefined()
    expect(readOnly.markableIn(vacant)).toBeUndefined()
    expect(readOnly.mayTakeBack('retail')).toBe(false)
    const open = checkMarking({ index, open: { scope: 'retail', model: RETAIL, dispatch: vi.fn(), writable: false }, writable: () => true, today: TODAY })
    expect(open.markableIn(vacant)).toBeUndefined()
    const nowhere = checkMarking({ index, writable: () => true, writeIn, today: TODAY })
    expect(nowhere.markableIn(unused)).toBeUndefined()
    const noWay = checkMarking({ index, writable: () => true, today: TODAY })
    expect(noWay.markableIn(unowned)).toBeUndefined()
  })

  it('keeps a Conway map\'s mark where the open session holds its row, before the index has read it', () => {
    const dispatch = vi.fn()
    const held = model({ relations: [{ id: 'i-new', type: 'interacts', sourceId: 'ops', targetId: 'sales' }] })
    const marking = checkMarking({ index, open: { scope: '', model: held, dispatch, writable: true }, writable: () => true, today: TODAY })
    expect(marking.markableIn(unused)).toBe('')
  })

  it('says where a mark did not land', async () => {
    const onRefused = vi.fn()
    const writeIn: WriteIn = () => Promise.resolve({ ok: false, reason: 'shell.scopeReadOnly' })
    checkMarking({ index, writable: () => true, writeIn, today: TODAY, onRefused }).mark(unowned, '')
    await waitFor(() => expect(onRefused).toHaveBeenCalledWith('shell.scopeReadOnly'))
  })
})

/** The one fix a list makes itself: an assignment whose unit is not there, removed (ADR-0036, amended 12 October 2026). */
describe('removing an assignment whose unit is not there', () => {
  const left = { id: 'as-1', unitId: 'gone', roleId: 'ro-po', person: { person: 'pe-ada' }, until: '2026-10-12' }

  it('goes through the open scope\'s session where it keeps it, and is another scope\'s step where that scope does', async () => {
    const dispatch = vi.fn()
    const open = checkMarking({ index, open: { scope: 'retail', model: RETAIL, dispatch, writable: true }, writable: () => true, today: TODAY })
    expect(open.mayChange('retail')).toBe(true)
    open.removeAssignment('retail', 'as-1')
    expect(dispatch).toHaveBeenCalledWith({ type: 'assignment.remove', id: 'as-1' })
    const { writeIn, written } = writing({ retail: { ...RETAIL, assignments: [left] } })
    checkMarking({ index, writable: () => true, writeIn, today: TODAY }).removeAssignment('retail', 'as-1')
    await waitFor(() => expect(written).toEqual([{ path: 'retail', commands: [{ type: 'assignment.remove', id: 'as-1' }] }]))
  })

  it('writes nothing where it is gone already, or the scope is only read', async () => {
    const { writeIn, written } = writing({ retail: RETAIL })
    checkMarking({ index, writable: () => true, writeIn, today: TODAY }).removeAssignment('retail', 'as-1')
    await Promise.resolve()
    expect(written).toEqual([])
    const readOnly = checkMarking({ index, writable: () => false, writeIn, today: TODAY })
    expect(readOnly.mayChange('retail')).toBe(false)
    readOnly.removeAssignment('retail', 'as-1')
    await Promise.resolve()
    expect(written).toEqual([])
  })
})

type Line = { text: string; finding?: typeof vacant }

function List({ lines }: { lines: Line[] }) {
  const { shown, more, accepted } = useFindingMarks(lines, { findingOf: (line) => line.finding, sentence: (line) => line.text })
  return (
    <>
      <ul>{shown.map((line) => <li key={line.text}>{line.text}{more(line)}</li>)}</ul>
      {accepted}
    </>
  )
}

describe('a list split by the marks', () => {
  const lines: Line[] = [
    { text: 'Carriers is short of a Product owner', finding: vacant },
    { text: 'Declare an interaction with Sales' },
  ]
  const marked = (over: Partial<CheckMarking> = {}): CheckMarking => ({
    marks: [], markableIn: () => 'retail', mark: vi.fn(), mayTakeBack: () => true, takeBack: vi.fn(), mayChange: () => true, removeAssignment: vi.fn(), ...over,
  })

  it('offers Mark as intended… on a line said from a finding, and never on one said from none', () => {
    const marking = marked()
    renderShell(<CheckMarkingContext.Provider value={marking}><List lines={lines} /></CheckMarkingContext.Provider>)
    expect(screen.getAllByRole('button', { name: 'Mark as intended…' })).toHaveLength(1)
    expect(screen.queryByTestId('findings-accepted')).toBeNull()
  })

  it('lists a marked one under Accepted, out of the lines, and takes it back from there', () => {
    const mark = { check: 'check.roleVacant' as const, key: 'u-carriers ro-po', on: TODAY, reason: 'Interim' }
    const marking = marked({ marks: [{ scope: 'retail', mark }] })
    renderShell(<CheckMarkingContext.Provider value={marking}><List lines={lines} /></CheckMarkingContext.Provider>)
    expect(screen.getAllByRole('listitem').map((one) => one.textContent)).toEqual(['Declare an interaction with Sales'])
    fireEvent.click(screen.getByRole('button', { name: 'Accepted (1)' }))
    fireEvent.click(screen.getByRole('button', { name: /^Take back/ }))
    expect(marking.takeBack).toHaveBeenCalledWith({ scope: 'retail', mark })
  })

  it('splits by the marks it was given, and offers no mark, where no marking is handed down', () => {
    function Bare() {
      const mark = { check: 'check.roleVacant' as const, key: 'u-carriers ro-po', on: TODAY }
      const { shown, more, accepted } = useFindingMarks(lines, {
        findingOf: (line) => line.finding, sentence: (line) => line.text, marks: [{ scope: 'retail', mark }],
      })
      return <>{shown.map((line) => <p key={line.text}>{line.text}{more(line)}</p>)}{accepted}</>
    }
    renderShell(<Bare />)
    expect(screen.queryByRole('button', { name: 'Mark as intended…' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Accepted (1)' }))
    expect(screen.queryByRole('button', { name: /^Take back/ })).toBeNull()
  })
})

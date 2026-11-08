// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The operating model's page (ADR-0036 §2), over a live writer: tabs by question,
 * a library brought in as one step, a press that selects and a letter that writes,
 * a part or the whole organisation, what needs one A, the rules, exceptions, an
 * item renamed and taken out — and nothing offered to change where the page reads.
 */
import { useState } from 'react'
import type { ComponentProps } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { renderShell } from '../../app/testing/renderShell'
import type { Command } from '../../model/commands'
import type { Model } from '../../model/normalised'
import { apply } from '../../model/reducer'
import { applyAll, empty, listsOf } from '../testing'
import { OperatingModelPage } from './OperatingModelPage'
import type { SlotTakeOut } from './OperatingModelPage'
import { organisationFacts } from '../organisationFacts'
import type { OrganisationFacts } from '../organisationFacts'
import { chooseValue } from '../../widgets/kit/testing/select'

afterEach(() => cleanup())

/** The page over a model a reducer keeps, and every command it sent. */
function Harness({ start, readOnly = false, atOrganisation = true, sent, initialId, aside, slotTakeOut, refuseLine, facts, onSave }: {
  start: Model; readOnly?: boolean; atOrganisation?: boolean; sent: Command[]; initialId?: string
  aside?: ComponentProps<typeof OperatingModelPage>['aside']
  slotTakeOut?: SlotTakeOut
  refuseLine?: ComponentProps<typeof OperatingModelPage>['refuseLine']
  facts?: OrganisationFacts
  onSave?: (name: string, text: string) => void
}) {
  const [model, setModel] = useState(start)
  let n = 0
  return (
    <OperatingModelPage
      open model={listsOf(model)} readOnly={readOnly} atOrganisation={atOrganisation}
      makeId={(prefix) => `${prefix}-${Date.now().toString(36)}-${++n}`}
      dispatch={(command) => {
        sent.push(command)
        setModel((held) => {
          const result = apply(held, command)
          return result.ok ? result.model : held
        })
      }}
      {...(initialId ? { initialId, initialNonce: 1 } : {})}
      {...(aside ? { aside } : {})}
      {...(slotTakeOut ? { slotTakeOut } : {})}
      {...(refuseLine ? { refuseLine } : {})}
      {...(facts ? { facts } : {})}
      {...(onSave ? { onSave } : {})}
      onClose={() => {}}
    />
  )
}

function show(start: Model = empty(), more: Partial<Parameters<typeof Harness>[0]> = {}) {
  const sent: Command[] = []
  renderShell(<Harness start={start} sent={sent} {...more} />)
  return sent
}

/** Scrum Team ticked in the dialog, with what it holds, brought in as one step. */
async function bringInScrum() {
  fireEvent.click(screen.getByRole('tab', { name: 'Structure' }))
  fireEvent.click(screen.getByRole('button', { name: /^(Start from a library|From a library…)$/ }))
  const dialog = await screen.findByTestId('library-dialog')
  fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Scrum Team' }))
  fireEvent.click(within(dialog).getByRole('button', { name: /^Bring in 8 items/ }))
  await waitFor(() => expect(screen.queryByTestId('library-dialog')).toBeNull())
}

const MODEL = () => applyAll(empty(), [
  { type: 'responsibility.add', responsibility: { id: 'rs-a', name: 'Plan the routes', group: 'Move' } },
  { type: 'responsibility.add', responsibility: { id: 'rs-b', name: 'Keep it safe', group: 'Move' } },
  { type: 'responsibility.add', responsibility: { id: 'rs-c', name: 'Send the bill', group: 'Bill' } },
  { type: 'role.add', role: { id: 'ro-1', name: 'Planner', duties: [{ responsibility: 'rs-a', raci: 'A' }] } },
  { type: 'role.add', role: { id: 'ro-2', name: 'Biller', short: 'Bi', duties: [{ responsibility: 'rs-c', raci: 'A' }] } },
  { type: 'role.add', role: { id: 'ro-3', name: 'Head', duties: [] } },
  { type: 'unitType.add', unitType: { id: 'ut-1', name: 'Depot', top: true, within: [], slots: [
    { role: 'ro-1', min: 1, max: 1, reportsTo: [{ kind: 'solid', role: 'ro-3' }] },
    { role: 'ro-3', min: 0 },
  ] } },
  { type: 'unitType.add', unitType: { id: 'ut-2', name: 'Lost', within: [], slots: [] } },
])

const cell = (row: string, column: string) => screen.getByRole('gridcell', { name: new RegExp(`^${row}, ${column}: `) })

describe('the operating model\'s page', () => {
  it('starts with the concepts in order and a library first, with nothing to read yet', async () => {
    show()
    expect(screen.getByTestId('operating-first-run')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'From a library…' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Start from a library' }))
    expect(await screen.findByRole('dialog', { name: 'From a library' })).toBeTruthy()
    expect(await axeFindings()).toEqual([])
  })

  it('brings a library in as one step, and reads what came in in its preview', async () => {
    const sent = show()
    await bringInScrum()
    expect(sent).toHaveLength(1)
    expect(sent[0].type).toBe('transaction')
    expect(screen.getByTestId('operating-counts').textContent).toBe('1 unit type · 3 roles · 4 responsibilities')
    fireEvent.click(screen.getByRole('tab', { name: 'Libraries' }))
    expect(screen.getByText('8 items')).toBeTruthy()
    fireEvent.click(screen.getByText('Scrum'))
    const preview = await screen.findByRole('dialog', { name: 'Scrum' })
    expect(within(preview).getAllByTestId(/^came-in-/)).toHaveLength(8)
    fireEvent.keyDown(preview, { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Scrum' })).toBeNull())
    fireEvent.click(screen.getByTestId('operating-compare'))
    expect(screen.getByText('Everything brought in still says what its library says.')).toBeTruthy()
  })

  it('reads a type\'s roles as lines, and only the line it changes speaks up', () => {
    show(MODEL(), { initialId: 'ut-1' })
    const lines = screen.getAllByTestId('operating-slot')
    expect(lines[0].textContent).toContain('exactly 1')
    expect(lines[0].textContent).toContain('to Head')
    expect(lines[1].textContent).toContain('any number')
    expect(lines[1].textContent).toContain('by nesting')
    // The role says nothing, this type says Head: its own line.
    expect(lines[0].querySelector('[data-own]')?.textContent).toBe('own line here: to Head')
    expect(lines[1].querySelector('[data-own]')).toBeNull()
  })

  it('says where a slot\'s line comes from, top rule first, changes it at this level and goes back', () => {
    const sent = show(MODEL(), { initialId: 'ut-1' })
    fireEvent.click(screen.getAllByTestId('operating-slot')[0])
    expect(screen.getByTestId('operating-slot-answer').textContent).toBe('Head')
    const chain = [...screen.getByTestId('operating-chain').querySelectorAll('li')]
    expect(chain.map((one) => one.children[0].textContent)).toEqual(['A holder', 'A unit', 'Depot', 'The role', 'Nesting'])
    expect(chain[2].hasAttribute('data-here')).toBe(true)
    fireEvent.click(screen.getByTestId('operating-line-back'))
    expect(sent.at(-1)).toMatchObject({ type: 'unitType.update', id: 'ut-1' })
    expect(screen.getByTestId('operating-slot-answer').textContent).toBe('By nesting')
    expect(screen.queryByTestId('operating-line-back')).toBeNull()
    fireEvent.click(screen.getByTestId('operating-change-line'))
    chooseValue(screen.getByLabelText('Planner: Reports to (Line manager)'), 'ro-2')
    expect(screen.getByTestId('operating-slot-answer').textContent).toBe('Biller')
  })

  it('refuses a line the host says would close a loop, and says why', () => {
    const sent = show(MODEL(), { initialId: 'ut-1', refuseLine: () => 'It would close a loop.' })
    fireEvent.click(screen.getAllByTestId('operating-slot')[0])
    fireEvent.click(screen.getByTestId('operating-change-line'))
    const before = sent.length
    chooseValue(screen.getByLabelText('Planner: Reports to (Line manager)'), 'ro-2')
    expect(sent).toHaveLength(before)
    expect(screen.getByTestId('operating-line-refused').textContent).toBe('It would close a loop.')
  })

  it('says a type that sits nowhere and a role in no type in a line under the structure', () => {
    show(MODEL())
    expect(screen.getByTestId('tray-nowhere').textContent).toContain('Lost')
    expect(screen.getByTestId('tray-loose').textContent).toContain('Biller')
    fireEvent.click(screen.getByTestId('nowhere-ut-2'))
    expect(within(screen.getByTestId('operating-inspector')).getByTestId('operating-sits').textContent).toBe('nowhere yet')
    fireEvent.click(screen.getByTestId('operating-change-place'))
    fireEvent.click(within(screen.getByTestId('operating-place-ticks')).getByRole('checkbox', { name: /At the top/ }))
    expect(screen.getByTestId('operating-sits').textContent).toBe('the organisation')
  })

  it('opens the grid on a part, with only the roles that have a part and the rest folded', () => {
    show(MODEL())
    fireEvent.click(screen.getByRole('tab', { name: 'Responsibilities' }))
    expect(screen.getByTestId('operating-grid-title').textContent).toBe('Move')
    expect(screen.getAllByRole('columnheader').map((one) => one.textContent)).toEqual(['Responsibility', 'Needs', 'Planner', '+2'])
    expect(screen.getByTestId('operating-folded').textContent).toContain('2 roles have no part here')
  })

  it('selects on a press and writes on a letter, or the picker: one step for each', async () => {
    const sent = show(MODEL())
    fireEvent.click(screen.getByRole('tab', { name: 'Responsibilities' }))
    const before = sent.length
    fireEvent.click(cell('Plan the routes', 'Planner'))
    expect(sent).toHaveLength(before)
    expect(cell('Plan the routes', 'Planner').getAttribute('aria-selected')).toBe('true')
    fireEvent.keyDown(cell('Plan the routes', 'Planner'), { key: 'i' })
    expect(sent).toHaveLength(before + 1)
    expect(cell('Plan the routes', 'Planner').textContent).toBe('I')
    fireEvent.click(within(screen.getByTestId('operating-cell-picker')).getByRole('button', { name: 'Accountable' }))
    expect(sent).toHaveLength(before + 2)
    expect(cell('Plan the routes', 'Planner').textContent).toBe('A')
    fireEvent.click(within(screen.getByTestId('operating-cell-picker')).getByRole('button', { name: 'none' }))
    expect(cell('Plan the routes', 'Planner').textContent).toBe('')
    expect(await axeFindings()).toEqual([])
  })

  it('keeps the count whole through a part, and shows only what needs one A', () => {
    show(MODEL())
    fireEvent.click(screen.getByRole('tab', { name: 'Responsibilities' }))
    expect(screen.getByTestId('operating-needs-count').textContent).toContain('1 row needs one A in all')
    fireEvent.click(screen.getByRole('treeitem', { name: /Bill/ }))
    expect(screen.getByTestId('operating-grid-title').textContent).toBe('Bill')
    expect(screen.getByTestId('operating-needs-count').textContent).toContain('1 row needs one A in all')
    // The group is marked by what is below it, closed or not.
    expect(screen.getByRole('treeitem', { name: /Move/ }).textContent).toContain('1 need one A')
    fireEvent.click(screen.getByTestId('operating-only-needs'))
    expect(screen.getByRole('rowheader', { name: /Keep it safe/ })).toBeTruthy()
    expect(screen.queryByRole('rowheader', { name: /Send the bill/ })).toBeNull()
    expect(screen.getAllByTestId('operating-need')[0].textContent).toBe('No A')
  })

  it('shows every role and row under the whole organisation, by full name while they fit, with group headings', () => {
    show(MODEL())
    fireEvent.click(screen.getByRole('tab', { name: 'Responsibilities' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Whole organisation' }))
    expect(screen.getByTestId('operating-grid-title').textContent).toBe('Whole organisation')
    expect(screen.getAllByRole('rowheader').map((one) => one.textContent)).toEqual(['Move', 'Plan the routes', 'Keep it safe', 'Bill', 'Send the bill'])
    expect(screen.getAllByRole('columnheader').map((one) => one.textContent)).toContain('Biller')
  })

  it('opens a new responsibility’s name for typing, and stops asking for the + column once it is open', () => {
    show(MODEL())
    fireEvent.click(screen.getByRole('tab', { name: 'Responsibilities' }))
    fireEvent.click(screen.getByRole('button', { name: 'New responsibility' }))
    expect(document.activeElement?.tagName).toBe('TEXTAREA')
    expect(screen.getByTestId('operating-folded').textContent).toContain('Press the + column')
    // Named in the page's one reader, over the grid: closed, the grid is pressed again.
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Responsibility' })).getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getByRole('columnheader', { name: /^\+/ }))
    expect(screen.getByTestId('operating-folded').textContent).not.toContain('Press the + column')
  })

  it('opens a role from its heading, keeping the column lit and the grid as it was', () => {
    show(MODEL())
    fireEvent.click(screen.getByRole('tab', { name: 'Responsibilities' }))
    fireEvent.click(screen.getByRole('columnheader', { name: 'Planner' }))
    expect(screen.getByTestId('operating-role-reader')).toBeTruthy()
    expect(screen.getByTestId('operating-grid-title').textContent).toBe('Move')
  })

  it('narrows to a unit, says who holds each role, names an A outside it, and never reads that as a gap', () => {
    const start = MODEL()
    const lists = listsOf(start)
    const facts = organisationFacts({
      day: '2026-01-01', personName: () => 'Anna', scopeOfUnit: () => 'north', scopeOfAssignment: () => 'north',
      organisation: {
        roles: lists.roles, unitTypes: lists.unitTypes,
        units: [{ id: 'u-1', name: 'Depot North', kind: 'actor', lifecycle: 'live', unitTypeId: 'ut-1' }] as never,
        assignments: [{ id: 'as-1', unitId: 'u-1', roleId: 'ro-1', person: { person: 'p' } }] as never,
      },
    })
    show(start, { facts })
    fireEvent.click(screen.getByRole('tab', { name: 'Responsibilities' }))
    chooseValue(screen.getByLabelText('Unit'), 'u-1')
    expect(screen.getByTestId('operating-grid-title').textContent).toBe('Depot North')
    expect(screen.getByRole('treeitem', { name: /All for Depot North/ })).toBeTruthy()
    expect(screen.getByRole('columnheader', { name: /Planner/ }).textContent).toContain('Anna')
    expect(screen.getAllByRole('rowheader').map((one) => one.textContent)).toEqual(['Move', 'Plan the routes'])
    // The count above the grid still says all of them.
    expect(screen.getByTestId('operating-needs-count').textContent).toContain('in all')
    // The role reader lists its units and who holds each.
    fireEvent.click(screen.getByRole('columnheader', { name: /Planner/ }))
    expect(screen.getByTestId('operating-holders').textContent).toBe('Holders: 1 · vacant: 0')
    expect(screen.getByTestId('operating-role-place').textContent).toContain('Depot North')
    expect(screen.getByTestId('operating-role-place').textContent).toContain('Anna')
  })

  it('exports what is shown and the whole organisation as a table', () => {
    const saved: [string, string][] = []
    show(MODEL(), { onSave: (name, text) => saved.push([name, text]) })
    fireEvent.click(screen.getByRole('tab', { name: 'Responsibilities' }))
    fireEvent.click(screen.getByRole('button', { name: 'Export' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Whole organisation, as CSV' }))
    expect(saved[0][0]).toBe('raci-organisation.csv')
    expect(saved[0][1].split('\n')[0]).toBe('Group,Responsibility,Planner,Biller,Head,Needs')
    expect(saved[0][1]).toContain('Move,Keep it safe,,,,No A')
  })

  it('holds the reordering in Arrange, as steps, and A to Z there leaves the model alone', () => {
    const sent = show(MODEL())
    fireEvent.click(screen.getByRole('tab', { name: 'Responsibilities' }))
    fireEvent.click(screen.getByRole('button', { name: 'Arrange' }))
    const before = sent.length
    fireEvent.click(screen.getByRole('button', { name: 'Move Move down: Move' }))
    expect(sent).toHaveLength(before + 1)
    expect(screen.getAllByRole('treeitem').map((one) => one.textContent)[0]).toContain('Bill')
    fireEvent.click(screen.getByRole('radio', { name: 'A–Z' }))
    expect(sent).toHaveLength(before + 1)
  })

  it('lists every role with where it is held, and reads one in the preview', async () => {
    show(MODEL())
    fireEvent.click(screen.getByRole('tab', { name: 'Roles' }))
    expect(screen.getByRole('row', { name: /Head/ }).textContent).toContain('No part yet')
    fireEvent.click(screen.getByRole('row', { name: /^Planner/ }))
    const preview = await screen.findByRole('dialog', { name: 'Planner' })
    expect(within(preview).getByTestId('operating-held-in').textContent).toBe('Held in: Depot')
    expect(await axeFindings()).toEqual([])
  })

  it('sets a rule to a role, and says what an unset one costs', () => {
    const sent = show(MODEL())
    fireEvent.click(screen.getByRole('tab', { name: 'Roles' }))
    expect(screen.getByTestId('operating-rule-domainOwner').textContent).toContain('Domains show no owner until this is set.')
    chooseValue(within(screen.getByTestId('operating-rule-domainOwner')).getByRole('combobox'), 'ro-1')
    expect(sent.at(-1)).toEqual({ type: 'operatingRule.add', rule: { id: 'domainOwner', role: 'ro-1' } })
    expect(screen.getByTestId('operating-rule-domainOwner').textContent).not.toContain('Domains show no owner')
  })

  it('renames an item in its panel and takes it out, saying first what goes with it', async () => {
    const sent = show(MODEL(), { initialId: 'ut-1' })
    fireEvent.click(screen.getByRole('button', { name: /Change the name: Depot/ }))
    const name = screen.getByRole('textbox', { name: 'Change the name' })
    fireEvent.change(name, { target: { value: 'Station' } })
    fireEvent.keyDown(name, { key: 'Enter' })
    expect(screen.getByTestId('unit-type-ut-1').textContent).toContain('Station')
    // Delete stands last in the record's ⋯, as on a board's panel.
    fireEvent.click(within(screen.getByTestId('operating-inspector').closest('[role="dialog"]')!).getByRole('button', { name: 'More' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'Delete from model…' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.queryByTestId('unit-type-ut-1')).toBeNull())
    expect(sent.at(-1)?.type).toBe('transaction')
  })

  it('opens on the item a request names, on its tab', async () => {
    show(MODEL(), { initialId: 'ro-1' })
    expect(await screen.findByRole('dialog', { name: 'Planner' })).toBeTruthy()
    expect(screen.getByRole('tab', { name: 'Roles', hidden: true }).getAttribute('aria-selected')).toBe('true')
  })

  it('reads the model in full over another scope, says so once, and every control that writes is gone', () => {
    show(MODEL(), { atOrganisation: false })
    expect(screen.getByTestId('operating-read-only').textContent).toContain('Read only here.')
    expect(screen.getByTestId('operating-counts').textContent).toBe('2 unit types · 3 roles · 3 responsibilities')
    expect(screen.queryByRole('button', { name: 'New unit type' })).toBeNull()
    fireEvent.click(screen.getByTestId('unit-type-ut-1').querySelector('button') as Element)
    expect(screen.queryByTestId('operating-remove')).toBeNull()
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull()
    expect(screen.queryByTestId('operating-change-place')).toBeNull()
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Responsibilities' }))
    expect(screen.queryByRole('button', { name: 'New responsibility' })).toBeNull()
    fireEvent.click(cell('Plan the routes', 'Planner'))
    expect(screen.queryByTestId('operating-cell-picker')).toBeNull()
  })

  it('edits a slot\'s numbers on Change, and ends a role on a day beside what the host says it leaves', () => {
    show(MODEL(), { initialId: 'ut-1', aside: (item) => (item.kind === 'unitType' ? <div data-testid="the-aside">Said by the host</div> : null) })
    expect(screen.getByTestId('the-aside')).toBeTruthy()
    fireEvent.click(screen.getAllByTestId('operating-slot')[1])
    fireEvent.click(screen.getByTestId('operating-change-many'))
    fireEvent.change(screen.getByLabelText('Head: At least'), { target: { value: '2' } })
    expect(screen.getByText('How many: at least 2')).toBeTruthy()
  })

  it('lists a role somebody holds before it is taken out of a unit type, and takes one nobody holds out at once', () => {
    const taken: string[] = []
    const slotTakeOut: SlotTakeOut = {
      held: (_type, roleId) => roleId === 'ro-1',
      aside: (_type, roleId) => { taken.push(roleId); return <div data-testid="take-out">People of {roleId}</div> },
    }
    const sent = show(MODEL(), { initialId: 'ut-1', slotTakeOut })
    fireEvent.click(screen.getAllByTestId('operating-slot')[0])
    const before = sent.length
    fireEvent.click(screen.getByRole('button', { name: 'Take Planner out of this unit type' }))
    expect(sent).toHaveLength(before)
    expect(screen.getByTestId('take-out').textContent).toBe('People of ro-1')
    fireEvent.click(screen.getAllByTestId('operating-slot')[1])
    fireEvent.click(screen.getByRole('button', { name: 'Take Head out of this unit type' }))
    expect(sent).toHaveLength(before + 1)
  })

  it('gathers what says otherwise, puts a slot back, and asks before changing the role for many', async () => {
    const start = applyAll(MODEL(), [
      { type: 'unitType.add', unitType: { id: 'ut-3', name: 'Team', top: true, within: [], slots: [{ role: 'ro-1', min: 0, reportsTo: [{ kind: 'solid', role: 'ro-3' }] }] } },
    ])
    const sent = show(start)
    fireEvent.click(screen.getByRole('tab', { name: /Exceptions/ }))
    expect(screen.getByTestId('operating-exceptions-intro').textContent).toContain('These 2 do.')
    expect(screen.getByTestId('operating-many-say').textContent).toContain('2 unit types')
    fireEvent.click(screen.getByRole('button', { name: 'Change the role' }))
    fireEvent.click(await screen.findByTestId('operating-change-role-confirm'))
    expect(sent.at(-1)?.type).toBe('transaction')
    await waitFor(() => expect(screen.getByTestId('operating-exceptions-intro').textContent).toContain('These 0 do.'))
  })
})

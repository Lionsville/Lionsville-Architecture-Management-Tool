// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The operating model's page (ADR-0036 §2), over a live writer: a library
 * brought in as one step, a cell of the matrix pressed through its letters
 * and the flag on a row without one A, the rules set, an item renamed and
 * taken out — and nothing offered to change where the page only reads.
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

afterEach(() => cleanup())

/** The page over a model a reducer keeps, and every command it sent. */
function Harness({ start, readOnly = false, atOrganisation = true, sent, initialId, aside, slotTakeOut }: {
  start: Model; readOnly?: boolean; atOrganisation?: boolean; sent: Command[]; initialId?: string
  aside?: ComponentProps<typeof OperatingModelPage>['aside']
  slotTakeOut?: SlotTakeOut
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
  fireEvent.click(screen.getByRole('tab', { name: 'Units and roles' }))
  fireEvent.click(screen.getByRole('button', { name: /^(Start from a library|From a library…)$/ }))
  const dialog = await screen.findByTestId('library-dialog')
  fireEvent.click(within(dialog).getByRole('checkbox', { name: 'Scrum Team' }))
  fireEvent.click(within(dialog).getByRole('button', { name: /^Bring in 8 items/ }))
  await waitFor(() => expect(screen.queryByTestId('library-dialog')).toBeNull())
}

describe('the operating model\'s page', () => {
  it('starts empty and offers a library first', async () => {
    show()
    expect(screen.getByText(/No unit types, roles or responsibilities yet/)).toBeTruthy()
    // Nothing to add a library beside yet: the start is the one way in from a library.
    expect(screen.queryByRole('button', { name: 'From a library…' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Start from a library' }))
    expect(await screen.findByRole('dialog', { name: 'From a library' })).toBeTruthy()
    expect(await axeFindings()).toEqual([])
  })

  it('brings a library in as one step, and says what came in on its card', async () => {
    const sent = show()
    await bringInScrum()
    expect(sent).toHaveLength(1)
    expect(sent[0].type).toBe('transaction')
    expect(screen.getByTestId('operating-counts').textContent).toBe('1 unit type · 3 roles · 4 responsibilities')
    expect(screen.getByRole('button', { name: 'From a library…' })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Libraries' }))
    expect(within(screen.getByTestId('library-scrum')).getAllByTestId(/^came-in-/)).toHaveLength(8)
    expect(screen.getByText('Everything brought in still says what its library says.')).toBeTruthy()
  })

  it('cycles a cell through the letters, and flags a row that is not exactly one role\'s A', async () => {
    show()
    await bringInScrum()
    fireEvent.click(screen.getByRole('tab', { name: 'Responsibilities' }))
    const cell = () => screen.getByRole('button', { name: /^Order the backlog, Scrum Master: / })
    expect(cell().getAttribute('aria-label')).toBe('Order the backlog, Scrum Master: none')
    fireEvent.click(cell())
    expect(cell().textContent).toBe('R')
    fireEvent.click(cell())
    expect(cell().textContent).toBe('A')
    // Two roles now say A for it.
    expect(screen.getByText('2 are accountable')).toBeTruthy()
    fireEvent.click(cell())
    fireEvent.click(cell())
    fireEvent.click(cell())
    expect(cell().textContent).toBe('')
    expect(screen.queryByText('2 are accountable')).toBeNull()
    expect(await axeFindings()).toEqual([])
  })

  it('keeps the roles picked over the matrix and what they have a part in, goes by name or as added, and keeps that across the tabs', async () => {
    show()
    await bringInScrum()
    fireEvent.click(screen.getByRole('tab', { name: 'Responsibilities' }))
    const headings = () => [...screen.getByRole('table').querySelectorAll('thead th[scope="col"]')].map((th) => th.textContent)
    const rows = () => [...screen.getByRole('table').querySelectorAll('tbody th[scope="row"]')].map((th) => th.textContent)
    const all = rows()
    expect(all).toEqual([...all].sort((a, b) => a!.localeCompare(b!)))
    fireEvent.click(screen.getByRole('button', { name: 'As added' }))
    expect(rows()).toHaveLength(all.length)
    fireEvent.click(screen.getByRole('button', { name: 'A–Z' }))
    // Scrum Master kept: its column alone, and only the rows it has a letter in.
    const roles = screen.getByRole('combobox', { name: 'Roles' })
    roles.focus()
    fireEvent.keyDown(roles, { key: 'ArrowDown' })
    fireEvent.click(await screen.findByRole('option', { name: 'Scrum Master' }))
    fireEvent.keyDown(roles, { key: 'Escape' })
    expect(headings()).toHaveLength(2)
    expect(rows().length).toBeGreaterThan(0)
    expect(rows().length).toBeLessThan(all.length)
    const kept = rows()
    fireEvent.click(screen.getByRole('tab', { name: 'Units and roles' }))
    fireEvent.click(screen.getByRole('tab', { name: 'Responsibilities' }))
    expect(rows()).toEqual(kept)
    expect(await axeFindings()).toEqual([])
  })

  it('edits a role picked from a card, and takes it out of the types that hold it', async () => {
    const sent = show()
    await bringInScrum()
    fireEvent.click(screen.getByRole('tab', { name: 'Units and roles' }))
    fireEvent.click(screen.getAllByRole('button', { name: /^Scrum Master/ })[0])
    const inspector = screen.getByTestId('operating-inspector')
    fireEvent.change(within(inspector).getByLabelText('Name'), { target: { value: 'Team coach' } })
    expect(sent.at(-1)).toMatchObject({ type: 'role.update', patch: { name: 'Team coach' } })
    expect(within(inspector).getByText('Based on Scrum · Scrum Master')).toBeTruthy()
    fireEvent.click(within(inspector).getByLabelText('Manages its unit'))
    expect(sent.at(-1)).toMatchObject({ type: 'role.update', patch: { manages: true } })
    fireEvent.click(within(inspector).getByRole('button', { name: 'Remove' }))
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Remove' })).getByRole('button', { name: 'Remove' }))
    expect(sent.at(-1)).toMatchObject({ type: 'transaction' })
    expect(screen.getByTestId('operating-counts').textContent).toBe('1 unit type · 2 roles · 4 responsibilities')
    // What it was renamed to is told apart from the library in compare.
    fireEvent.click(await screen.findByRole('tab', { name: 'Libraries' }))
    expect(screen.getByText(/Scrum Team — the role Scrum Master: here nothing, in the library 1/)).toBeTruthy()
  })

  it('dates a role, names what follows it, and shows beside it what the host says it leaves to decide', async () => {
    const sent = show(empty(), { aside: (item) => <span data-testid="aside">{item.kind}: {item.kind === 'responsibility' ? '' : item.item.until ?? 'no end'}</span> })
    await bringInScrum()
    fireEvent.click(screen.getByRole('tab', { name: 'Units and roles' }))
    fireEvent.click(screen.getAllByRole('button', { name: /^Scrum Master/ })[0])
    let inspector = screen.getByTestId('operating-inspector')
    expect(within(inspector).getByTestId('aside').textContent).toBe('role: no end')
    fireEvent.change(within(inspector).getByTestId('operating-until'), { target: { value: '2026-12-31' } })
    expect(sent.at(-1)).toMatchObject({ type: 'role.update', patch: { until: '2026-12-31' } })
    inspector = screen.getByTestId('operating-inspector')
    expect(within(inspector).getByTestId('aside').textContent).toBe('role: 2026-12-31')
    fireEvent.mouseDown(within(inspector).getByLabelText('Followed by'))
    fireEvent.click(await screen.findByRole('option', { name: 'Product Owner' }))
    expect(sent.at(-1)).toMatchObject({ type: 'role.update', patch: { successors: [expect.any(String)] } })
    // A list that takes several stays open until it is closed.
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Escape' })
    await waitFor(() => expect(screen.queryByRole('listbox')).toBeNull())
    const chip = screen.getAllByTestId(/^role-/).find((one) => one.textContent?.startsWith('Scrum Master'))
    expect(chip?.textContent).toContain('until 2026-12-31')
    fireEvent.change(within(screen.getByTestId('operating-inspector')).getByTestId('operating-until'), { target: { value: '' } })
    expect(sent.at(-1)).toMatchObject({ type: 'role.update', patch: { until: undefined } })
  })

  it('sets a rule to a role', async () => {
    const sent = show()
    await bringInScrum()
    fireEvent.click(screen.getByRole('tab', { name: 'Units and roles' }))
    const rules = screen.getByText('Rules the model reads').parentElement!
    fireEvent.mouseDown(within(rules).getAllByRole('combobox')[0])
    fireEvent.click(await screen.findByRole('option', { name: 'Product Owner' }))
    expect(sent.at(-1)).toMatchObject({ type: 'operatingRule.add', rule: { id: 'applicationOwner' } })
  })

  it('opens on the item a request names, on its tab', async () => {
    show(applyAll(empty(), [{ type: 'responsibility.add', responsibility: { id: 'rs-1', name: 'Release' } }]), { initialId: 'rs-1' })
    expect(screen.getByRole('tab', { name: 'Responsibilities', selected: true })).toBeTruthy()
    expect(within(screen.getByTestId('operating-inspector')).getByDisplayValue('Release')).toBeTruthy()
  })

  it('offers nothing to change where it only reads, and says where it is edited', async () => {
    show(empty(), { atOrganisation: false })
    expect(screen.getByText('The operating model is kept at the organisation, and edited there.')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'New unit type' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Start from a library' })).toBeNull()
    fireEvent.click(screen.getByRole('tab', { name: 'Libraries' }))
    expect(screen.queryByRole('button', { name: 'From Scrum…' })).toBeNull()
  })

  it('edits a unit type: where it sits, whether it spans, its slots and its limit', async () => {
    const sent = show()
    await bringInScrum()
    fireEvent.click(screen.getByRole('tab', { name: 'Units and roles' }))
    fireEvent.click(screen.getByRole('button', { name: 'New unit type' }))
    let inspector = screen.getByTestId('operating-inspector')
    fireEvent.change(within(inspector).getByLabelText('Name'), { target: { value: 'Squad' } })
    fireEvent.change(within(inspector).getByLabelText('Purpose, in the organisation\'s own words'), { target: { value: 'Builds.' } })
    fireEvent.click(within(inspector).getByLabelText('Scrum Team'))
    fireEvent.click(within(inspector).getByLabelText('At the top, under the organisation itself'))
    fireEvent.click(within(inspector).getByLabelText('A unit of this type may serve more than one domain'))
    expect(sent.slice(-3).map((one) => one.type)).toEqual(['unitType.update', 'unitType.update', 'unitType.update'])
    fireEvent.mouseDown(within(inspector).getByLabelText('A role to add'))
    fireEvent.click(await screen.findByRole('option', { name: 'Developer' }))
    inspector = screen.getByTestId('operating-inspector')
    fireEvent.click(within(inspector).getByRole('button', { name: 'Add role' }))
    expect(sent.at(-1)).toMatchObject({ type: 'unitType.update', patch: { slots: [expect.objectContaining({ min: 0, max: 1 })] } })
    fireEvent.change(within(inspector).getByLabelText('Developer: At least'), { target: { value: '2' } })
    fireEvent.change(within(inspector).getByLabelText('Developer: At most'), { target: { value: '' } })
    expect(sent.at(-1)).toMatchObject({ patch: { slots: [{ min: 2 }] } })
    fireEvent.change(within(inspector).getByLabelText('Owns at most this many applications'), { target: { value: '4' } })
    expect(sent.at(-1)).toMatchObject({ patch: { limit: 4 } })
    fireEvent.click(within(inspector).getByRole('button', { name: 'Take Developer out of this unit type' }))
    expect(sent.at(-1)).toMatchObject({ patch: { slots: [] } })
    // It was made to sit at the top; that was pressed off, and Scrum Team on.
    expect(screen.getByText('Sits in: Scrum Team')).toBeTruthy()
  })

  it('lists who holds a role before it is taken out of a unit type, and takes one nobody holds out at once', async () => {
    const start = applyAll(empty(), [
      { type: 'role.add', role: { id: 'ro-dev', name: 'Developer', duties: [] } },
      { type: 'role.add', role: { id: 'ro-sm', name: 'Scrum Master', duties: [] } },
      { type: 'unitType.add', unitType: { id: 'ut-team', name: 'Team', top: true, within: [], slots: [{ role: 'ro-dev', min: 1 }, { role: 'ro-sm', min: 0, max: 1 }] } },
    ])
    const asked: string[] = []
    const slotTakeOut: SlotTakeOut = {
      held: (type, roleId) => { asked.push(`${type.id}/${roleId}`); return roleId === 'ro-dev' },
      aside: (type, roleId, done) => <div data-testid="slot-aside">{type.name}: {roleId}<button type="button" onClick={done}>Keep it</button></div>,
    }
    const sent = show(start, { initialId: 'ut-team', slotTakeOut })
    const inspector = () => screen.getByTestId('operating-inspector')
    // Somebody holds it: nothing is written, and the host's list is drawn under the slots instead.
    fireEvent.click(within(inspector()).getByRole('button', { name: 'Take Developer out of this unit type' }))
    expect(sent).toEqual([])
    expect(within(inspector()).getByTestId('slot-aside').textContent).toBe('Team: ro-devKeep it')
    expect(await axeFindings()).toEqual([])
    fireEvent.click(within(inspector()).getByRole('button', { name: 'Keep it' }))
    expect(screen.queryByTestId('slot-aside')).toBeNull()
    // Nobody does: it goes at once, as one step.
    fireEvent.click(within(inspector()).getByRole('button', { name: 'Take Scrum Master out of this unit type' }))
    expect(sent).toEqual([{ type: 'unitType.update', id: 'ut-team', patch: { slots: [{ role: 'ro-dev', min: 1 }] } }])
    // Picking something else puts the list away.
    fireEvent.click(within(inspector()).getByRole('button', { name: 'Take Developer out of this unit type' }))
    expect(screen.getByTestId('slot-aside')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: /^Developer/ })[0])
    expect(screen.queryByTestId('slot-aside')).toBeNull()
    expect(asked).toEqual(['ut-team/ro-dev', 'ut-team/ro-sm', 'ut-team/ro-dev'])
  })

  it('edits a responsibility picked in the matrix', async () => {
    const sent = show()
    await bringInScrum()
    fireEvent.click(screen.getByRole('tab', { name: 'Responsibilities' }))
    fireEvent.click(screen.getByRole('button', { name: 'New responsibility' }))
    const inspector = screen.getByTestId('operating-inspector')
    fireEvent.change(within(inspector).getByLabelText('Name'), { target: { value: 'Release' } })
    fireEvent.change(within(inspector).getByLabelText('Description'), { target: { value: 'Ship it.' } })
    fireEvent.change(within(inspector).getByLabelText('Group, such as a value stream'), { target: { value: 'Deliver' } })
    expect(sent.at(-1)).toMatchObject({ type: 'responsibility.update', patch: { group: 'Deliver' } })
    expect(screen.getByText('Deliver')).toBeTruthy()
    expect(screen.getAllByText('nobody is accountable').length).toBeGreaterThan(0)
    expect(within(inspector).getByText('The organisation\'s own')).toBeTruthy()
  })
})

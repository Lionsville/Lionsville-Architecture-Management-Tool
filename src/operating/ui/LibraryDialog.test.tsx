// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A library brought in as a choice (ADR-0036, amended 11 October 2026), on
 * the operating model's page over a live writer: the dialog draws the library
 * in its lanes, read-only, with what a tick brings along dashed and what each
 * role answers for folded under it; *What will come in* is the step before
 * it is written, and every edit there reaches the one step; what is new is
 * marked until the page is left, and the toast's *Undo* takes that step back
 * and nothing else; *What came in* on the Libraries tab renames in place and
 * opens an item where it is edited, and counts neither a name nor a place
 * chosen on the way in as a change since.
 */
import { useRef, useState } from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { axeFindings } from '../../app/testing/axe'
import { renderShell } from '../../app/testing/renderShell'
import type { Command } from '../../model/commands'
import type { Model } from '../../model/normalised'
import { roleList, unitTypeList } from '../../model/normalised'
import { apply } from '../../model/reducer'
import { applyAll, empty, listsOf } from '../testing'
import { OperatingModelPage } from './OperatingModelPage'

afterEach(() => cleanup())

/** Acme Logistics' own structure: a domain, a cluster in it, a team in that, and the team's roles. */
function acme(): Model {
  return applyAll(empty(), [
    { type: 'role.add', role: { id: 'ro-po', name: 'Product owner', duties: [] } },
    { type: 'role.add', role: { id: 'ro-dev', name: 'Developer', duties: [] } },
    { type: 'unitType.add', unitType: { id: 'ut-domain', name: 'Domain', top: true, within: [], slots: [] } },
    { type: 'unitType.add', unitType: { id: 'ut-cluster', name: 'Cluster', within: ['ut-domain'], slots: [] } },
    {
      type: 'unitType.add',
      unitType: { id: 'ut-team', name: 'Team', within: ['ut-cluster'], slots: [{ role: 'ro-po', min: 1, max: 1 }, { role: 'ro-dev', min: 3 }] },
    },
  ])
}

type Kept = { sent: Command[]; model(): Model; undone: () => number }

/**
 * The page over a model kept as a list of steps, as a session keeps one: a
 * step's undo takes back the newest only while it is still the newest.
 */
function Harness({ start, kept, open }: { start: Model; kept: Kept & { set(held: { history: Model[]; undone: number }): void }; open: boolean }) {
  const held = useRef({ history: [start], undone: 0 })
  const [, redraw] = useState(0)
  let n = 0
  kept.set(held.current)
  const now = held.current.history.at(-1)!
  return (
    <OperatingModelPage
      open={open} model={listsOf(now)} readOnly={false} atOrganisation makeId={(prefix) => `${prefix}-${++n}`}
      dispatch={(command) => {
        kept.sent.push(command)
        const result = apply(held.current.history.at(-1)!, command)
        if (result.ok) held.current.history = [...held.current.history, result.model]
        redraw((count) => count + 1)
      }}
      undoStep={() => {
        const at = held.current.history.length
        return () => {
          if (held.current.history.length !== at) return false
          held.current.history = held.current.history.slice(0, -1)
          held.current.undone += 1
          redraw((count) => count + 1)
          return true
        }
      }}
      onClose={() => {}}
    />
  )
}

function show(start: Model = acme()) {
  let store = { history: [start], undone: 0 }
  const kept = {
    sent: [] as Command[],
    model: () => store.history.at(-1)!,
    undone: () => store.undone,
    set: (held: typeof store) => { store = held },
  }
  const view = renderShell(<Harness start={start} kept={kept} open />)
  return { ...kept, rerender: (open: boolean) => view.rerender(<Harness start={start} kept={kept} open={open} />) }
}

const dialog = () => screen.getByTestId('library-dialog')
const pane = () => screen.getByTestId('coming-in')
const card = (entry: string) => within(dialog()).getByTestId(`unit-type-${entry}`)

/** A dialog closing hides the page from role queries until it is gone. */
async function closed() {
  await waitFor(() => expect(screen.queryByTestId('library-dialog')).toBeNull())
}

async function openLibrary(name: string) {
  await closed()
  fireEvent.click(screen.getByRole('button', { name: 'From a library…' }))
  await screen.findByTestId('library-dialog')
  fireEvent.click(within(dialog()).getByRole('tab', { name: new RegExp(`^${name}`) }))
}

describe('a library brought in from its dialog', () => {
  it('draws the library in its lanes, dashes what a tick brings along, and folds out what a role answers for', async () => {
    show()
    await openLibrary('SAFe')
    const lanes = within(dialog()).getByRole('group', { name: 'SAFe: unit types, in lanes by where each may sit' })
    expect(within(lanes).getAllByTestId(/^unit-type-/).map((one) => one.dataset.testid))
      .toEqual(['unit-type-portfolio', 'unit-type-agile-release-train', 'unit-type-agile-team'])
    expect(card('agile-team').textContent).toContain('builds')
    // Ticking the team brings the train it sits in, and the portfolio that holds the train, dashed; and its roles.
    fireEvent.click(within(card('agile-team')).getByRole('checkbox', { name: 'Agile Team' }))
    expect(card('agile-release-train').dataset.dashed).toBe('true')
    expect(card('agile-team').dataset.dashed).toBeUndefined()
    expect(within(card('agile-release-train')).getByText(/^comes along with Agile Team/)).toBeTruthy()
    expect(within(card('agile-team')).getByTestId('role-team-coach').dataset.dashed).toBe('true')
    // A role answers for its responsibilities, folded under it until it is pressed.
    const coach = within(card('agile-team')).getByTestId('role-team-coach')
    expect(coach.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(coach)
    expect(coach.getAttribute('aria-expanded')).toBe('true')
    expect(within(card('agile-team')).getByText('Scrum Master/Team Coach answers for')).toBeTruthy()
    expect(await axeFindings()).toEqual([])
  })

  it('is reached by the keyboard: the dialog takes the focus, the list moves by arrows, every control is a native one', async () => {
    show()
    fireEvent.click(screen.getByRole('button', { name: 'From a library…' }))
    await screen.findByTestId('library-dialog')
    await waitFor(() => expect(dialog().contains(document.activeElement)).toBe(true))
    const first = within(dialog()).getByRole('tab', { name: /^Scrum/ })
    first.focus()
    fireEvent.keyDown(first, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(within(dialog()).getByRole('tab', { name: /^SAFe/ }))
    fireEvent.click(within(card('scrum-team')).getByRole('checkbox', { name: 'Scrum Team' }))
    const controls = [
      ...within(dialog()).getAllByRole('checkbox'), ...within(pane()).getAllByRole('textbox'),
      ...within(pane()).getAllByRole('combobox'), within(pane()).getByRole('button', { name: /^Bring in/ }),
    ]
    for (const control of controls) expect(['INPUT', 'SELECT', 'BUTTON'], control.outerHTML).toContain(control.tagName)
    for (const chip of within(dialog()).getAllByTestId(/^role-/)) expect(chip.tagName).toBe('BUTTON')
  })

  it('writes what the pane says as one step: names chosen, a place, a role made and one of yours used', async () => {
    const kept = show()
    await openLibrary('Scrum')
    fireEvent.click(within(card('scrum-team')).getByRole('checkbox', { name: 'Scrum Team' }))
    // The names start as the library's terms; Developer is suggested as the one you have.
    expect(within(pane()).getByLabelText('Scrum Team: called here')).toHaveProperty('value', 'Scrum Team')
    expect(within(pane()).getByLabelText('Developer: bring in, or use yours')).toHaveProperty('value', 'ro-dev')
    fireEvent.change(within(pane()).getByLabelText('Scrum Team: called here'), { target: { value: 'Squad' } })
    fireEvent.change(within(pane()).getByLabelText('Scrum Team: sits in'), { target: { value: 'inside:ut-cluster' } })
    fireEvent.change(within(pane()).getByLabelText('Scrum Master: called here'), { target: { value: 'Agile coach' } })
    // Product Owner would be your Product owner: bring it in after all.
    expect(within(pane()).getByLabelText('Product Owner: bring in, or use yours')).toHaveProperty('value', 'ro-po')
    fireEvent.change(within(pane()).getByLabelText('Product Owner: bring in, or use yours'), { target: { value: '' } })
    expect(within(pane()).getByTestId('coming-in-counts').textContent).toBe('This step makes 1 unit type · 2 roles · 4 responsibilities.')
    fireEvent.click(within(pane()).getByRole('button', { name: 'Bring in 7 items as one step' }))
    expect(kept.sent).toHaveLength(1)
    const squad = unitTypeList(kept.model()).find((type) => type.name === 'Squad')!
    expect(squad).toMatchObject({ within: ['ut-cluster'], basedOn: { library: 'scrum', entry: 'scrum-team', name: 'Squad' } })
    const roles = roleList(kept.model())
    expect(roles.find((role) => role.name === 'Agile coach')?.basedOn).toMatchObject({ entry: 'scrum-master', name: 'Agile coach' })
    expect(roles.find((role) => role.id === 'ro-dev')?.alsoBasedOn).toEqual([expect.objectContaining({ library: 'scrum', entry: 'developer' })])
    expect(squad.slots.map((slot) => slot.role)).toContain('ro-dev')
    expect(roles.filter((role) => role.name === 'Product Owner')).toHaveLength(1)
  })

  it('places a library\'s top types beside your deepest, and says what is in your model already, matched or brought in', async () => {
    show()
    await openLibrary('Team Topologies')
    fireEvent.click(within(card('stream-aligned')).getByRole('checkbox', { name: 'Stream-aligned team' }))
    const place = within(pane()).getByLabelText('Stream-aligned team: sits in') as HTMLSelectElement
    expect(place.value).toBe('beside:ut-team')
    expect(place.selectedOptions[0].textContent).toBe('Beside your Team, in Cluster')
    fireEvent.click(within(pane()).getByRole('button', { name: 'Bring in 1 item as one step' }))
    // Opened again, the type is in the model as it is; Scrum's developer, matched before, says so.
    await openLibrary('Scrum')
    fireEvent.click(within(card('scrum-team')).getByRole('checkbox', { name: 'Scrum Team' }))
    fireEvent.click(within(pane()).getByRole('button', { name: /^Bring in 4 items/ }))
    await openLibrary('Team Topologies')
    expect(within(card('stream-aligned')).getByRole('checkbox', { name: 'Stream-aligned team' })).toHaveProperty('disabled', true)
    expect(within(card('stream-aligned')).getByText('in your model as Stream-aligned team')).toBeTruthy()
    fireEvent.click(within(dialog()).getByRole('tab', { name: /^Scrum/ }))
    expect(within(card('scrum-team')).getByText('in your model as Scrum Team')).toBeTruthy()
    expect(within(dialog()).getByTestId('library-tab-scrum')).toBeTruthy()
    fireEvent.click(within(dialog()).getByRole('tab', { name: /^SAFe/ }))
    fireEvent.click(within(card('agile-team')).getByRole('checkbox', { name: 'Agile Team' }))
    // SAFe's team member is alike Scrum's developer, which your Developer was matched to.
    expect(within(pane()).getByLabelText('Agile Team member: bring in, or use yours')).toHaveProperty('value', 'ro-dev')
  })

  it('marks what came in until the page is left, and its toast takes back that step', async () => {
    const kept = show()
    await openLibrary('Scrum')
    fireEvent.click(within(card('scrum-team')).getByRole('checkbox', { name: 'Scrum Team' }))
    fireEvent.click(within(pane()).getByRole('button', { name: /^Bring in 4 items/ }))
    await closed()
    const toast = screen.getByTestId('operating-landed')
    expect(toast.textContent).toContain('One step: 4 items brought in from Scrum. 2 matched to yours. What is new is marked until you leave the page.')
    const fresh = () => [...document.querySelectorAll<HTMLElement>('[data-fresh]')].map((one) => one.textContent ?? '')
    expect(fresh()).toEqual([expect.stringMatching(/^Scrum Team/)])
    expect(await axeFindings()).toEqual([])
    fireEvent.click(within(toast).getByRole('button', { name: 'Undo' }))
    expect(kept.undone()).toBe(1)
    expect(unitTypeList(kept.model()).map((type) => type.name)).toEqual(['Domain', 'Cluster', 'Team'])
    expect(fresh()).toEqual([])
    // Brought in again, then the page left: nothing is marked when it is opened again.
    await openLibrary('Scrum')
    fireEvent.click(within(card('scrum-team')).getByRole('checkbox', { name: 'Scrum Team' }))
    fireEvent.click(within(pane()).getByRole('button', { name: /^Bring in 4 items/ }))
    expect(fresh()).toHaveLength(1)
    kept.rerender(false)
    kept.rerender(true)
    await waitFor(() => expect(fresh()).toEqual([]))
  })

  it('says it was not undone where another step came after it', async () => {
    const kept = show()
    await openLibrary('Scrum')
    fireEvent.click(within(card('scrum-team')).getByRole('checkbox', { name: 'Scrum Team' }))
    fireEvent.click(within(pane()).getByRole('button', { name: /^Bring in 4 items/ }))
    await closed()
    fireEvent.click(screen.getByRole('button', { name: 'New role' }))
    fireEvent.click(within(screen.getByTestId('operating-landed')).getByRole('button', { name: 'Undo' }))
    expect(kept.undone()).toBe(0)
    expect(screen.getByTestId('operating-landed').textContent).toContain('Not undone: another step came after it.')
  })
})

describe('what came in, on the Libraries tab', () => {
  it('lists each library\'s terms beside their names here, renames in place, opens an item and says what was matched', async () => {
    const kept = show()
    await openLibrary('Scrum')
    fireEvent.click(within(card('scrum-team')).getByRole('checkbox', { name: 'Scrum Team' }))
    fireEvent.change(within(pane()).getByLabelText('Scrum Team: called here'), { target: { value: 'Squad' } })
    fireEvent.click(within(pane()).getByRole('button', { name: /^Bring in 4 items/ }))
    await closed()
    fireEvent.click(screen.getByRole('tab', { name: 'Libraries' }))
    const scrum = screen.getByTestId('library-scrum')
    expect(within(scrum).getByLabelText('Scrum Team: called here')).toHaveProperty('value', 'Squad')
    expect(within(scrum).getByTestId('came-in-matched-developer').textContent).toContain('used your Developer')
    // A rename chosen on the way in is not a change since; one made here is.
    const squad = unitTypeList(kept.model()).find((type) => type.name === 'Squad')!
    expect(within(scrum).getByTestId(`came-in-${squad.id}`).textContent).not.toContain('the name')
    fireEvent.change(within(scrum).getByLabelText('Scrum Team: called here'), { target: { value: 'Crew' } })
    expect(kept.sent.at(-1)).toMatchObject({ type: 'unitType.update', id: squad.id, patch: { name: 'Crew' } })
    expect(within(scrum).getByTestId(`came-in-${squad.id}`).textContent).toContain('the name')
    expect(within(screen.getByTestId('library-safe')).getByText('Nothing from SAFe yet.')).toBeTruthy()
    expect(screen.getByText(/SAFe is a registered trademark/)).toBeTruthy()
    expect(await axeFindings()).toEqual([])
    // Pressing the term opens the item where it is edited.
    fireEvent.click(within(scrum).getByRole('button', { name: 'Scrum Team' }))
    expect(screen.getByRole('tab', { name: 'Units and roles', selected: true })).toBeTruthy()
    expect(within(screen.getByTestId('operating-inspector')).getByDisplayValue('Crew')).toBeTruthy()
  })

  it('says nothing has changed of a type placed on the way in, and a move since against where it was put', async () => {
    const kept = show()
    await openLibrary('Team Topologies')
    fireEvent.click(within(card('stream-aligned')).getByRole('checkbox', { name: 'Stream-aligned team' }))
    // Beside your Team, in Cluster: the library has it at the top.
    expect(within(pane()).getByLabelText('Stream-aligned team: sits in')).toHaveProperty('value', 'beside:ut-team')
    fireEvent.click(within(pane()).getByRole('button', { name: 'Bring in 1 item as one step' }))
    await closed()
    fireEvent.click(screen.getByRole('tab', { name: 'Libraries' }))
    const aligned = unitTypeList(kept.model()).find((type) => type.basedOn?.entry === 'stream-aligned')!
    const row = () => within(screen.getByTestId('library-team-topologies')).getByTestId(`came-in-${aligned.id}`)
    const compared = () => document.querySelector('[data-guide="operating.compare"]')!.textContent
    expect(row().textContent).toContain('nothing')
    expect(compared()).not.toContain('Stream-aligned team')
    // Moved to the top since, where the library has it: a move since all the same.
    fireEvent.click(within(row()).getByRole('button', { name: 'Stream-aligned team' }))
    fireEvent.click(within(screen.getByTestId('operating-inspector')).getByLabelText('At the top, under the organisation itself'))
    expect(kept.sent.at(-1)).toMatchObject({ type: 'unitType.update', id: aligned.id, patch: { top: true } })
    fireEvent.click(screen.getByRole('tab', { name: 'Libraries' }))
    expect(row().textContent).toContain('sits at the top')
    expect(compared()).toContain('Stream-aligned team — sits at the top: here “yes”, when it came in “nothing”.')
    expect(await axeFindings()).toEqual([])
  })

  it('opens the dialog on the library whose card asked', async () => {
    show()
    fireEvent.click(screen.getByRole('tab', { name: 'Libraries' }))
    fireEvent.click(within(screen.getByTestId('library-it4it')).getByRole('button', { name: /^From IT4IT/ }))
    await screen.findByTestId('library-dialog')
    expect(within(dialog()).getByRole('tab', { selected: true }).textContent).toMatch(/^IT4IT/)
    // A library of roles alone: each its own card, ticked on its own, with what it answers for to fold out.
    const manager = within(dialog()).getByTestId('library-role-release-manager')
    fireEvent.click(within(manager).getByRole('button', { name: /^▸ Answers for/ }))
    expect(within(manager).getByText('Release manager answers for')).toBeTruthy()
    fireEvent.click(within(manager).getByRole('checkbox', { name: 'Release manager' }))
    expect(within(pane()).getByLabelText('Release manager: called here')).toBeTruthy()
    expect(await axeFindings()).toEqual([])
  })
})

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The people register in the app (ADR-0036): the People page reached from
 * the organisation's card, the agent's tools over the same register, the
 * policy that applies itself when the organisation is opened, and a forget
 * that reaches everything that shows a person — the page, the agent and a
 * working file.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { unzipSync } from 'fflate'
import { WORKING_FILE_INTERCHANGE } from '../adapters/folder/format/interchange'
import type { AgentAnswer, AgentRequest } from '../agent/tools'
import type { AgentGateway } from '../ports/AgentGateway'
import type { Person } from '../people/person'
import type { ScopeSnapshot } from '../projects/scope'
import { heldRepositories } from './testing/heldRepositories'
import type { HeldRepositories } from './testing/heldRepositories'
import { renderApp } from './testing/renderShell'

afterEach(() => cleanup())

const TODAY = '2026-10-11'

const root: ScopeSnapshot = {
  path: '',
  model: { name: 'Acme Logistics', elements: [], relations: [], diagrams: [] },
  activeDiagramId: '',
  logoLibrary: [],
}

/** A gateway that keeps whoever subscribed, and says a client is connected. */
function gateway() {
  let handler: ((request: AgentRequest) => Promise<AgentAnswer>) | undefined
  const connected = { kind: 'connected' as const, port: 51733, token: 't'.repeat(24), client: { name: 'Claude Code', version: '2.0' } }
  const held: AgentGateway = {
    id: 'fake',
    on(next) {
      handler = next
      return () => { if (handler === next) handler = undefined }
    },
    status: () => Promise.resolve(connected),
    onStatus: () => () => {},
    configure: () => Promise.resolve(connected),
    newToken: () => Promise.resolve(connected),
  }
  let n = 0
  const ask = async (tool: string, args: unknown = {}): Promise<Record<string, unknown>> => {
    if (!handler) throw new Error('nobody is listening')
    const answer = await handler({ id: `r${++n}`, tool, args })
    if (!answer.ok || answer.content[0].type !== 'text') throw new Error(`refused: ${JSON.stringify(answer)}`)
    return JSON.parse(answer.content[0].text) as Record<string, unknown>
  }
  return { gateway: held, ask, bound: () => handler !== undefined }
}

async function added(held: HeldRepositories, name: string, email?: string): Promise<Person> {
  const answer = await held.people.add({ name, ...(email ? { email } : {}) })
  if ('refused' in answer) throw new Error(answer.refused)
  return answer.person
}

async function openPeople() {
  fireEvent.click(await screen.findByTestId('open-people'))
  return screen.findByTestId('people-table')
}

describe('the People page in the app', () => {
  it('is a card on the organisation’s home, and what is added on it lands in the register', async () => {
    const held = heldRepositories([root])
    await added(held, 'Pia Schulz')
    renderApp({ repositories: held, today: () => TODAY })
    await waitFor(() => expect(screen.getByTestId('open-people').closest('[class*="MuiCard"]')?.textContent).toContain('1 person'))
    await openPeople()
    fireEvent.click(screen.getByTestId('people-add'))
    fireEvent.change(screen.getByTestId('people-add-name'), { target: { value: 'Ruben Dekker' } })
    fireEvent.click(screen.getByTestId('people-add-save'))
    await waitFor(async () => expect((await held.people.list()).people.map((one) => one.name).sort()).toEqual(['Pia Schulz', 'Ruben Dekker']))
  })

  it('opens for an agent, which reads the same register and adds to it', async () => {
    const held = heldRepositories([root])
    await added(held, 'Pia Schulz', 'pia@acme.example')
    const wire = gateway()
    renderApp({ agent: wire.gateway, repositories: held, today: () => TODAY })
    await waitFor(() => expect(wire.bound()).toBe(true))
    expect((await wire.ask('app.open', { scope: '', page: 'people' })).page).toEqual({ page: 'people' })
    expect(await screen.findByTestId('people-topbar')).toBeDefined()
    const listed = await wire.ask('people.list')
    expect((listed.people as { name: string }[]).map((one) => one.name)).toEqual(['Pia Schulz'])
    await act(async () => { await wire.ask('person.add', { name: 'Sara Kaya' }) })
    await waitFor(() => expect(within(screen.getByTestId('people-table')).getByText('Sara Kaya')).toBeDefined())
  })

  it('applies the policy when the organisation is opened: a name kept past the period is forgotten', async () => {
    const held = heldRepositories([root])
    const gijs = await added(held, 'Gijs Mulder')
    await held.people.leave(gijs.id, '2026-06-01')
    const ada = await added(held, 'Ada Verbeek')
    await held.people.leave(ada.id, '2026-10-01')
    renderApp({ repositories: held, today: () => TODAY })
    await waitFor(async () => expect((await held.people.read(gijs.id))?.state).toBe('forgotten'))
    expect((await held.people.read(gijs.id))?.name).toBeUndefined()
    expect((await held.people.read(ada.id))?.name).toBe('Ada Verbeek')
  })
})

describe('a forget reaches everything that shows the person', () => {
  it('the page, the agent and a working file all show the pseudonym from then on', async () => {
    const held = heldRepositories([root])
    const gijs = await added(held, 'Gijs Mulder', 'gijs.mulder@acme.example')
    const wire = gateway()
    renderApp({ agent: wire.gateway, repositories: held, today: () => TODAY })
    await waitFor(() => expect(wire.bound()).toBe(true))
    await openPeople()
    expect(within(screen.getByTestId('people-table')).getByText('Gijs Mulder')).toBeDefined()
    expect(JSON.stringify(await wire.ask('people.list'))).toContain('Gijs Mulder')

    fireEvent.click(within(screen.getByTestId(`people-row-${gijs.id}`)).getByRole('button'))
    fireEvent.click(screen.getByTestId('people-forget'))
    fireEvent.click(within(await screen.findByRole('dialog', { name: 'Forget Gijs Mulder?' })).getByRole('button', { name: 'Forget now' }))

    const pseudonym = `Former colleague ${gijs.pseudonym}`
    await waitFor(() => expect(screen.getByTestId('people-person-name').textContent).toBe(pseudonym))
    expect(screen.getByTestId('people-table').textContent).not.toMatch(/Gijs|Mulder/)
    const listed = JSON.stringify(await wire.ask('people.list'))
    expect(listed).toContain(pseudonym)
    expect(listed).not.toMatch(/Gijs|Mulder/)

    // A working file carried out now carries the pseudonym and nothing else of them.
    const carried = await WORKING_FILE_INTERCHANGE.carryOut(held)
    const register = new TextDecoder().decode(unzipSync(carried.bytes)['.lionsville-architecture/people.json'])
    expect(register).toContain(gijs.pseudonym)
    expect(register).not.toMatch(/Gijs|Mulder|gijs\.mulder/)
  })
})

describe('a source that does more about its people than keep them', () => {
  it('applies the policy itself: the app forgets nobody when the organisation is opened', async () => {
    const held = heldRepositories([root])
    const gijs = await added(held, 'Gijs Mulder')
    await held.people.leave(gijs.id, '2026-06-01')
    renderApp({ repositories: held, today: () => TODAY, provider: { people: { appliesPolicy: true } } })
    await openPeople()
    expect(within(screen.getByTestId('people-table')).getByText('Gijs Mulder')).toBeDefined()
    expect((await held.people.read(gijs.id))?.state).toBe('left')
  })

  it('says who you are: *you* is marked from it, and *This is me* is not offered', async () => {
    const held = heldRepositories([root])
    const pia = await added(held, 'Pia Schulz')
    await added(held, 'Ruben Dekker')
    renderApp({ repositories: held, today: () => TODAY, provider: { people: { me: () => pia.id } } })
    await openPeople()
    await waitFor(() => expect(within(screen.getByTestId(`people-row-${pia.id}`)).getByText('you')).toBeDefined())
    fireEvent.click(within(screen.getByTestId(`people-row-${pia.id}`)).getByRole('button'))
    expect(await screen.findByTestId('people-this-is-you')).toBeDefined()
    expect(screen.queryByTestId('people-me')).toBeNull()
  })

  it('hears the register change elsewhere, and the page reads it again', async () => {
    const held = heldRepositories([root])
    await added(held, 'Pia Schulz')
    const heard = new Set<() => void>()
    const changes = (onChanged: () => void) => {
      heard.add(onChanged)
      return () => { heard.delete(onChanged) }
    }
    renderApp({ repositories: held, today: () => TODAY, provider: { people: { changes } } })
    await openPeople()
    await waitFor(() => expect(heard.size).toBe(1))
    // Somebody else adds a person, through the register and not this window.
    await added(held, 'Sara Kaya')
    act(() => { for (const one of heard) one() })
    await waitFor(() => expect(within(screen.getByTestId('people-table')).getByText('Sara Kaya')).toBeDefined())
  })

  it('says who may do what, which address it keeps, and whom its schedule held back: the page offers and says only that', async () => {
    const held = heldRepositories([root])
    const pia = await added(held, 'Pia Schulz')
    const gijs = await added(held, 'Gijs Mulder')
    await held.people.leave(gijs.id, '2026-06-01')
    renderApp({
      repositories: held, today: () => TODAY,
      provider: { people: {
        appliesPolicy: true,
        may: (action, id) => action === 'change' && id === pia.id,
        withheld: (id) => id === pia.id,
        held: (id) => (id === gijs.id ? 'signedInSinceLeaving' : undefined),
      } },
    })
    await openPeople()
    expect(screen.queryByTestId('people-add')).toBeNull()
    fireEvent.click(within(await screen.findByTestId(`people-row-${pia.id}`)).getByRole('button'))
    expect(await screen.findByTestId('people-correct')).toBeDefined()
    expect(screen.queryByTestId('people-forget')).toBeNull()
    expect(screen.getByTestId('people-person-email').textContent).toBe('an address not shown to you')
    fireEvent.click(within(screen.getByTestId(`people-row-${gijs.id}`)).getByRole('button'))
    expect((await screen.findByTestId('people-held-back')).textContent).toMatch(/signed in after their last day/)
  })

  /**
   * A source only read to this person that grants a right from a managing
   * role (ADR-0036 §12): the person it says is using the app, holding one
   * today, may change the register as its `may` says; nobody else may.
   */
  it('lets a person who manages a unit change what the source says they may, where the source is otherwise only read', async () => {
    const organisation: ScopeSnapshot = {
      ...root,
      model: {
        ...root.model,
        elements: [{ id: 'webshop', kind: 'actor', name: 'Webshop', lifecycle: 'live', isManaged: false, aspects: {}, unitTypeId: 'ut-team' }],
        unitTypes: [{ id: 'ut-team', name: 'Team', top: true, within: [], slots: [{ role: 'ro-lead', min: 1, max: 1 }] }],
        roles: [{ id: 'ro-lead', name: 'Team lead', duties: [], manages: true }],
        assignments: [{ id: 'as-1', unitId: 'webshop', roleId: 'ro-lead', person: { person: 'pe-pia' } }],
      },
    }
    const held = heldRepositories([organisation])
    await held.people.bringIn([{ id: 'pe-pia', name: 'Pia Schulz', pseudonym: 'BCDF', kind: 'internal', state: 'active' }])
    const source = { provider: 'browserStorage', name: 'This browser', key: 'browser', readOnly: true } as const
    const people = { appliesPolicy: true, me: () => 'pe-pia', may: (action: string) => action === 'add' }
    renderApp({ repositories: held, today: () => TODAY, source, provider: { people: { ...people, managingRight: true } } })
    await openPeople()
    expect(await screen.findByTestId('people-add')).toBeDefined()
    cleanup()
    // Without the right, or with nobody said to be using the app, a source only read offers nothing.
    renderApp({ repositories: held, today: () => TODAY, source, provider: { people } })
    await openPeople()
    expect(screen.queryByTestId('people-add')).toBeNull()
  })
})


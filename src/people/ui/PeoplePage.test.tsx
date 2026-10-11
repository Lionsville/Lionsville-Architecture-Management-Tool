// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The People page (ADR-0036), over a register held in this test and changed
 * by the register's own rules (`register.ts`): what a person sees, what each
 * gesture asks and does, and that nothing on it is offered where the
 * register is only read.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react'
import { useRef, useState } from 'react'
import { axeFindings } from '../../app/testing/axe'
import { renderShell } from '../../app/testing/renderShell'
import { translator } from '../../i18n'
import type { PersonId } from '../../model/person'
import type { Person } from '../person'
import type { HeldAssignment } from '../hold'
import { DEFAULT_POLICY } from '../policy'
import type { PeoplePolicy } from '../policy'
import { changePeople } from '../register'
import type { PeopleChange } from '../register'
import type { PeopleRegisterAccess } from './access'
import { PeoplePage } from './PeoplePage'

afterEach(() => cleanup())

const s = translator('en')
const TODAY = '2026-10-11'

const person = (id: string, name: string, extra: Partial<Person> = {}): Person => ({
  id, name, pseudonym: `P${id.slice(-3).toUpperCase().padStart(3, 'B')}`, kind: 'internal', state: 'active', ...extra,
})

const START: Person[] = [
  person('pe-pia', 'Pia Schulz', { email: 'pia.schulz@acme.example' }),
  person('pe-eva', 'Eva Lind', { email: 'eva.lind@acme.example' }),
  person('pe-evt', 'Eva Lindt'),
  person('pe-gijs', 'Gijs Mulder', { state: 'left', leftOn: '2026-08-14' }),
  { id: 'pe-gone', pseudonym: '7KQM', kind: 'external', state: 'forgotten', leftOn: '2025-06-30', forgottenOn: '2025-09-28' },
]

/** A register held in React state and changed by the register's own rules, as the shell's hook would. */
function Harness({ readOnly = false, me, onPolicy, mentions = [], held: holding, looking = false }: {
  readOnly?: boolean; me?: PersonId; onPolicy?: (change: Partial<PeoplePolicy>) => void; mentions?: { scope: string; kind: string; id: string; title: string }[]
  held?: Record<PersonId, HeldAssignment[]>; looking?: boolean
}) {
  const [day, setDay] = useState<string | undefined>(undefined)
  const [people, setPeople] = useState<readonly Person[]>(START)
  const [policy, setPolicy] = useState(DEFAULT_POLICY)
  const [who, setWho] = useState<PersonId | undefined>(me)
  // The latest register, written as each change lands: a run of changes in one handler reads what the last left.
  const held = useRef<readonly Person[]>(START)
  const change = (work: PeopleChange, show?: string) => {
    const count = held.current.length
    const answer = changePeople(held.current, work, { id: () => `pe-new${count}`, pseudonym: () => `N${count}ZZ` })
    if ('refused' in answer) return Promise.resolve(answer)
    held.current = answer.people
    setPeople(answer.people)
    const id = show ?? answer.changed[0]
    return Promise.resolve({ person: answer.people.find((one) => one.id === id)!, ended: 0, removed: answer.removed })
  }
  const register: PeopleRegisterAccess = {
    people, policy, me: who, readOnly, today: TODAY,
    add: (one) => change({ kind: 'add', person: one }),
    change: (id, patch) => change({ kind: 'change', id, patch }),
    leave: (id, on) => change({ kind: 'leave', id, on }),
    forget: (id, on) => change({ kind: 'forget', id, on }),
    remove: (id) => change({ kind: 'remove', id }),
    merge: (from, into) => change({ kind: 'merge', from, into }, into),
    setPolicy: (patch) => { onPolicy?.(patch); setPolicy((was) => ({ ...was, ...patch })); return Promise.resolve() },
    setMe: (id) => { setWho(id); return Promise.resolve() },
    mentionsOf: () => Promise.resolve(mentions),
    ...(holding ? { assignmentsOf: (id: PersonId) => holding[id] ?? [] } : {}),
  }
  const look = { ...(day !== undefined ? { day } : {}), onDay: setDay }
  return <PeoplePage open onClose={() => {}} register={register} copyText={() => {}} s={s} {...(looking ? { look } : {})} />
}

const row = (id: string) => screen.getByTestId(`people-row-${id}`)
const pick = (id: string) => fireEvent.click(within(row(id)).getByRole('button'))

describe('the People page, as axe reads it', () => {
  it('finds nothing on the list with a person picked', async () => {
    renderShell(<Harness />)
    pick('pe-pia')
    expect(await axeFindings()).toEqual([])
  })
})

describe('the People page', () => {
  it('lists everyone but the redirects, says the counts, and that nothing here is a step', () => {
    renderShell(<Harness />)
    expect(screen.getByTestId('people-counts').textContent).toBe('3 active · 1 left · 1 forgotten')
    expect(screen.getByTestId('people-not-a-step').textContent).toContain('Not a step')
    expect(row('pe-gone').textContent).toContain('Former colleague 7KQM')
    fireEvent.change(screen.getByTestId('people-search'), { target: { value: 'lind' } })
    expect(screen.queryByTestId('people-row-pe-pia')).toBeNull()
    expect(row('pe-eva')).toBeDefined()
  })

  it('suggests Pia Schulz before it adds a Pia Schultz, and uses her rather than adding anyone', async () => {
    renderShell(<Harness />)
    fireEvent.click(screen.getByTestId('people-add'))
    fireEvent.change(screen.getByTestId('people-add-name'), { target: { value: 'Pia Schultz' } })
    const similar = screen.getByTestId('people-add-similar')
    expect(similar.textContent).toContain('Pia Schulz — nearly the same name')
    expect(screen.getByTestId('people-add-save').textContent).toBe('Add anyway')
    fireEvent.click(within(similar).getByRole('button', { name: 'Use this one' }))
    expect(screen.getByTestId('people-person-name').textContent).toBe('Pia Schulz')
    expect(screen.getByTestId('people-counts').textContent).toBe('3 active · 1 left · 1 forgotten')
  })

  it('adds somebody nobody resembles, and says it is no step', async () => {
    renderShell(<Harness />)
    fireEvent.click(screen.getByTestId('people-add'))
    fireEvent.change(screen.getByTestId('people-add-name'), { target: { value: 'Ruben Dekker' } })
    expect(screen.getByText('No one like this in the register.')).toBeDefined()
    fireEvent.click(screen.getByTestId('people-add-save'))
    await waitFor(() => expect(screen.getByTestId('people-person-name').textContent).toBe('Ruben Dekker'))
    expect(screen.getByTestId('people-said').textContent).toContain('It is not a step')
  })

  it('merges a duplicate pair after asking, and the one absorbed leaves the list', async () => {
    renderShell(<Harness />)
    const duplicates = screen.getByTestId('people-duplicates')
    expect(duplicates.textContent).toContain('Eva Lindt and Eva Lind: nearly the same name.')
    fireEvent.click(within(duplicates).getByRole('button', { name: 'Merge Eva Lindt into Eva Lind' }))
    const dialog = await screen.findByRole('dialog', { name: 'Merge Eva Lindt into Eva Lind?' })
    expect(dialog.textContent).toContain('A merge is final')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Merge' }))
    await waitFor(() => expect(screen.queryByTestId('people-row-pe-evt')).toBeNull())
    expect(screen.queryByTestId('people-duplicates')).toBeNull()
  })

  it('marks someone as left on their last day, and says when the name goes', async () => {
    renderShell(<Harness />)
    pick('pe-pia')
    fireEvent.change(screen.getByLabelText('Last day'), { target: { value: '2026-10-31' } })
    fireEvent.click(screen.getByTestId('people-leave'))
    await waitFor(() => expect(screen.getByTestId('people-said').textContent)
      .toBe('Pia Schulz is marked as left on 2026-10-31. The name is shown until 2027-01-29.'))
    expect(row('pe-pia').textContent).toContain('Left 2026-10-31')
  })

  it('forgets after asking: the name goes from every line of the page, and the pseudonym stands in', async () => {
    renderShell(<Harness />)
    pick('pe-gijs')
    fireEvent.click(screen.getByTestId('people-forget'))
    const dialog = await screen.findByRole('dialog', { name: 'Forget Gijs Mulder?' })
    expect(dialog.textContent).toContain('Former colleague PIJS')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Forget now' }))
    await waitFor(() => expect(screen.getByTestId('people-person-name').textContent).toBe('Former colleague PIJS'))
    for (const part of ['people-table', 'people-person', 'people-said', 'people-topbar']) {
      expect(screen.getByTestId(part).textContent, part).not.toMatch(/Gijs|Mulder/)
    }
  })

  it('removes a forgotten entry after asking', async () => {
    renderShell(<Harness />)
    pick('pe-gone')
    fireEvent.click(screen.getByTestId('people-remove'))
    const dialog = await screen.findByRole('dialog', { name: 'Remove Former colleague 7KQM?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Remove now' }))
    await waitFor(() => expect(screen.queryByTestId('people-row-pe-gone')).toBeNull())
  })

  it('answers a request for access with what we hold, and the free text a forget cannot reach', async () => {
    renderShell(<Harness mentions={[{ scope: 'acme', kind: 'observation', id: 'ob-1', title: 'Seen by Pia Schulz' }]} />)
    pick('pe-pia')
    fireEvent.click(screen.getByTestId('people-hold-toggle'))
    const held = JSON.parse(screen.getByTestId('people-hold').textContent ?? '{}')
    expect(held.register).toMatchObject({ id: 'pe-pia', name: 'Pia Schulz', email: 'pia.schulz@acme.example' })
    await waitFor(() => expect(screen.getByText(/Search finds them: 1 found/)).toBeDefined())
  })

  it('says what a person holds on the day the page is looked at, and back on today again', () => {
    const held: HeldAssignment[] = [
      { id: 'as-1', scope: 'customer', unit: 'Webshop', role: 'Product owner', from: '2022-01-01', until: '2026-12-31' },
      { id: 'as-2', scope: 'shipping', unit: 'Parcel', role: 'Cluster lead', from: '2027-01-01' },
    ]
    renderShell(<Harness held={{ 'pe-pia': held }} looking />)
    pick('pe-pia')
    expect(screen.getByText('Holds today')).toBeTruthy()
    expect((screen.getByTestId('people-look') as HTMLInputElement).value).toBe(TODAY)
    fireEvent.change(screen.getByTestId('people-look'), { target: { value: '2027-01-01' } })
    expect(screen.getByText('Holds on 2027-01-01')).toBeTruthy()
    expect(screen.getByText('Held before')).toBeTruthy()
    expect(screen.queryByText('Will hold')).toBeNull()
    expect(screen.getAllByTestId('people-held')[0].textContent).toBe('Cluster lead in Parcel · from 2027-01-01')
    fireEvent.click(screen.getByTestId('people-look-today'))
    expect(screen.getByText('Holds today')).toBeTruthy()
    expect(screen.queryByTestId('people-look-today')).toBeNull()
  })

  it('says what a person holds today, will hold and held before, and counts it in what we hold', () => {
    const held: HeldAssignment[] = [
      { id: 'as-1', scope: 'customer', unit: 'Webshop', role: 'Product owner', from: '2022-01-01' },
      { id: 'as-2', scope: 'shipping', unit: 'Parcel', role: 'Cluster lead', share: 0.5, acting: true, from: '2027-01-01' },
      { id: 'as-3', scope: 'customer', unit: 'Mobile App', role: 'Team coach', until: '2026-08-14' },
    ]
    renderShell(<Harness held={{ 'pe-pia': held }} />)
    pick('pe-pia')
    expect(screen.getAllByTestId('people-held').map((line) => line.textContent)).toEqual([
      'Product owner in Webshop · from 2022-01-01',
      'Cluster lead in Parcel · 50% · acting · from 2027-01-01',
      'Team coach in Mobile App · until 2026-08-14',
    ])
    expect(screen.getByText('Will hold')).toBeTruthy()
    expect(screen.getByText('Held before')).toBeTruthy()
    fireEvent.click(screen.getByTestId('people-hold-toggle'))
    expect(JSON.parse(screen.getByTestId('people-hold').textContent ?? '{}').assignments).toEqual([
      'Product owner in Webshop (customer), 2022-01-01 – …',
      'Cluster lead in Parcel (shipping), 50%, acting, 2027-01-01 – …',
      'Team coach in Mobile App (customer), … – 2026-08-14',
    ])
    cleanup()
    renderShell(<Harness held={{}} />)
    pick('pe-pia')
    expect(screen.getByText('Nothing.')).toBeTruthy()
  })

  it('says This is me, and marks you in the list', async () => {
    renderShell(<Harness />)
    pick('pe-eva')
    fireEvent.click(screen.getByTestId('people-me'))
    await waitFor(() => expect(screen.getByTestId('people-this-is-you')).toBeDefined())
    expect(within(row('pe-eva')).getByText('you')).toBeDefined()
  })

  it('corrects a name', async () => {
    renderShell(<Harness />)
    pick('pe-evt')
    fireEvent.click(screen.getByRole('button', { name: 'Correct…' }))
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Eva Lindt-Bos' } })
    fireEvent.click(within(screen.getByTestId('people-person')).getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(row('pe-evt').textContent).toContain('Eva Lindt-Bos'))
  })

  it('changes the policy as the organisation’s setting', async () => {
    const onPolicy = vi.fn()
    renderShell(<Harness onPolicy={onPolicy} />)
    fireEvent.change(screen.getByLabelText('Keep a leaver’s name for (days)'), { target: { value: '30' } })
    fireEvent.click(screen.getByTestId('people-policy-save'))
    await waitFor(() => expect(onPolicy).toHaveBeenCalledWith({ keepNameDays: 30, removeAfterDays: 730, agentsSee: 'names' }))
  })

  it('imports a list, each row through the duplicate check, adding only what is new or ticked', async () => {
    renderShell(<Harness />)
    fireEvent.click(screen.getByTestId('people-import'))
    fireEvent.change(screen.getByTestId('people-csv-text'), {
      target: { value: 'name,email\nPia S.,pia.schulz@acme.example\nPia Schultz,\nSara Kaya,sara@acme.example\n,x@acme.example' },
    })
    const rows = screen.getByTestId('people-csv-rows')
    expect(rows.textContent).toContain('Already there: Pia Schulz')
    expect(rows.textContent).toContain('Maybe Pia Schulz')
    expect(rows.textContent).toContain('New')
    expect(rows.textContent).toContain('No name: skipped')
    expect(screen.getByTestId('people-csv-add').textContent).toBe('Add 1 person')
    fireEvent.click(screen.getByLabelText('Add anyway: Pia Schultz'))
    expect(screen.getByTestId('people-csv-add').textContent).toBe('Add 2 people')
    await act(async () => { fireEvent.click(screen.getByTestId('people-csv-add')) })
    await waitFor(() => expect(screen.getByTestId('people-said').textContent).toBe('2 people added to the register.'))
    expect(screen.getByTestId('people-counts').textContent).toBe('5 active · 1 left · 1 forgotten')
  })

  it('offers nothing that changes the register where it is only read', () => {
    renderShell(<Harness readOnly />)
    expect(screen.queryByTestId('people-add')).toBeNull()
    expect(screen.queryByTestId('people-import')).toBeNull()
    expect(screen.queryByTestId('people-duplicates')).toBeNull()
    pick('pe-pia')
    expect(screen.queryByTestId('people-forget')).toBeNull()
    expect(screen.queryByTestId('people-me')).toBeNull()
    expect(screen.queryByTestId('people-policy-save')).toBeNull()
    expect(screen.getByTestId('people-not-a-step').textContent).toBe('The register is read here and not changed.')
  })
})

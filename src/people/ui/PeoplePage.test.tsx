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
import type { DistinctPair } from '../distinct'
import type { Person } from '../person'
import type { HeldAssignment, PointsAt, Reporting } from '../hold'
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
function Harness({ reporting, readOnly = false, me, onPolicy, mentions = [], held: holding, looking = false, pointsAt, source, start = START, answered = [], open = true }: {
  reporting?: Record<PersonId, Reporting>
  readOnly?: boolean; me?: PersonId; onPolicy?: (change: Partial<PeoplePolicy>) => void; mentions?: { scope: string; kind: string; id: string; title: string }[]
  held?: Record<PersonId, HeldAssignment[]>; looking?: boolean; pointsAt?: Record<PersonId, PointsAt> | 'unreadable'
  /** What a source that knows who may do what says (`SourcePeople.may`, `withheld`, `held`, `linked`), and whom a manager reaches. */
  source?: Pick<PeopleRegisterAccess, 'may' | 'withheld' | 'held' | 'linked' | 'managesBoth'>
  start?: readonly Person[]
  /** The pairs answered as not the same person to start with. */
  answered?: readonly DistinctPair[]
  open?: boolean
}) {
  const [day, setDay] = useState<string | undefined>(undefined)
  const [people, setPeople] = useState<readonly Person[]>(start)
  const [distinct, setDistinct] = useState<readonly DistinctPair[]>(answered)
  const [policy, setPolicy] = useState(DEFAULT_POLICY)
  const [who, setWho] = useState<PersonId | undefined>(me)
  // The latest register, written as each change lands: a run of changes in one handler reads what the last left.
  const held = useRef<readonly Person[]>(start)
  const pairs = useRef<readonly DistinctPair[]>(answered)
  const changed = (work: PeopleChange) => {
    const count = held.current.length
    const answer = changePeople(held.current, work, { id: () => `pe-new${count}`, pseudonym: () => `N${count}ZZ` }, new Set(), pairs.current)
    if ('refused' in answer) return answer
    held.current = answer.people
    pairs.current = answer.distinct
    setPeople(answer.people)
    setDistinct(answer.distinct)
    return answer
  }
  const change = (work: PeopleChange, show?: string) => {
    const answer = changed(work)
    if ('refused' in answer) return Promise.resolve(answer)
    const id = show ?? answer.changed[0]
    return Promise.resolve({ person: answer.people.find((one) => one.id === id)!, ended: 0, removed: answer.removed })
  }
  const register: PeopleRegisterAccess = {
    people, policy, me: who, readOnly, today: TODAY, distinct,
    answerDistinct: (a, b) => {
      const answer = changed({ kind: 'distinct', a, b, on: TODAY })
      return Promise.resolve('refused' in answer ? answer : { pair: answer.distinct[0] })
    },
    takeBackDistinct: (a, b) => {
      const answer = changed({ kind: 'takeBack', a, b })
      return Promise.resolve({ taken: !('refused' in answer) && answer.distinctChanged })
    },
    add: (one) => change({ kind: 'add', person: one }),
    change: (id, patch) => change({ kind: 'change', id, patch }),
    leave: (id, on) => change({ kind: 'leave', id, on }),
    takeBackLeaving: (id) => { const answer = changed({ kind: 'takeBackLeaving', id }); return Promise.resolve('refused' in answer ? answer : { person: answer.people.find((one) => one.id === id)!, restored: 2 }) },
    forget: (id, on) => change({ kind: 'forget', id, on }),
    remove: (id) => change({ kind: 'remove', id }),
    merge: (from, into, leaving) => { merges.push(leaving); return change({ kind: 'merge', from, into, ...(leaving ? { leaving } : {}) }, into) },
    setPolicy: (patch) => { onPolicy?.(patch); setPolicy((was) => ({ ...was, ...patch })); return Promise.resolve() },
    setMe: (id) => { setWho(id); return Promise.resolve() },
    mentionsOf: () => Promise.resolve(mentions),
    ...(holding ? { assignmentsOf: (id: PersonId) => holding[id] ?? [] } : {}),
    ...(pointsAt === 'unreadable' ? { pointsAt: () => Promise.reject(new Error('the tree will not read')) } : {}),
    ...(pointsAt && pointsAt !== 'unreadable' ? { pointsAt: (id: PersonId) => Promise.resolve(pointsAt[id] ?? { pointers: [], byRule: [] }) } : {}),
    ...(reporting ? { reportingOf: (id: PersonId) => reporting[id] ?? { reportsTo: [], manages: [] } } : {}),
    ...source,
  }
  const look = { ...(day !== undefined ? { day } : {}), onDay: setDay }
  return <PeoplePage open={open} onClose={() => {}} register={register} copyText={copied} s={s} {...(looking ? { look } : {})} />
}

/** What each merge was told, in order: still here, left, or nothing. */
const merges: (string | undefined)[] = []
/** What was copied. */
const copied = vi.fn()
afterEach(() => { merges.length = 0; copied.mockClear() })

const rowOf = (id: string) => document.querySelector<HTMLElement>(`[data-kit-row="row:${id}"]`)
const row = (id: string) => rowOf(id) as HTMLElement
const shownIds = () => [...document.querySelectorAll<HTMLElement>('[data-kit-row^="row:"]')].map((one) => (one.dataset.kitRow ?? '').slice(4))
const pick = (id: string) => fireEvent.click(row(id))
const leavePerson = () => fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
const said = () => document.querySelector('.kit-toast')?.textContent ?? ''
const find = (text: string) => fireEvent.change(screen.getByRole('searchbox'), { target: { value: text } })
const tab = (name: RegExp | string) => fireEvent.click(screen.getByRole('tab', { name }))
/** An act from the one ⋯ of the person up. */
const fromMenu = async (name: string) => {
  fireEvent.click(document.querySelector('[data-guide="people.more"]') as HTMLElement)
  fireEvent.click(await screen.findByRole('menuitem', { name }))
}
const menuWords = async () => {
  fireEvent.click(document.querySelector('[data-guide="people.more"]') as HTMLElement)
  const words = (await screen.findAllByRole('menuitem')).map((one) => one.textContent?.trim())
  fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' })
  return words
}
const review = () => tab(/To review/)
const answerDialog = (name: RegExp | string) => screen.findByRole('dialog', { name })
/** *Merge…* on the pair of Eva Lind and Eva Lindt, the dialog it opens. */
const mergeEvas = () => {
  review()
  fireEvent.click(screen.getByRole('button', { name: 'Merge… Eva Lind and Eva Lindt' }))
  return answerDialog('Which one stays?')
}

describe('the People page, as axe reads it', () => {
  it('finds nothing on the list, nor with a person up', async () => {
    renderShell(<Harness />)
    expect(await axeFindings()).toEqual([])
    pick('pe-pia')
    expect(await axeFindings()).toEqual([])
  })
})

describe('the People page, as a directory', () => {
  it('lists everyone but the redirects, says the counts, and in its foot that nothing here is a step', () => {
    renderShell(<Harness />)
    expect(screen.getByTestId('people-counts').textContent).toBe('3 active · 1 left · 1 forgotten')
    expect(screen.getByTestId('people-not-a-step').textContent).toContain('no undo and no line in Activity')
    fireEvent.click(screen.getByRole('button', { name: 'About the register' }))
    expect(screen.getByText(/one entry each, by an id/)).toBeDefined()
    expect(row('pe-gone').textContent).toContain('Former colleague 7KQM')
    find('lind')
    expect(rowOf('pe-pia')).toBeNull()
    expect(rowOf('pe-eva')).not.toBeNull()
  })

  it('is one line a person, a word only where something differs', () => {
    renderShell(<Harness me="pe-eva" start={[...START, person('pe-ext', 'Sam Okafor', { kind: 'external' })]} />)
    expect(row('pe-eva').textContent).toContain('you')
    expect(row('pe-ext').textContent).toContain('External')
    expect(row('pe-gijs').textContent).toContain('Left 14 Aug 2026')
    expect(row('pe-pia').querySelector('.kit-list__note')).toBeNull()
  })

  it('starts ready to type, finds on /, and goes down into the rows and opens by Enter', async () => {
    renderShell(<Harness />)
    const field = screen.getByRole('searchbox')
    field.blur()
    fireEvent.keyDown(window, { key: '/' })
    expect(document.activeElement).toBe(field)
    fireEvent.keyDown(field, { key: 'ArrowDown' })
    const first = document.activeElement as HTMLElement
    expect(first.dataset.kitRow).toBeDefined()
    fireEvent.keyDown(first, { key: 'Enter' })
    expect(await screen.findByTestId('people-person')).toBeDefined()
  })

  it('finds by the words a row says, and filters by kind and by holding nothing', () => {
    renderShell(<Harness start={[...START, person('pe-ext', 'Sam Okafor', { kind: 'external' })]} held={{ 'pe-pia': [{ id: 'as-1', scope: 'x', unit: 'Parcel', role: 'Lead' }] }} />)
    find('external')
    expect(shownIds()).toContain('pe-ext')
    find('holds nothing')
    expect(shownIds()).not.toContain('pe-pia')
    find('')
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Holds nothing/ }))
    expect(shownIds()).not.toContain('pe-pia')
    expect(shownIds()).toContain('pe-eva')
  })

  it('answers a search that finds nobody with who was probably meant, and adding the name', async () => {
    renderShell(<Harness />)
    find('Pia Schultz')
    const none = screen.getByTestId('people-no-match')
    expect(none.textContent).toContain('Nobody is called “Pia Schultz”. Did you mean:')
    fireEvent.click(within(none).getByRole('button', { name: 'Pia Schulz' }))
    expect(screen.getByTestId('people-person-name').textContent).toBe('Pia Schulz')
    leavePerson()
    await waitFor(() => expect(screen.queryByTestId('people-person')).toBeNull())
    fireEvent.click(within(screen.getByTestId('people-no-match')).getByTestId('people-add-typed'))
    expect((screen.getByTestId('people-add-name') as HTMLInputElement).value).toBe('Pia Schultz')
  })

  it('says it is empty truthfully: a first step for who may add, and no promise to a reader', () => {
    renderShell(<Harness start={[]} />)
    expect(screen.getByText('Nobody is in the register yet')).toBeDefined()
    expect(screen.getAllByRole('button', { name: 'Add person' }).length).toBeGreaterThan(1)
    cleanup()
    renderShell(<Harness start={[]} readOnly />)
    expect(screen.getByText('Whoever keeps the register adds people here.')).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Add person' })).toBeNull()
  })

  it('suggests Pia Schulz before it adds a Pia Schultz, and uses her rather than adding anyone', async () => {
    renderShell(<Harness />)
    fireEvent.click(screen.getByTestId('people-add'))
    fireEvent.change(screen.getByTestId('people-add-name'), { target: { value: 'Pia Schultz' } })
    const similar = screen.getByTestId('people-add-similar')
    expect(similar.textContent).toContain('Pia Schulz · pia.schulz@acme.example · nearly the same name')
    expect(screen.getByTestId('people-add-save').textContent).toBe('Add anyway')
    fireEvent.click(within(similar).getByRole('button', { name: 'Use this one' }))
    await waitFor(() => expect(screen.getByTestId('people-person-name').textContent).toBe('Pia Schulz'))
    expect(screen.getByTestId('people-counts').textContent).toBe('3 active · 1 left · 1 forgotten')
  })

  it('adds somebody nobody resembles, and says it is no step', async () => {
    renderShell(<Harness />)
    fireEvent.click(screen.getByTestId('people-add'))
    fireEvent.change(screen.getByTestId('people-add-name'), { target: { value: 'Ruben Dekker' } })
    expect(screen.getByText('No one like this in the register.')).toBeDefined()
    fireEvent.click(screen.getByTestId('people-add-save'))
    await waitFor(() => expect(screen.getByTestId('people-person-name').textContent).toBe('Ruben Dekker'))
    await waitFor(() => expect(said()).toContain('It is not a step'))
  })

  it('imports a list, each row through the duplicate check, with a tally, adding only what is new or ticked', async () => {
    renderShell(<Harness />)
    fireEvent.click(screen.getByTestId('people-import'))
    fireEvent.change(screen.getByTestId('people-csv-text'), {
      target: { value: 'name,email\nPia S.,pia.schulz@acme.example\nPia Schultz,\nSara Kaya,sara@acme.example\n,x@acme.example' },
    })
    const rows = screen.getByTestId('people-csv-rows')
    expect(rows.textContent).toContain('Already there: Pia Schulz')
    expect(rows.textContent).toContain('Maybe Pia Schulz (pia.schulz@acme.example), nearly the same name')
    expect(rows.textContent).toContain('New')
    expect(rows.textContent).toContain('No name: skipped')
    expect(screen.getByTestId('people-csv-tally').textContent).toBe('1 new · 1 to decide · 1 already there')
    expect(screen.getByTestId('people-csv-add').textContent).toBe('Add 1 person')
    fireEvent.click(screen.getByLabelText('Add anyway: Pia Schultz'))
    expect(screen.getByTestId('people-csv-add').textContent).toBe('Add 2 people')
    await act(async () => { fireEvent.click(screen.getByTestId('people-csv-add')) })
    await waitFor(() => expect(said()).toBe('2 people added to the register.'))
    expect(screen.getByTestId('people-counts').textContent).toBe('5 active · 1 left · 1 forgotten')
  })

  it('says in each row the roles a person holds on the page\'s day, compactly, and none as such', async () => {
    const held: Record<PersonId, HeldAssignment[]> = {
      'pe-pia': [
        { id: 'as-1', scope: 'shipping', unit: 'Parcel', role: 'Product owner' },
        { id: 'as-2', scope: 'shipping', unit: 'Tracking', role: 'Developer', share: 0.5 },
        { id: 'as-3', scope: 'shipping', unit: 'Freight', role: 'Cluster lead', acting: true },
        { id: 'as-4', scope: 'customer', unit: 'Webshop', role: 'Team coach', until: '2026-08-14' },
        { id: 'as-5', scope: 'customer', unit: 'Webshop', role: 'Release manager', from: '2027-01-01' },
      ],
      'pe-eva': [{ id: 'as-6', scope: 'customer', unit: 'Webshop', role: 'Product owner', until: '2026-12-31' }],
    }
    renderShell(<Harness held={held} looking />)
    expect(screen.getByRole('columnheader', { name: 'Holds' })).toBeTruthy()
    const roles = (id: string) => within(row(id)).getByTestId('people-roles')
    expect(roles('pe-pia').textContent).toBe('Product owner, Parcel +2')
    expect(roles('pe-eva').textContent).toBe('Product owner, Webshop')
    expect(roles('pe-evt').textContent).toBe('Holds nothing')
    expect(await axeFindings()).toEqual([])
    find('tracking')
    expect(shownIds()).toEqual(['pe-pia'])
    find('')
    // Looked at on another day, the list says that day's, and a band says so.
    fireEvent.click(screen.getByRole('button', { name: 'Day' }))
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Choose a day…' }))
    fireEvent.change(await screen.findByLabelText('The day to look at'), { target: { value: '2027-01-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Show this day' }))
    await waitFor(() => expect(screen.getByRole('columnheader', { name: 'Holds on 1 Jan 2027' })).toBeTruthy())
    expect(screen.getByText('Looking at 1 Jan 2027.')).toBeTruthy()
    expect(roles('pe-pia').textContent).toBe('Product owner, Parcel +3')
    expect(roles('pe-eva').textContent).toBe('Holds nothing')
    fireEvent.click(screen.getByTestId('people-look-today'))
    expect(screen.getByRole('columnheader', { name: 'Holds' })).toBeTruthy()
    expect(screen.queryByTestId('people-look-today')).toBeNull()
  })

  it('has no roles column where the shell has no tree to read them from, and any column may be asked for', () => {
    renderShell(<Harness />)
    expect(screen.queryByRole('columnheader', { name: 'Holds' })).toBeNull()
    expect(screen.queryByTestId('people-roles')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'View' }))
    fireEvent.click(screen.getByRole('checkbox', { name: 'Work address' }))
    expect(screen.getByRole('columnheader', { name: /Work address/, hidden: true })).toBeTruthy()
    expect(row('pe-pia').textContent).toContain('pia.schulz@acme.example')
  })

  it('says an address kept from this person is kept, not missing', () => {
    renderShell(<Harness source={{ withheld: (id) => id === 'pe-evt' }} />)
    pick('pe-evt')
    expect(screen.getByTestId('people-person-email').textContent).toBe(s('people.emailWithheld'))
    leavePerson()
    pick('pe-pia')
    expect(screen.getByTestId('people-person-email').textContent).toBe('pia.schulz@acme.example')
  })
})

describe('a person', () => {
  it('walks the list from the page, and lets go back to the row', async () => {
    renderShell(<Harness />)
    pick('pe-eva')
    expect(screen.getByTestId('people-person-name').textContent).toBe('Eva Lind')
    fireEvent.click(screen.getByRole('button', { name: 'Next' }))
    expect(screen.getByTestId('people-person-name').textContent).toBe('Eva Lindt')
    leavePerson()
    await waitFor(() => expect(screen.queryByTestId('people-person')).toBeNull())
  })

  it('always answers who they report to and who reports to them, nearest first, with how each comes about', () => {
    const reporting: Record<PersonId, Reporting> = {
      'pe-pia': {
        reportsTo: [
          { person: 'pe-eva', role: 'Head', unit: 'Terminal', via: 'nesting' },
          { person: 'pe-evt', role: 'Lead', unit: 'Dock', via: 'override', functional: true },
          { person: 'pe-gijs', role: 'Director', unit: 'Group', via: 'line' },
          { person: 'pe-gone', role: 'Chair', unit: 'Board', via: 'nesting' },
        ],
        manages: [{ person: 'pe-evt', role: 'Member', unit: 'Parcel', via: 'nesting' }],
      },
    }
    renderShell(<Harness reporting={reporting} />)
    pick('pe-pia')
    const up = within(screen.getByTestId('people-reports-to')).getAllByTestId('people-reporting-line').map((one) => one.textContent)
    expect(up).toEqual([
      'Eva Lind, Head in Terminal · by nesting',
      'Eva Lindt, Lead in Dock · functional, an exception to the model',
      'Gijs Mulder, Director in Group · by line',
    ])
    fireEvent.click(screen.getByRole('button', { name: '1 more' }))
    expect(within(screen.getByTestId('people-reports-to')).getAllByTestId('people-reporting-line')).toHaveLength(4)
    expect(screen.getByTestId('people-manages').textContent).toBe('Eva Lindt, Member in Parcel · by nesting')
    // A person named there is a press away.
    fireEvent.click(screen.getAllByRole('button', { name: 'Eva Lind' })[0])
    expect(screen.getByTestId('people-person-name').textContent).toBe('Eva Lind')
  })

  it('says nobody rather than leaving the row out', () => {
    renderShell(<Harness reporting={{}} held={{}} />)
    pick('pe-pia')
    expect(screen.getByText('Nobody: holds no role on this day.')).toBeDefined()
    expect(screen.getByText('Nobody on this day.')).toBeDefined()
  })

  it('says what they hold today, and what they will hold and held before on a press', () => {
    const held: HeldAssignment[] = [
      { id: 'as-1', scope: 'customer', unit: 'Webshop', role: 'Product owner', from: '2022-01-01' },
      { id: 'as-2', scope: 'shipping', unit: 'Parcel', role: 'Cluster lead', share: 0.5, acting: true, from: '2027-01-01' },
      { id: 'as-3', scope: 'customer', unit: 'Mobile App', role: 'Team coach', until: '2026-08-14' },
    ]
    renderShell(<Harness held={{ 'pe-pia': held }} />)
    pick('pe-pia')
    expect(screen.getAllByTestId('people-held').map((line) => line.textContent)).toEqual(['Product owner in Webshop · from 1 Jan 2022'])
    fireEvent.click(screen.getByTestId('people-others'))
    expect(screen.getAllByTestId('people-held').map((line) => line.textContent)).toEqual([
      'Product owner in Webshop · from 1 Jan 2022',
      'Cluster lead in Parcel · 50% · acting · from 1 Jan 2027',
      'Team coach in Mobile App · until 14 Aug 2026',
    ])
    expect(screen.getByText('Will hold')).toBeTruthy()
    expect(screen.getByText('Held before')).toBeTruthy()
    leavePerson()
    cleanup()
    renderShell(<Harness held={{}} />)
    pick('pe-pia')
    expect(screen.getByText('Nothing.')).toBeTruthy()
  })

  it('shows where a leaver stands as three dates, and what held them back', () => {
    renderShell(<Harness source={{ held: (id) => (id === 'pe-gijs' ? 'signedInSinceLeaving' : undefined) }} />)
    pick('pe-gijs')
    expect(screen.getByTestId('people-steps').textContent).toBe('Left14 Aug 2026Name forgotten12 Nov 2026Entry removed11 Nov 2028')
    expect(screen.getByTestId('people-held-back').textContent).toContain(s('people.heldSignedIn'))
    expect(within(screen.getByTestId('people-held-back')).getByRole('button', { name: 'Forget now…' })).toBeDefined()
    expect(screen.queryByText(s('people.leftDue'))).toBeNull()
  })

  it('says This is me from its menu, and marks you in the list', async () => {
    renderShell(<Harness />)
    pick('pe-eva')
    await fromMenu('This is me')
    await waitFor(() => expect(screen.getByTestId('people-this-is-you')).toBeDefined())
    expect(row('pe-eva').textContent).toContain('you')
  })

  it('says This is you on the entry a merge kept, where This is me named the one merged into it', () => {
    renderShell(<Harness me="pe-lindt" start={[...START, { id: 'pe-lindt', pseudonym: 'GHJK', kind: 'internal', state: 'active', mergedInto: 'pe-pia' }]} />)
    pick('pe-pia')
    expect(screen.getByTestId('people-this-is-you')).toBeDefined()
  })

  it('finds you: the whole list, and your entry up (ADR-0036 §11)', async () => {
    renderShell(<Harness />)
    expect(screen.queryByTestId('people-find-me')).toBeNull()
    pick('pe-eva')
    await fromMenu('This is me')
    leavePerson()
    await waitFor(() => expect(screen.getByTestId('people-find-me')).toBeDefined())
    find('Pia')
    expect(rowOf('pe-eva')).toBeNull()
    fireEvent.click(screen.getByTestId('people-find-me'))
    expect(rowOf('pe-eva')).not.toBeNull()
    expect(screen.getByTestId('people-person-name').textContent).toBe('Eva Lind')
  })

  it('corrects a name', async () => {
    renderShell(<Harness />)
    pick('pe-evt')
    fireEvent.click(screen.getByRole('button', { name: 'Correct…' }))
    fireEvent.change(screen.getByTestId('people-correct-name'), { target: { value: 'Eva Lindt-Bos' } })
    fireEvent.click(screen.getByTestId('people-correct-save'))
    await waitFor(() => expect(row('pe-evt').textContent).toContain('Eva Lindt-Bos'))
  })

  it('offers nothing that changes the register where it is only read', async () => {
    renderShell(<Harness readOnly />)
    expect(screen.queryByTestId('people-add')).toBeNull()
    expect(screen.queryByTestId('people-import')).toBeNull()
    expect(screen.queryByRole('tab', { name: /To review/ })).toBeNull()
    pick('pe-pia')
    expect(screen.queryByTestId('people-correct')).toBeNull()
    expect(await menuWords()).toEqual(['What we hold…'])
    expect(screen.getByTestId('people-not-a-step').textContent).toBe('The register is read here and not changed.')
  })

  it('offers each change only to whoever the source says may make it, of the entry it says', async () => {
    // A contributor who manages Pia: adds people, corrects and lets go of Pia, and merges, forgets and removes nobody.
    const may = (action: string, id?: string) => action === 'add' || ((action === 'change' || action === 'leave') && id === 'pe-pia')
    renderShell(<Harness source={{ may, }} />)
    expect(screen.getByTestId('people-add')).toBeTruthy()
    expect(screen.queryByRole('tab', { name: /To review/ })).toBeNull()
    pick('pe-pia')
    expect(screen.getByTestId('people-correct')).toBeTruthy()
    const words = await menuWords()
    expect(words).toContain('Mark as left…')
    expect(words).not.toContain('Forget now…')
    expect(words).not.toContain('Merge with someone…')
    leavePerson()
    await waitFor(() => expect(screen.queryByTestId('people-person')).toBeNull())
    // Eva is somebody else's: nothing to do with her here.
    pick('pe-eva')
    expect(screen.queryByTestId('people-correct')).toBeNull()
    expect(await menuWords()).not.toContain('Mark as left…')
  })
})

describe('leaving', () => {
  const held = {
    'pe-pia': [{ id: 'as-1', scope: 'x', unit: 'Dock crew', role: 'Lead' }, { id: 'as-2', scope: 'x', unit: 'Parcel', role: 'Member' }],
    'pe-eva': [{ id: 'as-3', scope: 'x', unit: 'Parcel', role: 'Member' }],
  }

  it('asks first, naming the day, each role that ends, a vacancy and the dates; and only then changes anything', async () => {
    renderShell(<Harness held={held} />)
    pick('pe-pia')
    await fromMenu('Mark as left…')
    const dialog = await answerDialog('Mark Pia Schulz as left')
    expect(row('pe-pia').textContent).not.toContain('Left')
    expect((within(dialog).getByTestId('people-last-day') as HTMLInputElement).value).toBe(TODAY)
    fireEvent.change(within(dialog).getByTestId('people-last-day'), { target: { value: '2026-10-31' } })
    const effects = within(dialog).getByTestId('people-leave-effects').textContent
    expect(effects).toContain('Ends 2 roles on that day: Lead in Dock crew, Member in Parcel.')
    expect(within(dialog).getAllByTestId('people-leave-vacancy').map((one) => one.textContent?.trim())).toEqual(['Dock crew then has no Lead.'])
    expect(effects).toContain('Keeps the name on every screen until 29 Jan 2027, then shows a pseudonym.')
    expect(effects).toContain('Removes the entry on 28 Jan 2029.')
    expect(dialog.textContent).toContain('can be taken back until the name is forgotten')
    fireEvent.click(within(dialog).getByTestId('people-leave-confirm'))
    await waitFor(() => expect(row('pe-pia').textContent).toContain('Left 31 Oct 2026'))
    await waitFor(() => expect(said()).toContain('Pia Schulz is marked as left on 31 Oct 2026'))
  })

  it('cancels with nothing changed', async () => {
    renderShell(<Harness />)
    pick('pe-pia')
    await fromMenu('Mark as left…')
    fireEvent.click(within(await answerDialog('Mark Pia Schulz as left')).getByRole('button', { name: 'Cancel' }))
    await waitFor(() => expect(screen.queryByText('What this does')).toBeNull())
    expect(screen.getByTestId('people-counts').textContent).toBe('3 active · 1 left · 1 forgotten')
  })

  it('can be taken back until the name is forgotten: the entry is active again, and it says what was restored', async () => {
    renderShell(<Harness />)
    pick('pe-gijs')
    await fromMenu('Take back leaving…')
    const dialog = await answerDialog('Take back that Gijs Mulder left on 14 Aug 2026?')
    expect(dialog.textContent).toContain('restored by steps')
    fireEvent.click(within(dialog).getByTestId('people-take-back-confirm'))
    await waitFor(() => expect(screen.getByTestId('people-counts').textContent).toBe('4 active · 0 left · 1 forgotten'))
    await waitFor(() => expect(said()).toContain('Gijs Mulder is active again; 2 roles restored'))
  })

  it('offers no taking back on anybody active or forgotten', async () => {
    renderShell(<Harness />)
    pick('pe-pia')
    expect(await menuWords()).not.toContain('Take back leaving…')
    leavePerson()
    await waitFor(() => expect(screen.queryByTestId('people-person')).toBeNull())
    pick('pe-gone')
    expect(await menuWords()).not.toContain('Take back leaving…')
  })
})

describe('forgetting and removing', () => {
  it('forgets after asking with the facts: the name goes from every line of the page, and the pseudonym stands in', async () => {
    renderShell(<Harness
      held={{ 'pe-pia': [{ id: 'as-1', scope: 'x', unit: 'Fleet', role: 'Lead' }] }}
      pointsAt={{ 'pe-pia': { byRule: [], pointers: [{ scope: 'r', kind: 'element', id: 'crm', title: 'CRM', field: 'owner', person: 'pe-pia' }] } }}
      mentions={[{ scope: 'r', kind: 'observation', id: 'ob-1', title: 'Seen by Pia Schulz' }]}
    />)
    pick('pe-pia')
    await fromMenu('Forget now…')
    const dialog = await answerDialog('Forget Pia Schulz?')
    await waitFor(() => expect(within(dialog).getByTestId('people-forget-effects').textContent).toContain('1 record points at them'))
    const effects = within(dialog).getByTestId('people-forget-effects')
    expect(effects.textContent).toContain('Still active: 1 role ends today, Lead in Fleet.')
    await waitFor(() => expect(effects.textContent).toContain('A forget cannot reach 1 record that names them in typed text.'))
    fireEvent.click(within(effects).getByTestId('people-forget-find'))
    expect(effects.textContent).toContain('Seen by Pia Schulz')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Forget Pia Schulz' }))
    await waitFor(() => expect(screen.getByTestId('people-person-name').textContent).toMatch(/^Former colleague/))
    for (const part of ['people-table', 'people-person', 'people-topbar']) {
      expect(screen.getByTestId(part).textContent, part).not.toMatch(/Pia|Schulz/)
    }
  })

  it('removes a forgotten entry after asking', async () => {
    renderShell(<Harness />)
    pick('pe-gone')
    await fromMenu('Remove now…')
    const dialog = await answerDialog('Remove Former colleague 7KQM?')
    fireEvent.click(within(dialog).getByTestId('people-remove-confirm'))
    await waitFor(() => expect(rowOf('pe-gone')).toBeNull())
    await waitFor(() => expect(screen.queryByTestId('people-person')).toBeNull())
  })
})

describe('what we hold', () => {
  it('answers a request for access in words, with the free text a forget cannot reach, as text or as JSON', async () => {
    renderShell(<Harness
      held={{ 'pe-pia': [{ id: 'as-1', scope: 'customer', unit: 'Webshop', role: 'Product owner', from: '2022-01-01' }] }}
      mentions={[{ scope: 'acme', kind: 'observation', id: 'ob-1', title: 'Seen by Pia Schulz' }]}
    />)
    pick('pe-pia')
    await fromMenu('What we hold…')
    await answerDialog('What we hold about Pia Schulz')
    const page = screen.getByTestId('people-hold')
    expect(page.textContent).toContain('Pia Schulz · pia.schulz@acme.example · Internal · Active')
    expect(page.textContent).toContain('pe-pia')
    expect(page.textContent).toContain('Product owner in Webshop (customer), 2022-01-01 – …')
    await waitFor(() => expect(page.textContent).toContain('Seen by Pia Schulz (acme)'))
    fireEvent.click(screen.getByTestId('people-hold-copy-json'))
    const json = JSON.parse(copied.mock.calls[0][0] as string)
    expect(json.register).toMatchObject({ id: 'pe-pia', name: 'Pia Schulz' })
    expect(json.assignments).toEqual(['Product owner in Webshop (customer), 2022-01-01 – …'])
    fireEvent.click(screen.getByTestId('people-hold-copy-text'))
    expect(copied.mock.calls[1][0]).toContain('In the register\n- Pia Schulz · pia.schulz@acme.example')
  })
})

describe('merging', () => {
  it('merges a duplicate pair after asking, and the one absorbed leaves the list', async () => {
    renderShell(<Harness />)
    const dialog = await mergeEvas()
    expect(dialog.textContent).toContain('Final: a merge cannot be undone')
    fireEvent.click(within(dialog).getByTestId('people-merge-confirm'))
    await waitFor(() => expect(screen.queryByRole('tab', { name: /To review/ })).toBeNull())
    expect(rowOf('pe-evt')).toBeNull()
  })

  it('tells two entries of one name apart, by what they hold, their address and what names them', async () => {
    const twin = person('pe-tom2', 'Tom Berger', { email: 'tom.b@acme.example' })
    const tom = person('pe-tom1', 'Tom Berger', { email: 'tom@acme.example' })
    renderShell(<Harness
      start={[tom, twin]}
      held={{ 'pe-tom1': [{ id: 'as-1', scope: 'x', unit: 'Dock crew', role: 'Lead' }] }}
      pointsAt={{ 'pe-tom1': { byRule: [], pointers: [{ scope: 'r', kind: 'element', id: 'crm', title: 'CRM', field: 'owner', person: 'pe-tom1' }] } }}
    />)
    review()
    fireEvent.click(screen.getByRole('button', { name: /^Merge…/ }))
    const dialog = await answerDialog('Which Tom Berger stays?')
    const cards = within(dialog).getAllByRole('radio') as HTMLInputElement[]
    expect(cards[0].checked).toBe(true)
    await waitFor(() => expect(cards[0].closest('label')?.textContent).toContain('Lead, Dock crew · tom@acme.example · Named on 1 record'))
    expect(cards[1].closest('label')?.textContent).toContain('Holds nothing · tom.b@acme.example · Named on nothing')
    expect(within(dialog).getByTestId('people-merge-address').textContent).toContain('tom.b@acme.example goes with it')
  })

  it('merges from a person through the picker, searched, and then the same question', async () => {
    renderShell(<Harness start={[...START, person('pe-gim', 'Gijs Mulders')]} />)
    pick('pe-pia')
    await fromMenu('Merge with someone…')
    const pickDialog = await answerDialog('Merge Pia Schulz with')
    expect(within(pickDialog).queryByText('Former colleague 7KQM')).toBeNull()
    fireEvent.change(within(pickDialog).getByRole('combobox'), { target: { value: 'eva' } })
    fireEvent.click(within(pickDialog).getAllByRole('option')[0])
    expect(await answerDialog('Which one stays?')).toBeTruthy()
  })

  /**
   * Somebody active merged into an entry that has left (ADR-0036 §9): the
   * merge asks which is true, and starts from what their roles say.
   */
  describe('somebody active into an entry that has left', () => {
    const gim = person('pe-gim', 'Gijs Mulders')
    const role = (id: string, from: string): HeldAssignment => ({ id, scope: 'customer', unit: 'Webshop', role: 'Developer', from })
    const mergeIntoGijs = async (held: HeldAssignment[]) => {
      renderShell(<Harness start={[...START, gim]} held={{ 'pe-gim': held }} />)
      review()
      fireEvent.click(screen.getByRole('button', { name: /^Merge… Gijs/ }))
      const dialog = await answerDialog('Which one stays?')
      fireEvent.click(within(dialog).getByRole('radio', { name: /^Gijs Mulder\b(?!s)/ }))
      return dialog
    }
    const checked = (dialog: HTMLElement, name: RegExp) => (within(dialog).getByRole('radio', { name }) as HTMLInputElement).checked

    it('chooses still here where a role began after the leaving day, says so on the button, and clears the leaving', async () => {
      const dialog = await mergeIntoGijs([role('as-back', '2026-09-01')])
      expect(dialog.textContent).toContain('Gijs Mulder left on 14 Aug 2026, and Gijs Mulders is active. Which is true?')
      expect(within(dialog).getByTestId('people-merge-later').textContent).toContain('began after 14 Aug 2026')
      expect(checked(dialog, /^Still here/)).toBe(true)
      expect(dialog.textContent).toContain('1 began after 14 Aug 2026 and is taken away: a role is never ended before it began.')
      const go = within(dialog).getByTestId('people-merge-confirm')
      expect(go.textContent).toBe('Merge, still here')
      fireEvent.click(go)
      await waitFor(() => expect(said()).toContain('who is active again'))
      expect(merges).toEqual(['stillHere'])
      tab(/^People/)
      expect(screen.getByTestId('people-counts').textContent).toBe('4 active · 0 left · 1 forgotten')
    })

    it('chooses left where every role began before it, says what ends, and the answer can be changed', async () => {
      const dialog = await mergeIntoGijs([role('as-run', '2026-01-01')])
      expect(checked(dialog, /^Left: end these roles/)).toBe(true)
      expect(within(dialog).queryByTestId('people-merge-later')).toBeNull()
      expect(dialog.textContent).toContain('1 role of Gijs Mulders runs past 14 Aug 2026 and ends on it.')
      fireEvent.click(within(dialog).getByRole('radio', { name: /^Still here/ }))
      expect(within(dialog).getByTestId('people-merge-confirm').textContent).toBe('Merge, still here')
      fireEvent.click(within(dialog).getByRole('radio', { name: /^Left: end these roles/ }))
      fireEvent.click(within(dialog).getByTestId('people-merge-confirm'))
      await waitFor(() => expect(merges).toEqual(['left']))
      tab(/^People/)
      expect(screen.getByTestId('people-counts').textContent).toBe('3 active · 1 left · 1 forgotten')
    })

    it('asks nothing where the one kept is active: the merge is as it always was', async () => {
      renderShell(<Harness />)
      const dialog = await mergeEvas()
      expect(within(dialog).queryByTestId('people-merge-leaving')).toBeNull()
      fireEvent.click(within(dialog).getByTestId('people-merge-confirm'))
      await waitFor(() => expect(merges).toEqual([undefined]))
    })
  })
})

describe('the Privacy tab', () => {
  it('changes the policy as the organisation’s setting, and draws the periods as three steps', async () => {
    const onPolicy = vi.fn()
    renderShell(<Harness onPolicy={onPolicy} />)
    tab('Privacy')
    const panel = screen.getByTestId('people-policy')
    expect(panel.textContent).toContain('+ 90 days')
    expect(panel.textContent).toContain('+ 730 days')
    fireEvent.change(screen.getByLabelText('Keep a leaver’s name for (days)'), { target: { value: '30' } })
    expect(panel.textContent).toContain('+ 30 days')
    fireEvent.click(screen.getByTestId('people-policy-save'))
    await waitFor(() => expect(onPolicy).toHaveBeenCalledWith({ keepNameDays: 30, removeAfterDays: 730, agentsSee: 'names' }))
  })

  it('reads as sentences to whoever may not change it', () => {
    renderShell(<Harness readOnly />)
    tab('Privacy')
    expect(screen.getByTestId('people-policy-read').textContent).toContain('A leaver’s name is kept for 90 days')
    expect(screen.queryByRole('spinbutton')).toBeNull()
    expect(screen.queryByTestId('people-policy-save')).toBeNull()
  })
})

/**
 * The possible duplicates (ADR-0036 §9, as built in 3.6.1): a queue on a tab of
 * its own, a pair to a row, merged from it with the entry to keep chosen, or
 * answered as not the same person — an answer that sticks, and can be taken back.
 */
describe('To review', () => {
  const DUPES: Person[] = [
    ...START,
    person('pe-yara', 'Yara Kok'),
    person('pe-vera', 'Vera Kok'),
    person('pe-sam', 'Sam de Vries', { email: 'sam.devries@acme.example' }),
    person('pe-samuel', 'Samuel de Vries', { email: 'sam.devries@acme.example', kind: 'external' }),
  ]
  const pairRows = () => screen.queryAllByTestId(/^people-pair-pe-/)

  it('is a tab with a count, and nothing opens by itself; strongest sign first', async () => {
    renderShell(<Harness start={DUPES} />)
    expect(screen.getByRole('tab', { name: /To review/ }).textContent).toContain('3')
    expect(pairRows()).toEqual([])
    review()
    expect(pairRows().map((one) => one.dataset.testid)).toEqual([
      'people-pair-pe-sam-pe-samuel', 'people-pair-pe-eva-pe-evt', 'people-pair-pe-yara-pe-vera',
    ])
    expect(await axeFindings()).toEqual([])
  })

  it('shows a pair as two people lined up, with what tells them apart and the reason in its own column', () => {
    renderShell(<Harness start={DUPES} held={{ 'pe-sam': [{ id: 'as-1', scope: 'sales', unit: 'Booking', role: 'Product owner' }, { id: 'as-2', scope: 'sales', unit: 'Rates', role: 'Engineer' }] }} />)
    review()
    const pair = screen.getByTestId('people-pair-pe-sam-pe-samuel')
    expect(pair.dataset.guide).toBe('people.duplicatePair')
    const line = pair.closest('[data-kit-row]') as HTMLElement
    expect(line.textContent).toContain('Sam de VriesProduct owner, Booking +1sam.devries@acme.example')
    expect(line.textContent).toContain('the same address')
    expect(line.textContent).toContain('Samuel de Vries · External')
    expect(within(pair).getByRole('button', { name: 'Merge… Sam de Vries and Samuel de Vries' }).textContent).toBe('Merge…')
    expect(within(pair).getByRole('button', { name: 'Not the same person: Sam de Vries and Samuel de Vries' })).toBeTruthy()
  })

  it('merges from a pair after asking which entry is kept: the one with more assignments to start with, and either', async () => {
    renderShell(<Harness held={{ 'pe-evt': [{ id: 'as-1', scope: 'sales', unit: 'Booking', role: 'Engineer' }] }} />)
    review()
    fireEvent.click(screen.getByRole('button', { name: 'Merge… Eva Lindt and Eva Lind' }))
    const dialog = await answerDialog('Which one stays?')
    expect(within(dialog).getByRole('radio', { name: /^Eva Lindt/ })).toHaveProperty('checked', true)
    fireEvent.click(within(dialog).getByRole('radio', { name: /^Eva Lind\b(?!t)/ }))
    fireEvent.click(within(dialog).getByTestId('people-merge-confirm'))
    await waitFor(() => expect(screen.queryByRole('tab', { name: /To review/ })).toBeNull())
    expect(rowOf('pe-evt')).toBeNull()
  })

  it('answers a pair as not the same person: it leaves the queue, and is listed under it to take back', async () => {
    renderShell(<Harness start={DUPES} />)
    review()
    fireEvent.click(screen.getByRole('button', { name: 'Not the same person: Yara Kok and Vera Kok' }))
    await waitFor(() => expect(screen.queryByTestId('people-pair-pe-yara-pe-vera')).toBeNull())
    await waitFor(() => expect(said()).toContain('Recorded as not the same person: Yara Kok and Vera Kok'))
    expect(screen.getByRole('tab', { name: /To review/ }).textContent).toContain('2')
    const answered = screen.getByRole('button', { name: '1 answered as not the same person', expanded: false })
    expect(answered.dataset.guide).toBe('people.answered')
    fireEvent.click(answered)
    const line = screen.getByTestId('people-answered-pe-vera-pe-yara')
    expect(line.textContent).toContain('Vera Kok and Yara Kok')
    expect(line.textContent).toContain('answered 11 Oct 2026')
    expect(await axeFindings()).toEqual([])
    fireEvent.click(within(line).getByRole('button', { name: 'Take back: Vera Kok and Yara Kok' }))
    await waitFor(() => expect(screen.getByTestId('people-pair-pe-yara-pe-vera')).toBeTruthy())
    expect(screen.getByRole('tab', { name: /To review/ }).textContent).toContain('3')
    expect(screen.queryByTestId('people-answered')).toBeNull()
    await waitFor(() => expect(said()).toBe('Taken back: Vera Kok and Yara Kok may be the same person again.'))
  })

  it('keeps the tab while any answer stands, and it is gone when nothing is left', async () => {
    renderShell(<Harness answered={[{ a: 'pe-eva', b: 'pe-evt', on: '2026-10-01' }]} />)
    review()
    expect(screen.getByRole('button', { name: '1 answered as not the same person' })).toBeTruthy()
    expect(await axeFindings()).toEqual([])
    cleanup()
    renderShell(<Harness start={[person('pe-pia', 'Pia Schulz')]} />)
    expect(screen.queryByRole('tab', { name: /To review/ })).toBeNull()
  })

  it('does not warn of an answered pair when either is corrected, and still checks somebody new against both', async () => {
    renderShell(<Harness start={DUPES} answered={[{ a: 'pe-vera', b: 'pe-yara', on: '2026-10-01' }]} />)
    pick('pe-yara')
    fireEvent.click(screen.getByTestId('people-correct'))
    expect(screen.queryByTestId('people-correct-similar')).toBeNull()
    fireEvent.change(screen.getByTestId('people-correct-name'), { target: { value: 'Eva Lin' } })
    expect(screen.getByTestId('people-correct-similar').textContent).toContain('Eva Lind · nearly the same name')
    fireEvent.click(within(screen.getAllByRole('dialog').at(-1) as HTMLElement).getByRole('button', { name: 'Cancel' }))
    leavePerson()
    await waitFor(() => expect(screen.queryByTestId('people-person')).toBeNull())
    fireEvent.click(screen.getByTestId('people-add'))
    fireEvent.change(screen.getByTestId('people-add-name'), { target: { value: 'Vera Kok' } })
    const similar = screen.getByTestId('people-add-similar').textContent
    expect(similar).toContain('Vera Kok · no address · the same name')
    expect(similar).toContain('Yara Kok · no address · nearly the same name')
  })

  it('offers a manager whose units hold both an answer, and no merge, where the source grants that right', () => {
    const managesBoth = (one: string, other: string) => [one, other].sort().join(' ') === 'pe-vera pe-yara'
    renderShell(<Harness start={DUPES} source={{ may: (action) => action !== 'merge', managesBoth }} />)
    review()
    expect(pairRows()).toHaveLength(1)
    const pair = screen.getByTestId('people-pair-pe-yara-pe-vera')
    expect(within(pair).queryByRole('button', { name: /^Merge/ })).toBeNull()
    expect(within(pair).getByRole('button', { name: 'Not the same person: Yara Kok and Vera Kok' })).toBeTruthy()
  })

  it('says an entry is linked to an account where the source says, and keeps it first', () => {
    renderShell(<Harness held={{ 'pe-evt': [{ id: 'as-1', scope: 'sales', unit: 'Booking', role: 'Engineer' }] }} source={{ linked: (id) => id === 'pe-eva' }} />)
    review()
    const line = screen.getByTestId('people-pair-pe-eva-pe-evt').closest('[data-kit-row]') as HTMLElement
    expect(within(line).getAllByTestId('people-pair-marks').map((one) => one.textContent)).toEqual([' · account'])
    // Eva Lind first, though Eva Lindt holds more: an account is kept first.
    expect(line.textContent).toMatch(/Eva Lind · account/)
  })
})

describe('what points at a person (ADR-0036 §8)', () => {
  const pointing: PointsAt = {
    byRule: [{ kind: 'application', scope: 'retail', id: 'shop', name: 'Webshop', day: TODAY }],
    pointers: [
      { scope: 'retail', kind: 'element', id: 'crm', title: 'CRM', field: 'owner', person: 'pe-pia' },
      { scope: 'retail', kind: 'observation', id: 'ob-1', label: 'OB-0001', title: 'Orders arrive twice', field: 'seenBy', person: 'pe-pia' },
      { scope: '', kind: 'decision', id: 'ad-1', label: 'ADR-0004', title: 'One order store', field: 'signer', person: 'pe-pia', signedAs: 'Pia Schulz' },
    ],
  }

  it('lists the records that name them by id, the signatures that kept their name, and what the rules work out', async () => {
    renderShell(<Harness pointsAt={{ 'pe-pia': pointing }} />)
    pick('pe-pia')
    const section = await screen.findByTestId('people-points-at')
    expect(within(section).getByTestId('people-pointed-rule').textContent).toBe('Owner of Webshop on 11 Oct 2026 · worked out from the role, not stored')
    expect(within(section).getAllByTestId('people-pointed').map((line) => line.textContent)).toEqual([
      'Owner of CRM · in retail',
      'OB-0001 Orders arrive twice: seen by · in retail',
    ])
    expect(within(section).getByTestId('people-pointed-signed').textContent).toBe('ADR-0004 One order store: signed as Pia Schulz · kept: a signature keeps its name')
    await fromMenu('What we hold…')
    const page = await screen.findByTestId('people-hold')
    await waitFor(() => expect(page.textContent).toContain('CRM (retail): owner'))
    expect(page.textContent).toContain('ADR-0004 One order store (the organisation), signed as Pia Schulz')
    expect(page.textContent).toContain('Owner of Webshop (retail) on 2026-10-11, worked out from the role')
  })

  /**
   * A forgotten entry is read as its pseudonym; a signature keeps the name it
   * was signed with on the decision, and said here beside the pseudonym it
   * would undo the forgetting (ADR-0036 §8). Only that it exists is said.
   */
  it('says only that a signature exists on a forgotten entry, never the name as signed, beside the pseudonym or in what we hold', async () => {
    const signed: PointsAt = {
      byRule: [],
      pointers: [
        { scope: '', kind: 'decision', id: 'ad-1', label: 'ADR-0002', title: 'One order store', field: 'signer', person: 'pe-gone', signedAs: 'Hanna Berg' },
        { scope: '', kind: 'decision', id: 'ad-1', label: 'ADR-0002', title: 'One order store', field: 'proposed', person: 'pe-gone', signedAs: 'Hanna Berg' },
      ],
    }
    renderShell(<Harness pointsAt={{ 'pe-gone': signed }} />)
    pick('pe-gone')
    const section = await screen.findByTestId('people-points-at')
    expect(within(section).getAllByTestId('people-pointed-signed').map((line) => line.textContent)).toEqual([
      'ADR-0002 One order store, signed · in the organisation', 'ADR-0002 One order store, proposed · in the organisation',
    ])
    expect(screen.getByTestId('people-person-name').textContent).toBe('Former colleague 7KQM')
    await fromMenu('What we hold…')
    const page = await screen.findByTestId('people-hold')
    await waitFor(() => expect(page.textContent).toContain('ADR-0002 One order store (the organisation), signed'))
    expect(page.textContent).not.toContain('Hanna Berg')
    expect(screen.getByTestId('people-person').textContent).not.toContain('Hanna Berg')
  })

  it('says nothing points at them where nothing does', async () => {
    renderShell(<Harness pointsAt={{}} />)
    pick('pe-eva')
    expect((await screen.findByTestId('people-points-at')).textContent).toContain('Nothing points at them.')
  })

  it('says nothing points at them rather than waiting for ever when the tree will not read', async () => {
    renderShell(<Harness pointsAt="unreadable" />)
    pick('pe-pia')
    expect((await screen.findByTestId('people-points-at')).textContent).toContain('Nothing points at them.')
  })

  it('says a domain, a plan, an experiment, a proposer and a signer in words', async () => {
    const words: PointsAt = {
      byRule: [{ kind: 'domain', scope: 'retail', id: 'retail', name: 'Retail', day: TODAY }],
      pointers: [
        { scope: 'retail', kind: 'plan', id: 'tr-1', label: 'TR-0001', title: 'Replace the store', field: 'owner', person: 'pe-pia' },
        { scope: 'retail', kind: 'experiment', id: 'ex-1', label: 'EX-0001', title: 'Deduplicate', field: 'runBy', person: 'pe-pia' },
        { scope: 'retail', kind: 'decision', id: 'ad-2', label: 'ADR-0002', title: 'Two stores', field: 'proposed', person: 'pe-pia' },
        { scope: 'retail', kind: 'decision', id: 'ad-3', label: 'ADR-0003', title: 'Three stores', field: 'signer', person: 'pe-pia' },
      ],
    }
    renderShell(<Harness pointsAt={{ 'pe-pia': words }} />)
    pick('pe-pia')
    const section = await screen.findByTestId('people-points-at')
    expect(within(section).getByTestId('people-pointed-rule').textContent).toContain('Owner of the domain Retail on 11 Oct 2026')
    expect(within(section).getAllByTestId('people-pointed').map((line) => line.textContent?.split(' · ')[0])).toEqual([
      'TR-0001 Replace the store: owner', 'EX-0001 Deduplicate: run by', 'ADR-0002 Two stores: proposed', 'ADR-0003 Three stores: signer',
    ])
  })
})

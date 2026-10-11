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
import type { HeldAssignment, PointsAt } from '../hold'
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
function Harness({ readOnly = false, me, onPolicy, mentions = [], held: holding, looking = false, pointsAt, source, start = START, answered = [], open = true }: {
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
    forget: (id, on) => change({ kind: 'forget', id, on }),
    remove: (id) => change({ kind: 'remove', id }),
    merge: (from, into, leaving) => { merges.push(leaving); return change({ kind: 'merge', from, into, ...(leaving ? { leaving } : {}) }, into) },
    setPolicy: (patch) => { onPolicy?.(patch); setPolicy((was) => ({ ...was, ...patch })); return Promise.resolve() },
    setMe: (id) => { setWho(id); return Promise.resolve() },
    mentionsOf: () => Promise.resolve(mentions),
    ...(holding ? { assignmentsOf: (id: PersonId) => holding[id] ?? [] } : {}),
    ...(pointsAt === 'unreadable' ? { pointsAt: () => Promise.reject(new Error('the tree will not read')) } : {}),
    ...(pointsAt && pointsAt !== 'unreadable' ? { pointsAt: (id: PersonId) => Promise.resolve(pointsAt[id] ?? { pointers: [], byRule: [] }) } : {}),
    ...source,
  }
  const look = { ...(day !== undefined ? { day } : {}), onDay: setDay }
  return <PeoplePage open={open} onClose={() => {}} register={register} copyText={() => {}} s={s} {...(looking ? { look } : {})} />
}

/** What each merge was told, in order: still here, left, or nothing. */
const merges: (string | undefined)[] = []
afterEach(() => { merges.length = 0 })

const row = (id: string) => screen.getByTestId(`people-row-${id}`)
const pick = (id: string) => fireEvent.click(within(row(id)).getByRole('button'))
/** Open the possible duplicates, folded as the page opens. */
const review = () => fireEvent.click(screen.getByTestId('people-duplicates-review'))
/** *Merge…* on the pair of Eva Lind and Eva Lindt, the dialog it opens. */
const mergeEvas = () => {
  review()
  fireEvent.click(screen.getByRole('button', { name: 'Merge… Eva Lind and Eva Lindt' }))
  return screen.findByRole('dialog', { name: 'Merge Eva Lindt into Eva Lind?' })
}

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
    expect(screen.queryByTestId('people-not-a-step')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'About the register' }))
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
    const dialog = await mergeEvas()
    expect(dialog.textContent).toContain('A merge is final')
    fireEvent.click(within(dialog).getByRole('button', { name: 'Merge' }))
    await waitFor(() => expect(screen.queryByTestId('people-row-pe-evt')).toBeNull())
    expect(screen.queryByTestId('people-duplicates')).toBeNull()
  })

  /**
   * Somebody active merged into an entry that has left (ADR-0036 §9): the
   * merge asks which is true, and starts from what their roles say.
   */
  describe('merging somebody active into an entry that has left', () => {
    const gim = person('pe-gim', 'Gijs Mulders')
    const role = (id: string, from: string): HeldAssignment => ({ id, scope: 'customer', unit: 'Webshop', role: 'Developer', from })
    const mergeIntoGijs = async (held: HeldAssignment[]) => {
      renderShell(<Harness start={[...START, gim]} held={{ 'pe-gim': held }} />)
      pick('pe-gim')
      fireEvent.mouseDown(screen.getByRole('combobox', { name: 'The entry to keep' }))
      fireEvent.click(await screen.findByRole('option', { name: 'Gijs Mulder' }))
      fireEvent.click(screen.getByTestId('people-merge-with'))
      return screen.findByRole('dialog', { name: 'Merge Gijs Mulders into Gijs Mulder?' })
    }
    const checked = (dialog: HTMLElement, name: string) => (within(dialog).getByRole('radio', { name }) as HTMLInputElement).checked

    it('chooses still here where a role began after the leaving day, and clears the leaving', async () => {
      const dialog = await mergeIntoGijs([role('as-back', '2026-09-01')])
      expect(dialog.textContent).toContain('Gijs Mulder left on 2026-08-14, and Gijs Mulders is active. Which is true?')
      expect(within(dialog).getByTestId('people-merge-later').textContent).toContain('began after 2026-08-14')
      expect(checked(dialog, 'Still here: clear the leaving')).toBe(true)
      expect(within(dialog).getByTestId('people-merge-left-help').textContent)
        .toContain('1 began after 2026-08-14 and is taken away: a role is never ended before it began.')
      fireEvent.click(within(dialog).getByRole('button', { name: 'Merge' }))
      await waitFor(() => expect(screen.getByTestId('people-said').textContent).toContain('who is active again'))
      expect(merges).toEqual(['stillHere'])
      expect(screen.getByTestId('people-counts').textContent).toBe('4 active · 0 left · 1 forgotten')
    })

    it('chooses left where every role began before it, says what ends, and the answer can be changed', async () => {
      const dialog = await mergeIntoGijs([role('as-run', '2026-01-01')])
      expect(checked(dialog, 'Left: end these roles on 2026-08-14')).toBe(true)
      expect(within(dialog).queryByTestId('people-merge-later')).toBeNull()
      expect(within(dialog).getByTestId('people-merge-left-help').textContent).toBe('1 role of Gijs Mulders runs past 2026-08-14 and ends on it.')
      fireEvent.click(within(dialog).getByRole('radio', { name: 'Still here: clear the leaving' }))
      fireEvent.click(within(dialog).getByRole('radio', { name: 'Left: end these roles on 2026-08-14' }))
      fireEvent.click(within(dialog).getByRole('button', { name: 'Merge' }))
      await waitFor(() => expect(merges).toEqual(['left']))
      expect(screen.getByTestId('people-counts').textContent).toBe('3 active · 1 left · 1 forgotten')
    })

    it('asks nothing where the one kept is active: the merge is as it always was', async () => {
      renderShell(<Harness />)
      const dialog = await mergeEvas()
      expect(within(dialog).queryByTestId('people-merge-leaving')).toBeNull()
      fireEvent.click(within(dialog).getByRole('button', { name: 'Merge' }))
      await waitFor(() => expect(merges).toEqual([undefined]))
    })
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
    expect(screen.getByRole('columnheader', { name: 'Roles today' })).toBeTruthy()
    const roles = (id: string) => within(row(id)).getByTestId('people-roles')
    expect(roles('pe-pia').textContent).toBe('Product owner · Parcel +2')
    expect(within(roles('pe-pia')).getByTitle('Developer · Tracking, Cluster lead · Freight').textContent).toBe(' +2')
    expect(roles('pe-eva').textContent).toBe('Product owner · Webshop')
    // Whoever holds nothing says so, rather than an empty cell.
    expect(roles('pe-evt').textContent).toBe('none')
    expect(roles('pe-gone').textContent).toBe('none')
    expect(await axeFindings()).toEqual([])
    // The search finds a person by a role or a unit they hold that day.
    fireEvent.change(screen.getByTestId('people-search'), { target: { value: 'tracking' } })
    expect(screen.getAllByTestId(/^people-row-/).map((one) => one.dataset.personId)).toEqual(['pe-pia'])
    fireEvent.change(screen.getByTestId('people-search'), { target: { value: '' } })
    // Looked at on another day, the column says that day's.
    pick('pe-pia')
    fireEvent.change(screen.getByTestId('people-look'), { target: { value: '2027-01-01' } })
    expect(screen.getByRole('columnheader', { name: 'Roles on 2027-01-01' })).toBeTruthy()
    expect(roles('pe-pia').textContent).toBe('Product owner · Parcel +3')
    expect(roles('pe-eva').textContent).toBe('none')
  })

  it('has no roles column where the shell has no tree to read them from', () => {
    renderShell(<Harness />)
    expect(screen.queryByRole('columnheader', { name: 'Roles today' })).toBeNull()
    expect(screen.queryByTestId('people-roles')).toBeNull()
    expect(screen.getByRole('columnheader', { name: 'Work address' })).toBeTruthy()
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

  it('says This is you on the entry a merge kept, where This is me named the one merged into it', () => {
    renderShell(<Harness me="pe-lindt" start={[...START, { id: 'pe-lindt', pseudonym: 'GHJK', kind: 'internal', state: 'active', mergedInto: 'pe-pia' }]} />)
    pick('pe-pia')
    expect(screen.getByTestId('people-this-is-you')).toBeDefined()
  })

  it('finds you: the whole list, and your entry chosen (ADR-0036 §11)', async () => {
    renderShell(<Harness />)
    expect(screen.queryByTestId('people-find-me')).toBeNull()
    pick('pe-eva')
    fireEvent.click(screen.getByTestId('people-me'))
    await waitFor(() => expect(screen.getByTestId('people-find-me')).toBeDefined())
    fireEvent.change(screen.getByTestId('people-search'), { target: { value: 'Pia' } })
    expect(screen.queryByTestId('people-row-pe-eva')).toBeNull()
    fireEvent.click(screen.getByTestId('people-find-me'))
    expect(row('pe-eva').getAttribute('style') ?? '').not.toContain('display: none')
    expect(within(row('pe-eva')).getByRole('button', { pressed: true })).toBeDefined()
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

  it('offers each change only to whoever the source says may make it, of the entry it says', () => {
    // A contributor who manages Pia: adds people, corrects and lets go of Pia, and merges, forgets and removes nobody.
    const may = (action: string, id?: string) => action === 'add' || ((action === 'change' || action === 'leave') && id === 'pe-pia')
    renderShell(<Harness source={{ may }} />)
    expect(screen.getByTestId('people-add')).toBeTruthy()
    expect(screen.queryByTestId('people-duplicates')).toBeNull()
    pick('pe-pia')
    expect(screen.getByTestId('people-correct')).toBeTruthy()
    expect(screen.getByTestId('people-leave')).toBeTruthy()
    expect(screen.queryByTestId('people-forget')).toBeNull()
    expect(screen.queryByTestId('people-merge-with')).toBeNull()
    expect(screen.queryByTestId('people-policy-save')).toBeNull()
    expect(screen.getByRole('spinbutton', { name: /keep a leaver/i })).toHaveProperty('disabled', true)
    // Eva is somebody else's: nothing to do with her here.
    pick('pe-eva')
    expect(screen.queryByTestId('people-correct')).toBeNull()
    expect(screen.queryByText(s('people.do'))).toBeNull()
  })

  it('says an address kept from this person is kept, not missing', () => {
    renderShell(<Harness source={{ withheld: (id) => id === 'pe-evt' }} />)
    const row = screen.getByTestId('people-row-pe-evt')
    expect(row.textContent).toContain(s('people.emailWithheld'))
    pick('pe-evt')
    expect(screen.getByTestId('people-person-email').textContent).toBe(s('people.emailWithheld'))
    pick('pe-pia')
    expect(screen.getByTestId('people-person-email').textContent).toBe('pia.schulz@acme.example')
  })

  it('says a leaver the source\'s schedule held back was held, and why', () => {
    renderShell(<Harness source={{ held: (id) => (id === 'pe-gijs' ? 'signedInSinceLeaving' : undefined) }} />)
    pick('pe-gijs')
    expect(screen.getByTestId('people-held-back').textContent).toBe(s('people.heldSignedIn'))
    expect(screen.queryByText(s('people.leftDue'))).toBeNull()
  })
})

/**
 * The possible duplicates (ADR-0036 §9, as built in 3.6.1): folded every time
 * the page opens, a pair to a row, merged from it with the entry to keep
 * chosen, or answered as not the same person — an answer that sticks, and
 * can be taken back.
 */
describe('the possible duplicates, folded', () => {
  const DUPES: Person[] = [
    ...START,
    person('pe-yara', 'Yara Kok'),
    person('pe-vera', 'Vera Kok'),
    person('pe-sam', 'Sam de Vries', { email: 'sam.devries@acme.example' }),
    person('pe-samuel', 'Samuel de Vries', { email: 'sam.devries@acme.example', kind: 'external' }),
  ]
  const pairRows = () => screen.queryAllByTestId(/^people-pair-pe-/)
  const fold = (name: string, expanded: boolean) => screen.getByRole('button', { name, expanded })

  it('is one line as the page opens: how many, by sign, and Review — and folded again when it opens again', async () => {
    const { rerender } = renderShell(<Harness start={DUPES} />)
    expect(fold('3 possible duplicates', false)).toBeTruthy()
    expect(screen.getByTestId('people-duplicates-signs').textContent).toBe('1 the same address · 2 nearly the same name')
    expect(pairRows()).toEqual([])
    review()
    expect(fold('3 possible duplicates', true)).toBeTruthy()
    expect(screen.queryByTestId('people-duplicates-review')).toBeNull()
    // The strongest sign first: the same address before nearly the same name.
    expect(pairRows().map((one) => one.dataset.testid)).toEqual([
      'people-pair-pe-sam-pe-samuel', 'people-pair-pe-eva-pe-evt', 'people-pair-pe-yara-pe-vera',
    ])
    expect(await axeFindings()).toEqual([])
    rerender(<Harness start={DUPES} open={false} />)
    rerender(<Harness start={DUPES} />)
    expect(await screen.findByRole('button', { name: '3 possible duplicates', expanded: false })).toBeTruthy()
    expect(pairRows()).toEqual([])
  })

  it('shows a pair as two people side by side, with what tells them apart and the sign as a tag', () => {
    renderShell(<Harness start={DUPES} held={{ 'pe-sam': [{ id: 'as-1', scope: 'sales', unit: 'Booking', role: 'Product owner' }, { id: 'as-2', scope: 'sales', unit: 'Rates', role: 'Engineer' }] }} />)
    review()
    const pair = screen.getByTestId('people-pair-pe-sam-pe-samuel')
    expect(pair.dataset.guide).toBe('people.duplicatePair')
    expect(pair.textContent).toContain('Sam de VriesProduct owner · Booking +1sam.devries@acme.example')
    expect(pair.textContent).toContain('the same address')
    expect(pair.textContent).toContain('Samuel de VriesExternal')
    expect(within(pair).getByRole('button', { name: 'Merge… Sam de Vries and Samuel de Vries' }).textContent).toBe('Merge…')
    expect(within(pair).getByRole('button', { name: 'Not the same person: Sam de Vries and Samuel de Vries' })).toBeTruthy()
  })

  it('merges from a pair after asking which entry is kept: the one with more assignments to start with, and either', async () => {
    renderShell(<Harness held={{ 'pe-evt': [{ id: 'as-1', scope: 'sales', unit: 'Booking', role: 'Engineer' }] }} />)
    review()
    fireEvent.click(screen.getByRole('button', { name: 'Merge… Eva Lindt and Eva Lind' }))
    const dialog = await screen.findByRole('dialog', { name: 'Merge Eva Lind into Eva Lindt?' })
    const keep = within(dialog).getByRole('radiogroup', { name: 'The entry to keep' })
    expect(within(keep).getByRole('radio', { name: 'Eva Lindt' })).toHaveProperty('checked', true)
    fireEvent.click(within(keep).getByRole('radio', { name: 'Eva Lind' }))
    expect(await screen.findByRole('dialog', { name: 'Merge Eva Lindt into Eva Lind?' })).toBeTruthy()
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Merge' }))
    await waitFor(() => expect(screen.queryByTestId('people-row-pe-evt')).toBeNull())
    expect(screen.queryByTestId('people-duplicates')).toBeNull()
  })

  it('asks still here or left once the entry kept is swapped for one that has left', async () => {
    renderShell(<Harness start={[...START, person('pe-mulders', 'Gijs Mulders')]} />)
    review()
    fireEvent.click(screen.getByRole('button', { name: 'Merge… Gijs Mulders and Gijs Mulder' }))
    const dialog = await screen.findByRole('dialog', { name: 'Merge Gijs Mulder into Gijs Mulders?' })
    expect(within(dialog).queryByTestId('people-merge-leaving')).toBeNull()
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Gijs Mulder' }))
    const swapped = await screen.findByRole('dialog', { name: 'Merge Gijs Mulders into Gijs Mulder?' })
    expect(within(swapped).getByTestId('people-merge-leaving')).toBeTruthy()
    fireEvent.click(within(swapped).getByRole('button', { name: 'Merge' }))
    await waitFor(() => expect(merges).toEqual(['left']))
  })

  it('answers a pair as not the same person: it leaves the fold, and is listed under it to take back', async () => {
    renderShell(<Harness start={DUPES} />)
    review()
    fireEvent.click(screen.getByRole('button', { name: 'Not the same person: Yara Kok and Vera Kok' }))
    await waitFor(() => expect(screen.queryByTestId('people-pair-pe-yara-pe-vera')).toBeNull())
    expect(screen.getByTestId('people-said').textContent).toContain('Recorded as not the same person: Yara Kok and Vera Kok')
    expect(fold('2 possible duplicates', true)).toBeTruthy()
    const answered = screen.getByRole('button', { name: '1 answered as not the same person', expanded: false })
    expect(answered.dataset.guide).toBe('people.answered')
    fireEvent.click(answered)
    const line = screen.getByTestId('people-answered-pe-vera-pe-yara')
    expect(line.textContent).toContain('Vera Kok and Yara Kok')
    expect(line.textContent).toContain('answered 2026-10-11')
    expect(await axeFindings()).toEqual([])
    fireEvent.click(within(line).getByRole('button', { name: 'Take back: Vera Kok and Yara Kok' }))
    await waitFor(() => expect(screen.getByTestId('people-pair-pe-yara-pe-vera')).toBeTruthy())
    expect(fold('3 possible duplicates', true)).toBeTruthy()
    expect(screen.queryByTestId('people-answered')).toBeNull()
    expect(screen.getByTestId('people-said').textContent).toBe('Taken back: Vera Kok and Yara Kok may be the same person again.')
  })

  it('goes away when no pair is left, and keeps the answered line while any answer stands', async () => {
    renderShell(<Harness answered={[{ a: 'pe-eva', b: 'pe-evt', on: '2026-10-01' }]} />)
    expect(screen.queryByTestId('people-duplicates-toggle')).toBeNull()
    expect(screen.getByRole('button', { name: '1 answered as not the same person' })).toBeTruthy()
    expect(await axeFindings()).toEqual([])
  })

  it('does not warn of an answered pair when either is corrected, and still checks somebody new against both', () => {
    renderShell(<Harness start={DUPES} answered={[{ a: 'pe-vera', b: 'pe-yara', on: '2026-10-01' }]} />)
    pick('pe-yara')
    fireEvent.click(screen.getByTestId('people-correct'))
    expect(screen.queryByTestId('people-correct-similar')).toBeNull()
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Eva Lin' } })
    expect(screen.getByTestId('people-correct-similar').textContent).toContain('Eva Lind — nearly the same name')
    fireEvent.click(screen.getByTestId('people-add'))
    fireEvent.change(screen.getByTestId('people-add-name'), { target: { value: 'Vera Kok' } })
    const similar = screen.getByTestId('people-add-similar').textContent
    expect(similar).toContain('Vera Kok — the same name')
    expect(similar).toContain('Yara Kok — nearly the same name')
  })

  it('offers a manager whose units hold both an answer, and no merge, where the source grants that right', () => {
    const managesBoth = (one: string, other: string) => [one, other].sort().join(' ') === 'pe-vera pe-yara'
    renderShell(<Harness start={DUPES} source={{ may: (action) => action !== 'merge', managesBoth }} />)
    expect(fold('1 possible duplicate', false)).toBeTruthy()
    review()
    const pair = screen.getByTestId('people-pair-pe-yara-pe-vera')
    expect(within(pair).queryByRole('button', { name: /^Merge/ })).toBeNull()
    expect(within(pair).getByRole('button', { name: 'Not the same person: Yara Kok and Vera Kok' })).toBeTruthy()
  })

  it('says an entry is linked to an account where the source says, and keeps it first', () => {
    renderShell(<Harness held={{ 'pe-evt': [{ id: 'as-1', scope: 'sales', unit: 'Booking', role: 'Engineer' }] }} source={{ linked: (id) => id === 'pe-eva' }} />)
    review()
    const pair = screen.getByTestId('people-pair-pe-eva-pe-evt')
    expect(within(pair).getAllByTestId('people-pair-account')).toHaveLength(1)
    // Eva Lind first, though Eva Lindt holds more: an account is kept first.
    expect(pair.textContent).toMatch(/^Eva Lindaccount/)
  })

  it('offers nothing where the register is only read, and says it is on the one line', () => {
    renderShell(<Harness start={DUPES} readOnly answered={[{ a: 'pe-eva', b: 'pe-evt', on: '2026-10-01' }]} />)
    expect(screen.queryByTestId('people-duplicates')).toBeNull()
    expect(screen.getByText(/one entry each/).textContent).toContain('The register is read here and not changed.')
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
    expect(within(section).getByTestId('people-pointed-rule').textContent).toBe(`Owner of Webshop on ${TODAY} · worked out from the role, not stored`)
    expect(within(section).getAllByTestId('people-pointed').map((line) => line.textContent)).toEqual([
      'Owner of CRM · in retail',
      'OB-0001 Orders arrive twice: seen by · in retail',
    ])
    expect(within(section).getByTestId('people-pointed-signed').textContent).toBe('ADR-0004 One order store: signed as Pia Schulz · kept: a signature keeps its name')
    fireEvent.click(screen.getByTestId('people-hold-toggle'))
    const held = JSON.parse(screen.getByTestId('people-hold').textContent ?? '{}')
    expect(held.namedIn).toEqual(['CRM (retail): owner', 'OB-0001 Orders arrive twice (retail): seen by'])
    expect(held.signed).toEqual(['ADR-0004 One order store (the organisation), signed as Pia Schulz'])
    expect(held.derived).toEqual([`Owner of Webshop (retail) on ${TODAY}, worked out from the role`])
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
    fireEvent.click(screen.getByTestId('people-hold-toggle'))
    const held = JSON.parse(screen.getByTestId('people-hold').textContent ?? '{}')
    expect(held.signed).toEqual(['ADR-0002 One order store (the organisation), signed', 'ADR-0002 One order store (the organisation), proposed'])
    const panel = screen.getByTestId('people-person')
    expect(panel.textContent).toContain('Former colleague 7KQM')
    expect(panel.textContent).not.toContain('Hanna Berg')
  })

  it('says nothing points at them where nothing does', async () => {
    renderShell(<Harness pointsAt={{}} />)
    pick('pe-eva')
    expect((await screen.findByTestId('people-points-at')).textContent).toContain('Nothing points at them.')
  })
})

describe('what points at a person, when the tree will not read', () => {
  it('says nothing points at them rather than waiting for ever', async () => {
    renderShell(<Harness pointsAt="unreadable" />)
    pick('pe-pia')
    expect((await screen.findByTestId('people-points-at')).textContent).toContain('Nothing points at them.')
  })

  it('says a domain, a plan, an experiment, a proposer and a signer in words', async () => {
    const pointing: PointsAt = {
      byRule: [{ kind: 'domain', scope: 'retail', id: 'retail', name: 'Retail', day: TODAY }],
      pointers: [
        { scope: 'retail', kind: 'plan', id: 'tr-1', label: 'TR-0001', title: 'Replace the store', field: 'owner', person: 'pe-pia' },
        { scope: 'retail', kind: 'experiment', id: 'ex-1', label: 'EX-0001', title: 'Deduplicate', field: 'runBy', person: 'pe-pia' },
        { scope: 'retail', kind: 'decision', id: 'ad-2', label: 'ADR-0002', title: 'Two stores', field: 'proposed', person: 'pe-pia' },
        { scope: 'retail', kind: 'decision', id: 'ad-3', label: 'ADR-0003', title: 'Three stores', field: 'signer', person: 'pe-pia' },
      ],
    }
    renderShell(<Harness pointsAt={{ 'pe-pia': pointing }} />)
    pick('pe-pia')
    const section = await screen.findByTestId('people-points-at')
    expect(within(section).getByTestId('people-pointed-rule').textContent).toContain(`Owner of the domain Retail on ${TODAY}`)
    expect(within(section).getAllByTestId('people-pointed').map((line) => line.textContent?.split(' · ')[0])).toEqual([
      'TR-0001 Replace the store: owner', 'EX-0001 Deduplicate: run by', 'ADR-0002 Two stores: proposed', 'ADR-0003 Three stores: signer',
    ])
  })
})

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A person picked from the register wherever one is asked for (ADR-0036 §9):
 * the people still with the organisation, *you* marked, and nobody new added
 * before the four signs have been asked.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import { useRef, useState } from 'react'
import { renderShell } from '../../app/testing/renderShell'
import { translator } from '../../i18n'
import type { PersonId } from '../../model/person'
import type { Person } from '../person'
import { DEFAULT_POLICY } from '../policy'
import { changePeople } from '../register'
import type { PeopleChange } from '../register'
import type { PeopleRegisterAccess } from './access'
import { useSaying } from './access'
import { pickable, PersonPicker } from './PersonPicker'

afterEach(() => cleanup())

const s = translator('en')

const person = (id: string, name: string, extra: Partial<Person> = {}): Person => ({
  id, name, pseudonym: 'BCDF', kind: 'internal', state: 'active', ...extra,
})

const START: Person[] = [
  person('pe-pia', 'Pia Schulz', { email: 'pia.schulz@acme.example' }),
  person('pe-femke', 'Femke Bos'),
  person('pe-gijs', 'Gijs Mulder', { state: 'left', leftOn: '2026-08-14' }),
  { id: 'pe-gone', pseudonym: '7KQM', kind: 'internal', state: 'forgotten' },
  { id: 'pe-old', pseudonym: 'GHJK', kind: 'internal', state: 'active', mergedInto: 'pe-femke' },
]

function Harness({ readOnly = false, onPicked }: { readOnly?: boolean; onPicked: (id: PersonId | undefined) => void }) {
  const [people, setPeople] = useState<readonly Person[]>(START)
  const [value, setValue] = useState<PersonId | undefined>(undefined)
  const held = useRef<readonly Person[]>(START)
  const saying = useSaying(s)
  const change = (work: PeopleChange) => {
    const answer = changePeople(held.current, work, { id: () => 'pe-new', pseudonym: () => 'NNZZ' })
    if ('refused' in answer) return Promise.resolve(answer)
    held.current = answer.people
    setPeople(answer.people)
    return Promise.resolve({ person: answer.people.find((one) => one.id === answer.changed[0])!, ended: 0, removed: [] })
  }
  const register: PeopleRegisterAccess = {
    people, policy: DEFAULT_POLICY, me: 'pe-femke', readOnly, today: '2026-10-11',
    add: (one) => change({ kind: 'add', person: one }),
    change: (id, patch) => change({ kind: 'change', id, patch }),
    leave: (id, on) => change({ kind: 'leave', id, on }),
    forget: (id, on) => change({ kind: 'forget', id, on }),
    remove: (id) => change({ kind: 'remove', id }),
    merge: (from, into) => change({ kind: 'merge', from, into }),
    setPolicy: () => Promise.resolve(),
    setMe: () => Promise.resolve(),
    mentionsOf: () => Promise.resolve([]),
  }
  return (
    <PersonPicker register={register} saying={saying} value={value} s={s}
      note={(one) => (one.id === 'pe-pia' ? '50% on 2026-10-11' : undefined)}
      onChange={(id) => { setValue(id); onPicked(id) }} />
  )
}

describe('the people a picker offers', () => {
  it('are the active entries a query matches, by name, and no redirect', () => {
    expect(pickable(START, '').map((one) => one.id)).toEqual(['pe-femke', 'pe-pia'])
    expect(pickable(START, 'schulz').map((one) => one.id)).toEqual(['pe-pia'])
    expect(pickable(START, 'acme.example').map((one) => one.id)).toEqual(['pe-pia'])
    expect(pickable(START, 'gijs')).toEqual([])
  })
})

describe('the person picker', () => {
  it('lists who is still here, marks you and says what each holds; a press picks the id', () => {
    const onPicked = vi.fn()
    renderShell(<Harness onPicked={onPicked} />)
    expect(screen.queryByTestId('person-pick-pe-gijs')).toBeNull()
    expect(screen.getByTestId('person-pick-pe-femke').textContent).toBe('Femke Bos · you')
    expect(screen.getByTestId('person-pick-pe-pia').textContent).toContain('50% on 2026-10-11')
    fireEvent.click(screen.getByTestId('person-pick-pe-pia'))
    expect(onPicked).toHaveBeenLastCalledWith('pe-pia')
    expect(screen.getByTestId('person-picked').textContent).toBe('Pia Schulz')
  })

  it('searches by name and says when nobody matches', () => {
    renderShell(<Harness onPicked={() => {}} />)
    fireEvent.change(screen.getByTestId('person-picker-search'), { target: { value: 'nobody here' } })
    expect(screen.getByText('Nobody matches “nobody here”.')).toBeTruthy()
  })

  it('lets a pick go again', () => {
    const onPicked = vi.fn()
    renderShell(<Harness onPicked={onPicked} />)
    fireEvent.click(screen.getByTestId('person-pick-pe-femke'))
    const picked = screen.getByTestId('person-picked')
    fireEvent.click(picked.querySelector('.MuiChip-deleteIcon')!)
    expect(onPicked).toHaveBeenLastCalledWith(undefined)
  })

  it('asks the four signs before anyone new is added, and offers who is already there', async () => {
    const onPicked = vi.fn()
    renderShell(<Harness onPicked={onPicked} />)
    fireEvent.click(screen.getByTestId('person-picker-new'))
    fireEvent.change(screen.getByTestId('people-add-name'), { target: { value: 'Pia Schultz' } })
    expect(screen.getByTestId('people-add-similar').textContent).toContain('Pia Schulz')
    fireEvent.click(screen.getByRole('button', { name: 'Use this one' }))
    expect(onPicked).toHaveBeenLastCalledWith('pe-pia')
  })

  it('adds someone new when asked to anyway, and picks the new entry', async () => {
    const onPicked = vi.fn()
    renderShell(<Harness onPicked={onPicked} />)
    fireEvent.click(screen.getByTestId('person-picker-new'))
    fireEvent.change(screen.getByTestId('people-add-name'), { target: { value: 'Pia Schultz' } })
    fireEvent.click(screen.getByTestId('people-add-save'))
    await waitFor(() => expect(onPicked).toHaveBeenLastCalledWith('pe-new'))
  })

  it('adds nobody where the register is only read', () => {
    renderShell(<Harness readOnly onPicked={() => {}} />)
    expect(screen.queryByTestId('person-picker-new')).toBeNull()
  })
})

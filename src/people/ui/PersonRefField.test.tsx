// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A field that names a person (ADR-0036 §8): text as before, or a person
 * picked from the register — offered while a name is typed, picked through
 * the register's picker, shown by what the register says, and taken off.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, screen, within } from '@testing-library/react'
import { useState } from 'react'
import { renderShell } from '../../app/testing/renderShell'
import { translator } from '../../i18n'
import type { PersonRef } from '../../model/person'
import type { Person } from '../person'
import { DEFAULT_POLICY } from '../policy'
import type { PeopleRegisterAccess } from './access'
import { NOT_READ, personNames, textNames } from './names'
import { PersonRefField } from './PersonRefField'

afterEach(() => cleanup())

const s = translator('en')

const EVA: Person = { id: 'pe-eva', name: 'Eva Lind', pseudonym: 'BCDF', kind: 'internal', state: 'active' }
const GONE: Person = { id: 'pe-gone', pseudonym: '7KQM', kind: 'internal', state: 'forgotten' }
const OLD: Person = { id: 'pe-old', pseudonym: 'GHJK', kind: 'internal', state: 'active', mergedInto: 'pe-eva' }

const nothing = () => Promise.resolve({ refused: 'people.unknown' as const })

/** The register as a page is handed it, read and never changed here. */
function access(people: readonly Person[] | undefined, over: Partial<PeopleRegisterAccess> = {}): PeopleRegisterAccess {
  return {
    people, policy: DEFAULT_POLICY, me: 'pe-eva', readOnly: false, today: '2026-10-11',
    add: nothing, change: nothing, leave: nothing, forget: nothing, remove: nothing, merge: nothing,
    setPolicy: () => Promise.resolve(), setMe: () => Promise.resolve(), mentionsOf: () => Promise.resolve([]),
    ...over,
  }
}

function Harness({ start, unread, disabled, onValue }: {
  start?: PersonRef; unread?: boolean; disabled?: boolean; onValue?: (ref: PersonRef | undefined) => void
}) {
  const [value, setValue] = useState<PersonRef | undefined>(start)
  const names = personNames(access(unread ? undefined : [EVA, GONE, OLD]), s)
  return (
    <PersonRefField
      value={value} names={names} label="Owner" disabled={disabled} testId="owner" s={s}
      onChange={(next) => { setValue(next); onValue?.(next) }}
    />
  )
}

describe('a field that names a person', () => {
  it('takes text as it always did', () => {
    const said: (PersonRef | undefined)[] = []
    renderShell(<Harness onValue={(ref) => said.push(ref)} />)
    fireEvent.change(screen.getByTestId('owner-text'), { target: { value: 'Operations' } })
    expect(said.at(-1)).toBe('Operations')
    fireEvent.change(screen.getByTestId('owner-text'), { target: { value: '' } })
    expect(said.at(-1)).toBeUndefined()
  })

  it('offers who in the register a typed name may be, and points at them when one is chosen', () => {
    const said: (PersonRef | undefined)[] = []
    renderShell(<Harness onValue={(ref) => said.push(ref)} />)
    fireEvent.change(screen.getByTestId('owner-text'), { target: { value: 'Eva Lindt' } })
    fireEvent.click(within(screen.getByTestId('owner-offered')).getByRole('button', { name: 'Eva Lind' }))
    expect(said.at(-1)).toEqual({ person: 'pe-eva' })
    expect(screen.getByTestId('owner-picked').textContent).toBe('Eva Lind · you')
  })

  it('picks from the register, starting from what was typed, and takes the person off again', () => {
    const said: (PersonRef | undefined)[] = []
    renderShell(<Harness onValue={(ref) => said.push(ref)} />)
    fireEvent.change(screen.getByTestId('owner-text'), { target: { value: 'Eva' } })
    fireEvent.click(screen.getByTestId('owner-pick'))
    expect((screen.getByTestId('person-picker-search') as HTMLInputElement).value).toBe('Eva')
    fireEvent.click(screen.getByTestId('person-pick-pe-eva'))
    expect(said.at(-1)).toEqual({ person: 'pe-eva' })
    fireEvent.click(within(screen.getByTestId('owner-picked')).getByTestId('CancelIcon'))
    expect(said.at(-1)).toBeUndefined()
    expect(screen.getByTestId('owner-text')).toBeDefined()
  })

  it('shows what the register says: a merged id as the entry kept, a forgotten one as its pseudonym', () => {
    renderShell(<Harness start={{ person: 'pe-old' }} />)
    expect(screen.getByTestId('owner-picked').textContent).toBe('Eva Lind · you')
    cleanup()
    renderShell(<Harness start={{ person: 'pe-gone' }} disabled />)
    expect(screen.getByTestId('owner-picked').textContent).toBe('Former colleague 7KQM')
    expect(within(screen.getByTestId('owner-picked')).queryByTestId('CancelIcon')).toBeNull()
  })

  it('offers no register where there is none, and says nobody yet before it is read', () => {
    renderShell(<Harness unread />)
    expect(screen.queryByTestId('owner-pick')).toBeNull()
    expect(personNames(access(undefined), s).text({ person: 'pe-eva' })).toBe(NOT_READ)
    expect(textNames(s).text('Operations')).toBe('Operations')
    expect(textNames(s).isMe({ person: 'pe-eva' })).toBe(false)
  })
})

describe('the names a page reads people with', () => {
  const names = personNames(access([EVA, GONE, OLD]), s)

  it('says the name a signature keeps, and nothing once the person is forgotten', () => {
    expect(names.nameOf('pe-old')).toBe('Eva Lind')
    expect(names.nameOf('pe-gone')).toBeUndefined()
    expect(names.canonical('pe-old')).toBe('pe-eva')
    expect(names.isMe({ person: 'pe-old' })).toBe(true)
  })

  it('marks nobody as you once the entry this install said is forgotten: it is nobody\'s to be', () => {
    const forgotten = personNames(access([EVA, GONE, OLD], { me: 'pe-gone' }), s)
    expect(forgotten.isMe({ person: 'pe-gone' })).toBe(false)
    expect(personNames(access([EVA, GONE, OLD], { me: 'pe-old' }), s).isMe({ person: 'pe-eva' })).toBe(true)
  })

  it('matches a word of a search to the ids it names', () => {
    expect([...names.match('lind')].sort()).toEqual(['pe-eva', 'pe-old'])
    expect([...names.match('7kqm')]).toEqual(['pe-gone'])
  })
})

describe('a field in a table row, committed when it is left', () => {
  function Row({ onValue, start }: { onValue: (ref: PersonRef | undefined) => void; start?: PersonRef }) {
    const [value, setValue] = useState<PersonRef | undefined>(start)
    return (
      <PersonRefField
        value={value} names={personNames(access([EVA, GONE, OLD]), s)} label="Signer" variant="standard" commit="blur"
        error helperText="Who signs" placeholder="A name" inputTestId="signer-input" s={s}
        onChange={(next) => { setValue(next); onValue(next) }}
      />
    )
  }

  it('commits typed text when the field is left or Enter is pressed, and not before', () => {
    const said: (PersonRef | undefined)[] = []
    renderShell(<Row onValue={(ref) => said.push(ref)} />)
    const input = screen.getByTestId('signer-input')
    expect(input.getAttribute('placeholder')).toBe('A name')
    expect(screen.getByText('Who signs')).toBeDefined()
    fireEvent.change(input, { target: { value: 'The board' } })
    expect(said).toEqual([])
    fireEvent.blur(input)
    expect(said).toEqual(['The board'])
    fireEvent.change(input, { target: { value: '' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(said).toEqual(['The board', undefined])
    fireEvent.blur(input)
    expect(said).toHaveLength(2)
  })

  it('goes back from the picker to the field without picking anyone', () => {
    const said: (PersonRef | undefined)[] = []
    renderShell(<Row onValue={(ref) => said.push(ref)} start="Eva" />)
    fireEvent.click(screen.getByRole('button', { name: 'From the register…' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect((screen.getByTestId('signer-input') as HTMLInputElement).value).toBe('Eva')
    expect(said).toEqual([])
  })

  it('offers nothing to pick while it may not be changed', () => {
    renderShell(<PersonRefField value="Eva Lind" names={personNames(access([EVA]), s)} label="Owner" disabled onChange={() => {}} s={s} />)
    expect(screen.queryByRole('button', { name: 'From the register…' })).toBeNull()
    expect(screen.queryByText('In the register:')).toBeNull()
  })
})

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV
// @vitest-environment jsdom

/**
 * Who recorded an observation on the register's column and in the reader
 * (ADR-0036 §10, amended 7 November 2026): the one render a forget reaches. A
 * name stored beside an entry is never read; what a source says of an account
 * answers a record with no entry; and a record with no name reads as what it
 * has, never as the word undefined.
 */
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { translator } from '../../i18n'
import type { HostModel } from '../../model/hostModel'
import type { Observation, RecordedBy } from '../../model/observation'
import type { Person } from '../../people/person'
import { DEFAULT_POLICY } from '../../people/policy'
import type { PeopleRegisterAccess } from '../../people/ui/access'
import { PersonNamesProvider, personNames } from '../../people/ui/names'
import { renderShell } from '../../app/testing/renderShell'
import { MarkdownView } from '../../documentation/ui/MarkdownView'
import { ObservationsPage } from './ObservationsPage'

afterEach(() => cleanup())

const STORED = 'Stored Words'
const VIEW = /^(View|Weergave|Ansicht)/
const RECORDED_BY = /^(Recorded by|Vastgelegd door|Erfasst von)/
const observation = (recordedBy: RecordedBy): Observation => ({
  id: 'o1', number: 1, title: 'Nightly batch overruns', date: '2026-09-08', impact: 'major', seen: 1, body: '',
  history: [{ date: '2026-09-08', kind: 'recorded' }], recordedBy,
})
const entry = (id: string, over: Partial<Person>): Person => ({ id, pseudonym: '4K7Q', kind: 'internal', state: 'active', ...over })

function mount(recordedBy: RecordedBy, people: readonly Person[] | undefined, recorder?: PeopleRegisterAccess['recorder'], language: 'en' | 'nl' | 'de' = 'en') {
  const model: HostModel = { name: 'Claims', elements: [], relations: [], diagrams: [], observations: [observation(recordedBy)] }
  const register = { people, policy: DEFAULT_POLICY, me: undefined, readOnly: true, ...(recorder ? { recorder } : {}) } as unknown as PeopleRegisterAccess
  renderShell(
    <PersonNamesProvider names={personNames(register, translator(language))}>
      <ObservationsPage
        open onClose={() => {}} model={model} groupName="Acme" below={[]} scopeLabel={(path) => path}
        onChange={() => {}} s={translator(language)} language={language} makeId={(prefix) => prefix} today={() => '2026-09-20'}
        renderMarkdown={(md) => <MarkdownView markdown={md} />}
      />
    </PersonNamesProvider>,
  )
}
const onTheColumn = () => {
  fireEvent.click(screen.getByRole('button', { name: VIEW }))
  fireEvent.click(screen.getByRole('checkbox', { name: RECORDED_BY }))
  return screen.getByTestId('observation-recorded-by-o1').textContent
}
const inTheReader = () => {
  fireEvent.keyDown(document.querySelector('.kit-filter__pop')!, { key: 'Escape' })
  fireEvent.click(screen.getByTestId('observation-row-o1'))
  return screen.getByTestId('observation-recorded-by').textContent
}
const both = (want: string) => {
  expect(onTheColumn()).toBe(want)
  expect(inTheReader()).toBe(want)
}

describe('who recorded it, on a screen', () => {
  const row: RecordedBy = { name: STORED, account: 'sub-1', person: 'pe-1' }

  it('reads the entry\'s name, not the name stored beside it', () => {
    mount(row, [entry('pe-1', { name: 'Mira Kuiper' })])
    both('Mira Kuiper')
  })

  it('reads the pseudonym once the entry is forgotten', () => {
    mount(row, [entry('pe-1', { state: 'forgotten', forgottenOn: '2026-10-01' })])
    both('Former colleague 4K7Q')
  })

  it('reads a former colleague once the entry is removed', () => {
    mount(row, [])
    both('A former colleague')
  })

  it('reads the kept entry after a merge', () => {
    mount(row, [entry('pe-1', { mergedInto: 'pe-2' }), entry('pe-2', { name: 'Kept Person' })])
    both('Kept Person')
  })

  it('says the agent beside whatever it reads', () => {
    mount({ ...row, via: 'An agent' }, [entry('pe-1', { state: 'forgotten', forgottenOn: '2026-10-01' })])
    both('Former colleague 4K7Q via An agent')
  })

  it('holds its tongue until the register has been read, rather than saying the stored name', () => {
    mount(row, undefined)
    both('…')
  })

  it('asks the source about an account with no entry: linked since, and renamed or erased', () => {
    mount({ name: STORED, account: 'sub-1' }, [entry('pe-1', { state: 'forgotten', forgottenOn: '2026-10-01' })], () => ({ person: 'pe-1' }))
    both('Former colleague 4K7Q')
    cleanup()
    mount({ name: STORED, account: 'sub-1' }, [], () => ({ name: 'Erased person 12' }))
    both('Erased person 12')
  })

  it('reads the stored name where nothing else answers', () => {
    mount({ name: 'Mira', account: 'sub-1' }, [], () => undefined)
    both('Mira')
  })

  it('reads a record that kept no name as what it has, in each language', () => {
    mount({ person: 'pe-1', via: 'An agent' }, [entry('pe-1', { name: 'Mira Kuiper' })])
    both('Mira Kuiper via An agent')
    cleanup()
    mount({ via: 'An agent' }, [])
    expect(onTheColumn()).toBe('via An agent')
    expect(inTheReader()).toBe('via An agent')
    cleanup()
    mount({ account: 'sub-1' }, [])
    expect(onTheColumn()).toBe('—')
    expect(inTheReader()).toBe('Who recorded it was not kept')
    cleanup()
    mount({ via: 'Ein Agent', account: 'sub-1' }, [], undefined, 'de')
    expect(onTheColumn()).not.toMatch(/undefined/)
    cleanup()
    mount({ via: 'Een agent', account: 'sub-1' }, [], undefined, 'nl')
    expect(onTheColumn()).not.toMatch(/undefined/)
  })
})

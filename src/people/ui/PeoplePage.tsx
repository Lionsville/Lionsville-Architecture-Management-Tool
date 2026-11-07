// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The People page (ADR-0036): a directory first, a register second. Most visits
 * ask who somebody is and what they hold, so the list is one line each, and a
 * person is a page with an address (`#/-/people/<id>`), up in the large preview
 * over the list, that a link reaches and Back steps through.
 *
 * Three tabs, each in the address: *People*; *To review*, the pairs that may be one
 * person (`Duplicates.tsx`), which is gone when nothing is left to review; and
 * *Privacy*, the policy (`PolicyPanel.tsx`).
 *
 * **Not a command.** Nothing on this page is a step: there is no undo and no line
 * in the Activity list, because the register is kept outside the history — which
 * is what lets a name be forgotten. The foot of the page says so, and whatever has
 * no way back asks first, saying what it does (`PersonQuestions.tsx`). A leaving
 * can be taken back until the name is forgotten (the owner, 7 November 2026).
 *
 * `readOnly` hides everything that changes the register. Where the source says who
 * may do what (`may`), each change is offered only to whoever may make it — of this
 * entry, where that is the entry's — and an address the source keeps from this
 * person is said to be kept, not missing.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PersonId } from '../../model/person'
import { NO_WINDOW_CHROME } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import { Band } from '../../widgets/kit/Band'
import { Button } from '../../widgets/kit/Button'
import { DayControl } from '../../widgets/kit/DayControl'
import { Dialog } from '../../widgets/kit/Dialog'
import { FilterWords } from '../../widgets/kit/FilterWords'
import { List } from '../../widgets/kit/List'
import { FRESH_VIEW, listed } from '../../widgets/kit/listView'
import type { ListHow, ListView } from '../../widgets/kit/listView'
import { MoreMenu } from '../../widgets/kit/Menu'
import type { MenuEntry } from '../../widgets/kit/Menu'
import { PageState } from '../../widgets/kit/PageState'
import { Preview } from '../../widgets/kit/Preview'
import { Tabs } from '../../widgets/kit/Tabs'
import { Toast } from '../../widgets/kit/Toast'
import { PageClose } from '../../widgets/PageClose'
import { PageDialog } from '../../widgets/PageDialog'
import { usePlaceGo, usePlaceRecord, usePlaceTab } from '../../widgets/placeTab'
import { duplicatePairs, possibleDuplicates } from '../duplicates'
import { rolesOn } from '../hold'
import { meIdIn, meIn } from '../me'
import type { Person, PersonState } from '../person'
import { entriesOf } from '../person'
import { registerOf, resolvePerson, shownEntry, shownText } from '../shown'
import type { Translate } from '../shown'
import { mayDo, useSaying } from './access'
import type { PeopleRegisterAccess } from './access'
import { AddPerson, tellsApart } from './AddPerson'
import { CorrectPerson } from './CorrectPerson'
import { CsvImport } from './CsvImport'
import { Duplicates, reviewable } from './Duplicates'
import { KIND_LABEL, rolesText, SHOW_LABEL, useDayWords } from './parts'
import type { RolesHeld } from './parts'
import { PersonFacts, PersonReader } from './PersonReader'
import type { PeopleLook } from './PersonReader'
import { PersonQuestion } from './PersonQuestions'
import type { Question } from './PersonQuestions'
import { PolicyPanel } from './PolicyPanel'
import { WhatWeHold } from './WhatWeHold'

export type { PeopleLook }

export type PeoplePageProps = {
  open: boolean
  onClose: () => void
  register: PeopleRegisterAccess
  /** A person to show, asked for from outside: a page beside this one; a link or an agent goes through the address. */
  select?: PersonId
  readText?: (file: Blob) => Promise<string>
  copyText?: (text: string) => void
  /**
   * The day the page is looked at (ADR-0027), held by the window: what a
   * person holds, will hold and held before is said of it. Absent, today.
   */
  look?: PeopleLook
  s: Translate
  windowChrome?: WindowChrome
}

const STATES: readonly PersonState[] = ['active', 'left', 'forgotten']

type Row = { person: Person; text: string; roles: RolesHeld }

/** The one quiet word at the end of a row, only where it differs: *you*, *External*, *Left 7 Nov 2026*. */
function noteOf(person: Person, me: PersonId | undefined, day: (day: string | undefined) => string, s: Translate): string | undefined {
  const words = [
    person.id === me ? s('people.you') : undefined,
    person.kind === 'external' ? s('people.kindExternal') : undefined,
    person.state === 'left' ? s('people.stateLeft', { day: day(person.leftOn) }) : undefined,
    person.state === 'forgotten' ? s('people.stateForgotten', { day: day(person.forgottenOn) }) : undefined,
  ].filter(Boolean)
  return words.length ? words.join(' · ') : undefined
}

/** A place on the rows from the find: the arrow goes down from the field to the list, as it does along it. */
function intoList(event: React.KeyboardEvent<HTMLDivElement>) {
  if (event.key !== 'ArrowDown' || !(event.target instanceof HTMLInputElement) || event.target.type !== 'search') return
  const first = event.currentTarget.querySelector<HTMLElement>('[data-kit-row][tabindex="0"]')
  if (first) { event.preventDefault(); first.focus() }
}

/** Nobody matches: the near names the register's own check finds, and adding the name that was typed. */
function NoMatch({ typed, people, register, onPick, onAdd, s }: {
  typed: string; people: readonly Person[]; register: PeopleRegisterAccess; onPick: (id: PersonId) => void; onAdd: (() => void) | undefined; s: Translate
}) {
  const near = possibleDuplicates({ name: typed }, people).slice(0, 5)
  return (
    <div className="people-stack" data-testid="people-no-match">
      <p>{s('people.searchEmpty', { query: typed })}{near.length > 0 && ` ${s('people.didYouMean')}`}</p>
      {near.length > 0 && (
        <div className="people-lines">
          {near.map(({ person }) => (
            <span key={person.id} className="people-line">
              <button type="button" className="people-link" onClick={() => onPick(person.id)}>{shownText(shownEntry(person), s)}</button>
              <span className="people-quiet"> · {tellsApart(person, register, s)}</span>
            </span>
          ))}
        </div>
      )}
      {onAdd && <div><Button onClick={onAdd} data-testid="people-add-typed">{s('people.addTyped', { name: typed })}</Button></div>}
    </div>
  )
}

/** What may be done to this person, in the one ⋯: reading first, what cannot be undone last. */
function personMenu(person: Person, register: PeopleRegisterAccess, acts: {
  ask: (question: Question) => void; setMe: (id: PersonId | undefined) => void; hold: () => void; copyAddress: (() => void) | undefined
}, s: Translate): MenuEntry[] {
  const named = person.state !== 'forgotten'
  const isMe = meIdIn(register.me, register.people) === person.id
  const may = (action: Parameters<typeof mayDo>[1]) => mayDo(register, action, person.id)
  const can = (on: boolean, entry: MenuEntry): MenuEntry[] => (on ? [entry] : [])
  return [
    ...can(named && !register.readOnly && !register.meSaid, { label: s(isMe ? 'people.notMe' : 'people.thisIsMe'), onSelect: () => acts.setMe(isMe ? undefined : person.id), 'data-guide': 'people.thisIsMe' }),
    ...can(acts.copyAddress !== undefined, { label: s('people.copyAddress'), onSelect: () => acts.copyAddress?.() }),
    { label: s('people.holdAsk'), onSelect: acts.hold, 'data-guide': 'people.hold' },
    { line: true },
    ...can(person.state === 'active' && may('leave'), { label: s('people.markLeftAsk'), onSelect: () => acts.ask({ kind: 'leave', person }), 'data-guide': 'people.markLeft' }),
    ...can(person.state === 'left' && register.takeBackLeaving !== undefined && may('leave'), { label: s('people.takeBackLeavingAsk'), onSelect: () => acts.ask({ kind: 'takeBack', person }), 'data-guide': 'people.takeBackLeaving' }),
    ...can(named && may('merge'), { label: s('people.mergeWith'), onSelect: () => acts.ask({ kind: 'mergePick', person }), 'data-guide': 'people.mergeWith' }),
    ...can(named && may('forget'), { label: s('people.forgetAsk'), final: true, onSelect: () => acts.ask({ kind: 'forget', person }), 'data-guide': 'people.forget' }),
    ...can(!named && may('remove'), { label: s('people.removeAsk'), final: true, onSelect: () => acts.ask({ kind: 'remove', person }), 'data-guide': 'people.remove' }),
  ]
}

/** The address of this page where the host has one to give: a browser's, not an installed app's. */
function hasAddress(): boolean {
  return /^https?:/.test(window.location.href)
}

export function PeoplePage({ open, onClose, register, select, readText, copyText, look, s, windowChrome = NO_WINDOW_CHROME }: PeoplePageProps) {
  const dayWords = useDayWords()
  const [tabAsked, setTab] = usePlaceTab('people')
  const [record, choose] = usePlaceRecord('people', select)
  const go = usePlaceGo()
  const [view, setView] = useState<ListView>(FRESH_VIEW)
  const [adding, setAdding] = useState<{ name?: string } | undefined>(undefined)
  const [importing, setImporting] = useState(false)
  const [correcting, setCorrecting] = useState<Person | undefined>(undefined)
  const [holding, setHolding] = useState<Person | undefined>(undefined)
  const [question, setQuestion] = useState<Question | undefined>(undefined)
  const [about, setAbout] = useState(false)
  const saying = useSaying(s)
  const page = useRef<HTMLDivElement>(null)

  // Asked for once, as it is asked: `choose` is new whenever the record moves, and must not bring somebody back who was let go of.
  const chooseNow = useRef(choose)
  chooseNow.current = choose
  useEffect(() => { if (select !== undefined) chooseNow.current(select) }, [select])
  // The page closed lets go of the person, so opening it again is the list and not whoever was last up.
  const wasOpen = useRef(open)
  useEffect(() => {
    if (wasOpen.current && !open) chooseNow.current(undefined)
    wasOpen.current = open
  }, [open])

  const people = useMemo(() => register.people ?? [], [register.people])
  const entries = useMemo(() => entriesOf(people), [people])
  const day = look?.day ?? register.today
  const { assignmentsOf } = register
  const rows = useMemo<readonly Row[]>(() => entries
    .map((person) => ({ person, text: shownText(shownEntry(person), s), roles: assignmentsOf ? rolesOn(assignmentsOf(person.id), day) : [] }))
    .sort((one, other) => one.text.localeCompare(other.text)), [entries, assignmentsOf, day, s])
  const roles = useMemo(() => (assignmentsOf ? new Map(rows.map((row) => [row.person.id, row.roles])) : undefined), [assignmentsOf, rows])
  const how = useMemo<ListHow<Row>>(() => ({
    // What can be seen can be found: by name, address, role and unit, and by the words a row says about somebody.
    words: ({ person, text, roles: held }) => [
      text, person.email ?? '', ...held.flatMap((one) => [one.role, one.unit]), held.length === 0 && assignmentsOf ? s('people.rolesNone') : '',
      person.kind === 'external' ? s('people.kindExternal') : '', person.state === 'active' ? '' : s(SHOW_LABEL[person.state]),
    ],
    filterBy: { state: ({ person }) => person.state, kind: ({ person }) => person.kind, holds: ({ roles: held }) => (held.length === 0 ? 'nothing' : 'some') },
    sortBy: {
      name: ({ text }) => text, roles: ({ roles: held }) => held[0]?.role ?? null, kind: ({ person }) => s(KIND_LABEL[person.kind]),
      state: ({ person }) => person.state, email: ({ person }) => person.email ?? null,
    },
  }), [assignmentsOf, s])
  const shown = useMemo(() => listed(rows, view, how).flatMap((group) => group.rows), [rows, view, how])
  const ids = useMemo(() => shown.map((row) => row.person.id), [shown])
  const countOf = (state: PersonState) => entries.filter((one) => one.state === state).length
  const pairs = useMemo(() => duplicatePairs(people, register.distinct), [people, register.distinct])
  const { offered, answered } = reviewable(pairs, register)
  const reviewing = offered.length + answered.length > 0
  const tab = tabAsked === 'review' && !reviewing ? 'people' : tabAsked
  const me = meIn(register.me, registerOf(people))?.id
  const person = record === undefined ? undefined : resolvePerson(record, registerOf(people))
  const readRegister = register.people !== undefined

  // An address that names nobody the register holds, or one who is gone since: said, and the list is what is left.
  useEffect(() => {
    if (open && readRegister && record !== undefined && !person) {
      choose(undefined)
      void saying.run(Promise.resolve({ refused: 'people.unknown' as const }), () => '')
    }
  }, [open, readRegister, record, person, choose, saying])

  // Ready to type on arrival, and on /: a directory is mostly looked things up in.
  useEffect(() => {
    if (open && readRegister && record === undefined) page.current?.querySelector<HTMLInputElement>('input[type="search"]')?.focus({ preventScroll: true })
    // Once for each opening: never again under somebody who has moved on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, readRegister])
  useEffect(() => {
    if (!open) return undefined
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey) return
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return
      const field = page.current?.querySelector<HTMLInputElement>('input[type="search"]')
      if (field) { event.preventDefault(); field.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const pick = useCallback((id: PersonId) => { if (tabAsked !== 'people') setTab('people'); choose(id) }, [tabAsked, setTab, choose])
  const findMe = me === undefined ? undefined : () => { setView(FRESH_VIEW); pick(me) }
  const setMe = (id: string | undefined) => {
    void saying.run(register.setMe(id).then(() => ({})), () => s(id ? 'people.thisIsYou' : 'people.saved'))
  }
  const mayAdd = mayDo(register, 'add')
  const typed = view.find.trim()
  const canCorrect = person !== undefined && person.state !== 'forgotten' && mayDo(register, 'change', person.id)
  const columnsOn = view.columns ?? (assignmentsOf ? ['roles'] : [])
  const columnChoices = [
    ...(assignmentsOf ? [{ id: 'roles', label: day === register.today ? s('people.colRoles') : s('people.colRolesOn', { day: dayWords(day) }) }] : []),
    { id: 'kind', label: s('people.colKind') }, { id: 'state', label: s('people.colState') }, { id: 'email', label: s('people.colEmail') },
  ]
  const stateWord = (one: Person) => (one.state === 'left' ? s('people.stateLeft', { day: dayWords(one.leftOn) })
    : one.state === 'forgotten' ? s('people.stateForgotten', { day: dayWords(one.forgottenOn) }) : s('people.stateActive'))

  return (
    <PageDialog open={open} topInset={windowChrome.topInset} onClose={onClose} aria-label={s('people.title')}>
      <div className="people-page" ref={page}>
        <div className="people-head" data-testid="people-topbar">
          <Tabs
            label={s('people.title')} value={tab} onChange={setTab} data-guide="people.tabs"
            items={[
              { value: 'people', label: s('people.title'), count: entries.length },
              { value: 'review', label: s('people.tabReview'), count: offered.length, hidden: !reviewing },
              { value: 'privacy', label: s('people.tabPrivacy') },
            ]}
          />
          <div className="people-head__end">
            {look && tab === 'people' && <DayControl day={look.day} onChange={look.onDay} data-guide="people.day" />}
            {mayAdd && (
              <>
                <Button onClick={() => setImporting(true)} data-testid="people-import" data-guide="people.importCsv">{s('people.importCsv')}</Button>
                <Button variant="primary" onClick={() => setAdding({})} data-testid="people-add" data-guide="people.add">{s('people.add')}</Button>
              </>
            )}
            <PageClose onClose={onClose} />
          </div>
        </div>
        {look?.day !== undefined && tab === 'people' && (
          <Band
            tone="looking" title={s('people.lookingAt', { day: dayWords(look.day) })} detail={s('people.lookingNote')}
            action={<Button size="small" onClick={() => look.onDay(undefined)} data-testid="people-look-today">{s('people.lookToday')}</Button>}
          />
        )}
        <div className="people-main" role="tabpanel" aria-label={tab === 'people' ? s('people.title') : tab === 'review' ? s('people.tabReview') : s('people.tabPrivacy')} onKeyDown={intoList}>
          {tab === 'people' && !readRegister && <PageState state="loading" />}
          {tab === 'people' && readRegister && entries.length === 0 && (
            <PageState
              state="empty" title={s('people.emptyTitle')} body={s(mayAdd ? 'people.emptyBody' : 'people.emptyReader')}
              {...(mayAdd ? { action: { label: s('people.add'), onPress: () => setAdding({}) } } : {})}
            />
          )}
          {tab === 'people' && entries.length > 0 && (
            <>
              <FilterWords
                find={view.find} onFind={(find) => setView((was) => ({ ...was, find }))} findLabel={s('people.search')} dataGuide="people.find"
                fields={[
                  { id: 'state', label: s('people.show'), options: STATES.map((one) => ({ value: one, label: s(SHOW_LABEL[one]), count: countOf(one) })) },
                  { id: 'kind', label: s('people.kind'), options: [{ value: 'internal', label: s('people.kindInternal') }, { value: 'external', label: s('people.kindExternal') }] },
                  ...(assignmentsOf ? [{ id: 'holds', label: s('people.colRoles'), options: [{ value: 'nothing', label: s('people.rolesNone') }] }] : []),
                ]}
                filters={view.filters} onFilters={(filters) => setView((was) => ({ ...was, filters }))}
                columns={columnChoices} shownColumns={columnsOn} onColumns={(columns) => setView((was) => ({ ...was, columns }))}
                shown={{ count: shown.length, total: entries.length }}
                actions={(
                  <span className="people-actions">
                    <span className="people-counts" data-testid="people-counts">{s('people.counts', { active: countOf('active'), left: countOf('left'), forgotten: countOf('forgotten') })}</span>
                    {findMe && <Button variant="quiet" onClick={findMe} data-testid="people-find-me">{s('people.findMe')}</Button>}
                  </span>
                )}
              />
              <div className="people-list" data-testid="people-table">
                <List
                  label={s('people.title')} itemLabel={s('people.colName')} itemSortable rowGuide="people.row"
                  sort={view.sort} onSort={(sort) => setView((was) => ({ ...was, sort }))}
                  columns={columnChoices.filter((one) => columnsOn.includes(one.id)).map((one) => ({ ...one, sortable: true }))}
                  selectedId={person?.id ?? null} onOpen={pick}
                  groups={shown.length === 0 ? [] : [{
                    id: '', label: '',
                    rows: shown.map((row) => {
                      const note = noteOf(row.person, me, dayWords, s)
                      return {
                        id: row.person.id, text: row.text, ...(note ? { note } : {}),
                        cells: {
                          roles: <span data-testid="people-roles" className={row.roles.length ? undefined : 'people-quiet'} title={row.roles.map((one) => s('people.roleIn', one)).join(', ')}>{rolesText(row.roles, s)}</span>,
                          kind: s(KIND_LABEL[row.person.kind]),
                          state: stateWord(row.person),
                          email: row.person.email ?? (register.withheld?.(row.person.id) ? s('people.emailWithheld') : ''),
                        },
                      }
                    }),
                  }]}
                  empty={(
                    <NoMatch
                      typed={typed} people={people} register={register} onPick={pick} s={s}
                      onAdd={mayAdd && typed ? () => setAdding({ name: typed }) : undefined}
                    />
                  )}
                />
              </div>
            </>
          )}
          {tab === 'review' && (
            <Duplicates
              pairs={pairs} register={register} saying={saying} roles={roles} s={s}
              onMerge={(keep, drop) => setQuestion({ kind: 'merge', one: keep, other: drop })}
            />
          )}
          {tab === 'privacy' && <PolicyPanel register={register} saying={saying} s={s} />}
        </div>
        <div className="people-foot" data-testid="people-foot">
          <span data-testid="people-not-a-step">{s(register.readOnly ? 'people.readOnly' : 'people.notAStepShort')}</span>{' '}
          <button type="button" className="people-link" aria-expanded={about} aria-controls="people-about" onClick={() => setAbout((was) => !was)} data-testid="people-about">{s('people.about')}</button>
          {about && <p id="people-about" className="people-foot__more">{s('people.what')}</p>}
        </div>
      </div>
      <Preview
        ids={ids} currentId={person?.id ?? null} onSelect={(id) => choose(id ?? undefined)} dataGuide="people.person"
        title={<span data-testid="people-person-name">{person ? shownText(shownEntry(person), s) : ''}</span>}
        listWord={s('people.title').toLowerCase()}
        {...(person ? { facts: <PersonFacts person={person} register={register} s={s} /> } : {})}
        foot={person && (
          <div className="people-actions">
            {canCorrect && <Button onClick={() => setCorrecting(person)} data-testid="people-correct" data-guide="people.correct">{s('people.correct')}</Button>}
            <MoreMenu
              data-guide="people.more"
              items={personMenu(person, register, {
                ask: setQuestion, setMe, hold: () => setHolding(person),
                copyAddress: copyText && go && hasAddress() ? () => { copyText(window.location.href); void saying.run(Promise.resolve({}), () => s('people.addressCopied')) } : undefined,
              }, s)}
            />
          </div>
        )}
      >
        {person && (
          <PersonReader
            person={person} register={register} day={day} go={go} onPerson={pick} s={s}
            {...(mayDo(register, 'forget', person.id) && person.state === 'left' ? { onForget: () => setQuestion({ kind: 'forget', person }) } : {})}
          />
        )}
      </Preview>
      <Dialog
        open={adding !== undefined} size="m" title={s('people.addTitle')} onClose={() => setAdding(undefined)}
        actions={null}
      >
        {adding && mayAdd && (
          <AddPerson
            register={register} saying={saying} {...(adding.name ? { initialName: adding.name } : {})} s={s}
            onAdded={(id) => { setAdding(undefined); pick(id) }} onUse={(id) => { setAdding(undefined); pick(id) }} onCancel={() => setAdding(undefined)}
          />
        )}
      </Dialog>
      {correcting && <CorrectPerson person={correcting} register={register} saying={saying} onClose={() => setCorrecting(undefined)} s={s} />}
      {holding && <WhatWeHold person={holding} register={register} copyText={copyText} onClose={() => setHolding(undefined)} s={s} />}
      <PersonQuestion question={question} day={day} register={register} saying={saying} onAsk={setQuestion} onClose={() => setQuestion(undefined)} s={s} />
      <CsvImport open={importing} register={register} saying={saying} {...(readText ? { readText } : {})} onClose={() => setImporting(false)} s={s} />
      <Toast toast={saying.said ? { key: saying.said.key, message: saying.said.text } : null} onClose={saying.clear} />
    </PageDialog>
  )
}


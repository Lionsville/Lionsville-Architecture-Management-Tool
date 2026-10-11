// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The People page (ADR-0036): the organisation's register of people, on a
 * page of its own over the organisation's home.
 *
 * Everyone, by state and by search, each with the roles they hold on the
 * page's day — *none* said as such, so whoever holds nothing stands out; the
 * pairs that may be one person, each a merge away; a person, with what is
 * held about them and what may be done;
 * a new person, checked for duplicates before anyone is added; a list
 * imported, row by row through the same check; and the policy.
 *
 * **Not a command.** Nothing on this page is a step: there is no undo and no
 * line in the Activity list, because the register is kept outside the
 * history — which is what lets a name be forgotten. The page says so, and
 * the three changes that are final — merge, forget, remove — ask first. A
 * merge of somebody active into an entry that has left asks which is true,
 * still here or left (`MergeLeaving.tsx`), and never ends a role in silence.
 *
 * A full-window page like the registers: it takes the window chrome, works
 * in both themes, and `readOnly` hides everything that changes the register.
 * Where the source says who may do what (`may`), each change is offered only
 * to whoever may make it — of this entry, where that is the entry's — and an
 * address the source keeps from this person is said to be kept, not missing.
 */
import { useEffect, useMemo, useState } from 'react'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { PersonId } from '../../model/person'
import { matchesQuery } from '../../model/textSearch'
import { NO_WINDOW_CHROME, barChromeFor } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import { ConfirmDialog } from '../../widgets/ConfirmDialog'
import { PageDialog } from '../../widgets/PageDialog'
import { useLocatedIn } from '../../widgets/useLocated'
import { duplicatePairs } from '../duplicates'
import { rolesOn } from '../hold'
import type { DuplicatePair } from '../duplicates'
import { meIn } from '../me'
import type { MergeLeaving, Person, PersonState } from '../person'
import { entriesOf, mergeAsks } from '../person'
import { registerOf, shownEntry, shownText } from '../shown'
import type { Translate } from '../shown'
import { mayDo, useSaying } from './access'
import type { PeopleRegisterAccess, Saying } from './access'
import { AddPerson, SIGN_LABEL } from './AddPerson'
import { CsvImport } from './CsvImport'
import { MergeLeavingChoice, mergeLeavingFirst } from './MergeLeaving'
import { KIND_LABEL, SHOW_LABEL } from './parts'
import { PersonPanel } from './PersonPanel'
import type { PeopleLook } from './PersonPanel'
import { PolicyPanel } from './PolicyPanel'

export type PeoplePageProps = {
  open: boolean
  onClose: () => void
  register: PeopleRegisterAccess
  /** A person to show, asked for from outside: an agent's `app.open`, a link. */
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

type Show = PersonState | 'all'

/**
 * One of the three changes that are final, waiting for the person's yes. A
 * merge that asks whether the person is still here carries the answer
 * chosen so far, and the day the entry kept left.
 */
type Asking =
  | { kind: 'merge'; from: Person; into: Person; leaving?: { answer: MergeLeaving; leftOn: string } }
  | { kind: 'forget'; person: Person }
  | { kind: 'remove'; person: Person }

const SHOWS: readonly Show[] = ['all', 'active', 'left', 'forgotten']

function stateText(person: Person, s: Translate): string {
  if (person.state === 'left') return s('people.stateLeft', { day: person.leftOn ?? '' })
  if (person.state === 'forgotten') return s('people.stateForgotten', { day: person.forgottenOn ?? '' })
  return s('people.stateActive')
}

/** What a final change asks, and what saying yes does. */
function asked(asking: Asking, register: PeopleRegisterAccess, saying: Saying, s: Translate) {
  const name = (person: Person) => shownText(shownEntry(person), s)
  if (asking.kind === 'merge') {
    const words = { drop: name(asking.from), keep: name(asking.into) }
    const leaving = asking.leaving
    const done = (merged: { ended: number }) => {
      if (leaving?.answer === 'stillHere') return s('people.mergeDoneHere', words)
      if (leaving?.answer === 'left') return s('people.mergeDoneLeft', { ...words, count: merged.ended, day: leaving.leftOn })
      return s('people.mergeDone', words)
    }
    return {
      title: s('people.mergeTitle', words), body: s('people.mergeBody', words), confirm: s('people.mergeConfirm'),
      run: () => saying.run(register.merge(asking.from.id, asking.into.id, leaving?.answer), done),
    }
  }
  if (asking.kind === 'forget') {
    const words = { name: name(asking.person), pseudonym: s('people.former', { code: asking.person.pseudonym }) }
    return {
      title: s('people.forgetTitle', words), body: s('people.forgetBody', words), confirm: s('people.forget'),
      run: () => saying.run(register.forget(asking.person.id, register.today), () => s('people.forgetDone', words)),
    }
  }
  const words = { pseudonym: name(asking.person) }
  return {
    title: s('people.removeTitle', words), body: s('people.removeBody'), confirm: s('people.remove'),
    run: () => saying.run(register.remove(asking.person.id), () => s('people.removeDone')),
  }
}

/**
 * The question a final change asks, and — for a merge of somebody active into
 * an entry that has left — which is true, still here or left.
 */
function Asked({ asking, onAsking, register, saying, s }: {
  asking: Asking | undefined; onAsking: (next: Asking | undefined) => void; register: PeopleRegisterAccess; saying: Saying; s: Translate
}) {
  const asks = asking && asked(asking, register, saying, s)
  const merging = asking?.kind === 'merge' ? asking : undefined
  const leaving = merging?.leaving
  return (
    <ConfirmDialog
      open={asks !== undefined}
      title={asks?.title ?? ''}
      body={asks?.body ?? ''}
      confirmLabel={asks?.confirm ?? ''}
      cancelLabel={s('people.cancel')}
      onCancel={() => onAsking(undefined)}
      onConfirm={() => {
        if (asks) void asks.run()
        onAsking(undefined)
      }}
    >
      {merging && leaving && (
        <MergeLeavingChoice
          drop={shownText(shownEntry(merging.from), s)} keep={shownText(shownEntry(merging.into), s)}
          leftOn={leaving.leftOn} held={register.assignmentsOf?.(merging.from.id) ?? []} value={leaving.answer}
          onChange={(answer) => onAsking({ ...merging, leaving: { leftOn: leaving.leftOn, answer } })} s={s}
        />
      )}
    </ConfirmDialog>
  )
}

function Duplicates({ pairs, onMerge, s }: { pairs: readonly DuplicatePair[]; onMerge: (from: Person, into: Person) => void; s: Translate }) {
  const name = (person: Person) => shownText(shownEntry(person), s)
  return (
    <Box data-testid="people-duplicates" sx={{ mb: 2 }}>
      <Typography component="h2" sx={{ fontSize: 13, fontWeight: 700, mb: 0.5 }}>{s('people.duplicates')}</Typography>
      {pairs.map((pair) => (
        <Box key={`${pair.drop.id}|${pair.keep.id}`} sx={{ display: 'flex', gap: 1, alignItems: 'center', fontSize: 12, flexWrap: 'wrap' }}>
          <span>{s('people.duplicatePair', { drop: name(pair.drop), keep: name(pair.keep), why: s(SIGN_LABEL[pair.sign]) })}</span>
          <Button size="small" onClick={() => onMerge(pair.drop, pair.keep)} data-testid={`people-merge-${pair.drop.id}`}>
            {s('people.mergeInto', { drop: name(pair.drop), keep: name(pair.keep) })}
          </Button>
        </Box>
      ))}
    </Box>
  )
}

/** The roles a person holds on the page's day, each in its unit: those that read as one person. */
type RolesHeld = readonly { role: string; unit: string }[]

/** As many roles as a row says before it counts the rest. */
const ROLES_SAID = 2

/** A row's roles, compact: the first few, how many more, and *none* said as such. */
function RolesCell({ roles, s }: { roles: RolesHeld; s: Translate }) {
  if (roles.length === 0) return <Box component="span" sx={{ color: 'text.secondary', fontStyle: 'italic' }}>{s('people.rolesNone')}</Box>
  const said = (some: RolesHeld) => some.map((one) => s('people.roleIn', one)).join(', ')
  const rest = roles.slice(ROLES_SAID)
  return (
    <>
      {said(roles.slice(0, ROLES_SAID))}
      {rest.length > 0 && <Box component="span" title={said(rest)} sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}> {s('people.rolesMore', { count: rest.length })}</Box>}
    </>
  )
}

function Everyone({ shown, selected, me, withheld, roles, day, today, onSelect, s }: {
  shown: readonly Person[]; selected: PersonId | undefined; me: PersonId | undefined
  withheld: ((id: PersonId) => boolean) | undefined
  /** What each holds on `day`; absent where the shell has no tree to read, and the column with it. */
  roles: ReadonlyMap<PersonId, RolesHeld> | undefined
  day: string; today: string
  onSelect: (id: PersonId) => void; s: Translate
}) {
  return (
    <Box component="table" data-testid="people-table" sx={{
      width: '100%', borderCollapse: 'collapse', fontSize: 13,
      '& th': { textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, py: 0.75 },
      '& th, & td': { borderBottom: 1, borderColor: 'divider', pr: 1 },
      '& td': { py: 0.5 },
    }}>
      <thead>
        <tr>
          <th>{s('people.colName')}</th><th>{s('people.colKind')}</th><th>{s('people.colState')}</th>
          {roles && <th>{day === today ? s('people.colRoles') : s('people.colRolesOn', { day })}</th>}
          <th>{s('people.colEmail')}</th>
        </tr>
      </thead>
      <tbody>
        {shown.map((person) => (
          <Box component="tr" key={person.id} data-testid={`people-row-${person.id}`} data-guide="people.row" data-person-id={person.id}
            sx={{ bgcolor: person.id === selected ? 'action.selected' : undefined }}>
            <td>
              <Box component="button" type="button" onClick={() => onSelect(person.id)} aria-pressed={person.id === selected}
                sx={{ font: 'inherit', fontWeight: 600, p: 0, border: 0, bgcolor: 'transparent', color: 'text.primary', cursor: 'pointer', textAlign: 'left', '&:hover': { color: 'primary.main', textDecoration: 'underline' } }}>
                {shownText(shownEntry(person), s)}
              </Box>
              {person.id === me && <Chip size="small" label={s('people.you')} sx={{ ml: 1, height: 18, fontSize: 10 }} />}
            </td>
            <td>{s(KIND_LABEL[person.kind])}</td>
            <td>{stateText(person, s)}</td>
            {roles && <td data-testid="people-roles"><RolesCell roles={roles.get(person.id) ?? []} s={s} /></td>}
            <td>{person.email ?? (withheld?.(person.id) ? s('people.emailWithheld') : '')}</td>
          </Box>
        ))}
      </tbody>
    </Box>
  )
}

function TopBar({ chrome, show, onShow, query, onQuery, counts, readOnly, onAdd, onImport, onFindMe, onClose, s }: {
  chrome: WindowChrome; show: Show; onShow: (show: Show) => void; query: string; onQuery: (query: string) => void
  counts: string; readOnly: boolean; onAdd: () => void; onImport: () => void
  /** *Find me* (ADR-0036 §11): absent while nobody is said to be you. */
  onFindMe: (() => void) | undefined
  onClose: () => void; s: Translate
}) {
  const bar = barChromeFor(chrome)
  return (
    <Box data-testid="people-topbar" sx={{
      display: 'flex', flexWrap: 'wrap', rowGap: 0.5, alignItems: 'center', gap: 1, px: 1.5, pl: `${12 + bar.controlsInset}px`,
      WebkitAppRegion: bar.draggable ? 'drag' : undefined, '& button, & a, & input, & [role="combobox"]': { WebkitAppRegion: 'no-drag' },
      minHeight: 48, borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0,
    }}>
      <Tooltip title={s('common.close')}>
        <IconButton size="small" aria-label={s('common.close')} onClick={onClose}>
          <Box component="span" aria-hidden sx={{ display: 'inline-block', width: 18, textAlign: 'center', fontSize: 16, lineHeight: 1 }}>‹</Box>
        </IconButton>
      </Tooltip>
      <Typography component="h1" variant="body2" sx={{ fontWeight: 600 }}>{s('people.title')}</Typography>
      <Chip size="small" variant="outlined" label={s('people.badge')} sx={{ height: 20, fontSize: 11 }} />
      <Typography sx={{ fontSize: 11, color: 'text.secondary' }} data-testid="people-counts">{counts}</Typography>
      <Box sx={{ flex: 1 }} />
      <TextField size="small" select value={show} onChange={(event) => onShow(event.target.value as Show)}
        slotProps={{ select: { inputProps: { 'aria-label': s('people.show') } } }} sx={{ minWidth: 120 }}>
        {SHOWS.map((one) => <MenuItem key={one} value={one}>{s(SHOW_LABEL[one])}</MenuItem>)}
      </TextField>
      <TextField size="small" value={query} onChange={(event) => onQuery(event.target.value)} placeholder={s('people.search')}
        slotProps={{ htmlInput: { 'aria-label': s('people.search'), autoComplete: 'off', 'data-testid': 'people-search' } }} sx={{ width: 200 }} />
      {onFindMe && <Button size="small" variant="outlined" onClick={onFindMe} data-testid="people-find-me">{s('people.findMe')}</Button>}
      {!readOnly && (
        <>
          <Button size="small" onClick={onImport} data-testid="people-import" data-guide="people.importCsv">{s('people.importCsv')}</Button>
          <Button size="small" variant="contained" onClick={onAdd} data-testid="people-add" data-guide="people.add">{s('people.add')}</Button>
        </>
      )}
    </Box>
  )
}

/**
 * *Find me* (ADR-0036 §11): the whole list, so your row is in it, chosen,
 * brought on screen and ringed. Absent while nobody is said to be you.
 */
function useFindMe(me: PersonId | undefined, pick: (id: PersonId) => void, showAll: () => void) {
  const located = useLocatedIn(pick, 'data-person-id')
  const findMe = me === undefined ? undefined : () => { showAll(); located.locate(me) }
  return { ref: located.ref, ring: located.ring, findMe }
}

export function PeoplePage({ open, onClose, register, select, readText, copyText, look, s, windowChrome = NO_WINDOW_CHROME }: PeoplePageProps) {
  const [show, setShow] = useState<Show>('all')
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<PersonId | undefined>(select)
  const [adding, setAdding] = useState(false)
  const [importing, setImporting] = useState(false)
  const [asking, setAsking] = useState<Asking | undefined>(undefined)
  const saying = useSaying(s)
  useEffect(() => { if (select !== undefined) { setSelected(select); setAdding(false) } }, [select])

  const people = useMemo(() => register.people ?? [], [register.people])
  const entries = useMemo(() => entriesOf(people), [people])
  // What each holds on the page's day, read once for the rows and the search: the same read the person's *Holds today* is.
  const day = look?.day ?? register.today
  const { assignmentsOf } = register
  const roles = useMemo(
    () => (assignmentsOf ? new Map(entries.map((person) => [person.id, rolesOn(assignmentsOf(person.id), day)])) : undefined),
    [assignmentsOf, entries, day],
  )
  // By what each reads as, so a forgotten entry sorts by its pseudonym and never by a name it no longer has.
  const shown = useMemo(
    () => entries.filter((person) => (show === 'all' || person.state === show)
      && (!query.trim() || matchesQuery(query, [
        shownText(shownEntry(person), s), person.email, ...(roles?.get(person.id) ?? []).flatMap((one) => [one.role, one.unit]),
      ])))
      .map((person) => ({ person, text: shownText(shownEntry(person), s) }))
      .sort((one, other) => one.text.localeCompare(other.text))
      .map(({ person }) => person),
    [entries, show, query, roles, s],
  )
  const pairs = useMemo(() => duplicatePairs(people), [people])
  const me = meIn(register.me, registerOf(people))?.id
  const person = selected === undefined ? undefined : entries.find((one) => one.id === selected)
  const counts = s('people.counts', {
    active: entries.filter((one) => one.state === 'active').length,
    left: entries.filter((one) => one.state === 'left').length,
    forgotten: entries.filter((one) => one.state === 'forgotten').length,
  })
  const pick = (id: PersonId) => { setSelected(id); setAdding(false) }
  // Somebody active into an entry that has left: still here or left, chosen to start with by their roles.
  const askMerge = (from: Person, into: Person) => {
    const leftOn = into.leftOn
    const leaving = mergeAsks(from, into) && leftOn !== undefined
      ? { answer: mergeLeavingFirst(register.assignmentsOf?.(from.id) ?? [], leftOn), leftOn }
      : undefined
    setAsking({ kind: 'merge', from, into, ...(leaving ? { leaving } : {}) })
  }
  const located = useFindMe(me, pick, () => { setShow('all'); setQuery('') })

  return (
    <PageDialog open={open} topInset={windowChrome.topInset} onClose={onClose} aria-label={s('people.title')}>
      <TopBar chrome={windowChrome} show={show} onShow={setShow} query={query} onQuery={setQuery} counts={counts} readOnly={!mayDo(register, 'add')}
        onAdd={() => setAdding(true)} onImport={() => setImporting(true)} onFindMe={located.findMe} onClose={onClose} s={s} />
      <Box ref={located.ref} sx={{ flex: 1, minHeight: 0, display: 'flex', flexWrap: 'wrap', overflowY: 'auto', ...located.ring }}>
        <Box component="main" sx={{ flex: '2 1 420px', minWidth: 0, px: 3, py: 2 }}>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>{s('people.what')}</Typography>
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 2 }} data-testid="people-not-a-step">
            {s(register.readOnly ? 'people.readOnly' : 'people.notAStep')}
          </Typography>
          {pairs.length > 0 && mayDo(register, 'merge') && <Duplicates pairs={pairs} onMerge={askMerge} s={s} />}
          {entries.length === 0 && <Typography sx={{ fontSize: 13 }}>{s('people.empty')}</Typography>}
          {entries.length > 0 && shown.length === 0 && <Typography sx={{ fontSize: 13 }}>{s('people.searchEmpty', { query: query.trim() })}</Typography>}
          {shown.length > 0 && (
            <Everyone shown={shown} selected={selected} me={me} withheld={register.withheld} roles={roles} day={day} today={register.today} onSelect={pick} s={s} />
          )}
        </Box>
        <Box component="aside" aria-label={s('people.title')} sx={{ flex: '1 1 300px', minWidth: 0, px: 2, py: 2, borderLeft: 1, borderColor: 'divider', bgcolor: 'background.paper' }}>
          {saying.said && (
            <Alert severity={saying.said.tone} role="status" sx={{ mb: 1.5, fontSize: 12 }} data-testid="people-said">{saying.said.text}</Alert>
          )}
          {adding && mayDo(register, 'add') && (
            <AddPerson register={register} saying={saying} onAdded={pick} onUse={pick} onCancel={() => setAdding(false)} s={s} />
          )}
          {!adding && person && (
            <PersonPanel person={person} register={register} saying={saying} copyText={copyText} s={s} look={look}
              onForget={(one) => setAsking({ kind: 'forget', person: one })}
              onRemove={(one) => setAsking({ kind: 'remove', person: one })}
              onMerge={askMerge} />
          )}
          {!adding && !person && <Typography sx={{ fontSize: 13, color: 'text.secondary' }}>{s('people.noneSelected')}</Typography>}
          <PolicyPanel register={register} saying={saying} s={s} />
        </Box>
      </Box>
      <Asked asking={asking} onAsking={setAsking} register={register} saying={saying} s={s} />
      <CsvImport open={importing} register={register} saying={saying} readText={readText} onClose={() => setImporting(false)} s={s} />
    </PageDialog>
  )
}

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The possible duplicates on the People page (ADR-0036 §9, as built in
 * 3.6.1): folded unless somebody is looking at them, and an answer that sticks.
 *
 * - **Folded every time the page opens**, and kept as nothing: one line — how
 *   many, how many by sign, and *Review*. Open, the pairs come strongest sign
 *   first. The fold is not there when no pair is left.
 * - **A pair is one row**: the two people side by side, each with what tells
 *   them apart — the first role today and how many more, the work address,
 *   *External*, and an account where a source with accounts says one is
 *   linked — the sign as a quiet tag, and *Merge…* and *Not the same person*.
 *   The entry on the left is the one a merge keeps to start with: the one
 *   linked to an account, then the one with more assignments.
 * - **Under the list**, the pairs answered as not the same person, each with
 *   *Take back*.
 *
 * Each row is offered to whoever may merge the two, or answer about them
 * (`mayMerge`, `mayAnswer`), and offers only that.
 */
import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'
import type { PersonId } from '../../model/person'
import type { DistinctPair } from '../distinct'
import { DUPLICATE_SIGNS } from '../duplicates'
import type { DuplicatePair } from '../duplicates'
import type { Person } from '../person'
import { registerOf, resolvePerson, shownEntry, shownText } from '../shown'
import type { Translate } from '../shown'
import { mayAnswer, mayMerge } from './access'
import type { PeopleRegisterAccess, Saying } from './access'
import { SIGN_LABEL } from './AddPerson'
import { RolesLine } from './parts'
import type { RolesHeld } from './parts'

export type DuplicatesProps = {
  /** Every pair that may be one person, strongest sign first, the pairs answered left out (`duplicatePairs`). */
  pairs: readonly DuplicatePair[]
  register: PeopleRegisterAccess
  saying: Saying
  /** What each holds today; absent where the shell has no tree to read. */
  roles: ReadonlyMap<PersonId, RolesHeld> | undefined
  /** *Merge…*: the asks-first dialog, with the entry to keep chosen to start with and swappable. */
  onMerge: (keep: Person, drop: Person) => void
  s: Translate
}

/** A plain text button: quiet, in the sentence's own case. */
const QUIET = { textTransform: 'none', minWidth: 0, px: 0.5, py: 0, fontSize: 12, justifyContent: 'flex-start' } as const

/** The two of a pair in the order a merge keeps them to start with: an account first, then more assignments, then the pair's own. */
export function keptFirst(pair: Pick<DuplicatePair, 'keep' | 'drop'>, register: Pick<PeopleRegisterAccess, 'linked' | 'assignmentsOf'>): [Person, Person] {
  const weight = (person: Person) => [register.linked?.(person.id) ? 1 : 0, register.assignmentsOf?.(person.id).length ?? 0]
  const [keep, drop] = [weight(pair.keep), weight(pair.drop)]
  const swap = drop[0] > keep[0] || (drop[0] === keep[0] && drop[1] > keep[1])
  return swap ? [pair.drop, pair.keep] : [pair.keep, pair.drop]
}

function Fold({ open, count, pairs, onToggle, s }: {
  open: boolean; count: number; pairs: readonly DuplicatePair[]; onToggle: () => void; s: Translate
}) {
  const bySign = DUPLICATE_SIGNS
    .map((sign) => ({ sign, count: pairs.filter((pair) => pair.sign === sign).length }))
    .filter((one) => one.count > 0)
  return (
    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', border: 1, borderColor: 'divider', borderRadius: 1, px: 1, py: 0.5 }}>
      <Button size="small" onClick={onToggle} aria-expanded={open} aria-controls="people-pairs" data-guide="people.duplicates"
        data-testid="people-duplicates-toggle" sx={{ ...QUIET, fontWeight: 600, color: 'text.primary' }}>
        <Box component="span" aria-hidden sx={{ width: 14, display: 'inline-block' }}>{open ? '▾' : '▸'}</Box>
        {s(count === 1 ? 'people.duplicatesOne' : 'people.duplicatesOther', { count })}
      </Button>
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }} data-testid="people-duplicates-signs">
        {bySign.map((one) => s('people.signCount', { count: one.count, sign: s(SIGN_LABEL[one.sign]) })).join(' · ')}
      </Typography>
      {!open && <Button size="small" onClick={onToggle} sx={QUIET} data-testid="people-duplicates-review">{s('people.review')}</Button>}
    </Box>
  )
}

/** One of the two: what tells them apart. */
function Side({ person, register, roles, s }: {
  person: Person; register: PeopleRegisterAccess; roles: ReadonlyMap<PersonId, RolesHeld> | undefined; s: Translate
}) {
  const muted = { fontSize: 12, color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } as const
  const tag = { height: 18, fontSize: 10, ml: 0.75 }
  const address = person.email ?? (register.withheld?.(person.id) ? s('people.emailWithheld') : s('people.noEmail'))
  return (
    <Box sx={{ minWidth: 0 }}>
      <Box sx={{ fontSize: 13, fontWeight: 600 }}>
        {shownText(shownEntry(person), s)}
        {person.kind === 'external' && <Chip size="small" variant="outlined" label={s('people.kindExternal')} sx={tag} />}
        {register.linked?.(person.id) && <Chip size="small" variant="outlined" label={s('people.account')} sx={tag} data-testid="people-pair-account" />}
      </Box>
      {roles && <Box sx={muted}><RolesLine roles={roles.get(person.id) ?? []} s={s} /></Box>}
      <Box sx={muted}>{address}</Box>
    </Box>
  )
}

function Pair({ pair, register, saying, roles, onMerge, s }: Omit<DuplicatesProps, 'pairs'> & { pair: DuplicatePair }) {
  const [keep, drop] = keptFirst(pair, register)
  const merging = mayMerge(register, keep.id, drop.id)
  const answering = mayAnswer(register, keep.id, drop.id)
  const name = (person: Person) => shownText(shownEntry(person), s)
  const answer = () => {
    void saying.run(register.answerDistinct!(keep.id, drop.id), () => s('people.notSameDone', { one: name(keep), other: name(drop) }))
  }
  return (
    <Box component="li" data-guide="people.duplicatePair" data-testid={`people-pair-${keep.id}-${drop.id}`} sx={{
      display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr) auto', gap: 1.5, alignItems: 'center',
      py: 0.75, borderBottom: 1, borderColor: 'divider',
    }}>
      <Side person={keep} register={register} roles={roles} s={s} />
      <Chip size="small" variant="outlined" label={s(SIGN_LABEL[pair.sign])} sx={{ height: 20, fontSize: 11 }} />
      <Side person={drop} register={register} roles={roles} s={s} />
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
        {merging && (
          <Button size="small" sx={QUIET} onClick={() => onMerge(keep, drop)} data-testid="people-pair-merge"
            aria-label={s('people.mergePair', { one: name(keep), other: name(drop) })}>
            {s('people.mergeAsk')}
          </Button>
        )}
        {answering && (
          <Button size="small" sx={QUIET} onClick={answer} data-testid="people-pair-not-same"
            aria-label={s('people.notSamePair', { one: name(keep), other: name(drop) })}>
            {s('people.notSame')}
          </Button>
        )}
      </Box>
    </Box>
  )
}

/** The pairs answered as not the same person, each with *Take back*, under the list. */
function Answered({ answered, register, saying, s }: {
  answered: readonly DistinctPair[]; register: PeopleRegisterAccess; saying: Saying; s: Translate
}) {
  const [open, setOpen] = useState(false)
  const held = registerOf(register.people ?? [])
  const named = (id: PersonId) => {
    const person = resolvePerson(id, held)
    return person ? shownText(shownEntry(person), s) : s('people.formerUnknown')
  }
  const takeBack = (pair: DistinctPair) => {
    const words = { one: named(pair.a), other: named(pair.b) }
    void saying.run(register.takeBackDistinct!(pair.a, pair.b), () => s('people.takenBack', words))
  }
  return (
    <Box data-testid="people-answered" sx={{ mt: 1 }}>
      <Button size="small" onClick={() => setOpen((was) => !was)} aria-expanded={open} aria-controls="people-answered-list"
        data-guide="people.answered" data-testid="people-answered-toggle" sx={{ ...QUIET, color: 'text.secondary' }}>
        <Box component="span" aria-hidden sx={{ width: 14, display: 'inline-block' }}>{open ? '▾' : '▸'}</Box>
        {s(answered.length === 1 ? 'people.answeredOne' : 'people.answeredOther', { count: answered.length })}
      </Button>
      {open && (
        <Box component="ul" id="people-answered-list" sx={{ listStyle: 'none', m: 0, p: 0, pl: 2 }}>
          {answered.map((pair) => (
            <Box component="li" key={`${pair.a} ${pair.b}`} data-testid={`people-answered-${pair.a}-${pair.b}`}
              sx={{ display: 'flex', gap: 1.5, alignItems: 'center', fontSize: 12, py: 0.25 }}>
              <span>{s('people.answeredPair', { one: named(pair.a), other: named(pair.b) })}</span>
              <Box component="span" sx={{ color: 'text.secondary' }}>{s('people.answeredOn', { day: pair.on })}</Box>
              <Button size="small" sx={QUIET} onClick={() => takeBack(pair)} data-testid="people-take-back"
                aria-label={s('people.takeBackPair', { one: named(pair.a), other: named(pair.b) })}>
                {s('people.takeBack')}
              </Button>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  )
}

/**
 * The fold, its pairs and the answers given — each offered only to whoever
 * may act on it; nothing at all where nobody here may.
 */
export function Duplicates({ pairs, register, saying, roles, onMerge, s }: DuplicatesProps) {
  const [open, setOpen] = useState(false)
  const offered = pairs.filter((pair) => mayMerge(register, pair.keep.id, pair.drop.id) || mayAnswer(register, pair.keep.id, pair.drop.id))
  const answered = (register.distinct ?? []).filter((pair) => mayAnswer(register, pair.a, pair.b))
  if (offered.length === 0 && answered.length === 0) return null
  return (
    <Box data-testid="people-duplicates" component="section" aria-label={s('people.duplicates')} sx={{ mb: 2 }}>
      {offered.length > 0 && <Fold open={open} count={offered.length} pairs={offered} onToggle={() => setOpen((was) => !was)} s={s} />}
      {open && offered.length > 0 && (
        <Box component="ul" id="people-pairs" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {offered.map((pair) => (
            <Pair key={`${pair.keep.id}|${pair.drop.id}`} pair={pair} register={register} saying={saying} roles={roles} onMerge={onMerge} s={s} />
          ))}
        </Box>
      )}
      {answered.length > 0 && <Answered answered={answered} register={register} saying={saying} s={s} />}
    </Box>
  )
}

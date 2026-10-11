// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One person on the People page (ADR-0036 §8–§11): who they are to the
 * register, where they are in leaving, what they hold, *What we hold*, and
 * what may be done — correct, mark as left, forget, remove, merge, and *This
 * is me*. Forgetting, removing and merging ask first, on the page; this panel
 * says what is asked.
 *
 * What a person holds — on the day, later, before — is read off their
 * assignments across the tree, under their id and every id merged into it.
 * The day is today, or the day the page is looked at (ADR-0027): a look the
 * window holds, which writes nothing.
 */
import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { heldLine, heldOn, holdText, keptName, pointerLine, ruleLine, whatWeHold } from '../hold'
import type { HeldAssignment, Mention, OwnedByRule, PointedAt, PointsAt } from '../hold'
import type { StringKey } from '../../i18n/table'
import type { Person, PersonKind, PolicyHold } from '../person'
import { entriesOf, PERSON_KINDS } from '../person'
import { meIdIn } from '../me'
import { forgetDay, removeDay } from '../policy'
import type { PeoplePolicy } from '../policy'
import { shownEntry, shownText } from '../shown'
import type { Translate } from '../shown'
import { mayDo } from './access'
import type { PeopleRegisterAccess, Saying } from './access'
import { KIND_LABEL, Section } from './parts'

export type PersonPanelProps = {
  person: Person
  register: PeopleRegisterAccess
  saying: Saying
  /** Ask, on the page, before the final three. */
  onForget: (person: Person) => void
  onRemove: (person: Person) => void
  onMerge: (from: Person, into: Person) => void
  copyText?: (text: string) => void
  /** The day the page is looked at, and moving it; absent, today and no control. */
  look?: PeopleLook | undefined
  s: Translate
}

/** The day the People page is looked at (ADR-0027): `day` absent is today. Nothing is written by looking. */
export type PeopleLook = { day?: string; onDay: (day: string | undefined) => void }

function StateLine({ person, policy, today, held, s }: {
  person: Person; policy: PeoplePolicy; today: string; held: PolicyHold | undefined; s: Translate
}) {
  if (person.state === 'active') return <Chip size="small" color="success" variant="outlined" label={s('people.stateActive')} />
  if (person.state === 'left') {
    const forget = forgetDay(person, policy) ?? ''
    return (
      <>
        <Chip size="small" color="warning" variant="outlined" label={s('people.stateLeft', { day: person.leftOn ?? '' })} />
        <Typography sx={{ fontSize: 12, mt: 0.75 }}>{s('people.leftOn', { day: person.leftOn ?? '', forget })}</Typography>
        {held === 'signedInSinceLeaving'
          ? <Typography sx={{ fontSize: 12, fontWeight: 600 }} data-testid="people-held-back">{s('people.heldSignedIn')}</Typography>
          : forget && forget <= today && <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{s('people.leftDue')}</Typography>}
      </>
    )
  }
  return (
    <>
      <Chip size="small" variant="outlined" label={s('people.stateForgotten', { day: person.forgottenOn ?? '' })} />
      <Typography sx={{ fontSize: 12, mt: 0.75 }}>
        {s('people.forgottenOn', { day: person.forgottenOn ?? '', remove: removeDay(person, policy) ?? '' })}
      </Typography>
    </>
  )
}

/** The correction: a name, an address, a kind. */
function Correcting({ person, register, saying, onDone, s }: {
  person: Person; register: PeopleRegisterAccess; saying: Saying; onDone: () => void; s: Translate
}) {
  const [name, setName] = useState(person.name ?? '')
  const [email, setEmail] = useState(person.email ?? '')
  const [kind, setKind] = useState<PersonKind>(person.kind)
  const save = () => {
    void saying.run(register.change(person.id, { name, email: email.trim() ? email : null, kind }), () => s('people.saved'))
      .then((done) => { if (done) onDone() })
  }
  return (
    <Box sx={{ display: 'grid', gap: 1, mt: 1 }}>
      <TextField size="small" label={s('people.name')} value={name} onChange={(event) => setName(event.target.value)} />
      <TextField size="small" label={s('people.email')} value={email} onChange={(event) => setEmail(event.target.value)} />
      <TextField size="small" select label={s('people.kind')} value={kind} onChange={(event) => setKind(event.target.value as PersonKind)}>
        {PERSON_KINDS.map((one) => <MenuItem key={one} value={one}>{s(KIND_LABEL[one])}</MenuItem>)}
      </TextField>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button size="small" variant="contained" onClick={save}>{s('people.save')}</Button>
        <Button size="small" onClick={onDone}>{s('people.cancel')}</Button>
      </Box>
    </Box>
  )
}

/**
 * What points at a person across the tree (ADR-0036 §8), read when the panel
 * opens on them and again when the register changes: the records whose
 * fields hold their id, the signatures that kept their name, and what the
 * rules make them own today. Nothing where the shell has no tree to read.
 */
function usePointsAt(person: Person, register: PeopleRegisterAccess): PointsAt | undefined {
  const [found, setFound] = useState<PointsAt | undefined>(undefined)
  const { pointsAt, people } = register
  useEffect(() => {
    let stale = false
    setFound(undefined)
    if (pointsAt) void pointsAt(person.id).then((held) => { if (!stale) setFound(held) }, () => { if (!stale) setFound({ pointers: [], byRule: [] }) })
    return () => { stale = true }
  }, [pointsAt, person.id, people])
  return found
}

const POINTED: Record<PointedAt['field'], StringKey> = {
  owner: 'people.pointedOwnerOf',
  seenBy: 'people.pointedSeenBy',
  runBy: 'people.pointedRunBy',
  proposed: 'people.pointedProposed',
  signer: 'people.pointedSigner',
}

/**
 * One record that points at the person, in words: which record, which field,
 * and where it is kept. On a forgotten entry a signature that kept a name is
 * said to exist and no more: the name as signed beside the pseudonym would
 * undo the forgetting (ADR-0036 §8).
 */
function pointedText(one: PointedAt, apart: boolean, s: Translate): string {
  if (keptName(one) && apart) {
    return s(one.field === 'proposed' ? 'people.pointedProposedApart' : 'people.pointedSignedApart', { label: one.label ?? '', name: one.title })
  }
  if (keptName(one)) return s('people.pointedSigned', { label: one.label ?? '', name: one.title, as: one.signedAs ?? '' })
  if (one.kind === 'plan') return s('people.pointedPlanOwner', { label: one.label ?? '', name: one.title })
  return s(POINTED[one.field], { label: one.label ?? '', name: one.title })
}

/** What a rule makes the person own, in words. */
function ruleText(one: OwnedByRule, s: Translate): string {
  return s(one.kind === 'domain' ? 'people.pointedDomainByRule' : 'people.pointedByRule', { name: one.name, day: one.day })
}

/**
 * *Points at them*: every record that names the person by id, the signatures
 * that kept their name — on a forgotten entry, only that each exists — and
 * what the rules work out.
 */
function PointsAtThem({ found, apart, s }: { found: PointsAt | undefined; apart: boolean; s: Translate }) {
  if (!found) return null
  const { pointers, byRule } = found
  const muted = (text: string) => <Box component="span" sx={{ color: 'text.secondary' }}> · {text}</Box>
  return (
    <Section title={s('people.pointsAt')}>
      <Box data-testid="people-points-at" sx={{ display: 'grid', gap: 0.25 }}>
        {byRule.map((one) => (
          <Typography key={`rule:${one.kind}:${one.scope}:${one.id}`} sx={{ fontSize: 13 }} data-testid="people-pointed-rule">
            {ruleText(one, s)}{muted(s('people.pointedRuleNote'))}
          </Typography>
        ))}
        {pointers.map((one, at) => (
          <Typography key={`${one.scope}/${one.kind}/${one.id}/${one.field}/${at}`} sx={{ fontSize: 13 }} data-testid={keptName(one) ? 'people-pointed-signed' : 'people-pointed'}>
            {pointedText(one, apart, s)}
            {muted(keptName(one) && !apart ? s('people.pointedSignedNote') : s('people.pointedWhere', { scope: one.scope || s('common.organisation') }))}
          </Typography>
        ))}
        {pointers.length === 0 && byRule.length === 0 && (
          <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{s('people.pointsAtNothing')}</Typography>
        )}
        {pointers.length + byRule.length > 0 && (
          <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.5 }}>{s(apart ? 'people.pointsAtApartNote' : 'people.pointsAtNote')}</Typography>
        )}
      </Box>
    </Section>
  )
}

/** *What we hold*: the account a request for access is answered with. */
function Holding({ person, register, found, copyText, s }: {
  person: Person; register: PeopleRegisterAccess; found: PointsAt | undefined; copyText?: (text: string) => void; s: Translate
}) {
  const [mentions, setMentions] = useState<Mention[] | undefined>(undefined)
  const { mentionsOf } = register
  // A search across the tree for the name: what a forget cannot reach, said honestly (ADR-0036 §10).
  useEffect(() => {
    if (person.name) void mentionsOf(person.name).then(setMentions, () => setMentions([]))
  }, [mentionsOf, person.name])
  const assignments = (register.assignmentsOf?.(person.id) ?? []).map(heldLine)
  const held = whatWeHold(person, register.people ?? [], {
    thisIsMe: meIdIn(register.me, register.people) === person.id, assignments, ...(mentions ? { mentions } : {}),
    ...(found ? {
      namedIn: found.pointers.filter((one) => !keptName(one)).map((one) => pointerLine(one)),
      // On a forgotten entry, only that each signature exists: never the name it was signed with.
      signed: found.pointers.filter(keptName).map((one) => pointerLine(one, person.state === 'forgotten')),
      derived: found.byRule.map(ruleLine),
    } : {}),
  })
  const text = holdText(held)
  return (
    <Box sx={{ mt: 1 }}>
      <Typography sx={{ fontSize: 12, color: 'text.secondary', mb: 0.5 }}>{s('people.holdNote')}</Typography>
      {person.name && mentions && (
        <Typography sx={{ fontSize: 12, mb: 0.5 }}>{s('people.mentionsNote', { count: mentions.length })}</Typography>
      )}
      <Box component="pre" data-testid="people-hold" tabIndex={0} sx={{ fontSize: 11, p: 1, bgcolor: 'action.hover', borderRadius: 1, overflowX: 'auto', maxHeight: 280 }}>
        {text}
      </Box>
      {copyText && <Button size="small" onClick={() => copyText(text)}>{s('people.holdCopy')}</Button>}
    </Box>
  )
}

/** The changes the panel's *What may be done* offers this person for this entry, by its state and by who may make them. */
function doable(person: Person, register: PeopleRegisterAccess) {
  return {
    leave: person.state === 'active' && mayDo(register, 'leave', person.id),
    merge: person.state !== 'forgotten' && mayDo(register, 'merge', person.id),
    forget: person.state !== 'forgotten' && mayDo(register, 'forget', person.id),
    remove: person.state === 'forgotten' && mayDo(register, 'remove', person.id),
  }
}

/** What may be done, by state and by who may do it: leave, forget, remove, merge. */
function Doing({ person, register, saying, onForget, onRemove, onMerge, s }: Omit<PersonPanelProps, 'copyText'>) {
  const can = doable(person, register)
  const [lastDay, setLastDay] = useState(register.today)
  const others = entriesOf(register.people ?? []).filter((one) => one.id !== person.id && one.state !== 'forgotten')
  const [into, setInto] = useState('')
  const named = (one: Person) => shownText(shownEntry(one), s)
  const leave = () => {
    void saying.run(register.leave(person.id, lastDay), (left) => s('people.leftDone', {
      name: named(left.person), day: lastDay, forget: forgetDay(left.person, register.policy) ?? '',
    }))
  }
  const target = others.find((one) => one.id === into)
  return (
    <Box sx={{ display: 'grid', gap: 1 }}>
      {can.leave && (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField size="small" type="date" label={s('people.lastDay')} value={lastDay} onChange={(event) => setLastDay(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <Button size="small" variant="outlined" onClick={leave} data-testid="people-leave">{s('people.markLeft')}</Button>
        </Box>
      )}
      {can.merge && (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField size="small" select label={s('people.mergeKeep')} value={into} onChange={(event) => setInto(event.target.value)} sx={{ minWidth: 180 }}>
            {others.map((one) => <MenuItem key={one.id} value={one.id}>{named(one)}</MenuItem>)}
          </TextField>
          <Button size="small" variant="outlined" disabled={!target} onClick={() => { if (target) onMerge(person, target) }} data-testid="people-merge-with">
            {s('people.mergeWith')}
          </Button>
        </Box>
      )}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {can.forget && (
          <Button size="small" color="error" variant="outlined" onClick={() => onForget(person)} data-testid="people-forget">{s('people.forget')}</Button>
        )}
        {can.remove && (
          <Button size="small" color="error" variant="outlined" onClick={() => onRemove(person)} data-testid="people-remove">{s('people.remove')}</Button>
        )}
      </Box>
      {(can.forget || can.remove) && <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{s('people.forgetNote')}</Typography>}
    </Box>
  )
}

/** One assignment, as a line: the role in the unit, and what is said of it. */
function HeldItem({ one, s }: { one: HeldAssignment; s: Translate }) {
  const said = [
    one.share !== undefined && one.share < 1 ? `${Math.round(one.share * 100)}%` : undefined,
    one.acting ? s('people.heldActing') : undefined,
    one.from ? s('people.heldFrom', { day: one.from }) : undefined,
    one.until ? s('people.heldUntil', { day: one.until }) : undefined,
  ].filter(Boolean)
  return (
    <Typography sx={{ fontSize: 13 }} data-testid="people-held">
      {s('people.heldIn', { role: one.role, unit: one.unit })}
      {said.length > 0 && <Box component="span" sx={{ color: 'text.secondary' }}> · {said.join(' · ')}</Box>}
    </Typography>
  )
}

/**
 * What a person holds on the day, will hold and held before (ADR-0036 §4):
 * the day's always, the other two where there are any. The day is today, or
 * the one the page is looked at.
 */
function Holds({ held, today, look, s }: { held: readonly HeldAssignment[]; today: string; look: PeopleLook | undefined; s: Translate }) {
  const day = look?.day ?? today
  const { now, later, before } = heldOn(held, day)
  return (
    <>
      {look && (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 1.5 }}>
          <TextField size="small" type="date" label={s('people.lookAt')} value={day} sx={{ width: 170 }}
            onChange={(event) => look.onDay(event.target.value && event.target.value !== today ? event.target.value : undefined)}
            slotProps={{ inputLabel: { shrink: true }, htmlInput: { 'data-testid': 'people-look' } }} />
          {day !== today && <Button size="small" onClick={() => look.onDay(undefined)} data-testid="people-look-today">{s('people.lookToday')}</Button>}
        </Box>
      )}
      <Section title={day === today ? s('people.holdsToday') : s('people.holdsOn', { day })}>
        {now.length
          ? now.map((one) => <HeldItem key={`${one.scope}/${one.id}`} one={one} s={s} />)
          : <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{s('people.holdsNothing')}</Typography>}
      </Section>
      {later.length > 0 && (
        <Section title={s('people.willHold')}>{later.map((one) => <HeldItem key={`${one.scope}/${one.id}`} one={one} s={s} />)}</Section>
      )}
      {before.length > 0 && (
        <Section title={s('people.heldBefore')}>{before.map((one) => <HeldItem key={`${one.scope}/${one.id}`} one={one} s={s} />)}</Section>
      )}
    </>
  )
}

export function PersonPanel(props: PersonPanelProps) {
  const { person, register, saying, copyText, s } = props
  const [correcting, setCorrecting] = useState(false)
  const [holding, setHolding] = useState(false)
  const named = person.state !== 'forgotten'
  // *You* through a merge: the entry kept is who *This is me* said, under whichever of its ids.
  const isMe = meIdIn(register.me, register.people) === person.id
  const found = usePointsAt(person, register)
  const setMe = (id: string | undefined) => {
    void saying.run(register.setMe(id).then(() => ({})), () => s(id ? 'people.thisIsYou' : 'people.saved'))
  }
  return (
    <Box data-testid="people-person">
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>
        {s(KIND_LABEL[person.kind])} · <Box component="code">{person.id}</Box>
      </Typography>
      <Typography component="h2" sx={{ fontSize: 18, fontWeight: 700, my: 0.5 }} data-testid="people-person-name">
        {shownText(shownEntry(person), s)}
      </Typography>
      <StateLine person={person} policy={register.policy} today={register.today} held={register.held?.(person.id)} s={s} />
      {named && (
        <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.75 }} data-testid="people-person-email">
          {person.email ?? s(register.withheld?.(person.id) ? 'people.emailWithheld' : 'people.noEmail')}
        </Typography>
      )}
      {isMe && <Typography sx={{ fontSize: 12, mt: 0.75 }} data-testid="people-this-is-you">{s('people.thisIsYou')}</Typography>}
      {named && !register.readOnly && (
        <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
          {!register.meSaid && (
            <Button size="small" onClick={() => setMe(isMe ? undefined : person.id)} data-testid="people-me">
              {s(isMe ? 'people.notMe' : 'people.thisIsMe')}
            </Button>
          )}
          {!correcting && mayDo(register, 'change', person.id) && (
            <Button size="small" onClick={() => setCorrecting(true)} data-testid="people-correct">{s('people.correct')}</Button>
          )}
        </Box>
      )}
      {correcting && <Correcting person={person} register={register} saying={saying} onDone={() => setCorrecting(false)} s={s} />}

      <Holds held={register.assignmentsOf?.(person.id) ?? []} today={register.today} look={props.look} s={s} />
      <PointsAtThem found={found} apart={!named} s={s} />

      {Object.values(doable(person, register)).some(Boolean) && (
        <Section title={s('people.do')}>
          <Doing {...props} />
        </Section>
      )}

      <Box sx={{ mt: 2 }}>
        <Button size="small" variant="outlined" onClick={() => setHolding((was) => !was)} data-testid="people-hold-toggle">
          {s(holding ? 'people.holdHide' : 'people.hold')}
        </Button>
        {holding && <Holding person={person} register={register} found={found} copyText={copyText} s={s} />}
      </Box>
    </Box>
  )
}

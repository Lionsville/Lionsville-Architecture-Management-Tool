// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One person on the People page (ADR-0036 §8–§11): who they are to the
 * register, where they are in leaving, what they hold, *What we hold*, and
 * what may be done — correct, mark as left, forget, remove, merge, and *This
 * is me*. Forgetting, removing and merging ask first, on the page; this panel
 * says what is asked.
 *
 * What a person holds — today, later, before — is read off their
 * assignments across the tree, under their id and every id merged into it.
 */
import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { heldLine, heldOn, holdText, whatWeHold } from '../hold'
import type { HeldAssignment, Mention } from '../hold'
import type { Person, PersonKind } from '../person'
import { entriesOf, PERSON_KINDS } from '../person'
import { forgetDay, removeDay } from '../policy'
import type { PeoplePolicy } from '../policy'
import { shownEntry, shownText } from '../shown'
import type { Translate } from '../shown'
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
  s: Translate
}

function StateLine({ person, policy, today, s }: { person: Person; policy: PeoplePolicy; today: string; s: Translate }) {
  if (person.state === 'active') return <Chip size="small" color="success" variant="outlined" label={s('people.stateActive')} />
  if (person.state === 'left') {
    const forget = forgetDay(person, policy) ?? ''
    return (
      <>
        <Chip size="small" color="warning" variant="outlined" label={s('people.stateLeft', { day: person.leftOn ?? '' })} />
        <Typography sx={{ fontSize: 12, mt: 0.75 }}>{s('people.leftOn', { day: person.leftOn ?? '', forget })}</Typography>
        {forget && forget <= today && <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{s('people.leftDue')}</Typography>}
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

/** *What we hold*: the account a request for access is answered with. */
function Holding({ person, register, copyText, s }: { person: Person; register: PeopleRegisterAccess; copyText?: (text: string) => void; s: Translate }) {
  const [mentions, setMentions] = useState<Mention[] | undefined>(undefined)
  const { mentionsOf } = register
  // A search across the tree for the name: what a forget cannot reach, said honestly (ADR-0036 §10).
  useEffect(() => {
    if (person.name) void mentionsOf(person.name).then(setMentions, () => setMentions([]))
  }, [mentionsOf, person.name])
  const assignments = (register.assignmentsOf?.(person.id) ?? []).map(heldLine)
  const held = whatWeHold(person, register.people ?? [], {
    thisIsMe: register.me === person.id, assignments, ...(mentions ? { mentions } : {}),
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

/** What may be done, by state: leave, forget, remove, merge, and saying who you are. */
function Doing({ person, register, saying, onForget, onRemove, onMerge, s }: Omit<PersonPanelProps, 'copyText'>) {
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
      {person.state === 'active' && (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField size="small" type="date" label={s('people.lastDay')} value={lastDay} onChange={(event) => setLastDay(event.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
          <Button size="small" variant="outlined" onClick={leave} data-testid="people-leave">{s('people.markLeft')}</Button>
        </Box>
      )}
      {person.state !== 'forgotten' && (
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
        {person.state !== 'forgotten' && (
          <Button size="small" color="error" variant="outlined" onClick={() => onForget(person)} data-testid="people-forget">{s('people.forget')}</Button>
        )}
        {person.state === 'forgotten' && (
          <Button size="small" color="error" variant="outlined" onClick={() => onRemove(person)} data-testid="people-remove">{s('people.remove')}</Button>
        )}
      </Box>
      <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{s('people.forgetNote')}</Typography>
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

/** What a person holds today, will hold and held before (ADR-0036 §4): today's always, the other two where there are any. */
function Holds({ held, today, s }: { held: readonly HeldAssignment[]; today: string; s: Translate }) {
  const { now, later, before } = heldOn(held, today)
  return (
    <>
      <Section title={s('people.holdsToday')}>
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
  const isMe = register.me === person.id
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
      <StateLine person={person} policy={register.policy} today={register.today} s={s} />
      {named && <Typography sx={{ fontSize: 12, color: 'text.secondary', mt: 0.75 }}>{person.email ?? s('people.noEmail')}</Typography>}
      {isMe && <Typography sx={{ fontSize: 12, mt: 0.75 }} data-testid="people-this-is-you">{s('people.thisIsYou')}</Typography>}
      {named && !register.readOnly && (
        <Box sx={{ display: 'flex', gap: 1, mt: 1, flexWrap: 'wrap' }}>
          {!register.meSaid && (
            <Button size="small" onClick={() => setMe(isMe ? undefined : person.id)} data-testid="people-me">
              {s(isMe ? 'people.notMe' : 'people.thisIsMe')}
            </Button>
          )}
          {!correcting && <Button size="small" onClick={() => setCorrecting(true)}>{s('people.correct')}</Button>}
        </Box>
      )}
      {correcting && <Correcting person={person} register={register} saying={saying} onDone={() => setCorrecting(false)} s={s} />}

      <Holds held={register.assignmentsOf?.(person.id) ?? []} today={register.today} s={s} />

      {!register.readOnly && (
        <Section title={s('people.do')}>
          <Doing {...props} />
        </Section>
      )}

      <Box sx={{ mt: 2 }}>
        <Button size="small" variant="outlined" onClick={() => setHolding((was) => !was)} data-testid="people-hold-toggle">
          {s(holding ? 'people.holdHide' : 'people.hold')}
        </Button>
        {holding && <Holding person={person} register={register} copyText={copyText} s={s} />}
      </Box>
    </Box>
  )
}

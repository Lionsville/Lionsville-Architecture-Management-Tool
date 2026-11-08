// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One person on the People page (ADR-0036 §8–§11), at their own address and in
 * the large preview over the list: what they hold, who they report to and who
 * reports to them, what is named after them, and where they are in leaving.
 * People read this far more than they change it, so what changes it sits in one
 * *Correct…* and one ⋯ (`PersonActions`), each asking first where it has no undo.
 *
 * Every role leads to its unit on the chart, every person to their page, every
 * record to its reader. *Reports to* and *Manages* always answer, with how each
 * line comes about in words: nesting is most of a tree, and leaving it unsaid read
 * as nobody.
 *
 * What a person holds — on the day, later, before — is read off their assignments
 * across the tree, under their id and every id merged into it. The day is today,
 * or the day the page is looked at (ADR-0027): a look the window holds, which
 * writes nothing.
 */
import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { addDays } from '../../model/transition'
import { Button } from '../../widgets/kit/Button'
import { PropertyRow, PropertyRows } from '../../widgets/kit/Field'
import { PreviewFact } from '../../widgets/kit/Preview'
import type { PlaceTo } from '../../widgets/placeTab'
import { heldOn, keptName } from '../hold'
import type { HeldAssignment, OwnedByRule, PointedAt, PointsAt, ReportingPerson } from '../hold'
import type { StringKey } from '../../i18n/table'
import { meIdIn } from '../me'
import type { Person } from '../person'
import { forgetDay, removeDay } from '../policy'
import { registerOf, resolvePerson, shownEntry, shownText } from '../shown'
import type { Translate } from '../shown'
import type { PeopleRegisterAccess } from './access'
import { KIND_LABEL, PlaceLink, useDayWords } from './parts'

/** The day the People page is looked at (ADR-0027): `day` absent is today. Nothing is written by looking. */
export type PeopleLook = { day?: string; onDay: (day: string | undefined) => void }

type Go = ((to: PlaceTo) => void) | undefined

/** How many of a line of people show before the rest fold: holders have up to five managers. */
const NEAREST = 3

/**
 * What points at a person across the tree (ADR-0036 §8), read when the page
 * opens on them and again when the register changes: the records whose fields
 * hold their id, the signatures that kept their name, and what the rules make
 * them own today. Nothing where the shell has no tree to read.
 */
export function usePointsAt(id: string | undefined, register: Pick<PeopleRegisterAccess, 'pointsAt' | 'people'>): PointsAt | undefined {
  const [found, setFound] = useState<PointsAt | undefined>(undefined)
  const { pointsAt, people } = register
  useEffect(() => {
    let stale = false
    setFound(undefined)
    if (pointsAt && id !== undefined) void pointsAt(id).then((held) => { if (!stale) setFound(held) }, () => { if (!stale) setFound({ pointers: [], byRule: [] }) })
    return () => { stale = true }
  }, [pointsAt, id, people])
  return found
}

const POINTED: Record<PointedAt['field'], StringKey> = {
  owner: 'people.pointedOwnerOf',
  seenBy: 'people.pointedSeenBy',
  recordedBy: 'people.pointedRecordedBy',
  runBy: 'people.pointedRunBy',
  proposed: 'people.pointedProposed',
  signer: 'people.pointedSigner',
}

/**
 * One record that points at the person, in words: which record, which field.
 * On a forgotten entry a signature that kept a name is said to exist and no
 * more: the name as signed beside the pseudonym would undo the forgetting
 * (ADR-0036 §8).
 */
export function pointedText(one: PointedAt, apart: boolean, s: Translate): string {
  if (keptName(one) && apart) {
    return s(one.field === 'proposed' ? 'people.pointedProposedApart' : 'people.pointedSignedApart', { label: one.label ?? '', name: one.title })
  }
  if (keptName(one)) return s('people.pointedSigned', { label: one.label ?? '', name: one.title, as: one.signedAs ?? '' })
  if (one.kind === 'plan') return s('people.pointedPlanOwner', { label: one.label ?? '', name: one.title })
  return s(POINTED[one.field], { label: one.label ?? '', name: one.title })
}

/** What a rule makes the person own, in words. */
export function ruleText(one: OwnedByRule, s: Translate, day: (day: string) => string): string {
  return s(one.kind === 'domain' ? 'people.pointedDomainByRule' : 'people.pointedByRule', { name: one.name, day: day(one.day) })
}

const RECORD_PAGE: Record<PointedAt['kind'], string> = { element: 'element', plan: 'plan', observation: 'observations', experiment: 'observations', decision: 'decisions' }

/** Where a role goes: its unit, on the chart of the scope that keeps it. */
function toUnit(go: Go, scope: string | undefined, unitId: string | undefined) {
  return go && scope !== undefined && unitId !== undefined ? () => go({ scope, page: 'chart', select: unitId }) : undefined
}

/** A list that shows its nearest and folds the rest, with the rest counted on the press. */
function Nearest({ lines, testId, s }: { lines: readonly ReactNode[]; testId: string; s: Translate }) {
  const [all, setAll] = useState(false)
  const shown = all ? lines : lines.slice(0, NEAREST)
  return (
    <div className="people-lines" data-testid={testId}>
      {shown.map((line, at) => <span key={at} className="people-line">{line}</span>)}
      {lines.length > NEAREST && !all && (
        <div><Button size="small" variant="quiet" onClick={() => setAll(true)}>{s('people.andMore', { count: lines.length - NEAREST })}</Button></div>
      )}
    </div>
  )
}

/** One role held, in words: the role in the unit, which leads to it, and what is said of it. */
function HeldItem({ one, go, s }: { one: HeldAssignment; go: Go; s: Translate }) {
  const dayWords = useDayWords()
  const said = [
    one.share !== undefined && one.share < 1 ? `${Math.round(one.share * 100)}%` : undefined,
    one.acting ? s('people.heldActing') : undefined,
    one.from ? s('people.heldFrom', { day: dayWords(one.from) }) : undefined,
    one.until ? s('people.heldUntil', { day: dayWords(one.until) }) : undefined,
  ].filter(Boolean)
  return (
    <span data-testid="people-held">
      <PlaceLink onPress={toUnit(go, one.scope, one.unitId)}>{s('people.heldIn', { role: one.role, unit: one.unit })}</PlaceLink>
      {said.length > 0 && <span className="people-quiet"> · {said.join(' · ')}</span>}
      {one.exception && <span className="people-quiet people-line" data-testid="people-held-exception">{s('people.heldException')}</span>}
    </span>
  )
}

const VIA: Record<ReportingPerson['via'], StringKey> = { nesting: 'people.viaNesting', line: 'people.viaLine', override: 'people.viaOverride' }

/** One person at the other end of a line, nearest first, with how the line comes about. */
function ReportingLine({ line, people, onPerson, go, s }: { line: ReportingPerson; people: readonly Person[]; onPerson: (id: string) => void; go: Go; s: Translate }) {
  const how = [line.functional ? s('people.viaFunctional') : undefined, s(VIA[line.via])].filter(Boolean).join(', ')
  return (
    <span data-testid="people-reporting-line">
      <PlaceLink onPress={() => onPerson(line.person)}>{nameOf(line.person, people, s)}</PlaceLink>
      {', '}
      <PlaceLink onPress={toUnit(go, line.scope, line.unitId)}>{s('people.heldIn', { role: line.role, unit: line.unit })}</PlaceLink>
      <span className="people-quiet"> · {how}</span>
    </span>
  )
}

function NamedOn({ found, apart, go, s }: { found: PointsAt; apart: boolean; go: Go; s: Translate }) {
  const dayWords = useDayWords()
  const { pointers, byRule } = found
  const toRecord = (one: PointedAt) => (go ? () => go({ scope: one.scope, page: RECORD_PAGE[one.kind], id: one.id }) : undefined)
  const toRule = (one: OwnedByRule) => (go ? () => go(one.kind === 'domain' ? { scope: one.scope, page: 'home' } : { scope: one.scope, page: 'element', id: one.id }) : undefined)
  const where = (one: PointedAt) => s('people.pointedWhere', { scope: one.scope || s('common.organisation') })
  const lines = [
    ...byRule.map((one) => (
      <span key={`rule:${one.kind}:${one.scope}:${one.id}`} data-testid="people-pointed-rule">
        <PlaceLink onPress={toRule(one)}>{ruleText(one, s, dayWords)}</PlaceLink>
        <span className="people-quiet"> · {s('people.pointedRuleNote')}</span>
      </span>
    )),
    ...pointers.map((one, at) => (
      <span key={`${one.scope}/${one.kind}/${one.id}/${one.field}/${at}`} data-testid={keptName(one) ? 'people-pointed-signed' : 'people-pointed'}>
        <PlaceLink onPress={toRecord(one)}>{pointedText(one, apart, s)}</PlaceLink>
        <span className="people-quiet"> · {keptName(one) && !apart ? s('people.pointedSignedNote') : where(one)}</span>
      </span>
    )),
  ]
  return (
    <div className="people-lines">
      {lines}
      <span className="people-quiet">{s(apart ? 'people.pointsAtApartNote' : 'people.pointsAtNote')}</span>
    </div>
  )
}

/** Where somebody is in leaving, in plain dates, and what holds it back. */
export function LeavingSteps({ person, register, onForget, onTakeBack, s }: {
  person: Person; register: PeopleRegisterAccess; onForget?: () => void
  /** *Take back leaving…*, beside the day they left, where it is found by whoever is reading that day. */
  onTakeBack?: () => void
  s: Translate
}) {
  const dayWords = useDayWords()
  if (person.state === 'active') return null
  const forget = person.state === 'forgotten' ? person.forgottenOn : forgetDay(person, register.policy)
  const remove = person.state === 'forgotten' ? removeDay(person, register.policy) : forget ? addDays(forget, register.policy.removeAfterDays) : undefined
  const held = register.held?.(person.id)
  const due = person.state === 'left' && forget !== undefined && forget <= register.today
  return (
    <>
      <ol className="people-steps" data-testid="people-steps">
        <li className="people-steps__step" data-done="">
          <span className="people-steps__label">{s('people.stepLeft')}</span>{dayWords(person.leftOn)}
          {person.state === 'left' && onTakeBack && <> · <Button size="small" variant="quiet" onClick={onTakeBack} data-testid="people-take-back-here">{s('people.takeBackLeavingAsk')}</Button></>}
        </li>
        <li className="people-steps__step" data-done={person.state === 'forgotten' || undefined}><span className="people-steps__label">{s('people.stepForgotten')}</span>{dayWords(forget)}</li>
        <li className="people-steps__step"><span className="people-steps__label">{s('people.stepRemoved')}</span>{dayWords(remove)}</li>
      </ol>
      {person.state === 'forgotten' && <p className="people-note">{s('people.forgottenNote', { remove: dayWords(remove) })}</p>}
      {held === 'signedInSinceLeaving' && (
        <p className="people-actions" data-testid="people-held-back">
          <strong>{s('people.heldSignedIn')}</strong>
          {onForget && <Button size="small" onClick={onForget}>{s('people.forgetAsk')}</Button>}
        </p>
      )}
      {held !== 'signedInSinceLeaving' && due && <p className="people-actions"><strong>{s('people.leftDue')}</strong></p>}
    </>
  )
}

/** The facts beside the rows: who they are to the register. External is said only where true. */
export function PersonFacts({ person, register, s }: { person: Person; register: PeopleRegisterAccess; s: Translate }) {
  const isMe = meIdIn(register.me, register.people) === person.id
  return (
    <>
      {person.state !== 'forgotten' && (
        <PreviewFact label={s('people.colEmail')}>
          <span data-testid="people-person-email">{person.email ?? s(register.withheld?.(person.id) ? 'people.emailWithheld' : 'people.noEmail')}</span>
        </PreviewFact>
      )}
      {person.kind === 'external' && <PreviewFact label={s('people.kind')}>{s(KIND_LABEL.external)}</PreviewFact>}
      {isMe && <PreviewFact label={s('people.you')}><span data-testid="people-this-is-you">{s('people.thisIsYou')}</span></PreviewFact>}
    </>
  )
}

export function PersonReader({ person, register, day, go, onPerson, onForget, onTakeBack, s }: {
  person: Person
  register: PeopleRegisterAccess
  /** The day read: today, or the one looked at. */
  day: string
  go: Go
  onPerson: (id: string) => void
  /** *Forget now…* beside what holds a forgetting back, where this person may. */
  onForget?: () => void
  /** *Take back leaving…* beside the day they left, where this person may. */
  onTakeBack?: () => void
  s: Translate
}) {
  const dayWords = useDayWords()
  const [folded, setFolded] = useState(true)
  const held = register.assignmentsOf?.(person.id) ?? []
  const { now, later, before } = heldOn(held, day)
  const found = usePointsAt(person.id, register)
  const { reportingOf } = register
  const lines = useMemo(() => reportingOf?.(person.id, day), [reportingOf, person.id, day])
  const onToday = day === register.today
  const others = later.length + before.length
  const roleItems = (list: readonly HeldAssignment[]) => list.map((one) => <span key={`${one.scope}/${one.id}`} className="people-line"><HeldItem one={one} go={go} s={s} /></span>)
  const lineItems = (list: readonly ReportingPerson[]) => list.map((line) => <ReportingLine line={line} people={register.people ?? []} onPerson={onPerson} go={go} s={s} />)
  return (
    <div data-testid="people-person">
      <LeavingSteps person={person} register={register} {...(onForget ? { onForget } : {})} {...(onTakeBack ? { onTakeBack } : {})} s={s} />
      <PropertyRows readOnly>
        <PropertyRow
          label={onToday ? s('people.holdsToday') : s('people.holdsOn', { day: dayWords(day) })}
          display={now.length ? <div className="people-lines">{roleItems(now)}</div> : undefined}
          empty={s('people.holdsNothing')}
        />
        {lines && (
          <PropertyRow
            label={s('people.reportsTo')}
            display={lines.reportsTo.length ? <Nearest testId="people-reports-to" lines={lineItems(lines.reportsTo)} s={s} /> : undefined}
            empty={s(now.length ? 'people.reportsToNobody' : 'people.reportsToNothing')}
          />
        )}
        {lines && (
          <PropertyRow
            label={s('people.manages')}
            display={lines.manages.length ? <Nearest testId="people-manages" lines={lineItems(lines.manages)} s={s} /> : undefined}
            empty={s('people.managesNobody')}
          />
        )}
        {/* Nothing is said as every other row says it, in the row's own quiet words, not a smaller line of its own. */}
        {found && (
          <PropertyRow
            label={s('people.pointsAt')} data-testid="people-points-at" empty={s('people.pointsAtNothing')}
            display={found.pointers.length + found.byRule.length > 0 ? <NamedOn found={found} apart={person.state === 'forgotten'} go={go} s={s} /> : undefined}
          />
        )}
        <PropertyRow
          label={s('people.beforeAndLater')}
          display={others === 0 ? undefined : (
            <div className="people-lines">
              <div>
                <Button size="small" variant="quiet" onClick={() => setFolded((was) => !was)} aria-expanded={!folded} data-testid="people-others">
                  {s('people.beforeAndLaterCount', { before: before.length, later: later.length })}
                </Button>
              </div>
              {!folded && later.length > 0 && <><span className="people-quiet">{s('people.willHold')}</span>{roleItems(later)}</>}
              {!folded && before.length > 0 && <><span className="people-quiet">{s('people.heldBefore')}</span>{roleItems(before)}</>}
            </div>
          )}
          empty={s('people.nothingElse')}
        />
      </PropertyRows>
    </div>
  )
}

/** A person's name as a person reads it, from the register as read: an id nobody holds any more is a former colleague. */
export function nameOf(id: string, people: readonly Person[], s: Translate): string {
  const person = resolvePerson(id, registerOf(people))
  return person ? shownText(shownEntry(person), s) : s('people.formerUnknown')
}

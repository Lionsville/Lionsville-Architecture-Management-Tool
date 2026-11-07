// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The panel beside the Conway map: the one place on the page that changes
 * anything, and each thing it changes one step. With nothing chosen it says
 * what to look at, grouped by check as every list of findings is, and where the
 * map cannot answer yet it asks for owners instead. On a pair it says how the
 * two stand and offers the answers as buttons, or names what holds them; on a
 * unit and on an application, what the map knows of it.
 *
 * Why it matters is one line here. The full text of a check stays on the Checks
 * page, and the formal names stay in the catalogue, the manual and for an agent.
 */
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useStrings } from '../../i18n'
import type { StringKey, Translate } from '../../i18n'
import { formatDay } from '../../i18n/dates'
import { plural } from '../../i18n/strings'
import { CONWAY_CHECK, groupByCheck } from '../../model/checkCatalogue'
import { CHECK_MARK_WORDS } from '../../model/checkMarks'
import type { ConwayFinding, ConwayInteraction, ConwayLine, ConwayMap } from '../../model/conway'
import { applicationOnMap, linesOfPair, pairId, pairsUnder, unitOnMap } from '../../model/conwayReading'
import type { ConwaySum, PairReading } from '../../model/conwayReading'
import { INTERACTION_MODE_LABEL } from '../../model/relations'
import type { DesignElement, ElementId } from '../../model/types'
import { MarkAsIntended } from '../../widgets/FindingMarks'
import type { FindingMarkWords } from '../../widgets/FindingMarks'
import { Button } from '../../widgets/kit/Button'
import { Select } from '../../widgets/kit/Field'
import { List } from '../../widgets/kit/List'
import type { ListGroup, ListRow } from '../../widgets/kit/List'
import { Mark } from '../../widgets/kit/Mark'
import type { MarkKind } from '../../widgets/kit/Mark'
import { MenuButton } from '../../widgets/kit/Menu'
import { NextStep } from '../../widgets/kit/NextStep'
import type { NextAction } from '../../widgets/kit/NextStep'
import { Panel, PanelSection } from '../../widgets/kit/Panel'
import { Picker } from '../../widgets/kit/Picker'
import type { PickerOption } from '../../widgets/kit/Picker'
import { useCheckMarking } from '../checkMarking'
import { modeWords, STANDING_WORD } from './ConwayGrid'
import { findingText } from './conwayWords'
import type { UnitViewsHere } from './unitViewsHere'

/** What the reader is on: nothing, two units, one unit or one application. */
export type ConwayChosen =
  | { kind: 'none' }
  | { kind: 'pair'; a?: ElementId; b?: ElementId }
  | { kind: 'unit'; id: ElementId }
  | { kind: 'app'; id: ElementId }

/** Everything the reader can do; absent where this person, on this day, can do none of it. */
export type ConwayActing = {
  /** Say how two units work together: the dialog, opened on them. Absent for a pair where it cannot be done from here. */
  sayHow: (a: ElementId, b?: ElementId) => (() => void) | undefined
  /** Look again at an interaction this scope keeps. */
  change: (row: ConwayInteraction) => (() => void) | undefined
  remove: (id: string) => (() => void) | undefined
  setOwner: (appId: ElementId, unitId: ElementId) => void
  makeUnits: (types: ReadonlyMap<ElementId, string>) => void
  planAway: (ids: readonly ElementId[]) => void
}

export type ConwayReaderProps = {
  map: ConwayMap
  pairs: readonly PairReading[]
  sum: ConwaySum
  shown: readonly ConwayFinding[]
  accepted: ReactNode
  chosen: ConwayChosen
  here: UnitViewsHere
  day: string
  you: ReadonlySet<ElementId>
  /** Absent: the view is only read, and every button that writes is gone. */
  acting: ConwayActing | undefined
  /** Whether a unit may be changed here: making a party a unit is an edit where it is kept. */
  mayChange: (id: ElementId) => boolean
  onPair: (a: ElementId | undefined, b: ElementId | undefined) => void
  onUnit: (id: ElementId) => void
  onApp: (id: ElementId) => void
  onAll: () => void
  /** Leave for where a record is kept: a unit's chart or an application's page. */
  onOpen: (id: ElementId) => void
  onOpenOperating?: (() => void) | undefined
  onReadMore?: (() => void) | undefined
}

const PAIR_ROW = 'pair:'
const APP_ROW = 'app:'
const UNIT_ROW = 'unit:'

/** The unit's name, or what a pair's empty end is called. */
function end(here: UnitViewsHere, id: ElementId | undefined, t: Translate): string {
  return id === undefined ? t('conway.noOwnerRow') : here.name(id)
}

function BackToAll({ onAll, t }: { onAll: () => void; t: Translate }) {
  return <Button variant="quiet" size="small" onClick={onAll} data-testid="conway-all">{t('conway.all')}</Button>
}

/** The units an owner may be, in the order every list of units reads. */
function useUnitChoices(here: UnitViewsHere, map: Pick<ConwayMap, 'groups'>): PickerOption[] {
  return useMemo(() => {
    const { units, unitTypes } = here.at.organisation
    const typeName = new Map(unitTypes.map((type) => [type.id, type.name]))
    const onMap = map.groups.flatMap((group) => (group.unitId !== undefined ? [group.unitId] : []))
    const typed = units.filter((unit) => unit.unitTypeId)
    const named = new Set(typed.map((unit) => unit.id))
    return [
      ...typed.map((unit) => ({ id: unit.id, label: unit.name, ...(unit.unitTypeId && typeName.has(unit.unitTypeId) ? { detail: typeName.get(unit.unitTypeId) as string } : {}) })),
      // A party that owns applications but is no unit yet is still somebody to name as an owner.
      ...onMap.filter((id) => !named.has(id)).map((id) => ({ id, label: here.name(id) })),
    ]
  }, [here, map])
}

/** Applications with no owner, each with a unit to give it. */
function OwnerRows({ apps, options, acting, onApp, t }: {
  apps: readonly { id: ElementId; name: string }[]; options: readonly PickerOption[]; acting: ConwayActing | undefined; onApp: (id: ElementId) => void; t: Translate
}) {
  return (
    <div data-testid="conway-owners" data-guide="conway.owners">
      {apps.map((app) => (
        <div key={app.id} className="conway__ownerRow" data-testid="conway-owner-row">
          <button type="button" className="conway__link conway__ownerName" onClick={() => onApp(app.id)}>{app.name}</button>
          {acting && (
            <Picker
              posture="popup" label={t('conway.ownerOf', { name: app.name })} placeholder={t('conway.chooseUnit')}
              options={options} onPick={(unit) => acting.setOwner(app.id, unit.id)}
            />
          )}
        </div>
      ))}
    </div>
  )
}

/** The findings as the reader lists them: by check and weight, as every list is, an interface's by the two units it joins. */
function findingRows(shown: readonly ConwayFinding[], pairs: readonly PairReading[], here: UnitViewsHere, notes: boolean, t: Translate): ListGroup[] {
  const groups = groupByCheck(shown, (one) => CONWAY_CHECK[one.kind])
  const mark = (kind: MarkKind) => <Mark kind={kind} />
  const rowsOf = (found: readonly ConwayFinding[]): ListRow[] => {
    const first = found[0]
    if (first?.kind === 'undeclared') {
      return pairs.filter((pair) => pair.standing === 'attention').map((pair) => ({
        id: `${PAIR_ROW}${pairId(pair.a, pair.b)}`, text: t('conway.pairName', { a: end(here, pair.a, t), b: end(here, pair.b, t) }), mark: mark('review'), note: String(pair.open.length),
      }))
    }
    return found.map((one): ListRow => {
      if (one.kind === 'unused') {
        return { id: `${PAIR_ROW}${pairId(one.interaction.sourceId, one.interaction.targetId)}`, text: t('conway.pairName', { a: here.name(one.interaction.sourceId), b: here.name(one.interaction.targetId) }), mark: mark('none') }
      }
      if (one.kind === 'overLimit') return { id: `${UNIT_ROW}${one.unitId}`, text: findingText(one, here, t), mark: mark('review') }
      if (one.kind === 'unowned' || one.kind === 'ownerNamed') return { id: `${APP_ROW}${one.applicationId}`, text: here.name(one.applicationId), mark: mark('unset'), ...(one.kind === 'ownerNamed' ? { note: t('conway.namedNote') } : {}) }
      return { id: `${PAIR_ROW}${pairId(one.from, one.to)}`, text: findingText(one, here, t) }
    })
  }
  const label: Partial<Record<ConwayFinding['kind'], StringKey>> = {
    undeclared: 'conway.group.undeclared', unused: 'conway.group.unused', unowned: 'conway.group.unowned', ownerNamed: 'conway.group.ownerNamed', overLimit: 'conway.group.overLimit',
  }
  return groups
    .filter((group) => (group.weight === 'note') === notes)
    .map((group) => {
      const kind = group.findings[0]?.kind ?? 'unowned'
      const rows = rowsOf(group.findings)
      return { id: group.key, label: t(label[kind] as StringKey), rows, count: rows.length }
    })
}

function WhatToLookAt({ map, pairs, sum, shown, accepted, here, day, acting, onPair, onUnit, onApp, onReadMore }: ConwayReaderProps) {
  const { t, language } = useStrings()
  const [notes, setNotes] = useState(false)
  const options = useUnitChoices(here, map)
  const look = useMemo(() => findingRows(shown, pairs, here, false, t), [shown, pairs, here, t])
  const noted = useMemo(() => findingRows(shown, pairs, here, true, t), [shown, pairs, here, t])
  const noteCount = noted.reduce((sum2, group) => sum2 + group.rows.length, 0)
  const open = (id: string) => {
    if (id.startsWith(APP_ROW)) onApp(id.slice(APP_ROW.length))
    else if (id.startsWith(UNIT_ROW)) onUnit(id.slice(UNIT_ROW.length))
    else {
      const said = id.slice(PAIR_ROW.length)
      const comma = said.indexOf(',')
      const [a, b] = [said.slice(0, comma), said.slice(comma + 1)]
      onPair(a || undefined, b || undefined)
    }
  }
  const noOwner = map.groups.find((group) => group.unitId === undefined)?.applications ?? []
  const low = sum.lowCoverage
  const when = t('conway.onDay', { day: formatDay(day, language) })
  return (
    <Panel
      kind={when} name={t(low ? 'conway.giveOwners' : 'conway.toLookAt')} dataGuide="conway.reader"
      help={t(low ? 'conway.help.owners' : 'conway.help.look')}
      {...(onReadMore ? { helpLink: { label: t('conway.readMore'), onPress: onReadMore } } : {})}
    >
      {low
        ? (
          <PanelSection>
            <p className="conway__quiet">{t(acting ? 'conway.giveOwnersAsk' : 'conway.giveOwnersRead')}</p>
            <OwnerRows apps={noOwner} options={options} acting={acting} onApp={onApp} t={t} />
          </PanelSection>
        )
        : (
          <>
            <div data-testid="conway-findings">
              <List label={t('conway.toLookAt')} groups={look} wrap density="compact" onOpen={open} rowGuide="conway.finding"
                empty={<p className="conway__quiet">{t('conway.nothing')}</p>} />
              {notes && noted.length > 0 && <List label={t('conway.notesLabel')} groups={noted} wrap density="compact" onOpen={open} />}
            </div>
            {noteCount > 0 && (
              <Button variant="quiet" size="small" aria-pressed={notes} onClick={() => setNotes((was) => !was)} data-testid="conway-show-notes">
                {t(notes ? 'conway.hideNotes' : 'conway.showNotes', { count: noteCount })}
              </Button>
            )}
          </>
        )}
      {accepted}
    </Panel>
  )
}

/** What a pair's sentence says, one word of the two for one interface or several. */
function pairSentence(pair: PairReading | undefined, lines: readonly ConwayLine[], open: number, t: Translate): string {
  const words = pair ? modeWords(pair, t) : ''
  const standing = pair?.standing
  if (lines.length === 0 && (standing === undefined || !words)) return t('conway.say.nothing')
  if (standing === 'attention') return plural(t, { one: 'conway.say.attention.one', other: 'conway.say.attention.other' }, open)
  if (standing === 'unused') return t('conway.say.unused', { how: words })
  if (standing === 'unowned') return plural(t, { one: 'conway.say.unowned.one', other: 'conway.say.unowned.other' }, lines.length)
  if (standing === 'accepted') return t('conway.say.accepted')
  return plural(t, { one: 'conway.say.agree.one', other: 'conway.say.agree.other' }, lines.length, { how: words || t('conway.anInteraction') })
}

/** The way two units cannot yet say how they work together, as the reader names it. */
type Held =
  | { kind: 'outside'; names: string }
  | { kind: 'notUnits'; parties: { id: ElementId; name: string; mine: boolean }[] }
  | { kind: 'elsewhere' }

function heldOf(a: ElementId | undefined, b: ElementId | undefined, here: UnitViewsHere, mayChange: (id: ElementId) => boolean): Held | undefined {
  const ends = [a, b].filter((id): id is ElementId => id !== undefined)
  const element = (id: ElementId) => here.at.organisation.units.find((unit) => unit.id === id) as (DesignElement | undefined)
  const typed = (id: ElementId) => Boolean(element(id)?.unitTypeId)
  const outside = ends.filter((id) => here.outside(id))
  if (outside.length > 0) return { kind: 'outside', names: outside.map(here.name).join(', ') }
  const untyped = ends.filter((id) => !typed(id))
  if (untyped.length > 0) return { kind: 'notUnits', parties: untyped.map((id) => ({ id, name: here.name(id), mine: mayChange(id) })) }
  return ends.length === 2 && !ends.some(here.heldHere) ? { kind: 'elsewhere' } : undefined
}

/** Make the two units: a type for each that has none, as far as they are this person's to change. */
function MakeUnits({ parties, here, acting, onOpenOperating, t }: {
  parties: { id: ElementId; name: string; mine: boolean }[]; here: UnitViewsHere; acting: ConwayActing | undefined; onOpenOperating?: (() => void) | undefined; t: Translate
}) {
  const types = here.at.organisation.unitTypes
  const [chosen, setChosen] = useState<ReadonlyMap<ElementId, string>>(new Map())
  const own = parties.filter((one) => one.mine)
  if (!acting || own.length === 0) return <p className="conway__quiet">{t('conway.held.notHere')}</p>
  if (types.length === 0) {
    return (
      <div className="conway__stack">
        <p className="conway__quiet">{t('conway.held.noTypes')}</p>
        {onOpenOperating && <button type="button" className="conway__link" onClick={onOpenOperating}>{t('conway.openOperating')}</button>}
      </div>
    )
  }
  const options = [{ value: '', label: t('conway.chooseType') }, ...types.map((type) => ({ value: type.id, label: type.name }))]
  return (
    <div className="conway__unitTypes" data-testid="conway-make-units">
      {own.map((party) => (
        <div key={party.id} className="conway__ownerRow">
          <span className="conway__ownerName">{t('conway.isA', { name: party.name })}</span>
          <Select
            aria-label={t('conway.isA', { name: party.name })} options={options} value={chosen.get(party.id) ?? ''}
            onChange={(event) => { const next = new Map(chosen); next.set(party.id, event.target.value); setChosen(next) }}
          />
        </div>
      ))}
      <Button
        variant="primary" size="small" disabled={own.some((one) => !chosen.get(one.id))} data-testid="conway-make-units-go" data-guide="conway.makeUnits"
        onClick={() => acting.makeUnits(chosen)}
      >
        {t('conway.makeUnits', { count: own.length })}
      </Button>
      <p className="conway__quiet">{t('conway.unitMeans')}</p>
    </div>
  )
}

function InteractionRows({ rows, here, acting, t }: { rows: readonly ConwayInteraction[]; here: UnitViewsHere; acting: ConwayActing | undefined; t: Translate }) {
  return (
    <>
      {rows.map((row) => {
        const change = acting?.change(row)
        return (
          <div key={row.id} className="conway__row" data-testid="conway-interaction">
            <span>
              {t('conway.pairName', { a: here.name(row.sourceId), b: here.name(row.targetId) })}
              {': '}
              {row.mode ? t(INTERACTION_MODE_LABEL[row.mode]) : t('conway.anInteraction')}
            </span>
            {change && <button type="button" className="conway__link" onClick={change}>{t('conway.change')}</button>}
          </div>
        )
      })}
    </>
  )
}

/** The words of *Mark as intended…* in the reader, where the button says what it answers. */
const FINE_WORDS: FindingMarkWords = { ...CHECK_MARK_WORDS, open: 'conway.fine' }

/** Mark every open finding of a pair as intended, as one question. */
function MarkPair({ findings, sentence }: { findings: readonly ConwayFinding[]; sentence: string }) {
  const marking = useCheckMarking()
  if (!marking || findings.length === 0 || findings.some((one) => marking.markableIn(one) === undefined)) return null
  return <MarkAsIntended words={FINE_WORDS} sentence={sentence} onMark={(reason) => findings.forEach((one) => marking.mark(one, reason))} />
}

function PairReader({ props, chosen }: { props: ConwayReaderProps; chosen: { a?: ElementId; b?: ElementId } }) {
  const { t, language } = useStrings()
  const { map, pairs, here, shown, acting, day, mayChange, onAll, onPair, onUnit, onApp, onOpen, onOpenOperating } = props
  const { a, b } = chosen
  const pair = pairs.find((one) => (one.a === a && one.b === b) || (one.a === b && one.b === a))
  const lines = pair?.lines ?? linesOfPair(map, a, b)
  const open = pair?.open ?? lines.filter((line) => line.status === 'undeclared')
  const under = pairsUnder(map, lines, open)
  const standing = pair?.standing ?? (open.length > 0 ? 'attention' : undefined)
  const held = heldOf(a, b, here, mayChange)
  const name = t('conway.pairName', { a: end(here, a, t), b: end(here, b, t) })
  const options = useUnitChoices(here, map)
  const askingFlows = new Set(open.map((line) => line.flow.id))
  const interactionIds = new Set((pair?.interactions ?? []).map((row) => row.id))
  const findings = shown.filter((one) => (one.kind === 'undeclared' && askingFlows.has(one.flow.id)) || (one.kind === 'unused' && interactionIds.has(one.interaction.id)))
  const say = a !== undefined && b !== undefined ? acting?.sayHow(a, b) : undefined
  const appsOf = (unit: ElementId | undefined) => map.groups.flatMap((group) => group.applications.filter((app) => app.partyId === unit || (group.unitId === unit && unit !== undefined)))
  const flowIds = lines.flatMap((line) => [line.flow.sourceId, line.flow.targetId])
  const actions: NextAction[] = []
  if (say && held === undefined) actions.push({ label: t('conway.sayHow'), onPress: say, primary: true, dataGuide: 'conway.sayHow' })
  if (acting && standing === 'attention') actions.push({ label: t('conway.planAway'), onPress: () => acting.planAway(flowIds), dataGuide: 'conway.planAway' })
  const remove = standing === 'unused' ? pair?.interactions.map((row) => acting?.remove(row.id)).find(Boolean) : undefined
  if (remove) actions.push({ label: t('conway.removeSaid'), onPress: remove, dataGuide: 'conway.removeSaid' })
  const noOwnerApps = lines.flatMap((line) => [line.flow.sourceId, line.flow.targetId])
    .filter((id, at, all) => all.indexOf(id) === at)
    .flatMap((id) => (map.groups.find((group) => group.unitId === undefined)?.applications ?? []).filter((app) => app.id === id))
  const modelApps = [a, b].flatMap((unit) => (unit === undefined ? [] : [{ heading: here.name(unit) }, ...appsOf(unit).map((app) => ({ label: app.name, onSelect: () => onOpen(app.id) }))]))
  const question = standing === 'attention' ? t('conway.q.attention') : standing === 'unused' ? t('conway.q.unused') : undefined
  return (
    <Panel
      kind={t(standing ? STANDING_WORD[standing] : 'conway.state.nothing')} name={name} dataGuide="conway.reader"
      actions={<BackToAll onAll={onAll} t={t} />}
      facts={pairSentence(pair, lines, open.length, t)}
      status={t('conway.onDay', { day: formatDay(day, language) })}
    >
      {under.length > 0 && (
        <PanelSection>
          <List
            label={t('conway.underLabel')} density="compact" onOpen={(id) => { const comma = id.indexOf(','); onPair(id.slice(0, comma), id.slice(comma + 1)) }}
            groups={[{ id: 'under', label: '', rows: under.map((one) => ({ id: pairId(one.a, one.b), text: t('conway.pairName', { a: here.name(one.a), b: here.name(one.b) }), mark: <Mark kind={one.open.length > 0 ? 'review' : 'agree'} />, note: String(one.lines.length) })) }]}
          />
          <p className="conway__quiet">{t('conway.underHelp')}</p>
        </PanelSection>
      )}
      {held?.kind === 'outside' && (standing === 'attention' || standing === undefined) && <p className="conway__text" data-testid="conway-held">{t('conway.held.outside', { name: held.names })}</p>}
      {held?.kind === 'elsewhere' && (standing === 'attention' || standing === undefined) && <p className="conway__text" data-testid="conway-held">{t('conway.held.elsewhere')}</p>}
      {held?.kind === 'notUnits' && a !== undefined && b !== undefined && (standing === 'attention' || standing === undefined) && (
        <>
          <p className="conway__text" data-testid="conway-held">{t('conway.held.notUnits', { name: held.parties.map((one) => one.name).join(', ') })}</p>
          <MakeUnits parties={held.parties} here={here} acting={acting} onOpenOperating={onOpenOperating} t={t} />
        </>
      )}
      {(actions.length > 0 || question) && <NextStep inline {...(question ? { question } : {})} actions={actions} />}
      <MarkPair findings={findings} sentence={name} />
      {standing === 'unused' && modelApps.length > 0 && acting && (
        <div className="conway__stack"><MenuButton label={t('conway.modelInterface')} items={modelApps} data-guide="conway.modelInterface" /></div>
      )}
      {(pair?.interactions.length ?? 0) > 0 && (
        <PanelSection title={t('conway.worksWith')}><InteractionRows rows={pair?.interactions ?? []} here={here} acting={acting} t={t} /></PanelSection>
      )}
      {standing === 'unowned' && (
        <PanelSection title={t('conway.giveOwners')}><OwnerRows apps={noOwnerApps} options={options} acting={acting} onApp={onApp} t={t} /></PanelSection>
      )}
      {standing && standing !== 'accepted' && (
        <PanelSection title={t('conway.whyTitle')}><p className="conway__quiet">{t(`conway.why.${standing}` as StringKey)}</p></PanelSection>
      )}
      <PanelSection title={t('conway.openTitle')}>
        <div className="conway__stack" data-testid="conway-open">
          {lines.slice(0, 12).map((line) => (
            <button key={line.flow.id} type="button" className="conway__link" onClick={() => onOpen(line.flow.sourceId)}>
              {t('conway.openInterface', { source: here.name(line.flow.sourceId), target: here.name(line.flow.targetId) })}
            </button>
          ))}
          {[a, b].map((unit) => (unit === undefined ? null : <button key={unit} type="button" className="conway__link" onClick={() => onUnit(unit)}>{here.name(unit)}</button>))}
        </div>
      </PanelSection>
    </Panel>
  )
}

function UnitReader({ props, id }: { props: ConwayReaderProps; id: ElementId }) {
  const { t } = useStrings()
  const { map, pairs, here, acting, you, onAll, onApp, onPair, onOpen, shown } = props
  const { owns, worksWith, openPairs } = unitOnMap(map, pairs, id)
  const unit = here.at.organisation.units.find((one) => one.id === id)
  const type = here.at.organisation.unitTypes.find((one) => one.id === unit?.unitTypeId)
  const say = acting?.sayHow(id)
  const over = shown.find((one) => one.kind === 'overLimit' && one.unitId === id)
  return (
    <Panel
      kind={type?.name ?? t('conway.party')} name={here.name(id)} dataGuide="conway.reader"
      actions={<BackToAll onAll={onAll} t={t} />}
      {...(you.has(id) ? { facts: <span data-testid="conway-you-reader">{t('unit.you')}</span> } : {})}
    >
      {over && <p className="conway__text"><Mark kind="review" /> {findingText(over, here, t)}</p>}
      <PanelSection title={t('conway.owns')} aside={String(owns.length)}>
        <List label={t('conway.owns')} density="compact" onOpen={onApp} groups={[{ id: 'owns', label: '', rows: owns.map((app) => ({ id: app.id, text: app.name })) }]} empty={<p className="conway__quiet">{t('conway.ownsNone')}</p>} />
      </PanelSection>
      <PanelSection title={t('conway.worksWith')}>
        {worksWith.length === 0 && <p className="conway__quiet">{t('conway.worksWithNone')}</p>}
        <InteractionRows rows={worksWith} here={here} acting={acting} t={t} />
        {say && <Button variant="quiet" size="small" onClick={say} data-testid="unit-interaction-add" data-guide="conway.addInteraction">{t('conway.sayHowUnit')}</Button>}
      </PanelSection>
      {openPairs.length > 0 && (
        <PanelSection title={t('conway.group.undeclared')}>
          <List
            label={t('conway.group.undeclared')} density="compact"
            onOpen={(other) => onPair(id, other)}
            groups={[{ id: 'open', label: '', rows: openPairs.map((pair) => { const other = pair.a === id ? pair.b : pair.a; return { id: other ?? '', text: end(here, other, t), mark: <Mark kind="review" />, note: String(pair.open.length) } }) }]}
          />
        </PanelSection>
      )}
      <PanelSection>
        <div className="conway__stack">
          <button type="button" className="conway__link" onClick={() => onOpen(id)} data-testid="conway-open-unit">{t('conway.openUnit')}</button>
        </div>
        <p className="conway__quiet">{t('conway.unitPageSays')}</p>
      </PanelSection>
    </Panel>
  )
}

function ApplicationReader({ props, id }: { props: ConwayReaderProps; id: ElementId }) {
  const { t } = useStrings()
  const { map, here, acting, onAll, onOpen, onPair, onApp, onUnit } = props
  const options = useUnitChoices(here, map)
  const on = applicationOnMap(map, id)
  if (!on) return <WhatToLookAt {...props} />
  const owner = map.groups.find((group) => group.applications.some((app) => app.id === id))?.unitId
  const others = on.lines.filter((line) => line.status !== 'inside')
  return (
    <Panel
      kind={t('conway.application')} name={on.app.name} dataGuide="conway.reader"
      actions={<BackToAll onAll={onAll} t={t} />}
      facts={owner !== undefined ? t('conway.ownedBy', { name: here.name(on.app.partyId ?? owner) }) : t(on.app.ownerNamed ? 'conway.ownerNamed' : 'conway.noOwner')}
    >
      {owner === undefined && (
        <PanelSection title={t('conway.giveOwner')}>
          <OwnerRows apps={[on.app]} options={options} acting={acting} onApp={onApp} t={t} />
        </PanelSection>
      )}
      {owner !== undefined && (
        <PanelSection>
          <div className="conway__stack"><button type="button" className="conway__link" onClick={() => onUnit(on.app.partyId ?? owner)}>{here.name(on.app.partyId ?? owner)}</button></div>
        </PanelSection>
      )}
      <PanelSection title={t('conway.connects')} aside={String(others.length)}>
        <div className="conway__stack">
          {others.map((line) => (
            <button
              key={line.flow.id} type="button" className="conway__link"
              onClick={() => { if (line.from !== undefined || line.to !== undefined) onPair(line.from, line.to) }}
            >
              {t('conway.lineLabel', { source: here.name(line.flow.sourceId), target: here.name(line.flow.targetId) })}
            </button>
          ))}
        </div>
      </PanelSection>
      <PanelSection>
        <button type="button" className="conway__link" onClick={() => onOpen(id)} data-testid="conway-open-app">{t('conway.openApp')}</button>
      </PanelSection>
    </Panel>
  )
}

export function ConwayReader(props: ConwayReaderProps) {
  const { chosen } = props
  switch (chosen.kind) {
    case 'pair': return <PairReader key={pairId(chosen.a, chosen.b)} props={props} chosen={chosen} />
    case 'unit': return <UnitReader key={chosen.id} props={props} id={chosen.id} />
    case 'app': return <ApplicationReader key={chosen.id} props={props} id={chosen.id} />
    case 'none': return <WhatToLookAt {...props} />
  }
}

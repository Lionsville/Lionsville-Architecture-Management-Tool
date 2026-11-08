// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The organisation chart's tree (ADR-0036 §7, drawn as a tree in 4.0.0): the
 * organisation at the top, the units across, and units with nothing under them
 * hanging in a column from their parent, a grid only where a focus has the room.
 * Nothing is placed by hand. The connectors are measured from what this lays out
 * (`ChartLinesOverlay`), so a word wrapping in German moves them with the box.
 *
 * **A box says who, in words.** The type's whole word, the name, one line per
 * role, and what is worth saying beside them: `vacant` to press, *200% of their
 * time*, *outside its roles*, each a fact of its own, so one mark never stands
 * in for another. A fold says what it hides on one line, and the findings wait
 * in the panel, because on a chart with dozens of empty roles a warning colour
 * on every box stops meaning anything.
 *
 * **A click picks, a double-click opens** (17 October 2026), as on a board.
 * Pressing a person chooses their assignment, wherever the unit is kept, and
 * the panel beside the chart shows it; pressing a unit's name picks the unit,
 * or chooses it as the place a move lands. Double-clicking opens a unit kept in
 * another scope there; nothing leaves the chart on a single click.
 *
 * **The picked box carries its verbs**, in words: *+ Unit inside*, *Move to…*
 * and *Focus*, laid over its foot so that picking a box moves nothing round it,
 * and none that write on a chart that is only read. The keyboard has them too
 * (`chartKeys`), and a right-click or the menu key opens them as the unit's own
 * menu. A folded box that hides the unit picked is ringed and says so.
 */
import type { DragEvent, KeyboardEvent, MouseEvent, ReactNode } from 'react'
import type { Language, Translate } from '../../i18n'
import type { Role } from '../../model/operatingModel'
import { drawsUnitsBelow, emptyOptional, shapeOf } from '../../model/orgChart'
import type { ChartHolder, ChartOther, ChartRollUp, ChartShape, ChartSlot, ChartUnit, OrgChart } from '../../model/orgChart'
import { pickedPerson } from '../../model/person'
import type { PersonId } from '../../model/person'
import type { ElementId } from '../../model/types'
import type { PersonNames } from '../../people/ui/names'
import type { ScopePath } from '../../projects/scopePath'
import { CaretIcon } from '../../widgets/icons'
import { CanvasName, Card } from '../../widgets/kit/Card'
import { Mark } from '../../widgets/kit/Mark'
import { rollUpWords, unitBadges } from './chartWords'
import type { UnitPlans } from './unitViewsHere'
import type { ChartPeople } from './useChartFolds'
import type { UnitOffer } from './useNewUnit'

/** What a unit is to a move under way: the way it is drawn says so before it is pressed. */
export type DropState = 'ok' | 'warn' | 'current' | 'none' | 'moving'

/** A move under way, as the tree draws it. */
export type TreeMove = {
  stateOf: (id: ElementId) => DropState
  /** The place chosen so far: a unit, {@link ORGANISATION} for the top, or none yet. */
  target: string | undefined
  /** The unit, or the organisation for the top, pressed as the place to land. */
  choose: (id: ElementId | undefined) => void
  atTop: DropState
  words: { newPlace: string; sitsNow: string }
}

/** Everything the boxes read, worked out once per render of the page. */
export type Drawing = {
  chart: OrgChart
  roles: ReadonlyMap<string, Role>
  typeName: (id: string | undefined) => string
  names: PersonNames
  /** Whether the register says a person is from outside the organisation. */
  external: (person: PersonId) => boolean
  scopeLabel: (path: ScopePath) => string
  plansOf: (unitId: ElementId) => UnitPlans
  day: string
  today: string
  language: Language
  t: Translate
  selectedId: ElementId | undefined
  /** The unit picked on this chart: the editor's selection, or one kept elsewhere that was gone to. */
  pickedId: ElementId | undefined
  /** The assignment chosen on this chart, while nothing else is selected. */
  chosen: string | undefined
  /** A unit's name pressed: the unit picked, on the chart. */
  pick: (id: ElementId) => void
  /** A unit or a person in it double-clicked: a unit kept in another scope opened there, one kept here picked. */
  open: (id: ElementId) => void
  /** A holder pressed: their assignment chosen. */
  choose: (holder: ChartHolder, unit: ChartUnit) => void
  vacancy: ((unit: ChartUnit, roleId: string, at: HTMLElement) => void) | undefined
  /** What a person holds across the organisation on the day, in per cent. */
  loadOf: (person: PersonId) => number
  /** Whether a vacancy of this unit and role is one to press: every one where the scope may be written, a managed unit's where it is only read. */
  mayAssign: (unit: ChartUnit, roleId: string) => boolean
  folds: ChartBoxFolds
  people: ChartPeople
  /** *+ Unit inside*: what it offers there, and the dialog it opens. Absent: nothing is made from the chart. */
  add?: { offer: (unit: ChartUnit) => UnitOffer; open: (unit: ChartUnit) => void }
  /** *Move to…* a unit, onto a place where it was dragged there. Absent: nothing is moved from the chart. */
  move?: (unit: ElementId, onto?: ElementId) => void
  /** *Focus* on a unit. */
  focus: (unit: ElementId) => void
  /** The unit the arrows move from: the one box in the tab order. */
  roving: ElementId | undefined
  onKey: (unit: ChartUnit, event: KeyboardEvent) => void
  moving?: TreeMove
  /** The units a fold hides the picked one under: that box is ringed and says so. */
  holdsPicked: ReadonlySet<ElementId>
  /** The unit's own menu, from a right-click or the menu key, beside its name. Absent: none. */
  menu?: (unit: ChartUnit, at: HTMLElement) => void
}

/** What the boxes read of the chart's folds. */
export type ChartBoxFolds = {
  folded: ReadonlySet<ElementId>
  toggle: (id: ElementId) => void
  /** What a unit hides when it is folded. */
  rollUp: (unit: ChartUnit) => ChartRollUp
}

/** The key a dragged unit's id travels under: only this page reads it. */
const DRAGGED = 'application/x-lvarch-unit'

/** The whole tree: the organisation over its top units, or the unit focused on over what is under it. */
export function OrgTree({ organisation, focused, drawing }: { organisation: string; focused: ChartUnit | undefined; drawing: Drawing }) {
  if (focused) {
    return (
      <div className="org-tree" data-focused="" data-testid="chart-units">
        <Branch unit={focused} drawing={drawing} focus />
      </div>
    )
  }
  const { moving } = drawing
  return (
    <div className="org-tree" data-testid="chart-units">
      <Card
        className="org-node" name={organisation} data-organisation="" data-testid="chart-organisation" data-tree-box={ORGANISATION}
        {...(moving ? { 'data-drop': moving.atTop, 'data-target': moving.target === ORGANISATION ? moving.atTop : undefined } : {})}
        {...(moving && moving.atTop !== 'none' && moving.atTop !== 'current'
          ? { nameAs: <button type="button" className="org-name" onClick={() => moving.choose(undefined)}><CanvasName text={organisation} /></button> }
          : {})}
      />
      <Under owner={ORGANISATION} units={drawing.chart.roots} shape="across" drawing={drawing} />
    </div>
  )
}

/** What the connectors call the organisation's box, which is no unit. */
export const ORGANISATION = '\u0000organisation'

function Under({ owner, units, shape, drawing }: { owner: string; units: readonly ChartUnit[]; shape: ChartShape; drawing: Drawing }) {
  if (units.length === 0) return null
  return (
    <div className="org-under" data-shape={shape} data-tree-under={owner}>
      {units.map((unit) => <Branch key={unit.id} unit={unit} drawing={drawing} />)}
    </div>
  )
}

/** A unit, and the units under it where it is not folded. */
function Branch({ unit, drawing, focus = false }: { unit: ChartUnit; drawing: Drawing; focus?: boolean }) {
  const { folded } = drawing.folds
  const open = drawsUnitsBelow(unit, folded)
  const shape = shapeOf(unit, folded, focus)
  return (
    <div className="org-branch" data-focus={focus || undefined} data-spreads={(open && shape === 'across') || undefined}>
      <UnitBox unit={unit} drawing={drawing} />
      {open && <Under owner={unit.id} units={unit.children} shape={shape} drawing={drawing} />}
    </div>
  )
}

/** One unit: its type, name, the people in it, and what is worth saying. */
function UnitBox({ unit, drawing }: { unit: ChartUnit; drawing: Drawing }) {
  const { t, folds, moving } = drawing
  const selected = drawing.pickedId === unit.id
  const shut = unit.children.length > 0 && folds.folded.has(unit.id)
  const state = moving?.stateOf(unit.id)
  const pressable = !moving || state === 'ok' || state === 'warn'
  const press = () => { if (moving) moving.choose(unit.id); else drawing.pick(unit.id) }
  const tabbable = drawing.roving === unit.id
  const menuAt = unitMenuAt(unit, drawing, selected)
  return (
    <Card
      className="org-node" name={unit.name} selected={selected && !moving} planned={unit.ended} dimmed={state === 'none'}
      over={drawing.typeName(unit.unitTypeId)}
      data-testid="chart-unit" data-element-id={unit.id} data-unit-name={unit.name} data-tree-box={unit.id}
      data-ended={unit.ended ? 'true' : undefined} {...foldMarks(unit, drawing, shut)}
      data-drop={state} data-target={moving?.target === unit.id ? state : undefined}
      {...dragging(unit, drawing)}
      onContextMenu={menuAt}
      nameAs={(
        <span className="org-head">
          <button
            type="button" className="org-name" onClick={press} onDoubleClick={() => { if (!moving) drawing.open(unit.id) }}
            onKeyDown={(event) => (event.key === 'ContextMenu' || (event.shiftKey && event.key === 'F10') ? menuAt(event) : drawing.onKey(unit, event))}
            data-testid="chart-unit-open" disabled={!pressable} tabIndex={tabbable ? 0 : -1}
          >
            <CanvasName text={unit.name} />
          </button>
          {unit.children.length > 0 && (
            <button
              type="button" className="org-caret" data-shut={shut || undefined} aria-label={t(shut ? 'chart.unfold' : 'chart.fold', { name: unit.name })} aria-expanded={!shut}
              onClick={() => folds.toggle(unit.id)} data-testid="chart-fold" tabIndex={-1}
            >
              <CaretIcon />
            </button>
          )}
        </span>
      )}
      body={(
        <>
          {unit.slots.map((slot) => <SlotRow key={slot.roleId} unit={unit} slot={slot} drawing={drawing} tabbable={tabbable} />)}
          {unit.others.map((other, at) => <OtherRow key={`${other.assignment.id}/${at}`} other={other} unit={unit} drawing={drawing} tabbable={tabbable} />)}
          {shut && <RollUp unit={unit} drawing={drawing} />}
          <UnitBadges unit={unit} drawing={drawing} />
          {moving?.target === unit.id && <span className="org-said">{moving.words.newPlace}</span>}
          {state === 'current' && moving && <span className="org-said">{moving.words.sitsNow}</span>}
          {selected && !moving && <Verbs unit={unit} drawing={drawing} />}
        </>
      )}
    />
  )
}

/** A right-click, or the menu key, opens the unit's menu beside its name; it picks the unit first, so the menu and the panel are about the same one. */
/** A folded box says so, and is ringed where it hides the unit picked. */
function foldMarks(unit: ChartUnit, drawing: Drawing, shut: boolean) {
  return { 'data-folded': shut ? 'true' : undefined, 'data-holds-picked': shut && drawing.holdsPicked.has(unit.id) ? 'true' : undefined }
}

function unitMenuAt(unit: ChartUnit, drawing: Drawing, selected: boolean) {
  return (event: MouseEvent | KeyboardEvent) => {
    if (drawing.moving || !drawing.menu) return
    event.preventDefault()
    const at = (event.currentTarget as HTMLElement).closest('.org-node')?.querySelector<HTMLElement>('.org-name')
    if (!at) return
    if (!selected) drawing.pick(unit.id)
    drawing.menu(unit, at)
  }
}

/** Where a unit may be dragged to another: the same panel as *Move to…*, filled in, and nothing written until Move. */
function dragging(unit: ChartUnit, drawing: Drawing): Record<string, unknown> {
  const { move, moving } = drawing
  if (!move || moving) return {}
  return {
    draggable: true,
    onDragStart: (event: DragEvent) => { event.dataTransfer.setData(DRAGGED, unit.id); event.dataTransfer.effectAllowed = 'move' },
    onDragOver: (event: DragEvent) => { if ([...event.dataTransfer.types].includes(DRAGGED)) event.preventDefault() },
    onDrop: (event: DragEvent) => {
      const dragged = event.dataTransfer.getData(DRAGGED)
      if (dragged === '' || dragged === unit.id) return
      event.preventDefault()
      move(dragged, unit.id)
    },
  }
}

/** What a picked box offers, in words. */
function Verbs({ unit, drawing }: { unit: ChartUnit; drawing: Drawing }) {
  const { t, add, move } = drawing
  const offer = add?.offer(unit)
  return (
    <span className="org-actions" data-sheet-add="">
      {add && offer && (
        <button
          type="button" className="org-link" onClick={() => add.open(unit)} title={offer.ok ? undefined : offer.reason} aria-disabled={offer.ok ? undefined : 'true'}
          aria-label={t('chart.addInside', { name: unit.name })} data-guide="chart.addInside" data-testid="chart-add-inside"
        >
          {t('chart.addInsideShort')}
        </button>
      )}
      {move && (
        <button
          type="button" className="org-link" onClick={() => move(unit.id)} aria-label={t('unitMove.openNamed', { name: unit.name })}
          data-guide="chart.moveTo" data-testid="chart-move-to"
        >
          {t('unitMove.open')}
        </button>
      )}
      <button type="button" className="org-link" onClick={() => drawing.focus(unit.id)} data-testid="chart-focus" data-guide="chart.focus">{t('chart.focusHere')}</button>
    </span>
  )
}

/** What a folded unit hides, on one line, pressed to unfold it. The findings stay in the panel, once. */
function RollUp({ unit, drawing }: { unit: ChartUnit; drawing: Drawing }) {
  const { t, folds } = drawing
  const parts = rollUpWords({ ...folds.rollUp(unit), findings: 0 }, t).filter((part) => part.key !== 'people')
  return (
    <>
      <button type="button" className="org-rollup" data-testid="chart-rollup" tabIndex={-1} onClick={() => folds.toggle(unit.id)}>
        {parts.map((part, at) => <span key={part.key} data-part={part.key}>{at > 0 ? ' · ' : ''}{part.text}</span>)}
      </button>
      {drawing.holdsPicked.has(unit.id) && <span className="org-said" data-testid="chart-holds-picked">{t('chart.holdsPicked')}</span>}
    </>
  )
}

/** What is worth saying beside a unit: the domains it serves, its days and the plans that set them, that it has ended. */
function UnitBadges({ unit, drawing }: { unit: ChartUnit; drawing: Drawing }) {
  const badges = unitBadges(unit, { ...drawing, plans: drawing.plansOf(unit.id) })
  if (badges.length === 0) return null
  return (
    <span className="org-said" data-testid="chart-badges" data-tone={unit.ended ? 'warn' : undefined}>
      {badges.map((badge, at) => (
        <span key={badge.key} data-testid={`chart-badge-${badge.key}`} title={badge.full}>{at > 0 ? ' · ' : ''}{badge.text}</span>
      ))}
    </span>
  )
}

/** Whether a role is drawn at this level of the People menu: and always where it holds the person picked. */
function slotDrawn(slot: ChartSlot, role: Role | undefined, drawing: Drawing): boolean {
  if (drawing.people === 'all') return true
  if (emptyOptional(slot)) return false
  if (drawing.people === 'required') return true
  return role?.manages === true || slot.holders.some((holder) => holder.assignment.id === drawing.chosen)
}

/** One role of a unit, on one line: who holds it, and what its slot still asks for. */
function SlotRow({ unit, slot, drawing, tabbable }: { unit: ChartUnit; slot: ChartSlot; drawing: Drawing; tabbable: boolean }) {
  const { t } = drawing
  const role = drawing.roles.get(slot.roleId)
  if (!slotDrawn(slot, role, drawing)) return null
  const vacancy = drawing.vacancy && drawing.mayAssign(unit, slot.roleId) ? drawing.vacancy : undefined
  const parts: ReactNode[] = [
    ...slot.holders.map((holder, at) => <Holder key={`${holder.assignment.id}/${at}`} holder={holder} drawing={drawing} unit={unit} tabbable={tabbable} />),
    ...Array.from({ length: slot.vacant }, (_, at) => (vacancy
      ? <button key={`vacant-${at}`} type="button" className="org-vacant" data-testid="chart-vacant" tabIndex={tabbable ? 0 : -1} onClick={(event) => vacancy(unit, slot.roleId, event.currentTarget)}>{t('chart.vacant')}</button>
      : <span key={`vacant-${at}`} className="org-vacant" data-testid="chart-vacant">{t('chart.vacant')}</span>)),
  ]
  if (vacancy && slot.vacant === 0 && slot.room && slot.holders.length === 0) {
    parts.push(<button key="assign" type="button" className="org-link" data-testid="chart-assign" tabIndex={tabbable ? 0 : -1} onClick={(event) => vacancy(unit, slot.roleId, event.currentTarget)}>{t('chart.assignWord')}</button>)
  }
  return (
    <div className="org-row" data-testid={`chart-slot-${slot.roleId}`} title={role?.manages ? t('chart.readManages') : undefined}>
      <span data-testid="chart-role-name">{role?.name ?? slot.roleId}</span>{': '}
      {parts.map((part, at) => <span key={at}>{at > 0 ? ', ' : ''}{part}</span>)}
      {slot.holders.filter((holder) => holder.overloaded).map((holder) => <Over key={holder.assignment.id} holder={holder} drawing={drawing} />)}
    </div>
  )
}

/** Somebody in a role the unit holds no slot for: said on a row of its own, what it departs from in words. */
function OtherRow({ other, unit, drawing, tabbable }: { other: ChartOther; unit: ChartUnit; drawing: Drawing; tabbable: boolean }) {
  const { t } = drawing
  const role = drawing.roles.get(other.assignment.roleId)?.name ?? other.assignment.roleId
  const said = other.exception ? t('unit.exceptionPlacement', { role, unit: unit.name }) : undefined
  return (
    <div className="org-row" data-testid="chart-others" data-exception={other.exception || undefined}>
      {role}{other.endedRole ? ` (${t('chart.roleEnded')})` : ''}{': '}
      <Holder holder={other} drawing={drawing} unit={unit} tabbable={tabbable} {...(said !== undefined ? { exception: said } : {})} />
      {other.exception && <span className="org-row__said" data-testid="chart-outside"><Mark kind="exception" size={10} /> {t('chart.outsideRoles')}</span>}
      {other.overloaded && <Over holder={other} drawing={drawing} />}
    </div>
  )
}

/** More than all of their time, in words on the line. */
function Over({ holder, drawing }: { holder: ChartHolder; drawing: Drawing }) {
  const { t } = drawing
  return <span className="org-row__said" data-over="" data-testid="chart-over" title={t('chart.over')}>{t('chart.overWords', { share: drawing.loadOf(holder.person) })}</span>
}

/** One person in a role: the register's name, their share, acting, *ext* and *you*, and the ring a chosen assignment has. */
function Holder({ holder, drawing, unit, exception, tabbable }: { holder: ChartHolder; drawing: Drawing; unit: ChartUnit; exception?: string; tabbable: boolean }) {
  const { t } = drawing
  const person = pickedPerson(holder.person)
  const you = drawing.names.isMe(person)
  const chosen = drawing.chosen === holder.assignment.id && drawing.selectedId === undefined
  const label = [
    drawing.names.text(person),
    holder.share < 1 ? `${Math.round(holder.share * 100)}%` : undefined,
    holder.assignment.acting ? t('unit.acting') : undefined,
    drawing.external(holder.person) ? t('chart.external') : undefined,
    you ? t('unit.you') : undefined,
  ].filter(Boolean).join(' · ')
  return (
    <button
      type="button" className="org-person" data-testid="chart-holder" data-assignment-id={holder.assignment.id} data-role-id={holder.assignment.roleId}
      data-you={you ? 'true' : undefined} data-over={holder.overloaded ? 'true' : undefined} data-chosen={chosen ? 'true' : undefined} aria-pressed={chosen}
      data-exception={exception !== undefined ? 'true' : undefined} {...(exception !== undefined ? { 'aria-label': `${label}. ${exception}`, title: exception } : {})}
      tabIndex={tabbable ? 0 : -1}
      onClick={(event: MouseEvent) => { event.stopPropagation(); drawing.choose(holder, unit) }} onDoubleClick={() => drawing.open(unit.id)}
    >
      {label}
    </button>
  )
}

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What is dragged onto a poster in Design: a team, an application, a subscope. Each
 * writes the row the panel writes, through the panel's action, in one step however
 * many tiles are picked; a label on the view goes with a team's, and is only that.
 *
 * Every drag here has a way without one (WCAG 2.5.7): with tiles picked a press on an
 * item applies it to them, and L or A on a tile opens this same list at the tile. A
 * press with nothing picked lights where an application is used. Only this scope's
 * rows can be taken away again, so the tray only adds, and the panel only takes off
 * what is kept here.
 */
import { useMemo, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { DesignElement, DesignModel, ElementId } from '../../model'
import type { Translate } from '../../i18n'
import { plural } from '../../i18n/strings'
import { Button } from '../../widgets/kit/Button'
import { TextInput } from '../../widgets/kit/Field'
import { PickerAt } from '../../widgets/kit/Picker'
import type { PickerOption } from '../../widgets/kit/Picker'
import { Segmented } from '../../widgets/kit/Segmented'
import { dropTargetAt, tileAt } from './PosterDesign'
import type { PosterActions } from './PosterDesign'
import type { SheetDomains, SheetResponsible, Supporter } from './FunctionInspector'
import type { LaidOutSheet } from '../sheet'
import type { FunctionCoverage } from '../coverage'

export type TrayMode = 'team' | 'application' | 'subscope'

/** How many a list shows until asked or searched: a register of hundreds is found, not browsed. */
const SHOWN = 40
const OTHER_UNITS = 5

export type TrayWork = {
  model: DesignModel
  laidOut: LaidOutSheet
  actions: PosterActions
  coverageAt(id: ElementId): FunctionCoverage
  responsible?: SheetResponsible | undefined
  applications?: readonly Supporter[] | undefined
  domains?: SheetDomains | undefined
  ownerOf?: ((id: ElementId) => { label: string } | undefined) | undefined
  retiring?: ((id: ElementId) => boolean) | undefined
  say(words: string): void
  t: Translate
}

/** One thing dropped or pressed onto these: the words for what came of it. */
export function applyTray(work: TrayWork, kind: TrayMode, value: { id?: string; name: string }, ids: readonly ElementId[], onBlock: boolean): void {
  const { actions, coverageAt, say, t, ownerOf } = work
  if (kind === 'team') {
    actions.team(ids, value.id !== undefined ? { id: value.id } : { name: value.name })
    say(t('sheet.poster.labelled', { name: value.name, count: ids.length }))
    return
  }
  if (kind === 'application') {
    if (onBlock) { say(t('sheet.poster.appOnBlock')); return }
    const fresh = ids.filter((id) => !coverageAt(id).supportedBy.includes(value.id ?? ''))
    if (fresh.length === 0) { say(t('sheet.poster.appAlready', { name: value.name })); return }
    actions.cover(fresh, value.id ?? '')
    say(t('sheet.poster.labelled', { name: value.name, count: fresh.length }))
    return
  }
  const own = ids.filter((id) => !ownerOf?.(id))
  if (own.length === 0) {
    const owner = ownerOf?.(ids[0])
    say(t('standIn.definedIn', { scope: owner?.label ?? '' }))
    return
  }
  actions.hand(own, value.id ?? '')
  say(t('sheet.poster.labelled', { name: value.name, count: own.length }))
}

type Row = { id?: string; name: string; note?: string; /** What the note means, said on hover. */ noteSays?: string; detail?: string; typed?: boolean; group?: string; why?: string }

/** The teams in the rail's words: those on this sheet with why, the rest kept short, those that are not units. */
function teamRows(work: TrayWork, typed: readonly string[], allOthers: boolean): { rows: Row[]; more: number } {
  const { laidOut, responsible, model, t } = work
  const used = laidOut.actors.filter((row) => row.group === 'used')
  const seen = new Set(used.map((row) => row.element.id))
  const rows: Row[] = used.map((row) => {
    const first = row.uses?.responsibleFor[0]?.name
    return { id: row.element.id, name: row.element.name, group: t('sheet.unitsHere'), why: t('sheet.poster.teamsHereWhy'), ...(first !== undefined ? { detail: t('sheet.unitResponsible', { name: first }) } : {}) }
  })
  const others = (responsible?.choices ?? []).filter((choice) => !seen.has(choice.id) && responsible?.unit?.(choice.id) !== undefined)
  const shown = allOthers ? others : others.slice(0, OTHER_UNITS)
  // *Other* only where there is a first group for them to be other than.
  const otherGroup = used.length > 0 ? t('sheet.unitsOther') : t('sheet.poster.teams')
  rows.push(...shown.map((choice): Row => ({ id: choice.id, name: choice.label, group: otherGroup })))
  const assigned = new Set(model.relations.filter((row) => row.type === 'assigned').map((row) => row.sourceId))
  const notUnits = model.elements.filter((element: DesignElement) => element.kind === 'actor' && element.unitTypeId === undefined && assigned.has(element.id))
  const why = t('sheet.poster.teamsTypedWhy')
  rows.push(...notUnits.map((element): Row => ({ id: element.id, name: element.name, typed: true, group: t('sheet.poster.notAUnit'), why })))
  rows.push(...typed.filter((name) => !notUnits.some((one) => one.name === name)).map((name): Row => ({ name, typed: true, group: t('sheet.poster.notAUnit'), why })))
  return { rows, more: others.length - shown.length }
}

function applicationRows(work: TrayWork): Row[] {
  const { applications, model, laidOut, coverageAt, retiring, t } = work
  const list: readonly Supporter[] = applications ?? model.elements.filter((held) => held.kind === 'application')
  const used = new Map<string, number>()
  for (const area of laidOut.areas) {
    for (const tile of [...area.capabilities, ...area.groupings.flatMap((grouping) => grouping.capabilities)]) {
      for (const id of coverageAt(tile.element.id).supportedBy) used.set(id, (used.get(id) ?? 0) + 1)
    }
  }
  return [...list].sort((a, b) => a.name.localeCompare(b.name)).map((one) => ({
    id: one.id, name: one.name,
    note: `${retiring?.(one.id) ? `${t('lifecycle.retiring')} · ` : ''}${used.get(one.id) ?? 0}`,
    noteSays: t('sheet.poster.coversHere', { count: used.get(one.id) ?? 0 }),
  }))
}

/** The scopes below, as the panel's *+ Domain* offers them: nothing handed yet is the empty function's list. */
function subscopeRows(work: TrayWork): Row[] {
  const { domains } = work
  return (domains?.choices('') ?? []).map((one) => ({ id: one.id, name: one.label, ...(one.note !== undefined ? { note: one.note } : {}) }))
}

function Item({ row, on, onDown }: { row: Row; on: boolean; onDown(event: ReactPointerEvent<HTMLButtonElement>): void }) {
  return (
    <button type="button" className="poster-tray__item" data-typed={row.typed ? '' : undefined} data-on={on ? '' : undefined} data-testid={`poster-tray-${row.id ?? row.name}`} onPointerDown={onDown} aria-pressed={on}>
      <span title={row.detail ? `${row.name}. ${row.detail}` : row.name}>{row.name}</span>
      {row.note !== undefined && <span className="poster-tray__note" title={row.noteSays}>{row.note}</span>}
    </button>
  )
}

/** A drag from the tray: a ghost under the pointer, what it lands on outlined, and a press where it did not move. */
function dragFromTray(event: ReactPointerEvent<HTMLButtonElement>, words: string, onDrop: (id: ElementId, onBlock: boolean) => void, onPress: () => void) {
  event.preventDefault()
  const start = { x: event.clientX, y: event.clientY }
  let moved = false
  let over: HTMLElement | undefined
  const ghost = document.createElement('div')
  ghost.className = 'poster-ghost'
  ghost.textContent = words
  const under = (x: number, y: number) => tileAt(x, y) ?? dropTargetAt(x, y)
  const move = (at: PointerEvent) => {
    if (!moved && Math.hypot(at.clientX - start.x, at.clientY - start.y) > 3) { moved = true; document.body.append(ghost) }
    if (!moved) return
    ghost.style.left = `${at.clientX + 8}px`
    ghost.style.top = `${at.clientY + 8}px`
    const now = under(at.clientX, at.clientY)
    if (now !== over) {
      delete over?.dataset.over
      over = now
      if (over) over.dataset.over = ''
    }
  }
  const up = () => {
    document.removeEventListener('pointermove', move)
    document.removeEventListener('pointerup', up)
    ghost.remove()
    delete over?.dataset.over
    if (!moved) { onPress(); return }
    if (!over) return
    const tile = over.dataset.elementId
    if (tile !== undefined && over.classList.contains('poster-tile')) onDrop(tile, false)
    else if (over.dataset.drop) onDrop(over.dataset.drop, true)
  }
  document.addEventListener('pointermove', move)
  document.addEventListener('pointerup', up)
}

export function PosterTray({ work, picked, lit, onLight }: {
  work: TrayWork
  picked: ReadonlySet<ElementId>
  /** The application whose tiles are lit. */
  lit: string | undefined
  onLight(id: string | undefined, tiles: readonly ElementId[]): void
}) {
  const { t, laidOut, coverageAt, say } = work
  const [mode, setMode] = useState<TrayMode>('team')
  const [find, setFind] = useState('')
  const [typed, setTyped] = useState<readonly string[]>([])
  const [typing, setTyping] = useState('')
  const [allOthers, setAllOthers] = useState(false)
  const [all, setAll] = useState(false)
  const teams = useMemo(() => teamRows(work, typed, allOthers || find !== ''), [work, typed, allOthers, find])
  const rows = mode === 'team' ? teams.rows : mode === 'application' ? applicationRows(work) : subscopeRows(work)
  const wanted = find.trim().toLocaleLowerCase()
  const found = wanted === '' ? rows : rows.filter((row) => row.name.toLocaleLowerCase().includes(wanted))
  const shown = all ? found : found.slice(0, SHOWN)
  const press = (row: Row) => {
    if (picked.size > 0) { applyTray(work, mode, row, [...picked], false); return }
    if (mode !== 'application') { say(t('sheet.poster.pressNeedsPick')); return }
    if (lit === row.id) { onLight(undefined, []); say(''); return }
    const tiles = laidOut.areas.flatMap((area) => [...area.capabilities, ...area.groupings.flatMap((grouping) => grouping.capabilities)])
      .filter((tile) => coverageAt(tile.element.id).supportedBy.includes(row.id ?? '')).map((tile) => tile.element.id)
    onLight(row.id, tiles)
    say(t('sheet.poster.appCovers', { name: row.name, count: tiles.length }))
  }
  const drop = (row: Row, id: ElementId, onBlock: boolean) => {
    applyTray(work, mode, row, !onBlock && picked.has(id) ? [...picked] : [id], onBlock)
  }
  let group: string | undefined
  return (
    <aside className="poster-tray" aria-label={t('sheet.poster.tray')} data-testid="poster-tray">
      <Segmented
        label={t('sheet.poster.tray')} value={mode} onChange={(to) => { setMode(to); setFind('') }}
        options={[
          { value: 'team', label: t('sheet.poster.teams') },
          { value: 'application', label: t('sheet.poster.applications') },
          ...(work.domains ? [{ value: 'subscope' as const, label: t('sheet.poster.subscopes') }] : []),
        ]}
      />
      <TextInput value={find} placeholder={t('sheet.poster.findTray')} aria-label={t('sheet.poster.findTray')} onChange={(event) => setFind(event.target.value)} />
      <div className="poster-tray__list">
        {mode === 'subscope' && <div className="poster-tray__why">{t('sheet.poster.subscopesWhy')}</div>}
        {shown.map((row) => {
          const heading = row.group !== group ? row.group : undefined
          group = row.group
          return (
            <div key={row.id ?? row.name}>
              {heading && <div className="poster-tray__heading">{heading}</div>}
              {heading && row.why && <div className="poster-tray__why">{row.why}</div>}
              <Item row={row} on={lit !== undefined && lit === row.id} onDown={(event) => dragFromTray(event, row.name, (id, onBlock) => drop(row, id, onBlock), () => press(row))} />
            </div>
          )
        })}
        {mode === 'team' && teams.more > 0 && (
          <Button variant="quiet" size="small" onClick={() => setAllOthers(true)}>{plural(t, { one: 'sheet.unitsNotDrawnOne', other: 'sheet.unitsNotDrawnOther' }, teams.more)}</Button>
        )}
        {found.length > shown.length && <Button variant="quiet" size="small" onClick={() => setAll(true)}>{t('sheet.poster.showAll', { count: found.length })}</Button>}
      </div>
      {mode === 'team' && (
        <TextInput
          value={typing} placeholder={t('sheet.poster.typeTeam')} aria-label={t('sheet.poster.typeTeam')} data-testid="poster-tray-typed"
          onChange={(event) => setTyping(event.target.value)}
          onKeyDown={(event) => {
            const name = typing.trim()
            if (event.key !== 'Enter' || name === '') return
            event.preventDefault()
            setTyping('')
            if (picked.size > 0) applyTray(work, 'team', { name }, [...picked], false)
            else setTyped((held) => [...held, name])
          }}
        />
      )}
    </aside>
  )
}

/** The tray's list at a tile, for those who do not drag: L for a team, A for an application. */
export function PosterPickAt({ work, kind, ids, anchor, onClose }: { work: TrayWork; kind: 'team' | 'application'; ids: readonly ElementId[]; anchor: HTMLElement; onClose(): void }) {
  const { t } = work
  const rows = kind === 'team' ? teamRows(work, [], true).rows : applicationRows(work)
  const options: PickerOption[] = rows.flatMap((row) => (row.id !== undefined ? [{ id: row.id, label: row.name, ...(row.note !== undefined ? { detail: row.note } : {}), ...(row.group !== undefined ? { group: row.group } : {}) }] : []))
  const box = anchor.getBoundingClientRect()
  return (
    <PickerAt
      open at={{ x: box.left, y: box.bottom }} onClose={onClose} options={options}
      label={kind === 'team' ? t('sheet.poster.teams') : t('sheet.poster.applications')}
      onPick={(option) => { applyTray(work, kind, { id: option.id, name: option.label }, ids, false); onClose() }}
      {...(kind === 'team' ? { onCreate: (name: string) => { applyTray(work, 'team', { name }, ids, false); onClose() } } : {})}
    />
  )
}

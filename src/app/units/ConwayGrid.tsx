// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The Conway map's first reading: every two units once, in one triangle of the
 * Matrix, and those nobody owns a row of their own at the foot. A cell says how
 * the two stand by its mark, so it still reads without its colour; a press
 * chooses the pair and a heading's name the unit, and the reader beside it says
 * the rest. It writes nothing: the kit's Matrix hands in no keys here.
 */
import type { ReactNode } from 'react'
import type { StringKey, Translate } from '../../i18n'
import { plural } from '../../i18n/strings'
import type { ConwayMap } from '../../model/conway'
import { pairId } from '../../model/conwayReading'
import type { PairReading, PairStanding } from '../../model/conwayReading'
import { INTERACTION_MODES, INTERACTION_MODE_LABEL } from '../../model/relations'
import type { ElementId, InteractionMode } from '../../model/types'
import { Mark } from '../../widgets/kit/Mark'
import type { MarkKind } from '../../widgets/kit/Mark'
import { Matrix } from '../../widgets/kit/Matrix'
import type { MatrixCell } from '../../widgets/kit/Matrix'

/** The one letter a mode is marked with, in the reader's language. */
const MODE_MARK: Record<InteractionMode, StringKey> = {
  collaboration: 'conway.mark.collaboration',
  service: 'conway.mark.service',
  facilitating: 'conway.mark.facilitating',
}

/** A heading's id for the applications nobody owns: no unit's id is empty. */
const NOBODY = ''

export const STANDING_MARK: Record<PairStanding, MarkKind> = {
  attention: 'review', agree: 'agree', unused: 'none', unowned: 'unset', accepted: 'note',
}

export const STANDING_WORD: Record<PairStanding, StringKey> = {
  attention: 'conway.state.attention', agree: 'conway.state.agree', unused: 'conway.state.unused', unowned: 'conway.state.unowned', accepted: 'conway.state.accepted',
}

/** The letters of the modes said between two, each once, in the order the modes are listed; one with no mode as `?`. */
export function modeLetters(pair: Pick<PairReading, 'interactions'>, t: Translate): string {
  const modes = INTERACTION_MODES.filter((mode) => pair.interactions.some((row) => row.mode === mode))
  const unnamed = pair.interactions.some((row) => row.mode === undefined)
  return [...modes.map((mode) => t(MODE_MARK[mode])), ...(unnamed ? [t('conway.mark.unnamed')] : [])].join('')
}

/** The modes said between two, in words. */
export function modeWords(pair: Pick<PairReading, 'interactions'>, t: Translate): string {
  const modes = INTERACTION_MODES.filter((mode) => pair.interactions.some((row) => row.mode === mode))
  const unnamed = pair.interactions.some((row) => row.mode === undefined)
  return [...modes.map((mode) => t(INTERACTION_MODE_LABEL[mode])), ...(unnamed ? [t('conway.anInteraction')] : [])].join(', ')
}

function cellOf(pair: PairReading, t: Translate): MatrixCell {
  const letters = modeLetters(pair, t)
  const count = pair.standing === 'attention' ? pair.open.length : pair.lines.length
  const said = modeWords(pair, t)
  const meaning = [
    t(STANDING_WORD[pair.standing]),
    count > 0 ? plural(t, { one: 'conway.interfaces.one', other: 'conway.interfaces.other' }, count) : undefined,
    said || undefined,
  ].filter(Boolean).join(', ')
  // The Matrix draws the triangle of a cell that asks for attention itself.
  const mark = pair.standing === 'attention' ? null : <Mark kind={STANDING_MARK[pair.standing]} />
  return {
    meaning, attention: pair.standing === 'attention',
    ...(pair.standing === 'unused' || pair.standing === 'unowned' ? { tone: 'soft' as const } : {}),
    show: (
      <span className="conway__cell" data-standing={pair.standing}>
        {mark}{count > 0 ? count : null}{letters ? <sup>{letters}</sup> : null}
      </span>
    ),
  }
}

export function ConwayGrid({ map, pairs, chosen, nameOf, you, overLimit, onPair, onUnit, t }: {
  map: Pick<ConwayMap, 'groups'>
  pairs: readonly PairReading[]
  chosen: { a?: ElementId; b?: ElementId } | undefined
  nameOf: (id: ElementId) => string
  you: ReadonlySet<ElementId>
  overLimit: ReadonlySet<ElementId>
  onPair: (a: ElementId | undefined, b: ElementId | undefined) => void
  onUnit: (id: ElementId) => void
  t: Translate
}) {
  const units = map.groups.flatMap((group) => (group.unitId !== undefined ? [group.unitId] : []))
  const nobody = map.groups.some((group) => group.unitId === undefined)
  // One triangle: each unit's row reaches only the columns before it, and the row of those nobody owns reaches them all.
  const rows = [...units.slice(1), ...(nobody ? [NOBODY] : [])]
  const columns = nobody ? units : units.slice(0, -1)
  if (rows.length === 0 || columns.length === 0) return null
  const at = new Map(units.map((id, index) => [id, index]))
  const reachOf = (row: string) => (row === NOBODY ? units.length : at.get(row) ?? 0)
  const byPair = new Map(pairs.flatMap((pair) => [[pairId(pair.a, pair.b), pair], [pairId(pair.b, pair.a), pair]] as const))
  const end = (id: string) => (id === NOBODY ? undefined : id)
  const headMark = (id: ElementId): ReactNode => (
    <>
      {overLimit.has(id) && <Mark kind="review" label={t('conway.state.overLimit')} />}
      {you.has(id) && <span className="conway__you" data-testid="conway-you">{t('unit.you')}</span>}
    </>
  )
  const marked = (id: ElementId) => (overLimit.has(id) || you.has(id) ? { mark: headMark(id) } : {})
  const selected = chosen ? pickOf(chosen, rows, columns, reachOf) : null
  return (
    <div className="conway__grid" data-testid="conway-matrix">
      <Matrix
        label={t('conway.gridLabel')} rotateHeads dataGuide="conway.grid"
        rows={rows.map((id) => ({ id, label: id === NOBODY ? t('conway.noOwnerRow') : nameOf(id), ...(id === NOBODY ? {} : marked(id)) }))}
        columns={columns.map((id) => ({ id, label: nameOf(id), ...marked(id) }))}
        absent={(row, column) => (at.get(column) ?? 0) >= reachOf(row)}
        cellOf={(row, column) => {
          const pair = byPair.get(pairId(end(row), column))
          return pair ? cellOf(pair, t) : null
        }}
        selected={selected}
        onSelect={({ row, column }) => onPair(column, end(row))}
        onOpenRow={(row) => { if (row !== NOBODY) onUnit(row) }}
        onOpenColumn={onUnit}
      />
    </div>
  )
}

/** Where a chosen pair sits in the triangle, whichever way round it was named. */
function pickOf(chosen: { a?: ElementId; b?: ElementId }, rows: readonly string[], columns: readonly string[], reachOf: (row: string) => number) {
  const as = (row: string, column: string) => (
    rows.includes(row) && columns.includes(column) && columns.indexOf(column) < reachOf(row) ? { row, column } : null
  )
  const [a, b] = [chosen.a ?? NOBODY, chosen.b ?? NOBODY]
  return as(b, a) ?? as(a, b)
}

/** Every state and every mode, in words, with the same marks the cells carry. */
export function ConwayKey({ t }: { t: Translate }) {
  const states: PairStanding[] = ['attention', 'agree', 'unused', 'unowned', 'accepted']
  return (
    <>
      <div className="conway__key" data-testid="conway-key">
        {states.map((one) => <span key={one} className="conway__keyItem"><Mark kind={STANDING_MARK[one]} />{t(STANDING_WORD[one])}</span>)}
      </div>
      <div className="conway__key">
        {INTERACTION_MODES.map((mode) => <span key={mode}>{t(MODE_MARK[mode])} {t(INTERACTION_MODE_LABEL[mode])}</span>)}
      </div>
    </>
  )
}

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The two grids of a building block (ADR-0043), each the one Matrix where a
 * press writes (ADR-0043 §6): a press fills a ball a quarter more, ⇧-press a
 * quarter less, and the cell's menu offers the five levels by name — and on a
 * comparison, *Note…*. Space and a digit do the same from the keyboard, and the
 * line under the grid says what the cell means, in words. Where nothing may be
 * written a press only selects.
 *
 * - **The requirements**: the capabilities as rows, the usage contexts as
 *   columns, and in each cell how much that context needs that capability.
 * - **One scope's evaluation**: the capabilities as rows, pinned beside each what
 *   this scope needs — the most its contexts need, read, not set — then each
 *   option it weighs with how far it covers each capability, the word *note* where
 *   one says how (N writes it), and the fit under it, the sum on the line.
 *
 * Read-only where no change is handed in: what a document's `ref` block and a
 * person who may not write draw.
 */
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import type { StringKey } from '../../i18n'
import { useStrings } from '../../i18n/LanguageContext'
import { nextLevel } from '../../model/buildingBlock'
import { drivenBy as contextsDriving, percent } from '../../model/evaluation'
import type { Evaluation, Fit } from '../../model/evaluation'
import type { BlockCapability as Capability, BlockLevel as Level, DesignElement, SolutionSort } from '../../model/types'
import { Dialog } from '../../widgets/kit/Dialog'
import { TextField } from '../../widgets/kit/Field'
import { Matrix } from '../../widgets/kit/Matrix'
import type { MatrixCell, MatrixPick } from '../../widgets/kit/Matrix'
import { Mark } from '../../widgets/kit/Mark'
import { Switch } from '../../widgets/kit/Switch'
import type { MenuEntry } from '../../widgets/kit/Menu'
import { useBlocks } from './BlocksContext'
import { BallFigure, BallLegend } from './HarveyBall'
import { readComparison } from './comparisonReading'
import type { CapabilityReading, CellReading, ComparisonReading, OptionReading } from './comparisonReading'
import './Blocks.css'

/** A building block as the grids read it: its requirements and its catalogue. */
type BuildingBlock = Pick<DesignElement, 'id' | 'name' | 'capabilities' | 'contexts' | 'sbbs'>

/** What a need is called, a level each. */
export const NEED_WORD: Record<Level, StringKey> = {
  0: 'blocks.need0', 1: 'blocks.need1', 2: 'blocks.need2', 3: 'blocks.need3', 4: 'blocks.need4',
}

/** What a coverage is called, a level each. */
export const COVER_WORD: Record<Level, StringKey> = {
  0: 'blocks.cover0', 1: 'blocks.cover1', 2: 'blocks.cover2', 3: 'blocks.cover3', 4: 'blocks.cover4',
}

/** How long a press is held on screen while what is kept has not caught up with it. */
const HELD_FOR = 4000

/**
 * What was written last, until what is kept says the same: a write lands
 * when the tree has been read again, so a second press before then builds on
 * the first rather than on what the screen was handed. A write refused, or
 * one that never comes back, lets go after a while and shows what is kept.
 */
function useAhead<T>(kept: T): [T, (next: T) => void] {
  const [ahead, setAhead] = useState<T | undefined>(undefined)
  const caughtUp = ahead !== undefined && JSON.stringify(ahead) === JSON.stringify(kept)
  useEffect(() => {
    if (caughtUp) setAhead(undefined)
  }, [caughtUp])
  useEffect(() => {
    if (ahead === undefined) return undefined
    const timer = setTimeout(() => setAhead(undefined), HELD_FOR)
    return () => clearTimeout(timer)
  }, [ahead])
  return [ahead ?? kept, setAhead]
}

const LEVEL_KEYS = ['0', '1', '2', '3', '4'] as const

/** What a key makes of a level: Space the next quarter, a digit that level. */
function levelFor(key: string, level: Level): Level {
  return key === ' ' ? nextLevel(level) : Number(key) as Level
}

/** The cell's menu: the five levels by name, the one it is on ticked, and what else the grid offers there. */
function levelMenu(words: Record<Level, StringKey>, level: Level, set: (level: Level) => void, t: ReturnType<typeof useStrings>['t'], more: readonly MenuEntry[] = []): MenuEntry[] {
  return [
    ...([0, 1, 2, 3, 4] as const).map((one) => ({ label: t(words[one]), checked: one === level, radio: true, onSelect: () => set(one) })),
    ...(more.length ? [{ line: true } as const, ...more] : []),
  ]
}

/** A capability's words, with the principle aspect it answers to. */
function useCapabilityLabel() {
  const access = useBlocks()
  return (capability: Capability) => {
    const said = capability.aspect ? access?.aspectLabel(capability.aspect) : undefined
    return said ? `${capability.text} (${said.label})` : capability.text
  }
}

/** The requirements: capabilities by usage context, each cell how much it is needed. */
export function RequirementsGrid({ block, onChange, rowEnd }: {
  block: BuildingBlock
  /** The block's contexts as they are to be; absent: read-only. */
  onChange?: (next: Pick<DesignElement, 'contexts'>) => void
  /** What may be done to a capability, at the end of its row. */
  rowEnd?: (capability: Capability) => ReactNode
}) {
  const { t } = useStrings()
  const labelOf = useCapabilityLabel()
  const [contexts, setContexts] = useAhead(block.contexts ?? [])
  const [selected, setSelected] = useState<MatrixPick | null>(null)
  const capabilities = block.capabilities ?? []
  const needAt = (pick: MatrixPick): Level => contexts.find((one) => one.id === pick.column)?.needs[pick.row] ?? 0
  const setNeed = (context: string, capability: string, level: Level) => {
    const next = contexts.map((one) => {
      if (one.id !== context) return one
      // Not needed is said by saying nothing (`UsageContext.needs`).
      const { [capability]: _was, ...rest } = one.needs
      void _was
      return { ...one, needs: level === 0 ? rest : { ...rest, [capability]: level } }
    })
    setContexts(next)
    onChange?.({ contexts: next })
  }
  return (
    <div className="guidance-grid" data-testid="requirements-grid">
      <Matrix
        label={t('blocks.requirements')} rowHeading={t('blocks.capability')} selected={selected} onSelect={setSelected}
        rows={capabilities.map((one) => ({ id: one.id, label: labelOf(one) }))}
        columns={contexts.map((one) => ({ id: one.id, label: one.name }))}
        cellOf={(row, column) => {
          const level = contexts.find((one) => one.id === column)?.needs[row] ?? 0
          return { show: <BallFigure level={level} />, meaning: t(NEED_WORD[level]) }
        }}
        {...(rowEnd ? { answer: { label: t('blocks.must'), of: (row: string) => { const one = capabilities.find((held) => held.id === row); return one ? rowEnd(one) : null } } } : {})}
        {...(onChange ? {
          keys: [' ', ...LEVEL_KEYS], hint: t('blocks.gridHint'),
          onKey: (pick: MatrixPick, key: string) => setNeed(pick.column, pick.row, levelFor(key, needAt(pick))),
          pressWrites: {
            step: (pick: MatrixPick, by: 1 | -1) => setNeed(pick.column, pick.row, nextLevel(needAt(pick), by)),
            menu: (pick: MatrixPick) => levelMenu(NEED_WORD, needAt(pick), (level) => setNeed(pick.column, pick.row, level), t),
          },
        } : {})}
      />
      {onChange && <p className="blocks-hint">{t('blocks.setBall')}</p>}
      <BallLegend />
    </div>
  )
}

const FIT_ROW = '\u0000fit'

/** What the fit row says of one option, and the sum behind it. */
function fitCell(fit: Fit, chosen: boolean, t: ReturnType<typeof useStrings>['t']) {
  const failed = fit.failsMust.length > 0
  const sum = t('blocks.fitSum', { covered: fit.covered, needed: fit.needed, terms: fit.terms.map((one) => `min(${one.coverage}, ${one.need})`).join(' + ') || '0' })
  return {
    show: chosen ? `${fitWord(fit, t)} ✓` : fitWord(fit, t), attention: failed,
    meaning: [sum, failed ? t('blocks.failsMustTip') : '', chosen ? t('blocks.chosen') : ''].filter(Boolean).join(' '),
  }
}

/** An option's fit in a word: its percentage, *fails a must*, or a dash where nothing is needed. */
export function fitWord(fit: Fit, t: ReturnType<typeof useStrings>['t']): string {
  if (fit.failsMust.length > 0) return t('blocks.failsMust')
  return fit.fit === undefined ? '—' : t('blocks.percent', { value: percent(fit.fit) })
}

/** What an option's column says at its top: its rank and its fit. */
function rankWord(option: OptionReading, t: ReturnType<typeof useStrings>['t']): string {
  return option.fit.failsMust.length > 0
    ? t('blocks.rankFails', { rank: option.rank })
    : t('blocks.rankFit', { rank: option.rank, fit: fitWord(option.fit, t) })
}

/**
 * A rating cell: its ball, *note* where one says how, and — where it falls short
 * of what is needed here — by how many quarters, so a gap is a figure and not a
 * tint alone; harder where that fails a must.
 */
function coverCell(cell: CellReading, need: Level, t: ReturnType<typeof useStrings>['t']): MatrixCell {
  const short = cell.short > 0
  return {
    show: <span className="guidance-ball__cell"><BallFigure level={cell.level} />{cell.how && t('blocks.note')}{short && <span className="blocks-short">−{cell.short}</span>}</span>,
    meaning: [
      [t(COVER_WORD[cell.level]), cell.how].filter(Boolean).join(': '),
      cell.failsMust ? t('blocks.shortOfMust') : short ? `${t('blocks.shortBy', { count: cell.short })} (${t(NEED_WORD[need])})` : '',
    ].filter(Boolean).join('; '),
    ...(cell.failsMust ? { attention: true } : short ? { short: true } : {}),
  }
}

/** Which capabilities the grid draws: the needed ones, or all where asked or where no context says what is needed; Gaps only, the rows an option falls short on. */
function shownCapabilities(reading: ComparisonReading, contexts: number, gapsOnly: boolean, all: boolean): readonly CapabilityReading[] {
  return reading.capabilities.filter((one) => (all || contexts === 0 || one.needed) && (!gapsOnly || !one.covered))
}

/** One scope's evaluation: what it needs, and how far each option covers it, the options in the order of their rank. */
export function EvaluationGrid({ block, evaluation: kept, onChange }: {
  block: BuildingBlock
  evaluation: Evaluation
  /** Absent: read-only. */
  onChange?: (next: Evaluation) => void
}) {
  const { t } = useStrings()
  const labelOf = useCapabilityLabel()
  const [note, setNote] = useState<MatrixPick | undefined>(undefined)
  const [selected, setSelected] = useState<MatrixPick | null>(null)
  const [gapsOnly, setGapsOnly] = useState(false)
  const [all, setAll] = useState(false)
  const [evaluation, setEvaluation] = useAhead(kept)
  const reading = readComparison(block, evaluation)
  const byId = new Map(reading.capabilities.map((one) => [one.capability.id, one]))
  const shown = shownCapabilities(reading, evaluation.contexts.length, gapsOnly, all)
  const notNeeded = evaluation.contexts.length === 0 ? 0 : reading.capabilities.filter((one) => !one.needed).length
  const setCoverage = (sbb: string, capability: string, patch: { level?: Level; how?: string | undefined }) => {
    const held = evaluation.coverage[sbb]?.[capability]
    const how = 'how' in patch ? patch.how : held?.how
    const next = { level: patch.level ?? held?.level ?? 0, ...(how ? { how } : {}) }
    const written = { ...evaluation, coverage: { ...evaluation.coverage, [sbb]: { ...evaluation.coverage[sbb], [capability]: next } } }
    setEvaluation(written)
    onChange?.(written)
  }
  /** Which of the scope's contexts asks the most of a capability: said with the need. */
  const needSaid = (capability: string, need: Level) => (need > 0
    ? t('blocks.neededBy', { contexts: contextsDriving(block, evaluation.contexts, capability).join(', ') })
    : t('blocks.notNeededHere'))
  const coverAt = (pick: MatrixPick): Level => evaluation.coverage[pick.column]?.[pick.row]?.level ?? 0
  const onKey = (pick: MatrixPick, key: string) => {
    if (pick.row === FIT_ROW) return
    if (key === 'n') { setNote(pick); return }
    setCoverage(pick.column, pick.row, { level: levelFor(key, coverAt(pick)) })
  }
  const pressWrites = {
    step: (pick: MatrixPick, by: 1 | -1) => { if (pick.row !== FIT_ROW) setCoverage(pick.column, pick.row, { level: nextLevel(coverAt(pick), by) }) },
    menu: (pick: MatrixPick) => (pick.row === FIT_ROW ? [] : levelMenu(
      COVER_WORD, coverAt(pick), (level) => setCoverage(pick.column, pick.row, { level }), t,
      [{ label: t('blocks.noteMenu'), onSelect: () => setNote(pick) }],
    )),
  }
  const rowLabel = (one: CapabilityReading) => [labelOf(one.capability), one.capability.must ? t('blocks.must') : '', one.needed || evaluation.contexts.length === 0 ? '' : t('blocks.notNeededRow')].filter(Boolean).join(' · ')
  return (
    <div className="guidance-grid" data-testid="evaluation-grid">
      <div className="blocks-gridBar">
        <Switch checked={gapsOnly} onChange={setGapsOnly} label={t('blocks.gapsOnly')} data-testid="evaluation-gaps" />
        {notNeeded > 0 && <Switch checked={all} onChange={setAll} label={t('blocks.showNotNeeded', { count: notNeeded })} data-testid="evaluation-all" />}
        {onChange && <span className="blocks-hint">{t('blocks.setBallNote')}</span>}
      </div>
      {gapsOnly && shown.length === 0 && reading.options.length > 0 && <p className="blocks-hint">{t('blocks.noGaps')}</p>}
      <Matrix
        label={t('blocks.evaluationGrid')} rowHeading={t('blocks.capability')} selected={selected} onSelect={setSelected}
        rows={[...shown.map((one) => ({ id: one.capability.id, label: rowLabel(one) })), { id: FIT_ROW, label: t('blocks.fitHere') }]}
        columns={reading.options.map((option) => ({
          id: option.sbb.id, label: [option.sbb.name, option.sbb.supplier, t(SORT_WORD[option.sbb.sort])].filter(Boolean).join(', '),
          under: <span className="blocks-rank" data-fails={option.fit.failsMust.length > 0 || undefined}>{rankWord(option, t)}</span>,
          ...(option.chosen ? { mark: <Mark kind="agree" label={t('blocks.chosen')} /> } : {}),
        }))}
        answer={{
          label: t('blocks.neededHere'),
          of: (row) => {
            if (row === FIT_ROW) return null
            const need = byId.get(row)?.need ?? 0
            return <span role="img" aria-label={`${t('blocks.neededHere')}: ${t(NEED_WORD[need])}. ${needSaid(row, need)}`} title={needSaid(row, need)}><BallFigure level={need} quiet /></span>
          },
        }}
        cellOf={(row, column) => {
          const option = reading.options.find((one) => one.sbb.id === column)
          if (row === FIT_ROW) return option ? fitCell(option.fit, option.chosen, t) : null
          const capability = byId.get(row)
          const cell = capability?.cells[column]
          return capability && cell ? coverCell(cell, capability.need, t) : null
        }}
        {...(onChange ? { keys: [' ', ...LEVEL_KEYS, 'n'], hint: t('blocks.gridHintNote'), onKey, pressWrites } : {})}
      />
      <BallLegend />
      <p className="blocks-hint">{t('blocks.fitExplains')}</p>
      {note && (
        <NoteDialog
          value={evaluation.coverage[note.column]?.[note.row]?.how ?? ''}
          onClose={() => setNote(undefined)}
          onSave={(how) => { setCoverage(note.column, note.row, { how: how || undefined }); setNote(undefined) }}
        />
      )}
    </div>
  )
}

function NoteDialog({ value, onClose, onSave }: { value: string; onClose: () => void; onSave: (how: string) => void }) {
  const { t } = useStrings()
  const [how, setHow] = useState(value)
  return (
    <Dialog
      open title={t('blocks.howTitle')} onClose={onClose}
      actions={{
        cancel: { onClick: onClose, label: t('common.cancel') },
        outcome: { onClick: () => onSave(how.trim()), label: t('blocks.save') },
      }}
    >
      <TextField autoFocus rows={2} label={t('blocks.note')} placeholder={t('blocks.howPlaceholder')} value={how} onChange={setHow} />
    </Dialog>
  )
}

/** What a solution's sort is called. */
export const SORT_WORD: Record<SolutionSort, StringKey> = {
  product: 'blocks.sortProduct', service: 'blocks.sortService', inHouse: 'blocks.sortInHouse',
}

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The two grids of a building block (ADR-0043), each the one Matrix: a press
 * selects and reading a row writes nothing; Space moves a ball on a quarter, a
 * digit sets it, and the line under the grid says what the cell means, in words.
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
import { drivenBy as contextsDriving, fitOf, needsOf, percent } from '../../model/evaluation'
import type { Evaluation, Fit } from '../../model/evaluation'
import type { BlockCapability as Capability, BlockLevel as Level, DesignElement, SolutionSort } from '../../model/types'
import { Button } from '../../widgets/kit/Button'
import { Dialog } from '../../widgets/kit/Dialog'
import { TextField } from '../../widgets/kit/Field'
import { Matrix } from '../../widgets/kit/Matrix'
import type { MatrixPick } from '../../widgets/kit/Matrix'
import { useBlocks } from './BlocksContext'
import { BallFigure, BallLegend } from './HarveyBall'

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
    <div data-testid="requirements-grid">
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
          onKey: (pick: MatrixPick, key: string) => setNeed(pick.column, pick.row, levelFor(key, contexts.find((one) => one.id === pick.column)?.needs[pick.row] ?? 0)),
        } : {})}
      />
      <BallLegend />
    </div>
  )
}

const FIT_ROW = '\u0000fit'

/** What the fit row says of one option, and the sum behind it. */
function fitCell(fit: Fit, chosen: boolean, t: ReturnType<typeof useStrings>['t']) {
  const failed = fit.failsMust.length > 0
  const sum = t('blocks.fitSum', { covered: fit.covered, needed: fit.needed, terms: fit.terms.map((one) => `min(${one.coverage}, ${one.need})`).join(' + ') || '0' })
  const word = fit.fit === undefined ? '—' : failed ? t('blocks.failsMust') : t('blocks.percent', { value: percent(fit.fit) })
  return {
    show: chosen ? `${word} ✓` : word, attention: failed,
    meaning: [sum, failed ? t('blocks.failsMustTip') : '', chosen ? t('blocks.chosen') : ''].filter(Boolean).join(' '),
  }
}

/** One scope's evaluation: what it needs, and how far each option covers it. */
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
  const [evaluation, setEvaluation] = useAhead(kept)
  const needs = needsOf(block, evaluation.contexts)
  const options = evaluation.options.map((id) => (block.sbbs ?? []).find((one) => one.id === id)).filter((one) => one !== undefined)
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
  const onKey = (pick: MatrixPick, key: string) => {
    if (pick.row === FIT_ROW) return
    if (key === 'n') { setNote(pick); return }
    setCoverage(pick.column, pick.row, { level: levelFor(key, evaluation.coverage[pick.column]?.[pick.row]?.level ?? 0) })
  }
  return (
    <div data-testid="evaluation-grid">
      <Matrix
        label={t('blocks.evaluationGrid')} rowHeading={t('blocks.capability')} selected={selected} onSelect={setSelected}
        rows={[...(block.capabilities ?? []).map((one) => ({ id: one.id, label: `${labelOf(one)}${one.must ? ` · ${t('blocks.must')}` : ''}` })), { id: FIT_ROW, label: t('blocks.fitHere') }]}
        columns={options.map((sbb) => ({ id: sbb.id, label: [sbb.name, sbb.supplier, t(SORT_WORD[sbb.sort])].filter(Boolean).join(', ') }))}
        answer={{
          label: t('blocks.neededHere'),
          of: (row) => {
            if (row === FIT_ROW) return null
            const need = needs[row] ?? 0
            return <span role="img" aria-label={`${t('blocks.neededHere')}: ${t(NEED_WORD[need])}. ${needSaid(row, need)}`} title={needSaid(row, need)}><BallFigure level={need} quiet /></span>
          },
        }}
        cellOf={(row, column) => {
          if (row === FIT_ROW) return fitCell(fitOf(block, evaluation, column), evaluation.chosen === column, t)
          const cell = evaluation.coverage[column]?.[row]
          const level = cell?.level ?? 0
          return {
            show: <span className="guidance-ball__cell"><BallFigure level={level} />{cell?.how && t('blocks.note')}</span>,
            meaning: [t(COVER_WORD[level]), cell?.how].filter(Boolean).join(': '),
          }
        }}
        {...(onChange ? { keys: [' ', ...LEVEL_KEYS, 'n'], hint: t('blocks.gridHintNote'), onKey } : {})}
      />
      <BallLegend />
      <p className="guidance-record__intro">{t('blocks.fitExplains')}</p>
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
      actions={(
        <>
          <Button variant="plain" onClick={onClose}>{t('common.cancel')}</Button>
          <Button variant="primary" onClick={() => onSave(how.trim())}>{t('blocks.save')}</Button>
        </>
      )}
    >
      <TextField autoFocus rows={2} label={t('blocks.note')} placeholder={t('blocks.howPlaceholder')} value={how} onChange={setHow} />
    </Dialog>
  )
}

/** What a solution's sort is called. */
export const SORT_WORD: Record<SolutionSort, StringKey> = {
  product: 'blocks.sortProduct', service: 'blocks.sortService', inHouse: 'blocks.sortInHouse',
}

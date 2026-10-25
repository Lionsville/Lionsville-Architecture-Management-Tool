// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The two grids of a building block (ADR-0043), each a ball per cell that
 * moves a quarter per click and per arrow key, and says on hover what it
 * means.
 *
 * - **The requirements**: the capabilities as rows, the usage contexts as
 *   columns, and in each cell how much that context needs that capability.
 *   A context's head opens its chapter in the block's document.
 * - **One scope's evaluation**: the capabilities as rows, then what this
 *   scope needs — the most its contexts need, read, not set — and then each
 *   solution it weighs with how far it covers each capability, a note on
 *   *how* per cell (⇧-click, or N), and the fit under it, the sum on hover.
 *
 * Read-only where no change is handed in: what a document's `ref` block and
 * a person who may not write draw.
 */
import { useEffect, useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Popover from '@mui/material/Popover'
import TextField from '@mui/material/TextField'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import type { StringKey } from '../../i18n'
import { useStrings } from '../../i18n/LanguageContext'
import { CloseIcon } from '../../widgets/icons'
import { drivenBy as contextsDriving, fitOf, needsOf, percent } from '../../model/evaluation'
import type { Evaluation, Fit } from '../../model/evaluation'
import type { BlockCapability as Capability, BlockLevel as Level, DesignElement, SolutionSort } from '../../model/types'
import { useBlocks } from './BlocksContext'
import { HarveyBall } from './HarveyBall'

/** A building block as the grids read it: its requirements and its catalogue. */
type BuildingBlock = Pick<DesignElement, 'id' | 'name' | 'capabilities' | 'contexts' | 'sbbs'>

const CELL = { borderBottom: 1, borderColor: 'divider', px: 1, py: 0.5, fontSize: 13 } as const
const BAND = { bgcolor: 'action.hover' } as const

/** What a need is called, a level each: on hover, beside the ball. */
export const NEED_WORD: Record<Level, StringKey> = {
  0: 'blocks.need0', 1: 'blocks.need1', 2: 'blocks.need2', 3: 'blocks.need3', 4: 'blocks.need4',
}

/** What a coverage is called, a level each. */
export const COVER_WORD: Record<Level, StringKey> = {
  0: 'blocks.cover0', 1: 'blocks.cover1', 2: 'blocks.cover2', 3: 'blocks.cover3', 4: 'blocks.cover4',
}

const QUARTERS = ['0', '¼', '½', '¾', '1'] as const

/** The hover of a ball: the two things it is between, what its level means, and how to change it. */
function Hint({ what, level, word, change }: { what: string; level: Level; word: string; change?: string }) {
  return (
    <Box sx={{ fontSize: 12 }}>
      <Box>{what}</Box>
      <Box sx={{ fontWeight: 700 }}>{word} ({QUARTERS[level]})</Box>
      {change && <Box sx={{ mt: 0.25, fontStyle: 'italic' }}>{change}</Box>}
    </Box>
  )
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

/** The requirements: capabilities by usage context, each cell how much it is needed. */
export function RequirementsGrid({ block, onChange, onChapter }: {
  block: BuildingBlock
  /** The block's contexts as they are to be; absent: read-only. */
  onChange?: (next: Pick<DesignElement, 'contexts'>) => void
  /** Open a context's chapter in the block's document. */
  onChapter?: (context: string) => void
}) {
  const { t } = useStrings()
  const readOnly = !onChange
  const [contexts, setContexts] = useAhead(block.contexts ?? [])
  const write = (next: DesignElement['contexts'] & object) => { setContexts(next); onChange?.({ contexts: next }) }
  const setNeed = (context: string, capability: string, level: Level) => write(contexts.map((one) => {
    if (one.id !== context) return one
    // Not needed is said by saying nothing (`UsageContext.needs`).
    const { [capability]: _was, ...rest } = one.needs
    void _was
    return { ...one, needs: level === 0 ? rest : { ...rest, [capability]: level } }
  }))
  return (
    <Box sx={{ overflowX: 'auto' }} data-testid="requirements-grid">
      <Box component="table" sx={{ borderCollapse: 'collapse', minWidth: 560, width: '100%' }}>
        <thead>
          <tr>
            <Box component="th" sx={{ ...CELL, textAlign: 'left', fontWeight: 600 }}>{t('blocks.capability')}</Box>
            {contexts.map((context) => (
              <Box component="th" key={context.id} sx={{ ...CELL, ...BAND, textAlign: 'center', fontWeight: 600, verticalAlign: 'bottom', maxWidth: 180 }}>
                <Tooltip title={context.description ? `${context.description} — ${t('blocks.chapterTip')}` : t('blocks.chapterTip')}>
                  {onChapter
                    ? <Link component="button" type="button" underline="hover" onClick={() => onChapter(context.id)} sx={{ fontSize: 12, fontWeight: 600 }} data-testid={`context-head-${context.id}`}>{context.name}</Link>
                    : <span>{context.name}</span>}
                </Tooltip>
              </Box>
            ))}
          </tr>
        </thead>
        <tbody>
          {(block.capabilities ?? []).map((capability) => (
            <tr key={capability.id} data-testid={`capability-${capability.id}`}>
              <Box component="td" sx={CELL}><CapabilityLabel capability={capability} /></Box>
              {contexts.map((context) => {
                const level = context.needs[capability.id] ?? 0
                return (
                  <Box component="td" key={context.id} sx={{ ...CELL, ...BAND, textAlign: 'center' }}>
                    <Box sx={{ display: 'inline-flex' }}>
                      <HarveyBall
                        level={level} readOnly={readOnly} tone="text.secondary"
                        label={t('blocks.needLabel', { capability: capability.text, context: context.name })}
                        hint={<Hint what={t('blocks.needHint', { capability: capability.text, context: context.name })} level={level} word={t(NEED_WORD[level])} {...(readOnly ? {} : { change: t('blocks.ballChange') })} />}
                        onChange={(next) => setNeed(context.id, capability.id, next)}
                      />
                    </Box>
                  </Box>
                )
              })}
            </tr>
          ))}
        </tbody>
      </Box>
    </Box>
  )
}

/** One scope's evaluation: what it needs, and how far each option covers it. */
export function EvaluationGrid({ block, evaluation: kept, onChange }: {
  block: BuildingBlock
  evaluation: Evaluation
  /** Absent: read-only. */
  onChange?: (next: Evaluation) => void
}) {
  const { t } = useStrings()
  const [note, setNote] = useState<{ anchor: HTMLElement; sbb: string; capability: string } | undefined>(undefined)
  const readOnly = !onChange
  const [evaluation, setEvaluation] = useAhead(kept)
  const needs = needsOf(block, evaluation.contexts)
  const options = evaluation.options.map((id) => (block.sbbs ?? []).find((one) => one.id === id)).filter((one) => one !== undefined)
  const usedContexts = (block.contexts ?? []).filter((one) => evaluation.contexts.includes(one.id))
  const setCoverage = (sbb: string, capability: string, patch: { level?: Level; how?: string | undefined }) => {
    const held = evaluation.coverage[sbb]?.[capability]
    const how = 'how' in patch ? patch.how : held?.how
    const next = { level: patch.level ?? held?.level ?? 0, ...(how ? { how } : {}) }
    const written = { ...evaluation, coverage: { ...evaluation.coverage, [sbb]: { ...evaluation.coverage[sbb], [capability]: next } } }
    setEvaluation(written)
    onChange?.(written)
  }
  /** Which of the scope's contexts asks the most of a capability: said on the need's hover. */
  const drivenBy = (capability: string) => contextsDriving(block, evaluation.contexts, capability).join(', ')
  return (
    <Box sx={{ overflowX: 'auto' }} data-testid="evaluation-grid">
      <Box component="table" sx={{ borderCollapse: 'collapse', minWidth: 560, width: '100%' }}>
        <thead>
          <tr>
            <Box component="th" sx={{ ...CELL, textAlign: 'left', fontWeight: 600 }}>{t('blocks.capability')}</Box>
            <Box component="th" sx={{ ...CELL, ...BAND, textAlign: 'center', fontWeight: 600 }}>
              <Tooltip title={t('blocks.neededHereTip', { contexts: usedContexts.map((one) => one.name).join(', ') || '—' })}><span>{t('blocks.neededHere')}</span></Tooltip>
            </Box>
            {options.map((sbb) => (
              <Box component="th" key={sbb.id} sx={{ ...CELL, textAlign: 'center', fontWeight: 500 }}>
                <Typography sx={{ fontSize: 12, fontWeight: 600 }}>{sbb.name}</Typography>
                <Typography sx={{ fontSize: 10, color: 'text.secondary' }}>{[sbb.supplier, t(SORT_WORD[sbb.sort])].filter(Boolean).join(' · ')}</Typography>
              </Box>
            ))}
          </tr>
        </thead>
        <tbody>
          {(block.capabilities ?? []).map((capability) => {
            const need = needs[capability.id] ?? 0
            return (
              <tr key={capability.id} data-testid={`capability-${capability.id}`}>
                <Box component="td" sx={{ ...CELL, color: need === 0 ? 'text.secondary' : 'text.primary' }}><CapabilityLabel capability={capability} /></Box>
                <Box component="td" sx={{ ...CELL, ...BAND, textAlign: 'center' }}>
                  <Box sx={{ display: 'inline-flex' }}>
                    <HarveyBall
                      level={need} readOnly tone="text.secondary" label={t('blocks.neededHere')}
                      hint={<Hint what={need > 0 ? t('blocks.neededBy', { contexts: drivenBy(capability.id) }) : t('blocks.notNeededHere')} level={need} word={t(NEED_WORD[need])} change={t('blocks.needSetOnBlock')} />}
                    />
                  </Box>
                </Box>
                {options.map((sbb) => {
                  const cell = evaluation.coverage[sbb.id]?.[capability.id]
                  const level = cell?.level ?? 0
                  const change = [cell?.how, readOnly ? '' : t('blocks.ballChangeNote')].filter(Boolean).join(' — ')
                  return (
                    <Box component="td" key={sbb.id} sx={{ ...CELL, textAlign: 'center' }}>
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', position: 'relative' }}>
                        <HarveyBall
                          level={level} readOnly={readOnly} {...(need === 0 ? { tone: 'text.secondary' } : {})}
                          label={t('blocks.coverageLabel', { capability: capability.text, sbb: sbb.name })}
                          hint={<Hint what={t('blocks.coverHint', { capability: capability.text, sbb: sbb.name })} level={level} word={t(COVER_WORD[level])} {...(change ? { change } : {})} />}
                          onChange={(next) => setCoverage(sbb.id, capability.id, { level: next })}
                          onNote={() => setNote({ anchor: document.activeElement as HTMLElement, sbb: sbb.id, capability: capability.id })}
                        />
                        {cell?.how && <Box aria-hidden sx={{ position: 'absolute', top: 2, right: -2, width: 5, height: 5, borderRadius: '50%', bgcolor: 'info.main' }} />}
                      </Box>
                    </Box>
                  )
                })}
              </tr>
            )
          })}
          <tr data-testid="fit-row">
            <Box component="td" sx={{ ...CELL, fontWeight: 600, fontSize: 12 }}>{t('blocks.fitHere')}</Box>
            <Box component="td" sx={{ ...CELL, ...BAND }} />
            {options.map((sbb) => <FitCell key={sbb.id} fit={fitOf(block, evaluation, sbb.id)} chosen={evaluation.chosen === sbb.id} />)}
          </tr>
        </tbody>
      </Box>
      {note && (
        <NotePopover
          anchor={note.anchor}
          value={evaluation.coverage[note.sbb]?.[note.capability]?.how ?? ''}
          onClose={() => setNote(undefined)}
          onSave={(how) => { setCoverage(note.sbb, note.capability, { how: how || undefined }); setNote(undefined) }}
        />
      )}
    </Box>
  )
}

/** A capability's words, with *must* and the principle aspect it answers to. */
function CapabilityLabel({ capability }: { capability: Capability }) {
  const access = useBlocks()
  const { t } = useStrings()
  const aspect = capability.aspect
  const said = aspect ? access?.aspectLabel(aspect) : undefined
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
      <span>{capability.text}</span>
      {aspect && (
        <Tooltip title={said?.title ?? ''}>
          <Chip size="small" variant="outlined" label={said?.label ?? `?.${aspect.number}`} sx={{ height: 18, fontSize: 10, fontFamily: 'ui-monospace, Menlo, monospace' }} />
        </Tooltip>
      )}
      {capability.must && <Tooltip title={t('blocks.mustTip')}><Chip size="small" label={t('blocks.must')} sx={{ height: 18, fontSize: 10 }} /></Tooltip>}
    </Box>
  )
}

function FitCell({ fit, chosen }: { fit: Fit; chosen: boolean }) {
  const { t } = useStrings()
  const failed = fit.failsMust.length > 0
  const sum = t('blocks.fitSum', {
    covered: fit.covered, needed: fit.needed,
    terms: fit.terms.map((one) => `min(${one.coverage}, ${one.need})`).join(' + ') || '0',
  })
  return (
    <Box component="td" sx={{ ...CELL, textAlign: 'center', fontVariantNumeric: 'tabular-nums', fontWeight: chosen ? 700 : 500, color: failed ? 'error.main' : 'text.primary' }}>
      <Tooltip title={<>{sum}{failed && <><br />{t('blocks.failsMustTip')}</>}</>}>
        <span>
          {fit.fit === undefined ? '—' : failed ? t('blocks.failsMust') : t('blocks.percent', { value: percent(fit.fit) })}
          {chosen && <Box component="span" sx={{ ml: 0.5, color: 'success.main' }} aria-label={t('blocks.chosen')}>✓</Box>}
        </span>
      </Tooltip>
    </Box>
  )
}

function NotePopover({ anchor, value, onClose, onSave }: { anchor: HTMLElement; value: string; onClose: () => void; onSave: (how: string) => void }) {
  const { t } = useStrings()
  const [how, setHow] = useState(value)
  return (
    <Popover open anchorEl={anchor} onClose={onClose} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
      <Box sx={{ p: 1.5, width: 300, display: 'grid', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center' }}>
          <Typography sx={{ fontSize: 13, fontWeight: 600, flex: 1 }}>{t('blocks.howTitle')}</Typography>
          <IconButton size="small" aria-label={t('common.close')} onClick={onClose}><CloseIcon size={14} /></IconButton>
        </Box>
        <TextField autoFocus size="small" multiline minRows={2} value={how} onChange={(event) => setHow(event.target.value)} placeholder={t('blocks.howPlaceholder')} />
        <Button size="small" variant="contained" onClick={() => onSave(how.trim())}>{t('blocks.save')}</Button>
      </Box>
    </Popover>
  )
}

/** What a solution's sort is called. */
export const SORT_WORD: Record<SolutionSort, StringKey> = {
  product: 'blocks.sortProduct', service: 'blocks.sortService', inHouse: 'blocks.sortInHouse',
}

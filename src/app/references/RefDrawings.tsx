// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * How each `ref` fence is drawn (ADR-0043 §10), from the model as it is now:
 * a principle as a quote with its number, which opens it; a building block's
 * requirements or a scope's evaluation as its grid, read-only, with the way
 * to it; a decision or an observation as a line. What is gone answers
 * nothing, and the fence says so. An evaluation pinned by `at:` is drawn as
 * it stood then where the history holds that revision, and otherwise as it
 * is now, saying it has changed since.
 */
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
import { useStrings } from '../../i18n/LanguageContext'
import type { Translate } from '../../i18n'
import { EvaluationGrid, RequirementsGrid } from '../../blocks/ui/EvaluationGrid'
import { STATUS_LABEL } from '../../decisions/adrScope'
import { formatAdrNumber } from '../../decisions/adr'
import { principleOfRef } from '../../documentation/references'
import type { RefFields } from '../../documentation/references'
import type { Adr } from '../../model/adr'
import type { Evaluation } from '../../model/evaluation'
import type { Observation } from '../../model/observation'
import { formatAspectNumber, formatPrincipleNumber } from '../../model/principle'
import type { Principle } from '../../model/principle'
import type { DesignElement } from '../../model/types'
import { formatObservationNumber } from '../../observations/observation'

/** What the drawings read and where their links go. */
export type RefReads = {
  principle(scope: string, id: string): Principle | undefined
  openPrinciple(scope: string, id: string): void
  block(id: string): { scope: string; block: DesignElement } | undefined
  evaluation(block: string, scope: string): Evaluation | undefined
  /** The block's page, on a scope's evaluation where one is named. */
  openBlock(block: string, scope?: string): void
  /** An evaluation as it stood at a revision of its scope; `changed` where the history does not hold that revision. */
  stoodAt?(scope: string, evaluation: Evaluation, at: string): Promise<Evaluation | 'changed' | 'same'>
  /** A decision and an observation of the open scope; absent where no scope's records are read, as on a home. */
  records?: {
    decision(id: string): Adr | undefined
    openDecision(id: string): void
    observation(id: string): Observation | undefined
    openObservation(id: string): void
  }
}

const FRAME = { borderLeft: 3, borderColor: 'divider', pl: 1.5 } as const

function PrincipleQuote({ scope, principle, aspect, reads }: { scope: string; principle: Principle; aspect: number | undefined; reads: RefReads }) {
  const said = aspect !== undefined ? principle.aspects.find((one) => one.number === aspect) : undefined
  return (
    <Box component="span" sx={{ ...FRAME, borderColor: 'primary.main', display: 'block' }}>
      <Link component="button" type="button" underline="hover" onClick={() => reads.openPrinciple(scope, principle.id)} sx={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: '0.85em' }}>
        {said ? formatAspectNumber(principle.number, said.number) : formatPrincipleNumber(principle.number)}
      </Link>{' '}
      <Box component="span" sx={{ fontWeight: 600 }}>{principle.title}</Box>
      <Box component="span" sx={{ display: 'block', fontStyle: 'italic' }}>{said ? said.text : principle.statement}</Box>
    </Box>
  )
}

/** A scope's evaluation, pinned or not, as its grid. */
function EvaluationRef({ block, scope, scopeName, evaluation, at, reads }: {
  block: DesignElement; scope: string; scopeName: string; evaluation: Evaluation; at: string | undefined; reads: RefReads
}) {
  const { t } = useStrings()
  const [stood, setStood] = useState<Evaluation | 'changed' | 'same' | undefined>(undefined)
  useEffect(() => {
    if (at === undefined || !reads.stoodAt) return undefined
    let live = true
    reads.stoodAt(scope, evaluation, at).then((answer) => { if (live) setStood(answer) }, () => { if (live) setStood('changed') })
    return () => { live = false }
  }, [at, reads, scope, evaluation])
  const shown = stood !== undefined && stood !== 'changed' && stood !== 'same' ? stood : evaluation
  return (
    <Box component="span" sx={{ display: 'block' }}>
      <EvaluationGrid block={block} evaluation={shown} />
      <Box component="span" sx={{ display: 'flex', gap: 1, mt: 0.5, fontSize: '0.8em', color: 'text.secondary' }}>
        <Box component="span" sx={{ flex: 1 }}>
          {t('refs.evaluationIn', { block: block.name, scope: scopeName })}
          {stood === 'changed' && ` · ${t('refs.changedSince')}`}
          {stood !== undefined && stood !== 'changed' && at !== undefined && ` · ${t('refs.asItStood')}`}
        </Box>
        <Link component="button" type="button" underline="hover" onClick={() => reads.openBlock(block.id, scope)} sx={{ fontSize: 'inherit' }} data-testid="ref-open-evaluation">{t('refs.openEvaluation')}</Link>
      </Box>
    </Box>
  )
}

function RecordLine({ label, status, onOpen, t }: { label: string; status?: string; onOpen: () => void; t: Translate }) {
  return (
    <Box component="span" sx={{ ...FRAME, display: 'flex', gap: 1, alignItems: 'baseline' }}>
      <Box component="span" sx={{ flex: 1 }}>{label}</Box>
      {status && <Box component="span" sx={{ fontSize: '0.8em', color: 'text.secondary' }}>{status}</Box>}
      <Link component="button" type="button" underline="hover" onClick={onOpen} sx={{ fontSize: '0.8em' }}>{t('refs.open')}</Link>
    </Box>
  )
}

/** A fence's drawing, or nothing where what it names is gone. */
export function drawRef(fields: RefFields, reads: RefReads, t: Translate, scopeName: (path: string) => string): ReactNode | undefined {
  if (fields.principle !== undefined) {
    const { scope, id } = principleOfRef(fields.principle)
    const principle = reads.principle(scope, id)
    const aspect = fields.aspect !== undefined ? Number(fields.aspect) : undefined
    if (!principle || (aspect !== undefined && !principle.aspects.some((one) => one.number === aspect))) return undefined
    return <PrincipleQuote scope={scope} principle={principle} aspect={aspect} reads={reads} />
  }
  if (fields.evaluation !== undefined) {
    const kept = reads.block(fields.evaluation)
    if (!kept) return undefined
    if (fields.scope === undefined) {
      return (
        <Box component="span" sx={{ display: 'block' }}>
          <RequirementsGrid block={kept.block} />
          <Link component="button" type="button" underline="hover" onClick={() => reads.openBlock(kept.block.id)} sx={{ fontSize: '0.8em' }}>{t('refs.openBlock', { name: kept.block.name })}</Link>
        </Box>
      )
    }
    const evaluation = reads.evaluation(kept.block.id, fields.scope)
    return evaluation ? <EvaluationRef block={kept.block} scope={fields.scope} scopeName={scopeName(fields.scope)} evaluation={evaluation} at={fields.at} reads={reads} /> : undefined
  }
  return recordRef(fields, reads, t)
}

/** A decision or an observation as a line; where no scope's records are read here, the reference as it is written. */
function recordRef(fields: RefFields, reads: RefReads, t: Translate): ReactNode | undefined {
  const { records } = reads
  const kind = fields.decision !== undefined ? 'decision' : fields.observation !== undefined ? 'observation' : undefined
  if (!kind) return undefined
  if (!records) return <Box component="span" sx={{ ...FRAME, display: 'block', color: 'text.secondary' }}>{t('refs.elsewhere', { what: `${kind}: ${fields[kind]}` })}</Box>
  if (kind === 'decision') {
    const decision = records.decision(fields.decision!)
    return decision ? <RecordLine label={`${formatAdrNumber(decision.number)} ${decision.title}`} status={t(STATUS_LABEL[decision.status])} onOpen={() => records.openDecision(decision.id)} t={t} /> : undefined
  }
  const observation = records.observation(fields.observation!)
  return observation ? <RecordLine label={`${formatObservationNumber(observation.number)} ${observation.title}`} onOpen={() => records.openObservation(observation.id)} t={t} /> : undefined
}


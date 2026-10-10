// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The Register tab (ADR-0021, ADR-0032 §2): this scope's observations, then —
 * while *View local* is on — those of each scope below under a heading each;
 * and the causes, the solutions and the experiments the same way, this
 * scope's first and each scope below's after them under its name. What it
 * lists is what the page hands it, the filters already applied: the register
 * decides how a row reads, not which rows there are.
 *
 * *Analysed into* is read in the observation's own scope: a record below is
 * analysed by its own scope's causes, and says so here.
 */
import { Fragment, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Checkbox from '@mui/material/Checkbox'
import Chip from '@mui/material/Chip'
import FormControlLabel from '@mui/material/FormControlLabel'
import List from '@mui/material/List'
import ListItemButton from '@mui/material/ListItemButton'
import ListItemText from '@mui/material/ListItemText'
import ListSubheader from '@mui/material/ListSubheader'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableHead from '@mui/material/TableHead'
import TableRow from '@mui/material/TableRow'
import Typography from '@mui/material/Typography'
import type { Language, Translate } from '../../i18n'
import { formatDay } from '../../i18n/dates'
import { nodeKey, pictureKey } from '../graph'
import { causeLabel, formatObservationNumber, isArchived, isCauseMerged, isRootCause, sortCauses } from '../observation'
import type { Cause, Observation, ObservationBelow, ScopeAnalysis } from '../observation'
import { IMPACT_COLOR, IMPACT_LABEL, OUTCOME_COLOR, OUTCOME_LABEL, PHASE_COLOR, PHASE_LABEL, STATE_COLOR, STATE_LABEL } from '../observationScope'
import { formatExperimentNumber, formatSolutionNumber, isLive, solutionPhase } from '../solution'
import type { Experiment, Solution, SolutionPhase } from '../solution'
import { experimentKey, solutionKey } from '../solutionGraph'
import { MergedNote } from './Readers'
import type { MergedInto } from './Readers'

export type ObservationRegisterProps = {
  own: readonly Observation[]
  /** The scopes below, each with its rows, in the order they are listed. */
  below: readonly (readonly [string, readonly ObservationBelow[]])[]
  causes: readonly Cause[]
  solutions: readonly Solution[]
  experiments: readonly Experiment[]
  /**
   * The causes, solutions and experiments of the scopes below, each scope's
   * already filtered (`recordsBelow`); none while View local is off.
   */
  analysisBelow: readonly ScopeAnalysis[]
  /** What the own section says when it lists nothing. */
  empty: ReactNode
  selectedKey?: string
  onSelect: (key: string) => void
  /** The causes an observation was analysed into, in its own scope and from over it: a label each, and its key. */
  analysedInto: (id: string, scope?: string) => readonly { key: string; label: string }[]
  mergedInto: (one: Observation) => MergedInto | undefined
  /** Where a cause went when it was merged (ADR-0035 §4): this scope's, or `scope`'s. */
  causeMergedInto?: (cause: Cause, scope?: string) => MergedInto | undefined
  phaseOf: (one: Solution) => SolutionPhase
  /** A record's label and title: this scope's, or `scope`'s. */
  nameOf: (id: string, scope?: string) => string
  scopeLabel: (path: string) => string
  showMerged: boolean
  onShowMerged: (show: boolean) => void
  showArchived: boolean
  onShowArchived: (show: boolean) => void
  language: Language
  s: Translate
}

export function ObservationRegister(props: ObservationRegisterProps) {
  const { s } = props
  const heading = (text: string) => (
    <TableRow>
      <TableCell colSpan={7} sx={{ bgcolor: 'background.default', py: 0.5, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'text.secondary' }}>{text}</TableCell>
    </TableRow>
  )
  const subheader = (text: string) => (
    <ListSubheader component="div" disableSticky sx={{ lineHeight: '32px', bgcolor: 'background.default' }}>{text}</ListSubheader>
  )
  const belowHeading = (scope: string) => (
    <ListSubheader component="div" disableSticky data-testid="register-below-heading" sx={{ lineHeight: '26px', bgcolor: 'background.paper', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', pl: 3 }}>
      {s('observation.fromBelow', { scope: props.scopeLabel(scope) })}
    </ListSubheader>
  )
  return (
    <Box data-testid="observation-register" data-guide="observations.register" sx={{ overflow: 'auto', minHeight: 0, minWidth: 0, bgcolor: 'background.paper' }}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', px: 1.5, py: 0.5, borderBottom: 1, borderColor: 'divider' }}>
        <FormControlLabel
          control={<Checkbox size="small" checked={props.showMerged} onChange={(event) => props.onShowMerged(event.target.checked)} />}
          label={<Typography sx={{ fontSize: 12 }}>{s('observation.showMerged')}</Typography>}
        />
        <FormControlLabel
          control={<Checkbox size="small" checked={props.showArchived} onChange={(event) => props.onShowArchived(event.target.checked)} />}
          label={<Typography sx={{ fontSize: 12 }}>{s('observation.showArchived')}</Typography>}
        />
      </Box>
      <Table size="small" stickyHeader>
        <TableHead>
          <TableRow>
            <TableCell>{s('observation.colNumber')}</TableCell>
            <TableCell>{s('observation.colTitle')}</TableCell>
            <TableCell>{s('observation.colDate')}</TableCell>
            <TableCell>{s('observation.colWhere')}</TableCell>
            <TableCell>{s('observation.colImpact')}</TableCell>
            <TableCell>{s('observation.colSeen')}</TableCell>
            <TableCell>{s('observation.colCauses')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {heading(s('observation.scopeHere'))}
          {props.own.map((one) => <ObservationRow key={one.id} one={one} {...props} />)}
          {props.own.length === 0 && (
            <TableRow><TableCell colSpan={7} sx={{ color: 'text.secondary' }} data-testid="observation-register-empty">{props.empty}</TableCell></TableRow>
          )}
          {props.below.map(([scope, held]) => (
            <Fragment key={scope}>
              {heading(s('observation.fromBelow', { scope: props.scopeLabel(scope) }))}
              {held.map((one) => <ObservationRow key={nodeKey(one.observation.id, one.scope)} one={one.observation} scope={one.scope} {...props} />)}
            </Fragment>
          ))}
        </TableBody>
      </Table>
      <List component="div" dense disablePadding data-testid="cause-list">
        {subheader(s('observation.causes'))}
        {props.causes.map((cause) => <CauseRow key={cause.id} cause={cause} rowKey={cause.id} merged={props.causeMergedInto?.(cause)} {...props} />)}
        {props.analysisBelow.filter((one) => one.causes.length > 0).map(({ scope, causes }) => (
          <Fragment key={scope}>
            {belowHeading(scope)}
            {causes.map((cause) => <CauseRow key={cause.id} cause={cause} rowKey={nodeKey(cause.id, scope)} merged={props.causeMergedInto?.(cause, scope)} {...props} />)}
          </Fragment>
        ))}
      </List>
      <List component="div" dense disablePadding data-testid="solution-list">
        {subheader(s('solution.solutions'))}
        {props.solutions.map((one) => <SolutionRow key={one.id} one={one} rowKey={solutionKey(one.id)} phase={props.phaseOf(one)} {...props} />)}
        {props.analysisBelow.filter((one) => one.solutions.length > 0).map(({ scope, solutions }) => (
          <Fragment key={scope}>
            {belowHeading(scope)}
            {solutions.map((one) => <SolutionRow key={one.id} one={one} rowKey={nodeKey(solutionKey(one.id), scope)} phase={solutionPhase(one, [])} {...props} />)}
          </Fragment>
        ))}
      </List>
      <List component="div" dense disablePadding data-testid="experiment-list">
        {subheader(s('solution.experiments'))}
        {props.experiments.map((one) => <ExperimentRow key={one.id} one={one} rowKey={experimentKey(one.id)} {...props} />)}
        {props.analysisBelow.filter((one) => one.experiments.length > 0).map(({ scope, experiments }) => (
          <Fragment key={scope}>
            {belowHeading(scope)}
            {experiments.map((one) => <ExperimentRow key={one.id} one={one} rowKey={nodeKey(experimentKey(one.id), scope)} scope={scope} {...props} />)}
          </Fragment>
        ))}
      </List>
    </Box>
  )
}

/** One observation's row: this scope's, or one of a scope below. */
function ObservationRow({ one, scope, ...props }: ObservationRegisterProps & { one: Observation; scope?: string }) {
  const { s } = props
  const key = nodeKey(one.id, scope)
  const into = props.analysedInto(one.id, scope)
  const merged = scope === undefined ? props.mergedInto(one) : undefined
  const archived = isArchived(one)
  return (
    <TableRow
      hover
      selected={key === props.selectedKey}
      onClick={() => props.onSelect(key)}
      sx={{ cursor: 'pointer', opacity: merged || archived ? 0.55 : 1 }}
      data-testid={`observation-row-${key}`}
      data-guide="observations.row"
      data-element-id={key}
    >
      <TableCell sx={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 11, color: 'text.secondary', whiteSpace: 'nowrap' }}>
        {formatObservationNumber(one.number)}
      </TableCell>
      <TableCell sx={{ fontWeight: 600 }}>
        {one.title}
        {archived && <Chip size="small" variant="outlined" label={s('observation.archivedMark')} sx={{ height: 18, fontSize: 10, ml: 1 }} />}
      </TableCell>
      <TableCell sx={{ whiteSpace: 'nowrap', fontSize: 12 }}>{formatDay(one.date, props.language)}</TableCell>
      <TableCell sx={{ fontSize: 12 }}>{one.where ?? ''}</TableCell>
      <TableCell><Chip size="small" color={IMPACT_COLOR[one.impact]} label={s(IMPACT_LABEL[one.impact])} sx={{ height: 18, fontSize: 10 }} /></TableCell>
      <TableCell sx={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{s('observation.seenTimes', { count: one.seen })}</TableCell>
      <TableCell sx={{ fontSize: 12 }}>
        {merged
          ? <Typography variant="caption" color="text.secondary"><MergedNote merged={merged} s={s} day={(date) => formatDay(date, props.language)} /></Typography>
          : into.length
            ? into.map((cause) => <Chip key={cause.key} size="small" variant="outlined" label={cause.label} sx={{ height: 18, fontSize: 10, mr: 0.5 }} onClick={(event) => { event.stopPropagation(); props.onSelect(cause.key) }} />)
            : <Typography variant="caption" color="text.secondary">{s('observation.notAnalysed')}</Typography>}
      </TableCell>
    </TableRow>
  )
}

const SMALL = { primary: { sx: { fontSize: 13 } } }

type RowProps = ObservationRegisterProps & { rowKey: string }

/** One cause; a merged one dimmed, saying where it went (ADR-0035 §4). */
function CauseRow({ cause, rowKey, merged, selectedKey, onSelect, language, s }: RowProps & { cause: Cause; merged: MergedInto | undefined }) {
  return (
    <ListItemButton selected={rowKey === selectedKey} onClick={() => onSelect(rowKey)} sx={{ py: 0.5, opacity: merged ? 0.55 : 1 }} data-testid={`cause-row-${rowKey}`} data-element-id={rowKey}>
      {/* Said, not a link: the row is the button, and a button in a button is reached by nobody's keyboard. */}
      <ListItemText
        primary={`${causeLabel(cause)} ${cause.title}`}
        {...(merged ? { secondary: <MergedNote merged={{ ...merged, open: undefined }} s={s} day={(date) => formatDay(date, language)} /> } : {})}
        slotProps={{ ...SMALL, secondary: { sx: { fontSize: 11 } } }}
      />
      {isRootCause(cause) && <Chip size="small" variant="outlined" color="secondary" label={s('observation.rootCause')} sx={{ height: 18, fontSize: 10, mr: 1 }} />}
      <Chip size="small" color={STATE_COLOR[cause.state]} label={s(STATE_LABEL[cause.state])} sx={{ height: 18, fontSize: 10 }} />
    </ListItemButton>
  )
}

function SolutionRow({ one, rowKey, phase, selectedKey, onSelect, s }: RowProps & { one: Solution; phase: SolutionPhase }) {
  return (
    <ListItemButton selected={rowKey === selectedKey} onClick={() => onSelect(rowKey)} sx={{ py: 0.5, opacity: isLive(one) ? 1 : 0.55 }} data-testid={`solution-row-${rowKey}`} data-element-id={rowKey}>
      <ListItemText primary={`${formatSolutionNumber(one.number)} ${one.title}`} slotProps={SMALL} />
      <Chip size="small" color={PHASE_COLOR[phase]} label={s(PHASE_LABEL[phase])} sx={{ height: 18, fontSize: 10 }} />
    </ListItemButton>
  )
}

function ExperimentRow({ one, rowKey, scope, selectedKey, onSelect, nameOf, s }: RowProps & { one: Experiment; scope?: string }) {
  return (
    <ListItemButton selected={rowKey === selectedKey} onClick={() => onSelect(rowKey)} sx={{ py: 0.5 }} data-element-id={rowKey}>
      <ListItemText primary={`${formatExperimentNumber(one.number)} ${one.title}`} secondary={one.tests.map((id) => nameOf(id, scope)).join(', ')} slotProps={{ ...SMALL, secondary: { sx: { fontSize: 11 } } }} />
      <Chip size="small" color={OUTCOME_COLOR[one.outcome]} label={s(OUTCOME_LABEL[one.outcome])} sx={{ height: 18, fontSize: 10 }} data-testid={`experiment-row-outcome-${one.id}`} />
    </ListItemButton>
  )
}

/**
 * The records of the scopes below as the register lists them: what the
 * filters left of each scope's causes, solutions and experiments — a dropped
 * solution only where archived records are shown, as here — and none while
 * View local is off.
 */
export function recordsBelow(
  below: readonly ScopeAnalysis[], here: string, viewLocal: boolean, shows: (key: string) => boolean, showArchived: boolean,
  showMerged = false,
): ScopeAnalysis[] {
  if (!viewLocal) return []
  return below.map((one) => {
    const keep = (key: string) => shows(pictureKey(here, one.scope, key))
    return {
      ...one,
      observations: [],
      causes: sortCauses(one.causes).filter((cause) => (showMerged || !isCauseMerged(one.causes, cause.id)) && keep(cause.id)),
      solutions: [...one.solutions].sort((a, b) => b.number - a.number).filter((held) => (showArchived || isLive(held)) && keep(solutionKey(held.id))),
      experiments: [...one.experiments].sort((a, b) => b.number - a.number).filter((held) => keep(experimentKey(held.id))),
    }
  })
}

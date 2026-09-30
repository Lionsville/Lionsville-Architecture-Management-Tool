// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The Register tab (ADR-0021, ADR-0032 §2): this scope's observations, then —
 * while *View local* is on — those of each scope below under a heading each,
 * then this scope's causes, solutions and experiments. What it lists is what
 * the page hands it, the filters already applied: the register decides how a
 * row reads, not which rows there are.
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
import { nodeKey } from '../graph'
import { causeLabel, formatObservationNumber, isArchived, isRootCause } from '../observation'
import type { Cause, Observation, ObservationBelow } from '../observation'
import { IMPACT_COLOR, IMPACT_LABEL, OUTCOME_COLOR, OUTCOME_LABEL, PHASE_COLOR, PHASE_LABEL, STATE_COLOR, STATE_LABEL } from '../observationScope'
import { formatExperimentNumber, formatSolutionNumber, isLive } from '../solution'
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
  /** What the own section says when it lists nothing. */
  empty: ReactNode
  selectedKey?: string
  onSelect: (key: string) => void
  explainedBy: (id: string, scope?: string) => Cause[]
  mergedInto: (one: Observation) => MergedInto | undefined
  phaseOf: (one: Solution) => SolutionPhase
  nameOf: (id: string) => string
  scopeLabel: (path: string) => string
  showMerged: boolean
  onShowMerged: (show: boolean) => void
  showArchived: boolean
  onShowArchived: (show: boolean) => void
  language: Language
  s: Translate
}

export function ObservationRegister(props: ObservationRegisterProps) {
  const { s, selectedKey, onSelect } = props
  const heading = (text: string) => (
    <TableRow>
      <TableCell colSpan={7} sx={{ bgcolor: 'background.default', py: 0.5, fontSize: 11, textTransform: 'uppercase', letterSpacing: '.05em', color: 'text.secondary' }}>{text}</TableCell>
    </TableRow>
  )
  const subheader = (text: string) => (
    <ListSubheader component="div" disableSticky sx={{ lineHeight: '32px', bgcolor: 'background.default' }}>{text}</ListSubheader>
  )
  const small = { primary: { sx: { fontSize: 13 } } }
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
        {props.causes.map((cause) => (
          <ListItemButton key={cause.id} selected={cause.id === selectedKey} onClick={() => onSelect(cause.id)} sx={{ py: 0.5 }}>
            <ListItemText primary={`${causeLabel(cause)} ${cause.title}`} slotProps={small} />
            {isRootCause(cause) && <Chip size="small" variant="outlined" color="secondary" label={s('observation.rootCause')} sx={{ height: 18, fontSize: 10, mr: 1 }} />}
            <Chip size="small" color={STATE_COLOR[cause.state]} label={s(STATE_LABEL[cause.state])} sx={{ height: 18, fontSize: 10 }} />
          </ListItemButton>
        ))}
      </List>
      <List component="div" dense disablePadding data-testid="solution-list">
        {subheader(s('solution.solutions'))}
        {props.solutions.map((one) => {
          const phase = props.phaseOf(one)
          return (
            <ListItemButton key={one.id} selected={solutionKey(one.id) === selectedKey} onClick={() => onSelect(solutionKey(one.id))} sx={{ py: 0.5, opacity: isLive(one) ? 1 : 0.55 }}>
              <ListItemText primary={`${formatSolutionNumber(one.number)} ${one.title}`} slotProps={small} />
              <Chip size="small" color={PHASE_COLOR[phase]} label={s(PHASE_LABEL[phase])} sx={{ height: 18, fontSize: 10 }} />
            </ListItemButton>
          )
        })}
      </List>
      <List component="div" dense disablePadding data-testid="experiment-list">
        {subheader(s('solution.experiments'))}
        {props.experiments.map((one) => (
          <ListItemButton key={one.id} selected={experimentKey(one.id) === selectedKey} onClick={() => onSelect(experimentKey(one.id))} sx={{ py: 0.5 }}>
            <ListItemText primary={`${formatExperimentNumber(one.number)} ${one.title}`} secondary={one.tests.map((id) => props.nameOf(id)).join(', ')} slotProps={{ ...small, secondary: { sx: { fontSize: 11 } } }} />
            <Chip size="small" color={OUTCOME_COLOR[one.outcome]} label={s(OUTCOME_LABEL[one.outcome])} sx={{ height: 18, fontSize: 10 }} data-testid={`experiment-row-outcome-${one.id}`} />
          </ListItemButton>
        ))}
      </List>
    </Box>
  )
}

/** One observation's row: this scope's, or one of a scope below. */
function ObservationRow({ one, scope, ...props }: ObservationRegisterProps & { one: Observation; scope?: string }) {
  const { s } = props
  const key = nodeKey(one.id, scope)
  const into = props.explainedBy(one.id, scope)
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
            ? into.map((cause) => <Chip key={cause.id} size="small" variant="outlined" label={causeLabel(cause)} sx={{ height: 18, fontSize: 10, mr: 0.5 }} onClick={(event) => { event.stopPropagation(); props.onSelect(cause.id) }} />)
            : <Typography variant="caption" color="text.secondary">{s('observation.notAnalysed')}</Typography>}
      </TableCell>
    </TableRow>
  )
}

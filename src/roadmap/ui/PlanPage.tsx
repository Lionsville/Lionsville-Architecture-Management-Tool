/**
 * One plan, as a page (ADR-0010).
 *
 * The sibling of the decision page, and laid out the same way a person reads a
 * plan: the facts down the left — status, window, owner, what it introduces
 * and retires with the dates on those, the milestones, the decisions it rests
 * on — and the document on the right, with its source beside it while it is
 * being written. The business case is a fence in that document and renders
 * where it is typed.
 *
 * The page writes nothing itself. Every change is an action the caller turns
 * into a command, so a plan edited here is one undo step and one Activity line
 * like a plan edited anywhere else. The dates on an element the plan
 * introduces or retires are the element's own (ADR-0009); this page is where
 * they are set together, and it says so by writing them through a separate
 * action rather than into the plan.
 *
 * A fullscreen dialog, and it takes `windowChrome` for the reason the others
 * do: the shell toolbar's drag strip stays live underneath it.
 */
import { useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import IconButton from '@mui/material/IconButton'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import {
  DATED_PHASES, TRANSITION_STATUSES, elementsWithRole, portsOf, transitionLabel, transitionStatusesFrom,
} from '../../model'
import type {
  DesignElement, DesignModel, ElementId, LifecycleDates, Port, Transition, TransitionRole,
  TransitionStatus,
} from '../../model'
import type { Adr } from '../../model/adr'
import { formatAdrNumber } from '../../decisions'
import type { MarkdownRenderOptions } from '../../documentation'
import { useStrings } from '../../i18n'
import type { StringKey } from '../../i18n'
import { NO_WINDOW_CHROME } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import { ConfirmDialog } from '../../widgets/ConfirmDialog'
import { BackIcon } from '../../widgets/icons'

const STATUS_LABEL: Record<TransitionStatus, StringKey> = {
  draft: 'plan.draft',
  agreed: 'plan.agreed',
  running: 'plan.running',
  done: 'plan.done',
  abandoned: 'plan.abandoned',
}

const ROLES: readonly TransitionRole[] = ['introduces', 'retires', 'changes']

export type PlanActions = {
  updateTransition(id: string, patch: Partial<Transition>): void
  removeTransition(id: string): void
  /** Move a plan and the dates it owns by a number of days, as one step. */
  shiftTransition(id: string, days: number): void
  /** The dates on an element the plan names; they are the element's own. */
  updateElementDates(id: ElementId, dates: LifecycleDates | undefined): void
  /** Move one interface — the line with this id — onto an introduced element on a day. */
  port(planId: string, connectionId: string, toId: ElementId, on: string): void
  /** Every interface not yet planned, onto one element on one day, as one step. */
  portAll(planId: string, toId: ElementId, on: string): void
  /** Take a port back: the twin goes and the original is open-ended again. */
  unport(planId: string, connectionId: string): void
  /** Show an element on the canvas. */
  onOpenElement(id: ElementId): void
  /** Open a decision record the plan rests on. */
  onOpenDecision?(id: string): void
}

export type PlanPageProps = {
  open: boolean
  /** Absent while the page is closing, or when the plan was deleted under it. */
  plan: Transition | undefined
  model: DesignModel
  /** The project's decision records, for the list of what the plan rests on. */
  decisions?: readonly Adr[]
  /** The day "now" is, so a port whose day has come reads as done. */
  today: string
  readOnly: boolean
  actions: PlanActions
  renderMarkdown?(md: string, options?: MarkdownRenderOptions): ReactNode
  onClose(): void
  windowChrome?: WindowChrome
}

export function PlanPage(props: PlanPageProps) {
  const { plan, model, readOnly, actions } = props
  const { t } = useStrings()
  const chrome = props.windowChrome ?? NO_WINDOW_CHROME
  const [mode, setMode] = useState<'read' | 'edit'>('read')
  const [deleting, setDeleting] = useState(false)
  const editing = mode === 'edit' && !readOnly

  return (
    <Dialog
      open={props.open}
      fullScreen
      onClose={props.onClose}
      aria-label={t('plan.page')}
      slotProps={{ paper: { sx: { bgcolor: 'background.default', display: 'flex', flexDirection: 'column' } } }}
    >
      <Box
        data-testid="plan-topbar"
        sx={{
          display: 'flex', alignItems: 'center', gap: 1, px: 1.5, minHeight: 48, flexShrink: 0,
          pl: `${12 + chrome.controlsInset}px`,
          WebkitAppRegion: chrome.draggable ? 'drag' : undefined,
          '& button, & a, & input': { WebkitAppRegion: 'no-drag' },
          borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper',
        }}
      >
        <Tooltip title={t('plan.close')}>
          <IconButton size="small" aria-label={t('plan.close')} onClick={props.onClose}>
            <BackIcon />
          </IconButton>
        </Tooltip>
        {plan && (
          <Typography sx={{ fontSize: 13, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            <Box component="span" sx={{ color: 'text.secondary', fontFamily: 'ui-monospace, Menlo, monospace', mr: 1 }}>
              {transitionLabel(plan)}
            </Box>
            <Box component="span" sx={{ fontWeight: 700 }}>{plan.title}</Box>
          </Typography>
        )}
        <Box sx={{ flex: 1 }} />
        {!readOnly && plan && (
          <>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={mode}
              onChange={(_event, next: 'read' | 'edit' | null) => { if (next) setMode(next) }}
            >
              <ToggleButton value="read" sx={{ px: 1.5, py: 0.25, fontSize: 12 }}>{t('plan.read')}</ToggleButton>
              <ToggleButton value="edit" sx={{ px: 1.5, py: 0.25, fontSize: 12 }}>{t('plan.edit')}</ToggleButton>
            </ToggleButtonGroup>
            <Button size="small" color="error" onClick={() => setDeleting(true)}>{t('roadmap.delete')}</Button>
          </>
        )}
      </Box>

      {plan && (
        <Box sx={{ display: 'grid', gridTemplateColumns: '480px minmax(0, 1fr)', flex: 1, minHeight: 0 }}>
          <Facts plan={plan} model={model} decisions={props.decisions ?? []} readOnly={readOnly} actions={actions} />
          <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'auto' }}>
            <Interfaces plan={plan} model={model} today={props.today} readOnly={readOnly} actions={actions} />
            <Body plan={plan} editing={editing} renderMarkdown={props.renderMarkdown} onChange={(body) => actions.updateTransition(plan.id, { body })} />
          </Box>
        </Box>
      )}

      <ConfirmDialog
        open={deleting}
        title={plan ? t('roadmap.deleteConfirm', { name: plan.title }) : ''}
        body=""
        confirmLabel={t('roadmap.delete')}
        cancelLabel={t('common.cancel')}
        onCancel={() => setDeleting(false)}
        onConfirm={() => {
          if (plan) actions.removeTransition(plan.id)
          setDeleting(false)
          props.onClose()
        }}
      />
    </Dialog>
  )
}

/** A section heading in the facts column. */
function Heading({ children }: { children: ReactNode }) {
  return (
    <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', mt: 1 }}>{children}</Typography>
  )
}

function Facts({ plan, model, decisions, readOnly, actions }: {
  plan: Transition
  model: DesignModel
  decisions: readonly Adr[]
  readOnly: boolean
  actions: PlanActions
}) {
  const { t } = useStrings()
  const set = (patch: Partial<Transition>) => actions.updateTransition(plan.id, patch)
  const byId = new Map(model.elements.map((element) => [element.id, element]))
  const [shiftBy, setShiftBy] = useState('')
  const [adding, setAdding] = useState<{ elementId: string; role: TransitionRole }>({ elementId: '', role: 'introduces' })
  const [addingDecision, setAddingDecision] = useState('')
  const days = Number(shiftBy)

  const named = new Set(plan.elements.map((one) => one.elementId))
  const candidates = model.elements
    .filter((element) => !named.has(element.id))
    .sort((a, b) => a.name.localeCompare(b.name))
  const restsOn = new Set(plan.decisions)
  const decisionCandidates = decisions.filter((adr) => !restsOn.has(adr.id))

  const setElements = (elements: Transition['elements']) => set({ elements })
  const setMilestones = (milestones: Transition['milestones']) => set({ milestones })

  return (
    <Box sx={{ borderRight: 1, borderColor: 'divider', bgcolor: 'background.paper', overflow: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
      <TextField
        size="small" label={t('common.name')} value={plan.title} disabled={readOnly}
        onChange={(e) => set({ title: e.target.value })}
      />
      <TextField
        size="small" select label={t('roadmap.status')} value={plan.status} disabled={readOnly}
        slotProps={{ htmlInput: { 'aria-label': t('roadmap.status') } }}
        onChange={(e) => set({ status: e.target.value as TransitionStatus })}
      >
        {TRANSITION_STATUSES
          // Only where the machine allows, plus where it already is.
          .filter((status) => status === plan.status || transitionStatusesFrom(plan.status).includes(status))
          .map((status) => (
            <MenuItem key={status} value={status}>{t(STATUS_LABEL[status])}</MenuItem>
          ))}
      </TextField>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          type="date" size="small" fullWidth label={t('roadmap.planFrom')}
          value={plan.from ?? ''} disabled={readOnly}
          slotProps={{ inputLabel: { shrink: true } }}
          onChange={(e) => set({ from: e.target.value || undefined })}
        />
        <TextField
          type="date" size="small" fullWidth label={t('roadmap.planTo')}
          value={plan.to ?? ''} disabled={readOnly}
          slotProps={{ inputLabel: { shrink: true } }}
          onChange={(e) => set({ to: e.target.value || undefined })}
        />
      </Box>
      <TextField
        size="small" label={t('roadmap.owner')} value={plan.owner ?? ''} disabled={readOnly}
        onChange={(e) => set({ owner: e.target.value || undefined })}
      />

      {/* ---- what it changes, with the dates on what it introduces and retires ---- */}
      <Heading>{t('roadmap.touches')}</Heading>
      {plan.elements.length === 0 && (
        <Typography variant="body2" color="text.secondary">{t('plan.noElements')}</Typography>
      )}
      {plan.elements.map((one, index) => {
        const element = byId.get(one.elementId)
        return (
          <Box key={one.elementId} data-testid={`plan-element-${one.elementId}`} sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TextField
                select size="small" value={one.role} disabled={readOnly} sx={{ width: 130 }}
                slotProps={{ htmlInput: { 'aria-label': t('plan.role') } }}
                onChange={(e) => setElements(plan.elements.map((row, at) => (
                  at === index ? { ...row, role: e.target.value as TransitionRole } : row
                )))}
              >
                {ROLES.map((role) => <MenuItem key={role} value={role}>{t(`plan.${role}` as StringKey)}</MenuItem>)}
              </TextField>
              <Typography
                sx={{ fontSize: 13, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
                onClick={() => actions.onOpenElement(one.elementId)}
              >
                {element?.name ?? one.elementId}
              </Typography>
              {!readOnly && (
                <Button size="small" onClick={() => setElements(plan.elements.filter((_row, at) => at !== index))}>
                  {t('plan.remove')}
                </Button>
              )}
            </Box>
            {element && one.role !== 'changes' && (
              <ElementDates element={element} readOnly={readOnly} onChange={(dates) => actions.updateElementDates(element.id, dates)} />
            )}
          </Box>
        )
      })}
      {!readOnly && candidates.length > 0 && (
        <Box data-testid="plan-add-element" sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            select size="small" label={t('plan.addElement')} value={adding.elementId} sx={{ flex: 1 }}
            slotProps={{ htmlInput: { 'aria-label': t('plan.addElement') } }}
            onChange={(e) => setAdding((a) => ({ ...a, elementId: e.target.value }))}
          >
            {candidates.map((element) => <MenuItem key={element.id} value={element.id}>{element.name}</MenuItem>)}
          </TextField>
          <TextField
            select size="small" value={adding.role} sx={{ width: 130 }}
            slotProps={{ htmlInput: { 'aria-label': t('plan.role') } }}
            onChange={(e) => setAdding((a) => ({ ...a, role: e.target.value as TransitionRole }))}
          >
            {ROLES.map((role) => <MenuItem key={role} value={role}>{t(`plan.${role}` as StringKey)}</MenuItem>)}
          </TextField>
          <Button
            size="small" disabled={!adding.elementId}
            onClick={() => {
              setElements([...plan.elements, { elementId: adding.elementId, role: adding.role }])
              setAdding((a) => ({ ...a, elementId: '' }))
            }}
          >
            {t('plan.add')}
          </Button>
        </Box>
      )}

      {/* ---- milestones ---- */}
      <Heading>{t('roadmap.milestones')}</Heading>
      {plan.milestones.length === 0 && (
        <Typography variant="body2" color="text.secondary">{t('plan.noMilestones')}</Typography>
      )}
      {plan.milestones.map((milestone, index) => (
        <Box key={index} data-testid="plan-milestone" sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            type="date" size="small" value={milestone.date} disabled={readOnly} sx={{ width: 150 }}
            slotProps={{ htmlInput: { 'aria-label': t('plan.milestoneDate') } }}
            onChange={(e) => setMilestones(plan.milestones.map((row, at) => (at === index ? { ...row, date: e.target.value } : row)))}
          />
          <TextField
            size="small" value={milestone.name} disabled={readOnly} sx={{ flex: 1 }}
            slotProps={{ htmlInput: { 'aria-label': t('plan.milestoneName') } }}
            onChange={(e) => setMilestones(plan.milestones.map((row, at) => (at === index ? { ...row, name: e.target.value } : row)))}
          />
          {!readOnly && (
            <Button size="small" onClick={() => setMilestones(plan.milestones.filter((_row, at) => at !== index))}>
              {t('plan.remove')}
            </Button>
          )}
        </Box>
      ))}
      {!readOnly && (
        <Button
          size="small" sx={{ alignSelf: 'flex-start' }}
          onClick={() => setMilestones([...plan.milestones, { date: plan.to ?? plan.from ?? '', name: '' }])}
        >
          + {t('plan.milestoneName')}
        </Button>
      )}

      {/* ---- the decisions it rests on ---- */}
      <Heading>{t('roadmap.restsOn')}</Heading>
      {plan.decisions.length === 0 && (
        <Typography variant="body2" color="text.secondary">{t('plan.noDecisions')}</Typography>
      )}
      {plan.decisions.map((id) => {
        const adr = decisions.find((one) => one.id === id)
        return (
          <Box key={id} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <Typography
              sx={{ fontSize: 13, flex: 1, cursor: actions.onOpenDecision ? 'pointer' : undefined }}
              onClick={() => actions.onOpenDecision?.(id)}
            >
              {adr ? `${formatAdrNumber(adr.number)} ${adr.title}` : id}
            </Typography>
            {!readOnly && (
              <Button size="small" onClick={() => set({ decisions: plan.decisions.filter((one) => one !== id) })}>
                {t('plan.remove')}
              </Button>
            )}
          </Box>
        )
      })}
      {!readOnly && decisionCandidates.length > 0 && (
        <Box data-testid="plan-add-decision" sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            select size="small" label={t('plan.decision')} value={addingDecision} sx={{ flex: 1 }}
            slotProps={{ htmlInput: { 'aria-label': t('plan.decision') } }}
            onChange={(e) => setAddingDecision(e.target.value)}
          >
            {decisionCandidates.map((adr) => (
              <MenuItem key={adr.id} value={adr.id}>{formatAdrNumber(adr.number)} {adr.title}</MenuItem>
            ))}
          </TextField>
          <Button
            size="small" disabled={!addingDecision}
            onClick={() => { set({ decisions: [...plan.decisions, addingDecision] }); setAddingDecision('') }}
          >
            {t('plan.add')}
          </Button>
        </Box>
      )}

      {/* ---- moving the whole thing ---- */}
      {!readOnly && (
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', mt: 1 }}>
          <TextField
            size="small" type="number" label={t('roadmap.shiftDays')} value={shiftBy}
            onChange={(e) => setShiftBy(e.target.value)}
            helperText={t('roadmap.shiftHelp')}
          />
          <Button
            size="small"
            disabled={!Number.isFinite(days) || days === 0}
            onClick={() => { actions.shiftTransition(plan.id, days); setShiftBy('') }}
          >
            {t('roadmap.shift')}
          </Button>
        </Box>
      )}
    </Box>
  )
}

/** The three dates on an element the plan introduces or retires. */
function ElementDates({ element, readOnly, onChange }: {
  element: DesignElement
  readOnly: boolean
  onChange(dates: LifecycleDates | undefined): void
}) {
  const { t } = useStrings()
  return (
    <Box sx={{ display: 'flex', gap: 1 }}>
      {DATED_PHASES.map((phase) => (
        <TextField
          key={phase}
          type="date" size="small" fullWidth
          label={t(`plan.date.${phase}` as StringKey)}
          value={element.lifecycleDates?.[phase] ?? ''}
          disabled={readOnly}
          slotProps={{ inputLabel: { shrink: true }, htmlInput: { 'aria-label': `${element.name}: ${t(`plan.date.${phase}` as StringKey)}` } }}
          onChange={(e) => {
            const next = { ...element.lifecycleDates }
            if (e.target.value) next[phase] = e.target.value
            else delete next[phase]
            onChange(Object.keys(next).length ? next : undefined)
          }}
        />
      ))}
    </Box>
  )
}

/**
 * The port table: one row per line on an element the plan moves from, with
 * where it goes and when. Derived from the lines themselves (`model/porting`),
 * so a port written anywhere — here, by the agent, by hand in the inspector —
 * shows here, and the table doubles as the status of the migration without a
 * status field anywhere.
 */
function Interfaces({ plan, model, today, readOnly, actions }: {
  plan: Transition
  model: DesignModel
  today: string
  readOnly: boolean
  actions: PlanActions
}) {
  const { t } = useStrings()
  const ports = portsOf(model, plan)
  const targets = elementsWithRole(plan, 'introduces')
  const byId = new Map(model.elements.map((element) => [element.id, element]))
  const name = (id: ElementId) => byId.get(id)?.name ?? id
  // Where a port goes when there is only one place it can: preselected, so a
  // one-for-one replacement asks for a day and nothing else.
  const only = targets.length === 1 ? targets[0] : undefined
  const [allTo, setAllTo] = useState<string>(only ?? '')
  const [allOn, setAllOn] = useState<string>(plan.to ?? '')
  const [choice, setChoice] = useState<Record<string, string>>({})
  const targetFor = (port: Port) => port.to?.[endOf(port)] ?? choice[port.from.id] ?? only ?? ''
  const remaining = ports.filter((port) => port.on === undefined)

  if (ports.length === 0) {
    return (
      <Box sx={{ px: 3, pt: 2 }}>
        <Heading>{t('plan.interfaces')}</Heading>
        <Typography variant="body2" color="text.secondary">{t('plan.noInterfaces')}</Typography>
      </Box>
    )
  }

  const arrow = (port: Port) => (port.from.isBidirectional ? '↔' : port.from.sourceId === port.fromElementId ? '→' : '←')
  // What a row is called, for the fields in it: the counterpart and the label,
  // because two lines to the same counterpart are two rows.
  const rowName = (port: Port) => (port.from.label ? `${name(port.counterpartId)} · ${port.from.label}` : name(port.counterpartId))
  const status = (port: Port) => (
    port.on === undefined ? t('plan.notPlanned') : port.on <= today ? t('plan.ported') : t('plan.planned')
  )

  return (
    <Box sx={{ px: 3, pt: 2, borderBottom: 1, borderColor: 'divider' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Heading>{t('plan.interfaces')}</Heading>
        <Typography variant="caption" color="text.secondary">
          {t('roadmap.planPorted', { done: String(ports.length - remaining.length), total: String(ports.length) })}
        </Typography>
        <Box sx={{ flex: 1 }} />
        {!readOnly && remaining.length > 0 && (
          <>
            {targets.length > 1 && (
              <TextField
                select size="small" value={allTo} sx={{ width: 180 }} label={t('plan.movesTo')}
                slotProps={{ htmlInput: { 'aria-label': t('plan.movesTo') } }}
                onChange={(e) => setAllTo(e.target.value)}
              >
                {targets.map((id) => <MenuItem key={id} value={id}>{name(id)}</MenuItem>)}
              </TextField>
            )}
            <TextField
              type="date" size="small" value={allOn} sx={{ width: 160 }} label={t('plan.on')}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { 'aria-label': `${t('plan.portAll')}: ${t('plan.on')}` } }}
              onChange={(e) => setAllOn(e.target.value)}
            />
            <Button
              size="small" variant="outlined" disabled={!allTo || !allOn}
              onClick={() => actions.portAll(plan.id, allTo, allOn)}
            >
              {t('plan.portAll')}
            </Button>
          </>
        )}
      </Box>
      <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse', my: 1, fontSize: 13, '& td, & th': { py: 0.5, pr: 1.5, textAlign: 'left', verticalAlign: 'middle' }, '& th': { fontSize: 11, color: 'text.secondary', fontWeight: 700 } }}>
        <thead>
          <tr>
            <th>{t('plan.counterpart')}</th>
            <th />
            <th>{t('plan.protocol')}</th>
            <th>{t('plan.movesTo')}</th>
            <th>{t('plan.on')}</th>
            <th>{t('roadmap.status')}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {ports.map((port) => (
            <tr key={port.from.id} data-testid={`port-${port.from.id}`}>
              <td>{rowName(port)}</td>
              <td>{arrow(port)}</td>
              <td>{port.from.protocol ?? ''}</td>
              <td>
                {targets.length > 1 ? (
                  <TextField
                    select size="small" variant="standard" value={targetFor(port)} disabled={readOnly}
                    slotProps={{ htmlInput: { 'aria-label': `${rowName(port)}: ${t('plan.movesTo')}` } }}
                    onChange={(e) => {
                      setChoice((c) => ({ ...c, [port.from.id]: e.target.value }))
                      if (port.on) actions.port(plan.id, port.from.id, e.target.value, port.on)
                    }}
                  >
                    {targets.map((id) => <MenuItem key={id} value={id}>{name(id)}</MenuItem>)}
                  </TextField>
                ) : name(targets[0])}
              </td>
              <td>
                <TextField
                  type="date" size="small" variant="standard" value={port.on ?? ''} disabled={readOnly || !targetFor(port)}
                  slotProps={{ htmlInput: { 'aria-label': `${rowName(port)}: ${t('plan.on')}` } }}
                  onChange={(e) => {
                    if (e.target.value) actions.port(plan.id, port.from.id, targetFor(port), e.target.value)
                    else if (port.to) actions.unport(plan.id, port.from.id)
                  }}
                />
              </td>
              <td>{status(port)}</td>
              <td>
                {/* Only a dated twin was written as a port. An undated line that
                    happens to match is somebody's drawing, and not ours to delete. */}
                {!readOnly && port.to && port.on && (
                  <Button size="small" onClick={() => actions.unport(plan.id, port.from.id)}>{t('plan.unport')}</Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Box>
    </Box>
  )
}

/** Which end of the twin is the introduced element: the same end the original leaves from. */
function endOf(port: Port): 'sourceId' | 'targetId' {
  return port.from.sourceId === port.fromElementId ? 'sourceId' : 'targetId'
}

/** The document, and its source beside it while it is being written. */
function Body({ plan, editing, renderMarkdown, onChange }: {
  plan: Transition
  editing: boolean
  renderMarkdown?(md: string, options?: MarkdownRenderOptions): ReactNode
  onChange(body: string): void
}) {
  const { t } = useStrings()
  const rendered = plan.body.trim()
    ? (renderMarkdown ? renderMarkdown(plan.body) : <pre style={{ whiteSpace: 'pre-wrap' }}>{plan.body}</pre>)
    : <Typography color="text.secondary">{t('plan.bodyEmpty')}</Typography>

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: editing ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr)', minHeight: 0 }}>
      {editing && (
        <Box
          component="textarea"
          aria-label={t('plan.source')}
          value={plan.body}
          spellCheck={false}
          onChange={(e: { target: { value: string } }) => onChange(e.target.value)}
          sx={{
            minHeight: 0, resize: 'none', border: 0, outline: 'none', p: 2,
            borderRight: 1, borderColor: 'divider',
            bgcolor: 'background.paper', color: 'text.primary',
            font: '13px/1.6 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', tabSize: 2,
          }}
        />
      )}
      <Box sx={{ overflow: 'auto', minHeight: 0 }}>
        <Box sx={{ maxWidth: 820, mx: 'auto', px: editing ? 3 : 5, py: 3.5, fontSize: 14 }}>
          {rendered}
        </Box>
      </Box>
    </Box>
  )
}

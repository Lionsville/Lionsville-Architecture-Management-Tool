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
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import Switch from '@mui/material/Switch'
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
import { linkElementRefs } from '../../documentation/documentation'
import type { MarkdownRenderOptions } from '../../documentation'
import { DocumentSheet } from '../../documentation/ui/DocumentSheet'
import { DocumentSource } from '../../documentation/ui/DocumentSource'
import type { DocumentImages } from '../../documentation/ui/DocumentSource'
import { useStrings } from '../../i18n'
import type { StringKey } from '../../i18n'
import { NO_WINDOW_CHROME, barChromeFor } from '../../platform/windowChrome'
import type { WindowChrome } from '../../platform/windowChrome'
import { ConfirmDialog } from '../../widgets/ConfirmDialog'
import { BackIcon } from '../../widgets/icons'
import { PageDialog } from '../../widgets/PageDialog'
import { PLAN_STATUS_LABEL as STATUS_LABEL } from '../labels'

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
  /** A picture into the project, and the project's pictures (ADR-0009). */
  onAddImage?(file: File): Promise<string | undefined>
  images?: DocumentImages
  onClose(): void
  windowChrome?: WindowChrome
  /**
   * Offer the initiative switch (ADR-0012 §7): this scope has scopes above
   * it whose roadmaps could follow the plan. The organisation itself has
   * none, and the switch would promise a roadmap that is not there.
   */
  initiativeToggle?: boolean
}

export function PlanPage(props: PlanPageProps) {
  const { plan, model, readOnly, actions } = props
  const { t } = useStrings()
  const chrome = props.windowChrome ?? NO_WINDOW_CHROME
  const bar = barChromeFor(chrome)
  const [mode, setMode] = useState<'read' | 'edit'>('read')
  const [deleting, setDeleting] = useState(false)
  // The document alone, the facts and the interfaces out of the way. On by
  // default while writing, because writing wants the room; a click brings the
  // facts back without leaving edit.
  const [fullPage, setFullPage] = useState(false)
  const [interfacesHeight, setInterfacesHeight] = useState(INTERFACES_DEFAULT_HEIGHT)
  const editing = mode === 'edit' && !readOnly
  const switchMode = (next: 'read' | 'edit') => {
    setMode(next)
    setFullPage(next === 'edit')
  }

  return (
    <PageDialog
      open={props.open}
      topInset={chrome.topInset}
      onClose={props.onClose}
      aria-label={t('plan.page')}
    >
      <Box
        data-testid="plan-topbar"
        sx={{
          display: 'flex', alignItems: 'center', gap: 1, px: 1.5, minHeight: 48, flexShrink: 0,
          pl: `${12 + bar.controlsInset}px`,
          WebkitAppRegion: bar.draggable ? 'drag' : undefined,
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
        {plan && (
          <Button size="small" onClick={() => setFullPage((on) => !on)}>
            {fullPage ? t('plan.showFacts') : t('plan.fullPage')}
          </Button>
        )}
        {!readOnly && plan && (
          <>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={mode}
              onChange={(_event, next: 'read' | 'edit' | null) => { if (next) switchMode(next) }}
            >
              <ToggleButton value="read" sx={{ px: 1.5, py: 0.25, fontSize: 12 }}>{t('plan.read')}</ToggleButton>
              <ToggleButton value="edit" sx={{ px: 1.5, py: 0.25, fontSize: 12 }}>{t('plan.edit')}</ToggleButton>
            </ToggleButtonGroup>
            <Button size="small" color="error" onClick={() => setDeleting(true)}>{t('roadmap.delete')}</Button>
          </>
        )}
      </Box>

      {plan && (
        <Box sx={{ display: 'grid', gridTemplateColumns: fullPage ? 'minmax(0, 1fr)' : '480px minmax(0, 1fr)', flex: 1, minHeight: 0 }}>
          {!fullPage && (
            <Facts plan={plan} model={model} decisions={props.decisions ?? []} readOnly={readOnly} actions={actions} initiativeToggle={props.initiativeToggle === true} />
          )}
          {/* The table scrolls inside a height of its own, dragged from the
              seam under it, so a plan with forty interfaces still leaves the
              document room — and none of it while the document is full page. */}
          <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {!fullPage && (
              <>
                <Interfaces plan={plan} model={model} today={props.today} readOnly={readOnly} actions={actions} height={interfacesHeight} />
                <SeamResizer height={interfacesHeight} onHeight={setInterfacesHeight} label={t('plan.resizeInterfaces')} />
              </>
            )}
            <Body
              plan={plan}
              model={model}
              editing={editing}
              onOpenElement={actions.onOpenElement}
              renderMarkdown={props.renderMarkdown}
              onAddImage={props.onAddImage}
              images={props.images}
              onChange={(body) => actions.updateTransition(plan.id, { body })}
            />
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
    </PageDialog>
  )
}

/** A section heading in the facts column. */
function Heading({ children }: { children: ReactNode }) {
  return (
    <Typography sx={{ fontSize: 11, fontWeight: 700, color: 'text.secondary', mt: 1 }}>{children}</Typography>
  )
}

function Facts({ plan, model, decisions, readOnly, actions, initiativeToggle }: {
  plan: Transition
  model: DesignModel
  decisions: readonly Adr[]
  readOnly: boolean
  actions: PlanActions
  initiativeToggle: boolean
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
      {initiativeToggle && (
        <Tooltip title={t('roadmap.initiativeHelp')} placement="right">
          <FormControlLabel
            sx={{ ml: 0 }}
            control={(
              <Switch
                size="small"
                checked={plan.initiative === true}
                disabled={readOnly}
                onChange={(e) => set({ initiative: e.target.checked ? true : undefined })}
                slotProps={{ input: { 'aria-label': t('roadmap.initiative') } }}
              />
            )}
            label={<Typography sx={{ fontSize: 13 }}>{t('roadmap.initiative')}</Typography>}
          />
        </Tooltip>
      )}

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

const INTERFACES_DEFAULT_HEIGHT = 320
const INTERFACES_MIN_HEIGHT = 80

/**
 * The seam between the interfaces and the document, dragged up or down.
 *
 * Its own six pixels rather than the editor's `PanelResizer`, which this
 * module may not import; the same idea — drag off the height the gesture
 * started at, arrow keys for the keyboard, double-click to put it back.
 */
function SeamResizer({ height, onHeight, label }: { height: number; onHeight(next: number): void; label: string }) {
  const start = useRef({ y: 0, height })
  const clamp = (next: number) => Math.max(INTERFACES_MIN_HEIGHT, Math.min(next, Math.max(INTERFACES_MIN_HEIGHT, window.innerHeight - 200)))
  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    start.current = { y: event.clientY, height }
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [height])
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    onHeight(clamp(start.current.height + (event.clientY - start.current.y)))
  }
  return (
    <Box
      role="separator"
      aria-orientation="horizontal"
      aria-label={label}
      aria-valuenow={Math.round(height)}
      aria-valuemin={INTERFACES_MIN_HEIGHT}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onDoubleClick={() => onHeight(INTERFACES_DEFAULT_HEIGHT)}
      onKeyDown={(event) => {
        if (event.key === 'ArrowUp') { event.preventDefault(); onHeight(clamp(height - 24)) }
        if (event.key === 'ArrowDown') { event.preventDefault(); onHeight(clamp(height + 24)) }
      }}
      sx={{
        height: 6, flexShrink: 0, cursor: 'row-resize', bgcolor: 'divider',
        '&:hover, &:focus-visible': { bgcolor: 'primary.main', outline: 'none' },
      }}
    />
  )
}

/**
 * The port table: one row per line on an element the plan moves from, with
 * where it goes and when. Derived from the lines themselves (`model/porting`),
 * so a port written anywhere — here, by the agent, by hand in the inspector —
 * shows here, and the table doubles as the status of the migration without a
 * status field anywhere.
 */
function Interfaces({ plan, model, today, readOnly, actions, height }: {
  plan: Transition
  model: DesignModel
  today: string
  readOnly: boolean
  actions: PlanActions
  /** How tall the list may be, in px; the seam under it moves this. */
  height: number
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
      <Box sx={{ px: 3, pt: 1.5, pb: 1, flexShrink: 0 }}>
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
    <Box sx={{ display: 'flex', flexDirection: 'column', maxHeight: height, flexShrink: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', px: 3, pt: 1.5, pb: 0.5 }}>
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
      <Box sx={{ overflow: 'auto', minHeight: 0, px: 3, pb: 1 }}>
      <Box
        component="table"
        sx={{
          width: '100%', borderCollapse: 'collapse', fontSize: 12, lineHeight: 1.3,
          '& td, & th': { py: 0.25, pr: 1.5, textAlign: 'left', verticalAlign: 'middle' },
          '& th': { fontSize: 11, color: 'text.secondary', fontWeight: 700, position: 'sticky', top: 0, bgcolor: 'background.default', zIndex: 1 },
          '& tr + tr td': { borderTop: 1, borderColor: 'divider' },
          '& input': { fontSize: 12, py: 0.25 },
          '& .MuiSelect-select': { fontSize: 12, py: 0.25 },
        }}
      >
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
                  <Button size="small" sx={{ whiteSpace: 'nowrap', py: 0, minWidth: 0 }} onClick={() => actions.unport(plan.id, port.from.id)}>
                    {t('plan.unport')}
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Box>
      </Box>
    </Box>
  )
}

/** Which end of the twin is the introduced element: the same end the original leaves from. */
function endOf(port: Port): 'sourceId' | 'targetId' {
  return port.from.sourceId === port.fromElementId ? 'sourceId' : 'targetId'
}

/** The document, and its source beside it while it is being written. */
function Body({ plan, model, editing, renderMarkdown, onAddImage, images, onChange, onOpenElement }: {
  plan: Transition
  model: DesignModel
  editing: boolean
  onOpenElement(id: ElementId): void
  renderMarkdown?(md: string, options?: MarkdownRenderOptions): ReactNode
  onAddImage?(file: File): Promise<string | undefined>
  images?: DocumentImages
  onChange(body: string): void
}) {
  const { t } = useStrings()
  // The rendered document beside the source, which a wide table wants out of the way.
  const [previewShown, setPreviewShown] = useState(true)
  const showPreview = !editing || previewShown
  // `[[Name]]` becomes a link to the element, as it does on the other two
  // pages that read markdown; a plan that names what it changes should say so.
  const source = useMemo(() => linkElementRefs(plan.body, model.elements), [plan.body, model.elements])
  const rendered = source.trim()
    ? (renderMarkdown ? renderMarkdown(source, { onElementLink: onOpenElement }) : <pre style={{ whiteSpace: 'pre-wrap' }}>{source}</pre>)
    : <Typography color="text.secondary">{t('plan.bodyEmpty')}</Typography>

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: editing && showPreview ? 'minmax(0, 1fr) minmax(0, 1fr)' : 'minmax(0, 1fr)', minHeight: 0, flex: 1 }}>
      {editing && (
        <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, borderRight: 1, borderColor: 'divider' }}>
          <DocumentSource
            value={plan.body}
            onChange={onChange}
            label={t('plan.source')}
            onAddImage={onAddImage}
            images={images}
            preview={{ shown: previewShown, onToggle: () => setPreviewShown((on) => !on) }}
          />
        </Box>
      )}
      {showPreview && (
        <DocumentSheet dense={editing}>
          <Box sx={{ fontSize: 14 }} data-document>{rendered}</Box>
        </DocumentSheet>
      )}
    </Box>
  )
}

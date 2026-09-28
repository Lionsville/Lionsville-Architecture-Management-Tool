// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Three fields of a plan's facts that each carry a rule of their own
 * (ADR-0009, amended 28 September 2026): the status, with the gate on each
 * forward move; the window, which is not written backwards; and naming an
 * element, grouped by kind, with only what has a dated lifecycle introduced
 * or retired.
 *
 * Apart from `PlanPage.tsx` so the facts column stays a list of fields: each
 * of these writes through the one patch it is handed and holds no more state
 * than what is being typed.
 */
import { useState } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ListSubheader from '@mui/material/ListSubheader'
import MenuItem from '@mui/material/MenuItem'
import TextField from '@mui/material/TextField'
import Typography from '@mui/material/Typography'
import { TRANSITION_STATUSES, portsOf, transitionStatusesFrom, unplannedPorts } from '../../model'
import type { DesignModel, Transition, TransitionRole, TransitionStatus } from '../../model'
import type { Adr } from '../../model/adr'
import { ELEMENT_KINDS, KIND_LABEL_KEYS } from '../../model/kinds'
import { openPlanItems, planGate, statusPatch } from '../../model/transition'
import type { PlanGate, PlanGateItem } from '../../model/transition'
import type { ElementKind } from '../../model/types'
import { useStrings } from '../../i18n'
import type { StringKey } from '../../i18n'
import { PLAN_STATUS_LABEL as STATUS_LABEL } from '../labels'

export const ROLES: readonly TransitionRole[] = ['introduces', 'retires', 'changes']

/**
 * The kinds a plan can bring in or take out: the ones whose lifecycle is
 * dated on the roadmap — systems and the technology under them. A capability
 * or a journey step is changed by a plan, never introduced or retired by one.
 */
const DATED_KINDS: ReadonlySet<ElementKind> = new Set<ElementKind>(['application', 'component', 'platform', 'platformService'])

/** Applications first, because that is what a plan is usually about; then the rest in the model's order. */
const KIND_ORDER: readonly ElementKind[] = ['application', ...ELEMENT_KINDS.filter((kind) => kind !== 'application')]

/** Each line of a plan's gate, in the words the page says it in. */
const GATE_LABEL: Record<PlanGateItem, StringKey> = {
  window: 'plan.gate.window',
  owner: 'plan.gate.owner',
  names: 'plan.gate.names',
  decisions: 'plan.gate.decisions',
  started: 'plan.gate.started',
  introducedLive: 'plan.gate.introducedLive',
  retiredDated: 'plan.gate.retiredDated',
  interfacesPorted: 'plan.gate.interfacesPorted',
}

/**
 * A select with no visible label, named twice: the field, and the list it
 * opens — which MUI names from the label, so without one it opens nameless.
 */
export function namedSelect(name: string) {
  return {
    htmlInput: { 'aria-label': name },
    select: { MenuProps: { slotProps: { list: { 'aria-label': name } } } },
  }
}

/**
 * The gate on every move the select offers, by the status it leads to. Only
 * the forward moves have one; the rest are always open (ADR-0009).
 */
function gatesFor(plan: Transition, model: DesignModel, decisions: readonly Adr[], today: string): Map<TransitionStatus, PlanGate> {
  const byId = new Map(model.elements.map((element) => [element.id, element]))
  const gates = new Map<TransitionStatus, PlanGate>()
  for (const to of transitionStatusesFrom(plan.status)) {
    const gate = planGate(plan, to, {
      decisions,
      element: (id) => byId.get(id),
      unported: () => unplannedPorts(portsOf(model, plan)).length,
      today,
    })
    if (gate) gates.set(to, gate)
  }
  return gates
}

/**
 * The status, offering only where the machine allows and greying out a move
 * whose gate is not clear, with what each gate still waits for under it. The
 * day a plan is done is written with the move, and cleared when it is reopened.
 */
export function StatusField({ plan, model, decisions, today, readOnly, set }: {
  plan: Transition
  model: DesignModel
  /** Every record the plan may rest on: this scope's and those above. */
  decisions: readonly Adr[]
  today: string
  readOnly: boolean
  set: (patch: Partial<Transition>) => void
}) {
  const { t } = useStrings()
  const gates = gatesFor(plan, model, decisions, today)
  return (
    <>
      <TextField
        size="small" select label={t('roadmap.status')} value={plan.status} disabled={readOnly}
        slotProps={{ htmlInput: { 'aria-label': t('roadmap.status') } }}
        onChange={(e) => set(statusPatch(plan, e.target.value as TransitionStatus, today))}
      >
        {TRANSITION_STATUSES
          .filter((status) => status === plan.status || transitionStatusesFrom(plan.status).includes(status))
          .map((status) => (
            <MenuItem key={status} value={status} disabled={openPlanItems(gates.get(status)).length > 0}>
              {t(STATUS_LABEL[status])}
            </MenuItem>
          ))}
      </TextField>
      {!readOnly && [...gates.values()].map((gate) => (
        <Box key={gate.to} data-testid={`plan-gate-${gate.to}`} sx={{ display: 'flex', flexDirection: 'column', gap: 0.25, mt: -0.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
            {t('plan.gateTitle', { status: t(STATUS_LABEL[gate.to]) })}
          </Typography>
          {gate.items.map(({ item, ok }) => (
            <Typography
              key={item}
              variant="caption"
              data-gate-item={item}
              data-ok={ok ? 'true' : 'false'}
              sx={{ color: ok ? 'success.main' : 'text.secondary' }}
            >
              {ok ? '✓' : '○'} {t(GATE_LABEL[item])}
            </Typography>
          ))}
        </Box>
      ))}
    </>
  )
}

/**
 * From and To. A window typed backwards is not written: it stays on screen as
 * it was, and the field says why.
 */
export function WindowFields({ plan, readOnly, set }: {
  plan: Transition
  readOnly: boolean
  set: (patch: Partial<Transition>) => void
}) {
  const { t } = useStrings()
  const [backwards, setBackwards] = useState(false)
  const setWindow = (patch: Pick<Transition, 'from'> | Pick<Transition, 'to'>) => {
    const from = 'from' in patch ? patch.from : plan.from
    const to = 'to' in patch ? patch.to : plan.to
    if (from && to && to < from) { setBackwards(true); return }
    setBackwards(false)
    set(patch)
  }
  const wrong = backwards || Boolean(plan.from && plan.to && plan.to < plan.from)
  return (
    <Box sx={{ display: 'flex', gap: 1 }}>
      <TextField
        type="date" size="small" fullWidth label={t('roadmap.planFrom')}
        value={plan.from ?? ''} disabled={readOnly}
        slotProps={{ inputLabel: { shrink: true } }}
        onChange={(e) => setWindow({ from: e.target.value || undefined })}
      />
      <TextField
        type="date" size="small" fullWidth label={t('roadmap.planTo')}
        value={plan.to ?? ''} disabled={readOnly}
        error={wrong}
        helperText={wrong ? t('plan.windowBackwards') : undefined}
        slotProps={{ inputLabel: { shrink: true } }}
        onChange={(e) => setWindow({ to: e.target.value || undefined })}
      />
    </Box>
  )
}

/**
 * Naming one more element, with its role. Grouped by kind, applications first:
 * "Billing" the application and "Billing" the capability are two different
 * things to retire. Introduced and retired only where a lifecycle is dated;
 * changed, anything. Nothing is drawn when there is nothing left to name.
 */
export function AddElement({ plan, model, onAdd }: {
  plan: Transition
  model: DesignModel
  onAdd: (row: Transition['elements'][number]) => void
}) {
  const { t } = useStrings()
  const [adding, setAdding] = useState<{ elementId: string; role: TransitionRole }>({ elementId: '', role: 'introduces' })
  const byId = new Map(model.elements.map((element) => [element.id, element]))
  const named = new Set(plan.elements.map((one) => one.elementId))
  const candidates = model.elements
    .filter((element) => !named.has(element.id))
    .filter((element) => adding.role === 'changes' || DATED_KINDS.has(element.kind))
    .sort((a, b) => a.name.localeCompare(b.name))
  if (candidates.length === 0) return null
  const groups = KIND_ORDER
    .map((kind) => ({ kind, elements: candidates.filter((element) => element.kind === kind) }))
    .filter((group) => group.elements.length > 0)
  // A role that cannot hold the element picked lets go of it.
  const chooseRole = (role: TransitionRole) => setAdding((a) => {
    const picked = byId.get(a.elementId)
    const fits = !picked || role === 'changes' || DATED_KINDS.has(picked.kind)
    return { role, elementId: fits ? a.elementId : '' }
  })
  return (
    <Box data-testid="plan-add-element" data-guide="plan.addElement" sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
      <TextField
        select size="small" label={t('plan.addElement')} value={adding.elementId} sx={{ flex: 1 }}
        slotProps={{ htmlInput: { 'aria-label': t('plan.addElement') } }}
        onChange={(e) => setAdding((a) => ({ ...a, elementId: e.target.value }))}
      >
        {groups.flatMap((group) => [
          <ListSubheader key={`kind:${group.kind}`} role="presentation">{t(KIND_LABEL_KEYS[group.kind])}</ListSubheader>,
          ...group.elements.map((element) => <MenuItem key={element.id} value={element.id}>{element.name}</MenuItem>),
        ])}
      </TextField>
      <TextField
        select size="small" value={adding.role} sx={{ width: 130 }}
        slotProps={namedSelect(t('plan.role'))}
        onChange={(e) => chooseRole(e.target.value as TransitionRole)}
      >
        {ROLES.map((role) => <MenuItem key={role} value={role}>{t(`plan.${role}` as StringKey)}</MenuItem>)}
      </TextField>
      <Button
        size="small" disabled={!adding.elementId}
        onClick={() => {
          onAdd({ elementId: adding.elementId, role: adding.role })
          setAdding((a) => ({ ...a, elementId: '' }))
        }}
      >
        {t('plan.add')}
      </Button>
    </Box>
  )
}

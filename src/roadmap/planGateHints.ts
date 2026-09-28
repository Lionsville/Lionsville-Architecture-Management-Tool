// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What each line of a plan's gate asks, and what still holds it open on this
 * plan (ADR-0009, amended 28 September 2026) — the words a line says on hover
 * and on focus.
 *
 * A line that says only "every decision it rests on is accepted" leaves the
 * reader to find which one is not, and three cases could not be found at all:
 * a record deleted since, which the page listed as a bare id; an element
 * deleted since, likewise; and a stand-in, whose dates are the defining
 * scope's (ADR-0012 §3) and cannot be typed here. The gate read each as not
 * dated and not accepted, correctly, and nothing on screen said why or what
 * to do. The hint names them.
 *
 * The same reading dates a stand-in for the gate itself ({@link gateElement}):
 * only its retirement day reaches this scope through the tree, so a stand-in
 * a plan retires clears once the scope that defines it gives it a day gone,
 * and one a plan introduces never does here — which is what the hint says.
 */
import { elementsWithRole, isDay } from '../model'
import type { DesignElement, ElementId, LifecycleDates, PlatformDescription, Transition, TransitionRole } from '../model'
import type { Adr } from '../model/adr'
import type { PlanGateItem } from '../model/transition'
import { formatAdrNumber } from '../decisions/adr'
import { STATUS_LABEL as ADR_STATUS_LABEL } from '../decisions/adrScope'
import type { StringKey, Translate } from '../i18n'

/**
 * The rule each line looks for. A `Record` over every item, so a gate line
 * added to the model without words for its hint does not compile.
 */
export const PLAN_GATE_HINT: Record<PlanGateItem, StringKey> = {
  window: 'plan.gateHint.window',
  owner: 'plan.gateHint.owner',
  names: 'plan.gateHint.names',
  decisions: 'plan.gateHint.decisions',
  started: 'plan.gateHint.started',
  introducedLive: 'plan.gateHint.introducedLive',
  retiredDated: 'plan.gateHint.retiredDated',
  interfacesPorted: 'plan.gateHint.interfacesPorted',
}

/** What the tree says about a thing this scope holds only a stand-in of: where it is defined, and when it goes. */
export type DescribeElsewhere = (id: ElementId) => Pick<PlatformDescription, 'where' | 'retired'> | undefined

/** What a hint reads beyond the plan. */
export type GateReading = {
  plan: Transition
  elements: readonly DesignElement[]
  /** Every record the plan may rest on: this scope's and those above. */
  decisions: readonly Adr[]
  describe?: DescribeElsewhere
  t: Translate
}

/**
 * An element as the gate should date it. A definition answers for itself; a
 * stand-in carries no dates of its own (ADR-0012 §3, `model/liveness.ts`),
 * and the one day the tree hands over — the day it is gone — is its dates
 * here. Whatever a stand-in holds in `lifecycleDates` is the owner's detail
 * left behind, which the checks report and nothing reads.
 */
export function gateElement(
  held: DesignElement | undefined, describe: DescribeElsewhere | undefined,
): { lifecycleDates?: LifecycleDates } | undefined {
  if (held === undefined || held.ref === undefined) return held
  const retired = describe?.(held.id)?.retired
  return isDay(retired) ? { lifecycleDates: { retired } } : {}
}

/** The hint for one line: its rule, and while it is open, what on this plan holds it open. */
export function planGateHint(item: PlanGateItem, ok: boolean, reading: GateReading): string {
  const rule = reading.t(PLAN_GATE_HINT[item])
  if (ok) return rule
  const detail = item === 'decisions' ? decisionsOpen(reading)
    : item === 'introducedLive' ? undated(reading, 'introduces', 'live')
      : item === 'retiredDated' ? undated(reading, 'retires', 'retired')
        : []
  return [rule, ...detail].join(' ')
}

/** Which records are not accepted, by number, title and status; and whether one is gone. */
function decisionsOpen({ plan, decisions, t }: GateReading): string[] {
  const byId = new Map(decisions.map((adr) => [adr.id, adr]))
  const waiting = plan.decisions
    .map((id) => byId.get(id))
    .filter((adr): adr is Adr => adr !== undefined && adr.status !== 'accepted')
    .map((adr) => t('plan.gateHint.withStatus', {
      name: `${formatAdrNumber(adr.number)} ${adr.title}`,
      status: t(ADR_STATUS_LABEL[adr.status]).toLowerCase(),
    }))
  return [
    ...(waiting.length > 0 ? [t('plan.gateHint.notAccepted', { names: waiting.join(', ') })] : []),
    ...(plan.decisions.some((id) => !byId.has(id)) ? [t('plan.gateHint.gone')] : []),
  ]
}

/**
 * What in one role still lacks its day, in three kinds: an element here with
 * no day, a stand-in whose day is kept in another scope, and a row naming an
 * element deleted since.
 */
function undated(reading: GateReading, role: TransitionRole, phase: 'live' | 'retired'): string[] {
  const { plan, elements, describe, t } = reading
  const byId = new Map(elements.map((element) => [element.id, element]))
  const here: string[] = []
  const elsewhere: string[] = []
  let gone = false
  for (const id of elementsWithRole(plan, role)) {
    const held = byId.get(id)
    if (held === undefined) { gone = true; continue }
    if (isDay(gateElement(held, describe)?.lifecycleDates?.[phase])) continue
    if (held.ref === undefined) { here.push(held.name); continue }
    const where = describe?.(id)?.where
    elsewhere.push(where ? t('plan.gateHint.inScope', { name: held.name, scope: where }) : held.name)
  }
  return [
    ...(here.length > 0 ? [t('plan.gateHint.undated', { names: here.join(', ') })] : []),
    ...(elsewhere.length > 0
      ? [t(role === 'introduces' ? 'plan.gateHint.standInLive' : 'plan.gateHint.standInGone', { names: elsewhere.join(', ') })]
      : []),
    ...(gone ? [t('plan.gateHint.gone')] : []),
  ]
}

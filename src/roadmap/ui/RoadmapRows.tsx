// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The roadmap's rows, each a press away from the reader beside the axis: plans
 * first, then what has a date, then the dated connections folded by the plan that
 * moves them, then the initiatives from below. Apart from `RoadmapPage.tsx` so the
 * page stays what it holds and where.
 *
 * A bar says its phase or status in words, and carries it in its outline as well:
 * colour is never the only signal.
 */
import { useState } from 'react'
import type { ReactNode } from 'react'
import { isDay, portProgress, transitionLabel } from '../../model'
import type { DesignModel, Lifecycle, Transition } from '../../model'
import type { TransitionStatus } from '../../model/transition'
import { useStrings } from '../../i18n'
import type { StringKey } from '../../i18n'
import { Mark } from '../../widgets/kit/Mark'
import { TimeAxisGroup, TimeAxisRow, TimeBar, TimeMilestones } from '../../widgets/kit/TimeAxis'
import type { TimeBarTone } from '../../widgets/kit/TimeAxis'
import { PLAN_STATUS_LABEL } from '../labels'
import { connectionGroups } from '../planReading'
import { shadowRunOf } from '../timeline'
import type { ElementTrack, RelationTrack, Roadmap } from '../timeline'
import type { Initiative } from './RoadmapPage'

const STATUS_TONE: Record<TransitionStatus, TimeBarTone> = { draft: 'draft', agreed: 'agreed', running: 'running', done: 'done', abandoned: 'done' }
const PHASE_TONE: Record<Lifecycle, TimeBarTone> = { planned: 'planned', live: 'live', retiring: 'retiring', retired: 'gone' }

/** What every row needs from the page. */
export type RowsContext = {
  model: DesignModel
  /** The row the reader is on, and the rows that belong to it. */
  picked: string | undefined
  related: ReadonlySet<string>
  pick: (id: string) => void
  /** The rows with a finding, by what the finding is about, with the weight that says which mark. */
  marked: ReadonlyMap<string, 'fix' | 'review'>
  /** Find narrows the rows; while it is on, nothing it matched stays folded. */
  finding: string
}

const matches = (context: RowsContext, ...words: readonly string[]) => (
  context.finding === '' || words.some((word) => word.toLowerCase().includes(context.finding))
)

const pickedOf = (context: RowsContext, id: string) => (
  context.picked === id ? 'self' as const : context.related.has(id) ? 'related' as const : undefined
)

function RowMark({ id, context }: { id: string; context: RowsContext }) {
  const { t } = useStrings()
  const weight = context.marked.get(id)
  return weight ? <Mark kind={weight} label={t('roadmap.rowHasFinding')} /> : null
}

export function PlanRows({ plans, hideEnded, onHideEnded, context }: {
  plans: readonly Transition[]
  hideEnded: boolean
  onHideEnded: (on: boolean) => void
  context: RowsContext
}) {
  const { t } = useStrings()
  const shown = plans.filter((plan) => !(hideEnded && (plan.status === 'done' || plan.status === 'abandoned'))
    && matches(context, transitionLabel(plan), plan.title))
  const undated = shown.filter((plan) => !isDay(plan.from) && !isDay(plan.to) && plan.milestones.every((one) => !isDay(one.date))).length
  return (
    <>
      <TimeAxisGroup
        label={t('roadmap.plans')}
        count={undated > 0 ? t('roadmap.plansUndated', { count: shown.length - undated, undated }) : String(shown.length)}
        {...(plans.some((plan) => plan.status === 'done' || plan.status === 'abandoned') ? { switched: { label: t('roadmap.hideEnded'), on: hideEnded, onChange: onHideEnded } } : {})}
      />
      {plans.length === 0 && <TimeAxisRow label={<span className="roadmap-quiet">{t('roadmap.noPlans')}</span>} />}
      {shown.map((plan) => <PlanRow key={plan.id} plan={plan} context={context} />)}
    </>
  )
}

function PlanRow({ plan, context }: { plan: Transition; context: RowsContext }) {
  const { t } = useStrings()
  const progress = portProgress(context.model, plan)
  const shadow = shadowRunOf(context.model, plan)
  const name = `${transitionLabel(plan)} ${plan.title}`
  const said = t(PLAN_STATUS_LABEL[plan.status])
  const open = () => context.pick(plan.id)
  const dated = isDay(plan.from) || isDay(plan.to)
  const milestones = plan.milestones.filter((one) => isDay(one.date)).map((one, at) => ({ id: `${at}`, day: one.date, label: one.name }))
  return (
    <TimeAxisRow
      label={name} title={name} onOpen={open} picked={pickedOf(context, plan.id)} data-testid={`plan-${plan.id}`}
      aside={(
        <>
          <RowMark id={plan.id} context={context} />
          {progress.total > 0 && ` ${t('roadmap.movedShort', { done: String(progress.done), total: String(progress.total) })}`}
        </>
      )}
    >
      {dated
        ? <TimeBar from={isDay(plan.from) ? plan.from : undefined} to={isDay(plan.to) ? plan.to : undefined} name={said} tone={STATUS_TONE[plan.status]} onOpen={open} />
        : milestones.length === 0 && <span className="roadmap-quiet roadmap-lanesaid">{t('roadmap.noDates')}</span>}
      {shadow && <TimeBar from={shadow.from} to={shadow.to} name={t('roadmap.shadowRun')} tone="shadow" says={t('roadmap.shadowSays', { from: shadow.from, to: shadow.to })} />}
      {milestones.length > 0 && <TimeMilestones items={milestones} onOpen={open} />}
    </TimeAxisRow>
  )
}

export function ApplicationRows({ tracks, total, belowLabel, context }: {
  tracks: readonly ElementTrack[]
  total: number
  belowLabel: (scope: string) => string
  context: RowsContext
}) {
  const { t } = useStrings()
  const shown = tracks.filter((track) => matches(context, track.element.name))
  if (tracks.length === 0) return null
  return (
    <>
      <TimeAxisGroup label={t('roadmap.applicationsDated')} count={t('roadmap.countOf', { count: shown.length, total })} />
      {shown.map((track) => <ApplicationRow key={track.element.id} track={track} belowLabel={belowLabel} context={context} />)}
    </>
  )
}

function ApplicationRow({ track, belowLabel, context }: { track: ElementTrack; belowLabel: (scope: string) => string; context: RowsContext }) {
  const { t } = useStrings()
  const open = () => context.pick(track.element.id)
  return (
    <TimeAxisRow
      label={track.element.name} title={track.element.name} onOpen={open} picked={pickedOf(context, track.element.id)}
      data-testid={`row-${track.element.id}`}
      aside={<><RowMark id={track.element.id} context={context} />{track.below && ` ${t('roadmap.inScope', { scope: belowLabel(track.below.scope) })}`}</>}
    >
      {track.spans.map((span) => (
        <TimeBar
          key={span.from} from={span.from} to={span.to}
          name={t(`lifecycle.${span.phase}` as StringKey)} tone={PHASE_TONE[span.phase]} onOpen={open}
        />
      ))}
    </TimeAxisRow>
  )
}

function ConnectionRow({ track, level, context }: { track: RelationTrack; level: number; context: RowsContext }) {
  const { t } = useStrings()
  const { relation, sourceName, targetName } = track
  const name = relation.label || t('roadmap.connectionName', { from: sourceName, to: targetName })
  const open = () => context.pick(relation.id)
  return (
    <TimeAxisRow label={name} title={`${sourceName} → ${targetName}: ${name}`} onOpen={open} picked={pickedOf(context, relation.id)} level={level} data-testid={`relation-${relation.id}`}>
      <TimeBar
        from={isDay(relation.validFrom) ? relation.validFrom : undefined} to={isDay(relation.validUntil) ? relation.validUntil : undefined}
        name={t('lifecycle.live')} tone="live" onOpen={open}
        says={`${sourceName} → ${targetName}`}
      />
    </TimeAxisRow>
  )
}

/** A stretch of the connections: its heading says how many, and what is under it stays shut until asked for. */
function ConnectionFold({ id, label, count, level, startOpen, children }: { id: string; label: string; count: number; level: number; startOpen: boolean; children: ReactNode }) {
  const [open, setOpen] = useState(startOpen)
  return (
    <div data-fold={id}>
      <TimeAxisGroup label={label} count={String(count)} level={level} folded={!open} onToggle={() => setOpen((was) => !was)} />
      {open && children}
    </div>
  )
}

export function ConnectionRows({ roadmap, plans, context }: { roadmap: Roadmap; plans: readonly Transition[]; context: RowsContext }) {
  const { t } = useStrings()
  const [open, setOpen] = useState(false)
  const shown = roadmap.relations.filter(({ relation, sourceName, targetName }) => matches(context, relation.label ?? '', sourceName, targetName))
  if (roadmap.relations.length === 0) return null
  const groups = connectionGroups(context.model, plans, shown)
  const finding = context.finding !== ''
  const lines = (tracks: readonly RelationTrack[], level: number) => tracks.map((track) => <ConnectionRow key={track.relation.id} track={track} level={level} context={context} />)
  return (
    <>
      <TimeAxisGroup
        label={t('roadmap.connections')}
        count={open ? String(shown.length) : t('roadmap.foldedCount', { count: shown.length })}
        folded={!open && !finding} onToggle={() => setOpen((was) => !was)}
      />
      {(open || finding) && (
        <>
          {groups.byPlan.map(({ plan, ending, starting }) => (
            <ConnectionFold key={plan.id} id={plan.id} label={t('roadmap.planMoves', { plan: transitionLabel(plan) })} count={ending.length + starting.length} level={1} startOpen={finding}>
              {ending.length > 0 && <ConnectionFold id={`${plan.id}/old`} label={t('roadmap.oldLines')} count={ending.length} level={2} startOpen={finding}>{lines(ending, 2)}</ConnectionFold>}
              {starting.length > 0 && <ConnectionFold id={`${plan.id}/new`} label={t('roadmap.newLines')} count={starting.length} level={2} startOpen={finding}>{lines(starting, 2)}</ConnectionFold>}
            </ConnectionFold>
          ))}
          {groups.inNoPlan.length > 0 && (
            groups.byPlan.length === 0
              ? lines(groups.inNoPlan, 1)
              : <ConnectionFold id="none" label={t('roadmap.noPlanLines')} count={groups.inNoPlan.length} level={1} startOpen={finding}>{lines(groups.inNoPlan, 1)}</ConnectionFold>
          )}
        </>
      )}
    </>
  )
}

export function InitiativeRows({ below, showBelow, onShowBelow, context }: {
  below: readonly Initiative[]
  showBelow: boolean
  onShowBelow: (on: boolean) => void
  context: RowsContext
}) {
  const { t } = useStrings()
  if (below.length === 0) return null
  const hasElements = below.some(({ elements }) => (elements?.length ?? 0) > 0)
  const shown = below.filter(({ plan, label }) => matches(context, transitionLabel(plan), plan.title, label))
  return (
    <>
      <TimeAxisGroup
        label={t('roadmap.fromBelow')} count={String(shown.length)}
        {...(hasElements ? { switched: { label: t('roadmap.showBelowChanges'), on: showBelow, onChange: onShowBelow } } : {})}
      />
      {shown.map(({ scope, label, plan }) => {
        const id = initiativeId(scope, plan.id)
        const open = () => context.pick(id)
        const name = `${transitionLabel(plan)} ${plan.title}`
        return (
          <TimeAxisRow
            key={id} label={name} title={name} onOpen={open} picked={pickedOf(context, id)} data-testid={`initiative-${scope}-${plan.id}`}
            aside={t('roadmap.inScope', { scope: label })}
          >
            {(isDay(plan.from) || isDay(plan.to)) && (
              <TimeBar from={isDay(plan.from) ? plan.from : undefined} to={isDay(plan.to) ? plan.to : undefined} name={t(PLAN_STATUS_LABEL[plan.status])} tone={STATUS_TONE[plan.status]} onOpen={open} />
            )}
            <TimeMilestones items={plan.milestones.filter((one) => isDay(one.date)).map((one, at) => ({ id: `${at}`, day: one.date, label: one.name }))} onOpen={open} />
          </TimeAxisRow>
        )
      })}
    </>
  )
}

/** How a plan from below is known to the selection: a plan's id means one thing only in its own scope. */
export function initiativeId(scope: string, planId: string): string {
  return `${scope}/${planId}`
}

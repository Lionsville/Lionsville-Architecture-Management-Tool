// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The move screen's wiring (ADR-0038 §5): which observation, which scope it
 * goes to, what the move would cut — and where it lands.
 *
 * **Everything shown is planned.** The screen asks `planMove` whenever the
 * scope picked changes, over the analyses of the scopes the person can read,
 * so the number, the links cut and the reason Move cannot be pressed are the
 * rule's answer and never a second opinion of the screen's.
 *
 * **It lands across, always.** A move writes two scopes, so it goes to
 * `onChangeAcross`, which reads every scope fresh and plans again over what
 * it read: what lands is planned over what is there, and not over what the
 * screen was shown. The screen closes on the record in its new scope, or
 * stays up and says why nothing moved.
 *
 * **What was pressed stays shown while it lands.** The write reaches the
 * scopes before the host answers, and planned again over them the record is
 * history here already: the screen keeps the plan Move was pressed on, and
 * once the record reads as moved it is gone, rather than saying the move it
 * just made is refused.
 */
import { useCallback, useMemo, useState } from 'react'
import type { Translate } from '../../i18n'
import type { Observation, ScopeAnalysis } from '../observation'
import { formatObservationNumber, isBright, isMoved, isScopeBelow } from '../observation'
import { nodeKey } from '../graph'
import { planMove, scopesForMove } from '../move'
import type { MoveLink, MovePlan } from '../move'
import type { RecordAt } from '../merge'
import { recordName } from '../mergeScreen'
import { moveBlocked, moveNote, moveTargets, withEveryScope } from '../moveScreen'
import type { MoveTarget } from '../moveScreen'
import type { ChangeAcross, ObservationWork } from './ObservationsPage'

/** One link the move cuts, or brings back, as the screen says it. */
export type MoveRow = { key: string; cause: string; reaches?: string }

export type MoveScreenState = {
  /** The observation, as people say it. */
  label: string
  title: string
  bright: boolean
  seen: number
  /** How many comments go with it (ADR-0037 §6). */
  comments: number
  query: string
  setQuery: (query: string) => void
  targets: readonly (MoveTarget & { picked: boolean })[]
  pick: (path: string) => void
  /** What it becomes there, once a scope is picked and the move may be made. */
  becomes?: string
  cut: readonly MoveRow[]
  restored: readonly MoveRow[]
  confirm: { label: string; blocked?: string; busy: boolean; run: () => void }
  close: () => void
}

export type MoveDeps = {
  /** The open scope's path. */
  here: string
  /** The analysis of every scope the person can read, this one as the page holds it. */
  scopes: readonly ScopeAnalysis[]
  /** Every scope the person can read, those with no analysis yet included: what may be picked. */
  paths: readonly string[]
  /** May the person change the scope at this path? Where absent, every scope is as writable as this one. */
  writable?: ((path: string) => boolean) | undefined
  readOnly: boolean
  /** Several scopes as one; absent where only this scope may be written from here. */
  onChangeAcross?: ChangeAcross | undefined
  /** `yyyy-mm-dd`. */
  today: () => string
  t: Translate
  scopeLabel: (path: string) => string
  /** What a scope is called where one is picked: its path from the organisation down. Absent, `scopeLabel`. */
  scopeTrail?: ((path: string) => string) | undefined
  /** Where the record lives now, once it moved: the page goes there. */
  onMoved: (to: RecordAt) => void
}

/** Every scope as writable as this one, where the host says nothing per scope. */
const EVERY_SCOPE = () => true

/** What each scope it writes becomes, as the page's change across hands it back. */
function worksOf(plan: Extract<MovePlan, { ok: true }>): Map<string, ObservationWork> {
  return new Map(plan.writes.map((one) => [one.scope, {
    observations: [...one.observations], causes: [...one.causes], solutions: [...one.solutions], experiments: [...one.experiments],
    ...(one.comments ? { comments: [...one.comments] } : {}),
  }]))
}

/** A link's rows as the screen says them: the cause, and the solutions it leads to. */
function rowsOf(links: readonly MoveLink[], name: (at: RecordAt) => string, t: Translate): MoveRow[] {
  return links.map((row) => ({
    key: `${row.holder.scope}#${row.holder.id}`,
    cause: t('observation.moveCutRow', { cause: name(row.holder) }),
    ...(row.solutions.length > 0 ? { reaches: t('observation.moveCutReaches', { solutions: row.solutions.map(name).join(', ') }) } : {}),
  }))
}

/** What the screen is handed: the record, the scopes, the plan's words and the presses, put together. */
function screenOf(o: {
  record: Observation
  plan: MovePlan | undefined
  target: string | undefined
  query: string
  setQuery: (query: string) => void
  busy: boolean
  every: readonly ScopeAnalysis[]
  deps: MoveDeps & { trail: (path: string) => string; writable: (path: string) => boolean }
  name: (at: RecordAt) => string
  pick: (path: string) => void
  run: () => void
  close: () => void
}): MoveScreenState {
  const { record, plan, target, deps } = o
  const { t, trail, writable, here } = deps
  const label = formatObservationNumber(record.number)
  const own = deps.scopes.find((one) => one.scope === here)?.comments ?? []
  const blocked = moveBlocked({ plan, here, target, readOnly: deps.readOnly, across: Boolean(deps.onChangeAcross), writable, trail, t })
  return {
    label,
    title: record.title,
    bright: isBright(record),
    seen: record.seen,
    comments: plan?.ok ? plan.comments : own.filter((one) => one.about.kind === 'observation' && one.about.id === record.id).length,
    query: o.query,
    setQuery: o.setQuery,
    targets: moveTargets({ paths: o.every.map((one) => one.scope), here, query: o.query, trail, writable, t })
      .map((one) => ({ ...one, picked: one.path === target })),
    pick: o.pick,
    ...(plan?.ok && target !== undefined ? {
      becomes: t(plan.revived ? 'observation.moveRevives' : 'observation.moveBecomes', { label: formatObservationNumber(plan.number), scope: trail(target) }),
    } : {}),
    cut: rowsOf(plan?.cut ?? [], o.name, t),
    restored: rowsOf(plan?.ok ? plan.restored : [], o.name, t),
    confirm: {
      label: target !== undefined ? t('observation.moveConfirm', { label, scope: trail(target) }) : t('observation.actMove'),
      ...(blocked !== undefined ? { blocked } : {}),
      busy: o.busy,
      run: o.run,
    },
    close: o.close,
  }
}

export function useMove(deps: MoveDeps) {
  const { here, scopes, paths, t, scopeLabel, today, onChangeAcross, onMoved } = deps
  const trail = deps.scopeTrail ?? scopeLabel
  const writable = deps.writable ?? EVERY_SCOPE
  const [opened, setOpened] = useState<string | undefined>(undefined)
  const [target, setTarget] = useState<string | undefined>(undefined)
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  /** The plan Move was pressed on, while the move lands. */
  const [pressed, setPressed] = useState<MovePlan | undefined>(undefined)
  const [note, setNote] = useState<string | undefined>(undefined)

  const open = useCallback((one: Observation) => {
    setOpened(one.id)
    setTarget(undefined)
    setQuery('')
    setBusy(false)
    setPressed(undefined)
  }, [])
  const close = useCallback(() => setOpened(undefined), [])

  const record = useMemo(
    () => scopes.find((one) => one.scope === here)?.observations.find((one) => one.id === opened), [scopes, here, opened],
  )
  const every = useMemo(() => withEveryScope(scopes, paths), [scopes, paths])
  const from = useMemo<RecordAt | undefined>(() => (opened ? { scope: here, id: opened } : undefined), [opened, here])
  const read = useMemo(() => (from && target !== undefined ? scopesForMove(from, target, every) : []), [from, target, every])
  const plan = useMemo(
    () => (from && target !== undefined
      ? planMove({ from, to: target, date: today(), scopes: every.filter((one) => read.includes(one.scope)) })
      : undefined),
    [from, target, every, read, today],
  )
  const name = useCallback((at: RecordAt) => recordName(scopes, here, scopeLabel, at), [scopes, here, scopeLabel])

  const land = useCallback(async () => {
    if (!plan?.ok || !from || target === undefined || !onChangeAcross) return
    const moved = { label: formatObservationNumber(plan.number), scope: trail(target) }
    setPressed(plan)
    setBusy(true)
    try {
      const result = await onChangeAcross(read, (held) => {
        const again = planMove({ from, to: target, date: today(), scopes: [...held].map(([scope, work]) => ({ scope, ...work })) })
        return again.ok ? worksOf(again) : { refused: again.refusal }
      })
      setNote(moveNote(result, moved, scopeLabel, t))
      if (result.ok) {
        close()
        onMoved({ scope: target, id: from.id })
      }
    } catch {
      setNote(t('observation.moveNotMade'))
    } finally {
      setBusy(false)
      setPressed(undefined)
    }
  }, [plan, from, target, onChangeAcross, read, today, trail, scopeLabel, t, close, onMoved])

  // Landing, the record reads as moved once the write reached this scope: it went, so the screen goes.
  const landed = pressed !== undefined && record !== undefined && isMoved(record)
  const state = record && !landed ? screenOf({
    record, plan: pressed ?? plan, target, query, setQuery, busy, every, deps: { ...deps, trail, writable }, name,
    pick: (path) => { if (writable(path)) setTarget(path) },
    // `land` says every failure itself, in the note.
    run: () => { void land() },
    close,
  }) : undefined

  return { open, state, note, clearNote: useCallback(() => setNote(undefined), []) }
}

/**
 * The move screen as the observations page wires it: every scope read where
 * the page names none, *Move to scope…* offered only where another scope may
 * be written from here, and, once it moved, the record selected where it is
 * now — below this scope, on this page; elsewhere, on the page of the scope
 * that keeps it.
 */
export function usePageMove(o: Omit<MoveDeps, 'paths' | 'onMoved'> & {
  paths: readonly string[] | undefined
  select: (key: string) => void
  onOpenScope: ((path: string, id?: string) => void) | undefined
  onClose: () => void
}) {
  const { here, select, onOpenScope, onClose, scopes } = o
  const onMoved = useCallback((to: RecordAt) => {
    if (isScopeBelow(to.scope, here)) select(nodeKey(to.id, to.scope))
    else if (onOpenScope) {
      onClose()
      onOpenScope(to.scope, to.id)
    }
  }, [here, select, onOpenScope, onClose])
  const paths = useMemo(() => o.paths ?? scopes.map((one) => one.scope), [o.paths, scopes])
  const move = useMove({ ...o, paths, onMoved })
  return { ...move, ask: o.onChangeAcross && !o.readOnly ? move.open : undefined }
}

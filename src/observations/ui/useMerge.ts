// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The merge screen's wiring (ADR-0035 §1–§3, §5): what is picked, which one
 * survives, what it says, which links move — and where the merge lands.
 *
 * **Everything shown is planned.** The screen asks `planMerge` on every
 * change, over the analyses of the scopes it reads, so the links, their
 * refusals and the reason Merge cannot be pressed are the rule's answer and
 * never a second opinion of the screen's.
 *
 * **Where it lands is what it writes.** A merge whose plan writes this scope
 * only is the page's own step, one ⌘Z. One that writes any other scope —
 * because a record of it is merged, or because a link held there moves — goes
 * to `onChangeAcross`, which reads every scope fresh and plans again over
 * what it read, so what lands is planned over what is there and not over what
 * the screen was shown; the note after it says which scopes it changed.
 */
import { useCallback, useMemo, useState } from 'react'
import type { Translate } from '../../i18n'
import type { Cause, CauseStrength, Observation, ScopeAnalysis } from '../observation'
import { OBSERVATION_IMPACTS } from '../../model/observation'
import { causeDefaults, observationDefaults, planMerge, scopesForMerge, withMergedDescriptions } from '../merge'
import type { CauseValues, LinkChoice, MergeKind, MergeLink, MergePlan, ObservationValues, RecordAt } from '../merge'
import {
  acrossNote, confirmLabel, mergeBlocked, mergeCandidates, recordAt, recordLabel, recordName, writtenScopes,
} from '../mergeScreen'
import type { MergeHit } from '../mergeScreen'
import { nodeKey } from '../graph'
import { isScopeBelow } from '../observation'
import { IMPACT_LABEL, STATE_LABEL } from '../observationScope'
import type { ChangeAcross, ObservationWork } from './ObservationsPage'

/** How many hits the search lists before it asks to be narrowed down. */
export const MERGE_HIT_LIMIT = 50

/** One value the survivor says, and what each record in the set says for it. */
export type MergeFieldKey = 'title' | 'where' | 'by' | 'impact' | 'date' | 'state' | 'root'
export type MergeField = {
  key: MergeFieldKey
  label: string
  /** As the field holds it: text, an impact, a day, a state, or `true`/`false` for a root cause. */
  value: string
  /** Every distinct value of the set, the survivor's first, said as a person reads it. */
  options: readonly { label: string; value: string; said: string }[]
}

/** A record of the set, or one the search found. */
export type MergeRow = MergeHit & {
  /** Where its scope is not this one: what it is called. */
  scopeName?: string
  /** Why it cannot be picked: its scope may be read and not changed. */
  closed?: string
}

export type MergeScreenState = {
  kind: MergeKind
  query: string
  setQuery: (query: string) => void
  across: boolean
  setAcross: (across: boolean) => void
  hits: readonly (MergeRow & { picked: boolean })[]
  /** How many more the search found than it lists. */
  more: number
  picked: readonly (MergeRow & { survivor: boolean })[]
  toggle: (at: RecordAt) => void
  choose: (at: RecordAt) => void
  fields: readonly MergeField[]
  setField: (key: MergeFieldKey, value: string) => void
  /** The survivor's sightings once the merge is made: every record's, together. */
  seen?: number
  body: string
  setBody: (body: string) => void
  /** *Add the others' descriptions*; absent once they are added, until the set changes. */
  addOthers?: () => void
  links: readonly MergeLink[]
  nameAt: (at: RecordAt) => string
  setLink: (key: string, choice: LinkChoice) => void
  confirm: { label: string; blocked?: string; busy: boolean; run: () => void }
  close: () => void
}

export type MergeDeps = {
  /** The open scope's path. */
  here: string
  /** The analysis of every scope the person can read, this one as the page holds it. */
  scopes: readonly ScopeAnalysis[]
  /** May the person change the scope at this path? Where absent, every scope is as writable as this one. */
  writable?: ((path: string) => boolean) | undefined
  readOnly: boolean
  /** This scope's lists, handed back whole: one step. */
  commit: (next: Partial<ObservationWork>) => void
  /** Several scopes as one; absent where only this scope may be written from here. */
  onChangeAcross?: ChangeAcross | undefined
  /** `yyyy-mm-dd`. */
  today: () => string
  t: Translate
  scopeLabel: (path: string) => string
  day: (date: string) => string
  /** Select a record on the page, by its key. */
  select: (key: string) => void
}

type Opened = { kind: MergeKind; picked: RecordAt[]; survivor: RecordAt }
type Chosen = Partial<ObservationValues & CauseValues>

const same = (one: RecordAt, other: RecordAt) => one.scope === other.scope && one.id === other.id

/** The value rows of a kind, as the field holds each record's. */
function fieldsOf(kind: MergeKind, records: readonly (Observation | Cause)[], values: Chosen, deps: MergeDeps): MergeField[] {
  const { t } = deps
  const row = (key: MergeFieldKey, label: string, read: (one: Observation & Cause) => string | undefined, say: (value: string) => string): MergeField => {
    const seen = new Set<string>()
    const options = records.flatMap((one) => {
      const value = read(one as Observation & Cause)
      if (value === undefined || value.trim() === '' || seen.has(value)) return []
      seen.add(value)
      return [{ label: recordLabel(kind, one), value, said: say(value) }]
    })
    const held = values[key]
    return { key, label, value: held === undefined ? '' : String(held), options }
  }
  const plain = (value: string) => value
  if (kind === 'cause') {
    return [
      row('title', t('observation.titleField'), (one) => one.title, plain),
      row('state', t('observation.mergeStateField'), (one) => one.state, (value) => t(STATE_LABEL[value as Cause['state']])),
      row('root', t('observation.rootCause'), (one) => String(one.root === true),
        (value) => (value === 'true' ? t('observation.rootCause') : t('observation.mergeNotRootValue'))),
    ]
  }
  return [
    row('title', t('observation.titleField'), (one) => one.title, plain),
    row('where', t('observation.whereField'), (one) => one.where, plain),
    row('by', t('observation.byField'), (one) => one.by, plain),
    row('impact', t('observation.impactField'), (one) => one.impact, (value) => t(IMPACT_LABEL[value as Observation['impact']])),
    row('date', t('observation.mergeFirstSeen'), (one) => one.date, deps.day),
  ]
}

/** A typed value as the survivor keeps it. */
function valueOf(key: MergeFieldKey, value: string): Chosen {
  if (key === 'root') return { root: value === 'true' }
  if (key === 'impact') return OBSERVATION_IMPACTS.includes(value as Observation['impact']) ? { impact: value as Observation['impact'] } : {}
  if (key === 'state') return value === 'verified' || value === 'assumed' ? { state: value } : {}
  return { [key]: value }
}

/** What each scope it writes becomes, as the page's change across hands it back. */
function worksOf(plan: Extract<MergePlan, { ok: true }>): Map<string, ObservationWork> {
  return new Map(plan.writes.map((one) => [one.scope, {
    observations: [...one.observations], causes: [...one.causes], solutions: [...one.solutions], experiments: [...one.experiments],
  }]))
}

/** The screen's own state while it is up: what is picked and chosen. */
function useMergeChoices() {
  const [opened, setOpened] = useState<Opened | undefined>(undefined)
  const [query, setQuery] = useState('')
  const [across, setAcross] = useState(false)
  const [chosen, setChosen] = useState<Chosen>({})
  const [choices, setChoices] = useState<Record<string, LinkChoice>>({})
  const [added, setAdded] = useState(false)
  const [busy, setBusy] = useState(false)
  const open = useCallback((kind: MergeKind, at: RecordAt) => {
    setOpened({ kind, picked: [at], survivor: at })
    setQuery('')
    setAcross(false)
    setChosen({})
    setChoices({})
    setAdded(false)
    setBusy(false)
  }, [])
  const close = useCallback(() => setOpened(undefined), [])
  /** A record in or out of the set: the survivor goes last, to the next one picked. */
  const toggle = (at: RecordAt) => setOpened((held) => {
    if (!held) return held
    if (!held.picked.some((one) => same(one, at))) return { ...held, picked: [...held.picked, at] }
    const picked = held.picked.filter((one) => !same(one, at))
    if (picked.length === 0) return held
    return { ...held, picked, survivor: same(held.survivor, at) ? picked[0] : held.survivor }
  })
  const choose = (at: RecordAt) => setOpened((held) => (held && held.picked.some((one) => same(one, at)) ? { ...held, survivor: at } : held))
  return {
    opened, open, close, query, setQuery, across, setAcross, chosen, setChosen, choices, setChoices, added, setAdded, busy, setBusy,
    toggle: (at: RecordAt) => { toggle(at); setAdded(false) },
    choose,
  }
}

/** Every scope as writable as this one, where the host says nothing per scope. */
const EVERY_SCOPE = () => true

type Picked = { at: RecordAt; one: Observation | Cause | undefined }

/** What the screen is handed: the planned merge, the set, and the presses, put together. */
function screenOf(o: {
  kind: MergeKind
  opened: Opened
  plan: MergePlan
  c: ReturnType<typeof useMergeChoices>
  hits: readonly MergeHit[]
  records: readonly Picked[]
  absorbed: readonly Picked[]
  survivor: Observation | Cause | undefined
  values: Chosen
  rowOf: (hit: MergeHit) => MergeRow
  nameAt: (at: RecordAt) => string
  blocked: string | undefined
  land: () => Promise<void>
  deps: MergeDeps
}): MergeScreenState {
  const { kind, opened, plan, c, records, absorbed, survivor, values, deps } = o
  const { t, scopeLabel } = deps
  const set = [survivor, ...absorbed.map(({ one }) => one)].filter((one): one is Observation | Cause => one !== undefined)
  const addOthers = () => {
    c.setChosen((held) => ({
      ...held,
      body: withMergedDescriptions(values.body ?? '', absorbed.flatMap(({ at, one }) => (one ? [{
        label: recordLabel(kind, one), ...(at.scope !== opened.survivor.scope ? { scope: scopeLabel(at.scope) } : {}), body: one.body,
      }] : [])), t),
    }))
    c.setAdded(true)
  }
  return {
    kind,
    query: c.query, setQuery: c.setQuery, across: c.across, setAcross: c.setAcross,
    hits: o.hits.slice(0, MERGE_HIT_LIMIT).map((hit) => ({ ...o.rowOf(hit), picked: opened.picked.some((at) => same(at, hit.at)) })),
    more: Math.max(0, o.hits.length - MERGE_HIT_LIMIT),
    picked: records.flatMap(({ at, one }) => (one ? [{
      ...o.rowOf({ at, label: recordLabel(kind, one), title: one.title }), survivor: same(at, opened.survivor),
    }] : [])),
    toggle: c.toggle,
    choose: c.choose,
    fields: fieldsOf(kind, set, values, deps),
    setField: (key, value) => c.setChosen((held) => ({ ...held, ...valueOf(key, value) })),
    ...(kind === 'observation' ? { seen: set.reduce((sum, one) => sum + (one as Observation).seen, 0) } : {}),
    body: values.body ?? '',
    setBody: (body) => c.setChosen((held) => ({ ...held, body })),
    ...(c.added ? {} : { addOthers }),
    links: plan.links,
    nameAt: o.nameAt,
    setLink: (key, choice) => c.setChoices((held) => ({ ...held, [key]: { ...held[key], ...choice } })),
    confirm: {
      label: confirmLabel(kind, absorbed.length, survivor ? recordLabel(kind, survivor) : '', t),
      ...(o.blocked !== undefined ? { blocked: o.blocked } : {}),
      busy: c.busy,
      // `land` says every failure itself, in the note.
      run: () => { void o.land() },
    },
    close: c.close,
  }
}

export function useMerge(deps: MergeDeps) {
  const { here, scopes, t, scopeLabel, today, select, commit, onChangeAcross, readOnly } = deps
  const writable = deps.writable ?? EVERY_SCOPE
  const c = useMergeChoices()
  const [note, setNote] = useState<string | undefined>(undefined)
  const { opened, choices, chosen } = c
  const kind = opened?.kind ?? 'observation'

  const hits = useMemo(
    () => (opened ? mergeCandidates({ kind, scopes, here, across: c.across, query: c.query }) : []),
    [opened, kind, scopes, here, c.across, c.query],
  )
  const records = useMemo<Picked[]>(() => (opened?.picked ?? []).map((at) => ({ at, one: recordAt(scopes, kind, at) })), [opened, scopes, kind])
  const survivorAt = opened?.survivor
  const absorbed = useMemo(() => records.filter(({ at }) => !survivorAt || !same(at, survivorAt)), [records, survivorAt])
  const survivor = records.find(({ at }) => survivorAt && same(at, survivorAt))?.one
  const values = useMemo<Chosen>(() => {
    const others = absorbed.flatMap(({ one }) => (one ? [one] : []))
    const defaults = !survivor ? {}
      : kind === 'cause' ? causeDefaults(survivor as Cause) : observationDefaults(survivor as Observation, others as Observation[])
    return { ...defaults, ...chosen }
  }, [survivor, absorbed, kind, chosen])
  const read = useMemo(() => scopesForMerge(kind, opened?.picked ?? [], scopes), [kind, opened, scopes])
  const request = useCallback((over: readonly ScopeAnalysis[]) => ({
    kind, survivor: survivorAt!, absorbed: absorbed.map(({ at }) => at), scopes: over, choices, date: today(), values,
  }) as Parameters<typeof planMerge>[0], [kind, survivorAt, absorbed, choices, today, values])
  const plan = useMemo(
    () => (survivorAt ? planMerge(request(scopes.filter((one) => read.includes(one.scope)))) : undefined),
    [survivorAt, request, scopes, read],
  )

  const nameAt = useCallback((at: RecordAt) => recordName(scopes, here, scopeLabel, at), [scopes, here, scopeLabel])
  const rowOf = useCallback((hit: MergeHit): MergeRow => ({
    ...hit,
    ...(hit.at.scope !== here ? { scopeName: scopeLabel(hit.at.scope) } : {}),
    ...(writable(hit.at.scope) ? {} : { closed: t('observation.mergeNotYoursRow', { scope: scopeLabel(hit.at.scope) }) }),
  }), [here, scopeLabel, writable, t])

  const { close, setBusy } = c
  const land = useCallback(async () => {
    if (!plan?.ok || !survivorAt) return
    const landed = () => {
      close()
      if (survivorAt.scope === here) select(survivorAt.id)
      else if (isScopeBelow(survivorAt.scope, here)) select(nodeKey(survivorAt.id, survivorAt.scope))
    }
    if (writtenScopes(plan).every((path) => path === here)) {
      const [own] = plan.writes
      commit({ observations: [...own.observations], causes: [...own.causes], solutions: [...own.solutions] })
      landed()
      return
    }
    if (!onChangeAcross) return
    setBusy(true)
    try {
      const result = await onChangeAcross(read, (held) => {
        const again = planMerge(request([...held].map(([scope, work]) => ({ scope, ...work }))))
        return again.ok ? worksOf(again) : { refused: again.refusal }
      })
      setNote(acrossNote(result, scopeLabel, t))
      if (result.ok) landed()
    } catch {
      setNote(t('observation.mergeNotMade'))
    } finally {
      setBusy(false)
    }
  }, [plan, survivorAt, here, close, setBusy, select, commit, onChangeAcross, read, request, scopeLabel, t])

  const state = opened && plan ? screenOf({
    kind, opened, plan, c, hits, records, absorbed, survivor, values, rowOf, nameAt, land, deps,
    blocked: mergeBlocked({
      plan, records: opened.picked, here, readOnly, across: Boolean(onChangeAcross), writable, scopeLabel, t,
    }),
  }) : undefined

  return { open: c.open, state, note, clearNote: useCallback(() => setNote(undefined), []) }
}

/** The strengths a moved link may be given, strongest first. */
export const STRENGTHS: readonly CauseStrength[] = ['strong', 'normal', 'weak']

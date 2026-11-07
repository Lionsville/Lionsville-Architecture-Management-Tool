// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The observations page's forms, and where what they make lands (ADR-0032
 * §2, §4, §6): the new observation with its causes, written in a panel beside the
 * list; the ladder that asks why (`WhyLadder`), one question at a time, for one
 * record or a group; and the link dialog for a cause across a scope boundary.
 *
 * **One submit is one step.** What a form makes goes back through the page's
 * one whole-lists path, which the workspace turns into one transaction, so ⌘Z
 * takes the observation, its new causes and its links back together.
 *
 * **A record is edited where it lives.** What is added to a record of a scope
 * below — a sighting, a new cause, a link between its own records — is that
 * scope's step, through `onChangeBelow`, and the note after it says where it
 * went. A link from a cause here to a cause below lives on the cause here, and
 * is this scope's step (§4).
 *
 * The change handed below is a function of that scope's lists as they are when
 * it lands, never of what this page read of them, because it may be made again
 * over a scope somebody saved in between.
 */
import { useCallback, useState, type ReactNode } from 'react'
import Snackbar from '@mui/material/Snackbar'
import type { Translate } from '../../i18n'
import type { MarkdownRenderOptions } from '../../documentation/documentation'
import type { MakeId } from '../../model/keys'
import { causeLabel, formatObservationNumber, linkCause, linkRefusal, liveCauses, nextCauseNumber, seenAgain, toneOf } from '../observation'
import type { Cause, CauseLink, LinkContext, Observation, ScopeAnalysis } from '../observation'
import { addCauseLinked, recordObservation } from '../form'
import { usePersonNames } from '../../people/ui/names'
import { meIn } from '../../people/me'
import { registerOf } from '../../people/shown'
import type { RecordedBy } from '../observation'
import { whoRecords } from '../recordedBy'
import { nodeKey } from '../graph'
import { LinkDialog } from './LinkForm'
import { WhyLadder } from './WhyLadder'
import type { LinkCandidate, LinkSpec } from './LinkForm'
import { NewObservationPanel, RecordedPanel } from './ObservationForm'
import { SeenDialog } from './ObservationDialogs'
import type { FormScope, RecordRequest } from './ObservationForm'
import type { LinkTarget } from './readerActions'
import type { ChangeBelow, ChangedBelow, ObservationWork } from './ObservationsPage'

import type { WorkChange } from './PageReaders'

/** The scope and the id a key names: `scope#id` for a record below, the bare id for one here. */
export function splitKey(key: string): { id: string; scope?: string } {
  const at = key.lastIndexOf('#')
  return at < 0 ? { id: key } : { scope: key.slice(0, at), id: key.slice(at + 1) }
}

/** What the ladder is asking about: one record or a group of one scope, and whether it opened on what is already written down. */
export type LadderAsk = { mode: 'cause' | 'deeper'; ids: readonly string[]; scope?: string; existing?: true }

export type AnalysisForms = {
  openNew: () => void
  openLink: (target: LinkTarget) => void
  /** Ask why of several records at once: the ladder, for a group. */
  askGroup: (ids: readonly string[], scope: string | undefined) => void
  /** What stands beside the list: the form, what it asks after recording, or the ladder. Absent, nothing does. */
  panel: ReactNode
  /** Always: the link dialog takes a cause across a scope boundary, both ways. */
  across: true
  /** Land a change on a scope below and say where it went; absent where nothing below may be written. */
  changeBelow?: (scope: string, change: WorkChange, landed?: () => void) => void
  /** The scopes a new observation may be made in: this one, then those below while View local is on and they may be written. */
  scopes: FormScope[]
  dialogs: ReactNode
}

export function useAnalysisForms(deps: {
  work: ObservationWork
  below: readonly ScopeAnalysis[]
  /**
   * View local is on (ADR-0032 §8): the page shows the scopes below, so the
   * new observation may be made in one of them. Off, it is made here, in the
   * one scope the page is showing.
   */
  local: boolean
  /** This scope's path, for the rules about links across the tree; the root's where the host did not say. */
  path: string | undefined
  scopeName: string
  commit: (next: Partial<ObservationWork>) => void
  /** Nothing below is written from a page that may not write. */
  readOnly: boolean
  onChangeBelow: ChangeBelow | undefined
  makeId: MakeId
  today: () => string
  s: Translate
  scopeLabel: (path: string) => string
  /** What a scope below is called in the form's *Scope*: its path, so two of one name are told apart. Absent, `scopeLabel`. */
  scopeTrail?: ((path: string) => string) | undefined
  nameOf: (id: string, scope?: string) => string
  select: (key: string) => void
  renderMarkdown: (md: string, options?: MarkdownRenderOptions) => ReactNode
  /** *This is the root cause*, with what stands in the way: read through the page, which knows what explains a cause from above. */
  rootStep: (id: string, scope?: string) => { onRoot?: () => void; rootRefused?: string }
  /** Propose a solution for a root the ladder reached. */
  onPropose?: ((causeId: string) => void) | undefined
}): AnalysisForms {
  const { work, below, commit, makeId, today, s, scopeLabel, nameOf, select } = deps
  const [creating, setCreating] = useState(false)
  const [linking, setLinking] = useState<LinkTarget | undefined>(undefined)
  const [asking, setAsking] = useState<LadderAsk | undefined>(undefined)
  /** What was just recorded, for the one question after it. */
  const [recorded, setRecorded] = useState<{ id: string; scope?: string } | undefined>(undefined)
  /** An observation the form found written down already, being seen again: asked over the form, which stays open behind it. */
  const [seeing, setSeeing] = useState<{ id: string; scope?: string } | undefined>(undefined)
  const [notice, setNotice] = useState<string | undefined>(undefined)
  const onChangeBelow = deps.readOnly ? undefined : deps.onChangeBelow

  const changeBelow = useCallback((scope: string, change: WorkChange, landed?: () => void) => {
    if (!onChangeBelow) return
    const name = scopeLabel(scope)
    onChangeBelow(scope, change).then((result) => {
      setNotice(belowNotice(result, name, s))
      if (result.ok) landed?.()
    }, () => setNotice(s('observation.belowNotMade', { scope: name })))
  }, [onChangeBelow, scopeLabel, s])

  /** A change to one scope's causes: this scope's step, or that scope's. */
  const onCauses = (scope: string | undefined, change: (causes: Cause[]) => Cause[], landed: () => void) => {
    if (scope === undefined) { commit({ causes: change(work.causes) }); landed(); return }
    changeBelow(scope, (held) => ({ ...held, causes: change(held.causes) }), landed)
  }

  const recordedBy = useRecordedBy()
  const record = (request: RecordRequest) => {
    setCreating(false)
    const args = { fields: { ...request.fields, ...(recordedBy ? { recordedBy } : {}) }, causes: request.causes, makeId, t: s }
    // With a cause written beside it, the question after recording has been answered.
    const ask = (id: string, scope?: string) => { if (request.causes.length === 0) setRecorded({ id, ...(scope !== undefined ? { scope } : {}) }) }
    if (request.scope === undefined) {
      const made = recordObservation(work, args)
      commit(made.analysis)
      ask(made.id)
      return
    }
    const scope = request.scope
    let id = ''
    changeBelow(scope, (held) => {
      const made = recordObservation(held, args)
      id = made.id
      return { ...held, ...made.analysis }
    }, () => ask(id, scope))
  }
  const seenFromForm = ({ date, note }: { date: string; note: string }) => {
    if (!seeing) return
    const { id, scope } = seeing
    setSeeing(undefined)
    setCreating(false)
    if (scope === undefined) {
      commit({ observations: seenAgain(work.observations, id, date, note) })
      select(id)
    } else {
      changeBelow(scope, (held) => ({ ...held, observations: seenAgain(held.observations, id, date, note) }), () => select(nodeKey(id, scope)))
    }
  }
  const seenObservation = seeing
    ? (seeing.scope === undefined ? work.observations : below.find((one) => one.scope === seeing.scope)?.observations ?? []).find((one) => one.id === seeing.id)
    : undefined

  const context: LinkContext = { here: deps.path ?? '', below }
  const listsOf = (scope: string | undefined): { observations: readonly Observation[]; causes: readonly Cause[] } => (
    scope === undefined ? work : below.find((one) => one.scope === scope) ?? { observations: [], causes: [] }
  )
  const justRecorded = recorded && listsOf(recorded.scope).observations.find((one) => one.id === recorded.id)
  const spec = linking ? linkSpec(linking, { work, below, context, s, scopeLabel, nameOf, scopeName: deps.scopeName }) : undefined
  const createLinked: Parameters<typeof LinkDialog>[0]['onCreate'] = (draft, behind) => {
    if (!linking) return
    const target = linking
    const fresh = makeId('ca')
    // The dialog is what a link across a boundary is written in: a new cause here for one below.
    const madeIn = target.mode === 'org' ? undefined : target.scope
    const explains = target.mode === 'org' ? { id: target.id, ...(target.scope !== undefined ? { scope: target.scope } : {}) } : { id: target.id }
    setLinking(undefined)
    onCauses(madeIn, (causes) => addCauseLinked(causes, {
      draft, explains, behind: behind.map((one) => ({ causeId: one.key, strength: one.strength })), id: fresh, t: s,
    }), () => select(nodeKey(fresh, madeIn)))
  }
  const linkExisting = (key: string, strength: CauseLink['strength']) => {
    if (!linking) return
    const target = linking
    setLinking(undefined)
    if (target.mode === 'local') {
      const { id, scope } = splitKey(key)
      commit({ causes: linkCause(work.causes, target.id, { id, ...(scope !== undefined ? { scope } : {}), strength }, context) })
      return
    }
    if (target.mode === 'org') {
      commit({ causes: linkCause(work.causes, key, { id: target.id, ...(target.scope !== undefined ? { scope: target.scope } : {}), strength }, context) })
      select(key)
      return
    }
    onCauses(target.scope, (causes) => linkCause(causes, key, { id: target.id, strength }), () => select(nodeKey(key, target.scope)))
  }

  const scopes: FormScope[] = [
    { label: s('observation.formScopeHere', { name: deps.scopeName }), name: deps.scopeName, observations: work.observations, causes: work.causes },
    ...(onChangeBelow && deps.local ? below.map((one) => ({
      scope: one.scope, label: s('observation.formScopeBelow', { name: (deps.scopeTrail ?? scopeLabel)(one.scope) }), name: scopeLabel(one.scope),
      observations: one.observations, causes: one.causes,
    })) : []),
  ]

  const dialogs = (
    <>
      <SeenDialog
        subject={seeing && seenObservation ? { id: nodeKey(seeing.id, seeing.scope), label: nameOf(seeing.id, seeing.scope), firstSeen: seenObservation.date } : undefined}
        today={today()} onCancel={() => setSeeing(undefined)} onConfirm={seenFromForm} s={s}
      />
      <LinkDialog
        spec={spec} onCancel={() => setLinking(undefined)} onCreate={createLinked} onLink={linkExisting}
        renderMarkdown={deps.renderMarkdown} s={s}
      />
      <Snackbar
        open={notice !== undefined} message={notice} autoHideDuration={6000} onClose={() => setNotice(undefined)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }} data-testid="observation-notice"
      />
    </>
  )
  const panel = creating ? (
    <NewObservationPanel
      scopes={scopes} today={today()} onCancel={() => setCreating(false)}
      onRecord={record} onSeenAgain={(scope, id) => setSeeing({ id, ...(scope !== undefined ? { scope } : {}) })}
      renderMarkdown={deps.renderMarkdown} s={s}
    />
  ) : justRecorded && recorded ? (
    <RecordedPanel
      label={formatObservationNumber(justRecorded.number)} title={justRecorded.title} bright={toneOf(justRecorded) === 'bright'} s={s}
      onDone={() => setRecorded(undefined)}
      onAsk={() => { setRecorded(undefined); setAsking({ mode: 'cause', ids: [recorded.id], ...(recorded.scope !== undefined ? { scope: recorded.scope } : {}) }) }}
    />
  ) : asking ? (
    <WhyLadder
      key={`${asking.mode}:${asking.ids.join(',')}`}
      ask={asking} work={work} below={below} context={context} scopeName={deps.scopeName} scopeLabel={scopeLabel} makeId={makeId} s={s}
      {...(deps.readOnly ? {} : { write: onCauses })}
      rootStep={deps.rootStep}
      nameOf={nameOf}
      onPropose={deps.onPropose}
      onNext={setAsking}
      onSelect={select}
      onClose={() => setAsking(undefined)}
    />
  ) : undefined
  return {
    openNew: () => { setRecorded(undefined); setAsking(undefined); setCreating(true) },
    // The ladder asks what a dialog with two tabs asked; a link across a scope boundary is still that dialog's.
    openLink: (target) => {
      if (target.mode === 'org' || target.mode === 'local') { setLinking(target); return }
      setCreating(false); setRecorded(undefined)
      setAsking({
        mode: target.mode === 'cause' ? 'cause' : 'deeper', ids: [target.id],
        ...(target.scope !== undefined ? { scope: target.scope } : {}), ...(target.existing ? { existing: true as const } : {}),
      })
    },
    askGroup: (ids, scope) => { setCreating(false); setRecorded(undefined); setAsking({ mode: 'cause', ids, ...(scope !== undefined ? { scope } : {}) }) },
    panel,
    across: true,
    ...(onChangeBelow ? { changeBelow } : {}),
    scopes,
    dialogs,
  }
}

/** Where a change below went, in words: made there, or why not. */
function belowNotice(result: ChangedBelow, scope: string, s: Translate): string {
  if (result.ok) return s('observation.madeBelow', { scope })
  if (result.reason === 'readOnly') return s('observation.belowReadOnly', { scope })
  if (result.reason === 'shell.scopeReadOnly') return s('observation.belowNotYours', { scope })
  if (result.reason === 'gone' || result.reason === 'unchanged') return s('observation.belowNotMade', { scope })
  return s('observation.belowRefused', { scope })
}

/**
 * What the dialog is for, per mode: its words, the causes the rules let it
 * link, and where a new one is made. The candidates are asked of
 * `linkRefusal`, so what the page offers is what the rules allow.
 */
function linkSpec(target: LinkTarget, o: {
  work: ObservationWork
  below: readonly ScopeAnalysis[]
  context: LinkContext
  s: Translate
  scopeLabel: (path: string) => string
  nameOf: (id: string, scope?: string) => string
  scopeName: string
}): LinkSpec {
  const { s, work } = o
  const { mode, id, scope } = target
  // A merged cause is history (ADR-0035 §4): never offered, to link or to make a link from.
  const everyCause = (at: string | undefined): readonly Cause[] => (at === undefined ? work.causes : o.below.find((one) => one.scope === at)?.causes ?? [])
  const causesIn = (at: string | undefined): readonly Cause[] => liveCauses(everyCause(at))
  const candidate = (cause: Cause, at?: string): LinkCandidate => ({
    key: nodeKey(cause.id, at), title: cause.title, root: cause.root === true,
    label: `${causeLabel(cause)} ${cause.title}${at !== undefined ? ` (${o.scopeLabel(at)})` : ''}`,
  })
  const subject = o.nameOf(id, scope)
  const base = { id: nodeKey(id, scope), subject }
  if (mode === 'local') {
    const here = work.causes
    const own = here.find((one) => one.id === id)
    const candidates = o.below.flatMap((held) => liveCauses(held.causes)
      .filter((cause) => !cause.root && !own?.explains.some((link) => link.id === cause.id && link.scope === held.scope))
      .filter((cause) => linkRefusal(here, id, { id: cause.id, scope: held.scope }, o.context) === undefined)
      .map((cause) => candidate(cause, held.scope)))
    return { ...base, title: s('observation.linkLocalTitle', { name: subject }), intro: s('observation.linkLocalIntro'), candidates }
  }
  if (mode === 'org') {
    const here = causesIn(undefined)
    const candidates = here
      .filter((cause) => !cause.explains.some((link) => link.id === id && link.scope === scope))
      .filter((cause) => linkRefusal(here, cause.id, { id, ...(scope !== undefined ? { scope } : {}) }, o.context) === undefined)
      .map((cause) => candidate(cause))
    return {
      ...base, title: s('observation.linkOrgTitle', { name: subject, scope: o.scopeName }),
      intro: s('observation.linkOrgIntro', { scope: o.scopeName, below: scope !== undefined ? o.scopeLabel(scope) : o.scopeName }),
      candidates, create: { madeIn: o.scopeName, nextNumber: nextCauseNumber(work.causes), rootDefault: true, behind: here.map((cause) => candidate(cause)) },
    }
  }
  throw new Error(`The ladder asks ${mode}, not this dialog`)
}

/**
 * Who records, as the source says it (ADR-0038, amended §10): the account
 * where it has accounts, *This is me* where it has none, and nobody otherwise.
 */
function useRecordedBy(): RecordedBy | undefined {
  const register = usePersonNames().access
  const me = meIn(register?.me, registerOf(register?.people ?? []))
  return whoRecords(register?.account?.(), me?.name ? { id: me.id, name: me.name } : undefined)
}

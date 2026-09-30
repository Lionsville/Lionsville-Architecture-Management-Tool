// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The observations page's forms, and where what they make lands (ADR-0032
 * §2, §4, §6): the new observation with its causes, and the link dialog the
 * readers open for a cause, a deeper cause, a root cause, and a cause across
 * a scope boundary.
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
import { causeLabel, linkCause, linkRefusal, nextCauseNumber, seenAgain } from '../observation'
import type { Cause, CauseLink, LinkContext, ScopeAnalysis } from '../observation'
import { addCauseLinked, recordObservation } from '../form'
import { nodeKey } from '../graph'
import { LinkDialog } from './LinkForm'
import type { LinkCandidate, LinkSpec } from './LinkForm'
import { NewObservationDialog } from './ObservationForm'
import type { FormScope, RecordRequest } from './ObservationForm'
import type { LinkTarget } from './readerActions'
import type { ChangeBelow, ChangedBelow, ObservationWork } from './ObservationsPage'

import type { WorkChange } from './PageReaders'

/** The scope and the id a key names: `scope#id` for a record below, the bare id for one here. */
export function splitKey(key: string): { id: string; scope?: string } {
  const at = key.lastIndexOf('#')
  return at < 0 ? { id: key } : { scope: key.slice(0, at), id: key.slice(at + 1) }
}

export type AnalysisForms = {
  openNew: () => void
  openLink: (target: LinkTarget) => void
  /** Always: the link dialog takes a cause across a scope boundary, both ways. */
  across: true
  /** Land a change on a scope below and say where it went; absent where nothing below may be written. */
  changeBelow?: (scope: string, change: WorkChange, landed?: () => void) => void
  /** The scopes a new observation may be made in: this one, then those below where they may be written. */
  scopes: FormScope[]
  dialogs: ReactNode
}

export function useAnalysisForms(deps: {
  work: ObservationWork
  below: readonly ScopeAnalysis[]
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
  nameOf: (id: string, scope?: string) => string
  select: (key: string) => void
  renderMarkdown: (md: string, options?: MarkdownRenderOptions) => ReactNode
}): AnalysisForms {
  const { work, below, commit, makeId, today, s, scopeLabel, nameOf, select } = deps
  const [creating, setCreating] = useState(false)
  const [linking, setLinking] = useState<LinkTarget | undefined>(undefined)
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

  const record = (request: RecordRequest) => {
    setCreating(false)
    const args = { fields: request.fields, causes: request.causes, makeId, t: s }
    if (request.scope === undefined) {
      const made = recordObservation(work, args)
      commit(made.analysis)
      select(made.id)
      return
    }
    const scope = request.scope
    let id = ''
    changeBelow(scope, (held) => {
      const made = recordObservation(held, args)
      id = made.id
      return { ...held, ...made.analysis }
    }, () => select(nodeKey(id, scope)))
  }
  const seenFromForm = (scope: string | undefined, id: string) => {
    setCreating(false)
    if (scope === undefined) {
      commit({ observations: seenAgain(work.observations, id, today()) })
      select(id)
    } else {
      changeBelow(scope, (held) => ({ ...held, observations: seenAgain(held.observations, id, today()) }), () => select(nodeKey(id, scope)))
    }
  }

  const context: LinkContext = { here: deps.path ?? '', below }
  const spec = linking ? linkSpec(linking, { work, below, context, s, scopeLabel, nameOf, scopeName: deps.scopeName }) : undefined
  const createLinked: Parameters<typeof LinkDialog>[0]['onCreate'] = (draft, behind) => {
    if (!linking) return
    const target = linking
    const fresh = makeId('ca')
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
    { label: s('observation.formScopeHere', { name: deps.scopeName }), observations: work.observations, causes: work.causes },
    ...(onChangeBelow ? below.map((one) => ({
      scope: one.scope, label: s('observation.formScopeBelow', { name: scopeLabel(one.scope) }), observations: one.observations, causes: one.causes,
    })) : []),
  ]

  const dialogs = (
    <>
      <NewObservationDialog
        open={creating} scopes={scopes} today={today()} onCancel={() => setCreating(false)}
        onRecord={record} onSeenAgain={seenFromForm} renderMarkdown={deps.renderMarkdown} s={s}
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
  return {
    openNew: () => setCreating(true),
    openLink: setLinking,
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
  const causesIn = (at: string | undefined): readonly Cause[] => (at === undefined ? work.causes : o.below.find((one) => one.scope === at)?.causes ?? [])
  const candidate = (cause: Cause, at?: string): LinkCandidate => ({
    key: nodeKey(cause.id, at), title: cause.title, root: cause.root === true,
    label: `${causeLabel(cause)} ${cause.title}${at !== undefined ? ` (${o.scopeLabel(at)})` : ''}`,
  })
  const subject = o.nameOf(id, scope)
  const base = { id: nodeKey(id, scope), subject }
  if (mode === 'local') {
    const here = work.causes
    const own = here.find((one) => one.id === id)
    const candidates = o.below.flatMap((held) => held.causes
      .filter((cause) => !cause.root && !own?.explains.some((link) => link.id === cause.id && link.scope === held.scope))
      .filter((cause) => linkRefusal(here, id, { id: cause.id, scope: held.scope }, o.context) === undefined)
      .map((cause) => candidate(cause, held.scope)))
    return { ...base, title: s('observation.linkLocalTitle', { name: subject }), intro: s('observation.linkLocalIntro'), candidates }
  }
  if (mode === 'org') {
    const here = work.causes
    const candidates = here
      .filter((cause) => !cause.explains.some((link) => link.id === id && link.scope === scope))
      .filter((cause) => linkRefusal(here, cause.id, { id, ...(scope !== undefined ? { scope } : {}) }, o.context) === undefined)
      .map((cause) => candidate(cause))
    return {
      ...base, title: s('observation.linkOrgTitle', { name: subject, scope: o.scopeName }),
      intro: s('observation.linkOrgIntro', { scope: o.scopeName, below: scope !== undefined ? o.scopeLabel(scope) : o.scopeName }),
      candidates, create: { madeIn: o.scopeName, nextNumber: nextCauseNumber(here), rootDefault: true, behind: here.map((cause) => candidate(cause)) },
    }
  }
  const list = causesIn(scope)
  const allowed = list
    .filter((cause) => !cause.explains.some((link) => link.id === id && link.scope === undefined))
    .filter((cause) => mode === 'cause' || linkRefusal(list, cause.id, { id }) === undefined)
    .filter((cause) => (mode === 'deeper' ? !cause.root : mode === 'root' ? cause.root === true : true))
  const words = {
    cause: ['observation.linkCauseTitle', 'observation.linkCauseIntro'],
    deeper: ['observation.linkDeeperTitle', 'observation.linkDeeperIntro'],
    root: ['observation.linkRootTitle', 'observation.linkRootIntro'],
  } as const
  const [title, intro] = words[mode]
  return {
    ...base, title: s(title, { name: subject }), intro: s(intro),
    candidates: allowed.map((cause) => ({ ...candidate(cause), key: cause.id })),
    create: {
      madeIn: scope === undefined ? o.scopeName : o.scopeLabel(scope), nextNumber: nextCauseNumber(list),
      rootFixed: mode === 'root', rootDefault: false,
      behind: list.filter((cause) => cause.id !== id).map((cause) => ({ ...candidate(cause), key: cause.id })),
    },
  }
}

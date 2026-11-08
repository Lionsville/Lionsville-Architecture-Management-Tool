// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The open scope as the source it is kept in sees it: what is saved and
 * when, what the bar says about that, and the session handed to whoever
 * answers for the source.
 */
import { handOver, stepsSummary, unwatched, watchLanded } from './writeRefusals'
import type { WriteRefusal } from './writeRefusals'
import type { StepSummary } from '../model'
import type { ScopeStep } from '../projects/scopeState'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ShellError } from '../platform/errors'
import { imageEntryOf } from '../model/imageEntry'
import type { ImageRepository } from '../ports/ImageRepository'
import type { PendingSteps } from '../ports/PendingSteps'
import type { ScopeRepository } from '../ports/ScopeRepository'
import { keptAt, landed, nodeAt, snapshotOf } from '../projects/scopeAccess'
import type { ScopeReader } from '../projects/scopeAccess'
import type { ScopeSnapshot } from '../projects/scope'
import type { SourceStatus, SourceWork, SourceWorkChanged } from '../platform/sourceProvider'
import { useDocumentSession } from './useDocumentSession'
import { hasUnsavedWork } from '../projects/documentSession'
import type { DocumentSessionHook, LeftUnwritten, ScopeWriter } from './useDocumentSession'
import type { ModelSession, ScopeSession } from './useModelSession'
import type { KeepNotice } from './useKeepNotice'

export type WorkspaceDocument = {
  document: DocumentSessionHook
  /** When the store last took a save; kept through a failure (see below). */
  savedAt: Date | null
  /** The store is refusing now, whatever it last accepted. */
  saveFailed: boolean
  /** What it refused the last write with, while it is refusing. */
  refusedWith?: unknown
  /** The changes not written yet, a row each in the words the Activity list uses. */
  unwritten: () => readonly StepSummary[]
  /** Let go of them for the scope as it is kept; answers whether it could be read. */
  putBack: () => Promise<boolean>
}

/**
 * The steps not written, one change to a row, each with its words. A journal
 * line is one announcement of a step (`changeId`), and a typed sentence is many
 * of them folded into one step on the stack: one change to a person, one row.
 * Its words are its line in the Activity list where the session still has it,
 * else what its commands say.
 */
function changesOf(session: Pick<ModelSession, 'history'>, steps: readonly ScopeStep[]): { steps: ScopeStep[]; summary: StepSummary }[] {
  const stepOfFold = new Map<string, { stepId: string; summary: StepSummary }>()
  for (const one of session.history()) for (const fold of one.folds) stepOfFold.set(fold.changeId, one)
  const rows: { steps: ScopeStep[]; summary: StepSummary; of?: string }[] = []
  for (const step of steps) {
    const of = stepOfFold.get(step.stepId)
    const last = rows.at(-1)
    if (last && of && last.of === of.stepId) last.steps.push(step)
    else rows.push({ steps: [step], summary: of?.summary ?? stepsSummary([step.command]), ...(of ? { of: of.stepId } : {}) })
  }
  return rows
}

export function useWorkspaceDocument(deps: {
  session: ModelSession
  writer: ScopeWriter
  watch: ((onChanged: () => void) => () => void) | undefined
  sourceStatus: ((work: SourceWork) => SourceStatus) | undefined
  onSourceWork: SourceWorkChanged | undefined
  onUnsavedWork: ((unsaved: boolean) => void) | undefined
  onKeptResult: KeepNotice
  onTreeChanged: () => void
  /** How long an edit waits before it is written, where the source says. */
  writeAfterMs?: number | undefined
  /** Where the steps are held until written, where the source holds them. */
  pendingSteps?: PendingSteps | undefined
  /** The revision the scope was read at when it was opened. */
  openedAt?: string | undefined
}): WorkspaceDocument {
  const { session, writer, watch, sourceStatus, onSourceWork, onUnsavedWork, onKeptResult, onTreeChanged, writeAfterMs, pendingSteps, openedAt } = deps
  /**
   * What the bar says about saving. Two pieces of state, not one: the last
   * accepted time is worth keeping through a failure — it is the honest answer
   * to "how much did I lose" — but it must not be what is on screen while the
   * store is refusing.
   */
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)
  const [refusedWith, setRefusedWith] = useState<{ cause: unknown } | undefined>(undefined)
  // The cause is passed on rather than read here: the bar says the same thing
  // about a refused save whatever refused it, and what the notice SAYS is the
  // source's business (`useKeepNotice`).
  const onSaveResult = useCallback((ok: boolean, cause?: unknown) => {
    setSaveFailed(!ok)
    setRefusedWith(ok ? undefined : { cause })
    onKeptResult(ok, cause)
  }, [onKeptResult])

  /**
   * Leaving with changes the place would not take: each handed to the list
   * of refused writes, a row each, to be made again or put back from *Your
   * work* — the word stays *Not saved* until one or the other.
   */
  const onLeftUnwritten = useCallback<LeftUnwritten>((steps, cause) => {
    const scope = session.snapshot().path
    const refusals = changesOf(session, steps).map((change): Omit<WriteRefusal, 'id'> => ({
      cause, scope,
      summary: change.summary,
      // Made again over the scope as it stands: the person asked for this very change once more.
      retry: () => writer.write(change.steps).then(() => true, () => false),
    }))
    writer.handOver?.(refusals)
  }, [session, writer])

  const document = useDocumentSession({
    session,
    writer,
    // A browser tab has no watcher to say the tree changed, so a save is the
    // one moment it can learn that this scope's records now say something
    // else — a plan flagged an initiative reaches the organisation's roadmap
    // through the index, and the index is read again only when asked.
    onSaved: (at: Date) => { setSavedAt(at); if (!watch) onTreeChanged() },
    onResult: onSaveResult,
    ...(writer.handOver ? { onLeftUnwritten } : {}),
    watch,
    sourceStatus,
    onSourceWork,
    onUnsavedWork,
    ...(writeAfterMs !== undefined ? { writeAfterMs } : {}),
    ...(pendingSteps ? { pendingSteps } : {}),
    openedAt,
    // Their version, once it has been read: straight onto the session, without
    // a relayout — a project read back from its folder carries its geometry.
    onAdopt: useCallback((held: ScopeSnapshot) => session.adopt(held, false), [session]),
  })
  const unwritten = useCallback(
    () => changesOf(session, session.journal.pending().map(({ stepId, command, at }) => ({ stepId, command, at }))).map((change) => change.summary),
    [session],
  )
  /**
   * A change an earlier session of this scope handed over, landed from *Your
   * work* while the scope is open again: this session holds the scope as it
   * was, and nothing here would read it — the place's own watch does not tell
   * a window of its own writes. Read now, where nothing of this session's is
   * waiting to be written; otherwise the next write meets the scope moved,
   * and the person is asked. Read once for the whole of a *Try all again*,
   * after its last change has landed: a read on each landing put the first
   * on screen and left the rest to a session that by then had a write of
   * its own under way, so they stayed on disk alone.
   */
  const shown = useRef(document)
  shown.current = document
  useEffect(() => writer.watchHandedLanded?.(() => {
    const { state, takeTheirs: take } = shown.current
    if (!hasUnsavedWork(state) && state.status !== 'saving') void take()
  }), [writer])

  // Put back: the scope as it is kept, read over what was not written. Nothing is refused any more, so nothing is said.
  const { takeTheirs } = document
  const putBack = useCallback(() => takeTheirs().then((taken) => {
    if (taken) { setSaveFailed(false); setRefusedWith(undefined) }
    return taken
  }), [takeTheirs])
  return { document, savedAt, saveFailed, ...(saveFailed && refusedWith ? { refusedWith: refusedWith.cause } : {}), unwritten, putBack }
}

/**
 * The session over this scope, handed to whoever answers for the source it is
 * kept in — and taken back when this workspace goes. What comes back is who
 * else has this scope open, as that end last said: empty for all three
 * sources that ship — there is nobody else to be — and the bar says nothing
 * then. Per mount, like everything else about one scope.
 *
 * Narrow on purpose: the seam, the one way in, the model as it stands, the log
 * and the revision — and not the libraries, the pictures or a single dialog.
 * The model is read through the two functions the session's own actions use,
 * because a command is built against the indexed model and an id is minted
 * against what it says is taken; a copy handed over per render would be a
 * second model, one render behind. Memoised on the pieces
 * rather than on `session`, which is a fresh object every render: what is on
 * the other end may be holding a connection open, and dropping and remaking
 * it on every keystroke is not a thing to do by accident.
 */
export function useScopeSessionSeam(
  project: ScopeSnapshot,
  session: ModelSession,
  onScopeSession: ((session: ScopeSession) => (() => void) | void) | undefined,
  flush?: () => Promise<void>,
): readonly string[] {
  const [alsoHere, setAlsoHere] = useState<readonly string[]>([])
  // Through a ref: the write it asks for moves with every edit, and the
  // session handed out must not.
  const flushing = useRef(flush)
  flushing.current = flush
  const scopeSession = useMemo<ScopeSession>(() => ({
    scope: project.path,
    steps: session.steps,
    dispatch: session.dispatch,
    current: session.current,
    indexed: session.indexed,
    history: session.history,
    revision: session.revision,
    ...(project.revision !== undefined ? { openedFrom: project.revision } : {}),
    alsoHere: setAlsoHere,
    flush: () => flushing.current?.() ?? Promise.resolve(),
  }), [
    project.path, project.revision, session.steps, session.dispatch,
    session.current, session.indexed, session.history, session.revision,
  ])
  useEffect(() => onScopeSession?.(scopeSession), [onScopeSession, scopeSession])
  return alsoHere
}

/**
 * Where the open scope is written: steps applied to it by its identity, which
 * a move does not change, and a read of it as it is kept now.
 *
 * A scope entered with no identity yet — handed in by address, as a test or a
 * boot that read it by address does — is looked up by its address the first
 * time it is written.
 */
export function useScopeWriter(
  watchedScopes: ScopeReader & Pick<ScopeRepository, 'apply'>, watchedImages: Pick<ImageRepository, 'put'>, project: ScopeSnapshot,
): ScopeWriter {
  const { id, path } = project
  return useMemo<ScopeWriter>(() => {
    // The session says its own failures, and makes its own writes again: the watch is for everything else.
    const scopes = unwatched(watchedScopes)
    const images = unwatched(watchedImages)
    let known = id
    const identity = async (): Promise<string> => {
      known ??= nodeAt(await scopes.tree(), path)?.id
      if (known === undefined) throw new ShellError('shell.scopeGone')
      return known
    }
    return {
      handOver: (refusals) => { handOver(watchedScopes, refusals) },
      // Handed over by an earlier session of this scope, by its address; or a write to it from elsewhere — a view renamed on its home — by its identity.
      watchHandedLanded: (listener) => watchLanded(watchedScopes, (landed) => {
        if (landed.some((one) => one.scope === path || (known !== undefined && one.scopeIds?.includes(known) === true))) listener()
      }),
      write: async (steps, expects) => {
        const scope = await identity()
        return landed(await scopes.apply([{ scope, steps, ...(expects !== undefined ? { expects } : {}) }])).revisions[0]
      },
      read: async () => {
        const state = await scopes.state(await identity())
        return state && snapshotOf(state)
      },
      put: async (name, bytes) => {
        // Under the address the repository kept the bytes at: the one a
        // picture is found by.
        const contentAddress = keptAt(await images.put(await identity(), name, bytes))
        return { ...await imageEntryOf(name, bytes), contentAddress }
      },
    }
  }, [watchedScopes, watchedImages, id, path])
}

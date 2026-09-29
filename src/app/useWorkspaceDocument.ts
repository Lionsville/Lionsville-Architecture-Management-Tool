// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The open scope as the source it is kept in sees it: what is saved and
 * when, what the bar says about that, and the session handed to whoever
 * answers for the source.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ShellError } from '../platform/errors'
import { imageEntryOf } from '../model/imageEntry'
import type { ImageRepository } from '../ports/ImageRepository'
import type { ScopeRepository } from '../ports/ScopeRepository'
import { keptAt, landed, nodeAt, snapshotOf } from '../projects/scopeAccess'
import type { ScopeReader } from '../projects/scopeAccess'
import type { ScopeSnapshot } from '../projects/scope'
import type { SourceStatus, SourceWork, SourceWorkChanged } from '../platform/sourceProvider'
import { useDocumentSession } from './useDocumentSession'
import type { DocumentSessionHook, ScopeWriter } from './useDocumentSession'
import type { ModelSession, ScopeSession } from './useModelSession'
import type { KeepNotice } from './useKeepNotice'

export type WorkspaceDocument = {
  document: DocumentSessionHook
  /** When the store last took a save; kept through a failure (see below). */
  savedAt: Date | null
  /** The store is refusing now, whatever it last accepted. */
  saveFailed: boolean
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
}): WorkspaceDocument {
  const { session, writer, watch, sourceStatus, onSourceWork, onUnsavedWork, onKeptResult, onTreeChanged } = deps
  /**
   * What the bar says about saving. Two pieces of state, not one: the last
   * accepted time is worth keeping through a failure — it is the honest answer
   * to "how much did I lose" — but it must not be what is on screen while the
   * store is refusing.
   */
  const [savedAt, setSavedAt] = useState<Date | null>(null)
  const [saveFailed, setSaveFailed] = useState(false)
  // The cause is passed on rather than read here: the bar says the same thing
  // about a refused save whatever refused it, and what the notice SAYS is the
  // source's business (`useKeepNotice`).
  const onSaveResult = useCallback((ok: boolean, cause?: unknown) => {
    setSaveFailed(!ok)
    onKeptResult(ok, cause)
  }, [onKeptResult])

  const document = useDocumentSession({
    session,
    writer,
    // A browser tab has no watcher to say the tree changed, so a save is the
    // one moment it can learn that this scope's records now say something
    // else — a plan flagged an initiative reaches the organisation's roadmap
    // through the index, and the index is read again only when asked.
    onSaved: (at: Date) => { setSavedAt(at); if (!watch) onTreeChanged() },
    onResult: onSaveResult,
    watch,
    sourceStatus,
    onSourceWork,
    onUnsavedWork,
    // Their version, once it has been read: straight onto the session, without
    // a relayout — a project read back from its folder carries its geometry.
    onAdopt: useCallback((held: ScopeSnapshot) => session.adopt(held, false), [session]),
  })
  return { document, savedAt, saveFailed }
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
): readonly string[] {
  const [alsoHere, setAlsoHere] = useState<readonly string[]>([])
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
  scopes: ScopeReader & Pick<ScopeRepository, 'apply'>, images: Pick<ImageRepository, 'put'>, project: ScopeSnapshot,
): ScopeWriter {
  const { id, path } = project
  return useMemo<ScopeWriter>(() => {
    let known = id
    const identity = async (): Promise<string> => {
      known ??= nodeAt(await scopes.tree(), path)?.id
      if (known === undefined) throw new ShellError('shell.scopeGone')
      return known
    }
    return {
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
  }, [scopes, images, id, path])
}

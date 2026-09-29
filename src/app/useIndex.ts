// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The organisation's index, held read-only (ADR-0012 §2, §10).
 *
 * A session opens ONE scope and edits it through the command stack. It also
 * holds the index — who owns which id across the whole tree — and holds it
 * read-only: nothing a keystroke does writes to it, and nothing it says is
 * saved anywhere. It is derived, and it is derived from files this session is
 * not editing.
 *
 * **Read twice, and never per keystroke.** Once when the app starts — or when
 * the repositories it reads from are swapped, which is how the desktop opens a
 * folder after the boot — and again when the source says the tree changed.
 * *Again* is a question about what changed since the index it holds
 * (`OrganisationIndex.since`), and the whole index is read only where the
 * repository cannot say. That is the whole schedule, and it is what
 * the budget line in `model/testing/` is written against: a rebuild is a pass
 * over every scope's records, which is tens of milliseconds and must not
 * happen while somebody is typing a name. The open scope's own edits are not a
 * reason to rebuild — the session answers for its own document, and the index
 * answers for everyone else's.
 *
 * **The watcher already coalesces**, so there is no timer here. The desktop
 * collects a burst of file events for 120 ms before reporting one
 * (`electron/main/watch.ts`), and a save is one report; what this adds is the
 * guard the watcher cannot give — a rebuild already in flight is not started
 * again, it is queued once, so twenty scopes arriving in three reports is two
 * passes rather than three.
 *
 * A rebuild that fails leaves the index that was there. The alternative is an
 * empty one, and an empty index says every stand-in in the tree is dangling
 * and every application is unowned — findings about a read that did not
 * happen, drawn over work that is perfectly fine.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { IndexChanges, IndexedScope, IndexRead, OrganisationIndex } from '../ports/OrganisationIndex'
import { EMPTY_INDEX, indexScopes } from '../projects/scopeIndex'
import type { ScopeIndex } from '../projects/scopeIndex'
import { modelOf } from '../projects/scopeAccess'
import type { ScopeModel } from '../projects/scope'
import type { Revision } from '../projects/scopeState'

export type IndexHook = {
  /**
   * The tree as it was last read.
   *
   * Never a promise and never absent: an index over nothing is a perfectly
   * good answer to every question — it has never heard of any id, so every
   * scope answers for its own records, which is what this app did before the
   * tree had an index at all. That is why nothing below has a loading state.
   */
  index: ScopeIndex
  /**
   * What the index was built from: every scope's records, rows, plans and
   * observations as the same read had them (ADR-0012 §2). Kept rather than
   * read again, because the search over the tree (ADR-0029) asks for it on a
   * keystroke — and the same objects from one read to the next are what its
   * folds are cached against. Empty exactly when the index is.
   */
  models: readonly ScopeModel[]
  /** Read the tree again. What the watcher calls, and what a write can call. */
  refresh: () => void
}

export function useIndex(deps: {
  /** Where the tree's records are read from: the source's index (ADR-0031 §1). */
  index: OrganisationIndex
  /**
   * Tell me when anything in the working directory changed, other than by us.
   *
   * The WHOLE directory and not the open scope: a sibling domain renaming its
   * ERP changes what this scope's stand-in of it should say, and a watcher
   * bound to the open scope would never hear of it. Absent in a browser tab,
   * where nothing can watch, and the index is then as old as the boot.
   */
  watch?: (onChanged: () => void) => () => void
  /** Where a failed read goes. No message: an index is nothing a person asked for. */
  onFailure: (where: string, cause: unknown) => void
}): IndexHook {
  const { index, watch, onFailure } = deps
  const [held, setHeld] = useState<{ index: ScopeIndex; models: readonly ScopeModel[] }>(NOTHING_READ)
  /** What was read last, by identity, and the revision it was read at: what `since` is asked from. */
  const kept = useRef<Held | undefined>(undefined)

  // Read through refs so `refresh` keeps one identity for the life of the
  // hook: it is handed to the watcher, and a new function per render would be
  // a fresh subscription per render.
  const source = useRef(index)
  source.current = index
  const failed = useRef(onFailure)
  failed.current = onFailure

  const live = useRef(true)
  const reading = useRef(false)
  const again = useRef(false)

  const read = useCallback(() => {
    if (reading.current) { again.current = true; return }
    reading.current = true
    // Built inside the chain, so a fold that throws is the failure below and
    // not an exception out of a callback nobody awaits.
    void readIndex(source.current, kept.current).then((read) => {
      if ('unchanged' in read) {
        if (kept.current) kept.current = { ...kept.current, revision: read.unchanged }
        return undefined
      }
      kept.current = { revision: read.revision, scopes: new Map(read.scopes.map((one) => [one.id, one])) }
      const models = read.scopes.map(modelOf)
      return { index: indexScopes(models), models }
    }).then(
      (built) => {
        reading.current = false
        if (built && live.current) setHeld(built)
        if (again.current) { again.current = false; read() }
      },
      (cause: unknown) => {
        reading.current = false
        again.current = false
        // The index that was there stands. See the note at the top.
        failed.current('index', cause)
      },
    )
  }, [])

  // On `index` and not only on mount: the desktop opens a folder by rendering
  // the same `App` again over the folder's repositories, and an index read
  // once over the boot's empty ones would stand for the whole session — every
  // stand-in dangling, every application unowned, and the map's columns said
  // by their ids.
  useEffect(() => {
    live.current = true
    kept.current = undefined
    read()
    return () => { live.current = false }
  }, [index, read])

  useEffect(() => {
    if (!watch) return undefined
    return watch(read)
  }, [watch, read])

  return { index: held.index, models: held.models, refresh: read }
}

const NOTHING_READ = { index: EMPTY_INDEX, models: [] }

type Held = { revision: Revision; scopes: ReadonlyMap<string, IndexedScope> }

/**
 * The index as it now stands: what changed since the one held, folded over
 * it, where the repository can say — and the whole of it where it cannot, or
 * where nothing is held yet.
 *
 * Nothing changed is its own answer. The index held then stands as it is, the
 * same object and not an equal one rebuilt: a rebuild is a pass over every
 * scope's records, and a new identity would have every reader memoised on the
 * index — the checks, the search's folds, the owners' descriptions — work it
 * all out again for a tree that did not move.
 */
async function readIndex(index: OrganisationIndex, held: Held | undefined): Promise<IndexRead | { unchanged: Revision }> {
  const changes = held && await index.since(held.revision)
  if (!changes) return index.read()
  if (changes.changed.length === 0 && changes.removed.length === 0) return { unchanged: changes.revision }
  return { revision: changes.revision, scopes: folded(held.scopes, changes) }
}

function folded(held: ReadonlyMap<string, IndexedScope>, changes: IndexChanges): IndexedScope[] {
  const next = new Map(held)
  for (const id of changes.removed) next.delete(id)
  for (const scope of changes.changed) next.set(scope.id, scope)
  return [...next.values()]
}

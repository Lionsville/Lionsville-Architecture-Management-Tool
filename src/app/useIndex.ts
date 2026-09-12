/**
 * The organisation's index, held read-only (ADR-0012 §2, §10).
 *
 * A session opens ONE scope and edits it through the command stack. It also
 * holds the index — who owns which id across the whole tree — and holds it
 * read-only: nothing a keystroke does writes to it, and nothing it says is
 * saved anywhere. It is derived, and it is derived from files this session is
 * not editing.
 *
 * **Read twice, and never per keystroke.** Once when the app starts, and again
 * when the folder changes under us. That is the whole schedule, and it is what
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
import { EMPTY_INDEX, indexOf } from '../projects/scopeIndex'
import type { IndexSource, ScopeIndex } from '../projects/scopeIndex'

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
  /** Read the tree again. What the watcher calls, and what a write can call. */
  refresh: () => void
}

export function useIndex(deps: {
  /** Where the tree is read from — `models()` where a store has it, loads where not. */
  scopes: IndexSource
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
  const { scopes, watch, onFailure } = deps
  const [index, setIndex] = useState<ScopeIndex>(EMPTY_INDEX)

  // Read through refs so `refresh` keeps one identity for the life of the
  // hook: it is handed to the watcher, and a new function per render would be
  // a fresh subscription per render.
  const source = useRef(scopes)
  source.current = scopes
  const failed = useRef(onFailure)
  failed.current = onFailure

  const live = useRef(true)
  const reading = useRef(false)
  const again = useRef(false)

  const read = useCallback(() => {
    if (reading.current) { again.current = true; return }
    reading.current = true
    void indexOf(source.current).then(
      (held) => {
        reading.current = false
        if (live.current) setIndex(held)
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

  useEffect(() => {
    live.current = true
    read()
    return () => { live.current = false }
  }, [read])

  useEffect(() => {
    if (!watch) return undefined
    return watch(read)
  }, [watch, read])

  return { index, refresh: read }
}

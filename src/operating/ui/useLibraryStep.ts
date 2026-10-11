// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The operating model page's way in from a library (ADR-0036, amended 11
 * October 2026): which library the dialog is open on, the step it settles
 * dispatched, what that step made marked new until the page is left, and the
 * toast that says so with *Undo*.
 *
 * *Undo* takes back that step and nothing else: the host answers, straight
 * after the step is dispatched, what undoes it while it is still the newest
 * (`undoStep`), so a toast pressed after somebody — or something — has taken
 * another step says it was not undone rather than taking theirs back.
 */
import { useEffect, useRef, useState } from 'react'
import type { Command } from '../../model/commands'
import type { Brought } from './LibraryDialog'
import { addedBy } from './libraryCards'

/** What the toast says: a step brought in, with its undo where the host offers one; or that an undo came too late. */
export type Landed =
  | { readonly key: number; readonly kind: 'brought'; readonly brought: Brought; readonly ids: ReadonlySet<string>; readonly undo?: () => boolean }
  | { readonly key: number; readonly kind: 'notUndone' }

export type LibraryStep = {
  /** The dialog's library while it is open; nothing while it is shut. */
  readonly asking: { readonly libraryId?: string } | undefined
  open(libraryId?: string): void
  close(): void
  /** Dispatch the step the dialog settled, and say so. */
  bring(brought: Brought): void
  /** What a library brought in since the page was opened, by id. */
  readonly fresh: ReadonlySet<string>
  readonly landed: Landed | undefined
  /** The toast's *Undo*. */
  undo(): void
  /** The toast closed, or timed out. */
  dismiss(): void
}

export function useLibraryStep({ pageOpen, dispatch, undoStep }: {
  /** The page is up; leaving it forgets what was new. */
  pageOpen: boolean
  dispatch(command: Command): void
  undoStep?: (() => () => boolean) | undefined
}): LibraryStep {
  const [asking, setAsking] = useState<{ libraryId?: string } | undefined>(undefined)
  const [fresh, setFresh] = useState<ReadonlySet<string>>(() => new Set())
  const [landed, setLanded] = useState<Landed | undefined>(undefined)
  const seq = useRef(0)
  useEffect(() => {
    if (pageOpen) return
    setAsking(undefined)
    setFresh(new Set())
    setLanded(undefined)
  }, [pageOpen])
  const bring = (brought: Brought) => {
    dispatch(brought.step)
    const undo = undoStep?.()
    const ids = addedBy(brought.step)
    setFresh((held) => new Set([...held, ...ids]))
    seq.current += 1
    setLanded({ key: seq.current, kind: 'brought', brought, ids, ...(undo ? { undo } : {}) })
    setAsking(undefined)
  }
  const undo = () => {
    if (landed?.kind !== 'brought' || !landed.undo) return
    seq.current += 1
    if (!landed.undo()) {
      setLanded({ key: seq.current, kind: 'notUndone' })
      return
    }
    const gone = landed.ids
    setFresh((held) => new Set([...held].filter((id) => !gone.has(id))))
    setLanded(undefined)
  }
  return {
    asking,
    open: (libraryId) => setAsking(libraryId === undefined ? {} : { libraryId }),
    close: () => setAsking(undefined),
    bring,
    fresh,
    landed,
    undo,
    dismiss: () => setLanded(undefined),
  }
}

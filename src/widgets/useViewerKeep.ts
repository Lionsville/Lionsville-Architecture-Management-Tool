// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Something a person left a view at, remembered as theirs and not the work's:
 * the shell keeps it with the other preferences and hands it down here. With
 * nothing handed down (a test, a page drawn alone) it lasts as long as the page.
 *
 * What comes back was written by an earlier version as readily as by this one, so
 * the caller says what it will accept, and anything else is nothing kept.
 */
import { createContext, useCallback, useContext, useState } from 'react'

export type ViewerKeep = {
  read(key: string): unknown
  keep(key: string, value: unknown): void
}

const ViewerKeepContext = createContext<ViewerKeep | undefined>(undefined)

export const ViewerKeepProvider = ViewerKeepContext.Provider

export function useViewerKeep<T>(key: string, accept: (held: unknown) => T | undefined, first: () => T): [T, (next: T) => void] {
  const keep = useContext(ViewerKeepContext)
  const [value, setValue] = useState<T>(() => accept(keep?.read(key)) ?? first())
  const set = useCallback((next: T) => {
    setValue(next)
    keep?.keep(key, next)
  }, [keep, key])
  return [value, set]
}

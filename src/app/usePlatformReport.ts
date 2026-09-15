/**
 * A platform's report, wired to the session (ADR-0013, redone).
 *
 * Almost nothing, which is the point. The first cut made this a view kind:
 * a diagram record, a tab in the strip, a page that had to be created before
 * it could be read, and a second one impossible to make about the same bus.
 * None of that bought anything — the report is derived from the rows every
 * time it opens, so the only state there is, is which platform is being read.
 *
 * Nothing is written from it either. What a person changes about a platform is
 * changed where the rows are, on the board.
 */
import { useCallback, useState } from 'react'
import type { ElementId } from '../model'

export type PlatformReading = {
  /** The platform being read, or nothing. */
  platformId: ElementId | undefined
  open: (platformId: ElementId) => void
  close: () => void
}

export function usePlatformReport(): PlatformReading {
  const [platformId, setPlatformId] = useState<ElementId | undefined>(undefined)
  const close = useCallback(() => setPlatformId(undefined), [])
  return { platformId, open: setPlatformId, close }
}

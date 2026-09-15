/**
 * A platform's report, and a service's, wired to the session (ADR-0013,
 * redone; ADR-0014).
 *
 * Almost nothing, which is the point. The first cut made this a view kind:
 * a diagram record, a tab in the strip, a page that had to be created before
 * it could be read, and a second one impossible to make about the same bus.
 * None of that bought anything — a report is derived from the rows every
 * time it opens, so the only state there is, is which platform or which
 * service is being read. One of the two at a time: the pages are the same
 * page from either side of the `realises` row, and opening one closes the
 * other.
 *
 * Nothing is written from either. What a person changes about a platform or
 * a service is changed where the rows are, on the board.
 */
import { useCallback, useState } from 'react'
import type { ElementId } from '../model'

export type PlatformReading = {
  /** The platform being read, or nothing. */
  platformId: ElementId | undefined
  /** The service being read, or nothing. */
  serviceId: ElementId | undefined
  open: (platformId: ElementId) => void
  openService: (serviceId: ElementId) => void
  close: () => void
}

export function usePlatformReport(): PlatformReading {
  const [reading, setReading] = useState<{ platformId?: ElementId; serviceId?: ElementId }>({})
  const open = useCallback((platformId: ElementId) => setReading({ platformId }), [])
  const openService = useCallback((serviceId: ElementId) => setReading({ serviceId }), [])
  const close = useCallback(() => setReading({}), [])
  return { platformId: reading.platformId, serviceId: reading.serviceId, open, openService, close }
}

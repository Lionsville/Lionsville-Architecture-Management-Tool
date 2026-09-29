// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The pictures a renderer draws, written down while a report renders
 * (`pictureReport.ts`).
 *
 * Only inside {@link CollectPictures}: a page that is not a report has no
 * collector above it, and a picture it draws writes nothing down.
 */
import { createContext, useContext, useEffect } from 'react'
import type { ReactNode } from 'react'
import type { ImageEntry } from '../../model/imageName'

const Collecting = createContext<((entry: ImageEntry) => void) | undefined>(undefined)

/** Every library picture drawn below is handed to `onDrawn`. Keep it stable. */
export function CollectPictures({ onDrawn, children }: { onDrawn: (entry: ImageEntry) => void; children: ReactNode }) {
  return <Collecting.Provider value={onDrawn}>{children}</Collecting.Provider>
}

/** A picture drawn from the library, said to the report collecting, where one is. */
export function useDrawnPicture(entry: ImageEntry | undefined): void {
  const collect = useContext(Collecting)
  useEffect(() => {
    if (entry && collect) collect(entry)
  }, [entry, collect])
}

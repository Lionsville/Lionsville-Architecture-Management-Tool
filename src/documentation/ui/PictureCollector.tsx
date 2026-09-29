// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The pictures a renderer draws, written down while a report renders
 * (`pictureReport.ts`).
 *
 * Only inside {@link CollectPictures}: a page that is not a report has no
 * collector above it, and a picture it draws writes nothing down.
 *
 * **Written down as it is drawn**, in the render itself rather than after it,
 * so a render that runs no effects — `renderToStaticMarkup`, or one that is
 * never committed — still says every picture, and the list is whole the
 * moment the render returns. Drawing a picture twice writes it down once.
 */
import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import type { ImageEntry } from '../../model/imageName'

type Collect = (scope: string, entry: ImageEntry) => void

const Collecting = createContext<Collect | undefined>(undefined)

/** Every library picture drawn below is handed to `onDrawn`, with the scope whose library it is in. */
export function CollectPictures({ onDrawn, children }: { onDrawn: Collect; children: ReactNode }) {
  return <Collecting.Provider value={onDrawn}>{children}</Collecting.Provider>
}

/** A picture drawn from a scope's library, said to the report collecting, where one is. */
export function useDrawnPicture(scope: string, entry: ImageEntry | undefined): void {
  const collect = useContext(Collecting)
  if (entry && collect) collect(scope, entry)
}

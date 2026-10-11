// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A view shown in a document: `![caption](view:<id>)`.
 *
 * A drawing is its picture, the same bytes a drawing view asks for, with one
 * transparent button per shape that points at an element. Choosing a button
 * opens that element through the destination the host was given — the one
 * `app.open` takes for an element. A view of another kind has no picture of
 * its own yet, and a view that is not in this scope says so. Both keep the
 * caption.
 */
import { createContext, useCallback, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import type { DesignDiagram } from '../../model/types'
import { useStrings } from '../../i18n/LanguageContext'
import type { ViewSource } from '../viewRef'
import { DrawingPicture } from './DrawingPicture'
import { useContentPicture } from './useContentPicture'
import type { PictureBytes } from './useContentPicture'

type ViewEmbeds = {
  view(id: string): DesignDiagram | undefined
  bytesAt(address: string): Promise<PictureBytes | undefined>
  /** Open an element the way `app.open` opens one: `{ page: 'element', id }`. */
  openElement(elementId: string): void
  nameOf(elementId: string): string
}

const NONE: ViewEmbeds = {
  view: () => undefined,
  bytesAt: () => Promise.resolve(undefined),
  openElement: () => undefined,
  nameOf: (id) => id,
}

const ViewEmbedsContext = createContext<ViewEmbeds>(NONE)

export function ViewEmbedsProvider({ diagrams, bytesAt, openElement, nameOf, children }: {
  diagrams: readonly DesignDiagram[]
  bytesAt: (address: string) => Promise<PictureBytes | undefined>
  openElement: (elementId: string) => void
  nameOf?: (elementId: string) => string
  children: ReactNode
}) {
  const byId = useMemo(() => {
    const map = new Map<string, DesignDiagram>()
    for (const diagram of diagrams) map.set(diagram.id, diagram)
    return map
  }, [diagrams])
  const view = useCallback((id: string) => byId.get(id), [byId])
  const named = useCallback((id: string) => nameOf?.(id) ?? id, [nameOf])
  const value = useMemo<ViewEmbeds>(
    () => ({ view, bytesAt, openElement, nameOf: named }),
    [view, bytesAt, openElement, named],
  )
  return <ViewEmbedsContext.Provider value={value}>{children}</ViewEmbedsContext.Provider>
}

/** The caption, and the words for a view that is not shown as a picture. */
function ViewWords({ caption, words, testId }: { caption: string; words: string; testId: string }) {
  return (
    <Box component="span" data-testid={testId} sx={{ color: 'text.secondary' }}>
      {caption ? <Box component="span" sx={{ fontStyle: 'normal', color: 'text.primary' }}>{caption} — </Box> : null}
      <Box component="span" sx={{ fontStyle: 'italic' }}>{words}</Box>
    </Box>
  )
}

/**
 * One `view:` picture. The id has already been read off the source; a
 * reference to another scope arrives as `{ missing: true }`.
 */
export function ViewEmbed({ source, caption }: { source: ViewSource; caption: string }) {
  const { t } = useStrings()
  const embeds = useContext(ViewEmbedsContext)
  const diagram = 'id' in source ? embeds.view(source.id) : undefined
  if (!('id' in source) || !diagram) {
    return <ViewWords caption={caption} words={t('doc.viewMissing')} testId="view-missing" />
  }
  if (diagram.kind !== 'drawing') {
    return <ViewWords caption={caption} words={t('doc.viewNoPicture')} testId="view-no-picture" />
  }
  return <DrawingEmbed diagram={diagram} caption={caption} embeds={embeds} />
}

function DrawingEmbed({ diagram, caption, embeds }: {
  diagram: DesignDiagram
  caption: string
  embeds: ViewEmbeds
}) {
  const { t } = useStrings()
  const address = diagram.drawing?.picture
  const shown = useContentPicture(address ? embeds.bytesAt : undefined, address)
  if (!address || shown === 'absent') {
    return <ViewWords caption={caption || diagram.name} words={t('doc.viewNotDrawn')} testId="view-not-drawn" />
  }
  if (!shown) return <Box component="span" data-testid="view-embed" data-view={diagram.id} data-state="loading" />
  return (
    <DrawingPicture
      url={shown.url}
      picture={shown.frame}
      xml={diagram.drawing?.xml ?? ''}
      links={diagram.drawing?.links ?? []}
      alt={caption || diagram.name}
      label={(elementId) => t('doc.openShape', { name: embeds.nameOf(elementId) })}
      onOpen={embeds.openElement}
      testIds={{ frame: 'view-embed', picture: 'view-picture', area: () => 'view-area' }}
    />
  )
}

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A view shown in a document: `![caption](view:<id>)`.
 *
 * A drawing is its picture, the same bytes a drawing view asks for, with one
 * transparent button per shape that points at an element. Choosing a button
 * opens that element through the destination the host was given — the one
 * `app.open` takes for an element. Every other kind is drawn live, read-only,
 * by the host's own drawing of it (`live`), so it is the view as it is now in
 * the reader's theme; where the host draws none, it says it has no picture.
 * Under every view a caption names it and opens it. A view that is not in
 * this scope says so.
 */
import { createContext, useCallback, useContext, useMemo } from 'react'
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Link from '@mui/material/Link'
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
  /** A view drawn live and read-only, where the host can draw its kind. */
  live?(diagram: DesignDiagram): ReactNode
  /** Open the view itself, from the caption under it. */
  openView?(diagramId: string): void
}

const NONE: ViewEmbeds = {
  view: () => undefined,
  bytesAt: () => Promise.resolve(undefined),
  openElement: () => undefined,
  nameOf: (id) => id,
}

const ViewEmbedsContext = createContext<ViewEmbeds>(NONE)

export function ViewEmbedsProvider({ diagrams, bytesAt, openElement, nameOf, live, openView, children }: {
  diagrams: readonly DesignDiagram[]
  bytesAt: (address: string) => Promise<PictureBytes | undefined>
  openElement: (elementId: string) => void
  nameOf?: (elementId: string) => string
  live?: (diagram: DesignDiagram) => ReactNode
  openView?: (diagramId: string) => void
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
    () => ({ view, bytesAt, openElement, nameOf: named, ...(live ? { live } : {}), ...(openView ? { openView } : {}) }),
    [view, bytesAt, openElement, named, live, openView],
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
  const drawn = diagram.kind === 'drawing'
    ? <DrawingEmbed diagram={diagram} caption={caption} embeds={embeds} />
    : embeds.live?.(diagram)
  if (!drawn) return <ViewWords caption={caption} words={t('doc.viewNoPicture')} testId="view-no-picture" />
  return (
    <Box component="span" data-testid="view-live" data-view={diagram.id} sx={{ display: 'block', my: '0.8em' }}>
      <Box component="span" sx={{ display: 'block', border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden', bgcolor: 'background.default' }}>{drawn}</Box>
      <ViewCaption diagram={diagram} caption={caption} onOpen={embeds.openView} />
    </Box>
  )
}

/** The line under a view: what it is called, and the way to it. */
function ViewCaption({ diagram, caption, onOpen }: { diagram: DesignDiagram; caption: string; onOpen: ((id: string) => void) | undefined }) {
  const { t } = useStrings()
  const name = caption || diagram.name
  return (
    <Box component="span" sx={{ display: 'flex', gap: 1, alignItems: 'baseline', mt: 0.5, fontSize: '0.8em', color: 'text.secondary' }}>
      <Box component="span" sx={{ flex: 1, minWidth: 0 }}>{name}</Box>
      {onOpen && (
        <Link component="button" type="button" underline="hover" onClick={() => onOpen(diagram.id)} data-testid="view-open" sx={{ fontSize: 'inherit', whiteSpace: 'nowrap' }}>
          {t('doc.viewOpen', { name: diagram.name })}
        </Link>
      )}
    </Box>
  )
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

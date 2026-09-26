// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The project's pictures, as every document in it reads them: descriptions,
 * decisions and plans alike, which is why this is answered by the workspace
 * and not by the page that asks — the page knows one board, and the session
 * knows the project.
 */
import { useCallback } from 'react'
import { decisionsOf, transitionsOf } from '../model'
import { transitionLabel } from '../model/transition'
import { formatAdrNumber } from '../decisions/adr'
import { documentsUsing, imageSrcFile } from '../documentation'
import type { MarkdownRenderOptions } from '../documentation'
import { renderMarkdown } from '../documentation/ui/renderMarkdown'
import type { ModelSession } from './useModelSession'

export type DocumentPictures = {
  /** Every document that shows a picture, by name. */
  imageUsedBy: (file: string) => readonly string[]
  /** The shared renderer, with this project's pictures behind it. */
  renderDocument: (md: string, options?: MarkdownRenderOptions) => ReturnType<typeof renderMarkdown>
}

export function useDocumentPictures(session: ModelSession): DocumentPictures {
  /**
   * The picture behind an image source, or nothing — which is the whole of the
   * "this app does not fetch" rule for documents (ADR-0009).
   *
   * Stable for the life of the workspace, deliberately: `MarkdownView` memoises
   * its component table on this function, so a new one per render would remount
   * every block in every document and redraw every mermaid diagram. It reads
   * the library through the session instead, and a picture just added shows
   * because adding one also writes a line into the document, which is what the
   * view actually re-renders on.
   */
  const resolveImage = useCallback((src: string): string | undefined => {
    const file = imageSrcFile(src)
    return file ? session.currentImages().find((image) => image.file === file)?.url : undefined
  }, [session])

  const imageUsedBy = useCallback((file: string): readonly string[] => {
    const model = session.indexed()
    return documentsUsing(file, [
      ...Object.values(model.elements).map((element) => ({ label: element.name, text: element.description ?? '' })),
      ...Object.values(decisionsOf(model)).map((adr) => ({ label: `${formatAdrNumber(adr.number)} ${adr.title}`, text: adr.body })),
      ...Object.values(transitionsOf(model)).map((plan) => ({ label: `${transitionLabel(plan)} ${plan.title}`, text: plan.body })),
    ])
  }, [session])

  const renderDocument = useCallback(
    (md: string, options?: MarkdownRenderOptions) => renderMarkdown(md, { ...options, resolveImage }),
    [resolveImage],
  )
  return { imageUsedBy, renderDocument }
}

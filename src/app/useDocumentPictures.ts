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
import { documentsUsing } from '../documentation'
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
  const imageUsedBy = useCallback((file: string): readonly string[] => {
    const model = session.indexed()
    return documentsUsing(file, [
      ...Object.values(model.elements).map((element) => ({ label: element.name, text: element.description ?? '' })),
      ...Object.values(decisionsOf(model)).map((adr) => ({ label: `${formatAdrNumber(adr.number)} ${adr.title}`, text: adr.body })),
      ...Object.values(transitionsOf(model)).map((plan) => ({ label: `${transitionLabel(plan)} ${plan.title}`, text: plan.body })),
    ])
  }, [session])

  const renderDocument = useCallback(
    (md: string, options?: MarkdownRenderOptions) => renderMarkdown(md, options),
    [],
  )
  return { imageUsedBy, renderDocument }
}

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The one function the editor is handed as `renderMarkdown`.
 *
 * A module-level constant rather than a closure made in the workspace: the
 * editor takes it as a prop, and a function that is the same object on every
 * render is one less reason for the inspector to re-render.
 */
import type { ComponentProps } from 'react'
import type { MarkdownRenderOptions } from '../documentation'
import { lazyPart } from '../../widgets/lazyPart'
import type { MarkdownView as MarkdownViewShape } from './MarkdownView'

/**
 * The markdown renderer and everything it parses with — the largest thing
 * the app draws text with — in a script of its own, fetched the first time a
 * description or a document is shown rather than before the first view
 * (`widgets/lazyPart`). Nothing is drawn while it arrives, which is a moment.
 */
const MarkdownView = lazyPart<ComponentProps<typeof MarkdownViewShape>>(
  () => import('./MarkdownView').then((held) => held.MarkdownView),
)

export function renderMarkdown(markdown: string, options?: MarkdownRenderOptions) {
  return (
    <MarkdownView
      markdown={markdown}
      onElementLink={options?.onElementLink}
      resolveImage={options?.resolveImage}
    />
  )
}

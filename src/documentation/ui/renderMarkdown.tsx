/**
 * The one function the editor is handed as `renderMarkdown`.
 *
 * A module-level constant rather than a closure made in the workspace: the
 * editor takes it as a prop, and a function that is the same object on every
 * render is one less reason for the inspector to re-render.
 */
import type { MarkdownRenderOptions } from '../documentation'
import { MarkdownView } from './MarkdownView'

export function renderMarkdown(markdown: string, options?: MarkdownRenderOptions) {
  return <MarkdownView markdown={markdown} onElementLink={options?.onElementLink} />
}

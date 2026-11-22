// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for the page: a description, read and written.
 *
 * The reader and the writer of a description's Markdown. Apart from the kit,
 * because the writer is not in the first download.
 *
 * A build composed from this one imports this entry and never the files behind
 * it (ADR-0022, amended), so those may move. Names only, each from the file
 * that holds it; `src/composed/SURFACE.txt` is what the whole offers.
 */
export { MarkdownEditor } from '../../documentation/ui/MarkdownEditor'
export { MarkdownView } from '../../documentation/ui/MarkdownView'
export { renderMarkdown } from '../../documentation/ui/renderMarkdown'

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for the page: the help's chapters.
 *
 * A build's own chapters added to the help, and what a chapter is.
 *
 * A build composed from this one imports this entry and never the files behind
 * it (ADR-0022, amended), so those may move. Names only, each from the file
 * that holds it; `src/composed/SURFACE.txt` is what the whole offers.
 */
export { forgetHelpChapters, helpOutline, loadHelpText, registerHelpChapters } from '../../help/registry'
export type { HelpChapterOutline, HelpText } from '../../help/types'

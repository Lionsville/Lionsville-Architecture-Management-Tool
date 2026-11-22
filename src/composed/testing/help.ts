// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for a suite: the help, searched.
 *
 * The help's outline and its search, for a suite that holds a build's own
 * chapters to them.
 *
 * A build composed from this one imports this entry and never the files behind
 * it (ADR-0022, amended), so those may move. Names only, each from the file
 * that holds it; `src/composed/SURFACE.txt` is what the whole offers.
 */
export { helpIndex, searchHelp } from '../../help/helpSearch'
export { CHAPTERS } from '../../help/outline'

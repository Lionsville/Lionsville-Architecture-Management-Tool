// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for a process with no screen: the app as a screen.
 *
 * Where the app is, where it may be sent and a place's address (ADR-0019,
 * ADR-0033): shared by the page and by a process that only names them.
 *
 * A build composed from this one imports this entry and never the files behind
 * it (ADR-0022, amended), so those may move. Names only, each from the file
 * that holds it; `src/composed/SURFACE.txt` is what the whole offers.
 */
export type { Place } from '../../agent/place'
export { HOME_PAGES, NEEDS_ID, arrived, scopeOf } from '../../agent/screen'
export type { Destination, MovedBy, Page, Screen } from '../../agent/screen'

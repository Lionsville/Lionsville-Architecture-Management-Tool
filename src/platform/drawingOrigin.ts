// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The origin the desktop serves the drawing editor on.
 *
 * One scheme, one host, named here so the window that frames it and the
 * process that serves it cannot spell it two ways. A browser build does not
 * use it: there the origin, when there is one, is the source's to say.
 */
export const DESKTOP_DRAWING_ORIGIN = 'drawing://local'

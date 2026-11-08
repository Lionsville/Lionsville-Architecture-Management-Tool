// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * An enterprise map is Coverage, a reading of the business sheet, wherever the
 * scope has a sheet for it to be a reading of: reached from the sheet's bar, its
 * address landing there. It takes no tab of its own then, in the workspace or
 * over a home, and a home lists it under the sheet. Where there is no sheet it
 * is a view like any other, since nothing else would reach it.
 */
import type { DesignDiagram } from './types'

type Kinded = { readonly kind: DesignDiagram['kind'] | (string & {}) }

export function isSheetReading(view: Kinded, views: readonly Kinded[]): boolean {
  return view.kind === 'map' && views.some((one) => one.kind === 'sheet')
}

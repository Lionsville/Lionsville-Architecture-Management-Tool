// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for the page: the guide's dock.
 *
 * The dock a guide is read in, its ring, and where it is kept on screen.
 * Apart from the kit, because it brings a stylesheet and is not in the first
 * download.
 *
 * A build composed from this one imports this entry and never the files behind
 * it (ADR-0022, amended), so those may move. Names only, each from the file
 * that holds it; `src/composed/SURFACE.txt` is what the whole offers.
 */
export { GuideDock, GuideRing } from '../../widgets/kit/GuideDock'
export type { GuideBox } from '../../widgets/kit/GuideDock'
export { keptOnScreen } from '../../widgets/kit/guidePlace'
export type { GuideOffset } from '../../widgets/kit/guidePlace'

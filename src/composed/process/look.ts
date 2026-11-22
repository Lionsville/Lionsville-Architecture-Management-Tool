// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for a process with no screen: the look.
 *
 * The token table and the accent rule: every colour and measure as data, and a
 * colour measured, for pages a process draws as text.
 *
 * A build composed from this one imports this entry and never the files behind
 * it (ADR-0022, amended), so those may move. Names only, each from the file
 * that holds it; `src/composed/SURFACE.txt` is what the whole offers.
 */
export { deriveAccent } from '../../widgets/kit/accent'
export type { AccentAnswer } from '../../widgets/kit/accent'
export { DARK, LIGHT, SCALE, coloursOf, tokenVariables } from '../../widgets/kit/tokens'
export type { AccentShades, ColourToken, Colours, Mode } from '../../widgets/kit/tokens'

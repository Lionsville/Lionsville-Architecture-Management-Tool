// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { tokensOf } from '../widgets/kit/tokens'

/**
 * The three colours a reporting line takes on the organisation chart for the
 * person picked (ADR-0039, amended 17 October 2026): the lines they report
 * along in the accent; the lines reporting into them in the darker line ink;
 * and any line that is an exception to the model — a unit's own, a holder's
 * own — in the exception's magenta, whichever way it runs, which the chip of a
 * role held outside a unit's slots wears too. Each away from the warning and
 * error tones a vacant line and a loop keep, and each at 3:1 on both grounds in
 * both modes (`app/theme.contrast.test`).
 */
export type ReportingLineColours = { reportsTo: string; reportedBy: string; override: string }

/** Read off the theme's tokens, whichever theme the screen was handed. */
export function reportingLineColours(theme: Parameters<typeof tokensOf>[0]): ReportingLineColours {
  const colours = tokensOf(theme)
  return {
    reportsTo: colours['line-reports-to'],
    reportedBy: colours['line-reports-from'],
    override: colours['line-exception'],
  }
}

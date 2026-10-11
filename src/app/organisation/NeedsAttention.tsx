// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The line under the cards: how much the checks find at or under this home,
 * by weight — so many to fix, so many to review, so many notes — each a way
 * to the Checks page on the first check of its weight (ADR-0036, amended 11
 * October 2026).
 *
 * It used to list every finding, and a home of a large organisation was a
 * page of sentences, the notes among them, that read like faults and pointed
 * at no check. The findings are listed on the Checks page now, by check and
 * by category, with why each check matters and how to fix it; here they are
 * counted, in the marks the lists use, and what was marked as intended is not
 * among them.
 *
 * Not shown at all when nothing is found — a heading over nothing would be a
 * warning about nothing, and a "no problems" line would be saying so before
 * the index has been read. The Checks card is the way in either way.
 */
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Typography from '@mui/material/Typography'
import type { StringKey, Translate } from '../../i18n'
import { plural } from '../../i18n/strings'
import { CHECK_WEIGHTS } from '../../model/checkCatalogue'
import type { CheckWeight } from '../../model/checkCatalogue'
import { WEIGHT_MARK } from '../../widgets/FindingsList'

/** What each weight's count says. */
const SAID: Record<CheckWeight, { one: StringKey; other: StringKey }> = {
  fix: { one: 'checks.fixOne', other: 'checks.fixOther' },
  review: { one: 'checks.reviewOne', other: 'checks.reviewOther' },
  note: { one: 'checks.noteOne', other: 'checks.noteOther' },
}

/** One weight's count, in the words of the page it opens. */
export function weightCount(weight: CheckWeight, count: number, s: Translate): string {
  return plural(s, SAID[weight], count)
}

export function NeedsAttention({ counts, onOpen, s }: {
  counts: Readonly<Record<CheckWeight, number>>
  /** Open the Checks page on the first check of this weight. */
  onOpen: (weight: CheckWeight) => void
  s: Translate
}) {
  const weights = CHECK_WEIGHTS.filter((weight) => counts[weight] > 0)
  if (weights.length === 0) return null
  return (
    <Box sx={{ mb: 4, maxWidth: 760 }} data-testid="needs-attention" data-guide="org.attention">
      <Typography sx={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, mb: 0.5, textTransform: 'uppercase', color: 'warning.main' }}>
        {s('org.attention')}
      </Typography>
      <Box component="ul" sx={{ listStyle: 'none', p: 0, m: 0, display: 'flex', flexWrap: 'wrap', columnGap: 2, rowGap: 0.5 }}>
        {weights.map((weight) => (
          <Box component="li" key={weight}>
            <ButtonBase
              onClick={() => onOpen(weight)} data-guide="org.attentionCount" data-testid={`attention-count-${weight}`} data-weight={weight}
              sx={{ fontSize: 13, gap: 0.75, alignItems: 'baseline', '&:hover .attention-count': { textDecoration: 'underline' } }}
            >
              <Box component="span" aria-hidden sx={{ fontSize: 11, ...WEIGHT_MARK[weight].sx }}>{WEIGHT_MARK[weight].glyph}</Box>
              <Box component="span" className="attention-count" sx={{ color: 'primary.main' }}>{weightCount(weight, counts[weight], s)}</Box>
            </ButtonBase>
          </Box>
        ))}
      </Box>
    </Box>
  )
}

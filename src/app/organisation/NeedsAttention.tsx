// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The Checks line under a home's head: what is found here and below, by weight,
 * each count a way to the page on the first of its weight. Only *to fix* takes
 * colour, with a shape as well as a hue; the notes stay quiet. Findings repeat a
 * few checks, and a permanent alarm is soon ignored, so a sentence says what
 * most of them are. With nothing found, the page is still one press away.
 */
import { CHECK_CATALOGUE, CHECK_WEIGHTS } from '../../model/checkCatalogue'
import type { CheckKey, CheckWeight } from '../../model/checkCatalogue'
import type { StringKey, Translate } from '../../i18n'
import { plural } from '../../i18n/strings'
import { Mark } from '../../widgets/kit/Mark'
import { LinkLine } from '../../widgets/kit/Section'

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

/** *Most are one thing: 116 not drawn*, where one or two checks are over half of a list worth summing up. */
export function mostlySaid(shown: readonly { readonly key: CheckKey }[], s: Translate): string {
  if (shown.length < 10) return ''
  const counted = new Map<CheckKey, number>()
  for (const one of shown) counted.set(one.key, (counted.get(one.key) ?? 0) + 1)
  const top = [...counted].sort((a, b) => b[1] - a[1]).slice(0, 2)
  if (top.reduce((sum, [, count]) => sum + count, 0) * 2 < shown.length) return ''
  return s('org.checksMostly', { what: top.map(([key, count]) => `${count} ${s(CHECK_CATALOGUE[key].name)}`).join(', ') })
}

export function ChecksLine({ counts, shown = [], onOpen, onPage, s }: {
  counts: Readonly<Record<CheckWeight, number>>
  /** The findings themselves, for the sentence. */
  shown?: readonly { readonly key: CheckKey }[]
  /** Open the Checks page on the first check of this weight. */
  onOpen: (weight: CheckWeight) => void
  /** Open it as it is. */
  onPage?: () => void
  s: Translate
}) {
  const weights = CHECK_WEIGHTS.filter((weight) => counts[weight] > 0)
  if (weights.length === 0) {
    return onPage
      ? <LinkLine label={s('org.checksNone')} links={[{ label: s('checks.title'), onPress: onPage, 'data-testid': 'open-checks' }]} />
      : null
  }
  return (
    <p className="kit-factline" data-testid="needs-attention" data-guide="org.attention">
      <button type="button" className="kit-linkline__link" data-testid="open-checks" onClick={onPage}>{s('checks.title')}</button>
      {weights.map((weight) => (
        <button
          key={weight} type="button" className="kit-checkcount" data-guide="org.attentionCount" data-testid={`attention-count-${weight}`} data-weight={weight}
          onClick={() => onOpen(weight)}
        >
          <Mark kind={weight} size={12} />
          <span>{weightCount(weight, counts[weight], s)}</span>
        </button>
      ))}
      <span>{mostlySaid(shown, s)}</span>
    </p>
  )
}

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *Principles* on every home (ADR-0041 §12): how many the scope keeps, and
 * how many are in force there — its own, every scope's above it and every
 * topic's relevant there (ADR-0042 §4) — counted
 * off the index, as the home's other counts are. Retired principles and those
 * absorbed by another are counted by neither. Opens the scope on its page.
 */
import Button from '@mui/material/Button'
import type { Translate } from '../../i18n'
import type { ScopePrinciples } from '../../projects/scopeIndex'
import { ancestorScopes } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'
import { DecisionIcon } from '../../widgets/icons'
import { OnePage } from './OrganisationCards'
import { useTopics } from './TopicsContext'

/** What the card counts: the scope's own standing principles, and those in force there — above it, and from its topics (ADR-0042 §4). */
export function principleCounts(
  at: ScopePath, principlesAt: (path: ScopePath) => ScopePrinciples, topics: readonly ScopePath[] = [],
): { own: number; inForce: number } {
  const standing = (path: ScopePath) => principlesAt(path).principles.filter((one) => one.mergedInto === undefined && one.status !== 'retired').length
  const own = standing(at)
  const from = [...new Set([...ancestorScopes(at), ...topics])].filter((path) => path !== at)
  return { own, inForce: from.reduce((sum, path) => sum + standing(path), own) }
}

export function PrinciplesCard({ at, principlesAt, onOpen, s }: {
  at: ScopePath
  principlesAt: ((path: ScopePath) => ScopePrinciples) | undefined
  onOpen: () => void
  s: Translate
}) {
  const topics = useTopics()
  if (!principlesAt) return null
  const { own, inForce } = principleCounts(at, principlesAt, topics?.inForceAt(at))
  return (
    <OnePage
      icon={<DecisionIcon />}
      title={s('principles.card')}
      description={s('principles.cardDescribe')}
      count={inForce > 0 ? s('principles.cardCount', { own, inForce }) : s('principles.cardNone')}
      action={(
        <Button size="small" onClick={onOpen} sx={{ fontSize: 11, minWidth: 0, px: 1, whiteSpace: 'nowrap' }} data-testid="open-principles" data-guide="org.card.principles" aria-label={s('picker.openNamed', { name: s('principles.card') })}>
          {s('picker.open')}
        </Button>
      )}
    />
  )
}

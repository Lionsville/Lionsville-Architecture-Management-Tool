// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * *Topics* on the organisation's home (ADR-0042 §3): how many topics there
 * are, and the way into the catalogue — whether or not there are any, since
 * the first is made there.
 */
import type { Translate } from '../../i18n'
import { plural } from '../../i18n/strings'
import { RegisterIcon } from '../../widgets/icons'
import { OnePage } from './OnePage'
import { useTopics } from './TopicsContext'

export function TopicsCard({ onOpen, s }: { onOpen: () => void; s: Translate }) {
  const access = useTopics()
  if (!access) return null
  const count = access.list().length
  return (
    <OnePage
      icon={<RegisterIcon />}
      title={s('topics.card')}
      description={s('topics.cardDescribe')}
      count={count > 0 ? plural(s, { one: 'topics.cardCountOne', other: 'topics.cardCount' }, count) : s('topics.cardNone')}
      actions={[{ label: s('picker.open'), onClick: onOpen, testId: 'open-topic-catalogue', guide: 'org.card.topics', ariaLabel: s('picker.openNamed', { name: s('topics.card') }) }]}
    />
  )
}

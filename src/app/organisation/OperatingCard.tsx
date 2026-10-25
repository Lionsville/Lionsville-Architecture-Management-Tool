// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The operating model's card on the organisation's home (ADR-0036): how many
 * unit types, roles and responsibilities it has, and whether each
 * responsibility has its one accountable role. Drawn at the root only, where
 * the operating model is kept; it says whether it is shown itself, so the
 * row of cards gains no branch of its own.
 */
import { plural } from '../../i18n/strings'
import type { Translate } from '../../i18n'
import { OperatingModelIcon } from '../../widgets/icons'
import { OnePage } from './OnePage'
import type { OrganisationPages } from './organisationPages'

export function OperatingCard({ shown, ready, counts, onOpen, s }: {
  shown: boolean
  ready: boolean
  counts: OrganisationPages['operating']
  onOpen: (() => void) | undefined
  s: Translate
}) {
  if (!shown) return null
  const designed = counts.unitTypes + counts.roles + counts.responsibilities > 0
  const count = !ready ? '' : designed ? [
    plural(s, { one: 'org.unitTypesOne', other: 'org.unitTypesOther' }, counts.unitTypes),
    plural(s, { one: 'org.rolesOne', other: 'org.rolesOther' }, counts.roles),
    plural(s, { one: 'org.responsibilitiesOne', other: 'org.responsibilitiesOther' }, counts.responsibilities),
  ].join(' · ') : s('org.operatingEmpty')
  const finding = !ready || counts.responsibilities === 0 ? ''
    : counts.unaccountable > 0
      ? plural(s, { one: 'org.unaccountableOne', other: 'org.unaccountableOther' }, counts.unaccountable)
      : s('org.allAccountable')
  return (
    <OnePage
      icon={<OperatingModelIcon />}
      title={s('org.operating')}
      description={s('org.describeOperating')}
      count={count}
      finding={finding}
      actions={onOpen ? [{ label: s('picker.open'), onClick: onOpen, testId: 'open-operating', guide: 'org.card.operating', ariaLabel: s('picker.openNamed', { name: s('org.operating') }) }] : []}
    />
  )
}

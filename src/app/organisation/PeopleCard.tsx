// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The people register's card on the organisation's home (ADR-0036): how many
 * people, how many have left, and the way to the People page. The register is
 * the organisation's, so the card is the root's: handed no register — another
 * scope's home, or a source that keeps none — it draws nothing.
 */
import Button from '@mui/material/Button'
import type { Translate } from '../../i18n'
import { plural } from '../../i18n/strings'
import { entriesOf } from '../../people/person'
import type { PeopleAccess } from './usePeopleRegister'
import { PeopleIcon } from '../../widgets/icons'
import { OnePage } from './OrganisationCards'

export function PeopleCard({ people: register, atRoot, onOpen, s }: {
  people: PeopleAccess | undefined; atRoot: boolean; onOpen: () => void; s: Translate
}) {
  if (!register || !atRoot) return null
  const { people } = register
  const entries = entriesOf(people ?? [])
  const left = entries.filter((person) => person.state === 'left').length
  return (
    <OnePage
      icon={<PeopleIcon />}
      title={s('org.people')}
      description={s('org.describePeople')}
      count={people === undefined ? undefined : [
        plural(s, { one: 'org.peopleOne', other: 'org.peopleOther' }, entries.filter((person) => person.state !== 'forgotten').length),
        ...(left > 0 ? [plural(s, { one: 'org.peopleLeftOne', other: 'org.peopleLeftOther' }, left)] : []),
      ].join(' · ')}
      action={(
        <Button size="small" onClick={onOpen} sx={{ fontSize: 11, minWidth: 0, px: 1, whiteSpace: 'nowrap' }} data-testid="open-people" data-guide="org.card.people">
          {s('picker.open')}
        </Button>
      )}
    />
  )
}

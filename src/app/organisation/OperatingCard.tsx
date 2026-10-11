// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The operating model's card on the organisation's home (ADR-0036): how many
 * unit types, roles and responsibilities it has, and whether each
 * responsibility has its one accountable role. Drawn at the root only, where
 * the operating model is kept; it says whether it is shown itself, so the
 * row of cards gains no branch of its own.
 */
import Button from '@mui/material/Button'
import Card from '@mui/material/Card'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { plural } from '../../i18n/strings'
import type { Translate } from '../../i18n'
import { OperatingModelIcon } from '../../widgets/icons'
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
    <Card variant="outlined" sx={{ p: 1.5, height: '100%', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', mb: 0.5 }}>
        <Box sx={{ color: 'text.secondary', display: 'flex' }}><OperatingModelIcon /></Box>
        <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{s('org.operating')}</Typography>
      </Stack>
      <Typography sx={{ fontSize: 12, mb: 0.75 }} data-testid="card-description">{s('org.describeOperating')}</Typography>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', minHeight: 16 }}>{count}</Typography>
      <Typography sx={{ fontSize: 11, color: 'text.secondary', minHeight: 16, mb: 1 }}>{finding}</Typography>
      <Box sx={{ mt: 'auto' }}>
        <Button
          size="small" onClick={onOpen} sx={{ fontSize: 11, minWidth: 0, px: 1, whiteSpace: 'nowrap' }}
          data-testid="open-operating" data-guide="org.card.operating"
        >
          {s('picker.open')}
        </Button>
      </Box>
    </Card>
  )
}

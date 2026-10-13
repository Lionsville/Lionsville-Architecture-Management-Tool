// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A role's or a responsibility's place in the organisation's own order, in its
 * inspector: where it stands, and *Move up* and *Move down*, each one step
 * that renumbers the list (`moveRole`, `moveResponsibility`). A role's order
 * is the matrix's columns, left to right, so its buttons say *Move left* and
 * *Move right*; a responsibility moves among those
 * of its own group. The matrix shows this order unless A–Z is chosen over it.
 */
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import type { Command } from '../../model/commands'
import { inOwnOrder } from '../../model/operatingModel'
import type { Responsibility, Role } from '../../model/operatingModel'
import { useStrings } from '../../i18n'
import { moveResponsibility, moveRole } from '../edit'
import type { OperatingModel } from '../edit'

const heading = { fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', mt: 2, mb: 0.5 } as const

export function RoleOrder({ role, model, readOnly, dispatch }: { role: Role; model: OperatingModel; readOnly: boolean; dispatch(command: Command): void }) {
  const { t } = useStrings()
  const ordered = inOwnOrder(model.roles)
  const at = ordered.findIndex((one) => one.id === role.id)
  return (
    <Place
      guide="operating.roleOrder" place={t('operating.roleOrderAt', { place: at + 1, count: ordered.length })}
      hint={t('operating.roleOrderHint')} readOnly={readOnly}
      up={moveRole(model, role.id, -1)} down={moveRole(model, role.id, 1)} dispatch={dispatch}
      // A role's place is a column: earlier is left.
      words={['operating.orderLeft', 'operating.orderRight']}
    />
  )
}

export function ResponsibilityOrder({ responsibility, model, readOnly, dispatch }: {
  responsibility: Responsibility; model: OperatingModel; readOnly: boolean; dispatch(command: Command): void
}) {
  const { t } = useStrings()
  const group = responsibility.group?.trim() ?? ''
  const mates = inOwnOrder(model.responsibilities).filter((one) => (one.group?.trim() ?? '') === group)
  const at = mates.findIndex((one) => one.id === responsibility.id)
  return (
    <Place
      guide="operating.responsibilityOrder"
      place={t('operating.responsibilityOrderAt', { place: at + 1, count: mates.length, group: group || t('operating.noGroup') })}
      hint={t('operating.responsibilityOrderHint')} readOnly={readOnly}
      up={moveResponsibility(model, responsibility.id, -1)} down={moveResponsibility(model, responsibility.id, 1)} dispatch={dispatch}
    />
  )
}

function Place({ guide, place, hint, readOnly, up, down, dispatch, words = ['operating.orderUp', 'operating.orderDown'] }: {
  guide: string; place: string; hint: string; readOnly: boolean
  up: Command | undefined; down: Command | undefined; dispatch(command: Command): void
  words?: readonly ['operating.orderUp' | 'operating.orderLeft', 'operating.orderDown' | 'operating.orderRight']
}) {
  const { t } = useStrings()
  return (
    <Box>
      <Typography sx={heading}>{t('operating.ownOrder')}</Typography>
      <Typography variant="body2">{place}</Typography>
      {!readOnly && (
        <Box data-guide={guide} sx={{ display: 'flex', gap: 1, my: 0.5 }}>
          <Button size="small" variant="outlined" disabled={!up} onClick={() => up && dispatch(up)} sx={{ textTransform: 'none' }}>
            {t(words[0])}
          </Button>
          <Button size="small" variant="outlined" disabled={!down} onClick={() => down && dispatch(down)} sx={{ textTransform: 'none' }}>
            {t(words[1])}
          </Button>
        </Box>
      )}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{hint}</Typography>
    </Box>
  )
}

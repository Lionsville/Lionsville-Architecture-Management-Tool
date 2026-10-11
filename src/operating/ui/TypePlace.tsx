// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A unit type's place in the structure, in its inspector (ADR-0036, amended
 * 11 October 2026): which lane it is in and where in it, *Move up* and *Move
 * down* along the lane — each one step that renumbers the lane's `order`
 * (`moveUnitType`) — and what may sit in it. A type that sits nowhere has no
 * lane to be ordered in until it is given a place.
 */
import { useMemo } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import type { Command } from '../../model/commands'
import type { UnitType } from '../../model/operatingModel'
import { unitTypeLanes } from '../../model/unitOrder'
import { useStrings } from '../../i18n'
import { moveUnitType } from '../edit'
import type { OperatingModel } from '../edit'

const heading = { fontSize: 11, fontWeight: 700, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.06em', mt: 2, mb: 0.5 } as const

export function TypePlace({ type, model, readOnly, dispatch }: { type: UnitType; model: OperatingModel; readOnly: boolean; dispatch(command: Command): void }) {
  const { t } = useStrings()
  const { lanes, laneOf, nowhere } = useMemo(() => unitTypeLanes(model.unitTypes), [model.unitTypes])
  const lane = laneOf.get(type.id)
  const siblings = lane === undefined ? [] : lanes[lane - 1].types
  const at = siblings.findIndex((one) => one.id === type.id)
  // In the structure's own order, as the lanes draw them.
  const holds = [...lanes.flatMap((one) => one.types), ...nowhere].filter((one) => one.within.includes(type.id))
  const move = (to: number) => {
    const command = moveUnitType(model, type.id, to)
    if (command) dispatch(command)
  }
  return (
    <Box data-testid="operating-type-place">
      <Typography sx={heading}>{t('operating.order')}</Typography>
      {lane === undefined
        ? <Typography variant="body2" color="text.secondary">{t('operating.orderNowhere')}</Typography>
        : (
          <>
            <Typography variant="body2">{t('operating.orderAt', { lane, place: at + 1, count: siblings.length })}</Typography>
            {!readOnly && (
              <Box data-guide="operating.typeOrder" sx={{ display: 'flex', gap: 1, my: 0.5 }}>
                <Button size="small" variant="outlined" disabled={at <= 0} onClick={() => move(at - 1)} sx={{ textTransform: 'none' }}>
                  {t('operating.orderUp')}
                </Button>
                <Button size="small" variant="outlined" disabled={at >= siblings.length - 1} onClick={() => move(at + 1)} sx={{ textTransform: 'none' }}>
                  {t('operating.orderDown')}
                </Button>
              </Box>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{t('operating.orderHint')}</Typography>
          </>
        )}
      <Typography sx={heading}>{t('operating.mayHold')}</Typography>
      <Typography variant="body2">{holds.length ? holds.map((one) => one.name).join(', ') : t('operating.holdsNothing')}</Typography>
    </Box>
  )
}

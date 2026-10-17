// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The organisation chart's outline (ADR-0036, amended 11 October 2026): the
 * units of the chart as a tree beside it, in the chart's own order, to find
 * a way about a large organisation. It replaces the *Show* select of the
 * first build, which narrowed the chart to one unit; the outline leaves the
 * chart whole and goes to the unit instead.
 *
 * **It folds on its own**, for the session (`useChartFolds`): folding the
 * outline leaves the chart as it is. **Picking a unit** unfolds the way to it
 * on the chart and here, scrolls the chart to it and rings it, and chooses it
 * where the open scope keeps it, as pressing it on the chart does.
 *
 * **Order among siblings** is moved here, under the tree: the unit picked, one
 * place up or down among the units of its type under the same parent
 * (`useSiblingOrder`) — buttons, so the keyboard has the same way as the
 * pointer. Every list of units follows it. Beside them, *Move to…* puts the
 * unit under another anywhere in the organisation (3.7.1, `useMoveUnit`).
 *
 * **A unit is made at the top from its header** (3.6.2): *+ Unit at the
 * top*, as on the chart's bar (`AddUnit.tsx`).
 */
import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Typography from '@mui/material/Typography'
import type { Translate } from '../../i18n'
import type { ChartUnit, OrgChart } from '../../model/orgChart'
import type { ElementId } from '../../model/types'
import { CaretIcon } from '../../widgets/icons'
import { locatedSelector } from '../../widgets/useLocated'
import type { SiblingOrder } from './useSiblingOrder'

export type ChartOutlineProps = {
  chart: OrgChart
  /** The outline's own folds. */
  folded: ReadonlySet<ElementId>
  onToggle: (id: ElementId) => void
  /** The unit gone to: picked here, found, or chosen on the chart. */
  current: ElementId | undefined
  onPick: (id: ElementId) => void
  typeName: (id: string | undefined) => string
  /** The current unit's place among its siblings; absent where it has none of its type or may not be moved here. */
  order: SiblingOrder | undefined
  /** *+ Unit at the top*, in the header; absent where nothing is made from the chart. */
  addAtTop?: ReactNode
  /** *Move to…* the current unit, beside *Move up* and *Move down*; absent where nothing may be moved here or none is current. */
  moveTo?: (() => void) | undefined
  t: Translate
}

/** The attribute a row carries its unit's id in: not the chart's own, so a ring on the chart never lands here. */
const ROW = 'data-outline-id'

export function ChartOutline({ chart, folded, onToggle, current, onPick, typeName, order, addAtTop, moveTo, t }: ChartOutlineProps) {
  const box = useRef<HTMLElement | null>(null)
  // The unit gone to is brought on screen here too: the way to it is opened in
  // the same render, and a fold turned elsewhere in the outline leaves the
  // outline where the person put it.
  useEffect(() => {
    if (current === undefined) return
    box.current?.querySelector<HTMLElement>(locatedSelector(current, ROW))?.scrollIntoView?.({ block: 'nearest' })
  }, [current])
  return (
    <Box
      component="nav" ref={box} aria-label={t('chart.outline')} data-testid="chart-outline" data-guide="chart.outline"
      sx={{ width: { xs: 'auto', md: 240 }, flex: '0 0 auto', maxHeight: { xs: 200, md: 'none' }, overflow: 'auto', p: 1, borderRight: { md: 1 }, borderBottom: { xs: 1, md: 0 }, borderColor: 'divider', bgcolor: 'background.paper' }}
    >
      {addAtTop && <Box data-testid="chart-outline-header" sx={{ mb: 0.5 }}>{addAtTop}</Box>}
      <Typography sx={{ fontSize: 11, color: 'text.secondary', mb: 0.5 }}>{t('chart.outlineHint')}</Typography>
      {chart.roots.length === 0
        ? <Typography sx={{ fontSize: 12, color: 'text.secondary' }}>{t('chart.outlineEmpty')}</Typography>
        : <Rows units={chart.roots} depth={0} folded={folded} onToggle={onToggle} current={current} onPick={onPick} typeName={typeName} t={t} />}
      {(order || moveTo) && <OrderPanel order={order} moveTo={moveTo} t={t} />}
    </Box>
  )
}

function Rows({ units, depth, ...props }: Omit<ChartOutlineProps, 'chart' | 'order' | 'addAtTop' | 'moveTo'> & { units: readonly ChartUnit[]; depth: number }) {
  const { folded, onToggle, current, onPick, typeName, t } = props
  return (
    <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
      {units.map((unit) => {
        const shut = folded.has(unit.id)
        const on = current === unit.id
        return (
          <li key={unit.id}>
            <Box {...{ [ROW]: unit.id }} sx={{ display: 'flex', alignItems: 'center', gap: 0.25, pl: depth * 1.5 }}>
              {unit.children.length > 0 ? (
                <IconButton
                  size="small" aria-label={t(shut ? 'chart.unfold' : 'chart.fold', { name: unit.name })} aria-expanded={!shut}
                  onClick={() => onToggle(unit.id)} data-testid="chart-outline-fold"
                  sx={{ width: 22, height: 22, color: 'text.secondary', transform: shut ? 'rotate(-90deg)' : undefined }}
                >
                  <CaretIcon />
                </IconButton>
              ) : <Box sx={{ width: 22, flex: '0 0 auto' }} />}
              <Button
                size="small" color="inherit" onClick={() => onPick(unit.id)} aria-current={on ? 'true' : undefined}
                data-testid="chart-outline-unit" data-unit-id={unit.id}
                sx={{
                  flex: 1, minWidth: 0, justifyContent: 'flex-start', textAlign: 'left', textTransform: 'none', fontSize: 12, fontWeight: on ? 700 : 400,
                  px: 0.5, py: 0.125, bgcolor: on ? 'action.selected' : undefined,
                }}
              >
                <Box component="span" sx={{ fontSize: 9.5, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'text.secondary', mr: 0.5, flex: '0 0 auto' }}>
                  {typeName(unit.unitTypeId)}
                </Box>
                {' '}
                <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{unit.name}</Box>
              </Button>
            </Box>
            {unit.children.length > 0 && !shut && <Rows {...props} units={unit.children} depth={depth + 1} />}
          </li>
        )
      })}
    </Box>
  )
}

/**
 * The unit picked: one place up or down among the units of its type beside
 * it, one step in each scope that keeps one of them — and *Move to…*,
 * somewhere else in the organisation (3.7.1).
 */
function OrderPanel({ order, moveTo, t }: { order: SiblingOrder | undefined; moveTo: (() => void) | undefined; t: Translate }) {
  return (
    <Box data-testid="chart-order" sx={{ mt: 1.5, pt: 1, borderTop: 1, borderColor: 'divider' }}>
      {order && (
        <>
          <Typography sx={{ fontSize: 12, fontWeight: 700 }}>{t('chart.orderHeading')}</Typography>
          <Typography sx={{ fontSize: 11.5, color: 'text.secondary' }} data-testid="chart-order-of">
            {order.parent !== undefined ? t('chart.orderIn', { type: order.type, unit: order.parent }) : t('chart.orderAtTop', { type: order.type })}
          </Typography>
        </>
      )}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
        {order && (
          <>
            <Button size="small" variant="outlined" disabled={order.writing || order.at <= 0} onClick={() => order.move(-1)} data-testid="chart-order-up">
              {t('chart.moveUp')}
            </Button>
            <Button size="small" variant="outlined" disabled={order.writing || order.at >= order.of - 1} onClick={() => order.move(1)} data-testid="chart-order-down">
              {t('chart.moveDown')}
            </Button>
          </>
        )}
        {moveTo && (
          <Button size="small" variant="outlined" onClick={moveTo} data-testid="chart-outline-move-to" data-guide="chart.outlineMoveTo">
            {t('unitMove.open')}
          </Button>
        )}
      </Box>
      {order && <Typography sx={{ fontSize: 11, color: 'text.secondary', mt: 0.5 }}>{t('chart.orderHint')}</Typography>}
      {order?.said && (
        <Typography role="status" data-testid="chart-order-said" sx={{ fontSize: 11.5, mt: 0.5, color: order.said.tone === 'error' ? 'error.main' : 'text.secondary' }}>
          {order.said.text}
        </Typography>
      )}
    </Box>
  )
}

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The dock of a zoomable canvas, bottom left and the same on all of them:
 * − n% + Fit 100% Grid Map. Every one has its key in its tooltip, and the zoom's
 * keys are the same everywhere (`useCanvasZoom`). The sheet has none: it reflows.
 * `extra` is for what a canvas has not yet moved under Arrange.
 *
 * At the floor and the ceiling − and + stay where they are, the focus on them, and
 * say that the zoom stops here: a button that turned dead would drop the focus.
 *
 * It places nothing itself but the corner it asks for: a canvas that owns its
 * panels, as React Flow does, puts it where `corner={false}` lets it be.
 */
import type { ReactNode } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import { Button } from './Button'
import { MenuButton } from './Menu'
import type { MenuEntry } from './Menu'
import { Tooltip } from './Tooltip'
import { ZOOM_CEILING, ZOOM_FLOOR } from './zoom'
import { isMac } from './keys'
import './CanvasDock.css'

type Toggle = { on: boolean; onToggle: () => void; keys?: string; 'data-guide'?: string }

export type CanvasDockProps = {
  zoom: number
  onZoomIn: () => void
  onZoomOut: () => void
  onFit: () => void
  onHome: () => void
  grid?: Toggle
  /** Grid opens what goes with it, where the canvas also snaps to it. */
  gridItems?: readonly MenuEntry[]
  map?: Toggle
  extra?: ReactNode
  /** What the canvas has to say for itself, such as a router that declined. */
  note?: ReactNode
  /** In a corner of the nearest positioned ancestor, or wherever the caller's panel is. */
  corner?: boolean
  /** Where − and + stop, for a canvas with a range of its own. */
  floor?: number
  ceiling?: number
  'data-testid'?: string
}


export function CanvasDock({ zoom, onZoomIn, onZoomOut, onFit, onHome, grid, gridItems, map, extra, note, corner = true, floor = ZOOM_FLOOR, ceiling = ZOOM_CEILING, 'data-testid': testId }: CanvasDockProps) {
  const { t } = useStrings()
  const mod = isMac() ? '⌘' : 'Ctrl+'
  const shift = isMac() ? '⇧' : 'Shift+'
  const percent = Math.round(zoom * 100)
  const hint = (word: string, keys?: string) => (keys ? `${word} (${keys})` : word)
  const toggle = (word: string, held: Toggle, about?: string) => (
    <Tooltip title={hint(about ?? word, held.keys)} placement="top">
      <Button variant="quiet" size="small" aria-pressed={held.on} onClick={held.onToggle} data-guide={held['data-guide']}>{word}</Button>
    </Tooltip>
  )
  return (
    <div className="kit-dock" data-canvas-float="" data-corner={corner || undefined} role="group" aria-label={t('kit.dock.label')} data-testid={testId}>
      <Tooltip title={zoom <= floor ? t('kit.dock.atFloor') : hint(t('kit.dock.zoomOut'), `${mod}−`)} placement="top">
        <Button variant="quiet" size="small" aria-label={t('kit.dock.zoomOut')} data-limit={zoom <= floor || undefined} onClick={onZoomOut} data-testid="zoom-out">−</Button>
      </Tooltip>
      <output className="kit-dock__value" aria-label={t('kit.dock.value', { percent })} data-testid="zoom-value">{percent}%</output>
      <Tooltip title={zoom >= ceiling ? t('kit.dock.atCeiling') : hint(t('kit.dock.zoomIn'), `${mod}+`)} placement="top">
        <Button variant="quiet" size="small" aria-label={t('kit.dock.zoomIn')} data-limit={zoom >= ceiling || undefined} onClick={onZoomIn} data-testid="zoom-in">+</Button>
      </Tooltip>
      <span className="kit-dock__rule" />
      <Tooltip title={hint(t('kit.dock.fitHint'), `${shift}1`)} placement="top">
        <Button variant="quiet" size="small" onClick={onFit} data-testid="zoom-fit">{t('kit.dock.fit')}</Button>
      </Tooltip>
      <Tooltip title={hint(t('kit.dock.homeHint'), `${mod}0`)} placement="top">
        <Button variant="quiet" size="small" onClick={onHome} data-testid="zoom-home">{t('kit.dock.home')}</Button>
      </Tooltip>
      {(grid || gridItems || map) && <span className="kit-dock__rule" />}
      {gridItems && <MenuButton variant="quiet" size="small" label={t('kit.dock.grid')} items={gridItems} />}
      {grid && !gridItems && toggle(t('kit.dock.grid'), grid)}
      {map && toggle(t('kit.dock.map'), map, t('kit.dock.mapHint'))}
      {extra && <><span className="kit-dock__rule" />{extra}</>}
      {note && <span className="kit-dock__note" role="note">{note}</span>}
    </div>
  )
}

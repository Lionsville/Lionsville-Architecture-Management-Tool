/**
 * Six pixels between two regions, dragged to give one of them more room.
 *
 * Third copy of the same gesture, so it became a widget: the editor's
 * `PanelResizer` has it for the panels beside the canvas, the plan page had
 * its own for the seam under its interface table, and the documentation page
 * needed one for its fields column. What every copy does is the same and is
 * all here — drag off the size the gesture STARTED at (reading the live prop
 * would compound rounding every frame), clamp, arrow keys for the keyboard,
 * double-click to put it back. What differs is passed in: which axis, which
 * side of the seam the resized region is on, and the limits.
 *
 * Knows nothing of panels or preferences, which is what lets `documentation`
 * and `roadmap` reach it: the matrix lets both import `widgets` and neither
 * import `editor`. The editor keeps its own, because that one also has to
 * announce itself to the canvas's shortcut dispatch and cancel on Escape.
 */
import { useCallback, useRef } from 'react'
import Box from '@mui/material/Box'

export interface SeamResizerProps {
  /** `vertical` is a seam you drag left and right, `horizontal` up and down. */
  orientation: 'vertical' | 'horizontal'
  /**
   * Which side of the seam the resized region is on. `before` is above or to
   * the left, and grows as the pointer moves down or right; `after` is the
   * other way round.
   */
  region: 'before' | 'after'
  value: number
  min: number
  /** Absent = as far as the pointer goes. */
  max?: number
  /** What a double-click puts it back to. */
  defaultValue: number
  onChange(next: number): void
  label: string
}

export function SeamResizer(props: SeamResizerProps) {
  const { orientation, region, value, min, max, defaultValue, onChange, label } = props
  const vertical = orientation === 'vertical'
  const sign = region === 'before' ? 1 : -1
  const start = useRef({ at: 0, value })
  const clamp = (next: number) => {
    if (!Number.isFinite(next)) return defaultValue
    return Math.round(Math.min(Math.max(next, min), max ?? Number.POSITIVE_INFINITY))
  }
  const onPointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return
    start.current = { at: vertical ? event.clientX : event.clientY, value }
    event.currentTarget.setPointerCapture(event.pointerId)
  }, [value, vertical])
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return
    const at = vertical ? event.clientX : event.clientY
    onChange(clamp(start.current.value + sign * (at - start.current.at)))
  }
  const grow = vertical ? (region === 'before' ? 'ArrowRight' : 'ArrowLeft') : (region === 'before' ? 'ArrowDown' : 'ArrowUp')
  const shrink = vertical ? (region === 'before' ? 'ArrowLeft' : 'ArrowRight') : (region === 'before' ? 'ArrowUp' : 'ArrowDown')

  return (
    <Box
      role="separator"
      aria-orientation={orientation}
      aria-label={label}
      aria-valuenow={Math.round(value)}
      aria-valuemin={min}
      {...(max !== undefined ? { 'aria-valuemax': max } : {})}
      tabIndex={0}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onDoubleClick={() => onChange(defaultValue)}
      onKeyDown={(event) => {
        const amount = event.shiftKey ? 32 : 8
        if (event.key === grow) onChange(clamp(value + amount))
        else if (event.key === shrink) onChange(clamp(value - amount))
        else if (event.key === 'Home') onChange(defaultValue)
        else return
        event.preventDefault()
        event.stopPropagation()
      }}
      sx={{
        flexShrink: 0,
        ...(vertical ? { width: 6, alignSelf: 'stretch', cursor: 'col-resize' } : { height: 6, cursor: 'row-resize' }),
        bgcolor: 'divider',
        '&:hover, &:focus-visible': { bgcolor: 'primary.main', outline: 'none' },
        transition: 'background-color 120ms',
        '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
      }}
    />
  )
}

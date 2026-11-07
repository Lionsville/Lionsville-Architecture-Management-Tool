// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A word about a control, on hover and on keyboard focus.
 *
 * MUI's for its timing and its positioning. What a tooltip says describes the
 * control and does not rename it, or a button would lose its own word to a
 * screen reader; `names` is for the one case that differs, a control with no word
 * of its own (`IconButton`).
 */
import type { ReactElement, ReactNode } from 'react'
import MuiTooltip from '@mui/material/Tooltip'
import './Tooltip.css'

export type TooltipProps = {
  /** Nothing to say draws no tooltip, so a caller can pass a reason that may be absent. */
  title: ReactNode
  placement?: 'top' | 'bottom' | 'left' | 'right'
  /** The title is the control's name, not a description of it. */
  names?: boolean
  children: ReactElement
}

export function Tooltip({ title, placement = 'bottom', names = false, children }: TooltipProps) {
  if (title === undefined || title === null || title === '') return children
  return (
    <MuiTooltip
      title={title} placement={placement} describeChild={!names} enterDelay={400} enterNextDelay={200}
      slotProps={{ tooltip: { className: 'kit-tooltip' } }}
    >
      {children}
    </MuiTooltip>
  )
}

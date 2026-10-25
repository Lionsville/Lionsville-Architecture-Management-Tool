// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A Harvey ball (ADR-0043): empty, a quarter, a half, three quarters, full.
 * As a button it moves a quarter on per click — from full back to empty —
 * and per arrow key, up and right on, down and left back.
 */
import type { KeyboardEvent, MouseEvent, ReactElement, ReactNode } from 'react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import Tooltip from '@mui/material/Tooltip'
import { nextLevel } from '../../model/buildingBlock'
import type { BlockLevel as Level } from '../../model/types'

const R = 7

/** The filled part, as a path: a wedge from twelve o'clock, clockwise. */
function wedge(level: Level): string {
  if (level === 0) return ''
  if (level === 4) return ''
  const angle = (level / 4) * 2 * Math.PI
  const x = 8 + R * Math.sin(angle)
  const y = 8 - R * Math.cos(angle)
  return `M8 8 L8 ${8 - R} A${R} ${R} 0 ${level > 2 ? 1 : 0} 1 ${x.toFixed(3)} ${y.toFixed(3)} Z`
}

export function BallFigure({ level, size = 16, tone = 'text.primary' }: { level: Level; size?: number; tone?: string }) {
  return (
    <Box component="svg" viewBox="0 0 16 16" width={size} height={size} aria-hidden sx={{ color: tone, display: 'block' }}>
      <circle cx="8" cy="8" r={R} fill={level === 4 ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.2" />
      {level > 0 && level < 4 && <path d={wedge(level)} fill="currentColor" />}
    </Box>
  )
}

export function HarveyBall({ level, onChange, label, readOnly = false, tone, onNote, hint }: {
  level: Level
  onChange?: (level: Level) => void
  /** What the ball is about, for a screen reader: `Coverage of Live view by Vendor A`. */
  label: string
  readOnly?: boolean
  tone?: string
  /** Alt-click or ⇧-click asks for a note on how. */
  onNote?: () => void
  /** What the ball means, said on hover: *Important (¾)*, *Mostly covered*, and what to do with it. */
  hint?: ReactNode
}) {
  const said = (child: ReactElement) => (hint ? <Tooltip title={hint} describeChild disableInteractive>{child}</Tooltip> : child)
  if (readOnly || !onChange) return said(<Box role="img" aria-label={`${label}: ${level}/4`} sx={{ display: 'inline-flex', p: 0.5 }}><BallFigure level={level} {...(tone ? { tone } : {})} /></Box>)
  const click = (event: MouseEvent) => {
    if ((event.altKey || event.shiftKey) && onNote) { onNote(); return }
    onChange(nextLevel(level))
  }
  const key = (event: KeyboardEvent) => {
    if (event.key === 'ArrowUp' || event.key === 'ArrowRight') { event.preventDefault(); onChange(nextLevel(level)) }
    if (event.key === 'ArrowDown' || event.key === 'ArrowLeft') { event.preventDefault(); onChange(nextLevel(level, -1)) }
    if (event.key === 'n' && onNote) { event.preventDefault(); onNote() }
  }
  return said(
    <ButtonBase
      onClick={click} onKeyDown={key} aria-label={`${label}: ${level}/4`}
      role="spinbutton" aria-valuemin={0} aria-valuemax={4} aria-valuenow={level}
      sx={{ borderRadius: '50%', p: 0.5, '&:hover': { bgcolor: 'action.hover' }, '&.Mui-focusVisible': { outline: 2, outlineColor: 'primary.main', outlineStyle: 'solid' } }}
    >
      <BallFigure level={level} {...(tone ? { tone } : {})} />
    </ButtonBase>
  )
}

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The actions on a reader, as ADR-0032 §7 draws them: a small outlined
 * button each, with an icon, a label of a word or two in sentence case, and a
 * tooltip that says in full what it does and what it is refused for.
 *
 * The tooltip describes the button rather than naming it (`describeChild`):
 * the label stays the accessible name, and the full sentence is its
 * description — the `title` while it is closed, the tooltip while it is open.
 * MUI opens it on keyboard focus as well as on hover, so it is not for the
 * mouse only.
 *
 * A reader reads its own width, not the window's (a container query, so
 * nothing is measured in script): below 560 pixels the occasional actions —
 * merge, archive, delete — move into a `⋯` menu, and the everyday ones stay
 * where they are.
 */
import { useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Typography from '@mui/material/Typography'
import { PictureMenu } from './PictureMenu'
import type { MenuAction } from './PictureMenu'

/** Below this the reader is compact: a query on the reader's own width. */
export const COMPACT = '@container reader (max-width: 559px)'

/** An action that moves into the `⋯` menu where the reader is narrow. */
export const WIDE_ONLY_SX = { [COMPACT]: { display: 'none' } } as const

/** One action on a reader. */
export type ReaderAction = {
  key: string
  icon: ReactNode
  /** One or two words. */
  label: string
  /** What it does, in full, and what it is refused for. */
  tip: string
  onClick: () => void
  /** The record's everyday next step, drawn in the accent. */
  primary?: boolean
  /** Merge, archive, delete: into `⋯` where the reader is narrow. */
  occasional?: boolean
  danger?: boolean
  testId?: string
  guide?: string
}

/** Sentence case, whatever the theme says about buttons: a label is read, not shouted. */
const BUTTON_SX = {
  textTransform: 'none', whiteSpace: 'nowrap', fontWeight: 500, lineHeight: 1.5, py: 0.25, px: 1.25, minWidth: 0,
  '& .MuiButton-startIcon': { mr: 0.75, ml: -0.25 },
} as const

export function ActionButton({ action, sx }: { action: ReaderAction; sx?: object }) {
  const quiet = !action.primary && !action.danger
  return (
    <Tooltip title={action.tip} describeChild>
      <Button
        size="small"
        variant="outlined"
        color={action.danger ? 'error' : action.primary ? 'primary' : 'inherit'}
        startIcon={action.icon}
        onClick={action.onClick}
        data-testid={action.testId}
        data-guide={action.guide}
        sx={{ ...BUTTON_SX, ...(quiet ? { borderColor: 'divider' } : {}), ...sx }}
      >
        {action.label}
      </Button>
    </Tooltip>
  )
}

/**
 * The `⋯` a narrow reader gathers its occasional actions under: hidden while
 * the reader is wide, where each is a button of its own. The menu is the
 * pictures' right-click menu, so an action reads the same wherever it is met.
 */
export function OverflowActions({ actions, label }: { actions: readonly MenuAction[]; label: string }) {
  const [at, setAt] = useState<{ x: number; y: number } | undefined>(undefined)
  if (actions.length === 0) return null
  return (
    <>
      <IconButton
        size="small"
        aria-label={label}
        data-testid="reader-more"
        onClick={(event) => {
          const box = event.currentTarget.getBoundingClientRect()
          setAt({ x: box.left, y: box.bottom })
        }}
        sx={{ display: 'none', [COMPACT]: { display: 'inline-flex' } }}
      >
        <Box component="span" aria-hidden sx={{ display: 'inline-block', width: 18, textAlign: 'center', fontSize: 16, lineHeight: 1 }}>⋯</Box>
      </IconButton>
      <PictureMenu at={at} actions={actions} onClose={() => setAt(undefined)} />
    </>
  )
}

/** A reader's actions in a row that wraps, the occasional ones in `⋯` where it is narrow. */
export function ReaderActions({ actions, label, moreLabel, children }: {
  actions: readonly ReaderAction[]
  /** What the row is, for a screen reader: the record's actions. */
  label: string
  moreLabel: string
  /** Anything drawn after the buttons: a toggle the reader keeps for itself. */
  children?: ReactNode
}) {
  // The occasional ones last, so the row reads the same wide and narrow, less the `⋯`.
  const ordered = [...actions.filter((one) => !one.occasional), ...actions.filter((one) => one.occasional)]
  const occasional: MenuAction[] = actions.filter((one) => one.occasional).map((one, index) => ({
    key: one.key, label: one.label, onClick: one.onClick,
    ...(one.danger ? { danger: true, divider: index > 0 } : {}),
  }))
  return (
    <Box role="group" aria-label={label} sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
      {ordered.map((one) => <ActionButton key={one.key} action={one} {...(one.occasional ? { sx: WIDE_ONLY_SX } : {})} />)}
      <OverflowActions actions={occasional} label={moreLabel} />
      {children}
    </Box>
  )
}

/**
 * What a step asks before it is taken, or why it is refused, drawn in the
 * reader under its actions (ADR-0032 §3): a refusal names the records in the
 * way and how to put it right, and is announced; a question has the step and
 * a way out.
 */
export function ReaderNotice({ refused, lines, confirm, onConfirm, onClose, closeLabel, testId }: {
  refused: boolean
  lines: readonly string[]
  /** The step's own label, where it is a question. */
  confirm?: string
  onConfirm?: () => void
  onClose: () => void
  /** OK after a refusal, Cancel after a question. */
  closeLabel: string
  testId?: string
}) {
  return (
    <Box
      role={refused ? 'alert' : undefined}
      data-testid={testId}
      sx={{
        mx: 2, mt: 1, px: 1.5, py: 1, borderRadius: 1, border: 1, fontSize: 13,
        borderColor: refused ? 'error.main' : 'primary.main', bgcolor: refused ? 'transparent' : 'action.hover',
      }}
    >
      {lines.map((line, index) => <Typography key={index} sx={{ fontSize: 13, mb: 0.75 }}>{line}</Typography>)}
      <Box sx={{ display: 'flex', gap: 1 }}>
        {confirm && onConfirm && (
          <Button size="small" variant="contained" onClick={onConfirm} sx={{ textTransform: 'none' }} data-testid={testId ? `${testId}-confirm` : undefined}>{confirm}</Button>
        )}
        <Button size="small" variant={refused ? 'outlined' : 'text'} onClick={onClose} sx={{ textTransform: 'none' }}>{closeLabel}</Button>
      </Box>
    </Box>
  )
}

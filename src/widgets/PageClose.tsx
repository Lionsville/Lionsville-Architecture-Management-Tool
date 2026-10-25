// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The two ends of a page's bar (ADR-0044 §2). Every page opens under the
 * shell's own bar and keeps its ‹ at the start, which reads as *back*; the ×
 * at the end is the same close where a window's close is looked for, so a
 * page is left the way a person expects whichever end they look at.
 *
 * A page written over its whole width — observations, an element's
 * documentation, a plan — is left in two steps: ‹, × and Escape go back to
 * reading first, and the next press closes the page (`useBackToReading`).
 * The buttons say which.
 */
import type { ReactNode } from 'react'
import Box from '@mui/material/Box'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import { useStrings } from '../i18n/LanguageContext'
import { CloseIcon } from './icons'

export function PageClose({ onClose, label }: { onClose: () => void; label?: string | undefined }) {
  const { t } = useStrings()
  const said = label ?? t('common.close')
  return (
    <Tooltip title={said}>
      <IconButton size="small" aria-label={said} onClick={onClose} data-testid="page-close" data-guide="page.close" sx={{ ml: 'auto', color: 'text.secondary' }}>
        <CloseIcon size={16} />
      </IconButton>
    </Tooltip>
  )
}

/** The ‹ at the start of a page's bar, saying what it does: close, or go back to reading. */
export function PageBack({ onBack, label, children }: { onBack: () => void; label: string; children?: ReactNode }) {
  return (
    <Tooltip title={label}>
      <IconButton size="small" aria-label={label} onClick={onBack} data-testid="page-back">
        {children ?? <Box component="span" aria-hidden sx={{ display: 'inline-block', width: 18, textAlign: 'center', fontSize: 16, lineHeight: 1 }}>‹</Box>}
      </IconButton>
    </Tooltip>
  )
}

/** How a page written over its whole width is left: what ‹, × and Escape do, and what they say. */
export type Leaving = {
  /** Back to reading while it is written; closing the page once it is read. */
  leave: () => void
  /** What ‹ says. */
  said: string
  /** What × says, where it is not a plain close. */
  closeSaid: string | undefined
}

export function useBackToReading(writing: boolean, toReading: () => void, close: () => void, closeSaid: string): Leaving {
  const { t } = useStrings()
  if (!writing) return { leave: close, said: closeSaid, closeSaid: undefined }
  const said = t('common.backToReading')
  return { leave: toReading, said, closeSaid: said }
}

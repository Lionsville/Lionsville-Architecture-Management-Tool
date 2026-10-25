// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The × at the right end of a page's bar. Every page opens under the shell's
 * own bar and keeps its ‹ at the start, which reads as *back*; the × is the
 * same close where a window's close is looked for, so a page is left the
 * way a person expects whichever end they look at.
 */
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import { useStrings } from '../i18n/LanguageContext'
import { CloseIcon } from './icons'

export function PageClose({ onClose, label }: { onClose: () => void; label?: string }) {
  const { t } = useStrings()
  const said = label ?? t('common.close')
  return (
    <Tooltip title={said}>
      <IconButton size="small" aria-label={said} onClick={onClose} data-testid="page-close" sx={{ ml: 'auto', color: 'text.secondary' }}>
        <CloseIcon size={16} />
      </IconButton>
    </Tooltip>
  )
}

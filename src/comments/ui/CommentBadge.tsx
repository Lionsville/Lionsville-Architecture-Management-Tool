// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * How many comments a record has, where it is listed (ADR-0037 §3): a small
 * mark beside its title, and nothing for a record nobody commented on — or
 * where no workspace hands the comments down.
 */
import { useMemo } from 'react'
import Box from '@mui/material/Box'
import Tooltip from '@mui/material/Tooltip'
import { useStrings } from '../../i18n/LanguageContext'
import type { RecordKey } from '../../model/recordKey'
import { CommentIcon } from '../../widgets/icons'
import { commentCount } from '../thread'
import { useComments } from './CommentsContext'

export function CommentBadge({ about }: { about: RecordKey }) {
  const access = useComments()
  const { t } = useStrings()
  const count = useMemo(() => (access ? commentCount(access.comments, about) : 0), [access, about])
  if (count === 0) return null
  return (
    <Tooltip title={t('comments.count', { count })}>
      <Box
        component="span" data-testid={`comment-badge-${about.kind}-${about.id}`} aria-label={t('comments.count', { count })}
        sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, ml: 1, fontSize: 11, fontWeight: 400, color: 'text.secondary', verticalAlign: 'middle' }}
      >
        <CommentIcon size={12} />{count}
      </Box>
    </Tooltip>
  )
}

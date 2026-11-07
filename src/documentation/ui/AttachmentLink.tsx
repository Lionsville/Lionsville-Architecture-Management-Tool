// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import type { ReactNode } from 'react'
import Link from '@mui/material/Link'
import { useStrings } from '../../i18n/LanguageContext'
import { useAttachments } from './Attachments'
import { AttachIcon } from './markdownIcons'
import './MarkdownEditor.css'

/** The file a document points at: a link where this source keeps it, its name where it does not. */
export function AttachmentLink({ id, children }: { id: string; children: ReactNode }) {
  const attachments = useAttachments()
  const { t } = useStrings()
  const mark = <span className="md-attachment__mark"><AttachIcon size={13} /></span>
  if (!attachments) {
    return <span className="md-attachment" data-testid="attachment-absent" title={t('md.attachmentNotHere')}>{mark}{children}</span>
  }
  return (
    <Link className="md-attachment" href={attachments.href(id)} target="_blank" rel="noopener noreferrer" data-testid="attachment-link" data-attachment={id}>
      {mark}{children}
    </Link>
  )
}

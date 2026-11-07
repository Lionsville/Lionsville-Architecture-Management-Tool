// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a record's text is read as: the size and the headings of a document. The same
 * measures carry the parts it is written in (`MarkdownFlow`), so what is written
 * stands where it will be read.
 */
import type { ReactNode } from 'react'
import './MarkdownDocument.css'

export function MarkdownDocument({ children, className, testId }: { children: ReactNode; className?: string; testId?: string }) {
  return <div className={className ? `md-document ${className}` : 'md-document'} data-document data-testid={testId}>{children}</div>
}

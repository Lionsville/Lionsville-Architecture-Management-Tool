// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * An explanation behind *why?*: a panel says what is so, and why it is so only
 * when asked. A paragraph that stays on screen is read once and then stands in
 * the way of the rows under it.
 */
import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { useStrings } from '../../i18n/LanguageContext'
import './WhyNote.css'

export function WhyNote({ children, label, 'data-testid': testId }: {
  readonly children: ReactNode
  /** The press's words, where *why?* is not the question. */
  readonly label?: string
  readonly 'data-testid'?: string
}) {
  const { t } = useStrings()
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <div className="kit-why" data-testid={testId}>
      <button type="button" className="kit-why__press" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen((was) => !was)}>
        <span aria-hidden="true">{open ? '▾' : '▸'}</span> {label ?? t('kit.why')}
      </button>
      {open && <div id={id} className="kit-why__note">{children}</div>}
    </div>
  )
}

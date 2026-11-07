// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A state on a card, a row or a cell, said by its shape first and its colour
 * second, so a mark still reads in greyscale and to somebody who cannot tell the
 * colours apart.
 *
 * The set is closed: how something is run (5), a finding's weight (3), what it is
 * covered by (4), agreement, an agent, another day, an exception. A new meaning
 * takes an existing shape with a word beside it, or comes here and asks for a new
 * mark. The word is the caller's: a mark with none near it needs `label`, which
 * is then its accessible name; beside a word that says the same it stays out of
 * the accessibility tree.
 */
import type { ReactNode } from 'react'
import './Mark.css'

const DRAWN = {
  managed: <circle cx="6" cy="6" r="4.5" fill="var(--status-managed)" />,
  partial: (
    <>
      <circle cx="6" cy="6" r="4" fill="none" stroke="var(--status-partial)" strokeWidth="1.4" />
      <path d="M6 2a4 4 0 0 0 0 8z" fill="var(--status-partial)" />
    </>
  ),
  risk: <path d="M6 1.2l5 9.3H1z" fill="var(--status-risk)" />,
  none: <circle cx="6" cy="6" r="3.8" fill="none" stroke="var(--status-none)" strokeWidth="1.4" />,
  unset: <path d="M2.5 6h7" stroke="var(--status-unset)" strokeWidth="1.6" strokeLinecap="round" />,
  fix: <circle cx="6" cy="6" r="4.5" fill="var(--weight-fix)" />,
  review: <path d="M6 1.2l5 9.3H1z" fill="var(--weight-review)" />,
  note: <circle cx="6" cy="6" r="2" fill="var(--weight-note)" />,
  'cov-apps': <circle cx="6" cy="6" r="4.5" fill="var(--cov-apps)" />,
  'cov-moving': <path d="M1.5 4.2h7.5M7 2l2.2 2.2L7 6.4M10.5 7.8H3M5 5.6L2.8 7.8 5 10" fill="none" stroke="var(--cov-moving)" strokeWidth="1.3" />,
  'cov-people': (
    <>
      <circle cx="6" cy="6" r="4" fill="none" stroke="var(--cov-people)" strokeWidth="1.4" />
      <path d="M6 2a4 4 0 0 1 0 8z" fill="var(--cov-people)" />
    </>
  ),
  'cov-none': <circle cx="6" cy="6" r="3.8" fill="none" stroke="var(--cov-none)" strokeWidth="1.4" />,
  agree: <path d="M2 6.5L5 9.5 10 3" fill="none" stroke="var(--ok)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />,
  agent: <path d="M6 1l5 5-5 5-5-5z" fill="var(--agent)" />,
  look: (
    <>
      <circle cx="6" cy="6" r="4.5" fill="none" stroke="var(--looking)" strokeWidth="1.4" />
      <path d="M6 3.2V6l2 1.2" fill="none" stroke="var(--looking)" strokeWidth="1.3" />
    </>
  ),
  exception: (
    <>
      <rect x="2" y="2" width="8" height="8" fill="none" stroke="var(--exception)" strokeWidth="1.6" />
      <path d="M4.5 6h3" stroke="var(--exception)" strokeWidth="1.4" />
    </>
  ),
} satisfies Record<string, ReactNode>

export type MarkKind = keyof typeof DRAWN

export const MARK_KINDS = Object.keys(DRAWN) as MarkKind[]

export type MarkProps = {
  kind: MarkKind
  /** 10 px in a row or on a card, 12 where it stands alone. */
  size?: 10 | 12
  /** What it means, where no word near it says so. */
  label?: string
}

export function Mark({ kind, size = 10, label }: MarkProps) {
  const named = label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true }
  return (
    <svg className="kit-mark" data-kind={kind} data-size={size} viewBox="0 0 12 12" {...named}>
      {DRAWN[kind]}
    </svg>
  )
}

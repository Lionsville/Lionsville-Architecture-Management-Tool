// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * How far a long piece of work has got, where there is a number to say it by:
 * a wait that shows only that something turns gives nobody a reason to go on
 * waiting. The element is the browser's own, so it is said to assistive
 * technology as what it is. Without a `max`, how far is not known yet.
 */
import './Progress.css'

export function Progress({ value, max, label, 'data-testid': testId }: {
  value?: number
  max?: number
  /** What it is the progress of, for a screen reader; the words beside it are the eye's. */
  label: string
  'data-testid'?: string
}) {
  return max !== undefined && max > 0
    ? <progress className="kit-progress" value={Math.min(value ?? 0, max)} max={max} aria-label={label} data-testid={testId} />
    : <progress className="kit-progress" aria-label={label} data-testid={testId} />
}

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Something on or off, said at once, with its words beside it. A checkbox
 * underneath, so the keys and a screen reader are the browser's, drawn as a track
 * and a knob in the kit's colours: MUI's own switch wore its theme's blue and grey,
 * and neither mode's tokens.
 */
import type { ReactNode } from 'react'
import './Switch.css'

export type SwitchProps = {
  checked: boolean
  onChange: (checked: boolean) => void
  /** Its words; the name it is found by. */
  label: ReactNode
  /** Its name, where the words beside it are not plain text. */
  'aria-label'?: string
  disabled?: boolean
  'data-guide'?: string
  'data-testid'?: string
}

export function Switch({ checked, onChange, label, disabled, 'aria-label': name, 'data-guide': guide, 'data-testid': testId }: SwitchProps) {
  return (
    <label className="kit-switch" data-disabled={disabled || undefined} data-guide={guide} data-testid={testId}>
      <input
        type="checkbox" role="switch" className="kit-switch__input" checked={checked} disabled={disabled}
        aria-label={name}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="kit-switch__track" aria-hidden="true"><span className="kit-switch__knob" /></span>
      <span className="kit-switch__label">{label}</span>
    </label>
  )
}

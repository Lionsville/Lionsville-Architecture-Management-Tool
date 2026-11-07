// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * An act. The label is the outcome: *Replace and lose what is here*, *Accept*,
 * *Save a copy*. A place is a link or a tab, not a button.
 *
 * A plain `button` and a static class, because a screen has hundreds of them and
 * MUI's adds nothing here but weight. One primary per region is the screen's to
 * keep to.
 *
 * **Refused, with its reason.** A button with a `reason` is not `disabled` in the
 * browser's sense: it stays in the tab order and answers a hover, because a
 * person who cannot find out why a button is dead learns nothing from it. It says
 * `aria-disabled`, and a press does nothing. `disabled` alone is for the rare
 * button whose reason is plain from the field right above it.
 *
 * **Working** holds the label and the width, says `aria-busy`, and takes no second
 * press.
 */
import { useId } from 'react'
import type { ComponentPropsWithRef, MouseEvent, ReactNode } from 'react'
import { Tooltip } from './Tooltip'
import './Button.css'

export type ButtonVariant = 'primary' | 'plain' | 'quiet' | 'danger'

type NativeButton = Omit<ComponentPropsWithRef<'button'>, 'className' | 'style' | 'children'>

export type ButtonProps = NativeButton & {
  variant?: ButtonVariant
  /** 24 px, for inside a row; 30 px otherwise. */
  size?: 'normal' | 'small'
  working?: boolean
  /** Why it cannot be pressed now. */
  reason?: string
  /** Where the reason is said. A bar has no room beside a button, so the tooltip is the default. */
  reasonAt?: 'tooltip' | 'beside'
  icon?: ReactNode
  children: ReactNode
}

function guarded(blocked: boolean, onClick: NativeButton['onClick']) {
  return (event: MouseEvent<HTMLButtonElement>) => {
    if (blocked) { event.preventDefault(); return }
    onClick?.(event)
  }
}

export function Button({
  variant = 'plain', size = 'normal', working = false, reason, reasonAt = 'tooltip', icon, children, onClick,
  type = 'button', ...rest
}: ButtonProps) {
  const reasonId = useId()
  const refused = reason !== undefined && reason !== ''
  const beside = refused && reasonAt === 'beside'
  const button = (
    <button
      {...rest}
      type={refused || working ? 'button' : type}
      className="kit-button"
      data-variant={variant}
      data-size={size}
      data-refused={refused || undefined}
      aria-disabled={refused || working || undefined}
      aria-busy={working || undefined}
      aria-describedby={beside ? reasonId : rest['aria-describedby']}
      onClick={guarded(refused || working, onClick)}
    >
      {working ? <span className="kit-button__working" aria-hidden /> : icon}
      {children}
    </button>
  )
  if (beside) {
    return (
      <span className="kit-button__with-reason">
        {button}
        <span className="kit-button__reason" id={reasonId}>{reason}</span>
      </span>
    )
  }
  return refused ? <Tooltip title={reason}>{button}</Tooltip> : button
}

type IconButtonProps = Omit<NativeButton, 'aria-label'> & {
  /** Its name, and its tooltip: a control with no word of its own still has one. */
  label: string
  size?: 'normal' | 'small'
  reason?: string
  /** A toggle, on or off. */
  pressed?: boolean
  children: ReactNode
}

/**
 * A control with a glyph for its only face, for the few places a word has no
 * room: ⋯, close, back. A bar's acts stay words.
 */
export function IconButton({ label, size = 'normal', reason, pressed, children, onClick, type = 'button', ...rest }: IconButtonProps) {
  const refused = reason !== undefined && reason !== ''
  return (
    <Tooltip title={refused ? `${label}: ${reason}` : label} names={!refused}>
      <button
        {...rest}
        type={type}
        className="kit-button"
        data-variant="quiet"
        data-size={size}
        data-icon
        data-refused={refused || undefined}
        aria-label={label}
        aria-disabled={refused || undefined}
        aria-pressed={pressed}
        onClick={guarded(refused, onClick)}
      >
        {children}
      </button>
    </Tooltip>
  )
}

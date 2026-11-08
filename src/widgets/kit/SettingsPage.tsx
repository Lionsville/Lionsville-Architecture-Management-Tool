// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * **Settings page**: whose these settings are, in its first line, then sections
 * and rows. Every level of settings says it the same way, so a person can tell
 * what is theirs from what belongs to a scope. With `sections` a list down the
 * side says which one is up, and a screen keeps that in the address.
 *
 * A row applies at once. There is no Save here, since there is nothing to take
 * back: each change is either remembered or a step that can be undone.
 */
import type { ReactNode } from 'react'
import { Button } from './Button'
import './SettingsPage.css'

export type SettingsSide<V extends string = string> = { value: V; label: string }

export function SettingsPage<V extends string = string>({ title, owner, sections, section, onSection, children, 'data-guide': guide }: {
  title: string
  /** Who they belong to and what a change does. */
  owner: string
  sections?: readonly SettingsSide<V>[]
  section?: V
  onSection?: (section: V) => void
  children: ReactNode
  'data-guide'?: string
}) {
  return (
    <div className="kit-settings" data-guide={guide} data-sided={sections ? true : undefined}>
      {sections && (
        <nav className="kit-settings__side" aria-label={title}>
          <h1 className="kit-settings__side-title">{title}</h1>
          {sections.map((one) => (
            <button
              key={one.value} type="button" className="kit-settings__side-row"
              aria-current={one.value === section ? 'true' : undefined} onClick={() => onSection?.(one.value)}
            >
              {one.label}
            </button>
          ))}
          <p className="kit-settings__owner">{owner}</p>
        </nav>
      )}
      <div className="kit-settings__body">
        {!sections && (
          <header className="kit-settings__head">
            <h1 className="kit-settings__title">{title}</h1>
            <p className="kit-settings__owner">{owner}</p>
          </header>
        )}
        {children}
      </div>
    </div>
  )
}

/**
 * A field a way in can land on, by name (`focusSettingsField`): it adds no box
 * of its own, so a row inside lays out as it would without it.
 */
export function SettingsField({ name, children }: { name: string; children: ReactNode }) {
  return <div className="kit-settings__field" data-field={name}>{children}</div>
}

/**
 * Give the focus to the named field's first control, which brings it into view.
 * False where the page has no such field, or none of its controls takes the focus.
 */
export function focusSettingsField(within: ParentNode, name: string): boolean {
  const field = [...within.querySelectorAll<HTMLElement>('[data-field]')].find((one) => one.dataset.field === name)
  const control = field?.querySelector<HTMLElement>('input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])')
  if (!control) return false
  control.focus()
  control.scrollIntoView?.({ block: 'nearest' })
  return true
}

/** A heading, what the section falls back on, and its rows. */
export function SettingsSection({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  return (
    <section className="kit-settings__section">
      <h2 className="kit-settings__section-title">{title}</h2>
      {note && <p className="kit-settings__note">{note}</p>}
      {children}
    </section>
  )
}

/** One setting: its word on the left with a line under it where one helps, its control on the right. */
export function PreferenceRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="kit-settings__row">
      <div className="kit-settings__row-words">
        <span className="kit-settings__row-label">{label}</span>
        {hint && <span className="kit-settings__row-hint">{hint}</span>}
      </div>
      <div className="kit-settings__row-control">{children}</div>
    </div>
  )
}

/** A plain on and off, named by its row. */
export function SettingSwitch({ label, checked, onChange, hint, disabled, boxFirst, 'data-testid': testId }: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  hint?: string
  disabled?: boolean
  /** The box before the words, as a dialog's and a menu's options have it; a settings page keeps it at the end. */
  boxFirst?: boolean
  'data-testid'?: string
}) {
  return (
    <label className={boxFirst ? 'kit-settings__row kit-settings__row--switch kit-settings__row--first' : 'kit-settings__row kit-settings__row--switch'}>
      <span className="kit-settings__row-words">
        <span className="kit-settings__row-label">{label}</span>
        {hint && <span className="kit-settings__row-hint">{hint}</span>}
      </span>
      <input type="checkbox" role="switch" aria-label={label} className="kit-settings__switch" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} data-testid={testId} />
    </label>
  )
}

/**
 * A setting that did not land, said under the field that still shows it: the
 * sentence, and the two ways out — made again, or put back as it is kept. So
 * a value typed and refused never reads as a value kept.
 */
export function SettingNotKept({ said, tryAgain, putBack, onTryAgain, onPutBack, busy = false }: {
  said: string
  tryAgain: string
  putBack: string
  onTryAgain: () => void
  onPutBack: () => void
  busy?: boolean
}) {
  return (
    <div className="kit-settings__notkept" role="alert" data-testid="setting-not-kept">
      <p className="kit-settings__notkept-said">{said}</p>
      <div className="kit-settings__notkept-acts">
        <Button size="small" variant="primary" disabled={busy} onClick={onTryAgain}>{tryAgain}</Button>
        <Button size="small" variant="plain" disabled={busy} onClick={onPutBack}>{putBack}</Button>
      </div>
    </div>
  )
}

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

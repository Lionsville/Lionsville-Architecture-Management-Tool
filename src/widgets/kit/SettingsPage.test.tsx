// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PreferenceRow, SettingNotKept, SettingsPage, SettingsSection, SettingSwitch } from './SettingsPage'

afterEach(() => cleanup())

describe('SettingsPage', () => {
  it('says whose the settings are first, whichever way it is laid out', () => {
    render(<SettingsPage title="Preferences" owner="Yours, on this computer."><p>row</p></SettingsPage>)
    expect(screen.getByRole('heading', { name: 'Preferences' })).toBeDefined()
    expect(screen.getByText('Yours, on this computer.')).toBeDefined()
  })

  it('marks the section that is up in the side list, and asks for another', () => {
    const onSection = vi.fn()
    render(
      <SettingsPage title="This scope" owner="Kept with it." sections={[{ value: 'a', label: 'General' }, { value: 'b', label: 'Links' }]} section="a" onSection={onSection}>
        <SettingsSection title="General"><PreferenceRow label="Name"><input aria-label="Name" /></PreferenceRow></SettingsSection>
      </SettingsPage>,
    )
    expect(screen.getByRole('button', { name: 'General' }).getAttribute('aria-current')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Links' }))
    expect(onSection).toHaveBeenCalledWith('b')
  })

  it('a switch is named by its row and applies at once', () => {
    const onChange = vi.fn()
    render(<SettingSwitch label="Grid" checked={false} onChange={onChange} />)
    fireEvent.click(screen.getByRole('switch', { name: 'Grid' }))
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('says a setting was not kept as an alert, with a way to try again and a way to put it back', () => {
    const onTryAgain = vi.fn()
    const onPutBack = vi.fn()
    render(<SettingNotKept said="Not saved." tryAgain="Try again" putBack="Put back" onTryAgain={onTryAgain} onPutBack={onPutBack} />)
    expect(screen.getByRole('alert').textContent).toContain('Not saved.')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    fireEvent.click(screen.getByRole('button', { name: 'Put back' }))
    expect(onTryAgain).toHaveBeenCalledOnce()
    expect(onPutBack).toHaveBeenCalledOnce()
  })
})

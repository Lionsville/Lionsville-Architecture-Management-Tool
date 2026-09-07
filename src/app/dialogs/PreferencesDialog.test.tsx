// @vitest-environment jsdom
/**
 * The dialog's rule is about absence: a section for a scope that does not
 * exist is not drawn, rather than drawn disabled. And it writes on change,
 * so every control is a call the moment it is touched.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { translator } from '../../i18n'
import { PreferencesDialog } from './PreferencesDialog'
import { renderShell } from '../testing/renderShell'

afterEach(() => cleanup())

const base = {
  open: true,
  onClose: () => {},
  language: 'en' as const,
  onLanguageChange: vi.fn(),
  themeMode: 'system' as const,
  onThemeChange: vi.fn(),
  order: 'name' as const,
  onOrderChange: vi.fn(),
  s: translator('en'),
}

describe('PreferencesDialog', () => {
  it('shows only the general section on a host with nothing else to offer', () => {
    renderShell(<PreferencesDialog {...base} />)
    expect(screen.getByText('GENERAL')).toBeDefined()
    expect(screen.queryByText('UPDATES')).toBeNull()
    expect(screen.queryByText(/ON THIS MACHINE/)).toBeNull()
  })

  it('writes a language, a theme and an order the moment they are chosen', () => {
    const onLanguageChange = vi.fn()
    const onThemeChange = vi.fn()
    const onOrderChange = vi.fn()
    renderShell(<PreferencesDialog
      {...base} onLanguageChange={onLanguageChange} onThemeChange={onThemeChange} onOrderChange={onOrderChange}
    />)
    fireEvent.click(screen.getByText('Nederlands'))
    fireEvent.click(screen.getByText('Dark'))
    fireEvent.click(screen.getByText('Recently changed'))
    expect(onLanguageChange).toHaveBeenCalledWith('nl')
    expect(onThemeChange).toHaveBeenCalledWith('dark')
    expect(onOrderChange).toHaveBeenCalledWith('updated')
  })

  it('offers the update check where the host keeps one, and writes it', () => {
    const onChange = vi.fn()
    renderShell(<PreferencesDialog {...base} updates={{ checkAutomatically: true, onChange }} />)
    fireEvent.click(screen.getByLabelText('Check for updates automatically'))
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('says where the machine settings are kept, and writes them as a patch', () => {
    const onChange = vi.fn()
    renderShell(<PreferencesDialog {...base} machine={{
      pullOnOpen: false, pushAfterSnapshot: false, path: '.lionsville-architecture/local.json', onChange,
    }} />)
    expect(screen.getByText(/local\.json/)).toBeDefined()
    fireEvent.click(screen.getByLabelText(/Pull from the remote/))
    expect(onChange).toHaveBeenCalledWith({ git: { pullOnOpen: true } })
    fireEvent.click(screen.getByLabelText(/Push after every snapshot/))
    expect(onChange).toHaveBeenCalledWith({ git: { pushAfterSnapshot: true } })
  })

  it('has a Close and no Cancel, because there is nothing to cancel', () => {
    renderShell(<PreferencesDialog {...base} />)
    expect(screen.getByText('Close')).toBeDefined()
    expect(screen.queryByText('Cancel')).toBeNull()
    expect(screen.queryByText('Save')).toBeNull()
  })
})

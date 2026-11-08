// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The screen for a boot that did not happen — and the button that is the whole
 * reason it exists. Without it a `lastProject` this build cannot open is read
 * again on the next boot, and the app is unreachable until somebody clears
 * browser storage by hand.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { translator } from '../i18n'
import { BootFailure } from './BootFailure'
import { isFault } from './useShellServices'
import { renderShell } from './testing/renderShell'

afterEach(() => cleanup())

describe('BootFailure', () => {
  it('says what happened, in the words of whoever refused', () => {
    renderShell(<BootFailure
      s={translator('en')} error={new Error('storage refused')}
      onStartFresh={() => {}} onReload={() => {}} />)
    expect(screen.getByTestId('boot-failure').textContent).toContain('The app could not start.')
    expect(screen.getByText('Error: storage refused')).toBeTruthy()
    // The technical words sit behind Details, not inside the sentence.
    expect(screen.getByText('Details').tagName).toBe('SUMMARY')
  })

  it('tells a fault in the app\'s code from a refusal a person can act on', () => {
    expect(isFault(new TypeError('crypto.randomUUID is not a function'))).toBe(true)
    expect(isFault(new Error('storage refused'))).toBe(false)
    expect(isFault('nope')).toBe(false)
  })

  it('offers the way out, and takes it', () => {
    const onStartFresh = vi.fn()
    const onReload = vi.fn()
    renderShell(<BootFailure
      s={translator('en')} error="nope" onStartFresh={onStartFresh} onReload={onReload} />)

    fireEvent.click(screen.getByText('Start without the last scope'))
    expect(onStartFresh).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByText('Reload'))
    expect(onReload).toHaveBeenCalledOnce()
  })
})

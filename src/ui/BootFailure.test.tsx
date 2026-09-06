// @vitest-environment jsdom
/**
 * The screen for a boot that did not happen — and the button that is the whole
 * reason it exists. Without it a `lastProject` this build cannot open is read
 * again on the next boot, and the app is unreachable until somebody clears
 * browser storage by hand.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { translator } from '@lionsville/solution-design'
import { BootFailure } from './BootFailure'
import { renderShell } from './testing/renderShell'

afterEach(() => cleanup())

describe('BootFailure', () => {
  it('says what happened, in the words of whoever refused', () => {
    renderShell(<BootFailure
      s={translator('en')} error={new Error('storage refused')}
      onStartFresh={() => {}} onReload={() => {}} />)
    expect(screen.getByTestId('boot-failure').textContent).toContain('The app could not start.')
    expect(screen.getByText('Error: storage refused')).toBeTruthy()
  })

  it('offers the way out, and takes it', () => {
    const onStartFresh = vi.fn()
    const onReload = vi.fn()
    renderShell(<BootFailure
      s={translator('en')} error="nope" onStartFresh={onStartFresh} onReload={onReload} />)

    fireEvent.click(screen.getByText('Start without the last project'))
    expect(onStartFresh).toHaveBeenCalledOnce()
    fireEvent.click(screen.getByText('Reload'))
    expect(onReload).toHaveBeenCalledOnce()
  })
})

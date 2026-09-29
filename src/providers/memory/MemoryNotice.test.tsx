// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/** Where nothing is kept, the chrome says so all the time; where something is, it says nothing. */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import type { SourceChromeProps } from '../../ports/ProviderParts'
import { MemoryNotice } from './MemoryNotice'

afterEach(() => cleanup())

const props = (current: boolean): SourceChromeProps => ({
  current, open: () => {}, screen: {} as never, movedBy: 'person' as never, notify: () => {},
  preferences: { read: () => ({}), write: () => {} }, reread: () => {},
})

describe('the notice where nothing is kept', () => {
  it('stands from the first render where memory is the source', () => {
    render(<MemoryNotice {...props(true)} />)
    expect(screen.getByTestId('storage-notice').textContent).toContain('This browser could not save the design')
  })

  it('says nothing where the source is somewhere else', () => {
    render(<MemoryNotice {...props(false)} />)
    expect(screen.queryByTestId('storage-notice')).toBeNull()
  })
})

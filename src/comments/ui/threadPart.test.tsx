// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The thread as the readers take it, where its script would not load: a
 * reader opened offline before the thread arrived says its comments could not
 * be loaded, and asks again when told to (`widgets/lazyPart`).
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, screen } from '@testing-library/react'
import { renderShell } from '../../app/testing/renderShell'
import { threadNotLoaded } from './threadPart'

afterEach(() => cleanup())

describe('the thread where its script would not load', () => {
  it('says the comments could not be loaded, and Try again asks for them anew', () => {
    const retry = vi.fn()
    renderShell(<>{threadNotLoaded({}, retry)}</>)
    expect(screen.getByText('Comments could not be loaded.')).toBeTruthy()
    fireEvent.click(screen.getByTestId('part-retry'))
    expect(retry).toHaveBeenCalledTimes(1)
  })
})

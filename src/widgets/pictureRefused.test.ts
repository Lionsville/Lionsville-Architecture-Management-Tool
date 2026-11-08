// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { PICTURE_REFUSED, refused } from './pictureRefused'

describe('an image the browser would not load', () => {
  it('is said as an error with a name the picture dialog knows', () => {
    const said = refused(new Event('error'))
    expect(said).toBeInstanceOf(Error)
    expect((said as Error).name).toBe(PICTURE_REFUSED)
    expect((said as Error).message).toBe('the browser could not draw the page as an image (an error event)')
  })

  it('leaves an error, and anything else, as it was', () => {
    const error = new Error('no bitmap')
    expect(refused(error)).toBe(error)
    expect(refused('gone')).toBe('gone')
  })
})

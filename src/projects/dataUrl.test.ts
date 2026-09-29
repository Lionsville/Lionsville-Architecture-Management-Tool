// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { dataUrl, readDataUrl } from './dataUrl'

describe('a data URL', () => {
  it('reads back the bytes it was made of, in both spellings a data URL arrives in', () => {
    const bytes = new Uint8Array([0, 1, 254, 255])
    expect(readDataUrl(dataUrl('image/png', bytes))).toEqual({ mediaType: 'image/png', bytes })
    expect(readDataUrl('data:,a%20b')).toEqual({ mediaType: 'text/plain', bytes: new TextEncoder().encode('a b') })
  })

  it('is nothing where it is not one, or its bytes will not decode', () => {
    expect(readDataUrl('https://example.org/logo.png')).toBeUndefined()
    expect(readDataUrl('data:image/png;base64,@@@not base64@@@')).toBeUndefined()
    expect(readDataUrl('data:text/plain,%E0%A4%A')).toBeUndefined()
  })
})

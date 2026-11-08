// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * The poster's key draws what a tile shows: its fill, and the corner mark only where
 * tiles draw one. What a lens asks about is flagged, to stand first on the key.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { PosterKeyTile } from './PosterKeyTile'
import { lookOf } from './sheetLook'

afterEach(cleanup)

const swatch = (...args: Parameters<typeof PosterKeyTile>) => {
  const { container } = render(PosterKeyTile(...args))
  return container.querySelector<HTMLElement>('.poster-key-tile')!
}

describe('the poster key’s swatch', () => {
  it('is filled as a tile of that value is, and plain where a tile is plain', () => {
    expect(swatch({ lens: 'who', value: { value: 'nobody' } }).style.getPropertyValue('--poster-tile-fill')).toBe('var(--warn-soft)')
    expect(swatch({ lens: 'who', value: { value: 'held' } }).style.getPropertyValue('--poster-tile-fill')).toBe('')
    expect(swatch({ lens: 'lifecycle', value: { value: 'live' } }).style.getPropertyValue('--poster-tile-fill')).toBe('')
    expect(swatch({ lens: 'retiring', value: { value: 'retiring' } }).style.getPropertyValue('--poster-tile-fill')).toBe('var(--life-retiring-soft)')
  })

  it('draws the corner mark under Covered by alone, as the tiles do', () => {
    expect(swatch({ lens: 'coveredBy', value: { value: 'apps' } }).querySelector('.poster-tile__mark')).not.toBeNull()
    expect(swatch({ lens: 'retiring', value: { value: 'retiring' } }).querySelector('.poster-tile__mark')).toBeNull()
  })

  it('flags what a lens asks about, and nothing that is the usual case', () => {
    expect(lookOf('who', { value: 'nobody' }).flag).toBe(true)
    expect(lookOf('retiring', { value: 'retiring' }).flag).toBe(true)
    expect(lookOf('retiring', { value: 'not' }).flag).toBeUndefined()
    expect(lookOf('lifecycle', { value: 'live' }).flag).toBeUndefined()
  })
})

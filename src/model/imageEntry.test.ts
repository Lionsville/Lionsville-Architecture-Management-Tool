// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { imageEntryOf, pictureSize } from './imageEntry'
import { contentAddressOf } from './imageName'

describe('what bytes say about themselves', () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 2, 128, 0, 0, 1, 224])
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, 0, 120, 0, 160, 1, 1, 0x11, 0])
  const vp8x = new Uint8Array(30)
  vp8x.set([...'RIFF'].map((c) => c.charCodeAt(0)), 0)
  vp8x.set([...'WEBPVP8X'].map((c) => c.charCodeAt(0)), 8)
  vp8x.set([99, 0, 0, 49, 0, 0], 24)

  it('reads the size a PNG, a JPEG, a WebP and an SVG declare', () => {
    expect(pictureSize(png, 'image/png')).toEqual({ width: 640, height: 480 })
    expect(pictureSize(jpeg, 'image/jpeg')).toEqual({ width: 160, height: 120 })
    expect(pictureSize(vp8x, 'image/webp')).toEqual({ width: 100, height: 50 })
    const svg = (tag: string) => new TextEncoder().encode(`<?xml version="1.0"?>${tag}</svg>`)
    expect(pictureSize(svg('<svg width="64px" height="32">'), 'image/svg+xml')).toEqual({ width: 64, height: 32 })
    expect(pictureSize(svg('<svg viewBox="0 0 120.4 80">'), 'image/svg+xml')).toEqual({ width: 120, height: 80 })
    expect(pictureSize(new Uint8Array([1, 2, 3]), 'image/png')).toBeUndefined()
  })

  it('describes bytes as a library entry, with zeros where they declare no size', async () => {
    expect(await imageEntryOf('diagrams/context.png', png)).toEqual({
      name: 'diagrams/context.png', mediaType: 'image/png', size: png.length, width: 640, height: 480,
      contentAddress: await contentAddressOf(png),
    })
    expect(await imageEntryOf('x.jpg', new Uint8Array([1]))).toMatchObject({ mediaType: 'image/jpeg', width: 0, height: 0 })
  })
})

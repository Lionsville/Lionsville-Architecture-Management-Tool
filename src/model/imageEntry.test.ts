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

  /** A JPEG of 160 × 120 stored, with an Exif segment saying which way up, in either byte order. */
  function turned(orientation: number, order: 'II' | 'MM'): Uint8Array {
    const two = (value: number) => (order === 'MM' ? [value >> 8, value & 0xff] : [value & 0xff, value >> 8])
    const four = (value: number) => (order === 'MM' ? [0, 0, ...two(value)] : [...two(value), 0, 0])
    const tiff = [
      ...[...order].map((c) => c.charCodeAt(0)), ...two(42), ...four(8),
      ...two(1), ...two(0x0112), ...two(3), ...four(1), ...two(orientation), 0, 0, ...four(0),
    ]
    const app1 = [...[...'Exif'].map((c) => c.charCodeAt(0)), 0, 0, ...tiff]
    return new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0, app1.length + 2, ...app1, ...jpeg.slice(8)])
  }

  it('reads a JPEG the way up its Exif says it is seen', () => {
    expect(pictureSize(turned(6, 'MM'), 'image/jpeg')).toEqual({ width: 120, height: 160 })
    expect(pictureSize(turned(8, 'II'), 'image/jpeg')).toEqual({ width: 120, height: 160 })
    expect(pictureSize(turned(3, 'II'), 'image/jpeg')).toEqual({ width: 160, height: 120 })
    expect(pictureSize(turned(1, 'MM'), 'image/jpeg')).toEqual({ width: 160, height: 120 })
  })

  it('reads a JPEG whose APP1 is not Exif, or is Exif in no byte order, as it is stored', () => {
    const other = new Uint8Array([0xff, 0xd8, 0xff, 0xe1, 0, 8, ...[...'XMP\0\0\0'].map((c) => c.charCodeAt(0)), ...jpeg.slice(8)])
    expect(pictureSize(other, 'image/jpeg')).toEqual({ width: 160, height: 120 })
    const bent = turned(6, 'MM')
    bent.set([0x58, 0x58], 12)
    expect(pictureSize(bent, 'image/jpeg')).toEqual({ width: 160, height: 120 })
  })

  it('describes bytes as a library entry, with zeros where they declare no size', async () => {
    expect(await imageEntryOf('diagrams/context.png', png)).toEqual({
      name: 'diagrams/context.png', mediaType: 'image/png', size: png.length, width: 640, height: 480,
      contentAddress: await contentAddressOf(png),
    })
    expect(await imageEntryOf('x.jpg', new Uint8Array([1]))).toMatchObject({ mediaType: 'image/jpeg', width: 0, height: 0 })
  })
})

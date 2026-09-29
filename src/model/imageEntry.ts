// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a picture's bytes say about themselves, read once, when it is added
 * to a library (ADR-0031 §3): its media type, its size, the dimensions its
 * own header declares, and its content address.
 *
 * Read here, beside the entry it fills, so everything that adds a picture —
 * a person pasting one into a document, an agent handing one over, a source
 * reading one it holds no entry for — describes it by one rule. A page never
 * reads this: it lays a picture out from the entry, before the bytes arrive.
 */
import { imageMediaType } from './documentImage'
import { contentAddressOf } from './imageName'
import type { ImageEntry, ImageName } from './imageName'

/** Big-endian unsigned, of `size` bytes at `at`. */
function big(bytes: Uint8Array, at: number, size: number): number {
  let value = 0
  for (let n = 0; n < size; n += 1) value = value * 256 + (bytes[at + n] ?? 0)
  return value
}

/** Little-endian unsigned, of `size` bytes at `at`. */
function little(bytes: Uint8Array, at: number, size: number): number {
  let value = 0
  for (let n = size - 1; n >= 0; n -= 1) value = value * 256 + (bytes[at + n] ?? 0)
  return value
}

/** A picture's dimensions, in pixels. */
export type PictureSize = { width: number; height: number }

function pngSize(bytes: Uint8Array): PictureSize | undefined {
  const signature = [0x89, 0x50, 0x4e, 0x47]
  if (!signature.every((byte, at) => bytes[at] === byte) || bytes.length < 24) return undefined
  return { width: big(bytes, 16, 4), height: big(bytes, 20, 4) }
}

/** The first frame header's size: SOF0 to SOF15, but for the three markers that are not frames. */
function jpegSize(bytes: Uint8Array): PictureSize | undefined {
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return undefined
  let at = 2
  while (at + 9 < bytes.length) {
    if (bytes[at] !== 0xff) return undefined
    const marker = bytes[at + 1]
    const length = big(bytes, at + 2, 2)
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { width: big(bytes, at + 7, 2), height: big(bytes, at + 5, 2) }
    }
    at += 2 + length
  }
  return undefined
}

function webpSize(bytes: Uint8Array): PictureSize | undefined {
  const tag = (at: number) => String.fromCharCode(...bytes.slice(at, at + 4))
  if (bytes.length < 30 || tag(0) !== 'RIFF' || tag(8) !== 'WEBP') return undefined
  switch (tag(12)) {
    case 'VP8 ': return { width: little(bytes, 26, 2) & 0x3fff, height: little(bytes, 28, 2) & 0x3fff }
    case 'VP8L': {
      const bits = little(bytes, 21, 4)
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }
    }
    case 'VP8X': return { width: little(bytes, 24, 3) + 1, height: little(bytes, 27, 3) + 1 }
    default: return undefined
  }
}

/** A length an SVG states in pixels, or plainly; a percentage or an em is not a size. */
function svgLength(value: string | undefined): number | undefined {
  const match = value === undefined ? null : /^\s*([0-9.]+)\s*(px)?\s*$/.exec(value)
  return match ? Math.round(Number(match[1])) : undefined
}

function svgSize(bytes: Uint8Array): PictureSize | undefined {
  const text = new TextDecoder().decode(bytes.slice(0, 4096))
  const tag = /<svg\b[^>]*>/i.exec(text)?.[0]
  if (!tag) return undefined
  const attribute = (name: string) => new RegExp(`\\s${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(tag)?.[1]
  const width = svgLength(attribute('width'))
  const height = svgLength(attribute('height'))
  if (width !== undefined && height !== undefined) return { width, height }
  const box = attribute('viewBox')?.trim().split(/[\s,]+/).map(Number)
  if (box?.length === 4 && box.every((value) => Number.isFinite(value))) {
    return { width: Math.round(box[2]), height: Math.round(box[3]) }
  }
  return undefined
}

/**
 * The size a picture declares in its own header, in pixels, or nothing
 * where it declares none this can read — then a page reserves no space for
 * it until it arrives, which is what an entry of zeros says.
 */
export function pictureSize(bytes: Uint8Array, mediaType: string): PictureSize | undefined {
  switch (mediaType) {
    case 'image/png': return pngSize(bytes)
    case 'image/jpeg': return jpegSize(bytes)
    case 'image/webp': return webpSize(bytes)
    case 'image/svg+xml': return svgSize(bytes)
    default: return undefined
  }
}

/** A library entry for bytes under a name: what the name says they are, and what they say about themselves. */
export async function imageEntryOf(name: ImageName, bytes: Uint8Array): Promise<ImageEntry> {
  const mediaType = imageMediaType(name) ?? ''
  const size = pictureSize(bytes, mediaType)
  const whole = (value: number | undefined) => (value !== undefined && Number.isSafeInteger(value) && value >= 0 ? value : 0)
  return {
    name,
    mediaType,
    size: bytes.length,
    width: whole(size?.width),
    height: whole(size?.height),
    contentAddress: await contentAddressOf(bytes),
  }
}

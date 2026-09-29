// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Bytes as text a person can hand on: base64, and the data URL a mark, a
 * picture a person pasted, or a picture a working set carries, is written as.
 * How anything is kept is not here, only how bytes are spelt.
 */

/**
 * Bytes as base64 and back.
 *
 * `btoa`/`atob` because they are the one pair both runtimes have had forever —
 * node since 16, every browser since always — and because the alternative,
 * `Buffer`, is a node global this layer is not allowed to know about. The
 * chunking is not decoration: `String.fromCharCode(...bytes)` on a 200 KB mark
 * is 200,000 arguments and overflows the call stack.
 */
export function base64FromBytes(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

export function bytesFromBase64(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** What a data URL carries, or `undefined` when it is not one we can unpack. */
export type DataUrlContent = { mediaType: string; bytes: Uint8Array }

/**
 * A data URL taken apart.
 *
 * Both spellings, because both arrive: `;base64,` from a `FileReader` and the
 * percent-encoded form from anything that built the URL by hand.
 */
export function readDataUrl(url: string): DataUrlContent | undefined {
  const match = /^data:([^,;]*)(;[^,]*)?,(.*)$/s.exec(url)
  if (!match) return undefined
  const mediaType = match[1] || 'text/plain'
  try {
    const bytes = (match[2] ?? '').includes('base64')
      ? bytesFromBase64(match[3])
      : new TextEncoder().encode(decodeURIComponent(match[3]))
    return { mediaType, bytes }
  } catch {
    return undefined
  }
}

/** Always base64: it survives a copy through anything, which text does not. */
export function dataUrl(mediaType: string, bytes: Uint8Array): string {
  return `data:${mediaType};base64,${base64FromBytes(bytes)}`
}

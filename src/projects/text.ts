// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A value as text, and text as bytes: written the same way twice.
 *
 * Two writes of a value nobody changed must produce the same text, or every
 * save is a difference and every comparison a false one. Stability is not
 * something a `JSON.stringify` call gives you for free — key order follows
 * insertion order, which follows whichever spread rebuilt the object last. So
 * JSON is written with sorted keys, two-space indent and a trailing newline,
 * wherever a value is written as text: a working file, a settings record, an
 * implementation's own files.
 */

/**
 * JSON as a file: keys sorted, two spaces, one trailing newline.
 *
 * Sorted at every level, including inside arrays of objects, because the
 * alternative is a diff that says a line moved when nothing changed. The
 * replacer rebuilds each object rather than sorting in place — `JSON.stringify`
 * walks the value the replacer returns, so this is the one hook that reaches
 * every nested object without a recursive copy of our own.
 *
 * `undefined` disappears, as it does in any JSON: a field that is absent and a
 * field set to `undefined` are the same file, which is exactly the distinction
 * the readers below refuse to invent.
 */
export function stableJson(value: unknown): string {
  const sorted = JSON.stringify(value, (_key, held: unknown) => {
    if (!held || typeof held !== 'object' || Array.isArray(held)) return held
    const record = held as Record<string, unknown>
    return Object.fromEntries(Object.keys(record).sort().map((key) => [key, record[key]]))
  }, 2)
  return `${sorted ?? 'null'}\n`
}

/** JSON back, or `undefined` for anything that is not JSON at all. */
export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

/** Text as the bytes that carry it, and back. */
export function bytesFromText(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

export function textFromBytes(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}

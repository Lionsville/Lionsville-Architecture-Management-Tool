// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A working file under a password (ADR-0023).
 *
 * What leaves the app as a `.lvarch` is the whole organisation — every scope,
 * every record, every picture — and it leaves through a save dialog, a mail
 * client, a chat window, a USB stick. The zip a person could unzip and read
 * without this tool (ADR-0003) is exactly as readable to whoever finds it. So
 * the zip is sealed: the bytes `workingFileBytes` makes are encrypted under a
 * password the person types when they export, and typed again by whoever
 * opens the file.
 *
 * Why a sealed zip and not a zip with encrypted entries: a zip's own password
 * schemes leave every file name in the clear — a listing of an organisation's
 * scopes and boards is already a fact about the organisation — and the
 * traditional one is broken outright. What this writes is one opaque blob;
 * nothing about what is inside can be read without the password, not even
 * how many scopes there are.
 *
 * The container, in order:
 *
 *   magic        `lvarch-sealed`, 13 bytes — how `isSealed` tells one apart
 *   version      1 byte, this is 1
 *   iterations   4 bytes, big-endian — the PBKDF2 count, written so it can go
 *                up in a later build without turning the version
 *   salt         16 bytes, random per file
 *   nonce        12 bytes, random per file
 *   ciphertext   AES-256-GCM over the zip, its 16-byte tag last
 *
 * The header is the cipher's additional data, so a header altered after the
 * fact — a lowered iteration count, most usefully — fails the tag with the
 * body. The key is PBKDF2-HMAC-SHA256 over the password with the salt, at a
 * count chosen to make guessing slow on the hardware of 2026 and still be a
 * pause rather than a wait on a laptop. A count in a header is read, not
 * trusted: one above `MAX_ITERATIONS` is refused as not a working file, so a
 * hand-made header cannot hold the app for an hour deriving a key.
 *
 * Pure over Web Crypto, which the browser, the desktop's renderer and node
 * all have; nothing here touches a disk or a dialog. A wrong password and a
 * damaged file are the same answer — `undefined` — because the tag cannot
 * tell them apart and neither can the person, whose next move is the same.
 */

/** How a sealed file starts. ASCII, and no zip or JSON document starts this way. */
const MAGIC = new TextEncoder().encode('lvarch-sealed')
const VERSION = 1

const SALT_LENGTH = 16
const NONCE_LENGTH = 12
const HEADER_LENGTH = MAGIC.length + 1 + 4 + SALT_LENGTH + NONCE_LENGTH

/**
 * The PBKDF2 count this build writes. OWASP's 2023 floor for SHA-256 is
 * 600,000; this is that.
 */
export const SEAL_ITERATIONS = 600_000

/** Above this a header is a hostage situation rather than a setting. */
export const MAX_ITERATIONS = 10_000_000

/** What a sealed file is, for the save dialog: bytes that are nothing else. */
export const SEALED_FILE_MEDIA_TYPE = 'application/octet-stream'

export function isSealed(bytes: Uint8Array): boolean {
  if (bytes.length < HEADER_LENGTH) return false
  for (let i = 0; i < MAGIC.length; i += 1) if (bytes[i] !== MAGIC[i]) return false
  return true
}

function subtle(): SubtleCrypto {
  const held = globalThis.crypto?.subtle
  if (!held) throw new Error('Web Crypto is not available here')
  return held
}

async function keyFor(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await subtle().importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'],
  )
  return subtle().deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/**
 * The zip, sealed under the password.
 *
 * Random salt and nonce every time, which is what makes the same password
 * safe to use twice and what stops two exports of an unchanged organisation
 * being byte-for-byte the same — the reproducibility `workingFileBytes` keeps
 * is the zip's, inside, and is what a person gets back on opening.
 *
 * `iterations` is for a test that cannot afford six hundred thousand rounds
 * per clause; a caller with a person waiting leaves it alone.
 */
export async function sealBytes(
  plain: Uint8Array, password: string, options: { iterations?: number } = {},
): Promise<Uint8Array> {
  const iterations = options.iterations ?? SEAL_ITERATIONS
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_LENGTH))
  const header = new Uint8Array(HEADER_LENGTH)
  header.set(MAGIC, 0)
  header[MAGIC.length] = VERSION
  new DataView(header.buffer).setUint32(MAGIC.length + 1, iterations)
  header.set(salt, MAGIC.length + 5)
  header.set(nonce, MAGIC.length + 5 + SALT_LENGTH)
  const key = await keyFor(password, salt, iterations)
  const sealed = await subtle().encrypt(
    { name: 'AES-GCM', iv: nonce as BufferSource, additionalData: header as BufferSource },
    key, plain as BufferSource,
  )
  const out = new Uint8Array(HEADER_LENGTH + sealed.byteLength)
  out.set(header, 0)
  out.set(new Uint8Array(sealed), HEADER_LENGTH)
  return out
}

/**
 * The zip back out, or `undefined` for a wrong password, a damaged file, a
 * version this build does not read and a header that asks too much.
 */
export async function unsealBytes(sealed: Uint8Array, password: string): Promise<Uint8Array | undefined> {
  if (!isSealed(sealed)) return undefined
  if (sealed[MAGIC.length] !== VERSION) return undefined
  const header = sealed.subarray(0, HEADER_LENGTH)
  const iterations = new DataView(sealed.buffer, sealed.byteOffset).getUint32(MAGIC.length + 1)
  if (iterations < 1 || iterations > MAX_ITERATIONS) return undefined
  const salt = sealed.subarray(MAGIC.length + 5, MAGIC.length + 5 + SALT_LENGTH)
  const nonce = sealed.subarray(MAGIC.length + 5 + SALT_LENGTH, HEADER_LENGTH)
  try {
    const key = await keyFor(password, salt, iterations)
    const plain = await subtle().decrypt(
      { name: 'AES-GCM', iv: nonce as BufferSource, additionalData: header as BufferSource },
      key, sealed.subarray(HEADER_LENGTH) as BufferSource,
    )
    return new Uint8Array(plain)
  } catch {
    // The tag did not check out. Which of the reasons it is, nobody can tell
    // from here, and the person's next move is the same for all of them.
    return undefined
  }
}

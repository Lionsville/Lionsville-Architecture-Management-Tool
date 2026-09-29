// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A picture in a scope's image library, as the domain names it (ADR-0031 §3).
 *
 * **An image is named by its name**, extension included, unique in its
 * scope's library: `context.png`. The library may have image folders, and they
 * are carried in the name — `diagrams/context.png` is the picture
 * `context.png` in the image folder `diagrams` — so an image folder is nothing
 * but the names that start with it, and there is no second thing to keep in
 * step with the names.
 *
 * **A document refers to one by name**: `![alt](image:diagrams/context.png)`.
 * A name and not a place: how an implementation keeps the bytes, and what it
 * writes into a document it keeps, is its own business, translated both ways
 * where it keeps them, and the domain never reads anything but the name.
 *
 * **The bytes are named by what they are**: a content address, the SHA-256 of
 * the bytes. The same picture added twice is one set of bytes; a picture
 * changed is another address, so whoever keeps a copy of one never has to
 * ask whether it is still current. Fixed here rather than left to each
 * implementation, so an address means the same thing in every source a
 * picture passes through.
 *
 * The library entry carries what laying a picture out needs — media type,
 * size, width and height — so a page lays out every picture at once and asks
 * for the bytes of one only when it comes into view.
 */
import { imageMediaType } from './documentImage'

/** What a picture is called in its scope's library, image folders included: `diagrams/context.png`. */
export type ImageName = string

/** An image folder of the library, as the names in it start: `diagrams`, or `''` for the top. */
export type ImageFolder = string

/** The bytes' own name: `sha256:` and the digest in lower-case hex. */
export type ContentAddress = string

/** One picture in a scope's library: everything about it but its bytes. */
export type ImageEntry = {
  readonly name: ImageName
  /** `image/png` and the rest `documentImage` allows, read off the name's extension. */
  readonly mediaType: string
  /** Of the bytes, in bytes. */
  readonly size: number
  /** In pixels, as the picture declares itself. What a page reserves before the bytes arrive. */
  readonly width: number
  readonly height: number
  readonly contentAddress: ContentAddress
}

/** How a document names a picture: `image:` and its name. */
export const IMAGE_REFERENCE = 'image:'

/**
 * One segment of a name: something a person can read in a document and that
 * a markdown reader takes as one link target. No white space, which ends a
 * link target; no brackets, which close one; nothing a reader would take as
 * the start of a question or a fragment; no escape character; and nothing
 * invisible.
 */
const SEGMENT = /^[^\s\\/<>()?#%]+$/u

function isSegment(segment: string): boolean {
  if (segment === '.' || segment === '..' || !SEGMENT.test(segment)) return false
  // Written out rather than in the pattern, which a linter reads as a mistake.
  return [...segment].every((character) => {
    const code = character.codePointAt(0) ?? 0
    return code >= 0x20 && code !== 0x7f
  })
}

/**
 * Why a name cannot be a picture's name, as a refusal key — or `undefined`
 * where it can.
 *
 * `shell.imageBadName` for a name that is not one: empty, an image folder
 * with no name in it, a segment that is `.` or `..`, or a character a reference
 * cannot carry. `shell.imageBadType` for a name whose extension is not a
 * picture this tool writes and reads back.
 */
export function imageNameRefusal(name: unknown): 'shell.imageBadName' | 'shell.imageBadType' | undefined {
  if (typeof name !== 'string') return 'shell.imageBadName'
  if (!name.split('/').every(isSegment)) return 'shell.imageBadName'
  return imageMediaType(name) === undefined ? 'shell.imageBadType' : undefined
}

export function isImageName(name: unknown): name is ImageName {
  return imageNameRefusal(name) === undefined
}

/** The image folder a name is in: everything before its last `/`, and `''` at the top. */
export function imageFolderOf(name: ImageName): ImageFolder {
  const at = name.lastIndexOf('/')
  return at < 0 ? '' : name.slice(0, at)
}

/**
 * The image folders directly under `within` that `names` hold pictures in, at
 * any depth below them, sorted. What a listing of one image folder shows
 * beside the pictures in it.
 */
export function imageFoldersUnder(within: ImageFolder, names: Iterable<ImageName>): ImageFolder[] {
  const prefix = within === '' ? '' : `${within}/`
  const found = new Set<ImageFolder>()
  for (const name of names) {
    if (!name.startsWith(prefix)) continue
    const rest = name.slice(prefix.length)
    const at = rest.indexOf('/')
    if (at > 0) found.add(`${prefix}${rest.slice(0, at)}`)
  }
  return [...found].sort()
}

/** A picture's reference in a document. */
export function imageReference(name: ImageName): string {
  return `${IMAGE_REFERENCE}${name}`
}

/** The name a document's reference names, or `undefined` where it names something else. */
export function imageNameOfReference(target: string): ImageName | undefined {
  if (!target.startsWith(IMAGE_REFERENCE)) return undefined
  const name = target.slice(IMAGE_REFERENCE.length)
  return isImageName(name) ? name : undefined
}

/** The content address of some bytes. */
export async function contentAddressOf(bytes: Uint8Array): Promise<ContentAddress> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes)))
  return `sha256:${Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')}`
}

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A scope's pictures, between the domain's names and the files they are kept
 * as (ADR-0031 §3).
 *
 * **Documents.** The domain names a picture `image:<name>`; a folder's
 * documents say `../images/<file>`, so that a folder still reads in any
 * markdown viewer. {@link namesInDocuments} reads the second as the first, and
 * {@link filesInDocuments} writes the first as the second. A document that
 * did not change is written back exactly as it was read — the same `../`
 * count, the same escapes — so nothing a person did not touch is rewritten.
 *
 * **Names.** A file a person put in `images/` by hand, or that an older build
 * wrote, may have a name the domain refuses: a space, a bracket, an accent a
 * disk gave back decomposed. {@link imageNameOfFile} gives it a name that
 * passes, and the file keeps its own.
 *
 * **Entries.** {@link imageEntryOf} describes bytes the way a library entry
 * does: media type, size, the dimensions the picture declares, and the
 * content address.
 *
 * Pure, so browser storage — which keeps the same references in what people
 * already have — reads them with the same rule.
 */
import { imageMediaType } from '../../model/documentImage'
import type { HostModel } from '../../model/hostModel'
import { contentAddressOf, IMAGE_REFERENCE, imageName, imageNameKey, imageNameOfReference } from '../../model/imageName'
import type { ImageEntry, ImageName } from '../../model/imageName'
import { adrPath } from '../../projects/adrFile'

/** The folder, inside a scope's own, that its pictures are kept in. */
export const PICTURES = 'images'

/** How a file the folder keeps is found from a name, and a name from a file (both inside the pictures folder). */
export type PictureFiles = {
  nameOf(file: string): ImageName | undefined
  fileOf(name: ImageName): string | undefined
}

/** An image in markdown: the `![alt](` and the source after it, bare or in angle brackets. */
const IMAGE_SOURCE = /(!\[[^\]]*\]\()(<[^>\n]*>|[^)\s]+)/g

/** `images/<file>`, after any number of `../`, and nothing before them. */
const IN_PICTURES = /^(?:\.\.\/)*images\/(.+)$/

/** The file inside the pictures folder a document's source names, or `undefined`. */
export function pictureFileOf(source: string): string | undefined {
  const bare = source.startsWith('<') && source.endsWith('>') ? source.slice(1, -1) : source
  let path = bare.split(/[?#]/)[0]
  try {
    path = decodeURIComponent(path)
  } catch {
    // Not percent-encoding anybody wrote on purpose: read as it stands.
  }
  return IN_PICTURES.exec(path)?.[1]
}

/** A file's place in a document, escaped where markdown would otherwise end it. */
function sourceFor(file: string, depth: number): string {
  const escaped = file.split('/').map((segment) => segment.replace(/[\s()<>%]/g, (character) =>
    encodeURIComponent(character))).join('/')
  return `${'../'.repeat(Math.max(1, depth))}${PICTURES}/${escaped}`
}

/** One document's text with every picture source it names read as a name. */
function textWithNames(text: string, nameOf: PictureFiles['nameOf']): string {
  return text.replace(IMAGE_SOURCE, (whole, opening: string, source: string) => {
    const file = pictureFileOf(source)
    const name = file === undefined ? undefined : nameOf(file)
    return name === undefined ? whole : `${opening}${IMAGE_REFERENCE}${name}`
  })
}

/** One document's text with every `image:` name written as the file it is kept as. */
function textWithFiles(text: string, fileOf: PictureFiles['fileOf'], depth: number): string {
  return text.replace(IMAGE_SOURCE, (whole, opening: string, source: string) => {
    const name = imageNameOfReference(source)
    const file = name === undefined ? undefined : fileOf(name)
    return file === undefined ? whole : `${opening}${sourceFor(file, depth)}`
  })
}

type Documented = { id: string; body: string }

/** How deep in a scope's folder a decision is filed: a decision about something is one folder further down. */
function decisionDepth(decision: NonNullable<HostModel['decisions']>[number]): number {
  return adrPath(decision).split('/').length - 1
}

/**
 * Every document the model holds, rewritten one by one: an element's
 * description, and the body of every decision, plan, observation, cause,
 * solution and experiment — each with how deep its file sits, and what the
 * same record said in `was`, where there was one.
 */
function eachDocument(
  model: HostModel,
  was: HostModel | undefined,
  rewrite: (text: string, depth: number, before: string | undefined) => string,
): HostModel {
  const lists = <T extends Documented>(held: readonly T[] | undefined, before: readonly T[] | undefined, depth: (one: T) => number) => {
    if (!held) return undefined
    const previous = new Map((before ?? []).map((one) => [one.id, one.body]))
    return held.map((one) => {
      const body = rewrite(one.body, depth(one), previous.get(one.id))
      return body === one.body ? one : { ...one, body }
    })
  }
  const described = new Map((was?.elements ?? []).map((element) => [element.id, element.description]))
  const next: HostModel = {
    ...model,
    elements: model.elements.map((element) => {
      if (element.description === undefined) return element
      const description = rewrite(element.description, 1, described.get(element.id))
      return description === element.description ? element : { ...element, description }
    }),
  }
  const replace = <K extends 'decisions' | 'transitions' | 'observations' | 'causes' | 'solutions' | 'experiments'>(
    key: K, depth: (one: NonNullable<HostModel[K]>[number]) => number,
  ) => {
    const rewritten = lists(model[key] as Documented[] | undefined, was?.[key] as Documented[] | undefined, depth as (one: Documented) => number)
    if (rewritten) (next as Record<K, unknown>)[key] = rewritten
  }
  replace('decisions', decisionDepth)
  replace('transitions', () => 1)
  replace('observations', () => 1)
  replace('causes', () => 2)
  replace('solutions', () => 2)
  replace('experiments', () => 2)
  return next
}

/** The model with every picture a document names by its file named by its name, as the domain reads it. */
export function namesInDocuments(model: HostModel, nameOf: PictureFiles['nameOf']): HostModel {
  return eachDocument(model, undefined, (text) => textWithNames(text, nameOf))
}

/**
 * The model with every `image:` name written as the file it is kept as.
 *
 * `was` is the model as it was read, before {@link namesInDocuments}: a
 * document that reads now as it read then is written as it was, byte for
 * byte, and only one that changed is written afresh — at the depth its file
 * is kept at, with the escapes a markdown reader needs.
 */
export function filesInDocuments(model: HostModel, was: HostModel | undefined, files: PictureFiles): HostModel {
  return eachDocument(model, was, (text, depth, before) => {
    if (before !== undefined && textWithNames(before, files.nameOf) === text) return before
    return textWithFiles(text, files.fileOf, depth)
  })
}

/** A character a picture's name may not hold, which a name made from a file holds a hyphen for. */
function refused(character: string): boolean {
  const code = character.codePointAt(0) ?? 0
  return code < 0x20 || code === 0x7f || /[\s\\<>()?#%:*"|]/u.test(character)
}

/**
 * A name for a file kept in the pictures folder, as a picture's name must be:
 * composed, each refused character a hyphen, and — where two files would be
 * one name by the library's rule (`imageNameKey`) — a number before the
 * extension. `taken` is the keys already given out; the answer's is added.
 * The file keeps its own name wherever it is kept.
 */
export function imageNameOfFile(file: string, taken: Set<string>): ImageName {
  const segments = imageName(file).split('/').map((segment) => {
    const made = [...segment].map((character) => (refused(character) ? '-' : character)).join('')
    return made === '' || made === '.' || made === '..' ? 'picture' : made
  })
  const base = segments.join('/')
  const dot = base.lastIndexOf('.')
  const stem = dot > base.lastIndexOf('/') ? base.slice(0, dot) : base
  const extension = dot > base.lastIndexOf('/') ? base.slice(dot) : ''
  let name = base
  for (let n = 2; taken.has(imageNameKey(name)); n += 1) name = `${stem}-${n}${extension}`
  taken.add(imageNameKey(name))
  return name
}

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

type Size = { width: number; height: number }

function pngSize(bytes: Uint8Array): Size | undefined {
  const signature = [0x89, 0x50, 0x4e, 0x47]
  if (!signature.every((byte, at) => bytes[at] === byte) || bytes.length < 24) return undefined
  return { width: big(bytes, 16, 4), height: big(bytes, 20, 4) }
}

/** The first frame header's size: SOF0 to SOF15, but for the three markers that are not frames. */
function jpegSize(bytes: Uint8Array): Size | undefined {
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

function webpSize(bytes: Uint8Array): Size | undefined {
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

function svgSize(bytes: Uint8Array): Size | undefined {
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
export function pictureSize(bytes: Uint8Array, mediaType: string): Size | undefined {
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

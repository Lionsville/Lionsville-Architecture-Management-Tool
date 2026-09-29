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
 * Pure, so browser storage — which keeps the same references in what people
 * already have — reads them with the same rule.
 */
import type { HostModel } from '../../model/hostModel'
import { IMAGE_REFERENCE, imageName, imageNameKey, imageNameOfReference } from '../../model/imageName'
import type { ImageName } from '../../model/imageName'
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

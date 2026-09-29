// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a document says about a picture (ADR-0009, ADR-0031 §3).
 *
 * A document names a picture by its name in the scope's image library, the
 * way a markdown image names its source:
 *
 * ```markdown
 * ![Cutover routing, week 3](image:cutover-routing.png)
 * ```
 *
 * A name, not a path: the library is what says which pictures there are, and
 * a document cannot name one its scope does not hold, whatever it writes. How
 * a place that keeps work spells the reference in its own files is that
 * place's business, translated on the way in and out.
 */
import { imageNameOfReference, imageReference } from '../model/imageName'
import type { ImageName } from '../model/imageName'

/** The markdown that shows a picture of the library: its name as the source, and what it shows as the words. */
export function pictureMarkdown(name: ImageName, alt: string): string {
  return `![${alt.replace(/[[\]]/g, '')}](${imageReference(name)})`
}

/**
 * Every picture a document refers to, in the order it refers to them: by its
 * name in the library (`image:<name>`), or by a relative path to it.
 */
export function imagesUsedIn(markdown: string): string[] {
  const found: string[] = []
  for (const match of markdown.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)) {
    const file = imageNameOfSource(match[1])
    if (file && !found.includes(file)) found.push(file)
  }
  return found
}

/**
 * The picture an image source names by its name in the library —
 * `image:diagrams/context.png` — or `undefined` for any other source. Read
 * after undoing the percent-encoding a markdown renderer applies to a source,
 * so a name with an accent in it is the name it was written as.
 */
export function imageNameOfSource(src: string | undefined): ImageName | undefined {
  if (!src) return undefined
  const bare = src.startsWith('<') && src.endsWith('>') ? src.slice(1, -1) : src
  let target = bare
  try {
    target = decodeURIComponent(bare)
  } catch {
    // Not percent-encoding anybody wrote on purpose: read as it stands.
  }
  return imageNameOfReference(target.normalize('NFC'))
}

/** A document, as the usage scan sees it: what to call it, and what it says. */
export interface NamedDocument {
  label: string
  text: string
}

/**
 * The documents that show this picture, by label — what a person is told
 * before they delete it. Every document in the project is a caller's to
 * gather, because the page that offers the delete only knows its own board and
 * the descriptions, decisions and plans all hold markdown; the scan itself is
 * one rule, {@link imagesUsedIn}, applied to each.
 */
export function documentsUsing(file: string, documents: readonly NamedDocument[]): string[] {
  return documents
    .filter((document) => imagesUsedIn(document.text).includes(file))
    .map((document) => document.label)
}

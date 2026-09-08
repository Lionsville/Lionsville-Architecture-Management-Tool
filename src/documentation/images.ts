/**
 * Turning what a document says about a picture into the picture (ADR-0009).
 *
 * A document refers to an image the way every markdown file does — a relative
 * path to a file in the project's `images/` folder:
 *
 * ```markdown
 * ![Cutover routing, week 3](../images/cutover-routing.png)
 * ```
 *
 * How many `../` there are depends on where the document lives: an element's
 * description is `docs/<id>.md` and a decision is `decisions/NNNN-<slug>.md`,
 * both one deep, while an application's decision is `decisions/<app>/…` and is
 * two. {@link imageReference} writes the right number and {@link imageSrcFile}
 * does not care how many there were.
 *
 * **It does not resolve the path, it reads the file name off the end.** That
 * looks lax and is not: the name is then looked up in the project's own
 * library, so the library — not the path arithmetic — is what says which files
 * exist. A document cannot name a file the project does not hold, whatever it
 * writes in front of the name, and there is nothing above a project root for a
 * `../..` to reach. Resolving properly would need every caller to know its own
 * depth, to arrive at the same answer.
 */

/** The folder, relative to the project, that a document's pictures live in. */
export const IMAGES_FOLDER = 'images'

/** `images/<name>` at the end of a path, with anything at all in front of it. */
const IN_IMAGES = /(?:^|\/)images\/([^/]+)$/

/**
 * The file an image source names, if it names one in this project at all.
 *
 * Everything else — an `http(s)` address, a `data:` URL, a path somewhere other
 * than `images/` — comes back undefined, and the renderer then declines to draw
 * it. That is the whole of the "this app does not fetch" rule as far as
 * documents are concerned, and it is one function rather than a policy.
 */
export function imageSrcFile(src: string | undefined): string | undefined {
  if (!src) return undefined
  // A scheme means it is somewhere else, and somewhere else is never drawn —
  // including `data:`, which would otherwise be a way to put a megabyte of
  // base64 into a description and defeat the whole point of a folder.
  if (/^[a-z][a-z0-9+.-]*:/i.test(src)) return undefined
  // `//host/images/x.png` has no scheme of its own and is still somewhere else.
  // It would otherwise match the folder pattern below and quietly draw a local
  // file in place of the one the document named.
  if (src.startsWith('//')) return undefined
  let path: string
  try {
    path = decodeURIComponent(src)
  } catch {
    // A source that is not valid percent-encoding is not one we wrote.
    path = src
  }
  return IN_IMAGES.exec(path.split(/[?#]/)[0])?.[1]
}

/**
 * What to write into a document to show this image.
 *
 * `depth` is how many folders down from the project root the document sits:
 * 1 for `docs/<id>.md` and for a project's own decision, 2 for an
 * application's. The caller knows where it is writing; this knows what the
 * reference looks like.
 */
export function imageReference(file: string, alt: string, depth = 1): string {
  const up = '../'.repeat(Math.max(1, depth))
  // A space in a file name would end the URL at the space and turn the rest
  // into a title; the file names this app mints have none, but a file a person
  // dropped into the folder may.
  const src = `${up}${IMAGES_FOLDER}/${file.replace(/ /g, '%20')}`
  return `![${alt.replace(/[[\]]/g, '')}](${src})`
}

/** Every image file a document refers to, in the order it refers to them. */
export function imagesUsedIn(markdown: string): string[] {
  const found: string[] = []
  for (const match of markdown.matchAll(/!\[[^\]]*\]\(([^)\s]+)/g)) {
    const file = imageSrcFile(match[1])
    if (file && !found.includes(file)) found.push(file)
  }
  return found
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

/**
 * A picture a document can hold (ADR-0009).
 *
 * The sibling of {@link ./logo}, and deliberately not the same thing. A logo is
 * a *mark on a card*: it is chosen from a picker, it is addressed by a key the
 * model stores, and the tool decides where it appears. An image here is
 * addressed by a **file name written into somebody's markdown**, which makes
 * the file name the identity and the folder the whole of the index. There is no
 * key, no label and no entry in `project.json`: `images/cutover.png` exists, a
 * document says `![](../images/cutover.png)`, and that is the entire mechanism.
 *
 * That is what makes the reference portable, which is the point. The same
 * markdown file renders in GitHub, in an editor and in a preview pane, because
 * a relative path to a file next door is what every markdown tool already
 * resolves. A scheme of our own — `image:cutover` — would have been less code
 * here and would have made every document unreadable anywhere else.
 *
 * A data URL in memory, for the same two reasons the marks use one: a blob URL
 * does not outlive the tab, and the export has to be able to draw without a
 * network.
 */
import type { StringKey, StringParams } from '../i18n'
import type { DocumentImage } from '.'
import { ShellError } from '../platform/errors'
import { claimKey, slug } from './keys'

/**
 * The limit for one image, well above a logo's 200 kB.
 *
 * A logo is a mark that has to stay crisp at 24 pixels and is measured in
 * kilobytes; this is a screenshot of a cutover plan or a whiteboard, and one
 * that had to be under 200 kB would be one nobody could read. Two megabytes is
 * a generous screenshot and a mean photograph, which is the right way round for
 * a document about an architecture.
 *
 * A folder has no quota to speak of. Browser storage does, and the fallback
 * store's own reporting is what says no there — a second, smaller limit here
 * would be this file guessing at a budget it cannot see.
 */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024

/**
 * What a document may hold. JPEG earns its place here where it was refused for
 * a logo: a photograph of a whiteboard is exactly the thing people put in a
 * plan, and none of these ever sits on a coloured card needing transparency.
 */
const ALLOWED_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/svg+xml': 'svg',
  'image/webp': 'webp',
}

/** The media type for a file name, for reading a folder back. */
export function imageMediaType(file: string): string | undefined {
  const extension = file.split('.').pop()?.toLowerCase() ?? ''
  const found = Object.entries(ALLOWED_TYPES).find(([, ext]) => ext === extension)
  // `.jpeg` is the same picture as `.jpg`; a person's folder may hold either.
  if (!found && extension === 'jpeg') return 'image/jpeg'
  return found?.[0]
}

/** Whether this file name is one the format will write and read back. */
export function isImageFile(file: string): boolean {
  return imageMediaType(file) !== undefined
}

/** A refusal, as a key rather than a sentence — see {@link ./logo}. */
export class ImageError extends ShellError {
  constructor(key: StringKey, params?: StringParams) {
    super(key, params)
    this.name = 'ImageError'
  }
}

/** The file names already in use, which is what a new one must not collide with. */
export function takenImageFiles(library: readonly DocumentImage[]): Set<string> {
  return new Set(library.map((image) => image.file))
}

/** What this layer reads off a chosen file. */
export type ImageFile = { name: string; type: string; size: number }

/**
 * How much of the name it arrived with survives. A slide exported from a deck
 * arrives called after its title, and a title is a sentence; forty characters
 * keeps the name readable in a folder listing and in the markdown.
 */
const STEM_LIMIT = 40

/**
 * The id a new file name carries: the moment it was taken in, in base 36, the
 * way a connection id is minted. Sortable, short, and different on every
 * machine that ever adds a picture — which is the property that matters, see
 * {@link imageFileName}.
 */
export function imageId(now = Date.now()): string {
  return now.toString(36)
}

/**
 * The file name an upload gets: `<name>-<id>.<ext>` — the name it arrived
 * with, slugged and cut to {@link STEM_LIMIT}; an {@link imageId}; and the
 * extension its **type** dictates rather than the one it claimed.
 *
 * The id is what keeps two pictures apart, and it is there for the case the
 * library cannot see. Within one session `taken` already refuses a duplicate,
 * but a folder is shared: two people who each add `slide1.png` on their own
 * machine and then sync would otherwise arrive with one file name meaning two
 * pictures, and the sync would keep one of them. The moment in the name makes
 * that collision a matter of two uploads in the same millisecond. It also
 * makes a reference greppable — `slide1-mfa1x2k4` is one picture, in the
 * markdown and in the folder, where `slide1` would be whichever came last.
 *
 * The extension comes from the media type on purpose. A file called
 * `diagram.png` that is really a JPEG would be written as a `.png` nothing can
 * read, and the one thing a reader has to go on when it scans the folder later
 * is the extension.
 */
export function imageFileName(name: string, type: string, taken: Set<string>, id = imageId()): string {
  const extension = ALLOWED_TYPES[type]
  const given = name.replace(/\.[^.]+$/, '').trim()
  // `slug` has its own fallback word, and it is the model's, not a picture's.
  const stem = given ? slug(given).slice(0, STEM_LIMIT).replace(/-+$/, '') : 'image'
  // Claimed against the stems in use rather than the whole file names, so
  // `plan.png` and `plan.jpg` do not both become `plan` and collide.
  const stems = new Set([...taken].map((file) => file.replace(/\.[^.]+$/, '')))
  return `${claimKey(`${stem || 'image'}-${id}`, stems)}.${extension}`
}

/**
 * Read one chosen file into a library entry, refusing the two things a person
 * can do something about: a format this cannot write, and a file too large.
 *
 * The reading comes from outside, as it does for a mark: this function knows
 * the rules and not `FileReader`, so the rules are testable in node and the
 * desktop can hand in a different reader.
 */
export function readImageFile(
  file: ImageFile,
  taken: Set<string>,
  readDataUrl: () => Promise<string>,
): Promise<DocumentImage> {
  if (!ALLOWED_TYPES[file.type]) {
    return Promise.reject(new ImageError('shell.imageBadType'))
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return Promise.reject(new ImageError('shell.imageTooBig', {
      size: Math.round(file.size / 1024),
      max: Math.round(MAX_IMAGE_BYTES / 1024),
    }))
  }
  return readDataUrl().then(
    (url) => {
      if (!url.startsWith('data:')) throw new ImageError('shell.imageUnreadable')
      return { file: imageFileName(file.name, file.type, taken), url }
    },
    () => { throw new ImageError('shell.imageUnreadable') },
  )
}

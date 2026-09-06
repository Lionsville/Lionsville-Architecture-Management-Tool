/**
 * The shell's own logo library.
 *
 * The package ships well over a hundred built-in marks, but not that one house
 * logo of a department, or of a vendor `simple-icons` dropped for trademark
 * reasons. That is what this is for: a file from your own disk becomes a data
 * URL and goes to the `logoLibrary` prop as `{ key, label, url }`. The package
 * never fetches anything itself and only ever puts an uploaded mark in an `img`
 * — an uploaded SVG that lands in the DOM as markup can carry a script.
 *
 * A data URL and not a blob URL: a blob URL does not outlive the tab, and this
 * working file has to still work tomorrow. The same choice is what makes PNG
 * export possible without a network (see `onExportImagesMissing` in the package).
 *
 * The key gets the `lib:` prefix the package knows: that is how the resolver
 * sees it should look in the library first, and it makes a collision with a
 * built-in key impossible.
 */
import type { StringKey, StringParams } from '../i18n'
import type { UploadedLogo } from '.'
import { ShellError } from '../platform/errors'
import { claimKey } from './keys'

/** The prefix the package reads as "this one is an upload". */
export const UPLOADED_KEY_PREFIX = 'lib:'

/**
 * The limit for one logo. Ample for an SVG or a decent PNG, and small enough
 * that a handful of them together still fit in localStorage (which is ~5 MB, and
 * the model lives there too).
 */
export const MAX_LOGO_BYTES = 200 * 1024

/** SVG and PNG. No JPEG: a logo on a coloured card wants transparency. */
const ALLOWED_TYPES = ['image/svg+xml', 'image/png']

/**
 * A refusal, as a KEY and not as a sentence.
 *
 * This file is a reader without a language of its own: it knows nothing about
 * the button somebody just pressed and nothing about the language the shell is
 * in at that moment. It used to return Dutch prose that `main.tsx` passed along
 * verbatim — the one place an English shell still spoke Dutch.
 *
 * A {@link ShellError} now, and a subclass only so `instanceof LogoError` still
 * says which reader refused. Callers that only want a sentence no longer need
 * to know either name: `messageFor` handles every `ShellError` the same way.
 */
export class LogoError extends ShellError {
  constructor(key: StringKey, params?: StringParams) {
    super(key, params)
    this.name = 'LogoError'
  }
}

/** Name without the extension; that is what you want to read in the picker. */
export function logoLabel(fileName: string): string {
  const trimmed = fileName.replace(/\.[^.]+$/, '').trim()
  return trimmed || 'Logo'
}

/** The keys already in use, without the prefix — what `claimKey` needs. */
export function takenLogoKeys(library: readonly UploadedLogo[]): Set<string> {
  return new Set(library.map((entry) => entry.key.replace(/^lib:/, '')))
}

/** What this layer reads off a chosen file — it needs nothing more. */
export type LogoFile = { name: string; type: string; size: number }

/**
 * Read one file into a library entry. Refuses with a {@link LogoError}: the
 * format and the size limit are precisely the two things somebody can fix
 * themselves, so those are the two a message exists for — in the shell's
 * language, not in this file's.
 *
 * **The reading comes from outside.** This function does not know `FileReader`;
 * it is handed a `readDataUrl`, and that is what the {@link DocumentGateway}
 * supplies. Before, `new FileReader()` sat here literally, and the suite had to
 * replace node's global `FileReader` to be able to say anything about it —
 * always the sign that a decision and a mechanism are living in one function.
 * The decisions (which format, which limit, which key) now stand apart from
 * base64, and on the desktop a different reader drops in without a rebuild.
 */
export function readLogoFile(
  file: LogoFile,
  taken: Set<string>,
  readDataUrl: () => Promise<string>,
): Promise<UploadedLogo> {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return Promise.reject(new LogoError('shell.logoBadType'))
  }
  if (file.size > MAX_LOGO_BYTES) {
    return Promise.reject(new LogoError('shell.logoTooBig', {
      size: Math.round(file.size / 1024),
      max: Math.round(MAX_LOGO_BYTES / 1024),
    }))
  }
  const label = logoLabel(file.name)
  return readDataUrl().then(
    (url) => {
      // A reader that returns something other than a data URL has read nothing
      // we can show; that is the same nuisance as a read error.
      if (!url.startsWith('data:')) throw new LogoError('shell.logoUnreadable')
      return { key: `${UPLOADED_KEY_PREFIX}${claimKey(label, taken)}`, label, url }
    },
    () => { throw new LogoError('shell.logoUnreadable') },
  )
}

/**
 * The logo library: reading files in, refusing them, and handing out keys.
 *
 * The two refusals are the heart of it. They are the only two things somebody
 * can fix themselves — pick a different file format, or make a smaller file —
 * and therefore the only two a message exists for. What is checked here is the
 * KEY and not the sentence: `readLogoFile` does not know the shell's language,
 * so it returns `shell.logo*` plus the numbers that fit in it, and the shell
 * turns that into Dutch or English at the moment of showing. The sentences
 * themselves live in the package's string tables and are checked there.
 *
 * `readLogoFile` reads nothing itself: it is handed a `readDataUrl`. This suite
 * supplies a handful of lines for it. That saves more than a rebuilt
 * `FileReader` — it is the proof that the decisions (which format, which limit,
 * which key) stand apart from base64 and from the browser.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import type { UploadedLogo } from '@lionsville/solution-design'
import { LogoError, logoLabel, MAX_LOGO_BYTES, readLogoFile, takenLogoKeys } from './logo'
import type { LogoFile } from './logo'

/** A chosen file without a browser: this layer reads nothing more off it. */
function file(name: string, type: string, size = 1024): LogoFile {
  return { name, type, size }
}

/** What the supplied reader returns; set per test. */
let readerResult = 'data:image/svg+xml;base64,PHN2Zy8+'
let readerFails = false

/**
 * The reader the shell would normally take from the gateway.
 *
 * Asynchronous, like the real one: a `readLogoFile` that accidentally resolved
 * synchronously would not work here either.
 */
const reader = (): Promise<string> => new Promise((resolve, reject) => {
  setTimeout(() => (readerFails ? reject(new Error('stuk')) : resolve(readerResult)), 0)
})

/** Short for "read this file with the fake reader". */
const read = (f: LogoFile, taken: Set<string> = new Set()) => readLogoFile(f, taken, reader)

beforeEach(() => {
  readerResult = 'data:image/svg+xml;base64,PHN2Zy8+'
  readerFails = false
})

describe('readLogoFile — wat erin mag', () => {
  it('reads an SVG into a library entry', async () => {
    const entry = await read(file('Eigen Merk.svg', 'image/svg+xml'))

    expect(entry).toEqual({
      key: 'lib:eigen-merk',
      label: 'Eigen Merk',
      url: 'data:image/svg+xml;base64,PHN2Zy8+',
    })
  })

  it('reads a PNG just as well', async () => {
    readerResult = 'data:image/png;base64,AAA'
    const entry = await read(file('logo.png', 'image/png'))

    expect(entry.key).toBe('lib:logo')
    expect(entry.url).toBe('data:image/png;base64,AAA')
  })

  it('refuses another format, with the key for the format', async () => {
    await expect(read(file('foto.jpg', 'image/jpeg'))).rejects.toThrow(
      new LogoError('shell.logoBadType'),
    )
  })

  it('refuses a file with no type — a disk does not always say what something is', async () => {
    await expect(read(file('logo', ''))).rejects.toThrow('shell.logoBadType')
  })

  it('refuses what is too big, and passes the sizes along as parameters', async () => {
    // The sentence ("This logo is too big (200 kB). Maximum 200 kB.") is only
    // made in the shell; what belongs here is what has to be filled into it. One
    // byte over the limit rounds to the same 200 kB — which is exactly the
    // message that was always there, and it is right: the limit is 200 and this
    // does not fit.
    const err = await read(file('groot.png', 'image/png', MAX_LOGO_BYTES + 1))
      .then(() => undefined, (e: unknown) => e as LogoError)
    expect(err?.key).toBe('shell.logoTooBig')
    expect(err?.params).toEqual({ size: 200, max: 200 })
  })

  it('lets a file exactly on the limit through', async () => {
    const entry = await read(file('rand.png', 'image/png', MAX_LOGO_BYTES))
    expect(entry.key).toBe('lib:rand')
  })

  it('refuses when the reader stumbles', async () => {
    readerFails = true
    await expect(read(file('logo.svg', 'image/svg+xml'))).rejects.toThrow(
      'shell.logoUnreadable',
    )
  })

  it('refuses a result that is not a data URL', async () => {
    // Without this guard an empty or strange result would land in the library as
    // a valid logo and become an empty box on the drawing.
    readerResult = ''
    await expect(read(file('logo.svg', 'image/svg+xml'))).rejects.toThrow(
      'shell.logoUnreadable',
    )
  })
})

describe('readLogoFile — sleutels', () => {
  it('makes the key unique against what is already there', async () => {
    const taken = new Set(['eigen-merk'])
    const entry = await read(file('Eigen merk.svg', 'image/svg+xml'), taken)

    expect(entry.key).toBe('lib:eigen-merk-2')
    // and claims it, so a second upload in the same session shifts up again
    expect(taken.has('eigen-merk-2')).toBe(true)
  })

  it('slugs away diacritics and odd characters', async () => {
    const entry = await read(file('Reisinformatie (nieuw!).svg', 'image/svg+xml'), new Set())
    expect(entry.key).toBe('lib:reisinformatie-nieuw')
  })

  it('always carries the lib: prefix the package reads as an upload', async () => {
    const entry = await read(file('x.png', 'image/png'))
    expect(entry.key.startsWith('lib:')).toBe(true)
  })
})

describe('logoLabel', () => {
  it('strips the extension', () => {
    expect(logoLabel('Eigen merk.svg')).toBe('Eigen merk')
    expect(logoLabel('logo.tar.gz')).toBe('logo.tar')
  })

  it('valt terug op "Logo" als er niets overblijft', () => {
    expect(logoLabel('.svg')).toBe('Logo')
    expect(logoLabel('   ')).toBe('Logo')
  })
})

describe('takenLogoKeys', () => {
  it('yields the keys without the prefix — what claimKey needs', () => {
    const library: UploadedLogo[] = [
      { key: 'lib:one', label: 'One', url: 'data:,' },
      { key: 'lib:two', label: 'Two', url: 'data:,' },
    ]
    expect(takenLogoKeys(library)).toEqual(new Set(['one', 'two']))
  })
})

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The app's own type, carried into a picture of the page.
 *
 * A picture is drawn by `html-to-image` as an SVG image, and an image may not
 * reach for a font: it has to hold the faces it draws in. Left to itself the
 * library reads the page's style sheets and resolves each font's address against
 * its sheet by setting a document's base address, which the desktop's content
 * policy refuses (`base-uri 'none'`); the addresses then resolved against the
 * page instead, missed the files, and the board's picture fell back to a system
 * face. So the faces are handed over ready: the bundled `fonts.css`, each file in
 * it read once and written into the rules as data.
 *
 * Read once per session, on the first picture, and kept. Where a file cannot be
 * read the picture is still made, in whatever faces it then gets.
 */
import fontRules from './kit/fonts/fonts.css?raw'

const FILES = import.meta.glob<string>('./kit/fonts/*.woff2', { query: '?url', import: 'default', eager: true })

let held: Promise<string> | undefined

/** The `@font-face` rules of the app's faces, with every file in them as data. */
export function pictureFontCss(): Promise<string> {
  held ??= embed().catch(() => '')
  return held
}

async function embed(): Promise<string> {
  const data = new Map<string, string>()
  await Promise.all(Object.entries(FILES).map(async ([path, url]) => {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`${url}: ${response.status}`)
    // Said as a font whatever the server called it: an image's font is read by its type.
    data.set(path.slice(path.lastIndexOf('/') + 1), await dataUrl(new Blob([await response.arrayBuffer()], { type: 'font/woff2' })))
  }))
  return fontRules
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/url\(\.\/([^)]+)\)/g, (whole, file: string) => (data.has(file) ? `url(${data.get(file)})` : whole))
}

function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('could not read a font'))
    reader.readAsDataURL(blob)
  })
}

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a PDF says, read without a PDF library: each page's size and the text a
 * reader would select on it, as far as the fonts' `ToUnicode` maps say.
 *
 * Enough of the format for what Chromium's print writes (objects loose and in
 * object streams, Flate streams, hex and literal strings, one- and two-byte
 * codes), so a test can ask whether a PDF the app made has the page on it
 * rather than a blank sheet. Not a general reader: no encryption, no
 * cross-reference repair, no text without a `ToUnicode` map.
 */
import { inflateSync } from 'node:zlib'

export type PdfPage = { widthMm: number; heightMm: number; text: string; fonts: readonly string[] }

type Obj = { body: string; stream?: Buffer }

const MM_PER_PT = 25.4 / 72

function objectsOf(bytes: Buffer): Map<number, Obj> {
  const text = bytes.toString('latin1')
  const objects = new Map<number, Obj>()
  const head = /(\d+)\s+0\s+obj\b/g
  for (let found = head.exec(text); found; found = head.exec(text)) {
    const start = found.index + found[0].length
    const streamAt = text.indexOf('stream', start)
    const endAt = text.indexOf('endobj', start)
    if (streamAt !== -1 && streamAt < endAt) {
      const body = text.slice(start, streamAt)
      let from = streamAt + 'stream'.length
      if (text[from] === '\r') from += 1
      if (text[from] === '\n') from += 1
      const length = /\/Length\s+(\d+)(?!\s+\d+\s+R)/.exec(body)
      const to = length ? from + Number(length[1]) : text.indexOf('endstream', from)
      const raw = bytes.subarray(from, to)
      objects.set(Number(found[1]), { body, stream: /\/FlateDecode/.test(body) ? inflateSync(raw) : raw })
      const after = text.indexOf('endobj', to)
      head.lastIndex = after === -1 ? to : after
    } else {
      objects.set(Number(found[1]), { body: text.slice(start, endAt === -1 ? undefined : endAt) })
    }
  }
  // Objects kept inside object streams: N pairs of number and offset, then the objects from First.
  for (const held of [...objects.values()]) {
    if (!held.stream || !/\/Type\s*\/ObjStm/.test(held.body)) continue
    const count = Number(/\/N\s+(\d+)/.exec(held.body)?.[1] ?? 0)
    const first = Number(/\/First\s+(\d+)/.exec(held.body)?.[1] ?? 0)
    const inside = held.stream.toString('latin1')
    const pairs = inside.slice(0, first).trim().split(/\s+/).map(Number)
    for (let i = 0; i < count; i += 1) {
      const from = first + (pairs[2 * i + 1] ?? 0)
      const to = i + 1 < count ? first + (pairs[2 * i + 3] ?? 0) : inside.length
      if (!objects.has(pairs[2 * i] ?? -1)) objects.set(pairs[2 * i] ?? -1, { body: inside.slice(from, to) })
    }
  }
  return objects
}

/** A dictionary's entry, followed through one indirect reference. */
function entry(objects: Map<number, Obj>, body: string, key: string): string | undefined {
  const at = new RegExp(`/${key}\\s*(\\d+)\\s+0\\s+R`).exec(body)
  if (at) return objects.get(Number(at[1]))?.body
  const open = new RegExp(`/${key}\\s*<<`).exec(body)
  if (!open) return undefined
  let depth = 0
  for (let i = open.index + open[0].length - 2; i < body.length; i += 1) {
    if (body.startsWith('<<', i)) { depth += 1; i += 1 } else if (body.startsWith('>>', i)) { depth -= 1; i += 1; if (depth === 0) return body.slice(open.index + open[0].length, i - 1) }
  }
  return undefined
}

type Font = { width: number; map: Map<number, string>; name: string }

function fontOf(objects: Map<number, Obj>, body: string | undefined): Font {
  const name = /\/BaseFont\s*\/([^\s/<>[\]]+)/.exec(body ?? '')?.[1] ?? /\/Subtype\s*\/(\w+)/.exec(body ?? '')?.[1] ?? ''
  const map = new Map<number, string>()
  const ref = /\/ToUnicode\s+(\d+)\s+0\s+R/.exec(body ?? '')
  const cmap = ref ? objects.get(Number(ref[1]))?.stream?.toString('latin1') ?? '' : ''
  const width = /begincodespacerange\s*<([0-9a-fA-F]+)>/.exec(cmap)?.[1]?.length === 2 ? 1 : 2
  const unicode = (hex: string) => String.fromCodePoint(...(hex.match(/.{4}/g) ?? []).map((one) => parseInt(one, 16)))
  for (const block of cmap.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const pair of (block[1] ?? '').matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) map.set(parseInt(pair[1]!, 16), unicode(pair[2]!))
  }
  for (const block of cmap.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const range of (block[1] ?? '').matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      const low = parseInt(range[1]!, 16)
      const base = parseInt(range[3]!, 16)
      for (let code = low; code <= parseInt(range[2]!, 16); code += 1) map.set(code, String.fromCodePoint(base + code - low))
    }
  }
  return { width, map, name }
}

function literalBytes(literal: string): number[] {
  const out: number[] = []
  for (let i = 0; i < literal.length; i += 1) {
    const char = literal[i]!
    if (char !== '\\') { out.push(char.charCodeAt(0)); continue }
    const next = literal[i + 1] ?? ''
    const octal = /^[0-7]{1,3}/.exec(literal.slice(i + 1))?.[0]
    if (octal) { out.push(parseInt(octal, 8)); i += octal.length; continue }
    out.push(({ n: 10, r: 13, t: 9, b: 8, f: 12 } as Record<string, number>)[next] ?? next.charCodeAt(0))
    i += 1
  }
  return out
}

function said(font: Font | undefined, codes: number[]): string {
  if (!font) return ''
  let out = ''
  for (let i = 0; i < codes.length; i += font.width) {
    const code = font.width === 2 ? (codes[i]! << 8) | (codes[i + 1] ?? 0) : codes[i]!
    out += font.map.get(code) ?? ''
  }
  return out
}

/**
 * The text a content stream shows, in the order it is drawn: the runs of one text
 * object run on, as Chromium writes a word a glyph at a time, and a space between objects.
 */
function textOf(content: string, fonts: Map<string, Font>): string {
  const blocks: string[] = []
  let font: Font | undefined
  const string = /<([0-9a-fA-F\s]*)>|\(((?:\\.|[^\\)])*)\)/g
  const codesOf = (piece: string) => [...piece.matchAll(string)].flatMap((one) => (one[1] !== undefined
    ? (one[1].replace(/\s+/g, '').match(/.{2}/g) ?? []).map((pair) => parseInt(pair, 16))
    : literalBytes(one[2] ?? '')))
  for (const block of content.split(/\bET\b/)) {
    let run = ''
    for (const op of block.matchAll(/\/([^\s/<>[\]()]+)\s+[-\d.]+\s+Tf|(<[0-9a-fA-F\s]*>|\((?:\\.|[^\\)])*\))\s*(?:Tj|'|")|\[((?:<[0-9a-fA-F\s]*>|\((?:\\.|[^\\)])*\)|[^\]])*)\]\s*TJ/g)) {
      if (op[1] !== undefined) { font = fonts.get(op[1]); continue }
      run += said(font, codesOf(op[2] ?? op[3] ?? ''))
    }
    if (run) blocks.push(run)
  }
  return blocks.join(' ')
}

export function readPdf(bytes: Uint8Array): PdfPage[] {
  const objects = objectsOf(Buffer.from(bytes))
  const pages: PdfPage[] = []
  for (const page of objects.values()) {
    if (!/\/Type\s*\/Page(?![s\w])/.test(page.body)) continue
    let box: number[] | undefined
    for (let at: string | undefined = page.body; at && !box; at = entry(objects, at, 'Parent')) {
      box = /\/MediaBox\s*\[([^\]]*)\]/.exec(at)?.[1]?.trim().split(/\s+/).map(Number)
    }
    const resources = entry(objects, page.body, 'Resources') ?? ''
    const fontTable = entry(objects, resources, 'Font') ?? ''
    const fonts = new Map<string, Font>()
    for (const one of fontTable.matchAll(/\/([^\s/<>[\]]+)\s+(\d+)\s+0\s+R/g)) fonts.set(one[1]!, fontOf(objects, objects.get(Number(one[2]))?.body))
    const refs = /\/Contents\s*(\[[^\]]*\]|\d+\s+0\s+R)/.exec(page.body)?.[1] ?? ''
    const content = [...refs.matchAll(/(\d+)\s+0\s+R/g)].map((one) => objects.get(Number(one[1]))?.stream?.toString('latin1') ?? '').join('\n')
    const [x0 = 0, y0 = 0, x1 = 0, y1 = 0] = box ?? []
    pages.push({
      widthMm: (x1 - x0) * MM_PER_PT,
      heightMm: (y1 - y0) * MM_PER_PT,
      text: textOf(content, fonts).replace(/\s+/g, ' ').trim(),
      fonts: [...new Set([...fonts.values()].map((one) => one.name))],
    })
  }
  return pages
}

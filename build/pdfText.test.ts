// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { deflateSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { readPdf } from './pdfText'

/** A PDF in the shape Chromium's print writes: the font in an object stream, Flate content, a glyph at a time. */
function chromiumLike(): Uint8Array {
  const cmap = [
    '/CIDInit /ProcSet findresource begin 12 dict begin begincmap',
    '1 begincodespacerange <00> <FF> endcodespacerange',
    '2 beginbfchar <01> <0020> <02> <0041> endbfchar',
    '1 beginbfrange <10> <12> <0061> endbfrange',
    'endcmap end end',
  ].join('\n')
  const content = 'BT /F1 12 Tf 1 0 0 -1 10 10 Tm <02> Tj 7 0 Td <10> Tj 7 0 Td <01> Tj 7 0 Td <11> Tj ET\nBT /F1 12 Tf [<12> -20 <10>] TJ ET\nBT /F2 9 Tf (lit\\(e\\)ral) Tj ET'
  const font1 = '<< /Type /Font /Subtype /Type3 /ToUnicode 6 0 R >>'
  const font2 = '<< /Type /Font /Subtype /Type1 /BaseFont /Plain /ToUnicode 7 0 R >>'
  const header = `4 0 5 ${font1.length + 1} `
  const objstm = deflateSync(Buffer.from(header + font1 + '\n' + font2, 'latin1'))
  const flate = (text: string) => deflateSync(Buffer.from(text, 'latin1'))
  const plain = Array.from({ length: 256 }, (_, code) => `<${code.toString(16).padStart(2, '0')}> <${code.toString(16).padStart(4, '0')}>`)
  const plainMap = `1 begincodespacerange <00> <FF> endcodespacerange\n${plain.length} beginbfchar ${plain.join(' ')} endbfchar`
  const parts: Buffer[] = [Buffer.from('%PDF-1.7\n', 'latin1')]
  const stream = (number: number, dict: string, body: Buffer) => {
    parts.push(Buffer.from(`${number} 0 obj\n<< ${dict} /Length ${body.length} >>\nstream\n`, 'latin1'), body, Buffer.from('\nendstream\nendobj\n', 'latin1'))
  }
  parts.push(Buffer.from('1 0 obj\n<< /Type /Pages /Kids [2 0 R] /Count 1 /MediaBox [0 0 2383.937 1683.78] >>\nendobj\n', 'latin1'))
  parts.push(Buffer.from('2 0 obj\n<< /Type /Page /Parent 1 0 R /Resources << /Font << /F1 4 0 R /F2 5 0 R >> >> /Contents 3 0 R >>\nendobj\n', 'latin1'))
  stream(3, '/Filter /FlateDecode', flate(content))
  stream(8, `/Type /ObjStm /N 2 /First ${header.length} /Filter /FlateDecode`, objstm)
  stream(6, '/Filter /FlateDecode', flate(cmap))
  stream(7, '', Buffer.from(plainMap, 'latin1'))
  parts.push(Buffer.from('%%EOF\n', 'latin1'))
  return new Uint8Array(Buffer.concat(parts))
}

describe('reading what a PDF says', () => {
  it('finds the page, its paper from the page tree, and its text through each font’s map', () => {
    const [page, ...more] = readPdf(chromiumLike())
    expect(more).toEqual([])
    expect(page!.widthMm).toBeCloseTo(841, 0)
    expect(page!.heightMm).toBeCloseTo(594, 0)
    expect(page!.text).toBe('Aa b ca lit(e)ral')
    expect(page!.fonts).toEqual(['Type3', 'Plain'])
  })

  it('says a blank page as no text', () => {
    const blank = Buffer.from('%PDF-1.7\n1 0 obj\n<< /Type /Page /MediaBox [0 0 595 842] /Contents 2 0 R >>\nendobj\n2 0 obj\n<< /Length 0 >>\nstream\n\nendstream\nendobj\n', 'latin1')
    expect(readPdf(new Uint8Array(blank))).toEqual([{ widthMm: expect.closeTo(210, 0) as number, heightMm: expect.closeTo(297, 0) as number, text: '', fonts: [] }])
  })
})

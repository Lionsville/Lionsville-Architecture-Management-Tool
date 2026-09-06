/**
 * The encodings a project folder is written in. Small functions, and the whole
 * value of ADR-0003 rests on them: if two saves of an unchanged project can
 * differ by a byte, every autosave is a diff and the folder was not worth
 * moving to.
 */
import { describe, expect, it } from 'vitest'
import {
  base64FromBytes, bytesFromBase64, bytesFromText, dataUrl, frontMatterNumber, frontMatterRows,
  frontMatterString, frontMatterText, markdownBody, markdownFile, parseJson, readDataUrl,
  readFrontMatter, stableJson, textFromBytes,
} from './fileText'

describe('stableJson', () => {
  it('sorts keys at every level, so a rebuilt object is the same file', () => {
    const one = stableJson({ b: 1, a: { d: 2, c: 3 } })
    const other = stableJson({ a: { c: 3, d: 2 }, b: 1 })
    expect(one).toBe(other)
    expect(one).toBe('{\n  "a": {\n    "c": 3,\n    "d": 2\n  },\n  "b": 1\n}\n')
  })

  it('sorts inside arrays too — an array of objects is where key order drifts', () => {
    expect(stableJson([{ b: 1, a: 2 }])).toBe('[\n  {\n    "a": 2,\n    "b": 1\n  }\n]\n')
  })

  it('leaves array order alone: that is the caller\'s decision, not the writer\'s', () => {
    expect(stableJson(['b', 'a'])).toBe('[\n  "b",\n  "a"\n]\n')
  })

  it('ends with exactly one newline, as a text file should', () => {
    expect(stableJson({})).toBe('{}\n')
  })

  it('writes an absent field and an undefined one as the same file', () => {
    expect(stableJson({ a: 1, b: undefined })).toBe(stableJson({ a: 1 }))
  })
})

describe('parseJson', () => {
  it('reads back what stableJson wrote', () => {
    expect(parseJson(stableJson({ a: [1, 2] }))).toEqual({ a: [1, 2] })
  })

  it('answers undefined for something that is not JSON, rather than throwing', () => {
    expect(parseJson('half a fi')).toBeUndefined()
  })
})

describe('markdownFile', () => {
  it('adds one newline and takes one away', () => {
    expect(markdownBody(markdownFile('Two lines\nof prose'))).toBe('Two lines\nof prose')
  })

  it('keeps a body that already ends in a blank line', () => {
    // The lossy alternatives ("add unless present", "trim the end") both lose
    // this, and a document tool that quietly edits prose is a bad one.
    expect(markdownBody(markdownFile('Ends blank\n'))).toBe('Ends blank\n')
  })

  it('keeps an empty description empty rather than absent', () => {
    expect(markdownBody(markdownFile(''))).toBe('')
  })
})

describe('frontMatterText', () => {
  it('writes fields in the order they were given, not alphabetically', () => {
    expect(frontMatterText({ title: 'Working directory', number: 3, accepted: true }))
      .toBe('---\ntitle: Working directory\nnumber: 3\naccepted: true\n---\n')
  })

  it('leaves an undefined field out entirely', () => {
    expect(frontMatterText({ title: 'A', role: undefined })).toBe('---\ntitle: A\n---\n')
  })

  it('quotes a string that would otherwise read back as something else', () => {
    const text = frontMatterText({ version: '3', flag: 'true', title: 'Storage: a folder' })
    expect(text).toContain('version: "3"')
    expect(text).toContain('flag: "true"')
    expect(text).toContain('title: "Storage: a folder"')
  })

  it('writes a list of rows indented under its key', () => {
    expect(frontMatterText({ signers: [{ name: 'Wouter Simons', verdict: 'approved' }] }))
      .toBe('---\nsigners:\n  - name: Wouter Simons\n    verdict: approved\n---\n')
  })

  it('leaves an empty list out, so no signers reads as no signers', () => {
    expect(frontMatterText({ signers: [] })).toBe('---\n---\n')
  })
})

describe('readFrontMatter', () => {
  it('reads back every kind of field it writes', () => {
    const fields = {
      title: 'Storage: a folder',
      number: 7,
      accepted: true,
      date: '2026-09-06',
      signers: [{ name: 'Wouter Simons', verdict: 'approved' }, { name: 'A. N. Other' }],
    }
    const back = readFrontMatter(`${frontMatterText(fields)}\nThe body.\n`)
    expect(back.fields).toEqual(fields)
    expect(back.body).toBe('\nThe body.\n')
  })

  it('treats a file with no front matter as all body', () => {
    // A markdown file somebody wrote by hand has no fields; it is not broken.
    expect(readFrontMatter('# Just prose\n')).toEqual({ fields: {}, body: '# Just prose\n' })
  })

  it('treats an unterminated block as body as well, rather than eating the file', () => {
    expect(readFrontMatter('---\ntitle: A\n').body).toBe('---\ntitle: A\n')
  })

  it('skips a line it cannot read instead of failing the whole record', () => {
    const { fields } = readFrontMatter('---\ntitle: A\n%% junk\nnumber: 2\n---\nbody')
    expect(fields).toEqual({ title: 'A', number: 2 })
  })

  it('reads a field as the type it was written as', () => {
    const { fields } = readFrontMatter('---\na: 3\nb: "3"\nc: true\nd: "true"\n---\n')
    expect(fields).toEqual({ a: 3, b: '3', c: true, d: 'true' })
  })
})

describe('the typed readers', () => {
  const { fields } = readFrontMatter(frontMatterText({
    title: 'A', number: 7, signers: [{ name: 'W' }],
  }))

  it('hand back what is there', () => {
    expect(frontMatterString(fields, 'title')).toBe('A')
    expect(frontMatterNumber(fields, 'number')).toBe(7)
    expect(frontMatterRows(fields, 'signers')).toEqual([{ name: 'W' }])
  })

  it('hand back nothing for what is not, and never the wrong shape', () => {
    expect(frontMatterString(fields, 'missing')).toBeUndefined()
    expect(frontMatterNumber(fields, 'title')).toBeUndefined()
    expect(frontMatterRows(fields, 'title')).toEqual([])
  })

  it('reads a number written as a string, because a hand-edited file will', () => {
    const hand = readFrontMatter('---\nnumber: "7"\n---\n').fields
    expect(frontMatterNumber(hand, 'number')).toBe(7)
  })
})

describe('bytes', () => {
  it('round-trips through base64', () => {
    const bytes = new Uint8Array([0, 1, 255, 128, 64])
    expect(bytesFromBase64(base64FromBytes(bytes))).toEqual(bytes)
  })

  it('round-trips a mark-sized array without overflowing the call stack', () => {
    // 200 KB is the upload limit; the naive spread of that many arguments is
    // what this chunking exists to avoid.
    const big = new Uint8Array(200 * 1024).map((_, i) => i % 256)
    expect(bytesFromBase64(base64FromBytes(big))).toEqual(big)
  })

  it('round-trips text, including what is not ASCII', () => {
    expect(textFromBytes(bytesFromText('Reisinformatie — 100 %'))).toBe('Reisinformatie — 100 %')
  })
})

describe('data URLs', () => {
  it('unpacks a base64 one', () => {
    const held = readDataUrl('data:image/png;base64,AAEC')
    expect(held?.mediaType).toBe('image/png')
    expect(held?.bytes).toEqual(new Uint8Array([0, 1, 2]))
  })

  it('unpacks a percent-encoded one, because that is how a hand-built URL arrives', () => {
    const held = readDataUrl('data:image/svg+xml,%3Csvg%2F%3E')
    expect(held?.mediaType).toBe('image/svg+xml')
    expect(textFromBytes(held!.bytes)).toBe('<svg/>')
  })

  it('round-trips a mark through a file and back', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>'
    const url = dataUrl('image/svg+xml', bytesFromText(svg))
    expect(textFromBytes(readDataUrl(url)!.bytes)).toBe(svg)
  })

  it('answers undefined for a URL that is not one', () => {
    expect(readDataUrl('https://example.test/logo.svg')).toBeUndefined()
  })
})

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

  it('sorts inside arrays too, and leaves the array order itself alone', () => {
    // An array of objects is where key order drifts; the order of the array is
    // the caller's decision, not the writer's.
    expect(stableJson([{ b: 1, a: 2 }])).toBe('[\n  {\n    "a": 2,\n    "b": 1\n  }\n]\n')
    expect(stableJson(['b', 'a'])).toBe('[\n  "b",\n  "a"\n]\n')
  })

  it('ends with exactly one newline, and writes an absent and an undefined field alike', () => {
    expect(stableJson({})).toBe('{}\n')
    expect(stableJson({ a: 1, b: undefined })).toBe(stableJson({ a: 1 }))
  })
})

describe('parseJson', () => {
  it('reads back what stableJson wrote, and answers undefined rather than throwing', () => {
    expect(parseJson(stableJson({ a: [1, 2] }))).toEqual({ a: [1, 2] })
    expect(parseJson('half a fi')).toBeUndefined()
  })
})

describe('markdownFile', () => {
  it('adds one newline and takes one away, whatever the body ends in', () => {
    expect(markdownBody(markdownFile('Two lines\nof prose'))).toBe('Two lines\nof prose')
    // The lossy alternatives ("add unless present", "trim the end") both lose a
    // body that already ends blank, and a document tool that quietly edits
    // prose is a bad one. An empty description stays empty rather than absent.
    expect(markdownBody(markdownFile('Ends blank\n'))).toBe('Ends blank\n')
    expect(markdownBody(markdownFile(''))).toBe('')
  })
})

describe('frontMatterText', () => {
  it('writes fields in the order they were given, and leaves an undefined one out', () => {
    expect(frontMatterText({ title: 'Working directory', number: 3, accepted: true }))
      .toBe('---\ntitle: Working directory\nnumber: 3\naccepted: true\n---\n')
    expect(frontMatterText({ title: 'A', role: undefined })).toBe('---\ntitle: A\n---\n')
  })

  it('quotes a string that would otherwise read back as something else', () => {
    const text = frontMatterText({ version: '3', flag: 'true', title: 'Storage: a folder' })
    expect(text).toContain('version: "3"')
    expect(text).toContain('flag: "true"')
    expect(text).toContain('title: "Storage: a folder"')
  })

  it('writes a list of rows indented under its key, and leaves an empty list out', () => {
    expect(frontMatterText({ signers: [{ name: 'Wouter Simons', verdict: 'approved' }] }))
      .toBe('---\nsigners:\n  - name: Wouter Simons\n    verdict: approved\n---\n')
    // So that no signers reads as no signers.
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

  it('treats a file with no front matter, or an unterminated block, as all body', () => {
    // A markdown file somebody wrote by hand has no fields; it is not broken,
    // and an unterminated block must not eat the file either.
    expect(readFrontMatter('# Just prose\n')).toEqual({ fields: {}, body: '# Just prose\n' })
    expect(readFrontMatter('---\ntitle: A\n').body).toBe('---\ntitle: A\n')
  })

  it('skips a line it cannot read, and reads a field as the type it was written as', () => {
    const junk = readFrontMatter('---\ntitle: A\n%% junk\nnumber: 2\n---\nbody')
    expect(junk.fields).toEqual({ title: 'A', number: 2 })
    const typed = readFrontMatter('---\na: 3\nb: "3"\nc: true\nd: "true"\n---\n')
    expect(typed.fields).toEqual({ a: 3, b: '3', c: true, d: 'true' })
  })
})

describe('the typed readers', () => {
  const { fields } = readFrontMatter(frontMatterText({
    title: 'A', number: 7, signers: [{ name: 'W' }],
  }))

  it('hand back what is there, nothing for what is not, and never the wrong shape', () => {
    expect(frontMatterString(fields, 'title')).toBe('A')
    expect(frontMatterNumber(fields, 'number')).toBe(7)
    expect(frontMatterRows(fields, 'signers')).toEqual([{ name: 'W' }])
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
  it('round-trips through base64, and round-trips text including what is not ASCII', () => {
    const bytes = new Uint8Array([0, 1, 255, 128, 64])
    expect(bytesFromBase64(base64FromBytes(bytes))).toEqual(bytes)
    expect(textFromBytes(bytesFromText('Reisinformatie — 100 %'))).toBe('Reisinformatie — 100 %')
  })

  it('round-trips a mark-sized array without overflowing the call stack', () => {
    // 200 KB is the upload limit; the naive spread of that many arguments is
    // what this chunking exists to avoid.
    const big = new Uint8Array(200 * 1024).map((_, i) => i % 256)
    expect(bytesFromBase64(base64FromBytes(big))).toEqual(big)
  })
})

describe('data URLs', () => {
  it('unpacks a base64 one and a percent-encoded one, and answers undefined for neither', () => {
    const base64 = readDataUrl('data:image/png;base64,AAEC')
    expect(base64?.mediaType).toBe('image/png')
    expect(base64?.bytes).toEqual(new Uint8Array([0, 1, 2]))
    // Percent encoding is how a hand-built URL arrives.
    const percent = readDataUrl('data:image/svg+xml,%3Csvg%2F%3E')
    expect(percent?.mediaType).toBe('image/svg+xml')
    expect(textFromBytes(percent!.bytes)).toBe('<svg/>')
    expect(readDataUrl('https://example.test/logo.svg')).toBeUndefined()
  })

  it('round-trips a mark through a file and back', () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"/>'
    const url = dataUrl('image/svg+xml', bytesFromText(svg))
    expect(textFromBytes(readDataUrl(url)!.bytes)).toBe(svg)
  })
})

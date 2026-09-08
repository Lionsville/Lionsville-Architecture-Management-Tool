/**
 * What a document may point at, and what it may not.
 *
 * The interesting half is the refusals: the resolver is the allowlist that
 * keeps this app from fetching anything a description asks it to, so a scheme
 * that slips through here is a network call in a tool that promises none.
 */
import { describe, expect, it } from 'vitest'
import { imageReference, imageSrcFile, imagesUsedIn } from './images'

describe('imageSrcFile', () => {
  it('reads the file off a reference, at any depth', () => {
    expect(imageSrcFile('../images/cutover.png')).toBe('cutover.png')
    expect(imageSrcFile('../../images/cutover.png')).toBe('cutover.png')
    expect(imageSrcFile('images/cutover.png')).toBe('cutover.png')
  })

  it('un-escapes a name that had to be escaped', () => {
    expect(imageSrcFile('../images/week%203.png')).toBe('week 3.png')
  })

  it('ignores a query or a fragment', () => {
    expect(imageSrcFile('../images/cutover.png?v=2')).toBe('cutover.png')
    expect(imageSrcFile('../images/cutover.png#top')).toBe('cutover.png')
  })

  it('refuses anything with a scheme, which is the whole no-fetch rule', () => {
    expect(imageSrcFile('https://example.org/images/x.png')).toBeUndefined()
    expect(imageSrcFile('http://example.org/x.png')).toBeUndefined()
    expect(imageSrcFile('data:image/png;base64,AAAA')).toBeUndefined()
    expect(imageSrcFile('javascript:alert(1)')).toBeUndefined()
    // Protocol-relative: no scheme of its own, and still somewhere else.
    expect(imageSrcFile('//example.org/images/x.png')).toBeUndefined()
  })

  it('refuses a path that is not in the images folder', () => {
    expect(imageSrcFile('../docs/x.png')).toBeUndefined()
    expect(imageSrcFile('../images/deeper/x.png')).toBeUndefined()
    expect(imageSrcFile('')).toBeUndefined()
    expect(imageSrcFile(undefined)).toBeUndefined()
  })
})

describe('imageReference', () => {
  it('writes a reference a markdown reader resolves', () => {
    expect(imageReference('cutover.png', 'Cutover')).toBe('![Cutover](../images/cutover.png)')
  })

  it('goes up as far as the document is deep', () => {
    expect(imageReference('x.png', 'x', 2)).toBe('![x](../../images/x.png)')
    expect(imageReference('x.png', 'x', 0)).toBe('![x](../images/x.png)')
  })

  it('escapes a space, and cannot have its alt text break the link', () => {
    expect(imageReference('week 3.png', 'Week [3]')).toBe('![Week 3](../images/week%203.png)')
  })

  it('writes what it can read back', () => {
    const written = imageReference('week 3.png', 'x')
    expect(imageSrcFile(/\(([^)]+)\)/.exec(written)![1])).toBe('week 3.png')
  })
})

describe('imagesUsedIn', () => {
  it('finds each picture once, in the order it appears', () => {
    const md = [
      '![a](../images/a.png)',
      'text ![b](../images/b.jpg) more',
      '![again](../images/a.png)',
      '![remote](https://example.org/c.png)',
    ].join('\n\n')
    expect(imagesUsedIn(md)).toEqual(['a.png', 'b.jpg'])
  })

  it('has nothing to say about a document with no pictures', () => {
    expect(imagesUsedIn('# Title\n\nA [link](../images/not-an-image.png) is not one.')).toEqual([])
  })
})

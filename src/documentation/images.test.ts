// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a document may point at, and what it may not.
 *
 * The interesting half is the refusals: a picture is one the library names,
 * and nothing else is drawn, so a source that slips through here is a network
 * call in a tool that promises none.
 */
import { describe, expect, it } from 'vitest'
import { documentsUsing, imageNameOfSource, imagesUsedIn, pictureMarkdown } from './images'

describe('pictureMarkdown', () => {
  it('writes a picture of the library by its name', () => {
    expect(pictureMarkdown('cutover.png', 'Cutover')).toBe('![Cutover](image:cutover.png)')
    expect(pictureMarkdown('diagrams/context.png', 'Context')).toBe('![Context](image:diagrams/context.png)')
  })

  it('cannot have its alt text break the link, and writes what it reads back', () => {
    const written = pictureMarkdown('week-3.png', 'Week [3]')
    expect(written).toBe('![Week 3](image:week-3.png)')
    expect(imagesUsedIn(written)).toEqual(['week-3.png'])
  })
})

describe('imagesUsedIn', () => {
  it('finds each picture once, in the order it appears', () => {
    const md = [
      '![a](image:a.png)',
      'text ![b](image:b.jpg) more',
      '![again](image:a.png)',
      '![remote](https://example.org/c.png)',
    ].join('\n\n')
    expect(imagesUsedIn(md)).toEqual(['a.png', 'b.jpg'])
  })

  it('has nothing to say about a document with no pictures', () => {
    expect(imagesUsedIn('# Title\n\nA [link](image:not-an-image.png) is not one.')).toEqual([])
  })
})

describe('documentsUsing', () => {
  const documents = [
    { label: 'Order Management', text: 'See ![](image:cutover-k1.png) and ![](image:plan-k2.png).' },
    { label: 'ADR-0003 Keep the queue', text: '![Cutover](image:cutover-k1.png)' },
    { label: 'TR-0001 Warehouse', text: 'No pictures here.' },
    // A picture somewhere else with the same name is not this project's.
    { label: 'Billing', text: '![](https://example.org/image/cutover-k1.png)' },
  ]

  it('names every document that shows the picture, in the order given', () => {
    expect(documentsUsing('cutover-k1.png', documents)).toEqual(['Order Management', 'ADR-0003 Keep the queue'])
    expect(documentsUsing('plan-k2.png', documents)).toEqual(['Order Management'])
  })

  it('answers nothing for a picture nobody shows', () => {
    expect(documentsUsing('unused-k3.png', documents)).toEqual([])
  })
})

describe('a picture named by its name in the library', () => {
  it('reads the name an image: source gives, as a renderer hands it over', () => {
    expect(imageNameOfSource('image:diagrams/context.png')).toBe('diagrams/context.png')
    expect(imageNameOfSource('image:Kaart-%C3%BC.png')).toBe('Kaart-ü.png')
    expect(imageNameOfSource('<image:depot.png>')).toBe('depot.png')
  })

  it('is no name for any other source, or a name no picture may have', () => {
    expect(imageNameOfSource('depot.png')).toBeUndefined()
    expect(imageNameOfSource('https://example.org/depot.png')).toBeUndefined()
    expect(imageNameOfSource('image:../depot.png')).toBeUndefined()
    expect(imageNameOfSource('image:depot.exe')).toBeUndefined()
    expect(imageNameOfSource(undefined)).toBeUndefined()
  })
})

describe('who shows a picture named by its name', () => {
  it('counts a document that names it image:, as one that refers to its path', () => {
    expect(documentsUsing('depot.png', [
      { label: 'Crews', text: '![](image:depot.png)' },
      { label: 'Yard', text: '![](image:yard.png)' },
    ])).toEqual(['Crews'])
  })
})

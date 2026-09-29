// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom
/**
 * A report prints what the renderer drew: the pictures it asks for are the
 * ones MarkdownView drew from the library, taken from the parse that prints
 * them, and asked for when the report is produced and not before.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { ImageEntry } from '../../model/imageName'
import { imageNameKey } from '../../model/imageName'
import { renderShell } from '../../app/testing/renderShell'
import { drawnPictures, picturesForReport } from '../pictureReport'
import { memoryImageSource } from '../pictureSource'
import { MarkdownView } from './MarkdownView'
import { CollectPictures } from './PictureCollector'
import { PicturesProvider } from './Pictures'
import type { PictureWatch } from './Pictures'

afterEach(() => cleanup())

const PNG = { mediaType: 'image/png', bytes: new Uint8Array([1, 2, 3]) }
const OTHER = { mediaType: 'image/png', bytes: new Uint8Array([9]) }

function entry(name: string, n: number): ImageEntry {
  return { name, mediaType: 'image/png', size: 3, width: 640, height: 480, contentAddress: `sha256:${String(n).repeat(64)}` }
}

const LIBRARY = [entry('depot.png', 1), entry('Kaart-ü.png', 2), entry('yard.png', 3), entry('crews.png', 4)]

/** A report is produced from what it rendered, not from what comes into view: nothing is ever seen here. */
const NEVER: PictureWatch = () => () => undefined

const DOCUMENTS = [
  // Two spellings of one picture: the library folds them into one.
  '![Depot](image:depot.png) and again ![Depot](image:DEPOT.PNG)',
  // A name in another Unicode form than the library's, and one it does not hold.
  '![Map](image:Kaart-u%CC%88.png) ![Gone](image:gone.png)',
  // Named in code, which the renderer prints as text and draws no picture for.
  'Write `![Yard](image:yard.png)` to show it.\n\n```\n![Yard](image:yard.png)\n```',
  '![Crews](image:crews.png)',
]

describe('a report\'s pictures', () => {
  it('are the pictures the renderer drew, asked for once each when the report is produced and not before', async () => {
    const source = memoryImageSource({ crews: { 'depot.png': PNG, 'Kaart-ü.png': PNG, 'yard.png': PNG, 'crews.png': PNG } })
    const drawn = drawnPictures()
    const { container } = renderShell(
      <PicturesProvider source={source} scope="crews" library={LIBRARY} watch={NEVER}>
        <CollectPictures onDrawn={drawn.add}>
          {DOCUMENTS.map((markdown) => <MarkdownView key={markdown} markdown={markdown} />)}
        </CollectPictures>
      </PicturesProvider>,
    )
    const onPage = [...new Set([...container.querySelectorAll('img[data-picture]')]
      .map((img) => imageNameKey(img.getAttribute('data-picture') ?? '')))].sort()
    expect(onPage).toEqual(['crews.png', 'depot.png', 'kaart-ü.png'])
    expect(drawn.pictures().map((one) => imageNameKey(one.entry.name)).sort()).toEqual(onPage)
    expect(source.asked).toEqual([])

    const printed = await picturesForReport(source, drawn.pictures())
    expect(source.asked.map((one) => one.name).sort()).toEqual(['Kaart-ü.png', 'crews.png', 'depot.png'])
    expect(printed.pictures.map((one) => one.entry.name)).toEqual(['depot.png', 'Kaart-ü.png', 'crews.png'])
  })

  it('are all written down by the time a render that runs no effects returns', () => {
    const drawn = drawnPictures()
    const markup = renderToStaticMarkup(
      <PicturesProvider source={memoryImageSource({})} scope="crews" library={LIBRARY} watch={NEVER}>
        <CollectPictures onDrawn={drawn.add}>
          {DOCUMENTS.map((markdown) => <MarkdownView key={markdown} markdown={markdown} />)}
        </CollectPictures>
      </PicturesProvider>,
    )
    expect(markup).toContain('data-picture="depot.png"')
    expect(drawn.pictures().map((one) => one.entry.name)).toEqual(['depot.png', 'Kaart-ü.png', 'crews.png'])
  })

  it('keep two scopes\' pictures of one name apart, each asked of its own scope', async () => {
    const source = memoryImageSource({ crews: { 'depot.png': PNG }, depots: { 'depot.png': OTHER } })
    const drawn = drawnPictures()
    renderToStaticMarkup(
      <CollectPictures onDrawn={drawn.add}>
        <PicturesProvider source={source} scope="crews" library={LIBRARY} watch={NEVER}>
          <MarkdownView markdown="![Crews' depot](image:depot.png)" />
        </PicturesProvider>
        <PicturesProvider source={source} scope="depots" library={[entry('depot.png', 5)]} watch={NEVER}>
          <MarkdownView markdown="![The depots' depot](image:depot.png)" />
        </PicturesProvider>
      </CollectPictures>,
    )
    expect(drawn.pictures().map((one) => `${one.scope}:${one.entry.name}`)).toEqual(['crews:depot.png', 'depots:depot.png'])
    const printed = await picturesForReport(source, drawn.pictures())
    expect(printed.of('crews', 'depot.png')).toBe(PNG)
    expect(printed.of('depots', 'depot.png')).toBe(OTHER)
  })

  it('are written down only inside a report: a page with no collector above it writes down nothing', () => {
    const collected = vi.fn()
    renderShell(
      <PicturesProvider source={memoryImageSource({})} scope="crews" library={LIBRARY} watch={NEVER}>
        <MarkdownView markdown={DOCUMENTS[0]} />
        <CollectPictures onDrawn={collected}>
          <MarkdownView markdown="No pictures here." />
        </CollectPictures>
      </PicturesProvider>,
    )
    expect(collected).not.toHaveBeenCalled()
  })
})

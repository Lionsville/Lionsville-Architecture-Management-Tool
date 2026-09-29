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
    expect(drawn.entries().map((one) => imageNameKey(one.name)).sort()).toEqual(onPage)
    expect(source.asked).toEqual([])

    const printed = await picturesForReport(source, 'crews', drawn.entries())
    expect(source.asked.map((one) => one.name).sort()).toEqual(['Kaart-ü.png', 'crews.png', 'depot.png'])
    expect([...printed.keys()].sort()).toEqual(['Kaart-ü.png', 'crews.png', 'depot.png'])
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

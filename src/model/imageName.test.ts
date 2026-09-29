// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import {
  contentAddressOf, imageEntryRefusal, imageFoldersUnder, imageFolderOf, imageName, imageNameKey, imageNameOfReference, imageNameRefusal,
  imageReference, isImageName,
} from './imageName'

describe('an image name', () => {
  it('is a name with a picture’s extension, in folders or not', () => {
    expect(isImageName('context.png')).toBe(true)
    expect(isImageName('diagrams/context.png')).toBe(true)
    expect(isImageName('diagrams/2026/Übersicht-1.JPEG')).toBe(true)
  })

  it('refuses a name a document could not refer to', () => {
    for (const name of ['', '/context.png', 'diagrams/', 'a//b.png', './a.png', '../a.png', 'a/../b.png',
      'with space.png', 'back\\slash.png', 'brackets(1).png', 'what?.png', 'part#2.png', '50%.png', 'bell\u0007.png',
      'delete\u007f.png', 'tab\t.png']) {
      expect(imageNameRefusal(name), name).toBe('shell.imageBadName')
    }
    expect(imageNameRefusal(42)).toBe('shell.imageBadName')
  })

  it('refuses what a desktop will not keep in a name', () => {
    for (const name of ['a:b.png', 'star*.png', 'say"so".png', 'pipe|d.png']) expect(imageNameRefusal(name), name).toBe('shell.imageBadName')
  })

  it('is composed: made so, and refused when it is not', () => {
    const decomposed = 'U\u0308bersicht.png'
    expect(imageNameRefusal(decomposed)).toBe('shell.imageBadName')
    expect(imageName(decomposed)).toBe('\u00dcbersicht.png')
    expect(isImageName(imageName(decomposed))).toBe(true)
  })

  it('is the same picture as another in another case, or composed another way', () => {
    expect(imageNameKey('Diagrams/Context.PNG')).toBe(imageNameKey('diagrams/context.png'))
    expect(imageNameKey('U\u0308bersicht.png')).toBe(imageNameKey('übersicht.png'))
  })

  it('refuses a name whose extension is not a picture this tool keeps', () => {
    expect(imageNameRefusal('animation.gif')).toBe('shell.imageBadType')
    expect(imageNameRefusal('diagrams/notes')).toBe('shell.imageBadType')
  })

  it('is in the image folder its name starts with', () => {
    expect(imageFolderOf('context.png')).toBe('')
    expect(imageFolderOf('diagrams/context.png')).toBe('diagrams')
    expect(imageFolderOf('diagrams/2026/context.png')).toBe('diagrams/2026')
  })

  it('lists the image folders directly under an image folder, once each and sorted', () => {
    const names = ['top.png', 'diagrams/a.png', 'diagrams/old/b.png', 'diagrams/old/deeper/c.png', 'photos/d.jpg', 'diagramsx/e.png']
    expect(imageFoldersUnder('', names)).toEqual(['diagrams', 'diagramsx', 'photos'])
    expect(imageFoldersUnder('diagrams', names)).toEqual(['diagrams/old'])
    expect(imageFoldersUnder('diagrams/old', names)).toEqual(['diagrams/old/deeper'])
    expect(imageFoldersUnder('photos', names)).toEqual([])
  })
})

describe('a reference to an image', () => {
  it('is its name after `image:`, both ways', () => {
    expect(imageReference('diagrams/context.png')).toBe('image:diagrams/context.png')
    expect(imageNameOfReference('image:diagrams/context.png')).toBe('diagrams/context.png')
  })

  it('names nothing when it is something else, or a name no picture may have', () => {
    expect(imageNameOfReference('../images/context.png')).toBeUndefined()
    expect(imageNameOfReference('https://example.org/context.png')).toBeUndefined()
    expect(imageNameOfReference('image:../context.png')).toBeUndefined()
  })
})

describe('a content address', () => {
  it('is the SHA-256 of the bytes, in lower-case hex', async () => {
    // The digest of nothing at all, as every implementation of SHA-256 gives it.
    expect(await contentAddressOf(new Uint8Array())).toBe('sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })

  it('is the same for the same bytes and different for others', async () => {
    const one = await contentAddressOf(new Uint8Array([1, 2, 3]))
    expect(await contentAddressOf(new Uint8Array([1, 2, 3]))).toBe(one)
    expect(await contentAddressOf(new Uint8Array([1, 2, 4]))).not.toBe(one)
  })
})

describe('a library entry', () => {
  const entry = {
    name: 'context.png', mediaType: 'image/png', size: 3, width: 40, height: 30,
    contentAddress: `sha256:${'a'.repeat(64)}`,
  }

  it('describes its picture: the name’s media type, a content address, whole sizes', () => {
    expect(imageEntryRefusal(entry)).toBeUndefined()
    expect(imageEntryRefusal({ ...entry, size: 0, width: 0, height: 0 })).toBeUndefined()
  })

  it('is refused for its name first, then for what it says', () => {
    expect(imageEntryRefusal({ ...entry, name: 'a b.png' })).toBe('shell.imageBadName')
    expect(imageEntryRefusal({ ...entry, name: 'a.gif', mediaType: 'image/gif' })).toBe('shell.imageBadType')
    expect(imageEntryRefusal({ ...entry, mediaType: 'image/webp' })).toBe('shell.imageBadEntry')
    expect(imageEntryRefusal({ ...entry, contentAddress: `sha256:${'a'.repeat(63)}` })).toBe('shell.imageBadEntry')
    expect(imageEntryRefusal({ ...entry, width: '40' as unknown as number })).toBe('shell.imageBadEntry')
  })
})

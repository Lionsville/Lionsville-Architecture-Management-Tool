// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import {
  contentAddressOf, foldersUnder, imageFolderOf, imageNameOfReference, imageNameRefusal, imageReference, isImageName,
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

  it('refuses a name whose extension is not a picture this tool keeps', () => {
    expect(imageNameRefusal('animation.gif')).toBe('shell.imageBadType')
    expect(imageNameRefusal('diagrams/notes')).toBe('shell.imageBadType')
  })

  it('is in the folder its name starts with', () => {
    expect(imageFolderOf('context.png')).toBe('')
    expect(imageFolderOf('diagrams/context.png')).toBe('diagrams')
    expect(imageFolderOf('diagrams/2026/context.png')).toBe('diagrams/2026')
  })

  it('lists the folders directly under a folder, once each and sorted', () => {
    const names = ['top.png', 'diagrams/a.png', 'diagrams/old/b.png', 'diagrams/old/deeper/c.png', 'photos/d.jpg', 'diagramsx/e.png']
    expect(foldersUnder('', names)).toEqual(['diagrams', 'diagramsx', 'photos'])
    expect(foldersUnder('diagrams', names)).toEqual(['diagrams/old'])
    expect(foldersUnder('diagrams/old', names)).toEqual(['diagrams/old/deeper'])
    expect(foldersUnder('photos', names)).toEqual([])
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

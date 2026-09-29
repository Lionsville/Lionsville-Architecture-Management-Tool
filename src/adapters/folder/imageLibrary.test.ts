// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { HostModel } from '../../model/hostModel'
import { contentAddressOf, imageNameRefusal } from '../../model/imageName'
import {
  filesInDocuments, imageEntryOf, imageNameOfFile, namesInDocuments, pictureFileOf, pictureSize,
} from './imageLibrary'
import type { PictureFiles } from './imageLibrary'

function model(description: string, decisionBody = '', subjectId?: string): HostModel {
  return {
    name: 'Acme Logistics',
    elements: [{ id: 'crews', kind: 'application', name: 'Crews', lifecycle: 'live', isManaged: true, aspects: {}, description }],
    relations: [],
    diagrams: [],
    decisions: [{
      id: 'adr-1', number: 1, title: 'Plan crews centrally', status: 'proposed', date: '2026-09-29',
      body: decisionBody, signers: [], ...(subjectId ? { subjectId } : {}),
    }],
  }
}

/** A library where two files have names of their own: one with a space, one decomposed. */
const files: PictureFiles = {
  nameOf: (file) => ({ 'my diagram.png': 'my-diagram.png', 'context.png': 'context.png', 'A/x.png': 'a/x.png' } as Record<string, string>)[file],
  fileOf: (name) => ({ 'my-diagram.png': 'my diagram.png', 'context.png': 'context.png', 'a/x.png': 'A/x.png' } as Record<string, string>)[name],
}

describe('documents, between names and files', () => {
  it('reads a source in the pictures folder as the name of the picture, however deep and however escaped', () => {
    expect(pictureFileOf('../images/context.png')).toBe('context.png')
    expect(pictureFileOf('../../images/my%20diagram.png')).toBe('my diagram.png')
    expect(pictureFileOf('<../images/my diagram.png>')).toBe('my diagram.png')
    expect(pictureFileOf('images/A/x.png')).toBe('A/x.png')
    expect(pictureFileOf('https://example.org/images/x.png')).toBeUndefined()
    expect(pictureFileOf('../docs/x.png')).toBeUndefined()
  })

  it('names what a document shows by name, and leaves what the library does not hold as it is', () => {
    const read = namesInDocuments(model(
      'See ![map](../images/context.png) and ![two](../images/my%20diagram.png) and ![gone](../images/gone.png).',
      '![folded](../../images/A/x.png)', 'crews',
    ), files.nameOf)
    expect(read.elements[0].description)
      .toBe('See ![map](image:context.png) and ![two](image:my-diagram.png) and ![gone](../images/gone.png).')
    expect(read.decisions?.[0].body).toBe('![folded](image:a/x.png)')
  })

  it('writes a document nobody changed back as it was read, byte for byte', () => {
    const disk = model('![two](<../images/my diagram.png>) once', '![x](images/context.png)')
    const read = namesInDocuments(disk, files.nameOf)
    expect(filesInDocuments(read, disk, files)).toEqual(disk)
  })

  it('writes a changed document at the depth its file is kept at, escaped for a markdown reader', () => {
    const read = namesInDocuments(model('old'), files.nameOf)
    const changed: HostModel = {
      ...read,
      elements: [{ ...read.elements[0], description: '![two](image:my-diagram.png)' }],
      decisions: [{ ...read.decisions![0], subjectId: 'crews', body: '![x](image:a/x.png)' }],
    }
    const written = filesInDocuments(changed, model('old'), files)
    expect(written.elements[0].description).toBe('![two](../images/my%20diagram.png)')
    expect(written.decisions?.[0].body).toBe('![x](../../images/A/x.png)')
  })
})

describe('names for files a person put there', () => {
  it('keeps a name that passes, and makes one that does from one that does not', () => {
    const taken = new Set<string>()
    expect(imageNameOfFile('context.png', taken)).toBe('context.png')
    const made = imageNameOfFile('my diagram (v2).png', taken)
    expect(made).toBe('my-diagram--v2-.png')
    expect(imageNameRefusal(made)).toBeUndefined()
  })

  it('composes a decomposed name, and numbers a second that would be the same picture', () => {
    const taken = new Set<string>()
    expect(imageNameOfFile('Kaart-ü.png', taken)).toBe('Kaart-ü.png')
    expect(imageNameOfFile('kaart-ü.PNG', taken)).toBe('kaart-ü-2.PNG')
  })
})

describe('what bytes say about themselves', () => {
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 2, 128, 0, 0, 1, 224])
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, 0, 120, 0, 160, 1, 1, 0x11, 0])
  const vp8x = new Uint8Array(30)
  vp8x.set([...'RIFF'].map((c) => c.charCodeAt(0)), 0)
  vp8x.set([...'WEBPVP8X'].map((c) => c.charCodeAt(0)), 8)
  vp8x.set([99, 0, 0, 49, 0, 0], 24)

  it('reads the size a PNG, a JPEG, a WebP and an SVG declare', () => {
    expect(pictureSize(png, 'image/png')).toEqual({ width: 640, height: 480 })
    expect(pictureSize(jpeg, 'image/jpeg')).toEqual({ width: 160, height: 120 })
    expect(pictureSize(vp8x, 'image/webp')).toEqual({ width: 100, height: 50 })
    const svg = (tag: string) => new TextEncoder().encode(`<?xml version="1.0"?>${tag}</svg>`)
    expect(pictureSize(svg('<svg width="64px" height="32">'), 'image/svg+xml')).toEqual({ width: 64, height: 32 })
    expect(pictureSize(svg('<svg viewBox="0 0 120.4 80">'), 'image/svg+xml')).toEqual({ width: 120, height: 80 })
    expect(pictureSize(new Uint8Array([1, 2, 3]), 'image/png')).toBeUndefined()
  })

  it('describes bytes as a library entry, with zeros where they declare no size', async () => {
    expect(await imageEntryOf('diagrams/context.png', png)).toEqual({
      name: 'diagrams/context.png', mediaType: 'image/png', size: png.length, width: 640, height: 480,
      contentAddress: await contentAddressOf(png),
    })
    expect(await imageEntryOf('x.jpg', new Uint8Array([1]))).toMatchObject({ mediaType: 'image/jpeg', width: 0, height: 0 })
  })
})

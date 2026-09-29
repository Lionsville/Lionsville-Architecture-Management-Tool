// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { HostModel } from '../../../model/hostModel'
import { imageNameRefusal } from '../../../model/imageName'
import {
  filesInDocuments, imageNameOfFile, namesInDocuments, pictureFileOf,
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

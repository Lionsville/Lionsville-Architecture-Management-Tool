// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A save on the desktop asks where, and says when the person said nowhere: a
 * caller that says "saved" on the answer must be able to tell.
 */
import { describe, expect, it, vi } from 'vitest'
import { DesktopDocumentGateway } from './DesktopDocumentGateway'
import type { DesktopFiles } from './channel'

const gateway = (saveDocument: DesktopFiles['saveDocument']) => new DesktopDocumentGateway({ saveDocument } as DesktopFiles)

describe('DesktopDocumentGateway.save', () => {
  it('hands bytes and text over as bytes, under the name, and answers nothing once written', async () => {
    const saveDocument = vi.fn(() => Promise.resolve(true))
    const bytes = new Uint8Array([1, 2, 3])
    await expect(gateway(saveDocument).save({ name: 'a.png', mediaType: 'image/png', bytes })).resolves.toBeUndefined()
    await gateway(saveDocument).save({ name: 'a.json', mediaType: 'application/json', text: '{}' })
    expect(saveDocument.mock.calls).toEqual([
      ['a.png', bytes, 'image/png'],
      ['a.json', new TextEncoder().encode('{}'), 'application/json'],
    ])
  })

  it('answers cancelled when the person closed the dialog, and rejects when the write failed', async () => {
    await expect(gateway(() => Promise.resolve(false)).save({ name: 'a', mediaType: 'text/plain', text: '' })).resolves.toBe('cancelled')
    await expect(gateway(() => Promise.reject(new Error('disk full'))).save({ name: 'a', mediaType: 'text/plain', text: '' })).rejects.toThrow('disk full')
  })
})

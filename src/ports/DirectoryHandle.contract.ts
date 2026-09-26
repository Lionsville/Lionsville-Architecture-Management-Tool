// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What every directory handle must do — written once, run by all of them.
 *
 * `DirectoryHandleLike` had four fillings and no suite of its own: the folder
 * store's contract ran over each of them and was taken as the proof. It is a
 * proof of what the store asks today, which is narrower than what the port
 * says. The store writes each file in one `write` and closes, so a filling that
 * kept only the last of several writes passed every clause — and the next
 * caller that wrote a file in two pieces would have lost the first without an
 * error anywhere. The port is the promise, so the port gets the suite.
 *
 * Only what every filling can promise is here. A browser's handle, the
 * desktop's over IPC and one over a network differ in places the port leaves
 * open on purpose — whether `create` makes an empty file before anything is
 * written, whether a folder nobody wrote into is listed, whether removing what
 * is not there throws — and a clause about any of those would be a clause one
 * honest filling fails.
 *
 * `make` answers a fresh, empty folder each call, and may answer it with a
 * promise for the reason the other makers may: a folder over a network is
 * connected before it is a folder.
 *
 * Named `.contract.ts` so the runner does not pick it up on its own.
 */
import { describe, expect, it } from 'vitest'
import type { DirectoryHandleLike, FileHandleLike } from './DirectoryHandle'

/** Write a file the way a caller of the port does: open, write each piece, close. */
async function writePieces(
  folder: DirectoryHandleLike, name: string, pieces: readonly (string | Uint8Array)[],
): Promise<FileHandleLike> {
  const handle = await folder.getFileHandle(name, { create: true })
  const writable = await handle.createWritable()
  for (const piece of pieces) await writable.write(piece)
  await writable.close()
  return handle
}

async function textOf(folder: DirectoryHandleLike, name: string): Promise<string> {
  return (await (await folder.getFileHandle(name)).getFile()).text()
}

async function bytesOf(folder: DirectoryHandleLike, name: string): Promise<number[]> {
  return [...new Uint8Array(await (await (await folder.getFileHandle(name)).getFile()).arrayBuffer())]
}

async function namesIn(folder: DirectoryHandleLike): Promise<string[]> {
  const found: string[] = []
  for await (const entry of folder.values()) found.push(`${entry.kind}:${entry.name}`)
  return found.sort()
}

export function describeDirectoryHandle(
  name: string, make: () => DirectoryHandleLike | Promise<DirectoryHandleLike>,
): void {
  describe(`DirectoryHandle contract — ${name}`, () => {
    it('reads a file back as it was written', async () => {
      const folder = await make()
      await writePieces(folder, 'one.txt', ['written once'])
      expect(await textOf(folder, 'one.txt')).toBe('written once')
    })

    /**
     * The clause this suite exists for. A writable is a cursor, as the browser's
     * is: each `write` lands after the one before it, and `close` puts all of
     * them in the file. Keeping the last one only is a file that is silently
     * short, which no caller can tell from one that is whole.
     */
    it('lands two writes to one writable, both of them, in the order they were made', async () => {
      const folder = await make()
      await writePieces(folder, 'two.txt', ['first half, ', 'second half'])
      expect(await textOf(folder, 'two.txt')).toBe('first half, second half')
    })

    it('does the same for bytes', async () => {
      const folder = await make()
      await writePieces(folder, 'two.bin', [new Uint8Array([1, 2]), new Uint8Array([3, 4, 5])])
      expect(await bytesOf(folder, 'two.bin')).toEqual([1, 2, 3, 4, 5])
    })

    it('shows the old contents until the writable is closed', async () => {
      const folder = await make()
      await writePieces(folder, 'held.txt', ['before'])
      const writable = await (await folder.getFileHandle('held.txt')).createWritable()
      await writable.write('after')
      expect(await textOf(folder, 'held.txt')).toBe('before')
      await writable.close()
      expect(await textOf(folder, 'held.txt')).toBe('after')
    })

    it('replaces a file written a second time rather than adding to it', async () => {
      const folder = await make()
      const handle = await writePieces(folder, 'again.txt', ['a longer first version'])
      const writable = await handle.createWritable()
      await writable.write('short')
      await writable.close()
      expect(await textOf(folder, 'again.txt')).toBe('short')
      expect((await handle.getFile()).size).toBe('short'.length)
    })

    it('lists a folder a file was written into, and the file inside it', async () => {
      const folder = await make()
      const inner = await folder.getDirectoryHandle('inner', { create: true })
      await writePieces(inner, 'kept.txt', ['kept'])
      expect(await namesIn(folder)).toEqual(['directory:inner'])
      expect(await namesIn(await folder.getDirectoryHandle('inner'))).toEqual(['file:kept.txt'])
    })

    it('refuses a file or a folder that is not there, unless asked to create it', async () => {
      const folder = await make()
      await expect(folder.getFileHandle('absent.txt')).rejects.toThrow()
      await expect(folder.getDirectoryHandle('absent')).rejects.toThrow()
    })

    it('removes a file', async () => {
      const folder = await make()
      await writePieces(folder, 'gone.txt', ['gone'])
      await folder.removeEntry('gone.txt')
      await expect(folder.getFileHandle('gone.txt')).rejects.toThrow()
      expect(await namesIn(folder)).toEqual([])
    })
  })
}

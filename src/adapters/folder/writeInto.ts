// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import type { DirectoryHandleLike } from './DirectoryHandle'

/**
 * A file written in a folder. A file made for this write and left empty by a
 * failure says nothing, and reads as damage: a header or a model that blocks
 * every later write of the scope and of those under it, a picture of nothing.
 * So it goes. A write that failed over a file with something in it left that
 * as it was.
 */
export async function writeInto(folder: DirectoryHandleLike, name: string, data: string | Uint8Array): Promise<void> {
  const handle = await folder.getFileHandle(name, { create: true })
  try {
    const writable = await handle.createWritable()
    try {
      await writable.write(data)
    } finally {
      await writable.close()
    }
  } catch (cause) {
    const empty = await handle.getFile().then((held) => held.size === 0, () => false)
    if (empty) await folder.removeEntry(name).catch(() => undefined)
    throw cause
  }
}

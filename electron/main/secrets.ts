// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The small-secrets store a registered hook is handed (`platform/desktopHook`).
 *
 * Separate from `desktopHooks.ts`, which is the Electron wiring, for the
 * reason `fileStore.ts` is separate from `files.ts`: this file imports no
 * Electron, so the mode of the file it writes can be asserted by the ordinary
 * test runner against a real directory — and the mode is the whole of what
 * this store promises.
 *
 * **One file, not one per name.** A name is a key in a JSON object rather than
 * a path segment, so there is no path to escape from and no check to get
 * wrong. It also means one file to give the mode to instead of a directory
 * whose entries could each be created differently.
 *
 * **0600 before the value, not after.** `mcp.json` is written and then
 * chmod-ed, which is safe for a file this process created and leaves a window
 * for one it did not. Here the handle is opened truncating, tightened, and
 * only then written, so a file that arrived with the wrong mode never holds a
 * secret under it.
 *
 * Unreadable reads as empty — a corrupt file is the same answer as no file,
 * which is how every settings file in this app reads something that is not the
 * shape. A write or a removal that fails throws, because a secret that was
 * quietly not kept is worse than one that is reported.
 */
import { open, readFile, rm } from 'node:fs/promises'
import type { SecretStore } from '../../src/platform/desktopHook'

/** What is on disk: names to values, and nothing else. */
type Kept = Record<string, string>

export function fileSecrets(path: string): SecretStore {
  const load = async (): Promise<Kept> => {
    let text: string
    try {
      text = await readFile(path, 'utf8')
    } catch {
      return {}
    }
    try {
      const held = JSON.parse(text) as unknown
      if (!held || typeof held !== 'object' || Array.isArray(held)) return {}
      return Object.fromEntries(
        Object.entries(held as Record<string, unknown>).filter(([, value]) => typeof value === 'string'),
      ) as Kept
    } catch {
      return {}
    }
  }

  const save = async (kept: Kept): Promise<void> => {
    // Nothing left to keep: the file goes, rather than sitting there as an
    // empty object saying a secret was once here.
    if (Object.keys(kept).length === 0) {
      await rm(path, { force: true })
      return
    }
    const handle = await open(path, 'w', 0o600)
    try {
      // `mode` on `open` applies only to a file it creates. A file that
      // already existed keeps whatever it had, so say it again — before the
      // value goes in, not after.
      await handle.chmod(0o600)
      await handle.writeFile(`${JSON.stringify(kept, undefined, 2)}\n`, 'utf8')
    } finally {
      await handle.close()
    }
  }

  return {
    read: async (name) => (await load())[name],
    write: async (name, value) => {
      await save({ ...(await load()), [name]: value })
    },
    remove: async (name) => {
      const kept = await load()
      if (!(name in kept)) return
      delete kept[name]
      await save(kept)
    },
  }
}

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What this browser keeps for a folder it was given, and never in the folder
 * (ADR-0031, as built): its history, the step ids applied to it, where its
 * scopes' identities were found, and what its pictures were found to be.
 *
 * **A folder is found by its handle.** A folder handle has no identity that
 * storage can be keyed by: two handles can only be asked whether they are the
 * same folder (`isSameEntry`). So each folder this browser keeps anything for
 * has a record of its own under a key made at random, holding its handle; a
 * folder's key is the record whose handle is the same folder as this one, and
 * everything kept for it is under that key (`folderData`, one record per
 * value), so two tabs writing for one folder never write over each other's.
 *
 * The handle is asked outside any transaction: a browser's database ends a
 * transaction left waiting on anything else (`KeyedStore`).
 */
import { keyOf, prefix } from '../../repositories/KeyedStore'
import type { KeyedStore } from '../../repositories/KeyedStore'

/** A folder handle as far as this needs one; a browser's is kept in its database as itself. */
export type FolderHandle = object

/** Whether a kept handle is the same folder as this one: a browser's own `isSameEntry`, where not said. */
export type SameFolder = (kept: FolderHandle, mine: FolderHandle) => Promise<boolean>

export const sameEntry: SameFolder = (kept, mine) => {
  const held = kept as { isSameEntry?(other: unknown): Promise<boolean> }
  return held.isSameEntry ? held.isSameEntry(mine) : Promise.resolve(false)
}

export class BrowserFolder {
  private key: Promise<string> | undefined

  constructor(
    readonly store: KeyedStore,
    private readonly handle: FolderHandle,
    private readonly same: SameFolder = sameEntry,
  ) {}

  /** This folder's key: the record whose handle is this folder, or a new one. */
  folderKey(): Promise<string> {
    this.key ??= this.find().catch((cause: unknown) => {
      this.key = undefined
      throw cause
    })
    return this.key
  }

  /**
   * The key of the records whose handle is this folder — the lowest, where
   * two tabs each made one for it at once — or a new one, made and then
   * looked for again among all of them, so both tabs settle on one key and
   * neither's steps or history are kept where the other never looks.
   */
  private async find(): Promise<string> {
    const found = await this.matching()
    if (found) return found
    const key = crypto.randomUUID()
    await this.store.transaction(['folders'], 'write', (tx) => {
      tx.put('folders', key, { handle: this.handle })
      return Promise.resolve()
    })
    return await this.matching() ?? key
  }

  /** The lowest key whose handle is this folder, asked outside any transaction. */
  private async matching(): Promise<string | undefined> {
    const kept = await this.store.transaction(['folders'], 'read', (tx) => tx.range<{ handle: FolderHandle }>('folders', {}))
    for (const { key, value } of kept) {
      if (await this.same(value.handle, this.handle).catch(() => false)) return key
    }
    return undefined
  }

  /** The key of one value of one kind kept for this folder. */
  async keyOf(kind: string, name = ''): Promise<string> {
    return keyOf(await this.folderKey(), kind, name)
  }

  /** The range of every value of one kind kept for this folder. */
  async kind(kind: string): Promise<{ from?: string; below?: string }> {
    return prefix(keyOf(await this.folderKey(), kind, ''))
  }
}

/**
 * A map kept for a folder one record per entry, read whole and written as the
 * entries that changed — so two tabs that each add their own never lose one.
 * What `StepStore`, `PlaceStore` and `StampCache` are over a browser folder.
 */
export function keptMap<T>(folder: BrowserFolder, kind: string): {
  read(): Promise<Record<string, T> | undefined>
  write(next: Record<string, T>): Promise<void>
} {
  let last: Record<string, string> = {}
  return {
    async read() {
      const range = await folder.kind(kind)
      const start = (await folder.keyOf(kind)).length
      const rows = await folder.store.transaction(['folderData'], 'read', (tx) => tx.range<T>('folderData', range))
      if (rows.length === 0) return undefined
      const found = Object.fromEntries(rows.map(({ key, value }) => [key.slice(start), value]))
      last = Object.fromEntries(Object.entries(found).map(([name, value]) => [name, JSON.stringify(value)]))
      return found
    },
    async write(next) {
      const keys = new Map<string, string>()
      for (const name of new Set([...Object.keys(next), ...Object.keys(last)])) keys.set(name, await folder.keyOf(kind, name))
      const text = Object.fromEntries(Object.entries(next).map(([name, value]) => [name, JSON.stringify(value)]))
      await folder.store.transaction(['folderData'], 'write', (tx) => {
        for (const [name, value] of Object.entries(next)) if (last[name] !== text[name]) tx.put('folderData', keys.get(name)!, value)
        for (const name of Object.keys(last)) if (!(name in next)) tx.delete('folderData', keys.get(name)!)
        return Promise.resolve()
      })
      last = text
    },
  }
}

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * `ImageRepository` over a keyed store (ADR-0031 §3).
 *
 * The library is part of a scope's state and is kept one entry per picture,
 * under the scope's identity and the picture's name, so a lookup by name
 * reads one entry and a listing of one image folder reads the names that
 * start with it — never the whole library, and never a model. Bytes are kept
 * under the scope's identity and their content address: the same bytes put
 * twice are one value, a picture is answered only through its library entry,
 * and bytes put and never added are answered by no name. They stay while the
 * library or any entry of the scope's history names them, because going back
 * to that entry must find them; bytes named by neither go a day after they
 * were put, and all of them go with their scope (`imageNames.ts`).
 */
import { contentAddressOf, imageFolderOf, imageFoldersUnder, imageNameRefusal, mediaTypeOfBytes } from '../../model/imageName'
import type { ContentAddress, ImageEntry, ImageFolder, ImageName } from '../../model/imageName'
import type { ScopeId } from '../../projects/scopeState'
import type { ImageBytes, ImageListing, ImageRepository, Put } from '../../ports/ImageRepository'
import { keyOf, prefix } from './KeyedStore'
import type { Transaction } from './KeyedStore'
import { bytesPut } from './imageNames'
import { bytesKey, libraryKey } from './kept'
import type { Source } from './source'

export class KeptImages implements ImageRepository {
  readonly id: string

  private readonly source: Source

  constructor(source: Source) {
    this.source = source
    this.id = source.id
  }

  async put(scope: ScopeId, name: ImageName, bytes: Uint8Array): Promise<Put> {
    const refused = imageNameRefusal(name)
    if (refused) return { refused }
    // Before the transaction: a digest is a wait the store's transaction would not survive.
    const contentAddress = await contentAddressOf(bytes)
    const kept = new Uint8Array(bytes)
    const now = Date.now()
    return this.source.write(async (tx): Promise<Put> => {
      if (!await tx.get('scopes', scope)) return { refused: 'shell.scopeGone' }
      tx.put('bytes', bytesKey(scope, contentAddress), kept)
      await bytesPut(tx, scope, contentAddress, now)
      return { contentAddress }
    })
  }

  list(scope: ScopeId, within: ImageFolder): Promise<ImageListing> {
    return this.source.read(async (tx) => {
      const start = within === '' ? keyOf(scope, '') : keyOf(scope, `${within}/`)
      const under = (await tx.range<ImageEntry>('library', prefix(start))).map(({ value }) => value)
      return {
        images: under.filter((image) => imageFolderOf(image.name) === within)
          .sort((one, other) => (one.name < other.name ? -1 : one.name > other.name ? 1 : 0)),
        imageFolders: imageFoldersUnder(within, under.map((image) => image.name)),
      }
    })
  }

  find(scope: ScopeId, name: ImageName): Promise<ImageEntry | undefined> {
    return this.source.read((tx) => entryOf(tx, scope, name))
  }

  bytes(scope: ScopeId, name: ImageName): Promise<ImageBytes | undefined> {
    return this.source.read(async (tx) => {
      const entry = await entryOf(tx, scope, name)
      const held = entry && await tx.get<Uint8Array>('bytes', bytesKey(scope, entry.contentAddress))
      return entry && held ? { mediaType: entry.mediaType, bytes: new Uint8Array(held) } : undefined
    })
  }

  bytesAt(scope: ScopeId, address: ContentAddress): Promise<ImageBytes | undefined> {
    return this.source.read(async (tx) => {
      const held = await tx.get<Uint8Array>('bytes', bytesKey(scope, address))
      if (!held) return undefined
      const copy = new Uint8Array(held)
      const named = (await tx.range<ImageEntry>('library', prefix(keyOf(scope, ''))))
        .map(({ value }) => value)
        .find((entry) => entry.contentAddress === address)
      return { mediaType: named?.mediaType ?? mediaTypeOfBytes(copy), bytes: copy }
    })
  }
}

function entryOf(tx: Transaction, scope: ScopeId, name: ImageName): Promise<ImageEntry | undefined> {
  return typeof name === 'string' ? tx.get<ImageEntry>('library', libraryKey(scope, name)) : Promise.resolve(undefined)
}

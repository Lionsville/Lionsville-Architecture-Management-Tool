// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The scopes this browser kept before its repositories, brought into them
 * once, as what a new store starts with (`Source`, `SourceOptions.seed`).
 *
 * Until the repositories, a browser kept each scope as one text under its
 * address in the key-value storage (`WebStorageScopeStore`): the model with
 * its documents as the folder writes them — a picture named `../images/<file>`
 * — and each picture's bytes as a data URL beside it. The repositories keep a
 * document naming its pictures (`image:<name>`), the library as entries, and
 * the bytes by content address, so each scope is read the way the store it
 * was kept by reads it, and turned into that shape with the folder's own
 * translation (`adapters/folder/imageLibrary.ts`) — the same pictures, under
 * the same names wherever the rule allows them, and the documents pointing at
 * them.
 *
 * **Copied, never moved.** Nothing here writes to the key-value storage. What a
 * person kept there is still there, byte for byte, under the key it always
 * had, and the scope's first entry in its new history is the state it arrived
 * in — so neither the old copy nor the conversion can be lost, and either is a
 * way back from the other. A text that would not read is left where it is, as
 * the store it came from always left it; a picture whose bytes would not read,
 * or that is not one the library holds, stays named in its documents as it
 * was, and out of the library.
 *
 * **Once.** It is asked only while the new store is empty. A scope an older
 * page writes to the key-value storage after that is not brought over again:
 * by then the scope has a history here that a second copy would write over.
 */
import { imageEntryRefusal } from '../../model/imageName'
import type { ImageEntry, ImageName } from '../../model/imageName'
import { readDataUrl } from '../../projects/fileText'
import type { ScopeSnapshot } from '../../projects/scope'
import type { ScopeContent } from '../../projects/scopeState'
import { imageEntryOf, imageNameOfFile, namesInDocuments } from '../folder/imageLibrary'
import type { Seed, SeededScope } from '../repositories/source'
import type { KeyValueStorage } from './KeyValueStorage'
import { WebStorageScopeStore } from './WebStorageScopeStore'

/** What the entry each scope arrives as says it was. Kept in a history, so in the history's language: English. */
export const EARLIER_SUBJECT = 'Brought over from this browser’s earlier storage'

/** Every scope the key-value storage holds, as a seed; `undefined` where it holds none. */
export async function earlierScopes(storage: KeyValueStorage): Promise<Seed | undefined> {
  const store = new WebStorageScopeStore(storage)
  const paths = new Set((await store.models()).map((scope) => scope.path))
  const scopes: SeededScope[] = []
  for (const path of paths) {
    const snapshot = await store.load(path)
    if (snapshot) scopes.push(await seeded(snapshot))
  }
  return scopes.length > 0 ? { subject: EARLIER_SUBJECT, scopes } : undefined
}

/** One scope as the repositories keep it, with its pictures' bytes. */
async function seeded(snapshot: ScopeSnapshot): Promise<SeededScope> {
  const taken = new Set<string>()
  const names = new Map<string, ImageName>()
  const images: ImageEntry[] = []
  const bytes: SeededScope['bytes'][number][] = []
  for (const image of snapshot.imageLibrary ?? []) {
    const read = readDataUrl(image.url)
    if (!read) continue
    const name = imageNameOfFile(image.file, taken)
    const entry = await imageEntryOf(name, read.bytes)
    if (imageEntryRefusal(entry)) continue
    names.set(image.file, name)
    images.push(entry)
    bytes.push({ contentAddress: entry.contentAddress, bytes: read.bytes })
  }
  const content: ScopeContent = {
    model: namesInDocuments(snapshot.model, (file) => names.get(file)),
    images,
    activeDiagramId: snapshot.activeDiagramId,
    logoLibrary: snapshot.logoLibrary,
    ...(snapshot.kind !== undefined ? { kind: snapshot.kind } : {}),
    ...(snapshot.client !== undefined ? { client: snapshot.client } : {}),
    ...(snapshot.links !== undefined ? { links: snapshot.links } : {}),
  }
  const at = snapshot.updatedAt === undefined ? Number.NaN : Date.parse(snapshot.updatedAt)
  return { address: snapshot.path, content, bytes, ...(Number.isFinite(at) ? { at } : {}) }
}

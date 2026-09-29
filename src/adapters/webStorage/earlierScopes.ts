// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The scopes this browser kept before its repositories, brought into them
 * (`Bringing`, `adapters/repositories/bring.ts`).
 *
 * Until the repositories, a browser kept each scope as one text under its
 * address in the key-value storage (`WebStorageScopeStore`): the model with
 * its documents as the folder writes them — a picture named `../images/<file>`
 * — and each picture's bytes as a data URL beside it. The repositories keep a
 * document naming its pictures (`image:<name>`), the library as entries, and
 * the bytes by content address. So each scope is read the way the store it
 * was kept by reads it, and turned into that shape with the folder's own
 * translation (`adapters/folder/imageLibrary.ts`): the same pictures, under
 * the same names wherever the rule allows them, and the documents pointing at
 * them. A picture whose file name says nothing, or the wrong thing, about what
 * its bytes are takes the extension its data URL says, so its name is one the
 * library holds and its documents still find it.
 *
 * **Copied, never moved.** Nothing here writes a scope's key. What a person
 * kept there is still there, byte for byte, and each scope's first entry in
 * its new history is the state it arrived in — so neither copy can be lost,
 * and either is a way back from the other. The one key this writes is a
 * marker outside every key a scope or a preference is kept under, which an
 * older build does not read: it says a copy was made.
 *
 * **Every start looks again, and never brings an older copy over newer
 * work.** The note kept with the repositories says, per address, the revision
 * and time of the text last looked at. A text an older page wrote since —
 * changed or new — is brought again only where nothing was done here to the
 * scope it was brought to (`adapters/repositories/bring.ts`). A text only
 * saved again, as an older build saves every scope it upgrades on opening,
 * holds the content last brought, and is no change at all. Where
 * something was — a step, a move, a removal — it has changed in both places:
 * nothing is written, and the standing lists the address for a person to
 * answer, one address at a time.
 *
 * **A lost database is asked about, never refilled on the quiet.** Where the
 * marker says a copy was made and the database is new, what the key-value
 * storage holds may be long out of date: the work since was in the database
 * that is gone. Nothing is brought, and the standing says a person must choose
 * (`Earlier.standing`, `bringOver`, `leave`).
 *
 * **What would not read is left, and said.** A text that does not read, a
 * scope that will not convert, a picture whose bytes or name will not do: each
 * stays where it was, the rest of the scope and every other scope come over,
 * and the note lists what was left so a person can be told.
 */
import { imageMediaType } from '../../model/documentImage'
import { imageEntryRefusal } from '../../model/imageName'
import type { ImageEntry, ImageName } from '../../model/imageName'
import { sameValue } from '../../model/recordKey'
import { readDataUrl } from '../../projects/dataUrl'
import type { ScopeSnapshot } from '../../projects/scope'
import type { ScopePath } from '../../projects/scopePath'
import type { ScopeContent } from '../../projects/scopeState'
import { imageEntryOf } from '../../model/imageEntry'
import { imageNameOfFile, namesInDocuments } from '../folder/imageLibrary'
import type { Brought, BroughtScope } from '../repositories/bring'
import type { Bringing, BroughtAnswer, Source } from '../repositories/source'
import type { KeyValueStorage } from './KeyValueStorage'
import { LEGACY_PROJECT_PREFIX, SCOPE_PREFIX, WebStorageScopeStore } from './WebStorageScopeStore'

/** What the entry each scope first arrives as says it was. Kept in a history, so a sentence, in English. */
export const EARLIER_SUBJECT = 'Brought over from this browser’s earlier storage'

/** What the entry a scope arrives as again says it was. */
export const AGAIN_SUBJECT = 'Brought over again from this browser’s earlier storage'

/** What the entry that keeps what was here, before a scope is brought over again, says it was. */
export const BEFORE_AGAIN_SUBJECT = 'Before bringing this over again from this browser’s earlier storage'

/** The one key written: a copy was made into this browser's repositories. Under no scope or preference prefix. */
export const EARLIER_MARKER = 'lvarch.repositories'

/** What was left where it was: a scope whole, or pictures of one, by file name. */
export type Left = { path: ScopePath; why: 'unread' } | { path: ScopePath; why: 'pictures'; pictures: string[] }

/** Per address, the text that was brought: its revision and when it was saved. */
type Seen = Record<ScopePath, { revision?: string; updatedAt?: string }>

/** The note kept with the repositories between starts. */
type Note = { seen: Seen; left: Left[]; asking?: true }

/** What a start could not decide, and what was left behind. */
export type EarlierStanding = {
  /** The database was lost after a copy: a person chooses to bring the older copy over, or leave it. */
  asking: boolean
  left: readonly Left[]
  /** Addresses whose scope here could not be read whole, so nothing was brought over it. */
  refused: readonly string[]
  /** Addresses changed in both places: nothing was written, and a person chooses which copy stands. */
  diverged: readonly ScopePath[]
}

/**
 * What the composition answers for a person about the scopes kept before. Each
 * answer takes the addresses it is about; without them, every address the
 * standing is waiting on — the diverged ones, or all of them where the
 * database was lost.
 */
export type Earlier = {
  standing(): Promise<EarlierStanding>
  /** Bring the older copy over what is here, each after an entry that keeps what is here. */
  bringOver(addresses?: readonly ScopePath[]): Promise<BroughtAnswer>
  /** Leave what is here: the older copy is brought over it only once it changes again. */
  leave(addresses?: readonly ScopePath[]): Promise<BroughtAnswer>
}

type Reading = { scopes: BroughtScope[]; seen: Seen; left: Left[] }

const EXTENSION: Readonly<Record<string, string>> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/svg+xml': 'svg', 'image/webp': 'webp',
}

function asNote(value: unknown): Note | undefined {
  const held = value as Note | undefined
  return held && typeof held.seen === 'object' && Array.isArray(held.left) ? held : undefined
}

/** A file name with the extension its bytes' media type has, where the name says otherwise or nothing. */
function withExtension(file: string, mediaType: string): string {
  const extension = EXTENSION[mediaType]
  if (!extension || imageMediaType(file) === mediaType) return file
  const dot = file.lastIndexOf('.')
  const stem = dot > file.lastIndexOf('/') ? file.slice(0, dot) : file
  return `${stem}.${extension}`
}

/** The addresses the key-value storage keeps a scope under, either prefix. */
function pathsIn(storage: KeyValueStorage): ScopePath[] {
  const found = new Set<ScopePath>()
  for (const key of storage.keys()) {
    if (key.startsWith(SCOPE_PREFIX)) found.add(key.slice(SCOPE_PREFIX.length))
    else if (key.startsWith(LEGACY_PROJECT_PREFIX)) found.add(key.slice(LEGACY_PROJECT_PREFIX.length))
  }
  return [...found].sort()
}

type Pictures = { images: ImageEntry[]; bytes: BroughtScope['bytes'][number][]; names: Map<string, ImageName>; left: string[] }

async function picturesOf(snapshot: ScopeSnapshot): Promise<Pictures> {
  const found: Pictures = { images: [], bytes: [], names: new Map(), left: [] }
  const library: unknown = snapshot.imageLibrary
  if (library === undefined) return found
  if (!Array.isArray(library)) return { ...found, left: [''] }
  const taken = new Set<string>()
  for (const image of library as unknown[]) {
    const { file, url } = (image ?? {}) as { file?: unknown; url?: unknown }
    try {
      const read = typeof file === 'string' && typeof url === 'string' ? readDataUrl(url) : undefined
      if (!read) throw new Error('no picture')
      const entry = await imageEntryOf(imageNameOfFile(withExtension(file as string, read.mediaType), taken), read.bytes)
      if (imageEntryRefusal(entry)) throw new Error('not a picture the library holds')
      found.names.set(file as string, entry.name)
      found.images.push(entry)
      found.bytes.push({ contentAddress: entry.contentAddress, bytes: read.bytes })
    } catch {
      found.left.push(typeof file === 'string' ? file : '')
    }
  }
  return found
}

function broughtOf(snapshot: ScopeSnapshot, pictures: Pictures): BroughtScope {
  const content: ScopeContent = {
    model: namesInDocuments(snapshot.model, (file) => pictures.names.get(file)),
    images: pictures.images,
    activeDiagramId: snapshot.activeDiagramId,
    logoLibrary: snapshot.logoLibrary,
    ...(snapshot.kind !== undefined ? { kind: snapshot.kind } : {}),
    ...(snapshot.client !== undefined ? { client: snapshot.client } : {}),
    ...(snapshot.links !== undefined ? { links: snapshot.links } : {}),
  }
  return {
    address: snapshot.path, content, bytes: pictures.bytes,
    ...(snapshot.updatedAt !== undefined ? { updatedAt: snapshot.updatedAt } : {}),
  }
}

/** Every scope the key-value storage holds, as the repositories keep one, and what would not read. */
export async function readEarlier(storage: KeyValueStorage): Promise<Reading> {
  const reading: Reading = { scopes: [], seen: {}, left: [] }
  const store = new WebStorageScopeStore(storage)
  let paths: ScopePath[]
  try {
    paths = pathsIn(storage)
  } catch {
    return reading
  }
  for (const path of paths) {
    try {
      const snapshot = await store.load(path)
      if (!snapshot) throw new Error('did not read')
      const pictures = await picturesOf(snapshot)
      reading.scopes.push(broughtOf(snapshot, pictures))
      reading.seen[snapshot.path] = {
        ...(snapshot.revision !== undefined ? { revision: snapshot.revision } : {}),
        ...(snapshot.updatedAt !== undefined ? { updatedAt: snapshot.updatedAt } : {}),
      }
      if (pictures.left.length > 0) reading.left.push({ path: snapshot.path, why: 'pictures', pictures: pictures.left })
    } catch {
      reading.left.push({ path, why: 'unread' })
    }
  }
  return reading
}

function broughtFrom(reading: Reading, scopes: readonly BroughtScope[], subject: string, asking = false): Brought {
  const note: Note = { seen: reading.seen, left: reading.left, ...(asking ? { asking: true } : {}) }
  return { scopes, subject, safeguard: BEFORE_AGAIN_SUBJECT, note }
}

function markerOn(storage: KeyValueStorage): boolean {
  try {
    return storage.getItem(EARLIER_MARKER) !== null
  } catch {
    return false
  }
}

/** The way this browser's repositories bring in what the key-value storage kept. */
export function bringingEarlier(storage: KeyValueStorage): Bringing {
  return {
    prepare: async (value, fresh) => {
      const note = asNote(value)
      if (!fresh && note?.asking) return undefined
      const reading = await readEarlier(storage)
      if (fresh) {
        const lost = markerOn(storage) && reading.scopes.length > 0
        return lost ? broughtFrom(reading, [], EARLIER_SUBJECT, true) : broughtFrom(reading, reading.scopes, EARLIER_SUBJECT)
      }
      const changed = reading.scopes.filter(({ address }) => !sameValue(note?.seen[address], reading.seen[address]))
      if (changed.length === 0 && sameValue(note?.left, reading.left)) return undefined
      return broughtFrom(reading, changed, AGAIN_SUBJECT)
    },
    started: () => {
      try {
        if (!markerOn(storage)) storage.setItem(EARLIER_MARKER, JSON.stringify({ copied: new Date().toISOString() }))
      } catch {
        // A marker that could not be written costs a question on a lost database, and nothing else.
      }
    },
  }
}

/**
 * A person's answer for some addresses: bring the older copy over what is
 * here (`force`), or leave what is here (`settle`). Only those addresses are
 * marked as looked at, so a change at another is still found at the next start.
 */
function answer(source: Source, storage: KeyValueStorage, bringOver: boolean) {
  return (addresses?: readonly ScopePath[]) => source.bring(async (last) => {
    const note = asNote(last?.note)
    const reading = await readEarlier(storage)
    const wanted = new Set(addresses ?? (note?.asking ? Object.keys(reading.seen) : last?.diverged ?? []))
    const seen: Seen = { ...note?.seen }
    for (const address of wanted) {
      if (reading.seen[address]) seen[address] = reading.seen[address]
      else delete seen[address]
    }
    const asking = addresses !== undefined && note?.asking === true
    return {
      scopes: reading.scopes.filter(({ address }) => wanted.has(address)),
      subject: AGAIN_SUBJECT,
      safeguard: BEFORE_AGAIN_SUBJECT,
      note: { seen, left: reading.left, ...(asking ? { asking: true } : {}) } satisfies Note,
      ...(bringOver ? { force: true } : { settle: [...wanted] }),
    }
  })
}

/** The answers a person gives about the scopes kept before, over the source that brings them. */
export function earlierOf(source: Source, storage: KeyValueStorage): Earlier {
  return {
    standing: async () => {
      const last = await source.lastBrought()
      const note = asNote(last?.note)
      return {
        asking: note?.asking === true, left: note?.left ?? [], refused: last?.refused ?? [], diverged: last?.diverged ?? [],
      }
    },
    bringOver: answer(source, storage, true),
    leave: answer(source, storage, false),
  }
}

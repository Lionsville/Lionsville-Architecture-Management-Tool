// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The history of a folder's scopes, kept in git (ADR-0031 §2; ADR-0008).
 *
 * **An entry is a commit.** A scope's open entry is what its folder holds and
 * its last commit does not; `record` commits it — the scope's own files and
 * none of the scopes filed under it — under the subject given, with a trailer
 * naming the scope (`folderGit.ts`). Never part way through a merge, a
 * rebase, a cherry-pick or a revert, and never on no branch: those it refuses
 * with a key a person can act on. One record is one commit, however many
 * scopes it closes an entry of, which is what a snapshot of the folder has
 * always been; each of them has the commit as an entry.
 *
 * **Which commits are a scope's.** Those whose trailers name it; and, of
 * those with none — an older build's snapshot, a person's own commit — each
 * that changed the scope's own files at an address it has been at, while the
 * header there said the scope's identity (or said none, and the address makes
 * it). A scope made where a removed one was is not handed the removed one's
 * past.
 *
 * **A page is counted from one tip.** The first page answers from the commit
 * the folder is at, and every page after it from that same commit, so a
 * history that grows or merges meanwhile neither repeats an entry nor skips
 * one. A merge is no entry of its own: what it brings in is in the commits it
 * merges, which are listed as themselves.
 *
 * **A thing's history is worked out, not kept.** git is asked only for the
 * commits that changed where a record of that kind could be; of those, the
 * ones whose files for it are the same as just before are passed over by
 * their ids alone, and the rest are read — the scope at the commit and at its
 * parent — and the record compared. A page stops at the entry after its last.
 * What was read is kept to a size (`Lru`). A store with an index answers this
 * by a lookup; the folder reads, and that is its cost to carry.
 *
 * **A label is a tag**, named after the scope's identity and the label's
 * slug, so two scopes may each use one label; a tag so named is that scope's
 * even once the scope is gone. A tag named otherwise — one an older build
 * made for the whole folder, one a person made in a terminal — is the whole
 * folder's: it is read as a label of every scope's entry at its
 * commit, and its slug is taken in every scope. None is ever renamed.
 */
import { imageMediaType } from '../../model/documentImage'
import type { ImageEntry } from '../../model/imageName'
import { ShellError } from '../../platform/errors'
import { fromArrays } from '../../model/normalised'
import { recordsChanged, SCOPE_RECORD, sameRecord, sameValue } from '../../model/recordKey'
import type { RecordKey, RecordKind } from '../../model/recordKey'
import { descriptionPath, isFormatPath, modelListsFrom } from '../../projects/folderFormat'
import type { FolderFile } from '../../projects/folderFormat'
import { isSpacedLabel, labelSlug } from '../../projects/label'
import { isSupersededPath, openScopeFolder } from '../../projects/migrate4to5'
import { fingerprint } from '../../projects/revision'
import { scopeFilePath } from '../../projects/scopePath'
import type { ScopeAddress, ScopeId, ScopeState } from '../../projects/scopeState'
import type {
  EntriesWanted, EntryId, EntryLabelled, HistoryEntry, HistoryPage, HistoryRepository, RecordWanted,
} from '../../ports/HistoryRepository'
import { SCOPE_TRAILER, ownFilesAt, ownerOf, scopeTrailer, subjectLine, trailersOf, within } from './folderGit'
import type { FolderCommit, FolderGit, FolderTag, TreeEntry } from './folderGit'
import { libraryOf, LIBRARY_KEY, rowsOf } from './folderPictures'
import { folderRevision } from './revision'
import { headerOf, identityAt, isScopeId, revisionOf, stateFrom } from './folderScopes'
import type { FolderScopes } from './folderScopes'
import { imageEntryOf } from '../../model/imageEntry'
import { PICTURES } from './imageLibrary'
import { Lru } from './lru'

/** What a record without a subject is called in the commit. English: it is a git message. */
const DEFAULT_SUBJECT = 'Snapshot'

/** How many entries a page holds when nobody says. */
const PAGE = 50

/** How many commits are read at a time while a page fills. */
const CHUNK = 200

/** How many messages are read at a time where only what commits say is asked. */
const MESSAGES = 5000

/** How many of each thing read of the history are kept. */
const KEPT = 256

/** A scope asked about, and every address it has been at. */
type Asked = { id: ScopeId; held: ScopeAddress[] }

/** One entry, found: the commit, the scope, and where the scope was. */
type Found = { commit: FolderCommit; id: ScopeId; address: ScopeAddress }

/** A scope at a commit: which commit, and where the scope was in it. */
type At = { sha: string; address: ScopeAddress }

/** Where in a scope's folder a record of a kind is kept: what git is asked for commits that changed. */
const KIND_PATHS: Record<RecordKind, readonly string[]> = {
  element: ['model.json', 'docs'],
  relation: ['model.json'],
  diagram: ['diagrams', 'scope.json'],
  decision: ['decisions'],
  transition: ['transitions'],
  observation: ['observations'],
  cause: ['observations/causes'],
  solution: ['observations/solutions'],
  experiment: ['observations/experiments'],
  image: ['scope.json', PICTURES],
  scope: ['scope.json', 'model.json'],
}

/** Where a commit could hold a record of a kind, by a path inside the scope's folder: the paths above, more finely. */
const COULD_HOLD: Record<RecordKind, (path: string) => boolean> = {
  element: (path) => path === 'model.json' || path.startsWith('docs/'),
  relation: (path) => path === 'model.json',
  diagram: (path) => path.startsWith('diagrams/') || path === 'scope.json',
  decision: (path) => path.startsWith('decisions/'),
  transition: (path) => path.startsWith('transitions/'),
  observation: (path) => /^observations\/[^/]+$/.test(path),
  cause: (path) => path.startsWith('observations/causes/'),
  solution: (path) => path.startsWith('observations/solutions/'),
  experiment: (path) => path.startsWith('observations/experiments/'),
  image: (path) => path === 'scope.json' || path.startsWith(`${PICTURES}/`),
  scope: (path) => path === 'scope.json' || path === 'model.json',
}

/**
 * Where one record is kept, where the folder says so exactly — an element in
 * the model and its description's own file, a relation in the model — with
 * the files that are its alone; `undefined` for a kind whose file a record's
 * number or name decides, which is asked of the kind's paths instead.
 */
function recordFiles(record: RecordKey): { paths: string[]; own: string[] } | undefined {
  if (record.kind === 'relation') return { paths: ['model.json'], own: [] }
  if (record.kind !== 'element') return undefined
  const page = descriptionPath(record.id)
  return page ? { paths: ['model.json', page], own: [page] } : { paths: ['model.json'], own: [] }
}

/** Whether a path inside a scope's folder could hold the record. */
function couldHold(record: RecordKey, path: string): boolean {
  const exact = recordFiles(record)
  return exact ? exact.paths.includes(path) : COULD_HOLD[record.kind](path)
}

/** The name a scope's labels are kept under: its identity, where a tag's name can hold it. */
function labelSpace(id: ScopeId): string {
  return /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id) ? id : `f-${fingerprint(['labels', id])}`
}

/**
 * Whether a tag is the whole folder's rather than one scope's: one named
 * `<space>/<slug>` is that space's, whether or not a scope answers to it now —
 * a removed scope's labels are nobody else's — and any other is the folder's.
 */
function isFolderWide(tag: FolderTag): boolean {
  return !isSpacedLabel(tag.name)
}

/**
 * An entry's id: its commit, and which scope's entry it is — one commit is an
 * entry of every scope it recorded, and each of those is an entry of its own.
 */
function entryIdOf(sha: string, scope: ScopeId): EntryId {
  return `${sha}.${fingerprint(['entry', scope])}`
}

/** The commit an entry id names for a scope, or `undefined` for one this history did not give that scope. */
function commitOf(entry: EntryId, scope: ScopeId): string | undefined {
  const match = /^([A-Za-z0-9][A-Za-z0-9-]{0,63})\.([a-z0-9]+)$/.exec(entry)
  return match && match[2] === fingerprint(['entry', scope]) ? match[1] : undefined
}

/** The records whose values differ between two states of one scope; everything a state holds, against none. */
function recordsBetween(before: ScopeState | undefined, after: ScopeState): RecordKey[] {
  const empty = { name: '', elements: [], relations: [], diagrams: [] }
  const inModel = recordsChanged(fromArrays(before?.model ?? empty), fromArrays(after.model))
  const was = new Map((before?.images ?? []).map((image) => [image.name, image]))
  const is = new Map(after.images.map((image) => [image.name, image]))
  const images: RecordKey[] = [...new Set([...is.keys(), ...was.keys()])]
    .filter((name) => !sameValue(was.get(name), is.get(name)))
    .map((name) => ({ kind: 'image', id: name }))
  const said = (state: ScopeState | undefined) => [state?.kind, state?.client, state?.links, state?.activeDiagramId, state?.logoLibrary]
  const scope = before === undefined || !sameValue(said(before), said(after))
  return [...inModel, ...images, ...(scope ? [SCOPE_RECORD] : [])]
}

export class FolderHistory implements HistoryRepository {
  readonly id = 'folder (git)'
  /** A scope's state at a commit, by commit, identity, address and whether its pictures were read. */
  private readonly states = new Lru<string, ScopeState | undefined>(KEPT)
  /** A scope's own files at a commit, with their ids. */
  private readonly trees = new Lru<string, TreeEntry[]>(KEPT)
  /** The identity a header said at a commit, by commit and address. */
  private readonly identities = new Lru<string, ScopeId>(KEPT * 4)
  /** A model's records and rows, by the id of the file they were read from. */
  private readonly models = new Lru<string, { elements: readonly unknown[]; relations: readonly unknown[] }>(KEPT)
  /** Where a scope was at a commit, found by walking its first parents. */
  private readonly places = new Lru<string, ScopeAddress | null>(KEPT * 4)

  constructor(private readonly folder: FolderScopes, private readonly git: FolderGit) {}

  record({ scopes, subject }: RecordWanted): Promise<readonly HistoryEntry[]> {
    return this.folder.serial(async () => {
      await this.git.start()
      const ready = await this.git.readiness()
      if (ready !== 'ready') throw new ShellError(ready === 'midway' ? 'shell.historyMidway' : 'shell.historyDetached')
      const { nodes } = await this.folder.walk()
      const addresses = nodes.map((node) => node.address)
      const owned = new Map<ScopeAddress, string[]>()
      for (const { path } of await this.git.changes()) {
        const owner = ownerOf(path, addresses)
        if (owner !== undefined) owned.set(owner, [...owned.get(owner) ?? [], path])
      }
      const wanted = scopes ? new Set(scopes) : undefined
      const closing = nodes.filter((node) => (!wanted || wanted.has(node.id)) && owned.has(node.address))
      if (closing.length === 0) return []
      const message = [
        subjectLine(subject ?? '') || DEFAULT_SUBJECT, '', ...closing.map((node) => scopeTrailer(node.id, node.address)),
      ].join('\n')
      const sha = await this.git.commit(closing.flatMap((node) => owned.get(node.address)!), message)
      if (!sha) return []
      const [commit] = await this.git.log({ tip: sha, limit: 1 })
      const tags = await this.git.tags()
      return closing.map((node) => this.entryOf({ commit, id: node.id, address: node.address }, tags))
    })
  }

  private entryOf({ commit, id }: Found, tags: readonly FolderTag[]): HistoryEntry {
    const mine = `${labelSpace(id)}/`
    const labels = tags
      .filter((tag) => tag.sha === commit.sha && (tag.name.startsWith(mine) || isFolderWide(tag)))
      .map((tag) => tag.message || tag.name)
    return { id: entryIdOf(commit.sha, id), scope: id, at: commit.at, by: commit.author, subject: commit.subject, labels }
  }

  /** Every commit whose message holds a text, its message alone, in chunks, to the first commit there is. */
  private async grep(text: string): Promise<FolderCommit[]> {
    const found: FolderCommit[] = []
    for (let skip = 0; ; skip += MESSAGES) {
      const commits = await this.git.log({ grep: text, limit: MESSAGES, skip, bare: true })
      found.push(...commits)
      if (commits.length < MESSAGES) return found
    }
  }

  /** The scopes asked about, each with every address it has been at: where it is, and where its entries say it was. */
  private async asked(ids: readonly ScopeId[]): Promise<{ asked: Asked[]; addresses: ScopeAddress[] }> {
    const { nodes } = await this.folder.walk()
    const asked: Asked[] = []
    for (const id of [...new Set(ids)]) {
      const held = new Set<ScopeAddress>()
      const here = nodes.find((node) => node.id === id)
      if (here) held.add(here.address)
      for (const commit of await this.grep(`${SCOPE_TRAILER}: ${id} `)) {
        const address = trailersOf(commit.message).get(id)
        if (address !== undefined) held.add(address)
      }
      asked.push({ id, held: [...held] })
    }
    return { asked, addresses: nodes.map((node) => node.address) }
  }

  /** The identity the header at an address said at a commit: its own where it had one, and the one its address makes where not. */
  private async identityAt(sha: string, address: ScopeAddress): Promise<ScopeId> {
    const key = `${sha}\u0000${address}`
    const known = this.identities.get(key)
    if (known !== undefined) return known
    const [file] = await this.git.readAt(sha, [scopeFilePath(address, 'scope.json')])
    const declared = file && 'text' in file ? headerOf(file.text)?.['id'] : undefined
    const id = isScopeId(declared) ? declared : identityAt(address)
    this.identities.set(key, id)
    return id
  }

  /**
   * The scopes a commit is an entry of, of those asked: the ones its trailers
   * name, where it has any; otherwise each whose own files it changed at an
   * address the scope has been at, while the header there said who it is.
   */
  private async membersOf(commit: FolderCommit, asked: readonly Asked[], addresses: readonly ScopeAddress[]): Promise<Found[]> {
    const trailers = trailersOf(commit.message)
    if (trailers.size) {
      return asked.flatMap(({ id }) => {
        const address = trailers.get(id)
        return address === undefined ? [] : [{ commit, id, address }]
      })
    }
    const found: Found[] = []
    for (const { id, held } of asked) {
      for (const at of held) {
        if (!commit.changed.some((path) => ownerOf(path, [...addresses, at]) === at)) continue
        if (await this.identityAt(commit.sha, at) !== id) continue
        found.push({ commit, id, address: at })
        break
      }
    }
    return found
  }

  /** The commits git lists for a question, from a tip, from the one at `from` on, each with the entries it is. */
  private async *listed(
    asked: readonly Asked[], addresses: readonly ScopeAddress[], paths: readonly string[] | undefined, tip: string, from: number,
  ): AsyncGenerator<{ index: number; members: Found[] }> {
    for (let at = from; ; at += CHUNK) {
      const commits = await this.git.log({ ...(paths ? { paths } : {}), tip, skip: at, limit: CHUNK })
      for (const [n, commit] of commits.entries()) yield { index: at + n, members: await this.membersOf(commit, asked, addresses) }
      if (commits.length < CHUNK) return
    }
  }

  async entries({ scopes, record, limit = PAGE, after }: EntriesWanted): Promise<HistoryPage> {
    const size = Math.max(1, limit)
    const cursor = after === undefined ? undefined : cursorOf(after)
    if (after !== undefined && !cursor) return { entries: [] }
    const { asked, addresses } = await this.asked(scopes)
    const held = [...new Set(asked.flatMap((one) => one.held))]
    const tip = cursor?.tip ?? await this.git.head()
    if (!tip || held.length === 0) return { entries: [] }
    const paths = record
      ? held.flatMap((address) => (recordFiles(record)?.paths ?? KIND_PATHS[record.kind]).map((path) => scopeFilePath(address, path)))
      : held.includes('') ? undefined : held
    const page: { found: Found; index: number; k: number }[] = []
    fill: for await (const { index, members } of this.listed(asked, addresses, paths, tip, cursor?.index ?? 0)) {
      for (const [k, found] of members.entries()) {
        if (cursor && index === cursor.index && k < cursor.k) continue
        if (record && !await this.touches(found, record, asked, addresses)) continue
        page.push({ found, index, k })
        if (page.length > size) break fill
      }
    }
    const tags = await this.git.tags()
    const entries = page.slice(0, size).map(({ found }) => this.entryOf(found, tags))
    const next = page[size]
    return next ? { entries, next: `${tip}:${next.index}:${next.k}` } : { entries }
  }

  /**
   * One record's row in a scope's model, as the folder format reads it, from
   * the file by its id — read once per version of the file — or `undefined`
   * where there is no such file, or it holds no such row.
   */
  private async rowIn(blob: string | undefined, list: 'elements' | 'relations', id: string): Promise<unknown> {
    if (!blob) return undefined
    let lists = this.models.get(blob)
    if (!lists) {
      lists = modelListsFrom((await this.git.texts([blob]))[blob]) ?? { elements: [], relations: [] }
      this.models.set(blob, lists)
    }
    return (lists[list] as readonly { id: string }[]).find((row) => row.id === id)
  }

  /**
   * Whether a commit changed an element or a relation, from what the log said
   * it changed alone — the ids of what each file held before and after — where
   * that is enough: a scope that has been at one address, whose header the
   * commit did not change. `undefined` where it is not enough.
   */
  private async touchesByLog(found: Found, record: RecordKey, one: Asked): Promise<boolean | undefined> {
    const exact = recordFiles(record)
    if (!exact || one.held.length !== 1 || !found.commit.blobs || found.commit.parents.length === 0) return undefined
    const raw = new Map(Object.entries(found.commit.blobs).flatMap(([path, ids]) => {
      const inside = within(found.address, path)
      return inside === undefined ? [] : [[inside, ids] as const]
    }))
    if (raw.has('scope.json')) return undefined
    if (exact.own.some((path) => raw.has(path))) return true
    const model = raw.get('model.json')
    if (!model) return false
    const list = record.kind === 'element' ? 'elements' : 'relations'
    return !sameValue(await this.rowIn(model[0], list, record.id), await this.rowIn(model[1], list, record.id))
  }

  /** A scope's own files at a commit, with the ids of what they held. */
  private async ownTree(sha: string, address: ScopeAddress): Promise<TreeEntry[]> {
    const key = `${sha}\u0000${address}`
    const known = this.trees.get(key)
    if (known) return known
    const own = ownFilesAt(address, await this.git.treeAt(sha, address))
    this.trees.set(key, own)
    return own
  }

  /**
   * Where a scope was at a commit: its one address, where it has only been at
   * one; otherwise where its nearest entry along the commit's first parents
   * says. `undefined` where the scope was not there, or another was.
   */
  private async placeAt(sha: string, one: Asked, addresses: readonly ScopeAddress[]): Promise<At | undefined> {
    const key = `${sha}\u0000${one.id}`
    let address = this.places.get(key)
    if (address === undefined) {
      address = one.held.length === 1 ? one.held[0] : null
      if (one.held.length > 1) {
        search: for (let skip = 0; ; skip += CHUNK) {
          const commits = await this.git.log({ paths: one.held.includes('') ? undefined : one.held, tip: sha, skip, limit: CHUNK, firstParent: true })
          for (const commit of commits) {
            const [found] = await this.membersOf(commit, [one], addresses)
            if (found) {
              address = found.address
              break search
            }
          }
          if (commits.length < CHUNK) break
        }
      }
      this.places.set(key, address)
    }
    if (address === null || await this.identityAt(sha, address) !== one.id) return undefined
    return (await this.ownTree(sha, address)).some((file) => file.path === 'scope.json') ? { sha, address } : undefined
  }

  /**
   * Whether an entry's steps changed a record: nothing where the files it
   * could be in are the same, by their ids, as at the commit before; yes where
   * a file that is the record's alone changed; otherwise the scope read at
   * both, and the record compared.
   */
  private async touches(found: Found, record: RecordKey, asked: readonly Asked[], addresses: readonly ScopeAddress[]): Promise<boolean> {
    const could = found.commit.changed.some((path) => {
      const inside = within(found.address, path)
      return inside !== undefined && couldHold(record, inside)
    })
    if (!could) return false
    const one = asked.find((scope) => scope.id === found.id)!
    const quick = await this.touchesByLog(found, record, one)
    if (quick !== undefined) return quick
    const parent = found.commit.parents[0]
    const before = parent === undefined ? undefined : await this.placeAt(parent, one, addresses)
    const blobs = async (at: At | undefined) => new Map(at
      ? (await this.ownTree(at.sha, at.address)).filter((file) => couldHold(record, file.path)).map((file) => [file.path, file.blob])
      : [])
    const [now, was] = [await blobs({ sha: found.commit.sha, address: found.address }), await blobs(before)]
    const keys = new Set([...now.keys(), ...was.keys()])
    if ([...keys].every((path) => now.get(path) === was.get(path))) return false
    if ((recordFiles(record)?.own ?? []).some((path) => now.get(path) !== was.get(path))) return true
    if (record.kind === 'element' || record.kind === 'relation') {
      const list = record.kind === 'element' ? 'elements' : 'relations'
      return !sameValue(await this.rowIn(now.get('model.json'), list, record.id), await this.rowIn(was.get('model.json'), list, record.id))
    }
    const pictures = record.kind === 'image'
    const after = await this.stateOf(found.commit.sha, found.id, found.address, pictures)
    if (!after) return false
    const prior = before ? await this.stateOf(before.sha, found.id, before.address, pictures) : undefined
    return recordsBetween(prior, after).some((changed) => sameRecord(changed, record))
  }

  /**
   * A scope as it was at a commit. Its pictures' entries are read where
   * `pictures` asks, and only then: describing a picture no row names means
   * reading it, and only a picture's own history needs that.
   */
  private async stateOf(sha: string, id: ScopeId, address: ScopeAddress, pictures: boolean): Promise<ScopeState | undefined> {
    const key = `${sha}\u0000${id}\u0000${address}\u0000${pictures}`
    if (this.states.has(key)) return structuredClone(this.states.get(key))
    const own = await this.ownTree(sha, address)
    const format = own.map((file) => file.path)
      .filter((path) => (isFormatPath(path) || isSupersededPath(path)) && !path.startsWith(`${PICTURES}/`))
    const files: FolderFile[] = (await this.git.readAt(sha, format.map((path) => scopeFilePath(address, path))))
      .map((file) => ({ ...file, path: within(address, file.path)! }))
    const snapshot = openScopeFolder(files, address)
    let state: ScopeState | undefined
    if (snapshot) {
      const kept = own.map((file) => file.path)
        .filter((path) => path.startsWith(`${PICTURES}/`) && imageMediaType(path) !== undefined)
        .map((path) => ({ file: path.slice(PICTURES.length + 1) }))
        .filter(({ file }) => !file.split('/').some((segment) => segment.startsWith('.')))
      const library = await libraryOf(rowsOf(snapshot.carried?.[LIBRARY_KEY]), {
        files: kept,
        describe: async (file, name): Promise<ImageEntry | undefined> => {
          if (!pictures) return undefined
          const [held] = await this.git.readAt(sha, [scopeFilePath(address, `${PICTURES}/${file.file}`)])
          if (!held) return undefined
          return imageEntryOf(name, 'bytes' in held ? held.bytes : new TextEncoder().encode(held.text))
        },
      })
      const scopeText = files.find((file) => file.path === 'scope.json')
      const header = headerOf(scopeText && 'text' in scopeText ? scopeText.text : undefined) ?? {}
      const node = { id, address, header, summary: { path: address, name: snapshot.model.name, diagrams: 0, children: [] } }
      state = stateFrom(node, snapshot, library, revisionOf(address, folderRevision(files), library))
    }
    this.states.set(key, state)
    return structuredClone(state)
  }

  /** An entry of a scope, found by its id; `undefined` where the scope has no such entry. */
  private async entry(scope: ScopeId, entry: EntryId): Promise<Found | undefined> {
    const sha = commitOf(entry, scope)
    if (sha === undefined) return undefined
    const [commit] = await this.git.log({ tip: sha, limit: 1 }).catch(() => [])
    if (!commit || commit.sha !== sha) return undefined
    const { asked, addresses } = await this.asked([scope])
    const [found] = await this.membersOf(commit, asked, addresses)
    return found
  }

  async stateAt(scope: ScopeId, entry: EntryId): Promise<ScopeState | undefined> {
    const held = await this.entry(scope, entry)
    return held ? this.stateOf(held.commit.sha, scope, held.address, true) : undefined
  }

  label(scope: ScopeId, entry: EntryId, name: string): Promise<EntryLabelled> {
    return this.folder.serial(async () => {
      const held = await this.entry(scope, entry)
      if (!held) return 'gone'
      const slug = labelSlug(name)
      if (!slug) return 'unnamed'
      const mine = `${labelSpace(scope)}/${slug}`
      const tags = await this.git.tags()
      const taken = tags.some((tag) => tag.name === mine
        || (isFolderWide(tag) && labelSlug(tag.name) === slug))
      if (taken) return 'exists'
      return this.git.tag(held.commit.sha, mine, name.trim())
    })
  }
}

/** Where a page starts: the tip the first page was counted from, the commit it had reached, and how many of its entries were taken. */
type Cursor = { tip: string; index: number; k: number }

function cursorOf(after: string): Cursor | undefined {
  const match = /^([A-Za-z0-9][A-Za-z0-9-]{0,63}):(\d{1,9}):(\d{1,4})$/.exec(after)
  return match ? { tip: match[1], index: Number(match[2]), k: Number(match[3]) } : undefined
}

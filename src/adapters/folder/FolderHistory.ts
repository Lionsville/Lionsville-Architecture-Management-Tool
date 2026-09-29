// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The history of a folder's scopes, kept in git (ADR-0031 §2; ADR-0008).
 *
 * **An entry is a commit.** A scope's open entry is what its folder holds and
 * its last commit does not; `record` commits it — the scope's own files and
 * none of the scopes filed under it — under the subject given, with a trailer
 * naming the scope (`folderGit.ts`). One record is one commit, however many
 * scopes it closes an entry of, which is what a snapshot of the folder has
 * always been; each of them has the commit as an entry.
 *
 * **A thing's history is worked out, not kept.** The commits of a scope are
 * found by the paths it has been at; which of them changed one record is
 * read off the scope's state at each and at the entry before it, where the
 * files a commit changed could hold that record. A store with an index answers
 * this by a lookup; the folder reads, and that is its cost to carry.
 *
 * **A label is a tag**, named after the scope's identity and the label's
 * slug, so two scopes may each use one label. A tag named otherwise — one an
 * older build made for the whole folder, one a person made in a terminal — is
 * the whole folder's: it is read as a label of every scope's entry at its
 * commit, and its slug is taken in every scope. None is ever renamed.
 */
import { imageMediaType } from '../../model/documentImage'
import type { ImageEntry } from '../../model/imageName'
import { fromArrays } from '../../model/normalised'
import { recordsChanged, SCOPE_RECORD, sameRecord, sameValue } from '../../model/recordKey'
import type { RecordKey, RecordKind } from '../../model/recordKey'
import { isFormatPath } from '../../projects/folderFormat'
import type { FolderFile } from '../../projects/folderFormat'
import { labelSlug } from '../../projects/label'
import { isSupersededPath, openScopeFolder } from '../../projects/migrate4to5'
import { fingerprint } from '../../projects/revision'
import { scopeFilePath } from '../../projects/scopePath'
import type { ScopeAddress, ScopeId, ScopeState } from '../../projects/scopeState'
import type {
  EntriesWanted, EntryId, EntryLabelled, HistoryEntry, HistoryPage, HistoryRepository, RecordWanted,
} from '../../ports/HistoryRepository'
import { SCOPE_TRAILER, ownFilesAt, ownerOf, scopeTrailer, subjectLine, trailersOf, within } from './folderGit'
import type { FolderCommit, FolderGit, FolderTag } from './folderGit'
import { libraryOf, LIBRARY_KEY, rowsOf } from './folderPictures'
import { folderRevision } from './revision'
import { headerOf, revisionOf, stateFrom } from './folderScopes'
import type { FolderScopes } from './folderScopes'
import { imageEntryOf, PICTURES } from './imageLibrary'

/** What a record without a subject is called in the commit. English: it is a git message. */
const DEFAULT_SUBJECT = 'Snapshot'

/** How many entries a page holds when nobody says. */
const PAGE = 50

/** How many commits are read at a time while a page fills. */
const CHUNK = 200

/** A scope asked about, and every address it has been at. */
type Asked = { id: ScopeId; held: ScopeAddress[] }

/** One entry, found: the commit, the scope, and where the scope was. */
type Found = { commit: FolderCommit; id: ScopeId; address: ScopeAddress }

/** Where a commit could hold a record of a kind, by a path inside the scope's folder. */
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

/** The name a scope's labels are kept under: its identity, where a tag's name can hold it. */
function labelSpace(id: ScopeId): string {
  return /^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id) ? id : `f-${fingerprint(['labels', id])}`
}

/** Whether a tag is the whole folder's rather than one scope's. */
function isFolderWide(tag: FolderTag, spaces: ReadonlySet<string>): boolean {
  const at = tag.name.indexOf('/')
  return at < 0 || !spaces.has(tag.name.slice(0, at))
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
  /** States read at a commit, by commit and scope: a commit does not change. */
  private readonly states = new Map<string, ScopeState | undefined>()

  constructor(private readonly folder: FolderScopes, private readonly git: FolderGit) {}

  record({ scopes, subject }: RecordWanted): Promise<readonly HistoryEntry[]> {
    return this.folder.serial(async () => {
      await this.git.start()
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
      const [commit] = await this.git.log({ from: sha, limit: 1 })
      const tags = await this.git.tags()
      const spaces = new Set(nodes.map((node) => labelSpace(node.id)))
      return closing.map((node) => this.entryOf({ commit, id: node.id, address: node.address }, tags, spaces))
    })
  }

  private entryOf({ commit, id }: Found, tags: readonly FolderTag[], spaces: ReadonlySet<string>): HistoryEntry {
    const mine = `${labelSpace(id)}/`
    const labels = tags
      .filter((tag) => tag.sha === commit.sha && (tag.name.startsWith(mine) || isFolderWide(tag, spaces)))
      .map((tag) => tag.message || tag.name)
    return { id: entryIdOf(commit.sha, id), scope: id, at: commit.at, by: commit.author, subject: commit.subject, labels }
  }

  /** The scopes asked about, each with every address it has been at: where it is, and where its entries say it was. */
  private async asked(ids: readonly ScopeId[]): Promise<{ asked: Asked[]; addresses: ScopeAddress[]; spaces: Set<string> }> {
    const { nodes } = await this.folder.walk()
    const asked: Asked[] = []
    for (const id of [...new Set(ids)]) {
      const held = new Set<ScopeAddress>()
      const here = nodes.find((node) => node.id === id)
      if (here) held.add(here.address)
      const said = await this.git.log({ grep: `${SCOPE_TRAILER}: ${id} `, limit: 10_000 }).catch(() => [])
      for (const commit of said) {
        const address = trailersOf(commit.message).get(id)
        if (address !== undefined) held.add(address)
      }
      asked.push({ id, held: [...held] })
    }
    return { asked, addresses: nodes.map((node) => node.address), spaces: new Set(nodes.map((node) => labelSpace(node.id))) }
  }

  /**
   * The scopes a commit is an entry of, of those asked: the ones its trailers
   * name, where it has any; otherwise each whose own files it changed at an
   * address the scope has been at.
   */
  private membersOf(commit: FolderCommit, asked: readonly Asked[], addresses: readonly ScopeAddress[]): Found[] {
    const trailers = trailersOf(commit.message)
    if (trailers.size) {
      return asked.flatMap(({ id }) => {
        const address = trailers.get(id)
        return address === undefined ? [] : [{ commit, id, address }]
      })
    }
    return asked.flatMap(({ id, held }) => {
      const address = held.find((at) => commit.changed.some((path) => ownerOf(path, [...addresses, at]) === at))
      return address === undefined ? [] : [{ commit, id, address }]
    })
  }

  /** Every entry of the scopes asked, newest first, from a cursor on; as many as `enough`, or all. */
  private async found(asked: readonly Asked[], addresses: readonly ScopeAddress[], from: Cursor | undefined, enough: number): Promise<Found[]> {
    const held = [...new Set(asked.flatMap((one) => one.held))]
    if (held.length === 0) return []
    const paths = held.includes('') ? undefined : held
    const found: Found[] = []
    let start = from?.sha
    let skip = from?.skip ?? 0
    let continuing = false
    for (;;) {
      const commits = await this.git.log({ ...(paths ? { paths } : {}), limit: CHUNK, ...(start ? { from: start } : {}) }).catch(() => [])
      // A chunk after the first starts at the last commit of the one before, which is read already.
      for (const commit of continuing ? commits.slice(1) : commits) {
        found.push(...this.membersOf(commit, asked, addresses).slice(skip))
        skip = 0
        if (found.length >= enough) return found
      }
      if (commits.length < CHUNK) return found
      start = commits[commits.length - 1].sha
      continuing = true
    }
  }

  async entries({ scopes, record, limit = PAGE, after }: EntriesWanted): Promise<HistoryPage> {
    const size = Math.max(1, limit)
    const cursor = after === undefined ? undefined : cursorOf(after)
    if (after !== undefined && !cursor) return { entries: [] }
    const { asked, addresses, spaces } = await this.asked(scopes)
    const tags = await this.git.tags().catch(() => [])
    const listed = (found: readonly Found[]) => found.map((one) => this.entryOf(one, tags, spaces))
    if (record) {
      const touched = await this.touching(await this.found(asked, addresses, undefined, Infinity), record)
      const at = cursor ? touched.findIndex((one) => one.commit.sha === cursor.sha) : 0
      if (at < 0) return { entries: [] }
      const start = at + (cursor?.skip ?? 0)
      const page = touched.slice(start, start + size)
      const next = touched[start + size]
      if (!next) return { entries: listed(page) }
      const first = touched.findIndex((one) => one.commit.sha === next.commit.sha)
      return { entries: listed(page), next: `${next.commit.sha}:${start + size - first}` }
    }
    const found = await this.found(asked, addresses, cursor, size + 1)
    if (found.length <= size) return { entries: listed(found) }
    const next = found[size]
    const taken = found.slice(0, size).filter((one) => one.commit.sha === next.commit.sha).length
    const before = cursor && cursor.sha === next.commit.sha ? cursor.skip : 0
    return { entries: listed(found.slice(0, size)), next: `${next.commit.sha}:${taken + before}` }
  }

  /** The entries, of those found, whose steps changed a record: read off each state and the one before it in its scope. */
  private async touching(every: readonly Found[], record: RecordKey): Promise<Found[]> {
    const touched: Found[] = []
    for (const [at, one] of every.entries()) {
      const could = one.commit.changed.some((path) => {
        const inside = within(one.address, path)
        return inside !== undefined && COULD_HOLD[record.kind](inside)
      })
      if (!could) continue
      const before = every.slice(at + 1).find((other) => other.id === one.id)
      const now = await this.stateOf(one)
      if (!now) continue
      const was = before ? await this.stateOf(before) : undefined
      if (recordsBetween(was, now).some((changed) => sameRecord(changed, record))) touched.push(one)
    }
    return touched
  }

  /** A scope as it was at one of its entries. */
  private async stateOf({ commit, id, address }: Found): Promise<ScopeState | undefined> {
    const key = `${commit.sha}\u0000${id}`
    if (this.states.has(key)) return structuredClone(this.states.get(key))
    const tree = await this.git.treeAt(commit.sha, address)
    const own = ownFilesAt(address, tree)
    const format = own.filter((path) => (isFormatPath(path) || isSupersededPath(path)) && !path.startsWith(`${PICTURES}/`))
    const files: FolderFile[] = (await this.git.readAt(commit.sha, format.map((path) => scopeFilePath(address, path))))
      .map((file) => ({ ...file, path: within(address, file.path)! }))
    const snapshot = openScopeFolder(files, address)
    let state: ScopeState | undefined
    if (snapshot) {
      const pictures = own
        .filter((path) => path.startsWith(`${PICTURES}/`) && imageMediaType(path) !== undefined)
        .map((path) => ({ file: path.slice(PICTURES.length + 1) }))
        .filter(({ file }) => !file.split('/').some((segment) => segment.startsWith('.')))
      const library = await libraryOf(rowsOf(snapshot.carried?.[LIBRARY_KEY]), {
        files: pictures,
        describe: async (file, name): Promise<ImageEntry | undefined> => {
          const [held] = await this.git.readAt(commit.sha, [scopeFilePath(address, `${PICTURES}/${file.file}`)])
          if (!held) return undefined
          return imageEntryOf(name, 'bytes' in held ? held.bytes : new TextEncoder().encode(held.text))
        },
      })
      const scopeText = files.find((file) => file.path === 'scope.json')
      const header = headerOf(scopeText && 'text' in scopeText ? scopeText.text : undefined) ?? {}
      const node = { id, address, header, summary: { path: address, name: snapshot.model.name, diagrams: 0, children: [] } }
      state = stateFrom(node, snapshot, library, revisionOf(address, folderRevision(files), pictures))
    }
    this.states.set(key, state)
    return structuredClone(state)
  }

  /** An entry of a scope, found by its id; `undefined` where the scope has no such entry. */
  private async entry(scope: ScopeId, entry: EntryId): Promise<{ found: Found; spaces: Set<string> } | undefined> {
    const sha = commitOf(entry, scope)
    if (sha === undefined) return undefined
    const [commit] = await this.git.log({ from: sha, limit: 1 }).catch(() => [])
    if (!commit || commit.sha !== sha) return undefined
    const { asked, addresses, spaces } = await this.asked([scope])
    const [found] = this.membersOf(commit, asked, addresses)
    return found ? { found, spaces } : undefined
  }

  async stateAt(scope: ScopeId, entry: EntryId): Promise<ScopeState | undefined> {
    const held = await this.entry(scope, entry)
    return held ? this.stateOf(held.found) : undefined
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
        || (isFolderWide(tag, held.spaces) && labelSlug(tag.name) === slug))
      if (taken) return 'exists'
      return this.git.tag(held.found.commit.sha, mine, name.trim())
    })
  }
}

/** Where a page starts: a commit, and how many of its entries the pages before took. */
type Cursor = { sha: string; skip: number }

function cursorOf(after: string): Cursor | undefined {
  const match = /^([A-Za-z0-9][A-Za-z0-9-]{0,63}):(\d{1,4})$/.exec(after)
  return match ? { sha: match[1], skip: Number(match[2]) } : undefined
}

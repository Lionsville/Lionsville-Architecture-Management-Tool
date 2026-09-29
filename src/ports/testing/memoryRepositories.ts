// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The five repositories in memory, written for the contract suites and for
 * nothing else.
 *
 * The suites need something to run against before any real implementation
 * exists, and something that shows each clause can be met at all: this is
 * the smallest thing that meets every one of them honestly — identities
 * minted and kept through moves, a revision per change, an index with a log
 * of what changed, entries with their states, bytes by content address. It
 * is test support, not a product adapter: it sits beside the suites, keeps
 * nothing anybody would want back, and scans where a real implementation
 * would look up.
 *
 * It copies on the way in and on the way out, for the reason the in-memory
 * stores always have: a fake that hands out its own objects lets every
 * accidentally-shared-object bug through, and the suites check for exactly
 * that.
 */
import { labelSlug } from '../../platform/history'
import { imageMediaType } from '../../model/documentImage'
import { contentAddressOf, foldersUnder, imageFolderOf, imageNameRefusal } from '../../model/imageName'
import type { ContentAddress, ImageEntry, ImageFolder, ImageName } from '../../model/imageName'
import { SCOPE_RECORD, sameRecord } from '../../model/recordKey'
import type { RecordKey } from '../../model/recordKey'
import { ancestorScopes, isSafeScopePath, isWithinScope, ROOT_SCOPE, scopePathLabel } from '../../projects/scopePath'
import { applySteps, emptyContent } from '../../projects/scopeState'
import type { Revision, ScopeAddress, ScopeContent, ScopeId, ScopeState } from '../../projects/scopeState'
import { patchSettings } from '../../projects/settings'
import type { Settings, SettingsPatch } from '../../projects/settings'
import type { EntriesWanted, EntryId, EntryLabelled, HistoryPage, HistoryRepository } from '../HistoryRepository'
import type { ImageBytes, ImageListing, ImageRepository, Put } from '../ImageRepository'
import type { IndexChanges, IndexedScope, IndexRead, OrganisationIndex } from '../OrganisationIndex'
import type { RepositoriesUnderTest } from '../Repositories.contract'
import type {
  Applied, Created, Moved, NewScope, Refused, Removed, ScopeNode, ScopeRepository, ScopeTree, StepsFor,
} from '../ScopeRepository'
import type { SettingsOf, SettingsRepository } from '../SettingsRepository'

type Kept = {
  id: ScopeId
  address: ScopeAddress
  content: ScopeContent
  revision: Revision
  updatedAt?: string
  /** Every step id this scope has applied, so one sent twice lands once. */
  applied: Set<string>
  unreadable?: string[]
  /** What changed since the last entry: the records written, and when the last change was made. */
  pending?: { records: RecordKey[] | undefined; at: number }
}

type Entry = {
  seq: number
  id: EntryId
  scope: ScopeId
  at: number
  subject?: string
  labels: string[]
  records: readonly RecordKey[] | undefined
  state: ScopeState
}

/** The index's log: each revision it answered, and what changed to get there. */
type IndexStep = { revision: Revision; changed: Set<ScopeId>; removed: Set<ScopeId> }

const PAGE = 50

class Memory {
  private minted = 0
  private readonly kept = new Map<ScopeId, Kept>()
  private treeRevision: Revision
  private readonly indexLog: IndexStep[] = []
  private readonly entries: Entry[] = []
  private entrySeq = 0
  private readonly stored = new Map<ScopeId, Map<ContentAddress, ImageBytes>>()
  private readonly settingsHeld = new Map<string, Settings>()

  constructor() {
    this.make(ROOT_SCOPE, emptyContent(''))
    this.treeRevision = this.mint('tree')
    this.indexLog.push({ revision: this.mint('index'), changed: new Set(), removed: new Set() })
  }

  private mint(prefix: string): string {
    this.minted += 1
    return `${prefix}-${this.minted}`
  }

  private make(address: ScopeAddress, content: ScopeContent): Kept {
    const kept: Kept = {
      id: this.mint('scope'), address, content: structuredClone(content), revision: this.mint('revision'),
      applied: new Set(), pending: { records: [SCOPE_RECORD], at: Date.now() },
    }
    this.kept.set(kept.id, kept)
    return kept
  }

  private at(address: ScopeAddress): Kept | undefined {
    return [...this.kept.values()].find((kept) => kept.address === address)
  }

  private within(address: ScopeAddress): Kept[] {
    return [...this.kept.values()].filter((kept) => isWithinScope(kept.address, address))
  }

  /** The ancestors of an address that are not there, made, root side first. */
  private makeAncestors(address: ScopeAddress): Kept[] {
    const made: Kept[] = []
    for (const above of ancestorScopes(address).reverse()) {
      if (!this.at(above)) made.push(this.make(above, emptyContent(scopePathLabel(above))))
    }
    return made
  }

  private indexChanged(changed: Iterable<ScopeId>, removed: Iterable<ScopeId> = []): void {
    this.indexLog.push({ revision: this.mint('index'), changed: new Set(changed), removed: new Set(removed) })
  }

  private stateOf(kept: Kept): ScopeState {
    return structuredClone({
      ...kept.content, id: kept.id, address: kept.address, revision: kept.revision,
      ...(kept.updatedAt ? { updatedAt: kept.updatedAt } : {}),
      ...(kept.unreadable ? { unreadable: kept.unreadable } : {}),
    })
  }

  // --- scopes ----------------------------------------------------------------

  readonly scopes: ScopeRepository = {
    id: 'memory (contract)',
    tree: () => Promise.resolve(this.tree()),
    state: (scope) => {
      const kept = this.kept.get(scope)
      return Promise.resolve(kept ? this.stateOf(kept) : undefined)
    },
    apply: (work) => Promise.resolve(this.apply(work)),
    create: (at, scope) => Promise.resolve(this.create(at, scope)),
    move: (scope, to, expects) => Promise.resolve(this.move(scope, to, expects)),
    remove: (scope, expects) => Promise.resolve(this.remove(scope, expects)),
  }

  private tree(): ScopeTree {
    const node = (kept: Kept): ScopeNode => {
      const { model } = kept.content
      const parent = ancestorScopes(kept.address).map((address) => this.at(address)).find(Boolean)
      return structuredClone({
        id: kept.id, address: kept.address, name: model.name, diagrams: model.diagrams.length,
        ...(parent ? { parent: parent.id } : {}),
        ...(kept.content.kind !== undefined ? { kind: kept.content.kind } : {}),
        ...(kept.content.client !== undefined ? { client: kept.content.client } : {}),
        ...(model.description !== undefined ? { description: model.description } : {}),
        ...(kept.content.links !== undefined ? { links: kept.content.links } : {}),
        ...(kept.updatedAt ? { updatedAt: kept.updatedAt } : {}),
        children: [...this.kept.values()]
          .filter((child) => child.address !== kept.address && ancestorScopes(child.address)
            .find((address) => this.at(address)) === kept.address)
          .sort((one, other) => (one.address < other.address ? -1 : 1))
          .map(node),
      })
    }
    return { revision: this.treeRevision, root: node(this.at(ROOT_SCOPE)!) }
  }

  /** What a node says, for knowing whether a step changed the tree. */
  private summary(content: ScopeContent): string {
    const { model, kind, client, links } = content
    return JSON.stringify([model.name, model.description, model.diagrams.length, kind, client, links])
  }

  private apply(work: readonly StepsFor[]): Applied | Refused {
    const planned = new Map<ScopeId, { kept: Kept; content: ScopeContent; changed: boolean; records: RecordKey[] | undefined }>()
    for (const { scope, steps, expects } of work) {
      const kept = this.kept.get(scope)
      if (!kept) return { refused: 'shell.scopeGone', scope }
      if (kept.unreadable) return { refused: 'shell.unreadableNotSaved', scope }
      const fresh = steps.filter((one) => !kept.applied.has(one.stepId))
      if (fresh.length === 0) continue
      if (expects !== undefined && expects !== kept.revision) return { refused: 'shell.scopeMoved', scope }
      const before = planned.get(scope)
      const result = applySteps(before?.content ?? kept.content, fresh)
      if (!result.ok) return { refused: result.refused, scope, stepId: result.stepId }
      planned.set(scope, {
        kept, content: result.content, changed: (before?.changed ?? false) || result.changed,
        records: merge(before ? before.records : [], result.records),
      })
    }
    this.commit(work, planned)
    return { revisions: work.map(({ scope }) => this.kept.get(scope)!.revision) }
  }

  private commit(
    work: readonly StepsFor[],
    planned: Map<ScopeId, { kept: Kept; content: ScopeContent; changed: boolean; records: RecordKey[] | undefined }>,
  ): void {
    for (const { scope, steps } of work) for (const one of steps) this.kept.get(scope)!.applied.add(one.stepId)
    const changed = [...planned.values()].filter((plan) => plan.changed)
    if (changed.length === 0) return
    let treeMoved = false
    for (const { kept, content, records } of changed) {
      treeMoved ||= this.summary(kept.content) !== this.summary(content)
      kept.content = structuredClone(content)
      kept.revision = this.mint('revision')
      kept.updatedAt = new Date().toISOString()
      const last = Math.max(...work.filter((one) => one.scope === kept.id).flatMap((one) => one.steps.map((s) => s.at)))
      kept.pending = { records: merge(kept.pending ? kept.pending.records : [], records), at: last }
    }
    if (treeMoved) this.treeRevision = this.mint('tree')
    this.indexChanged(changed.map((plan) => plan.kept.id))
  }

  private create(at: ScopeAddress, scope: NewScope): Created | Refused {
    if (!isSafeScopePath(at)) return { refused: 'shell.badScopePath' }
    if (this.at(at)) return { refused: 'shell.scopeTaken' }
    const { name, ...description } = scope
    const made = [...this.makeAncestors(at), this.make(at, emptyContent(name, description))]
    this.treeRevision = this.mint('tree')
    this.indexChanged(made.map((kept) => kept.id))
    const kept = made[made.length - 1]
    return { id: kept.id, revision: kept.revision }
  }

  private move(scope: ScopeId, to: ScopeAddress, expects?: Revision): Moved | Refused {
    const kept = this.kept.get(scope)
    if (!kept) return { refused: 'shell.scopeGone', scope }
    if (kept.address === ROOT_SCOPE || !isSafeScopePath(to)) return { refused: 'shell.badScopePath', scope }
    if (isWithinScope(to, kept.address)) return { refused: 'shell.scopeIntoItself', scope }
    if (this.at(to)) return { refused: 'shell.scopeTaken', scope }
    if (expects !== undefined && expects !== kept.revision) return { refused: 'shell.scopeMoved', scope }
    const from = kept.address
    const moving = this.within(from)
    const made = this.makeAncestors(to)
    for (const one of moving) {
      one.address = `${to}${one.address.slice(from.length)}`
      one.revision = this.mint('revision')
    }
    this.treeRevision = this.mint('tree')
    this.indexChanged([...made, ...moving].map((one) => one.id))
    return { revision: kept.revision }
  }

  private remove(scope: ScopeId, expects?: Revision): Removed | Refused {
    const kept = this.kept.get(scope)
    if (!kept) return { removed: [] }
    if (kept.address === ROOT_SCOPE) return { refused: 'shell.badScopePath', scope }
    if (expects !== undefined && expects !== kept.revision) return { refused: 'shell.scopeMoved', scope }
    const removed = this.within(kept.address).map((one) => one.id)
    for (const id of removed) {
      this.kept.delete(id)
      this.stored.delete(id)
      this.settingsHeld.delete(`scope:${id}`)
    }
    this.entries.splice(0, this.entries.length, ...this.entries.filter((entry) => !removed.includes(entry.scope)))
    this.treeRevision = this.mint('tree')
    this.indexChanged([], removed)
    return { removed }
  }

  // --- the index ---------------------------------------------------------------

  private indexed(kept: Kept): IndexedScope {
    const { elements, relations, transitions, observations } = kept.content.model
    return structuredClone({
      id: kept.id, address: kept.address,
      model: { elements, relations, ...(transitions ? { transitions } : {}), ...(observations ? { observations } : {}) },
    })
  }

  readonly index: OrganisationIndex = {
    id: 'memory (contract)',
    read: (): Promise<IndexRead> => Promise.resolve({
      revision: this.indexLog[this.indexLog.length - 1].revision,
      scopes: [...this.kept.values()].map((kept) => this.indexed(kept)),
    }),
    since: (revision): Promise<IndexChanges | undefined> => {
      const from = this.indexLog.findIndex((step) => step.revision === revision)
      if (from < 0) return Promise.resolve(undefined)
      const changed = new Set<ScopeId>()
      const removed = new Set<ScopeId>()
      for (const step of this.indexLog.slice(from + 1)) {
        for (const id of step.changed) changed.add(id)
        for (const id of step.removed) removed.add(id)
      }
      return Promise.resolve({
        revision: this.indexLog[this.indexLog.length - 1].revision,
        changed: [...changed].map((id) => this.kept.get(id)).filter((kept) => kept !== undefined)
          .map((kept) => this.indexed(kept)),
        removed: [...removed].filter((id) => !this.kept.has(id)),
      })
    },
  }

  // --- the history -------------------------------------------------------------

  cut(subject?: string): void {
    for (const kept of this.kept.values()) {
      if (!kept.pending) continue
      this.entrySeq += 1
      this.entries.push({
        seq: this.entrySeq, id: `entry-${this.entrySeq}`, scope: kept.id, at: kept.pending.at,
        ...(subject !== undefined ? { subject } : {}),
        labels: [], records: kept.pending.records, state: this.stateOf(kept),
      })
      kept.pending = undefined
    }
  }

  readonly history: HistoryRepository = {
    id: 'memory (contract)',
    entries: (wanted) => Promise.resolve(this.page(wanted)),
    stateAt: (scope, entry) => {
      const found = this.entries.find((one) => one.id === entry && one.scope === scope)
      return Promise.resolve(found ? structuredClone(found.state) : undefined)
    },
    label: (scope, entry, name) => Promise.resolve(this.label(scope, entry, name)),
  }

  private page({ scopes, record, limit = PAGE, after }: EntriesWanted): HistoryPage {
    const below = after === undefined ? Infinity : Number(after)
    const matching = this.entries
      .filter((entry) => scopes.includes(entry.scope) && entry.seq < below)
      .filter((entry) => !record || !entry.records || entry.records.some((one) => sameRecord(one, record)))
      .sort((one, other) => other.seq - one.seq)
    const page = matching.slice(0, Math.max(1, limit))
    const listed = page.map(({ id, scope, at, subject, labels }) => structuredClone({
      id, scope, at, by: 'memory', labels, ...(subject !== undefined ? { subject } : {}),
    }))
    return matching.length > page.length
      ? { entries: listed, next: String(page[page.length - 1].seq) }
      : { entries: listed }
  }

  private label(scope: ScopeId, entry: EntryId, name: string): EntryLabelled {
    const found = this.entries.find((one) => one.id === entry && one.scope === scope)
    if (!found) return 'gone'
    const slug = labelSlug(name)
    if (!slug) return 'unnamed'
    const taken = this.entries.some((one) => one.scope === scope && one.labels.some((held) => labelSlug(held) === slug))
    if (taken) return 'exists'
    found.labels.push(name)
    return 'done'
  }

  // --- the images --------------------------------------------------------------

  readonly images: ImageRepository = {
    id: 'memory (contract)',
    put: (scope, name, bytes) => this.put(scope, name, bytes),
    folder: (scope, folder) => Promise.resolve(this.folder(scope, folder)),
    find: (scope, name) => Promise.resolve(this.entryOf(scope, name)),
    bytes: (scope, name) => {
      const entry = this.entryOf(scope, name)
      const found = entry && this.stored.get(scope)?.get(entry.contentAddress)
      return Promise.resolve(found ? structuredClone(found) : undefined)
    },
  }

  private async put(scope: ScopeId, name: ImageName, bytes: Uint8Array): Promise<Put> {
    const refused = imageNameRefusal(name)
    if (refused) return { refused }
    const contentAddress = await contentAddressOf(bytes)
    const held = this.stored.get(scope) ?? new Map<ContentAddress, ImageBytes>()
    held.set(contentAddress, { mediaType: imageMediaType(name)!, bytes: new Uint8Array(bytes) })
    this.stored.set(scope, held)
    return { contentAddress }
  }

  private entryOf(scope: ScopeId, name: ImageName): ImageEntry | undefined {
    const found = this.kept.get(scope)?.content.images.find((image) => image.name === name)
    return found ? structuredClone(found) : undefined
  }

  private folder(scope: ScopeId, folder: ImageFolder): ImageListing {
    const images = this.kept.get(scope)?.content.images ?? []
    return structuredClone({
      images: images.filter((image) => imageFolderOf(image.name) === folder)
        .sort((one, other) => (one.name < other.name ? -1 : 1)),
      folders: foldersUnder(folder, images.map((image) => image.name)),
    })
  }

  // --- the settings ------------------------------------------------------------

  readonly settings: SettingsRepository = {
    id: 'memory (contract)',
    read: (of) => Promise.resolve(structuredClone(this.settingsHeld.get(settingsKey(of)) ?? {})),
    write: (of, patch: SettingsPatch) => {
      const next = patchSettings(this.settingsHeld.get(settingsKey(of)) ?? {}, patch)
      this.settingsHeld.set(settingsKey(of), next)
      return Promise.resolve(structuredClone(next))
    },
  }

  spoil(scope: ScopeId): void {
    const kept = this.kept.get(scope)
    if (kept) kept.unreadable = ['spoiled by the contract']
  }
}

function merge(held: readonly RecordKey[] | undefined, more: readonly RecordKey[] | undefined): RecordKey[] | undefined {
  if (held === undefined || more === undefined) return undefined
  return [...held, ...more.filter((record) => !held.some((one) => sameRecord(one, record)))]
}

function settingsKey(of: SettingsOf): string {
  return of.of === 'scope' ? `scope:${of.scope}` : of.of
}

/** Fresh repositories in memory, with the organisation and nothing else. */
export function memoryRepositories(): RepositoriesUnderTest {
  const memory = new Memory()
  return {
    repositories: {
      scopes: memory.scopes, index: memory.index, history: memory.history, images: memory.images, settings: memory.settings,
    },
    cut: (subject) => {
      memory.cut(subject)
      return Promise.resolve()
    },
    spoil: (scope) => memory.spoil(scope),
  }
}

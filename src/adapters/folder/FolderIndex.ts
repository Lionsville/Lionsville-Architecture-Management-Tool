// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The index over a folder's scopes (ADR-0031 §1; ADR-0012 §2).
 *
 * Read from the folder every time it is asked: each scope's `model.json` and
 * its plans and observations, as the folder store reads them for the index
 * (`FileSystemScopeStore.models`). What the index holds is what the folder
 * holds, whoever wrote it.
 *
 * **Its revision is what it holds, fingerprinted**, so two reads of an
 * unchanged folder agree. **What changed since one** is answered against the
 * index as it was at that revision, which this keeps for the last few it
 * answered with; one it does not keep — from before the repositories were
 * opened, or further back than it keeps — is answered `undefined`, and the
 * reader reads the whole index again.
 */
import { stableJson } from '../../projects/fileText'
import { fingerprint } from '../../projects/revision'
import type { Revision, ScopeId } from '../../projects/scopeState'
import type { IndexChanges, IndexedScope, IndexRead, OrganisationIndex } from '../../ports/OrganisationIndex'
import type { FolderScopes } from './folderScopes'

/** How many past revisions it answers *what changed since* for. */
const KEPT = 32

export class FolderIndex implements OrganisationIndex {
  readonly id = 'folder'
  /** Each revision answered with, and each scope's part of the index then, by identity. */
  private readonly past = new Map<Revision, Map<ScopeId, string>>()

  constructor(private readonly folder: FolderScopes) {}

  async read(): Promise<IndexRead> {
    const [{ nodes }, models] = await Promise.all([this.folder.walk(), this.folder.store.models()])
    const byAddress = new Map(models.map((one) => [one.path, one.model]))
    const scopes: IndexedScope[] = nodes.flatMap((node) => {
      const model = byAddress.get(node.address)
      // A scope whose model would not read is left out rather than answered empty: unknown, not "defines nothing".
      if (!model && Object.keys(node.header).length > 0) return []
      return [{ id: node.id, address: node.address, model: structuredClone(model ?? { elements: [], relations: [] }) }]
    })
    const parts = new Map(scopes.map((scope) => [scope.id, stableJson(scope)]))
    const revision = fingerprint(['index', ...[...parts].map(([id, part]) => `${id}\u0000${part}`).sort()])
    this.past.delete(revision)
    this.past.set(revision, parts)
    while (this.past.size > KEPT) this.past.delete(this.past.keys().next().value!)
    return { revision, scopes }
  }

  async since(revision: Revision): Promise<IndexChanges | undefined> {
    const then = this.past.get(revision)
    if (!then) return undefined
    const now = await this.read()
    const changed = now.scopes.filter((scope) => then.get(scope.id) !== stableJson(scope))
    const here = new Set(now.scopes.map((scope) => scope.id))
    return { revision: now.revision, changed, removed: [...then.keys()].filter((id) => !here.has(id)) }
  }
}

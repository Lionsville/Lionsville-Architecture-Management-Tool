/**
 * A history that lives in memory: what a test hands the shell when it wants
 * snapshots to exist without a git.
 *
 * Every snapshot is declared up front — what it said, when, and which project
 * files it touched — and the adapter answers the seam's questions from that
 * list. It is deliberately dumber than the desktop's: a filter here is a glob
 * over the declared paths rather than anything a repository worked out, so a
 * test that says "this snapshot touched `docs/billing.md`" gets exactly the
 * behaviour it declared and nothing it did not.
 */
import type { ScopeSnapshot } from '../../projects/scope'
import { scopeFilePath } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'
import type { HistoryEntry, HistoryScope, ProjectHistory } from '../../ports/ProjectHistory'
import { labelSlug } from '../../platform/history'
import type { LabelOutcome } from '../../platform/history'

export type MemorySnapshot = Omit<HistoryEntry, 'labels'> & {
  labels?: string[]
  /** Paths, relative to the root, that this snapshot changed. */
  touched?: readonly string[]
  /** The projects as they stood, by path. Absent means not in the folder then. */
  projects?: readonly ScopeSnapshot[]
}

/** A pattern, as git reads one: `*` matches within a name. */
function matches(pattern: string, path: string): boolean {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')
  return new RegExp(`^${escaped}$`).test(path)
}

export class InMemoryProjectHistory implements ProjectHistory {
  /** What was asked of it, for a test to read back. */
  readonly calls = { started: 0, snapshots: [] as string[] }
  private keepingOne: boolean

  constructor(
    private snapshots: MemorySnapshot[] = [],
    options: { keeping?: boolean } = {},
  ) {
    this.keepingOne = options.keeping ?? snapshots.length > 0
  }

  available(): Promise<boolean> {
    return Promise.resolve(true)
  }

  keeping(): Promise<boolean> {
    return Promise.resolve(this.keepingOne)
  }

  start(): Promise<void> {
    this.calls.started += 1
    this.keepingOne = true
    return Promise.resolve()
  }

  snapshot(message: string): Promise<boolean> {
    this.calls.snapshots.push(message)
    return Promise.resolve(true)
  }

  entries(limit = 50, of?: HistoryScope): Promise<HistoryEntry[]> {
    const wanted = of ? of.paths.map((path) => scopeFilePath(of.path, path)) : undefined
    const listed = this.snapshots
      .filter((held) => !wanted || (held.touched ?? []).some((path) => wanted.some((pattern) => matches(pattern, path))))
      .slice(0, limit)
      .map(({ id, subject, at, author, labels }) => ({ id, subject, at, author, labels: labels ?? [] }))
    return Promise.resolve(listed)
  }

  /** The same two refusals the desktop has, over the same slug. */
  label(entry: string, name: string): Promise<LabelOutcome> {
    const tag = labelSlug(name)
    if (!tag) return Promise.resolve('unnamed')
    if (this.snapshots.some((held) => (held.labels ?? []).some((known) => labelSlug(known) === tag))) {
      return Promise.resolve('exists')
    }
    const held = this.snapshots.find((snapshot) => snapshot.id === entry)
    if (held) held.labels = [...(held.labels ?? []), name.trim()]
    return Promise.resolve('done')
  }

  projectAt(path: ScopePath, entry: string): Promise<ScopeSnapshot | undefined> {
    const held = this.snapshots.find((snapshot) => snapshot.id === entry)
    return Promise.resolve(held?.projects?.find((project) => project.path === path))
  }
}

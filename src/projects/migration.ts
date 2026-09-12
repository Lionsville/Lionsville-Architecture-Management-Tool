/**
 * Two migrations, and they are not the same kind of thing.
 *
 * **Out of browser storage and into the folder** (ADR-0003). It copies, and
 * deletes nothing: three rules, on {@link copyProjectsInto}.
 *
 * **Out of an older file format and into this one** (ADR-0012 §11). It rewrites
 * in place, because a folder cannot hold two versions of itself. The fold is
 * `migrate3to4.ts`; what lives here is the pass over a whole store — ask which
 * projects are old, record the folder before touching it, then read each one
 * and write it back ({@link upgradeProjects}).
 *
 * They share a file because they share the shape a caller wants: narrow
 * structural seams rather than a `ProjectStore`, a tally of counts and never
 * names, and a failure that is one project rather than the run.
 */
import type { GroupProfile } from './group'
import type { ProjectSnapshot, ProjectSummary } from './project'
import type { ScopePath } from './scopePath'

/** Where the projects are coming from: enough to see them and read them. */
export type ProjectSource = {
  list(): Promise<ProjectSummary[]>
  load(path: ScopePath): Promise<ProjectSnapshot | undefined>
}

/** Where they are going: enough to see what is already there, and to write. */
export type ProjectTarget = ProjectSource & {
  save(project: ProjectSnapshot): Promise<void>
}

export type GroupSource = { list(): Promise<GroupProfile[]> }
export type GroupTarget = GroupSource & { save(profile: GroupProfile): Promise<void> }

/** What happened, for the trail. Counts, never names — a log is not a document. */
export type MigrationTally = {
  projects: number
  groups: number
  /** Already in the folder, and therefore left exactly as they were. */
  kept: number
  failed: number
}

export const NOTHING_MIGRATED: MigrationTally = { projects: 0, groups: 0, kept: 0, failed: 0 }

/**
 * The projects in browser storage, copied into the folder.
 *
 * The desktop app kept its user's documents in a leveldb inside `userData`
 * (ADR-0003). The moment somebody chooses a folder, those projects have to
 * follow them there — a migration that leaves the old work behind is not a
 * migration, it is a fresh start with a confusing name.
 *
 * **Nothing is deleted.** Not the old records, not on a later run either. This
 * copies; the browser's copy stays until somebody decides it may go, and until
 * then a folder that turns out to be on an unplugged drive costs nothing.
 *
 * **Nothing already in the folder is touched.** A project the folder already
 * holds under the same ref is the newer one by definition — it is where the
 * work has been happening — and a migration that overwrote it would be the
 * worst kind of data loss: silent, and triggered by choosing a folder.
 *
 * **A failure is one project, not the run.** A landscape that will not read is
 * skipped and counted; the other eleven still arrive.
 */
export async function copyProjectsInto(
  from: ProjectSource, into: ProjectTarget,
): Promise<MigrationTally> {
  const tally = { ...NOTHING_MIGRATED }
  let summaries: readonly ProjectSummary[]
  try {
    summaries = await from.list()
  } catch {
    return tally
  }

  for (const summary of summaries) {
    try {
      if (await into.load(summary.path)) { tally.kept += 1; continue }
      const project = await from.load(summary.path)
      if (!project) { tally.failed += 1; continue }
      await into.save(project)
      tally.projects += 1
    } catch {
      tally.failed += 1
    }
  }
  return tally
}

/**
 * The group records too — a description and a set of decisions that would
 * otherwise stay behind in a browser profile while their projects moved out.
 */
export async function copyGroupsInto(
  from: GroupSource, into: GroupTarget,
): Promise<Pick<MigrationTally, 'groups' | 'kept' | 'failed'>> {
  const tally = { groups: 0, kept: 0, failed: 0 }
  let profiles: readonly GroupProfile[]
  try {
    profiles = await from.list()
  } catch {
    return tally
  }

  const held = new Set((await into.list().catch(() => [])).map((profile) => profile.group))
  for (const profile of profiles) {
    if (held.has(profile.group)) { tally.kept += 1; continue }
    try {
      await into.save(profile)
      tally.groups += 1
    } catch {
      tally.failed += 1
    }
  }
  return tally
}

/** Everything, in one call. The order matters only for the tally. */
export async function migrateInto(
  projects: { from: ProjectSource; into: ProjectTarget },
  groups: { from: GroupSource; into: GroupTarget },
): Promise<MigrationTally> {
  const copied = await copyProjectsInto(projects.from, projects.into)
  const withGroups = await copyGroupsInto(groups.from, groups.into)
  return {
    projects: copied.projects,
    groups: withGroups.groups,
    kept: copied.kept + withGroups.kept,
    failed: copied.failed + withGroups.failed,
  }
}

export function migrated(tally: MigrationTally): boolean {
  return tally.projects > 0 || tally.groups > 0
}

// --- out of an older format, and into this one ------------------------------

/**
 * Where the pass reads and writes: a store that can also say which of its
 * projects an older version of this tool wrote ({@link ProjectStore.outdated}).
 *
 * A store that cannot say has nothing old in it, so the pass does nothing —
 * which is what an in-memory store and any backend written since the format
 * turned both want.
 */
export type UpgradeTarget = ProjectTarget & { outdated?(): Promise<ScopePath[]> }

/**
 * Recording the folder before the pass rewrites it (ADR-0008), or saying it
 * could not. `false` is not a failure: a folder with no git in it has nothing
 * to record, and refusing to migrate for want of a snapshot would leave a
 * project nobody can open.
 */
export type RecordBefore = () => Promise<boolean>

export type UpgradeTally = {
  /** Projects read in an older format and written back in this one. */
  upgraded: number
  failed: number
  /** Whether what the folder looked like first was kept. */
  recorded: 'taken' | 'unavailable' | 'nothing to record'
}

export const NOTHING_UPGRADED: UpgradeTally = {
  upgraded: 0, failed: 0, recorded: 'nothing to record',
}

/**
 * Every project this store holds in an older format, rewritten in this one.
 *
 * Eager rather than lazy, and the reason is the superseded files: reading an
 * old project upgrades what is in memory, but only a save takes the files the
 * format has stopped writing off disk, and a folder half in one version and
 * half in another is a folder whose diffs nobody can read.
 *
 * Not guarded by a preference either, which the browser-storage copy needs and
 * this does not: the question it asks is the state itself, so a folder that has
 * already been through the pass answers with an empty list and costs one header
 * read per project. A project dropped into the folder next month is migrated
 * next month, without anybody having to remember it.
 */
export async function upgradeProjects(
  store: UpgradeTarget, record?: RecordBefore,
): Promise<UpgradeTally> {
  const tally: UpgradeTally = { ...NOTHING_UPGRADED }
  let outdated: readonly ScopePath[]
  try {
    outdated = await store.outdated?.() ?? []
  } catch {
    // A store that cannot be asked is a store nothing can be done about here;
    // opening a project will fail loudly enough on its own.
    return tally
  }
  if (outdated.length === 0) return tally

  tally.recorded = record && await record().catch(() => false) ? 'taken' : 'unavailable'
  for (const path of outdated) {
    try {
      const project = await store.load(path)
      if (!project) { tally.failed += 1; continue }
      await store.save(project)
      tally.upgraded += 1
    } catch {
      tally.failed += 1
    }
  }
  return tally
}

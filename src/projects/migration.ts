/**
 * Getting the projects out of browser storage and into the folder.
 *
 * The desktop app kept its user's documents in a leveldb inside `userData`
 * (ADR-0003). The moment somebody chooses a folder, those projects have to
 * follow them there — a migration that leaves the old work behind is not a
 * migration, it is a fresh start with a confusing name.
 *
 * Three rules, and they are the whole file.
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
import type { GroupProfile } from './group'
import type { ProjectSnapshot, ProjectSummary } from './project'
import type { ProjectRef } from './projectRef'

/** Where the projects are coming from: enough to see them and read them. */
export type ProjectSource = {
  list(): Promise<ProjectSummary[]>
  load(ref: ProjectRef): Promise<ProjectSnapshot | undefined>
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
      if (await into.load(summary.ref)) { tally.kept += 1; continue }
      const project = await from.load(summary.ref)
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

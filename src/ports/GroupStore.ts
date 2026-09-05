/**
 * Where a group's own record is kept.
 *
 * A second, much smaller seam beside {@link ProjectStore}, and separate from it
 * for the reason the layer map gives: these are different records with different
 * lifetimes, not a different place to keep the same one. A store holds many
 * profiles, addressed by the group path.
 *
 * **A profile decorates a group; it does not create one.** Groups are still
 * derived from the projects filed under them (`groupsOf`), so a profile whose
 * group has no projects left is not a group anybody sees. That keeps the rule
 * this app was built on — there is nowhere to keep an empty group — while still
 * letting a group carry a description and a set of links.
 *
 * Promises for the same reason as everywhere else: `localStorage` is
 * synchronous, and every backend after it is not.
 */
import type { GroupProfile } from '../core/group'

export interface GroupStore {
  /** Where this one keeps things, in plain words. For messages and the trail. */
  readonly id: string

  /**
   * Every profile this store holds. Empty is the normal answer — most groups
   * never get a record, and the caller falls back to the derived name.
   */
  list(): Promise<GroupProfile[]>

  /**
   * Write one out, under its own group path.
   *
   * The path comes from the profile rather than a separate argument, so the two
   * can never disagree — the same reasoning as `ProjectStore.save`.
   */
  save(profile: GroupProfile): Promise<void>

  /** Forget a group's record. Forgetting one that was never there is fine. */
  remove(group: string): Promise<void>
}

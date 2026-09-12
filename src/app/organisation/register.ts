/**
 * The register: every application in the organisation, derived (ADR-0012 §2).
 *
 * **There is no register file.** The register is every definition of an
 * application in the tree, keyed by id, computed from the index and refreshed
 * by the watcher — the same choice as groups derived from projects, for the
 * same reason: a materialised list is a merge conflict every domain touches,
 * and a derived one is right by construction.
 *
 * Pure, like {@link organisationPages} beside it: the page renders what is
 * here, and the sums a screen would otherwise do in three `useMemo`s have a
 * node test instead. Nothing loads — every number comes from the one index the
 * shell already holds, which is what keeps the card on the organisation screen
 * from being a load per card (ADR-0004).
 */
import { matchesQuery } from '../../model'
import type { ElementId } from '../../model'
import type { Finding } from '../../projects/checks'
import type { ScopeIndex } from '../../projects/scopeIndex'
import { ROOT_SCOPE } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'

/** One application, as the register draws it. */
export type RegisterRow = {
  id: ElementId
  /** The master's name, or the only name anybody wrote down (`IndexEntry`). */
  name: string
  /**
   * The scope that answers for it. Absent is the dangling case: every record
   * of it is a stand-in of something nobody in the tree defines.
   */
  master?: ScopePath
  /** Nobody in this organisation owns it (§4). */
  outside?: true
  /** Whose it is, named rather than keyed — absent where nobody has said. */
  party?: string
  /** Every scope holding a stand-in: who else draws it. */
  drawnIn: readonly ScopePath[]
  /** The findings that concern this application, in the order they were found. */
  findings: readonly Finding[]
}

/** The line the card says, and the line under the page's heading. */
export type RegisterSummary = {
  applications: number
  /** Answered for by a scope that is not the organisation itself. */
  ownedByADomain: number
  outside: number
  /** Two scopes define it at the same depth. */
  definedTwice: number
  /** Outside, and nobody has said whose (§9). */
  unattributed: number
  /** At least one stand-in or declaration whose cache disagrees with the master. */
  stale: number
}

/**
 * Every application in the tree, by name, with the findings about it.
 *
 * The findings come in rather than being computed here: one fold over the
 * index answers for the whole organisation (`identityFindings`), and the
 * screen that draws this already has them for its tree of rows.
 */
export function registerRows(
  index: ScopeIndex,
  findings: readonly Finding[] = [],
): RegisterRow[] {
  /**
   * One finding of each kind per row.
   *
   * A conflict is reported on BOTH scopes that define the id, because each of
   * them is a place somebody has to go and look; the register is about the
   * application rather than about a scope, so two chips saying "also defined
   * elsewhere" would be the same fact drawn twice. The first is kept, and it
   * names the other scope.
   */
  const about = new Map<string, Finding[]>()
  for (const finding of findings) {
    const held = about.get(finding.id) ?? []
    if (held.some((one) => one.key === finding.key)) continue
    held.push(finding)
    about.set(finding.id, held)
  }
  return index.register().map((entry) => {
    const party = entry.partyId !== undefined ? index.lookup(entry.partyId)?.name : undefined
    return {
      id: entry.id,
      name: entry.name,
      ...(entry.master !== undefined ? { master: entry.master } : {}),
      ...(entry.outside ? { outside: entry.outside } : {}),
      ...(party !== undefined ? { party } : {}),
      drawnIn: entry.drawnIn,
      findings: about.get(entry.id) ?? [],
    }
  })
}

/**
 * Is this row one nobody has said whose it is (§9)?
 *
 * Derived here rather than taken from `documentFindings`, which answers it
 * from one scope's own records: the register is about the whole tree, and the
 * index carries both halves of the question already.
 */
export function isUnattributed(row: RegisterRow): boolean {
  return row.outside === true && row.party === undefined
}

export function registerSummary(rows: readonly RegisterRow[]): RegisterSummary {
  const has = (row: RegisterRow, key: Finding['key']) =>
    row.findings.some((finding) => finding.key === key)
  return {
    applications: rows.length,
    ownedByADomain: rows.filter((row) => row.master !== undefined && row.master !== ROOT_SCOPE).length,
    outside: rows.filter((row) => row.outside).length,
    definedTwice: rows.filter((row) => has(row, 'check.conflict')).length,
    unattributed: rows.filter(isUnattributed).length,
    stale: rows.filter((row) => has(row, 'check.drift')).length,
  }
}

/**
 * The rows a filter box leaves, by the app's one rule for "found"
 * (`model/textSearch`).
 *
 * Over the name, the id and the scope that answers for it — the three things
 * on the row a person can read. An empty query is every row rather than none.
 */
export function matchingRows(rows: readonly RegisterRow[], query: string): RegisterRow[] {
  const asked = query.trim()
  if (!asked) return [...rows]
  return rows.filter((row) => matchesQuery(asked, [row.name, row.id, row.master ?? '']))
}

/**
 * The rows in the order the page shows them.
 *
 * By name is the default and is what the index already answers with. *By
 * scope* groups them under whoever answers for them, in path order, with the
 * ones nobody defines last — because a row with no master is a question rather
 * than a place.
 */
export function sortRows(rows: readonly RegisterRow[], by: 'name' | 'scope'): RegisterRow[] {
  if (by === 'name') return [...rows]
  return [...rows].sort((a, b) => {
    if ((a.master === undefined) !== (b.master === undefined)) return a.master === undefined ? 1 : -1
    return (a.master ?? '').localeCompare(b.master ?? '') || a.name.localeCompare(b.name)
  })
}

/**
 * Where one thing lives in the project folder, so its history can be asked for
 * (ADR-0008).
 *
 * The folder format already knows — a diagram is two files, a description is
 * one, a decision is one — it just never said so out loud. This is the saying.
 * Every answer is built from the same constants and the same naming the writer
 * uses, and the test pins each one against `projectFiles`, so the two cannot
 * drift: a path this module names is a path the format writes.
 *
 * Answers are patterns, not paths, for one reason: a decision's file carries
 * its title, and a retitled decision has moved. Its history is the history of
 * every name it has had, which the number prefix covers and the current name
 * does not. A diagram and a description are keyed by id and do not move, so
 * theirs are plain paths that happen to contain no `*`.
 *
 * Relative to a scope's folder. Whoever binds this to a working directory (the
 * adapter) prepends the scope's own path; this module does not know where a
 * scope is, only what is in it.
 *
 * Since ADR-0012 §7 there is a second answer beside the first:
 * {@link historyPaths} says where a subject is filed in ONE scope, and
 * {@link historyPlaces} says everywhere it is filed in the tree — which is a
 * different question only for an element's page, because an id is
 * organisation-wide and the scopes that draw it each keep a perspective of
 * their own.
 */
import type { ElementId } from '../model'
import type { HostModel } from '../model/fromInterchange'
import { adrPathPattern } from './adrFile'
import {
  descriptionPath, diagramStems, DIAGRAMS_FOLDER, GEOMETRY_SUFFIX, MODEL_FILE,
} from './folderFormat'
import type { ScopeIndex } from './scopeIndex'
import type { ScopePath } from './scopePath'

/** One thing a person can ask the history of. */
export type HistorySubject =
  | { what: 'diagram'; id: string }
  /** An element's description: the page, not the element. */
  | { what: 'description'; id: string }
  | { what: 'decision'; id: string }

/**
 * The paths (or path patterns) whose changes are this subject's changes, or
 * `undefined` for a subject the model does not have — a decision that is gone
 * has no number to ask by.
 */
export function historyPaths(subject: HistorySubject, model: HostModel): string[] | undefined {
  switch (subject.what) {
    case 'diagram': {
      // Named over the whole list, because a stem is decided by who came
      // first; a diagram deleted since is named as it would be on its own.
      const known = model.diagrams.some((diagram) => diagram.id === subject.id)
      const stems = diagramStems(known ? model.diagrams : [{ id: subject.id }])
      const stem = stems.get(subject.id)
      if (!stem) return undefined
      return [`${DIAGRAMS_FOLDER}/${stem}.json`, `${DIAGRAMS_FOLDER}/${stem}${GEOMETRY_SUFFIX}`]
    }
    case 'description':
      // An element whose id cannot be a file name keeps its description in
      // `model.json`, so its history is the model's. Coarse, and honest.
      return [descriptionPath(subject.id) ?? MODEL_FILE]
    case 'decision': {
      const adr = (model.decisions ?? []).find((held) => held.id === subject.id)
      return adr ? [adrPathPattern(adr)] : undefined
    }
  }
}

/** One scope, and the paths this subject is filed at inside it. */
export type HistoryPlace = { path: ScopePath; paths: string[] }

/**
 * Everywhere a subject is filed, across the tree (ADR-0012 §7).
 *
 * A diagram and a decision are one scope's files and answer with one place.
 * An element's page is not: an id is organisation-wide, the scope that answers
 * for it holds the owner's account, and every scope that draws it holds a
 * perspective of its own — so "the history of `erp`" is the union of those
 * files, which ids being global is precisely what makes possible.
 *
 * **The owning scope's `model.json` is deliberately not in it.** Every element
 * in a scope shares that file, so a history of one id that listed every commit
 * touching any record there would be the scope's history wearing the element's
 * name. It appears only where the id cannot be a file name, which is the same
 * coarse-and-honest answer {@link historyPaths} already gives.
 *
 * Without an index this is the open scope's own answer, which is what it was
 * before the tree had one.
 */
export function historyPlaces(
  subject: HistorySubject,
  deps: { scope: ScopePath; model: HostModel; index?: ScopeIndex },
): HistoryPlace[] | undefined {
  const own = historyPaths(subject, deps.model)
  if (!own) return undefined
  const here: HistoryPlace = { path: deps.scope, paths: own }
  if (subject.what !== 'description') return [here]
  return [here, ...elsewhere(subject.id, deps.scope, deps.index)]
}

/** Every OTHER scope that holds this id, and its page for it. */
function elsewhere(
  id: ElementId, scope: ScopePath, index?: ScopeIndex,
): HistoryPlace[] {
  const entry = index?.lookup(id)
  if (!entry) return []
  const paths = [
    ...(entry.master !== undefined ? [entry.master] : []),
    ...entry.declarations,
    ...entry.drawnIn,
  ]
  return [...new Set(paths)]
    .filter((path) => path !== scope)
    .sort()
    .map((path) => ({ path, paths: [descriptionPath(id) ?? MODEL_FILE] }))
}

/**
 * Every scope this subject is filed in, for a page to say where it is looking.
 *
 * The places' paths in their own order, which is this scope first and the rest
 * of the tree after it.
 */
export function historyScopes(places: readonly HistoryPlace[]): ScopePath[] {
  return places.map((place) => place.path)
}

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
 * Relative to the project folder. Whoever binds this to a working directory
 * (the adapter) prepends the project's own path; this module does not know
 * where the project is, only what is in it.
 */
import type { HostModel } from '../model/fromInterchange'
import { adrPathPattern } from './adrFile'
import { descriptionPath, diagramStems, DIAGRAMS_FOLDER, MODEL_FILE } from './folderFormat'

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
      return [`${DIAGRAMS_FOLDER}/${stem}.json`, `${DIAGRAMS_FOLDER}/${stem}.placements.json`]
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

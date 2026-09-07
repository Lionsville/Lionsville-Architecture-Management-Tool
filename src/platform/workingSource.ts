/**
 * What you are working from (ADR-0005).
 *
 * The question the top bar did not answer: where is any of this kept? Both
 * the shell and the adapters have to understand the answer and neither owns
 * it, so it lives here.
 *
 * A union and not a string, so the thing that comes after these — a server, a
 * shared drive — is a new case the compiler asks about at every site rather
 * than a label somebody has to remember to handle.
 *
 * There is no `workingFile` case on purpose: opening a `.lvarch` loads its
 * bytes into the project that is open, so nobody ever works *from* the file.
 * `memory` is the case where saying so matters most — storage refused, and
 * nothing outlives this tab.
 */
export type WorkingSource =
  | { readonly kind: 'folder'; readonly name: string; readonly root: string }
  /** The fallback, and it says so. */
  | { readonly kind: 'browserStorage' }
  /** Storage refused; nothing outlives this tab. */
  | { readonly kind: 'memory' }

export const BROWSER_STORAGE: WorkingSource = { kind: 'browserStorage' }
export const IN_MEMORY: WorkingSource = { kind: 'memory' }

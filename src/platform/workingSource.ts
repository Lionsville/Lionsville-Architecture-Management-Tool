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

/**
 * What tells one working source from another, for the shell to be mounted
 * under.
 *
 * The composition root renders `App` under this as its key, so a folder
 * change is a fresh mount rather than a swap in place: the open scope, the
 * session and its undo stack, the index, the organisation's listing and every
 * watcher belong to one folder, and a hook that read its store once at mount
 * would otherwise keep answering for the folder that was open at the boot.
 * Two folders with the same name are two folders, so it is the root and not
 * the name; the two fallbacks are one source each.
 */
export function sourceKey(source: WorkingSource): string {
  return source.kind === 'folder' ? `folder:${source.root}` : source.kind
}

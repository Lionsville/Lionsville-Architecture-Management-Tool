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
  | RegisteredSource

/**
 * Work kept somewhere a registered provider answers for
 * (`platform/sourceProvider.ts`).
 *
 * The one open case, and it is open in the union's own spirit rather than
 * against it: `kind` stays a literal, so every switch above is still
 * exhaustive and the compiler still asks at each site — what varies is
 * `provider`, which names the registration rather than the code. A build
 * composed from this one registers a provider and hands the shell one of
 * these; nothing here has to be edited for it, and nothing here knows what it
 * is.
 */
export type RegisteredSource = {
  readonly kind: 'registered'
  /** Which provider answers for it: the `kind` it registered under. */
  readonly provider: string
  /** What it is called on the bar. The provider names it; nobody else can. */
  readonly name: string
  /** What tells this one from another of the same provider — see {@link sourceKey}. */
  readonly key: string
  /**
   * Work here reads and does not write.
   *
   * A fact about the source rather than a constant the workspace passes, which
   * is what it was until a source could be something other than a folder this
   * machine owns. Absent means writable, which is what all three built-ins
   * are and always were.
   */
  readonly readOnly?: boolean
}

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
  switch (source.kind) {
    case 'folder': return `folder:${source.root}`
    // The provider and its own key, because two providers may well tell their
    // sources apart the same way and one of them being mounted over the other
    // is the bug this key exists to prevent.
    case 'registered': return `${source.provider}:${source.key}`
    default: return source.kind
  }
}

/**
 * May work be written here?
 *
 * The one question every mutating affordance already asks, answered by the
 * source instead of by a constant. Only a registered source can say no; the
 * three that ship are all writable, which is what they always were.
 */
export function sourceIsReadOnly(source: WorkingSource): boolean {
  return source.kind === 'registered' && source.readOnly === true
}

/**
 * Which provider answers for a source.
 *
 * The built-in three register under their own `kind`; a registered one names
 * its provider, because its `kind` is the same word for all of them.
 */
export function sourceProviderKind(source: WorkingSource): string {
  return source.kind === 'registered' ? source.provider : source.kind
}

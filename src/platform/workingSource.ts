// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What you are working from (ADR-0005, ADR-0031 §4).
 *
 * The question the top bar did not answer: where is any of this kept? Both the
 * shell and the providers have to understand the answer and neither owns it,
 * so it lives here — and it is the same shape for every source there is,
 * because what kind of place it is belongs to the provider that answers for
 * it and to nobody above. The shell reads the provider's word for it, its
 * name, whether it may be written and whether anything in it outlives the
 * tab; what it is, the shell never asks.
 *
 * There is no working file among them on purpose: opening a `.lvarch` loads
 * its bytes into the scope that is open, so nobody ever works *from* the file.
 */
export type WorkingSource = {
  /** Which provider answers for it: the `kind` it registered under. */
  readonly provider: string
  /**
   * What it is called, as its provider names it — the name a person gave the
   * place, where they gave one, and nothing where the provider's own word for
   * it says it all.
   */
  readonly name: string
  /** What tells this one from another of the same provider — see {@link sourceKey}. */
  readonly key: string
  /**
   * Work here reads and does not write. A fact about the source rather than a
   * constant the workspace passes; absent means writable.
   */
  readonly readOnly?: boolean
  /**
   * Nothing here outlives this tab: the one source said in the warning
   * colour, because a person has to know before they rely on it.
   */
  readonly transient?: boolean
}

/**
 * What tells one working source from another, for the shell to be mounted
 * under.
 *
 * The composition root renders `App` under this as its key, so a change of
 * source is a fresh mount rather than a swap in place: the open scope, the
 * session and its undo stack, the index, the organisation's listing and every
 * watcher belong to one source, and a hook that read its repositories once at
 * mount would otherwise keep answering for the source that was open at the
 * boot. The provider and its own key, because two providers may well tell
 * their sources apart the same way and one of them being mounted over the
 * other is the bug this key exists to prevent; the name is not in it, because
 * two places with the same name are two places.
 */
export function sourceKey(source: WorkingSource): string {
  return `${source.provider}:${source.key}`
}

/**
 * May work be written here? The one question every mutating affordance
 * already asks, answered by the source instead of by a constant.
 */
export function sourceIsReadOnly(source: WorkingSource): boolean {
  return source.readOnly === true
}

/** Which provider answers for a source. */
export function sourceProviderKind(source: WorkingSource): string {
  return source.provider
}

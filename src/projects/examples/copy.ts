// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What an example is, and copying one in: everything about the examples but
 * the examples themselves.
 *
 * The domain's, not a screen's: where a copy lands is a rule about the tree
 * it lands in, and whoever copies one — the organisation's page, or a
 * process with no screen seeding an organisation — asks the same rule and
 * writes the copy the same way. What each example holds is kept apart and
 * fetched when one is copied (`catalogue.ts`).
 */
import type { ImageRepository } from '../../ports/ImageRepository'
import type { ScopeRepository } from '../../ports/ScopeRepository'
import { namesUnder } from '../scope'
import type { ScopeSnapshot, ScopeSummary } from '../scope'
import { blank, contentOf, picturesOf, placeTogether, readScope, summaryOf } from '../scopeAccess'
import type { ScopeReader } from '../scopeAccess'
import { ROOT_SCOPE, scopePathFor, scopePathLabel } from '../scopePath'
import type { ScopePath } from '../scopePath'

export type ExampleProject = {
  /** Stable key, for the picker and for tests. */
  key: string
  /** Where a copy lands. The user may be offered a different parent later. */
  path: ScopePath
  /** What the picker calls it. */
  label: string
  /** One line on what it shows. */
  description: string
  /** The scopes it holds, parents first, at their own paths under `path`. */
  scopes: readonly ScopeSnapshot[]
}

/**
 * Where a copy lands, which depends on what the root already is.
 *
 * **A root nobody has named, with nothing in it, BECOMES the example.** That is
 * the common case by a long way: somebody has just pointed the app at an empty
 * folder and wants to see what this thing does. Filing the example one level
 * down would leave them with an unnamed organisation sitting above a named one
 * for ever, and a home screen whose heading is blank — so the example's own
 * organisation takes the root, name and record and all, and the scopes under it
 * become the root's children.
 *
 * **A root that is already something takes it as a child.** A name, a scope
 * filed under it, or a board of its own: each is work somebody did, and writing
 * the example's organisation record over it would be losing it. The tree is
 * re-addressed under one new scope named after the example, with the ordinary
 * collision rule, so copying twice gives two rather than one overwritten one.
 *
 * **A root that holds records is something too**, with no name and no board:
 * an application an agent added, a decision left after its only view was
 * removed. A listing does not say what a scope holds, so the caller reads the
 * root and says (`rootHoldsWork`); the example is filed under it, never over it.
 *
 * A board of its own is not in the sentence the design asked for — it says "a
 * name or children" — and is here anyway: an unnamed root with a landscape
 * drawn in it is rare, and overwriting it would be the one mistake on this
 * screen nothing can undo.
 */
export function copyExampleInto(
  example: ExampleProject,
  root: ScopeSummary,
  rootHoldsWork = false,
): ScopeSnapshot[] {
  const fresh = !rootHoldsWork && root.name.trim() === '' && root.children.length === 0 && root.diagrams === 0
  const base = fresh
    ? ROOT_SCOPE
    : scopePathFor(ROOT_SCOPE, scopePathLabel(example.path), namesUnder(root))
  const readdress = (path: ScopePath): ScopePath => {
    if (path === example.path) return base
    const below = path.slice(example.path.length + 1)
    return base === ROOT_SCOPE ? below : `${base}/${below}`
  }
  return example.scopes.map((scope) => ({
    ...scope,
    path: readdress(scope.path),
    // A stand-in's `ref` is an address too (ADR-0012 §3), and an address that
    // was not carried over is a drifting stand-in of a folder that is not
    // there. The example ships at its own paths and lands wherever the root
    // sends it, so the two have to move together — which the drift check found
    // the moment it existed.
    model: {
      ...scope.model,
      elements: scope.model.elements.map(withRef(readdress)),
      // So is the scope a cause above names when it explains a cause below
      // (ADR-0032 §4): the organisation's root cause in the shipped example
      // explains one of the landscape's, wherever the landscape lands.
      ...(scope.model.causes ? { causes: scope.model.causes.map(withLinks(readdress)) } : {}),
    },
  }))
}

/**
 * Where a copy lands on the tree as it is kept now: {@link copyExampleInto}
 * over the root's listing, and over what the root holds, read — a listing
 * does not say that. Decided at the moment of copying, never on a tree read
 * earlier: a root read before its listing answered is nameless and empty,
 * and would be taken over whatever it holds.
 *
 * **A root that could not be read whole holds work**, whatever could be read
 * of it: what could not may be anything — a later version's organisation
 * reads as nameless and empty here — and so may a scope the listing could not
 * read.
 */
export async function exampleCopyOver(scopes: ScopeReader, example: ExampleProject): Promise<ScopeSnapshot[]> {
  const [tree, root] = await Promise.all([scopes.tree(), readScope(scopes, ROOT_SCOPE)])
  const unread = (root?.unreadable?.length ?? 0) > 0 || (tree.unreadable?.length ?? 0) > 0
  return copyExampleInto(example, summaryOf(tree), unread || (root !== undefined && !blank(root)))
}

/**
 * A copy written: each scope a content that arrives whole, the pictures'
 * bytes first, every one of them landed together or none
 * (`placeTogether`).
 */
export async function placeCopy(
  repositories: { scopes: ScopeReader & Pick<ScopeRepository, 'create' | 'apply' | 'remove'>; images: Pick<ImageRepository, 'put'> },
  copy: readonly ScopeSnapshot[],
): Promise<void> {
  await placeTogether(repositories, copy.map((scope) => ({
    address: scope.path, content: contentOf(scope, []), pictures: picturesOf(scope.imageLibrary),
  })))
}

/** One cause's links to a scope below, re-addressed. Untouched where it has none. */
function withLinks(readdress: (path: ScopePath) => ScopePath) {
  const carry = <T extends { scope?: string }>(held: T): T => (held.scope === undefined ? held : { ...held, scope: readdress(held.scope) })
  return (cause: NonNullable<ScopeSnapshot['model']['causes']>[number]) => {
    const named = cause.explains.some((link) => link.scope !== undefined) || (cause.history ?? []).some((event) => event.scope !== undefined)
    if (!named) return cause
    return { ...cause, explains: cause.explains.map(carry), ...(cause.history ? { history: cause.history.map(carry) } : {}) }
  }
}

/** One element's `ref`, re-addressed. Untouched where there is none. */
function withRef(readdress: (path: ScopePath) => ScopePath) {
  return (element: ScopeSnapshot['model']['elements'][number]) => (
    element.ref === undefined ? element : { ...element, ref: readdress(element.ref) }
  )
}


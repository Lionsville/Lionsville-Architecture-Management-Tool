// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What an example is, and copying one in: everything about the examples but
 * the examples themselves.
 *
 * Apart from `index.ts` because that file imports the shipped organisation,
 * which is the largest single thing in the app and wanted only on the one
 * screen a person copies it from. The screen imports this; the catalogue
 * arrives when an example is copied (`offers.ts`).
 */
import { stableJson } from '../../projects/text'
import { SCOPE_FILE, scopeFromFolder } from '../../projects/folderFormat'
import type { FolderFile } from '../../projects/folderFormat'
import { namesUnder } from '../../projects/scope'
import type { ScopeSnapshot, ScopeSummary } from '../../projects/scope'
import { joinScope, ROOT_SCOPE, scopePathFor, scopePathLabel } from '../../projects/scopePath'
import type { ScopePath } from '../../projects/scopePath'

/**
 * A scope's folder, as JSON: an object for each `.json` file it holds, and the
 * lines of each `.md` file — and, since format 5, the scopes filed under it,
 * whose files are simply deeper paths in the same map.
 */
export type ExampleFolder = Record<string, unknown>

export type ExampleProject = {
  /** Stable key, for the picker and for tests. */
  key: string
  /** Where a copy lands. The user may be offered a different parent later. */
  path: ScopePath
  /** What the picker calls it. */
  label: string
  /** One line on what it shows. */
  description: string
  /** The project, as the files the format writes. */
  folder: ExampleFolder
}

/**
 * The example's folder, as the files a reader of the format expects.
 *
 * Through {@link stableJson}, which is what the format writes with, so an
 * example edited by hand is read exactly as one saved by the app — the key
 * order in the shipped file is nobody's business but the reviewer's.
 */
export function exampleFiles(example: ExampleProject): FolderFile[] {
  return Object.entries(example.folder).map(([path, held]) => ({
    path,
    text: Array.isArray(held) ? (held as string[]).join('\n') : stableJson(held),
  }))
}

/**
 * The scopes the example holds, parents first, filed under where the entry
 * says.
 *
 * A tree rather than one document since format 5: an example is a folder like
 * any other, and a folder inside it that has a `scope.json` is a scope inside
 * it. Parents first so a copy that is interrupted leaves a tree that is whole
 * as far as it got.
 *
 * An empty answer would mean a shipped example this build cannot read, which
 * `examples.test.ts` is there to make impossible.
 */
export function exampleScopes(example: ExampleProject): ScopeSnapshot[] {
  const files = exampleFiles(example)
  const within = [...new Set(files
    .filter((file) => file.path.endsWith(SCOPE_FILE))
    .map((file) => file.path.slice(0, -SCOPE_FILE.length).replace(/\/$/, '')))]
    .sort()
  return within.flatMap((prefix) => {
    const inside = files
      .filter((file) => (prefix === '' ? true : file.path.startsWith(`${prefix}/`)))
      .filter((file) => !within.some((other) =>
        other !== prefix && other.length > prefix.length
        && file.path.startsWith(`${other}/`)))
      .map((file) => ({
        ...file,
        path: prefix === '' ? file.path : file.path.slice(prefix.length + 1),
      }))
    const scope = scopeFromFolder(inside, prefix === '' ? example.path : joinScope(example.path, prefix))
    return scope ? [scope] : []
  })
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
 * A board of its own is not in the sentence the design asked for — it says "a
 * name or children" — and is here anyway: an unnamed root with a landscape
 * drawn in it is rare, and overwriting it would be the one mistake on this
 * screen nothing can undo.
 */
export function copyExampleInto(
  example: ExampleProject,
  root: ScopeSummary,
): ScopeSnapshot[] {
  const fresh = root.name.trim() === '' && root.children.length === 0 && root.diagrams === 0
  const base = fresh
    ? ROOT_SCOPE
    : scopePathFor(ROOT_SCOPE, scopePathLabel(example.path), namesUnder(root))
  const readdress = (path: ScopePath): ScopePath => {
    if (path === example.path) return base
    const below = path.slice(example.path.length + 1)
    return base === ROOT_SCOPE ? below : `${base}/${below}`
  }
  return exampleScopes(example).map((scope) => ({
    ...scope,
    path: readdress(scope.path),
    // A stand-in's `ref` is an address too (ADR-0012 §3), and an address that
    // was not carried over is a drifting stand-in of a folder that is not
    // there. The example ships at its own paths and lands wherever the root
    // sends it, so the two have to move together — which the drift check found
    // the moment it existed.
    model: { ...scope.model, elements: scope.model.elements.map(withRef(readdress)) },
  }))
}

/** One element's `ref`, re-addressed. Untouched where there is none. */
function withRef(readdress: (path: ScopePath) => ScopePath) {
  return (element: ScopeSnapshot['model']['elements'][number]) => (
    element.ref === undefined ? element : { ...element, ref: readdress(element.ref) }
  )
}


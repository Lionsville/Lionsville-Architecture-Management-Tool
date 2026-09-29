// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The example organisations that ship with the app.
 *
 * **Fictional, and that is a rule rather than a preference.** A real customer's
 * landscape used to ship here — it was once "the shipped document", loaded at
 * boot. In a tool handed to other organisations that means every installer
 * carries one client's architecture to everybody else, and the first screen a
 * new user sees is somebody else's business. Whatever ships here is invented.
 *
 * An example is one entry in a catalogue. Opening one copies it into scopes of
 * the person's own, under the path the entry names; from that moment they are
 * theirs and nothing here is involved again. Adding one is a JSON file, an
 * entry in the app's `examples/offers.ts` and a line in {@link EXAMPLE_FOLDERS}.
 *
 * It has to be *good*, too. It is the first thing anyone opens, and a thin
 * example makes the tool look thin — so the shipped one is a landscape with
 * enough shape to show what the editor is for: every zone populated, domain
 * groups, aspects that are not all green, a system that is visibly on its way
 * out, and a container view under one of the applications.
 *
 * Examples are data, not configuration: the path is where a copy lands by
 * default, not a statement about who runs this app.

 * **An example is a tree.** Since format 5 the shipped one is two scopes — the
 * organisation, which carries its name and what it is, and the landscape under
 * it, which carries the model. The model is NOT split between them: every
 * `supports` and `assigned` row joining a capability to an application would
 * then dangle at one end, and the stand-ins that make a cross-scope id resolve
 * are ADR-0012 §2's, which is beta 3. So the split here is the one that costs
 * nothing: a name above a document.
 *
 * **An example is a project folder.** It was an interchange document until
 * format 4, and that format knew nothing about the business layer, plans or
 * decisions — which is why the plans and the decisions had to ride beside the
 * document in this file, in TypeScript, as a second mechanism. The working form
 * has a place for all of it, so there is one mechanism and the example is the
 * thing the tool writes. The document itself went with ADR-0018.
 *
 * The file is the folder's files, by path: an object per `.json` and an array
 * of lines per `.md`. Not the text of each file as one string, because a JSON
 * blob with a landscape escaped inside it is a file nobody can read or review;
 * not a zipped `.lvarch` either, because that is bytes, and a shipped example
 * should be the most readable thing in this directory. One `import` of one JSON
 * file, no build-tool features, and the reader is the format's own.
 */
import { SCOPE_FILE, scopeFromFolder } from '../../../projects/folderFormat'
import type { FolderFile } from '../../../projects/folderFormat'
import type { ScopeSnapshot } from '../../../projects/scope'
import { joinScope } from '../../../projects/scopePath'
import type { ScopePath } from '../../../projects/scopePath'
import { stableJson } from '../../../projects/text'

/**
 * A scope's folder, as JSON: an object for each `.json` file it holds, and the
 * lines of each `.md` file — and, since format 5, the scopes filed under it,
 * whose files are simply deeper paths in the same map.
 */
export type ExampleFolder = Record<string, unknown>

/**
 * The example's folder, as the files a reader of the format expects.
 *
 * Through {@link stableJson}, which is what the format writes with, so an
 * example edited by hand is read exactly as one saved by the app — the key
 * order in the shipped file is nobody's business but the reviewer's.
 */
export function exampleFiles(folder: ExampleFolder): FolderFile[] {
  return Object.entries(folder).map(([path, held]) => ({
    path,
    text: Array.isArray(held) ? (held as string[]).join('\n') : stableJson(held),
  }))
}

/**
 * The scopes the example holds, parents first, filed under `path`.
 *
 * A tree rather than one document since format 5: an example is a folder like
 * any other, and a folder inside it that has a `scope.json` is a scope inside
 * it. Parents first so a copy that is interrupted leaves a tree that is whole
 * as far as it got.
 *
 * An empty answer would mean a shipped example this build cannot read, which
 * `examples.test.ts` is there to make impossible.
 */
export function exampleScopes(folder: ExampleFolder, path: ScopePath): ScopeSnapshot[] {
  const files = exampleFiles(folder)
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
    const scope = scopeFromFolder(inside, prefix === '' ? path : joinScope(path, prefix))
    return scope ? [scope] : []
  })
}

/**
 * The folder of each example that ships, by its key, fetched when somebody
 * copies it: the shipped organisation is the largest single file in the app,
 * and wanted on one screen, by a place with nothing in it yet, once.
 */
export const EXAMPLE_FOLDERS: Readonly<Record<string, () => Promise<ExampleFolder>>> = {
  'acme-logistics': () => import('./examples/acme-logistics.json').then((held) => held.default as ExampleFolder),
}

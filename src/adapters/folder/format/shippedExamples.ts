// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The examples that ship, by their key: each the scopes it holds, fetched and
 * read when somebody copies it.
 *
 * Apart from the reader (`exampleFolder.ts`), and loading it only when asked,
 * so the catalogue costs the first download nothing: the shipped organisation
 * is the largest single file in the app, and its reader is the whole folder
 * format — both wanted on one screen, by a place with nothing in it yet, once.
 */
import type { ScopeSnapshot } from '../../../projects/scope'
import type { ScopePath } from '../../../projects/scopePath'
import type { ExampleFolder } from './exampleFolder'

/** An example's folder, fetched, read as its scopes filed under `path`. */
async function shipped(folder: () => Promise<{ default: unknown }>, path: ScopePath): Promise<ScopeSnapshot[]> {
  const [{ exampleScopes }, held] = await Promise.all([import('./exampleFolder'), folder()])
  return exampleScopes(held.default as ExampleFolder, path)
}

export const SHIPPED_EXAMPLES: Readonly<Record<string, (path: ScopePath) => Promise<ScopeSnapshot[]>>> = {
  // With its attribute: node reads a JSON module only when it is told it is one
  // (`build/jsonImports.test.ts`), and a server seeds from this path.
  'acme-logistics': (path) => shipped(() => import('./examples/acme-logistics.json', { with: { type: 'json' } }), path),
}

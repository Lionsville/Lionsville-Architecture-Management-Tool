// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The examples that ship, in hand: for the suites, which read what an example
 * holds without waiting for it to be fetched, and read its folder too where
 * what is under test is the folder it is.
 */
import acmeLogistics from '../../adapters/folder/format/examples/acme-logistics.json'
import { exampleFiles as filesOf, exampleScopes as scopesOf } from '../../adapters/folder/format/exampleFolder'
import type { ExampleFolder } from '../../adapters/folder/format/exampleFolder'
import type { FolderFile } from '../../adapters/folder/format/folderFormat'
import type { ScopeSnapshot } from '../../projects/scope'
import type { ExampleProject } from '../examples/copy'
import { EXAMPLE_CATALOGUE } from '../examples/offers'

/** An example as it ships: its scopes, and the folder they were read from. */
export type ShippedExample = ExampleProject & { folder: ExampleFolder }

const FOLDERS: Readonly<Record<string, ExampleFolder>> = { 'acme-logistics': acmeLogistics }

export const EXAMPLES: readonly ShippedExample[] = EXAMPLE_CATALOGUE.map((entry) => ({
  ...entry, folder: FOLDERS[entry.key], scopes: scopesOf(FOLDERS[entry.key], entry.path),
}))

/** The scopes an example holds, parents first. */
export function exampleScopes(example: ExampleProject): ScopeSnapshot[] {
  return [...example.scopes]
}

/** An example's folder, as the files a reader of the format expects. */
export function exampleFiles(example: ShippedExample): FolderFile[] {
  return filesOf(example.folder)
}

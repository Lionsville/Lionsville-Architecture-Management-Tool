// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The examples that ship, for a process with no screen: a server that keeps
 * an organisation in repositories of its own and seeds one from an example,
 * or hands one out as a working file.
 *
 * What an example is called and where a copy lands are the domain's
 * (`projects/examples/`); what each holds ships in the folder's own format,
 * read by that format's own reader (`adapters/folder/format/shippedExamples.ts`),
 * which is the one part of the implementations this folder may read. So a
 * caller here gets an example the way the organisation's page does — its
 * scopes, where a copy lands, the copy written — or as the working file a
 * person would be handed, and names no format.
 */
import { EXAMPLE_CATALOGUE } from '../../projects/examples/catalogue'
import type { ExampleEntry } from '../../projects/examples/catalogue'
import { exampleCopyOver, placeCopy } from '../../projects/examples/copy'
import type { ExampleProject } from '../../projects/examples/copy'
import type { ScopePath } from '../../projects/scopePath'
import { carryScopes } from '../../adapters/folder/format/interchange'
import type { CarriedFrom, CarriedOut } from '../../adapters/folder/format/interchange'
import { SHIPPED_EXAMPLES } from '../../adapters/folder/format/shippedExamples'

export type { ExampleEntry, ExampleProject }

/** What a copy is written into: the scopes, and where the pictures' bytes are put. */
export type SeededInto = CarriedFrom

/** The examples that ship: what each is called, and where a copy lands by default. */
export const SHIPPED: readonly ExampleEntry[] = EXAMPLE_CATALOGUE.filter((entry) => SHIPPED_EXAMPLES[entry.key] !== undefined)

/** One example, with the scopes it holds at their own addresses; `undefined` for a key that does not ship. */
export async function shippedExample(key: string): Promise<ExampleProject | undefined> {
  const entry = EXAMPLE_CATALOGUE.find((held) => held.key === key)
  const load = SHIPPED_EXAMPLES[key]
  if (!entry || !load) return undefined
  return { ...entry, scopes: await load(entry.path) }
}

/**
 * One example as a working file, its top scope at `at` — the organisation
 * where absent — as a person would be handed it: bytes, a name and a media
 * type. `undefined` for a key that does not ship.
 */
export async function exampleWorkingFile(key: string, options: { at?: ScopePath } = {}): Promise<CarriedOut | undefined> {
  const entry = EXAMPLE_CATALOGUE.find((held) => held.key === key)
  const load = SHIPPED_EXAMPLES[key]
  if (!entry || !load) return undefined
  return carryScopes(await load(options.at ?? ''))
}

/**
 * One example copied into the repositories, where the organisation's page
 * would copy it: the organisation itself where the root is blank, and a scope
 * of its own under it where the root holds work (`copyExampleInto`). Every
 * scope lands whole, together or not at all. Answers the addresses written,
 * the top first; `undefined` for a key that does not ship.
 */
export async function seedExample(repositories: SeededInto, key: string): Promise<readonly ScopePath[] | undefined> {
  const example = await shippedExample(key)
  if (!example) return undefined
  const copy = await exampleCopyOver(repositories.scopes, example)
  await placeCopy(repositories, copy)
  return copy.map((scope) => scope.path)
}

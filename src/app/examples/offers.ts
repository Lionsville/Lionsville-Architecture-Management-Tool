// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The examples as the organisation's page offers them: what each is called,
 * and the organisation itself only when somebody copies it.
 *
 * The shipped organisation is the largest single file in the app, and it is
 * wanted on one screen, by a folder with nothing in it yet, once. Everybody
 * else — every reload of every environment that already holds work — would
 * download it for nothing, so it is its own script, fetched by the press that
 * copies it.
 */
import type { ScopeSnapshot } from '../../projects/scope'
import type { ExampleProject } from './copy'

/** What an example is called, where it lands, and what it shows: everything but what it holds. */
export type ExampleEntry = Omit<ExampleProject, 'scopes'>

/** An example on offer: one in hand, or one whose scopes are fetched when it is copied. */
export type ExampleOffer = ExampleProject | (ExampleEntry & { load(): Promise<readonly ScopeSnapshot[]> })

/** The example itself, fetched where it was not in hand. */
export async function exampleOf(offer: ExampleOffer): Promise<ExampleProject> {
  if ('scopes' in offer) return offer
  const { load, ...rest } = offer
  return { ...rest, scopes: await load() }
}

/**
 * The examples that ship, as the organisation's page names them. What each
 * holds is fetched by the composition root when one is copied, from where the
 * shipped examples are kept.
 */
export const EXAMPLE_CATALOGUE: readonly ExampleEntry[] = [
  {
    key: 'acme-logistics',
    path: 'acme-logistics',
    label: 'Acme Logistics · application landscape',
    description: 'A parcel and pallet operator: order to delivery, the warehouse under it, and what it bills.',
  },
]

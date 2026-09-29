// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The examples that ship, as they are offered: what each is called, and the
 * organisation itself only when somebody copies it.
 *
 * The shipped organisation is the largest single file in the app, and it is
 * wanted on one screen, by an organisation with nothing in it yet, once.
 * Everybody else — every reload of every environment that already holds work
 * — would download it for nothing, so it is its own script, fetched by the
 * press that copies it. What each holds is read where the shipped examples
 * are kept, by whoever composes the offers: the app's composition root, and
 * a process with no screen through `platform/node/examples.ts`.
 */
import type { ScopeSnapshot } from '../scope'
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
 * The examples that ship, as they are named. What each holds is fetched when
 * one is copied, from where the shipped examples are kept.
 */
export const EXAMPLE_CATALOGUE: readonly ExampleEntry[] = [
  {
    key: 'acme-logistics',
    path: 'acme-logistics',
    label: 'Acme Logistics · application landscape',
    description: 'A parcel and pallet operator: order to delivery, the warehouse under it, and what it bills.',
  },
]

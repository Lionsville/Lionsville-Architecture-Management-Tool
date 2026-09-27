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
import type { ExampleFolder, ExampleProject } from './copy'

/** An example on offer: one in hand, or one that is fetched when it is copied. */
export type ExampleOffer =
  | ExampleProject
  | (Omit<ExampleProject, 'folder'> & { load(): Promise<ExampleFolder> })

/** The example itself, fetched where it was not in hand. */
export async function exampleOf(offer: ExampleOffer): Promise<ExampleProject> {
  if ('folder' in offer) return offer
  const { load, ...rest } = offer
  return { ...rest, folder: await load() }
}

export const EXAMPLE_OFFERS: readonly ExampleOffer[] = [
  {
    key: 'acme-logistics',
    path: 'acme-logistics',
    label: 'Acme Logistics · application landscape',
    description: 'A parcel and pallet operator: order to delivery, the warehouse under it, and what it bills.',
    load: () => import('./acme-logistics.json').then((held) => held.default as ExampleFolder),
  },
]

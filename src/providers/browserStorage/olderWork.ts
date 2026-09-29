// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The work this browser's older storage kept, shown in memory where its
 * database will not open: read, never moved — the older storage is left
 * exactly as it was, and nothing done here is kept.
 */
import { memoryRepositories } from '../../adapters/memory/memoryRepositories'
import type { KeyValueStorage } from '../../adapters/webStorage/KeyValueStorage'
import { readEarlier } from '../../adapters/webStorage/earlierScopes'
import type { Repositories } from '../../ports/Repositories'
import { placeTogether } from '../../projects/scopeAccess'

/** Memory holding what the older storage kept, and whether it held anything. */
export async function olderWorkInMemory(storage: KeyValueStorage, by?: string): Promise<{ repositories: Repositories; shown: boolean }> {
  const repositories = memoryRepositories(undefined, by)
  const reading = await readEarlier(storage)
  if (reading.scopes.length === 0) return { repositories, shown: false }
  await placeTogether(repositories, reading.scopes.map((one) => ({
    address: one.address,
    content: { ...one.content, images: [] },
    pictures: one.content.images.flatMap((image) => {
      const held = one.bytes.find((kept) => kept.contentAddress === image.contentAddress)
      return held ? [{ name: image.name, bytes: held.bytes }] : []
    }),
  })))
  return { repositories, shown: true }
}

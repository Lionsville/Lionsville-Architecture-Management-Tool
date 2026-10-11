// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The libraries that ship with the app (ADR-0036 §5), in the order the page
 * lists them. Read-only: the organisation's model is what changes.
 */
import type { Library } from '../library'
import { IT4IT } from './it4it'
import { SAFE } from './safe'
import { SCRUM } from './scrum'
import { TEAM_TOPOLOGIES } from './teamTopologies'

export const LIBRARIES: readonly Library[] = [SCRUM, SAFE, IT4IT, TEAM_TOPOLOGIES]

/** A shipped library, by the id an item's `basedOn` names. */
export function libraryById(id: string, from: readonly Library[] = LIBRARIES): Library | undefined {
  return from.find((library) => library.id === id)
}

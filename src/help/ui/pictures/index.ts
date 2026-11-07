// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Each chapter's picture of the screen: small screens built in HTML with the
 * kit's tokens and parts, so they are sharp at any size, follow light and dark,
 * and say the app's own words for its controls. A build composed from this one
 * adds the pictures of its chapters with `addHelpPicture`.
 */
import type { ComponentType } from 'react'

export const PICTURES: Record<string, ComponentType> = {}

export function addHelpPicture(chapter: string, picture: ComponentType): void {
  PICTURES[chapter] = picture
}

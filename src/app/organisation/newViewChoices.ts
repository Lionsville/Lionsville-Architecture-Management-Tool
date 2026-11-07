// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The kinds of view a scope can be given, said once: a home's *New view…*, a
 * tree row's and an empty scope's first step offer the same seven. A landscape
 * asks for its name; the others are made as the scope opens on them.
 */
import type { StringKey, Translate } from '../../i18n'

/** The kinds a home makes besides a landscape, in the order its menu offers them. */
export type MadeKind = 'sheet' | 'map' | 'technology' | 'drawing' | 'chart' | 'conway'

const MADE: readonly { kind: MadeKind; label: StringKey }[] = [
  { kind: 'sheet', label: 'org.newBoardSheet' },
  { kind: 'map', label: 'org.newBoardMap' },
  { kind: 'technology', label: 'org.newBoardTechnology' },
  { kind: 'drawing', label: 'org.newBoardDrawing' },
  { kind: 'chart', label: 'org.newBoardChart' },
  { kind: 'conway', label: 'org.newBoardConway' },
]

export type NewViewChoice = { readonly label: string; readonly onSelect: () => void; readonly 'data-testid': string }

export function newViewChoices(s: Translate, onLandscape: () => void, onMake: (kind: MadeKind) => void): NewViewChoice[] {
  return [
    { label: s('org.newBoardLandscape'), onSelect: onLandscape, 'data-testid': 'new-board-landscape' },
    ...MADE.map(({ kind, label }) => ({ label: s(label), onSelect: () => onMake(kind), 'data-testid': `new-board-${kind}` })),
  ]
}

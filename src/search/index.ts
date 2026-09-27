// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * One search over everything: every kind of record a scope holds, as each
 * kind declares it (`model/searchable.ts`), across the tree. `⌘K` opens it;
 * `⌘F` is the element-only one on the canvas.
 */
export { searchAll, scopeSources, treeSources } from './search'
export type { SearchHit, SearchSource } from './search'
export { searchElements } from './elementSearch'
export { GlobalSearchDialog } from './ui/GlobalSearchDialog'
export { ElementSearchDialog } from './ui/ElementSearchDialog'

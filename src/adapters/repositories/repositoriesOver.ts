// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The five repositories over one keyed store (ADR-0031 §1): the arithmetic
 * memory and this browser's storage share, written once. What differs between
 * them is where the values sit (`KeyedStore`) and what a new store starts with.
 */
import type { Repositories } from '../../ports/Repositories'
import type { KeyedStore } from './KeyedStore'
import { KeptHistory } from './KeptHistory'
import { KeptImages } from './KeptImages'
import { KeptIndex } from './KeptIndex'
import { KeptScopes } from './KeptScopes'
import { KeptSettings } from './KeptSettings'
import { Source } from './source'
import type { SourceOptions } from './source'

export function repositoriesOver(store: KeyedStore, options: SourceOptions): Repositories {
  return repositoriesOn(new Source(store, options))
}

/** The five over a source already made, for an implementation that also answers through it (`Source.bring`). */
export function repositoriesOn(source: Source): Repositories {
  return {
    scopes: new KeptScopes(source),
    index: new KeptIndex(source),
    history: new KeptHistory(source),
    images: new KeptImages(source),
    settings: new KeptSettings(source),
  }
}

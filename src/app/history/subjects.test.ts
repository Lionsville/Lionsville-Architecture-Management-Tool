// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { indexScopes } from '../../projects/scopeIndex'
import { recordOf, scopesOf } from './subjects'

const erp = { id: 'erp', kind: 'application', name: 'ERP', lifecycle: 'live', isManaged: false, aspects: {} } as const

describe('what a history is asked about', () => {
  it('asks for a view, a decision and an element page as the records they are', () => {
    expect(recordOf({ what: 'diagram', id: 'l7' })).toEqual({ kind: 'diagram', id: 'l7' })
    expect(recordOf({ what: 'decision', id: 'adr-1' })).toEqual({ kind: 'decision', id: 'adr-1' })
    expect(recordOf({ what: 'description', id: 'erp' })).toEqual({ kind: 'element', id: 'erp' })
  })

  it('asks this scope about a view, and every scope that holds the id about an element', () => {
    const index = indexScopes([
      { path: 'acme', model: { elements: [erp], relations: [] } },
      { path: 'acme/rail', model: { elements: [{ ...erp, ref: 'acme' }], relations: [] } },
      { path: 'globex', model: { elements: [], relations: [] } },
    ])
    expect(scopesOf({ what: 'diagram', id: 'l7' }, 'acme/rail', index)).toEqual(['acme/rail'])
    expect(scopesOf(undefined, 'acme/rail', index)).toEqual(['acme/rail'])
    expect(scopesOf({ what: 'description', id: 'erp' }, 'acme/rail', index)).toEqual(['acme/rail', 'acme'])
    expect(scopesOf({ what: 'description', id: 'erp' }, 'globex')).toEqual(['globex'])
  })
})

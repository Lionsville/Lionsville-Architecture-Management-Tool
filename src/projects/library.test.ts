/**
 * The register as a library (ADR-0012 §2, §3): what drawing an application
 * the organisation already has means for the scope that draws it.
 *
 * The rule under test is that drawing never moves ownership — a domain's
 * application drawn on the landscape above it stays the domain's — and that
 * an application nobody defines is a question rather than a default.
 */
import { describe, expect, it } from 'vitest'
import type { DesignElement } from '../model'
import { isLibraryRefusal, libraryRows, planFromLibrary } from './library'
import { indexScopes } from './scopeIndex'
import type { ScopeModel } from './scope'

function element(id: string, over: Partial<DesignElement> = {}): DesignElement {
  return { id, kind: 'application', name: id, lifecycle: 'live', isManaged: true, aspects: {}, ...over }
}

const scope = (path: string, elements: DesignElement[]): ScopeModel =>
  ({ path, model: { elements, relations: [] } })

const board = (...ids: string[]) => ({ kind: 'layer7' as const, members: ids.map((id) => ({ id })) })

const index = indexScopes([
  scope('', [element('portal', { name: 'Portal' }), element('crm', { name: 'CRM' })]),
  scope('acme', [element('crm', { name: 'CRM', ref: '' })]),
  scope('acme/retail', [element('erp', { name: 'Retail ERP' }), element('wms', { name: 'WMS', ref: 'acme/logistics' })]),
  scope('acme/logistics', [element('wms', { name: 'WMS' })]),
  scope('acme/finance', [element('ledger', { name: 'Ledger', ref: 'acme/accounting' })]),
  scope('acme/hr', [element('ledger', { name: 'Ledger', ref: 'acme/accounting' })]),
])

describe('libraryRows', () => {
  it('lists every application in the organisation that is not on this board, and says which this scope holds', () => {
    const rows = libraryRows(index, { elements: [element('crm', { ref: '' })] }, board('portal'))
    expect(rows.map((row) => row.id)).toEqual(['crm', 'ledger', 'erp', 'wms'])
    expect(rows.find((row) => row.id === 'crm')).toEqual({ id: 'crm', name: 'CRM', master: '', held: true })
    expect(rows.find((row) => row.id === 'ledger')).toEqual({ id: 'ledger', name: 'Ledger', held: false })
  })
})

describe('planFromLibrary', () => {
  it('only draws a record this scope already holds', () => {
    const plan = planFromLibrary({
      id: 'crm', scope: 'acme', model: { elements: [element('crm', { name: 'Our CRM', ref: '' })] },
      diagram: board(), index,
    })
    expect(plan).toEqual({ kind: 'draw', id: 'crm', name: 'Our CRM' })
  })

  it('draws a stand-in of an application a scope beneath defines, and leaves ownership there', () => {
    const plan = planFromLibrary({ id: 'erp', scope: 'acme', model: { elements: [] }, diagram: board(), index })
    expect(plan).toEqual({
      kind: 'standIn',
      owner: 'acme/retail',
      element: {
        id: 'erp', kind: 'application', name: 'Retail ERP', ref: 'acme/retail',
        lifecycle: 'live', isManaged: false, aspects: {},
      },
    })
  })

  it('does the same for one a sibling or the organisation defines: drawing is never a claim', () => {
    const sibling = planFromLibrary({ id: 'wms', scope: 'acme/retail', model: { elements: [] }, diagram: board(), index })
    expect(sibling).toMatchObject({ kind: 'standIn', owner: 'acme/logistics' })
    const above = planFromLibrary({ id: 'portal', scope: 'acme/retail', model: { elements: [] }, diagram: board(), index })
    expect(above).toMatchObject({ kind: 'standIn', owner: '', element: { ref: '' } })
  })

  it('asks about one nobody defines, offering ownership here or one more stand-in at the same address', () => {
    const plan = planFromLibrary({ id: 'ledger', scope: 'acme/retail', model: { elements: [] }, diagram: board(), index })
    expect(plan).toEqual({
      kind: 'unowned', id: 'ledger', name: 'Ledger',
      own: { id: 'ledger', kind: 'application', name: 'Ledger', lifecycle: 'live', isManaged: true, aspects: {} },
      drawOnly: {
        id: 'ledger', kind: 'application', name: 'Ledger', ref: 'acme/accounting',
        lifecycle: 'live', isManaged: false, aspects: {},
      },
    })
  })

  it('refuses what is on the board already, what the register does not know, and a view that draws no cards', () => {
    const drawn = planFromLibrary({ id: 'erp', scope: 'acme', model: { elements: [] }, diagram: board('erp'), index })
    expect(drawn).toEqual({ refused: 'library.alreadyDrawn' })
    const unknown = planFromLibrary({ id: 'nope', scope: 'acme', model: { elements: [] }, diagram: board(), index })
    expect(unknown).toEqual({ refused: 'library.unknownId' })
    const sheet = planFromLibrary({
      id: 'erp', scope: 'acme', model: { elements: [] }, diagram: { kind: 'sheet', members: [] }, index,
    })
    expect(sheet).toEqual({ refused: 'library.notABoard' })
    expect(isLibraryRefusal(sheet)).toBe(true)
  })
})

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { DEFAULT_TRANSLATE } from '../i18n/strings'
import type { Command, DesignElement } from '../model'
import type { HostModel } from '../model/hostModel'
import { fromArrays, toArrays } from '../model/normalised'
import { apply } from '../model/reducer'
import { indexScopes } from '../projects/scopeIndex'
import { sheetClaimsFor, sheetDomainsFor, takenUpHere } from './sheetMapping'

const fn = (id: string, name: string, over: Partial<DesignElement> = {}): DesignElement => ({
  id, kind: 'function', name, lifecycle: 'live', isManaged: true, aspects: {}, ...over,
})
const NAMES: Record<string, string> = { '': 'Acme', retail: 'Retail', 'retail/shops': 'Shops', wholesale: 'Wholesale' }
const scopeName = (path: string) => NAMES[path] ?? path

const top: HostModel = { name: 'Acme', elements: [fn('billing', 'Billing', { scopes: ['retail'] }), fn('invoicing', 'Invoicing', { parentId: 'billing' }), fn('returns', 'Returns')], relations: [], diagrams: [] }
const retail: HostModel = {
  name: 'Retail',
  elements: [{ ...fn('billing', 'Billing'), ref: '', isManaged: false }],
  relations: [],
  diagrams: [{ id: 'sh', kind: 'sheet', name: 'Our part', areas: ['billing'], members: [] }],
}
const index = indexScopes([
  { path: '', model: top, unitTypeId: undefined },
  { path: 'retail', model: retail, unitTypeId: 'ut-domain' },
  { path: 'retail/shops', model: { elements: [], relations: [] } },
  { path: 'wholesale', model: { elements: [], relations: [] } },
].map(({ unitTypeId, ...one }) => ({ ...one, ...(unitTypeId ? { unitTypeId } : {}) })))

describe('the inspector’s Domains', () => {
  const domains = sheetDomainsFor({ index, scope: '', model: top, scopeName, s: DEFAULT_TRANSLATE })

  it('offers every scope below the one that defines it, by its trail, less the ones it is handed to', () => {
    expect(domains.choices('billing').map((one) => one.label)).toEqual(['Retail › Shops', 'Wholesale'])
    expect(domains.choices('returns').map((one) => one.id)).toEqual(['retail', 'retail/shops', 'wholesale'])
  })

  it('names a scope by its trail and says who took a function up', () => {
    expect(domains.name('retail/shops')).toBe('Retail › Shops')
    expect([domains.known?.('retail'), domains.known?.('gone'), domains.known?.('')]).toEqual([true, false, true])
    expect(domains.takenUpBy('billing')).toEqual(['retail'])
    expect(domains.takenUpBy('returns')).toEqual([])
  })

  it('is the same answer for the same model, index and scope', () => {
    expect(sheetDomainsFor({ index, scope: '', model: top, scopeName, s: DEFAULT_TRANSLATE })).toBe(sheetDomainsFor({ index, scope: '', model: top, scopeName, s: DEFAULT_TRANSLATE }))
  })
})

describe('the band’s reading', () => {
  it('is what the scopes below took up', () => {
    expect([...takenUpHere(index, '')]).toEqual(['billing'])
    expect(takenUpHere(index, '')).toBe(takenUpHere(index, ''))
  })
})

describe('From above…', () => {
  /** A session over the retail scope: every dispatch is one step on a stack ⌘Z takes back. */
  function session() {
    let model = fromArrays(retail)
    const undo: Command[] = []
    return {
      current: () => toArrays(model),
      dispatch: (command: Command) => {
        const applied = apply(model, command)
        if (!applied.ok) throw new Error(applied.reason)
        model = applied.model
        undo.push(applied.inverse)
      },
      undo: () => {
        const applied = apply(model, undo.pop()!)
        if (!applied.ok) throw new Error(applied.reason)
        model = applied.model
      },
      steps: () => undo.length,
    }
  }

  it('offers the functions above that this scope does not hold, grouped by where each is defined', () => {
    const at = session()
    const claims = sheetClaimsFor({
      index, scope: 'retail', model: retail, scopeName, s: DEFAULT_TRANSLATE,
      current: () => ({ model: at.current(), sheet: at.current().diagrams[0] }), dispatch: at.dispatch,
    })!
    expect(claims.choices).toEqual([
      { id: 'invoicing', label: 'Invoicing', group: 'Acme', note: 'in Billing' },
      { id: 'returns', label: 'Returns', group: 'Acme' },
    ])
  })

  it('takes one up as one step, drawn on the sheet, that ⌘Z takes back whole', () => {
    const at = session()
    const claims = sheetClaimsFor({
      index, scope: 'retail', model: retail, scopeName, s: DEFAULT_TRANSLATE,
      current: () => ({ model: at.current(), sheet: at.current().diagrams[0] }), dispatch: at.dispatch,
    })!
    claims.claim('returns')
    expect(at.steps()).toBe(1)
    expect(at.current().elements.find((one) => one.id === 'returns')).toMatchObject({ ref: '', isManaged: false, name: 'Returns' })
    expect(at.current().diagrams[0].areas).toEqual(['billing', 'returns'])
    claims.claim('invoicing')
    expect(at.current().elements.find((one) => one.id === 'invoicing')?.parentId).toBe('billing')
    at.undo()
    at.undo()
    expect(at.current()).toEqual(toArrays(fromArrays(retail)))
  })

  it('takes an area up after its capability as one step, filing the capability under it', () => {
    const wholesale: HostModel = {
      name: 'Wholesale',
      elements: [{ ...fn('invoicing', 'Invoicing'), ref: '', isManaged: false }],
      relations: [],
      diagrams: [{ id: 'sh-w', kind: 'sheet', name: 'Ours', areas: ['invoicing'], members: [] }],
    }
    let model = fromArrays(wholesale)
    const undo: Command[] = []
    const claims = sheetClaimsFor({
      index, scope: 'wholesale', model: wholesale, scopeName, s: DEFAULT_TRANSLATE,
      current: () => ({ model: toArrays(model), sheet: toArrays(model).diagrams[0] }),
      dispatch: (command) => {
        const applied = apply(model, command)
        if (!applied.ok) throw new Error(applied.reason)
        model = applied.model
        undo.push(applied.inverse)
      },
    })!
    claims.claim('billing')
    expect(undo).toHaveLength(1)
    expect(toArrays(model).elements.find((one) => one.id === 'invoicing')?.parentId).toBe('billing')
    expect(toArrays(model).diagrams[0].areas).toEqual(['billing'])
    const back = apply(model, undo[0])
    if (!back.ok) throw new Error(back.reason)
    expect(toArrays(back.model)).toEqual(toArrays(fromArrays(wholesale)))
  })

  it('says so when a pick lands nothing: held already, or not one to take up any more', () => {
    const at = session()
    const told: [string, string | undefined][] = []
    const claims = sheetClaimsFor({
      index, scope: 'retail', model: retail, scopeName, s: DEFAULT_TRANSLATE,
      current: () => ({ model: at.current(), sheet: at.current().diagrams[0] }), dispatch: at.dispatch,
      notify: (message, severity) => { told.push([message, severity]) },
    })!
    claims.claim('billing')
    claims.claim('gone')
    expect(at.steps()).toBe(0)
    expect(told).toEqual([
      ['Billing is taken up here already.', 'info'],
      ['gone was not taken up: it is no longer a function of a scope above this one.', 'warning'],
    ])
  })

  it('offers nothing at the organisation, which has nothing above it', () => {
    expect(sheetClaimsFor({ index, scope: '', model: top, scopeName, s: DEFAULT_TRANSLATE, current: () => ({ model: top, sheet: undefined }), dispatch: () => {} })).toBeUndefined()
  })
})

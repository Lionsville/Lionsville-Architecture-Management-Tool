/**
 * What one scope may change about one element (ADR-0012 §10).
 *
 * Three of these are the ones a reader is most likely to get backwards. A
 * DECLARATION is a definition and stays fully editable — it is this scope's
 * own record, and what says it is a copy is the drift check rather than a
 * locked field. An id the tree has never heard of is this scope's own, because
 * that is every element drawn in the last second and every session opened
 * before anything listed the tree. And the LIVE record wins over the index,
 * which is rebuilt twice a session and never on a keystroke.
 */
import { describe, expect, it } from 'vitest'
import type { DesignElement } from '../model'
import { FIXED_ON_A_STANDIN, isOwnerDetail, mayApplyPatch, mayEdit, mayEditField } from './mayEdit'
import { indexScopes } from './scopeIndex'
import type { ScopeModel } from './scope'

function element(id: string, over: Partial<DesignElement> = {}): DesignElement {
  return {
    id, kind: 'application', name: id, lifecycle: 'live', isManaged: false, aspects: {}, ...over,
  }
}

const scope = (path: string, elements: DesignElement[]): ScopeModel =>
  ({ path, model: { elements, relations: [] } })

const index = indexScopes([
  scope('', [element('erp', { name: 'ERP' })]),
  scope('acme/retail', [element('erp', { name: 'Retail ERP' }), element('wms')]),
  scope('acme/finance', [element('erp', { ref: 'acme/retail', name: 'Retail ERP' })]),
  scope('acme/legal', [element('crm', { ref: 'acme/sales' })]),
])

describe('mayEdit', () => {
  it('gives the owning scope everything', () => {
    expect(mayEdit('erp', 'acme/retail', index)).toEqual({ all: true })
  })

  it('gives a scope holding a stand-in the owner, and not everything', () => {
    expect(mayEdit('erp', 'acme/finance', index)).toEqual({ all: false, owner: 'acme/retail' })
  })

  /**
   * A definition above the master. It yielded, and from then on its name is a
   * cache the drift check watches — but it is still this scope's record, and
   * §10's first rule says a definition this scope holds may be edited.
   */
  it('leaves a declaration fully editable', () => {
    expect(mayEdit('erp', '', index)).toEqual({ all: true })
  })

  it('still refuses the detail of a stand-in nobody defines, with no owner to name', () => {
    expect(mayEdit('crm', 'acme/legal', index)).toEqual({ all: false })
  })

  it('lets a scope edit an id the tree has never heard of', () => {
    expect(mayEdit('drawn-just-now', 'acme/finance', index)).toEqual({ all: true })
  })

  /**
   * The index is read when the app starts and when the folder changes, never
   * on a keystroke — so a record made or linked a second ago is not in it, and
   * a page consulting only the index would grey out a field on a record it had
   * just made.
   */
  it('believes the record in front of it over the index', () => {
    // The index says retail owns `wms` outright; the live record says this
    // scope has since made its own copy a stand-in.
    expect(mayEdit('wms', 'acme/retail', index, { ref: 'acme/finance' }))
      .toEqual({ all: false, owner: 'acme/retail' })
    // And the other way: the index says finance holds a stand-in, the record
    // says it is a definition now.
    expect(mayEdit('erp', 'acme/finance', index, {})).toEqual({ all: true })
  })
})

describe('mayEditField', () => {
  it('refuses the owner\'s detail on a stand-in, as a value with a key', () => {
    expect(mayEditField('lifecycle', 'erp', 'acme/finance', index))
      .toEqual({ refused: 'check.ownedElsewhere', owner: 'acme/retail' })
    expect(mayEditField('vendor', 'erp', 'acme/finance', index))
      .toEqual({ refused: 'check.ownedElsewhere', owner: 'acme/retail' })
  })

  /**
   * The three things a stand-in may say for itself: its perspective, how this
   * scope draws it, and where it sits on this scope's own trees.
   */
  it('allows the perspective, the presentation and the placing', () => {
    for (const field of ['description', 'accentColor', 'iconKey', 'parentId', 'order'] as const) {
      expect(mayEditField(field, 'erp', 'acme/finance', index), field).toBe(true)
    }
  })

  it('allows everything on a definition', () => {
    expect(mayEditField('lifecycle', 'erp', 'acme/retail', index)).toBe(true)
  })

  /**
   * The other half of §10's sentence about a stand-in: its `name` and `ref`
   * are caches, and "a refresh rewrites them; a person does not". Refused for
   * a different reason from the owner's detail and refused all the same.
   */
  it('refuses the two caches, which a refresh writes and a person does not', () => {
    expect(mayEditField('name', 'erp', 'acme/finance', index))
      .toEqual({ refused: 'check.ownedElsewhere', owner: 'acme/retail' })
    expect(mayEditField('ref', 'erp', 'acme/finance', index))
      .toEqual({ refused: 'check.ownedElsewhere', owner: 'acme/retail' })
    expect(mayEditField('name', 'erp', 'acme/retail', index)).toBe(true)
  })
})

describe('mayApplyPatch', () => {
  it('refuses a patch that touches one field of the owner\'s detail', () => {
    expect(mayApplyPatch({ description: 'ours', vendor: 'Someone' }, 'erp', 'acme/finance', index))
      .toEqual({ refused: 'check.ownedElsewhere', owner: 'acme/retail' })
  })

  it('allows one that touches none of it', () => {
    expect(mayApplyPatch({ description: 'ours' }, 'erp', 'acme/finance', index)).toBe(true)
  })

  it('allows an empty patch, which changes nothing anywhere', () => {
    expect(mayApplyPatch({}, 'erp', 'acme/finance', index)).toBe(true)
  })
})

describe('isOwnerDetail', () => {
  it('is the one list, so the inspector and the agent cannot disagree', () => {
    expect(isOwnerDetail('aspects')).toBe(true)
    expect(isOwnerDetail('scopes')).toBe(true)
    expect(isOwnerDetail('description')).toBe(false)
    expect(isOwnerDetail('name')).toBe(false)
    expect(isOwnerDetail('ref')).toBe(false)
  })

  it('publishes the whole list an inspector greys out, caches included', () => {
    expect(FIXED_ON_A_STANDIN).toContain('vendor')
    expect(FIXED_ON_A_STANDIN).toContain('name')
    expect(FIXED_ON_A_STANDIN).toContain('ref')
    expect(FIXED_ON_A_STANDIN).not.toContain('description')
  })
})

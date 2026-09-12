/**
 * The four gestures that cross scopes (ADR-0012 §10).
 *
 * Two properties carry the rest. **The other scope is written first** — a plan
 * is an ordered list precisely so that can be pinned here rather than inferred
 * from the sequence of `await`s in a hook — and **every no is a value**, so the
 * suite that matters most is the one that walks every refusal and checks that
 * nothing was planned.
 */
import { describe, expect, it } from 'vitest'
import type { DesignElement } from '../model'
import { isGestureRefusal, planGesture } from './gestures'
import type { GesturePlan, GestureRefusal, GestureRequest } from './gestures'
import { indexScopes } from './scopeIndex'
import type { ScopeModel } from './scope'

function element(id: string, over: Partial<DesignElement> = {}): DesignElement {
  return {
    id, kind: 'application', name: id, lifecycle: 'live', isManaged: false, aspects: {}, ...over,
  }
}

const scope = (path: string, elements: DesignElement[]): ScopeModel =>
  ({ path, model: { elements, relations: [] } })

/**
 * `acme` over two domains. `rail` defines the WMS and draws a stand-in of the
 * organisation's `fulfilment`; `road` defines a WMS of its own, which is the
 * conflict *link* exists to resolve.
 */
function tree(): ScopeModel[] {
  return [
    scope('', [element('fulfilment', { kind: 'function', name: 'Fulfilment' })]),
    scope('acme', [element('wms', { name: 'WMS' })]),
    scope('acme/rail', [
      element('wms', { name: 'Rail WMS', vendor: 'Initech', description: 'Ours' }),
      element('fulfilment', { kind: 'function', name: 'Fulfilment', ref: '' }),
      element('wms-api', { kind: 'component', name: 'WMS API', parentId: 'wms' }),
    ]),
    scope('acme/rail/rolling-stock', []),
    scope('acme/road', [element('wms', { name: 'Road WMS', owner: 'Road IT' })]),
  ]
}

function plan(request: GestureRequest, models = tree()): GesturePlan | GestureRefusal {
  const from = models.find((one) => one.path === request.scope)!
  return planGesture({ request, model: from.model, index: indexScopes(models), models })
}

const planned = (answer: GesturePlan | GestureRefusal): GesturePlan => {
  if (isGestureRefusal(answer)) throw new Error(`refused: ${answer.refused}`)
  return answer
}

const refusal = (answer: GesturePlan | GestureRefusal): string => (
  isGestureRefusal(answer) ? answer.refused : `planned ${answer.gesture}`
)

describe('link', () => {
  /**
   * Two definitions at the same depth are a conflict, and *link* is how one of
   * them stops being one: this scope only, one command, an ordinary undo.
   */
  it('makes this scope’s definition a stand-in of the other one', () => {
    const held = planned(plan({ gesture: 'link', id: 'wms', scope: 'acme/road' }))
    expect(held.writes).toEqual([])
    expect(held.command).toEqual({
      type: 'element.link', id: 'wms', name: 'Rail WMS', ref: 'acme/rail',
    })
    expect(held.barrier).toBe(false)
    expect(held.owner).toBe('acme/rail')
  })

  it('takes the scope it should yield to when one is named', () => {
    const held = planned(plan({ gesture: 'link', id: 'wms', scope: 'acme/road', to: 'acme' }))
    expect(held.command).toMatchObject({ ref: 'acme', name: 'WMS' })
  })

  it('refuses a scope that does not define it, and one that is this scope', () => {
    expect(refusal(plan({ gesture: 'link', id: 'wms', scope: 'acme/road', to: 'acme/rail/rolling-stock' })))
      .toBe('gesture.noMaster')
    expect(refusal(plan({ gesture: 'link', id: 'wms', scope: 'acme/road', to: 'acme/road' })))
      .toBe('gesture.noMaster')
  })

  it('refuses a record nothing else defines', () => {
    const models = [scope('', [element('only')])]
    expect(refusal(plan({ gesture: 'link', id: 'only', scope: '' }, models))).toBe('gesture.noMaster')
  })

  it('refuses a record that is already a stand-in', () => {
    expect(refusal(plan({ gesture: 'link', id: 'fulfilment', scope: 'acme/rail' })))
      .toBe('gesture.notADefinition')
  })
})

describe('promote', () => {
  const held = () => planned(plan({ gesture: 'promote', id: 'wms', scope: 'acme/rail', to: '' }))

  /** The ancestor first, then this scope. Failing halfway leaves a duplicate. */
  it('writes the ancestor, then turns this scope’s record into a stand-in', () => {
    expect(held().writes).toEqual([{
      path: '',
      element: expect.objectContaining({ id: 'wms', name: 'Rail WMS', vendor: 'Initech' }),
    }])
    expect(held().command).toEqual({
      type: 'element.link', id: 'wms', name: 'Rail WMS', ref: '',
    })
  })

  /** Two scopes were written, so ⌘Z stops at it (§10). */
  it('asks for a barrier on the stack', () => {
    expect(held().barrier).toBe(true)
  })

  it('refuses a scope this one is not filed under', () => {
    expect(refusal(plan({ gesture: 'promote', id: 'wms', scope: 'acme/rail', to: 'acme/road' })))
      .toBe('gesture.notAnAncestor')
  })

  /**
   * A thin declaration yields, because that is what a declaration is for; a
   * record carrying the owner's detail is somebody's work.
   */
  it('takes a declaration’s place, and refuses a record with detail on it', () => {
    expect(planned(plan({ gesture: 'promote', id: 'wms', scope: 'acme/rail', to: 'acme' })).owner)
      .toBe('acme')
    const withDetail = tree().map((one) => (one.path === 'acme'
      ? scope('acme', [element('wms', { name: 'WMS', vendor: 'Someone' })])
      : one))
    expect(refusal(plan({ gesture: 'promote', id: 'wms', scope: 'acme/rail', to: 'acme' }, withDetail)))
      .toBe('gesture.wouldConflict')
  })

  /** Somebody deeper answers for it: this record is a copy, not the thing. */
  it('refuses a declaration that has been overtaken', () => {
    expect(refusal(plan({ gesture: 'promote', id: 'wms', scope: 'acme', to: '' })))
      .toBe('gesture.notAMaster')
  })

  /**
   * Where a record sits is a fact about THIS scope's trees; a parent the scope
   * it arrives in does not hold would be a tree with a rung missing.
   */
  it('leaves behind a parent the scope it arrives in does not hold', () => {
    const held2 = planned(plan({ gesture: 'promote', id: 'wms-api', scope: 'acme/rail', to: '' }))
    expect(held2.writes[0].element.parentId).toBeUndefined()
  })
})

describe('demote', () => {
  it('writes the scope below, then stands in for it here', () => {
    const held = planned(plan({
      gesture: 'demote', id: 'wms', scope: 'acme/rail', to: 'acme/rail/rolling-stock',
    }))
    expect(held.writes.map((write) => write.path)).toEqual(['acme/rail/rolling-stock'])
    expect(held.command).toMatchObject({ type: 'element.link', ref: 'acme/rail/rolling-stock' })
  })

  it('refuses a scope that is not filed under this one', () => {
    expect(refusal(plan({ gesture: 'demote', id: 'wms', scope: 'acme/rail', to: 'acme/road' })))
      .toBe('gesture.notADescendant')
  })
})

describe('transfer', () => {
  it('writes the other scope, and leaves a stand-in here by default', () => {
    const held = planned(plan({ gesture: 'transfer', id: 'fulfilment', scope: '', to: 'acme/road' }))
    expect(held.writes[0].path).toBe('acme/road')
    expect(held.command).toMatchObject({ type: 'element.link', ref: 'acme/road' })
  })

  it('removes the record here when the stand-in is not kept', () => {
    const held = planned(plan({
      gesture: 'transfer', id: 'fulfilment', scope: '', to: 'acme/road', keepStandIn: false,
    }))
    expect(held.command).toEqual({ type: 'element.delete', id: 'fulfilment' })
  })

  /**
   * Removing the record outright would leave every child naming a parent this
   * scope no longer holds — so that one is refused, and keeping a stand-in is
   * not, because a stand-in with children under it is a refinement.
   */
  it('refuses to remove a record other records are filed under', () => {
    expect(refusal(plan({
      gesture: 'transfer', id: 'wms', scope: 'acme/rail', to: 'acme/rail/rolling-stock', keepStandIn: false,
    }))).toBe('gesture.hasChildren')
    expect(refusal(plan({
      gesture: 'transfer', id: 'wms', scope: 'acme/rail', to: 'acme/rail/rolling-stock',
    }))).toBe('planned transfer')
  })

  it('refuses a scope the tree has never heard of, and this scope itself', () => {
    expect(refusal(plan({ gesture: 'transfer', id: 'fulfilment', scope: '', to: 'nowhere' })))
      .toBe('gesture.noSuchScope')
    expect(refusal(plan({ gesture: 'transfer', id: 'fulfilment', scope: '', to: '' })))
      .toBe('gesture.noSuchScope')
  })

  /** Prose nobody replaced is prose somebody wrote. */
  it('keeps the perspective the scope it arrives in already had', () => {
    const models = [
      scope('', [element('erp', { name: 'ERP' })]),
      scope('acme', [element('erp', { name: 'ERP', ref: '', description: 'What it means here' })]),
    ]
    const held = planned(plan({ gesture: 'transfer', id: 'erp', scope: '', to: 'acme' }, models))
    expect(held.writes[0].element.description).toBe('What it means here')
    expect(held.writes[0].element.ref).toBeUndefined()
  })
})

it('refuses an id this scope does not hold', () => {
  expect(refusal(plan({ gesture: 'promote', id: 'nope', scope: 'acme/rail', to: '' })))
    .toBe('gesture.unknownId')
})

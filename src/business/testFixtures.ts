/**
 * Compact builders for the business layer's tests.
 *
 * Named for what a depth MEANS on a sheet — an area, a grouping, a capability;
 * a journey, a phase, a step — because that is how the tests read, while the
 * model itself knows only `kind` and `parentId` (ADR-0012 §4). Nothing here
 * enforces the depth: a fixture that puts a capability under a journey is a
 * fixture about a model somebody hand-edited, and those are worth writing.
 */
import type { DesignElement, ElementId, Relation, RelationType } from '../model'

function element(
  id: ElementId,
  kind: DesignElement['kind'],
  name: string,
  parentId: ElementId | undefined,
  over: Partial<DesignElement>,
): DesignElement {
  return {
    id,
    kind,
    name,
    lifecycle: 'live',
    isManaged: false,
    aspects: {},
    ...(parentId !== undefined ? { parentId } : {}),
    ...over,
  }
}

export const area = (id: ElementId, name: string, over: Partial<DesignElement> = {}) =>
  element(id, 'function', name, undefined, over)

export const grouping = (
  id: ElementId, name: string, parentId: ElementId, over: Partial<DesignElement> = {},
) => element(id, 'function', name, parentId, over)

/** The same kind one level deeper: depth is drawing, and the model does not know. */
export const capability = grouping

export const journey = (id: ElementId, name: string, over: Partial<DesignElement> = {}) =>
  element(id, 'step', name, undefined, over)

export const phase = (
  id: ElementId, name: string, parentId: ElementId, over: Partial<DesignElement> = {},
) => element(id, 'step', name, parentId, over)

export const step = phase

export const actor = (id: ElementId, name: string, over: Partial<DesignElement> = {}) =>
  element(id, 'actor', name, undefined, over)

export const application = (id: ElementId, name: string, over: Partial<DesignElement> = {}) =>
  element(id, 'application', name, undefined, over)

export const relation = (
  id: string, type: RelationType, sourceId: ElementId, targetId: ElementId,
  over: Partial<Relation> = {},
): Relation => ({ id, type, sourceId, targetId, ...over })

/**
 * One small organisation, whole: the scope every sheet test is written over.
 *
 * *Ship a consignment* in four phases, with two lanes beside the common row —
 * a key account that forks at *quote*, passes through *pick* and rejoins at
 * *deliver*, and a marketplace partner from outside that does one thing in
 * *pick*. Two areas, a grouping each, and four capabilities between them
 * covering all three answers `coverage.ts` can give: *picking* by two systems,
 * *packing* by people, *invoicing* by one system, *dunning* by nobody yet.
 *
 * Shared rather than rebuilt per suite because the page, the inspector and the
 * agent all have to agree about the same organisation — a fixture per test
 * file is how three of them end up describing three different ones.
 */
export function shippingScope(): { elements: DesignElement[]; relations: Relation[] } {
  return {
    elements: [
      journey('ship', 'Ship a consignment'),
      phase('order', 'Order', 'ship', { order: 1 }),
      phase('quote', 'Quote', 'ship', { order: 2 }),
      phase('pick', 'Pick', 'ship', { order: 3 }),
      phase('deliver', 'Deliver', 'ship', { order: 4 }),

      step('take-order', 'Take the order', 'order'),
      step('standard-rate', 'Apply the standard rate', 'quote'),
      step('pick-goods', 'Pick the goods', 'pick'),
      step('hand-over', 'Hand over', 'deliver'),
      step('negotiate', 'Negotiate the rate', 'quote', { lane: 'key-account' }),
      step('sign-off', 'Sign off the delivery', 'deliver', { lane: 'key-account' }),
      step('partner-fulfils', 'Partner fulfils', 'pick', { lane: 'partner' }),

      area('fulfilment', 'Fulfilment', { order: 1 }),
      grouping('warehousing', 'Warehousing', 'fulfilment'),
      capability('picking', 'Picking', 'warehousing'),
      capability('packing', 'Packing', 'warehousing'),
      area('billing', 'Billing', { order: 2 }),
      grouping('invoicing', 'Invoicing', 'billing'),
      capability('invoice', 'Raise an invoice', 'invoicing'),
      capability('dunning', 'Chase a late payment', 'invoicing'),

      actor('warehouse-team', 'Warehouse team'),
      actor('key-account', 'Key account'),
      actor('partner', 'Marketplace partner', { outside: true }),

      application('wms', 'Warehouse system'),
      application('scanner', 'Handheld scanners'),
      application('erp', 'Finance system'),
    ],
    relations: [
      relation('s1', 'supports', 'wms', 'picking'),
      relation('s2', 'supports', 'scanner', 'picking'),
      relation('s3', 'supports', 'erp', 'invoice'),
      relation('a1', 'assigned', 'warehouse-team', 'packing'),
      relation('a2', 'assigned', 'partner', 'partner-fulfils'),
      relation('f1', 'flow', 'wms', 'erp'),
    ],
  }
}

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

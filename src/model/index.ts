/**
 * The architecture model: what a landscape is made of, and the arithmetic over
 * it. Pure — no React, no browser, no storage — and enforced as such.
 *
 * This is the module every other one may import and none of them may reach
 * around. It replaces the surface the editor package used to publish from a
 * single `index.ts`, minus the parts that were never model: the editor's own
 * props and view settings are in `editor/`, the string table in `i18n/`.
 */
export type {
  AspectKey, AspectStatus, AspectEntry, AspectConfigEntry, ElementKind, Layer7Zone, ElementId,
  Lifecycle, DesignElement, DesignParameters, DesignConnection, EdgeLineStyle, EdgeRouting,
  EdgeArrowhead, NodeShapeVariant, NodeIconSize, UploadedLogo, DiagramPlacement, DesignDiagram,
  DesignModel, DiagramContentBatch, DiagramLayoutConfig, DiagramSettings, DomainGroupRect,
  EdgeRoute, EdgeRouteSource, AttachSide, Point, ResizableZone, Rect,
} from './types'

/**
 * The model as the reducer holds it: indexed by id, with the file's order kept
 * beside it. `fromArrays`/`toArrays` are the boundary — everything above this
 * line is the shape on disk, everything below it the shape in memory.
 */
export type { Model, Diagram, ModelOrder, DiagramOrder, ConnectionId, DiagramId, AdrId } from './normalised'
export {
  fromArrays, toArrays, toDiagram, fromDiagram, decisionsOf, routesOf,
  elementList, connectionList, diagramList, decisionList, placementList, routeList,
} from './normalised'

/** The one vocabulary for changing a model, and the one writer (ADR-0002). */
export type { Command, CommandBody, CommandMeta, ProjectPatch, DiagramPatch } from './commands'
export { transaction, reverse, isNothing, NOTHING } from './commands'
export type { ApplyResult, CommandRefusal } from './reducer'
export { apply, applyAll } from './reducer'

export { createTempId, isTempId } from './ids'
/**
 * The one definition of "this route row stores something" — a row without it is
 * the batch's delete marker. Anything applying a `DiagramContentBatch` must use
 * this rather than re-deriving the rule from `waypoints`.
 */
export { hasRouteContent } from './routes'
export { ASPECT_SUPERSET, DEFAULT_ASPECT_CONFIG, aspectConfigFor, aspectShortCode } from './aspects'
/** The one rule for "found", so every search in the app agrees on it. */
export { fold, matchesQuery, queryTokens } from './textSearch'

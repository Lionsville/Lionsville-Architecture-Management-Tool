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
  Lifecycle, LifecycleDates, DesignElement, DesignConnection, EdgeLineStyle, EdgeRouting,
  EdgeArrowhead, NodeShapeVariant, NodeIconSize, UploadedLogo, DocumentImage, DiagramPlacement, DesignDiagram,
  DesignModel, DiagramLayoutConfig, DiagramSettings, DomainGroupRect,
  EdgeRoute, EdgeRouteSource, AttachSide, Point, ResizableZone, Rect,
} from './types'

/**
 * The model as the reducer holds it: indexed by id, with the file's order kept
 * beside it. `fromArrays`/`toArrays` are the boundary — everything above this
 * line is the shape on disk, everything below it the shape in memory.
 */
export type {
  Model, Diagram, ModelOrder, DiagramOrder, ConnectionId, DiagramId, AdrId, TransitionId,
} from './normalised'
export {
  fromArrays, toArrays, toDiagram, fromDiagram, decisionsOf, routesOf, transitionsOf,
  elementList, connectionList, diagramList, decisionList, transitionList, placementList, routeList,
} from './normalised'

/** Where a thing is on a given day (ADR-0009). */
export {
  connectionLiveAt, DATED_PHASES, datesIn, datesInOrder, daysBetween, hasDates, isDay, isGoneOn,
  LIFECYCLE_ORDER, phaseAt, today,
} from './lifecycle'
export type { DatedPhase } from './lifecycle'

/** What the dates in a landscape contradict (ADR-0009). */
export { findings } from './checks'
export type { CheckContext, Finding, FindingKind, FindingSubject } from './checks'

/** A plan for changing the landscape (ADR-0009). */
export {
  addDays, elementsWithRole, isTransitionFinished, nextTransitionNumber, setTransitionStatus,
  findTransition, shiftDays, sortTransitions, transitionDays, transitionLabel, TRANSITION_STATUSES,
  transitionsForElement, transitionsFrom as transitionStatusesFrom,
} from './transition'
export type {
  Transition, TransitionElement, TransitionMilestone, TransitionRole, TransitionStatus,
} from './transition'

/** The one vocabulary for changing a model, and the one writer (ADR-0002). */
export type { Command, CommandBody, CommandMeta, ProjectPatch, DiagramPatch, Restored } from './commands'
export {
  transaction, reverse, isNothing, NOTHING, replacement, duplicateDiagram, decisionsToCommands,
  fieldEdit,
} from './commands'
export type { ApplyResult, CommandRefusal } from './reducer'
/** What a step is called, for a list a person reads. */
export type { StepSummary } from './activity'
export { summarise } from './activity'
export { apply, applyAll } from './reducer'
export type { RestoreRefusal, RestoreResult, RestoreSubject } from './restore'
export { restoreCommand } from './restore'
export { lastDayBefore, portCommands, portProgress, portsOf, twinOf, unplannedPorts, unportCommands } from './porting'
export type { Port } from './porting'
export { replacementCommands } from './replacement'
export type { Replacement, ReplacementIds, ReplacementRequest } from './replacement'

/**
 * The one definition of "this route row stores something". A row without it is
 * not a row to store but the instruction to forget the one that is there, and
 * everybody deciding that must ask here rather than re-derive it from
 * `waypoints`.
 */
export { hasRouteContent } from './routes'
export { ASPECT_SUPERSET, DEFAULT_ASPECT_CONFIG, aspectConfigFor, aspectShortCode } from './aspects'
/** The one rule for "found", so every search in the app agrees on it. */
export { fold, matchesQuery, queryTokens } from './textSearch'

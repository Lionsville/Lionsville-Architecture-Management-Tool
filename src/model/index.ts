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
  Lifecycle, LifecycleDates, DesignElement, DesignConnection, Relation, RelationType, PlatformArchetype,
  EdgeLineStyle, EdgeRouting,
  EdgeArrowhead, NodeShapeVariant, NodeIconSize, UploadedLogo, DocumentImage, DiagramMember, NodeGeometry, PlacedNode, DesignDiagram, SheetPaper,
  DesignModel, DiagramGroup, DiagramLine, DiagramSettings, DomainGroupRect, Geometry, RouteGeometry,
  EdgeRoute, EdgeRouteSource, AttachSide, Point, ResizableZone, Rect,
} from './types'

/**
 * The model as the reducer holds it: indexed by id, with the file's order kept
 * beside it. `fromArrays`/`toArrays` are the boundary — everything above this
 * line is the shape on disk, everything below it the shape in memory.
 */
export type {
  Model, Diagram, ModelOrder, DiagramOrder, RelationId, DiagramId, GroupId, AdrId, TransitionId,
} from './normalised'
export {
  fromArrays, toArrays, toDiagram, fromDiagram, decisionsOf, routesOf, transitionsOf,
  elementList, relationList, diagramList, decisionList, transitionList, memberList, routeList,
} from './normalised'

/** What a relation is, and the one type a canvas draws (ADR-0012 §5). */
export {
  RELATION_LABEL, RELATION_TYPES, flowsOf, isFlow, isRelationType,
} from './relations'

/** What the landscape's cards are tinted by (ADR-0013). */
export { COLOUR_BY, overlayBandOf, overlayBands } from './overlay'
export type { ColourBy, OverlayBand } from './overlay'

/** The platforms a container diagram's containers run on, drawn around them (ADR-0013). */
export { deploymentBoxes } from './deployment'
export type { DeploymentBox } from './deployment'

/** Where something runs, and who may say so (ADR-0013); the platform tree every reader walks (ADR-0014). */
export {
  ancestorPlatforms, containersOf, descendantPlatforms, hostingOf, mayBeHosted, platformParentOf,
  rootPlatformsOf,
} from './hosting'
export type { Hosting, PlatformTree } from './hosting'

/** What an application leverages: the services it uses, and the platforms behind them (ADR-0014). */
export {
  consumersOf, describeLeverage, impliedServicesOf, leverageOf, narrowRealisers, platformsBehind, platformsBoundTo, servicesOf,
} from './leverage'
export type { Leverage, LeverageLine, LeverageOptions } from './leverage'

/** The technology landscape: the three bands, the lines between them, and what a card touches (ADR-0015). */
export {
  FOLD_ABOVE, applicationList, landscapeEdges, nodeKey, platformList, seedTechnologyLandscape, serviceList, startsFolded,
  technologyLandscape, touchedBy,
} from './technologyLandscape'
export type {
  LandscapeApplication, LandscapeEdge, LandscapeEdgeKind, LandscapeGroup, LandscapePlatform, LandscapeService,
  LandscapeView, NodeKey, SharedElsewhere, TechnologyLandscape, TechnologyLandscapeOptions,
} from './technologyLandscape'

/** An interface, and where it lands a level down (ADR-0013). */
export {
  applicationOf, candidateInterfaces, hasRefinements, isApplicationLine, isContainerLine,
  landedEnd, landingGesture, landingPlaces, landingRow, protocolsOf, refinementRefusal,
  refinementsOf,
} from './refines'
export type { Held, LandingGesture, RefinementRefusal } from './refines'
export { acceptImplied, impliedInterfaces } from './implied'
export type { ImpliedInterface } from './implied'

/** What a platform is, and what stands on it (ADR-0013, ADR-0014). */
export {
  PLATFORM_ARCHETYPES, PLATFORM_ARCHETYPE_LABEL, isPlatformArchetype,
  isTechnologyRelation, platformArchetypeOf, technologyEndsRefusal,
} from './relations'
export type { KindOf } from './relations'

/** What a stand-in may carry, and what the scope that defines it answers for (ADR-0012 §3). */
export { OWNER_DETAIL, asStandIn } from './standIn'
export type { OwnerDetailField } from './standIn'

/** Where a thing is on a given day (ADR-0009). */
export {
  relationLiveAt, DATED_PHASES, datesIn, datesInOrder, daysBetween, hasDates, isDay, isGoneOn,
  LIFECYCLE_ORDER, phaseAt, today,
} from './lifecycle'
export type { DatedPhase } from './lifecycle'

/** Which boards draw a thing, on their own day (ADR-0009, ADR-0010). */
export { boardsDrawing } from './drawnOn'

/** What a container diagram holds, and what it draws once an interface lands. */
export { hoistedEnd, landedInterfaces, removeContainerDiagram } from './containerDiagram'

/** One parent, always, and the loop refused before it is written (ADR-0012 §3, ADR-0014). */
export { wouldCycle } from './tree'

/** One platform service, and what would be stranded if it were withdrawn (ADR-0014). */
export { serviceReport } from './serviceReport'
export type { ServiceConsumer, ServiceReport, ServiceReportOptions } from './serviceReport'

/** One platform, and what would be left standing if it went (ADR-0013). */
export { platformReport } from './platformReport'
export type {
  PlatformDescribe, PlatformDescription, PlatformEnd, PlatformLanding, PlatformReport,
  PlatformReportOptions,
} from './platformReport'

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
export {
  ASPECT_SUPERSET, DEFAULT_ASPECT_CONFIG, aspectConfigFor, aspectShortCode, derivedPlatformAspect,
  withDerivedAspects,
} from './aspects'
/** The one rule for "found", so every search in the app agrees on it. */
export { fold, matchesQuery, queryTokens } from './textSearch'

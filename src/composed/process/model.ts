// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for a process with no screen: the model.
 *
 * What a landscape is made of, what a change to it is, and the one writer: the
 * records, the commands, the reducer and the arithmetic over them.
 *
 * A build composed from this one imports this entry and never the files behind
 * it (ADR-0022, amended), so those may move. Names only, each from the file
 * that holds it; `src/composed/SURFACE.txt` is what the whole offers.
 */
export { summarise } from '../../model/activity'
export type { StepSummary } from '../../model/activity'
export type { Adr } from '../../model/adr'
export { checkMarkId } from '../../model/checkMarks'
export type { CheckMark } from '../../model/checkMarks'
export { findings } from '../../model/checks'
export type { Finding } from '../../model/checks'
export {
  causesToCommands, commentsToCommands, duplicateDiagram, experimentsToCommands, observationsToCommands, placeOn, solutionsToCommands, transaction,
} from '../../model/commands'
export type { Command } from '../../model/commands'
export type { CommandRefusal, CommandType, WriteKey } from '../../model/commands/handler'
export { COMMAND_TABLE } from '../../model/commands/table'
export { EVERYTHING } from '../../model/commands/writes'
export type { Comment } from '../../model/comment'
export { diffModels } from '../../model/diff'
export type { ModelChange } from '../../model/diff'
export { imageMediaType } from '../../model/documentImage'
export { drawingPictureAddresses } from '../../model/drawing'
export type { HostModel } from '../../model/hostModel'
export type { PlatformTree } from '../../model/hosting'
export { imageEntryOf } from '../../model/imageEntry'
export { contentAddressOf, imageEntryRefusal, imageFolderOf, imageName, imageNameKey, imageNameRefusal } from '../../model/imageName'
export type { ContentAddress, ImageEntry, ImageFolder, ImageName } from '../../model/imageName'
export { claimKey, idPolicy, idsIn } from '../../model/keys'
export { isDay, isGoneOn, today } from '../../model/lifecycle'
export {
  holdsAllIn, managedReach, managingRoleIds, onlyAssignments, onlyPeopleIn, reachesAssignment, reachesHolder, reachesPosition,
} from '../../model/managing'
export type { ManagedReach } from '../../model/managing'
export {
  causeList, causesOf, commentList, commentsOf, decisionsOf, diagramList, elementList, experimentList, experimentsOf, fromArrays, fromDiagram,
  observationList, observationsOf, relationList, solutionList, solutionsOf, toArrays, toDiagram, transitionList, transitionsOf,
} from '../../model/normalised'
export type { Diagram, Model } from '../../model/normalised'
export type {
  Cause, Experiment, Observation, ObservationEvent, RecordedBy, RecorderAnswer, RecorderSource, ScopeAnalysis, Solution,
} from '../../model/observation'
export type { RoleId } from '../../model/operatingModel'
export type { PersonId } from '../../model/person'
export { CANVAS_KINDS, NODE_SIZES } from '../../model/placement'
export { RECORD_LISTS, SCOPE_RECORD, recordsChanged, sameValue, stableText } from '../../model/recordKey'
export type { RecordKey, RecordKind } from '../../model/recordKey'
export { apply, applyGuarded, writesOf } from '../../model/reducer'
export type { Transition } from '../../model/transition'
export type { DesignDiagram, DesignElement, DocumentImage, ElementId, ElementKind, Geometry, Relation, RelationType } from '../../model/types'
export { dayBefore, endingFor, leavingStep, personOf, restoringFor, returningStep, runsOn } from '../../model/units'
export type { Assignment, Organisation } from '../../model/units'
export { LAYER7_CANVAS, canvasRect, clampCanvasSize, zoneRect, zoneSizes } from '../../model/zones'

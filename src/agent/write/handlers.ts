// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Which handler builds each tool's command: the table `commandFor` looks a
 * request up in.
 *
 * Typed over the tool vocabulary, so a write or a see tool added to `tools.ts`
 * without a handler here — or a handler left behind for a tool that went — is
 * a typecheck error rather than an `agent.unknownTool` somebody meets at run
 * time. The few write and see tools the session answers itself are named
 * below, and are the only ones that may be missing.
 */
import type { ToolName, ToolOfTier } from '../tools'
import {
  acceptInterface, addRelation, connect, removeConnection, removeConnections, removeRelation, updateConnection,
  updateConnections, updateRelation, useTechnology,
} from './connections'
import {
  align, distribute, drawElement, groupElements, moveBy, placeElement, placeNextTo, undrawElement, ungroup,
} from './canvas'
import { proposeDecision, removeDecision, transitionDecision, updateDecision } from './decisions'
import { createDiagram, updateDiagram } from './diagrams'
import { addElement, removeElement, updateElement } from './elements'
import {
  addCause, archiveObservation, linkCauseTool, mergeObservation, observationSeen, recordObservation, removeCauseTool,
  removeObservationTool, unlinkCauseTool, updateCauseTool, updateObservationTool,
} from './observations'
import {
  addMilestone, createPlan, port, removeMilestone, removePlan, replace, unport, updateMilestone, updatePlan,
} from './plans'
import type { Handler } from './shared'
import {
  addressSolution, concludeExperimentTool, decideSolution, dropSolutionTool, moveSolutionTool, planExperimentTool,
  planSolution, proposeSolution, removeExperimentTool, removeSolutionTool, restoreSolutionTool, unaddressSolution,
  updateExperimentTool, updateSolutionTool, waiveSolution,
} from './solutions'

/**
 * The write and see tools that are not one command: a picture, several
 * changes, taking steps back, saving — and looking, which changes nothing.
 * The session answers each of them itself.
 */
export const ANSWERED_BY_SESSION = [
  'image.upload', 'batch', 'undo', 'project.save',
  'diagram.inspect', 'diagram.render', 'diagram.tidy', 'diagram.route', 'focus',
] as const satisfies readonly ToolOfTier<'write' | 'see'>[]

/** A tool whose request is built into one command here. */
export type CommandTool = Exclude<ToolOfTier<'write' | 'see'>, (typeof ANSWERED_BY_SESSION)[number]>

export const HANDLERS: { readonly [T in CommandTool]: Handler } = {
  'element.add': addElement,
  'element.update': updateElement,
  'element.remove': removeElement,

  connect,
  'connection.update': updateConnection,
  'connections.update': updateConnections,
  'interface.accept': acceptInterface,
  'connection.remove': removeConnection,
  'connections.remove': removeConnections,
  'relation.add': addRelation,
  'technology.use': useTechnology,
  'relation.update': updateRelation,
  'relation.remove': removeRelation,

  'decision.propose': proposeDecision,
  'decision.update': updateDecision,
  'decision.remove': removeDecision,
  'decision.transition': transitionDecision,

  'observation.record': recordObservation,
  'observation.update': updateObservationTool,
  'observation.seen': observationSeen,
  'observation.archive': archiveObservation,
  'observation.merge': mergeObservation,
  'observation.remove': removeObservationTool,
  'cause.add': addCause,
  'cause.update': updateCauseTool,
  'cause.link': linkCauseTool,
  'cause.unlink': unlinkCauseTool,
  'cause.remove': removeCauseTool,

  'solution.propose': proposeSolution,
  'solution.update': updateSolutionTool,
  'solution.address': addressSolution,
  'solution.unaddress': unaddressSolution,
  'solution.move': moveSolutionTool,
  'solution.waive': waiveSolution,
  'solution.drop': dropSolutionTool,
  'solution.restore': restoreSolutionTool,
  'solution.decide': decideSolution,
  'solution.plan': planSolution,
  'solution.remove': removeSolutionTool,
  'experiment.plan': planExperimentTool,
  'experiment.update': updateExperimentTool,
  'experiment.conclude': concludeExperimentTool,
  'experiment.remove': removeExperimentTool,

  'plan.replace': replace,
  'plan.port': port,
  'plan.unport': unport,
  'plan.create': createPlan,
  'plan.update': updatePlan,
  'plan.remove': removePlan,
  'milestone.add': addMilestone,
  'milestone.update': updateMilestone,
  'milestone.remove': removeMilestone,

  'diagram.create': createDiagram,
  'diagram.update': updateDiagram,

  moveBy,
  placeNextTo,
  'element.place': placeElement,
  'element.draw': drawElement,
  'element.undraw': undrawElement,
  group: groupElements,
  ungroup,
  align,
  distribute,
}

/** Is this a tool whose request becomes one command — the ones a batch may hold? */
export function isCommandTool(name: ToolName | string): name is CommandTool {
  return Object.hasOwn(HANDLERS, name)
}

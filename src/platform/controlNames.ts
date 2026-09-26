// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The stable names the main controls carry, as `data-guide="<name>"`.
 *
 * A test id is this repository's own business and moves whenever a test is
 * rewritten; a label moves with the language and with every edit to the words.
 * Something outside this tree that has to point at a control — a build composed
 * from this one, a screenshot script, somebody's own end-to-end suite — needs a
 * name that moves for neither. This is that name, and this list
 * is the whole of the promise: every name here is on screen where the control
 * is, `app/App.controlNames.test.tsx` checks it on the rendered app, and **renaming or
 * removing one is a breaking change**, said in the release notes like any
 * other. Adding one is not.
 *
 * A name says what the control IS in this product — the palette, the register's
 * row, the plan's milestone — and never what somebody outside means to do with
 * it. `<screen>.<control>`, in the words the code already uses for that screen;
 * a name on a repeated thing (a row, a milestone) is on every one of them, and
 * the thing's own id is on it as the test id is today. Pure, so a process with
 * no screen can read the list.
 */
export const CONTROL_NAME_ATTRIBUTE = 'data-guide'

export const CONTROL_NAMES = [
  // The bar over an open scope, and the parts it shares with a home's.
  'shell.crumbs', 'shell.activity', 'shell.alsoHere',
  // A scope's home.
  'org.tree', 'org.tree.row', 'org.cards',
  'org.card.business', 'org.card.map', 'org.card.decisions', 'org.card.observations',
  'org.card.roadmap', 'org.card.register', 'org.card.technology', 'org.card.landscape',
  'org.attention', 'org.attentionMore', 'org.boards', 'org.newBoard',
  // A board: the canvas and what is docked to it.
  'board.canvas', 'board.palette', 'board.library', 'board.inspector', 'board.connect',
  // An element's record, in the inspector.
  'record.party', 'record.replace', 'record.uses',
  // The register, and the technology register drawn by the same page.
  'register.row', 'register.colMaster', 'register.colDrawn', 'register.colFindings', 'register.openRow',
  'technologyRegister.row', 'technologyRegister.colMaster', 'technologyRegister.colFindings',
  'technologyRegister.openRow',
  // The business architecture sheet and the enterprise map.
  'sheet.canvas', 'sheet.inspector', 'sheet.coverage', 'sheet.supportedBy', 'sheet.doneBy', 'sheet.unmapped',
  'map.grid', 'map.summary',
  // The observations page: its three tabs, one observation, and the solutions.
  'observations.tabRegister', 'observations.tabAnalysis', 'observations.tabSolutions',
  'observations.register', 'observations.picture', 'observations.new', 'observations.newCause',
  'observation.seenAgain', 'observation.merge',
  'solutions.new', 'solutions.phases', 'solution.planExperiment', 'solution.decide',
  // The decisions page, and one record.
  'decisions.list', 'decisions.new', 'decisions.fromAbove', 'decision.status', 'decision.signers',
  // The roadmap, and one plan.
  'roadmap.newPlan', 'roadmap.findings', 'plan.addElement', 'plan.milestone', 'plan.addDecision',
  // The technology landscape.
  'landscape.servicesBand', 'landscape.sharedRow', 'landscape.inspector',
] as const

export type ControlName = (typeof CONTROL_NAMES)[number]

/** The selector for one named control, for a caller that would otherwise spell the attribute. */
export function controlSelector(name: ControlName): string {
  return `[${CONTROL_NAME_ATTRIBUTE}="${name}"]`
}

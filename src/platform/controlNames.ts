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
  'org.tree', 'org.tree.row', 'org.newScope', 'org.cards',
  'org.card.business', 'org.card.map', 'org.card.decisions', 'org.card.observations',
  'org.card.roadmap', 'org.card.register', 'org.card.technology', 'org.card.landscape', 'org.card.people',
  'org.card.operating',
  'org.attention', 'org.boards', 'org.newBoard',
  // Who serves a scope (ADR-0036, amended 11 October 2026): on its home and in its settings.
  'org.servedBy',
  // A board: the canvas and what is docked to it.
  'board.canvas', 'board.palette', 'board.library', 'board.inspector', 'board.connect',
  // An element's record, in the inspector.
  'record.party', 'record.replace', 'record.uses',
  // The register, and the technology register drawn by the same page.
  'register.row', 'register.colMaster', 'register.colDrawn', 'register.colFindings', 'register.openRow',
  'technologyRegister.row', 'technologyRegister.colMaster', 'technologyRegister.colFindings',
  'technologyRegister.openRow',
  // The People page (ADR-0036): a person's row, adding someone, importing a list, and the policy.
  'people.row', 'people.add', 'people.importCsv', 'people.policy',
  // Its possible duplicates (3.6.1): the fold, each pair, and the pairs answered as not the same person.
  'people.duplicates', 'people.duplicatePair', 'people.answered',
  // The business architecture sheet and the enterprise map.
  'sheet.canvas', 'sheet.inspector', 'sheet.coverage', 'sheet.supportedBy', 'sheet.doneBy', 'sheet.unmapped',
  // Who is responsible: a capability's *Assigned to*, and the bar's switch that names the units on the sheet.
  'sheet.assignedTo', 'sheet.showResponsible',
  // The rail's switch that draws every unit of the scope, not only the ones the sheet uses.
  'sheet.allUnits',
  'map.grid', 'map.summary',
  // The observations page: its three tabs, one observation, the form, and the solutions.
  'observations.tabRegister', 'observations.tabAnalysis', 'observations.tabSolutions',
  'observations.register', 'observations.row', 'observations.picture', 'observations.new', 'observations.newCause',
  'observation.seenAgain', 'observation.merge', 'observation.cause',
  // The merge screen (ADR-0035): the search, across scopes, the survivor of
  // each record picked, its three parts and Merge.
  'merge.search', 'merge.across', 'merge.survivor', 'merge.what', 'merge.values', 'merge.links', 'merge.confirm',
  // One cause: the step that makes it a root cause, or a cause again.
  'cause.root',
  // Over the observations page's tabs: the filters, their row, View local and the picture's two sizes.
  'observations.filters', 'observations.filterRow', 'observations.viewLocal', 'observations.size',
  // The form that records an observation, with its causes (ADR-0032 §6).
  'observationForm.causes', 'observationForm.existingCause', 'observationForm.record', 'observationForm.description',
  'solutions.new', 'solutions.phases', 'solution.planExperiment', 'solution.decide',
  // One solution: the step on to its next stage, behind its gate.
  'solution.move',
  // The decisions page, and one record. A record in the list and a move of
  // one record's status are each named on every one of them, as a row is.
  'decisions.list', 'decisions.row', 'decisions.new', 'decisions.fromAbove',
  'decision.status', 'decision.move', 'decision.signers',
  // The roadmap, and one plan.
  'roadmap.newPlan', 'roadmap.findings', 'plan.addElement', 'plan.milestone', 'plan.addDecision',
  // The technology landscape.
  'landscape.servicesBand', 'landscape.sharedRow', 'landscape.inspector',
  // The operating model (ADR-0036): its three tabs, a new unit type, role and
  // responsibility, the rules, the matrix and each of its cells, bringing a
  // library in and comparing with the libraries.
  'operating.tabUnits', 'operating.tabRaci', 'operating.tabLibraries', 'operating.newUnitType', 'operating.newRole',
  'operating.newResponsibility', 'operating.rules', 'operating.matrix', 'operating.cell', 'operating.bringIn',
  'operating.compare',
  // …and over the matrix, the roles and groups it keeps and its order (3.6.3).
  'operating.filterRoles', 'operating.filterGroups', 'operating.matrixOrder',
  // The unit types drawn as a structure (ADR-0036, amended 11 October 2026):
  // the lanes, each type's card, and the order in its lane in the inspector.
  'operating.structure', 'operating.typeCard', 'operating.typeOrder',
  // A library brought in as a choice (ADR-0036, amended 11 October 2026): the
  // ways in — beside New unit type, and first on an empty model — the
  // dialog's list of libraries and its What will come in, whose Bring in is
  // operating.bringIn; and What came in on each library's card.
  'operating.fromLibrary', 'operating.startFromLibrary', 'operating.libraryList', 'operating.comingIn', 'operating.cameIn',
  // The organisation chart (ADR-0036, amended): its outline, and folding every unit or none.
  'chart.outline', 'chart.foldAll', 'chart.unfoldAll',
  // …the switch that draws its empty optional roles, and its summary in the inspector while nothing is picked (3.6.1).
  'chart.showOptional', 'chart.summary',
  // …and making a unit from it (3.6.2): + Unit at the top on the bar, in the outline's header and on an
  // empty chart, a unit's own + for a unit inside it, and the dialog they open.
  'chart.addAtTop', 'chart.outlineAdd', 'chart.addFirst', 'chart.addInside', 'chart.newUnit',
  // Deleting a unit (3.6.2): the confirmation's End on a day…, offered first, and where the units inside it go.
  'unitDelete.end', 'unitDelete.inside',
  // A list of findings, wherever it is drawn (ADR-0036, amended 11 October 2026):
  // a check's row, an instance under it, the switch that shows the notes, the
  // way back from an explanation, and each of its actions.
  'findings.group', 'findings.instance', 'findings.showNotes', 'findings.back', 'findings.action',
  // …and what was marked as intended: Mark as intended… under an explanation,
  // Accepted (N) under the groups, and Take back on each one in it.
  'findings.markIntended', 'findings.accepted', 'findings.takeBack',
  // The Checks page over a home (ADR-0036, amended 11 October 2026): its card,
  // a count by weight under the cards, the weights shown, a check's row, and
  // an instance of the check picked.
  'org.card.checks', 'org.attentionCount', 'checks.weight', 'checks.row', 'checks.instance',
] as const

export type ControlName = (typeof CONTROL_NAMES)[number]

/** The selector for one named control, for a caller that would otherwise spell the attribute. */
export function controlSelector(name: ControlName): string {
  return `[${CONTROL_NAME_ATTRIBUTE}="${name}"]`
}

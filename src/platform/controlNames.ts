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
  // The first run, and the example as a place.
  'first.language', 'first.name', 'first.example', 'example.keep', 'example.leave',
  // Whose settings: this person's, and a scope's.
  'prefs.page', 'prefs.density', 'prefs.textSize', 'settings.page',
  // The frame: its two rows, whatever screen is up.
  'drawing.bar', 'drawing.links', 'drawing.export', 'drawing.edit', 'drawing.openPage', 'drawing.editorBar', 'drawing.save', 'drawing.done', 'drawing.shapeStrip', 'drawing.chooser',
  'frame.find', 'frame.status', 'frame.home', 'frame.more', 'frame.agent', 'frame.help', 'frame.textSize', 'frame.textSmaller', 'frame.textSizeNow', 'frame.textLarger', 'frame.textSizeReset', 'frame.tree', 'frame.switcher', 'frame.yourWork', 'frame.activity',
  // Every page (ADR-0044): a column's seam, on each page that has one;
  // the product's site under Help in ⋯, and where the desktop app is had, said where an agent needs it.
  'page.seam', 'shell.website', 'agent.download',
  // A scope's home.
  'org.tree', 'org.tree.row', 'org.newScope', 'org.cards',
  'org.card.business', 'org.card.map', 'org.card.decisions', 'org.card.observations',
  'org.card.roadmap', 'org.card.register', 'org.card.technology', 'org.card.landscape', 'org.card.people',
  'org.card.operating',
  // The scope's principles (ADR-0041): its card, and writing one on its page.
  'org.card.principles', 'principles.new',
  // Topics (ADR-0042): the organisation's card, a new topic in the catalogue, and a home's relevant topics.
  'org.card.topics', 'topics.new', 'org.relevantTopics',
  // Building blocks (ADR-0043): the card and a new block in the register.
  'org.card.blocks', 'blocks.new',
  'org.attention', 'org.boards', 'org.newBoard',
  // Who serves a scope (ADR-0036, amended 11 October 2026): on its home and in its settings.
  'org.servedBy',
  // A board: the canvas and what is docked to it.
  'board.canvas', 'board.palette', 'board.library', 'board.inspector', 'board.connect',
  // Keeping a colouring with the view (ADR-0027, amended), on the key strip once a reader has chosen their own.
  'board.keepLens',
  // The View bar over a board: its panels, and the Colour menu.
  'board.arrange', 'board.show', 'board.colour', 'board.day', 'board.look',
  // A container diagram: what its lines say, where things run, its key, and the way back up and down.
  'board.labels', 'board.deployment', 'board.levelUp', 'board.key', 'inspector.openContainer',
  // An element's record, in the inspector.
  'record.party', 'record.replace', 'record.uses',
  // Its text, and the window it is written in (Cancel and Done carry -cancel and -save).
  'record.editText', 'record.writing',
  // The register, and the technology register drawn by the same page.
  'register.row', 'register.tabs', 'register.colMaster', 'register.colDrawn', 'register.colFindings', 'register.openRow',
  'technologyRegister.row', 'technologyRegister.colMaster', 'technologyRegister.colFindings',
  'technologyRegister.openRow',
  // The People page (ADR-0036): a person's row, adding someone, importing a list, and the policy.
  'people.row', 'people.add', 'people.importCsv', 'people.policy', 'people.tabs', 'people.find', 'people.day',
  'people.person', 'people.correct', 'people.more',
  // Its possible duplicates (3.6.1): the fold, each pair, and the pairs answered as not the same person.
  'people.duplicates', 'people.duplicatePair', 'people.answered',
  // The business architecture sheet and the enterprise map.
  'sheet.canvas', 'sheet.inspector', 'sheet.coverage', 'sheet.supportedBy', 'sheet.doneBy', 'sheet.unmapped',
  // Who is responsible: a capability's *Assigned to*, and the bar's switch that names the units on the sheet.
  'sheet.assignedTo', 'sheet.showResponsible',
  // Which domains a function is handed to and taken up by, and taking one up from a sheet above (ADR-0040).
  'sheet.domains', 'sheet.fromAbove',
  // The rail's switch that draws every unit of the scope, not only the ones the sheet uses.
  'sheet.allUnits',
  'sheet.reading', 'sheet.day', 'sheet.key', 'sheet.poster', 'sheet.posture',
  'map.grid', 'map.summary', 'map.reading', 'map.filter', 'map.levels', 'map.day', 'map.matrix',
  // The observations page: its three tabs, one observation, the form, and the solutions.
  'observations.tabRegister', 'observations.tabAnalysis', 'observations.tabSolutions', 'observations.tabResults',
  'observations.lens', 'observations.mapWindow', 'observations.preview', 'observations.ladder',
  'observations.register', 'observations.row', 'observations.picture', 'observations.new', 'observations.newCause',
  'observation.seenAgain', 'observation.merge', 'observation.cause',
  // The merge screen (ADR-0035): the search, across scopes, the survivor of
  // each record picked, its three parts and Merge.
  'merge.search', 'merge.across', 'merge.survivor', 'merge.what', 'merge.values', 'merge.links', 'merge.confirm',
  // Moving an observation to another scope (ADR-0038 §5): the reader's action, and the screen's three parts,
  // its search and Move.
  'observation.move', 'move.what', 'move.target', 'move.search', 'move.cut', 'move.confirm',
  // One cause: the step that makes it a root cause, or a cause again.
  'cause.root',
  // Over the observations page's tabs: the filters, their row, View local and the picture's two sizes.
  'observations.filters', 'observations.filterRow', 'observations.viewLocal', 'observations.size',
  // The tones among the filters, each on or off, and whose: everyone's or mine (ADR-0038, amended §9, §10).
  'observations.tone', 'observations.mine',
  // The form that records an observation, with its causes (ADR-0032 §6).
  'observationForm.causes', 'observationForm.existingCause', 'observationForm.record', 'observationForm.description',
  // Problem or bright spot, asked first (ADR-0038 §6).
  'observationForm.tone',
  'solutions.new', 'solutions.phases', 'solution.planExperiment', 'solution.decide',
  // One solution: the step on to its next stage, behind its gate.
  'solution.move',
  // The decisions page, and one record. A record in the list and a move of
  // one record's status are each named on every one of them, as a row is.
  'decisions.list', 'decisions.row', 'decisions.new', 'decisions.fromAbove',
  'decision.status', 'decision.move', 'decision.signers', 'decision.record', 'decision.next', 'decision.more', 'decision.writing',
  'decisions.filter',
  // The roadmap, and one plan.
  'roadmap.newPlan', 'roadmap.findings', 'roadmap.axis', 'plan.addElement', 'plan.milestone', 'plan.addDecision', 'plan.page', 'plan.status', 'plan.move', 'plan.editText',
  // The technology landscape.
  'landscape.servicesBand', 'landscape.sharedRow', 'landscape.inspector',
  'landscape.reading', 'landscape.show', 'landscape.colour', 'landscape.day', 'landscape.row', 'landscape.bar',
  // The operating model (ADR-0036): its three tabs, a new unit type, role and
  // responsibility, the rules, the matrix and each of its cells, bringing a
  // library in and comparing with the libraries.
  'operating.tabUnits', 'operating.tabRaci', 'operating.tabLibraries', 'operating.newUnitType', 'operating.newRole',
  'operating.newResponsibility', 'operating.rules', 'operating.matrix', 'operating.cell', 'operating.bringIn',
  'operating.compare',
  // …and over the matrix, the roles and groups it keeps and its order (3.6.3).
  'operating.filterRoles', 'operating.filterGroups', 'operating.matrixOrder',
  // …and the organisation's own order (3.6.4): a role's and a responsibility's Move up and Move down
  // in the inspector, and the arrows on a group's heading.
  'operating.roleOrder', 'operating.responsibilityOrder', 'operating.groupOrder',
  // The unit types drawn as a structure (ADR-0036, amended 11 October 2026):
  // the lanes, each type's card, and the order in its lane in the inspector.
  'operating.structure', 'operating.typeCard', 'operating.typeOrder',
  // A library brought in as a choice (ADR-0036, amended 11 October 2026): the
  // ways in — beside New unit type, and first on an empty model — the
  // dialog's list of libraries and its What will come in, whose Bring in is
  // operating.bringIn; and What came in on each library's card.
  // Version 4: tabs by question, the reader and its preview, the tree and the grid's own controls.
  'operating.tabRoles', 'operating.tabExceptions', 'operating.reader', 'operating.roleList', 'operating.rolePreview', 'operating.raciTree', 'operating.raciScope',
  'operating.raciUnit', 'operating.raciExport', 'operating.arrange', 'operating.exceptions', 'operating.exceptionsBar',
  'operating.libraries', 'operating.libraryPreview', 'operating.typeLimit',
  'operating.fromLibrary', 'operating.startFromLibrary', 'operating.libraryList', 'operating.comingIn', 'operating.cameIn',
  // The Conway map: its bar, its two readings, the panel beside them.
  'conway.reading', 'conway.groupBy', 'conway.findMe', 'conway.verdict', 'conway.grid', 'conway.show', 'conway.showUnowned', 'conway.reader',
  'conway.finding', 'conway.owners', 'conway.sayHow', 'conway.planAway', 'conway.removeSaid', 'conway.modelInterface', 'conway.makeUnits', 'conway.addInteraction',
  // The organisation chart (ADR-0036, amended): its outline; its View bar, Levels and the unit's way to fold them all or none.
  'chart.outline', 'chart.bar', 'chart.foldAll',
  // …its find, for units and people, and Me.
  'chart.find', 'chart.findMe',
  // …who it draws (the People menu), and the line under it that opens its summary (3.6.1).
  'chart.showOptional', 'chart.summary',
  // …which lines it draws (the Lines menu, ADR-0039 §7), and the list of its exceptions.
  'chart.showLines', 'chart.exceptions',
  // …its day, and a focus on one unit, from its box.
  'chart.day', 'chart.focus',
  // …and making a unit from it (3.6.2): + Unit on the bar and on an empty chart, + Unit inside on a picked box, and the dialog they open.
  'chart.addAtTop', 'chart.addFirst', 'chart.addInside', 'chart.newUnit',
  // …and moving a unit to another place in the organisation (3.7.1): Move to… on a picked box and at the foot of the outline,
  // the panel they open, and Sits under in the unit's inspector.
  'chart.moveTo', 'chart.outlineMoveTo', 'chart.moveUnit', 'unit.sitsUnder',
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
  'org.card.checks', 'org.attentionCount', 'checks.weight', 'checks.scope', 'checks.row', 'checks.instance',
] as const

export type ControlName = (typeof CONTROL_NAMES)[number]

/** The selector for one named control, for a caller that would otherwise spell the attribute. */
export function controlSelector(name: ControlName): string {
  return `[${CONTROL_NAME_ATTRIBUTE}="${name}"]`
}

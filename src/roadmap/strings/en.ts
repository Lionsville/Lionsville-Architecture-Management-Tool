// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * English, for the roadmap: the time axis, the plans over it, and what the
 * dates contradict (ADR-0009).
 *
 * `as const`, so this slice is the schema for its own keys and `nl.ts` beside
 * it cannot be missing one.
 */
export const EN = {
  'roadmap.title': 'Roadmap',
  'roadmap.open': 'Roadmap',
  'roadmap.close': 'Close the roadmap',
  'roadmap.empty': 'Nothing here has a date yet.',
  'roadmap.emptyHint': 'Give an application a lifecycle date, or write a plan, and it appears here.',
  'roadmap.today': 'Today',
  'roadmap.showing': 'Showing',
  'roadmap.applications': 'Applications',
  'roadmap.relationsCount': '{count} relations',
  'roadmap.plans': 'Plans',
  'roadmap.newPlan': 'New plan',
  'roadmap.newPlanTitle': 'What is the plan called?',
  'roadmap.noPlans': 'No plans yet.',
  'roadmap.planFrom': 'From',
  'roadmap.planTo': 'To',
  'roadmap.planPorted': '{done} of {total} interfaces moved',
  'roadmap.windowFrom': 'Show from',
  'roadmap.windowTo': 'Show to',
  'roadmap.windowClear': 'Whole axis',
  'roadmap.shadowRun': 'Shadow run',
  'roadmap.owner': 'Owner',
  'roadmap.fromBelow': 'Initiatives from the scopes below',
  'roadmap.initiative': 'Initiative',
  'roadmap.initiativeHelp': 'Also shown on the roadmap of every scope above this one',
  'roadmap.openInitiative': 'Open in {scope}',
  'roadmap.showBelowChanges': 'Show what the initiatives below change',
  'roadmap.milestones': 'Milestones',
  'roadmap.touches': 'What it changes',
  'roadmap.restsOn': 'Decisions it rests on',
  'roadmap.status': 'Status',
  'roadmap.shift': 'Move by…',
  'roadmap.shiftDays': 'Days to move it, forwards or back',
  'roadmap.shiftHelp': 'Moves the window and every milestone, and the dates on what it introduces and retires. One step.',
  'roadmap.delete': 'Delete this plan',
  'roadmap.deleteConfirm': 'Delete “{name}”?',
  'roadmap.scrubHelp': 'Drag to move the board behind this page to a day.',

  // The statuses of a plan. A plan does not lock when it ends (ADR-0009).
  'plan.draft': 'Draft',
  'plan.agreed': 'Agreed',
  'plan.running': 'Running',
  'plan.done': 'Done',
  'plan.abandoned': 'Abandoned',

  // What each element of a plan does to the landscape.
  'plan.introduces': 'Introduces',
  'plan.retires': 'Retires',
  'plan.changes': 'Changes',

  // The plan's own page (ADR-0010): the record, read and written in one place.
  'plan.page': 'Plan',
  'plan.close': 'Back to the roadmap',
  'plan.read': 'Read',
  'plan.edit': 'Edit',
  'plan.source': 'Plan source (markdown)',
  'plan.bodyEmpty': 'Nothing written yet.',
  'plan.role': 'Role',
  'plan.addElement': 'Element',
  'plan.addApplication': 'Application',
  'plan.add': 'Add',
  'plan.remove': 'Remove',
  'plan.noElements': 'Names nothing yet. Add what it introduces, retires or changes.',
  // The dates on an element the plan introduces or retires. They are the
  // element's own (ADR-0009); this is where they are set together.
  'plan.date.live': 'Live from',
  'plan.date.retiring': 'Retiring from',
  'plan.date.retired': 'Gone on',
  'plan.milestoneName': 'Milestone',
  'plan.milestoneDate': 'Date',
  'plan.noMilestones': 'No milestones yet.',
  'plan.decision': 'Decision',
  'plan.noDecisions': 'Rests on no recorded decision yet.',
  'plan.fullPage': 'Full page',
  'plan.showFacts': 'Show the facts',
  'plan.resizeInterfaces': 'Resize the interface list',
  'plan.interfaces': 'Interfaces',
  'plan.noInterfaces': 'Nothing to move yet: name what the plan retires and what it introduces, and the lines on the first appear here.',
  'plan.counterpart': 'With',
  'plan.protocol': 'Protocol',
  'plan.movesTo': 'Moves to',
  'plan.on': 'On',
  'plan.ported': 'Moved',
  'plan.planned': 'Planned',
  'plan.notPlanned': 'Not yet planned',
  'plan.portAll': 'Port all remaining',
  'plan.unport': 'Take back',
  // The gate on a forward move (ADR-0009, amended 28 September 2026): one line each.
  'plan.gateTitle': 'Before it can move to {status}',
  'plan.gate.window': 'From and To are set, and To is not before From',
  'plan.gate.owner': 'Somebody answers for it',
  'plan.gate.names': 'It names something it introduces, retires or changes',
  'plan.gate.decisions': 'Every decision it rests on is accepted',
  'plan.gate.started': 'From has come',
  'plan.gate.introducedLive': 'Everything it introduces has a day it goes live',
  'plan.gate.retiredDated': 'Everything it retires has a day it is gone',
  'plan.gate.interfacesPorted': 'Every interface has a day it moves',
  // What each line of the gate asks, on hover and on focus: the rule, said
  // plainly, and then what still holds it open on this plan.
  'plan.gateHint.window': 'Both days of the window, From and To, with To on or after From.',
  'plan.gateHint.owner': 'A name under Owner: the person or team who answers for the plan.',
  'plan.gateHint.names': 'At least one element under “What it changes”, introduced, retired or changed.',
  'plan.gateHint.decisions': 'Each record under “Decisions it rests on” has to be accepted on the decisions page. A plan resting on a proposal has agreed to something nobody decided.',
  'plan.gateHint.started': 'From is today or earlier: a plan runs from its first day, not before.',
  'plan.gateHint.introducedLive': 'Each element it introduces needs a “Live from” day, set on its row under “What it changes”.',
  'plan.gateHint.retiredDated': 'Each element it retires needs a “Gone on” day, set on its row under “What it changes”.',
  'plan.gateHint.interfacesPorted': 'Each row of the Interfaces table needs a day it moves, one at a time or with “Port all remaining”.',
  'plan.gateHint.notAccepted': 'Not accepted yet: {names}.',
  'plan.gateHint.withStatus': '{name} ({status})',
  'plan.gateHint.undated': 'Still without that day: {names}.',
  'plan.gateHint.standInLive': 'Kept in another scope: {names}. A stand-in’s go-live day is set where it is defined and does not reach a plan here, so introduce it in a plan of that scope, or name it here as changed.',
  'plan.gateHint.standInGone': 'Kept in another scope: {names}. A stand-in is dated where it is defined: give it a “Gone on” day there, and this line clears.',
  'plan.gateHint.inScope': '{name} in {scope}',
  'plan.gateHint.gone': 'Some of what the plan names is no longer here. Remove the rows marked “no longer here” to clear this line.',
  'plan.goneElement': 'An element no longer here',
  'plan.goneDecision': 'A decision record no longer here',
  'plan.standInDates': 'Its dates are kept in {scope}, which defines it; set them there.',
  'plan.standInDatesSomewhere': 'Its dates are kept in the scope that defines it; set them there.',
  'plan.standInGoneOn': 'Gone on {day}, as {scope} says.',
  'plan.windowBackwards': 'To cannot be before From.',
  // Replace… (ADR-0010): the three inputs, and the words the gesture writes.
  'replace.title': 'Replace {name}',
  'replace.arrives': 'Replaced by',
  'replace.newApplication': 'A new application, in the image of this one',
  'replace.newName': '{name} (new)',
  'replace.existing': 'One that already exists',
  'replace.which': 'Which one',
  'replace.shape': 'What happens to it',
  'replace.goes': '{name} goes on cutover',
  'replace.stays': 'Part of it moves; {name} stays',
  'replace.also': 'Also retiring into it',
  'replace.alsoField': 'Another application that retires into it',
  'replace.shadowFrom': 'Shadow run from',
  'replace.cutover': 'Cutover',
  'replace.help': 'From the shadow run the new one is live and taps the old for its data; the interfaces still land on the old one until each is moved. On cutover the old one is gone, and the tap has closed the day before. Which interface moves when is set on the plan.',
  'replace.start': 'Start the plan',
  'replace.planTitle': 'Replace {from} with {to}',
  'replace.tap': 'shadow tap',
  'replace.shadowMilestone': 'Shadow run starts',
  'replace.cutoverMilestone': 'Cutover',
  'plan.template': `## Goal

## Scope

## Approach and phases

## Business case

{businessCase}

## Risks

## Rollback
`,

  // The checks. Each one names a contradiction, never staleness.
  'check.title': 'Where the dates disagree',
  'roadmap.deleteBody': 'The plan and its milestones go. The dates it set on applications stay as they are, and you can undo this.',
  'check.none': 'The dates agree with each other.',
  'check.retiresWithDependants': '{name} retires on {detail} with {count} connections still live.',
  'check.successorTooLate': 'What replaces {name} does not go live until after it is gone: {detail}.',
  'check.successorMissing': '{name} retires on {detail} and nothing is named to replace it.',
  'check.lineOutlivesEnd': 'The row “{name}” ({type}) is still valid after {detail} has been retired.',
  'check.planOverdue': '{name} was due to finish on {detail} and is still running.',
  'check.platformRetiresFirst': '{name} still stands on {detail} after it has been retired.',
  'check.impliedInterface': '{count} container interfaces between {name} and {detail} without an application interface.',
  'check.accept': 'Accept',
  'check.staleness': 'These say where the dates contradict each other. They cannot tell you a landscape is out of date.',
} as const

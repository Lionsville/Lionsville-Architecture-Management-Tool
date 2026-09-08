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
  'roadmap.plans': 'Plans',
  'roadmap.newPlan': 'New plan',
  'roadmap.newPlanTitle': 'What is the plan called?',
  'roadmap.noPlans': 'No plans yet.',
  'roadmap.planWindow': '{from} to {to}',
  'roadmap.planOpen': 'no end date',
  'roadmap.planUndated': 'not dated yet',
  'roadmap.owner': 'Owner',
  'roadmap.milestones': 'Milestones',
  'roadmap.touches': 'What it changes',
  'roadmap.restsOn': 'Decisions it rests on',
  'roadmap.status': 'Status',
  'roadmap.shift': 'Move by…',
  'roadmap.shiftDays': 'Days to move it, forwards or back',
  'roadmap.shiftHelp': 'Moves the window and every milestone, and the dates on what it introduces and retires. One step.',
  'roadmap.delete': 'Delete this plan',
  'roadmap.deleteConfirm': 'Delete “{name}”? The dates it set on applications stay as they are.',
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

  // The checks. Each one names a contradiction, never staleness.
  'check.title': 'What the dates disagree about',
  'check.none': 'The dates agree with each other.',
  'check.retiresWithDependants': '{name} retires on {detail} with {count} connections still live.',
  'check.successorTooLate': 'What replaces {name} does not go live until after it is gone: {detail}.',
  'check.successorMissing': '{name} retires on {detail} and nothing is named to replace it.',
  'check.lineOutlivesEnd': '“{name}” is still valid after {detail} has been retired.',
  'check.planOverdue': '{name} was due to finish on {detail} and is still running.',
  'check.staleness': 'These say where the dates contradict each other. They cannot tell you a landscape is out of date.',
} as const

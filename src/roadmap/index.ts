/**
 * The landscape on a time axis, and the plans over it (ADR-0009, ADR-0010).
 *
 * One module for the axis and for a plan's page: a plan IS a band on the axis,
 * and reading one always means asking what else is happening that month.
 */
export { fractionOf, monthsFrom, rangeOf, roadmapOf, spansFor, within } from './timeline'
export type { ElementTrack, PhaseSpan, Roadmap } from './timeline'
export { planBodyTemplate } from './planTemplate'
export { RoadmapPage } from './ui/RoadmapPage'
export type { RoadmapActions, RoadmapPageProps } from './ui/RoadmapPage'
export { PlanPage } from './ui/PlanPage'
export type { PlanActions, PlanPageProps } from './ui/PlanPage'
export { ReplaceDialog } from './ui/ReplaceDialog'
export type { ReplaceAnswer, ReplaceDialogProps } from './ui/ReplaceDialog'

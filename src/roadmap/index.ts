/**
 * The landscape on a time axis, and the plans over it (ADR-0009).
 *
 * One module rather than the two the record sketched: a plan and a timeline are
 * the same view, so the page that draws the axis is the page that reads a plan.
 */
export { fractionOf, monthsFrom, rangeOf, roadmapOf, spansFor } from './timeline'
export type { ElementTrack, PhaseSpan, Roadmap } from './timeline'
export { RoadmapPage } from './ui/RoadmapPage'
export type { RoadmapActions, RoadmapPageProps } from './ui/RoadmapPage'

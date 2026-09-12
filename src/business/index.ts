/**
 * The business layer: the four trees, and the arithmetic over them.
 *
 * ADR-0012 §4 gave the model an `actor` tree, a `step` tree, a `function` tree
 * and a `process`, and almost everything a page wants to know about them is
 * derived rather than stored — who is under what and how deep (`tree`), what
 * covers a capability and what it means when nothing does (`coverage`), and
 * where a journey's paths fork, rejoin and simply pass through (`lanes`).
 *
 * Pure at the root, the way `roadmap/` is, and for the same reason: a sheet is
 * *laid out* rather than dragged (§6), so what it draws is arithmetic over the
 * model and can be tested in node without a canvas. The page that draws it
 * lives in `ui/`.
 */
export { childrenOf, depthOf, descendantsOf, flatten, inOrder, wouldCycle } from './tree'
export { coverageFor, coverageOf } from './coverage'
export type { Coverage, FunctionCoverage } from './coverage'
export { journeyOf } from './lanes'
export type { Journey, Lane, LaneCell } from './lanes'
export { rootsOfKind, seedSheet } from './sheetDiagram'

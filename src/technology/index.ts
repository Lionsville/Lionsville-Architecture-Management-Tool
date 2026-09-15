/**
 * The physical view (ADR-0013): one platform, with what stands on it and
 * what passes through it, on a page.
 *
 * Pure at the root the way `business/` is — the arithmetic is the model's
 * (`model/technologyDiagram.ts`), because the agent asks for it too and
 * `agent` may not see this module — so what lives here is the page that
 * draws it, and the words it uses.
 */
export { TechnologyPage } from './ui/TechnologyPage'
export type { TechnologyPageProps } from './ui/TechnologyPage'

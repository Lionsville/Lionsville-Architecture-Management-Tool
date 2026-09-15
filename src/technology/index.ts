/**
 * The physical view (ADR-0013, redone): one platform, and what would be left
 * standing if it went, on a page.
 *
 * A report rather than a view kind: it is reached from the platform's own card
 * and from the finding that names it, and there is nothing to create — every
 * mark on it is derived from the rows, so opening it is the whole of making
 * it.
 *
 * Pure at the root the way `business/` is — the arithmetic is the model's
 * (`model/platformReport.ts`), because the agent asks for it too and `agent`
 * may not see this module — so what lives here is the page that draws it, and
 * the words it uses.
 */
export { PlatformReportPage } from './ui/PlatformReportPage'
export type { PlatformReportPageProps } from './ui/PlatformReportPage'
export { ServiceReportPage } from './ui/ServiceReportPage'
export type { ServiceReportPageProps } from './ui/ServiceReportPage'

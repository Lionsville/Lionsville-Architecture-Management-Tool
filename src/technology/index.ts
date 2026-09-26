// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

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
 *
 * Since ADR-0015 the layer has one view as well: the technology landscape,
 * laid out like the sheet and the map from `model/technologyLandscape.ts`,
 * with the same division — the arithmetic below, the page here.
 */
export { PlatformReportPage, ServiceReportPage } from './ui/ReportPage'
export type { PlatformReportPageProps, ServiceReportPageProps } from './ui/ReportPage'
/** The technology landscape (ADR-0015): the one view on this layer, laid out from the rows. */
export { TechnologyLandscapePage } from './ui/TechnologyLandscapePage'
export type { TechnologyLandscapePageProps } from './ui/TechnologyLandscapePage'

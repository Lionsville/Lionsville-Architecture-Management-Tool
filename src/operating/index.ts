// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The operating model (ADR-0036): the libraries it starts from, bringing them
 * in as one step, comparing what came in with them, the page's edits as
 * commands, and the page. The records themselves are the model's
 * (`model/operating.ts`); this is what is done with them.
 */
export * from './library'
export { LIBRARIES, libraryById } from './libraries'
export * from './bringIn'
export * from './compare'
export * from './edit'
export { OperatingModelPage } from './ui/OperatingModelPage'
export type { OperatingModelPageProps } from './ui/OperatingModelPage'

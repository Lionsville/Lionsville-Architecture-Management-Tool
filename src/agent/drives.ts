// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * Which calls drive (ADR-0019): the half of a driving session that reads the
 * tools. The other half, the session itself, is `driving.ts`, and the shell
 * draws its banner from it with the page; this half is asked by the handler
 * only, and arrives with it (`app/useAgentGateway.ts`).
 */
import { toolSpec } from './tools'
import type { ToolName } from './tools'

/** The see-tier tools that only look: a report is arithmetic, and starts nothing. */
const LOOKS: readonly string[] = ['diagram.inspect']

/** The drive-tier tools that only tell: where the app is, and that a session is over. */
const TELLS: readonly string[] = ['app.current', 'views.list', 'session.end']

/**
 * Does this call move the screen or change the model? Every write does, every
 * see-tool but the report does — a picture switches the view to take it — and
 * so does opening a scope or a page.
 */
export function drives(tool: ToolName): boolean {
  const spec = toolSpec(tool)
  if (spec.tier === 'read') return false
  if (spec.tier === 'see') return !LOOKS.includes(tool)
  if (spec.tier === 'drive') return !TELLS.includes(tool)
  return true
}

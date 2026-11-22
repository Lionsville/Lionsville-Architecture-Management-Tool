// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for a suite: the harness.
 *
 * The shell's render and its accessibility check, for a component test.
 *
 * A build composed from this one imports this entry and never the files behind
 * it (ADR-0022, amended), so those may move. Names only, each from the file
 * that holds it; `src/composed/SURFACE.txt` is what the whole offers.
 */
export { axeFindings } from '../../app/testing/axe'
export { renderShell } from '../../app/testing/renderShell'

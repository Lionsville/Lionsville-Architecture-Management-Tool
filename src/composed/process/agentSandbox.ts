// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for a process with no screen: the interpreter an agent's
 * script runs in.
 *
 * One name and nothing beside it (ADR-0051): every importer of an entry loads
 * all of it, and this one loads the interpreter. The thread that runs a script
 * imports it; the process that answers the door does not.
 *
 * A build composed from this one imports this entry and never the file behind
 * it (ADR-0022, amended), so that may move. `src/composed/SURFACE.txt` is what
 * the whole offers.
 */
export { quickjsSandbox } from '../../agent/code/quickjs'

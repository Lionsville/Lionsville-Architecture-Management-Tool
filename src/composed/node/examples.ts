// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for a process with a node under it: the examples.
 *
 * The examples as they ship, for a process with no screen: an example's
 * scopes, and one seeded into repositories.
 *
 * A build composed from this one imports this entry and never the files behind
 * it (ADR-0022, amended), so those may move. Names only, each from the file
 * that holds it; `src/composed/SURFACE.txt` is what the whole offers.
 */
export { SHIPPED, seedExample, shippedExample } from '../../platform/node/examples'

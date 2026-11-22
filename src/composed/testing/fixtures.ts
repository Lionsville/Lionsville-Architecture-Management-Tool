// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * The surface, for a suite: fixtures.
 *
 * A model made in a line, and a landscape generated.
 *
 * A build composed from this one imports this entry and never the files behind
 * it (ADR-0022, amended), so those may move. Names only, each from the file
 * that holds it; `src/composed/SURFACE.txt` is what the whole offers.
 */
export { connection, diagram, element, placement } from '../../model/testFixtures'
export { syntheticModel } from '../../model/testing/synthetic'

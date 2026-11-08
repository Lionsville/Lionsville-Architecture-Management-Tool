// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { BOUNDARY_PADDING, DEPLOYMENT_ROOM } from '../graph'
import { deploymentPadding } from './DeploymentLayer'

/** The name's room over a box, as the layer keeps it. */
const LABEL_ROOM = 18

describe('deploymentPadding', () => {
  it('pads an outer box further out than the one inside it', () => {
    expect(deploymentPadding(0, 1)).toBeGreaterThan(deploymentPadding(1, 1))
    expect(deploymentPadding(1, 2)).toBeGreaterThan(deploymentPadding(2, 2))
  })

  it('keeps the outer box and its name inside the application’s boundary, clear of its edge, however deep the nesting', () => {
    for (const deepest of [0, 1, 2, 4]) {
      expect(deploymentPadding(0, deepest) + LABEL_ROOM).toBeLessThanOrEqual(BOUNDARY_PADDING + DEPLOYMENT_ROOM - 50)
    }
  })
})

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { USER_DATA_NAME } from './userData'
import { PRODUCT_NAME } from './windowTitle'

describe('the userData folder name', () => {
  /**
   * Written out rather than derived from anything, which is the whole point:
   * an install made before the rename keeps its preferences here, and a build
   * that computes this from what the product is called today would not find
   * them. If this assertion fails, the change under it moved every existing
   * user's settings.
   */
  it('is the name the folders on disk were created under', () => {
    expect(USER_DATA_NAME).toBe('Lionsville Architecture Management Tool')
  })

  it('is not the product name, and does not follow it', () => {
    expect(USER_DATA_NAME).not.toBe(PRODUCT_NAME)
  })
})

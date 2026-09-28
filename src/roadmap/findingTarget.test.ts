// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import type { Finding } from '../model/checks'
import { findingTarget } from './findingTarget'

const finding = (over: Partial<Finding>): Finding => ({ kind: 'retiresWithDependants', subject: 'element', id: 'a', name: 'A', ...over })

describe('findingTarget', () => {
  it('opens the element or the plan a finding names, and a line at the element it starts from', () => {
    const relations = [{ id: 'l1', sourceId: 'from', targetId: 'to' }]
    expect(findingTarget(finding({}), relations)).toEqual({ page: 'element', id: 'a' })
    expect(findingTarget(finding({ subject: 'transition', id: 'tr-1' }), relations)).toEqual({ page: 'plan', id: 'tr-1' })
    expect(findingTarget(finding({ subject: 'relation', id: 'l1' }), relations)).toEqual({ page: 'element', id: 'from' })
    expect(findingTarget(finding({ subject: 'relation', id: 'gone' }), relations)).toBeUndefined()
  })
})

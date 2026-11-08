// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { fromArrays } from '../model/normalised'
import { emptyContent } from './scopeState'
import { summariseStep } from './stepSummary'

const before = fromArrays(emptyContent('Shop').model)
const element = { id: 'a', name: 'Billing', type: 'application' } as const

describe('summariseStep', () => {
  it('names the model\'s commands as summarise does, with the scope\'s own beside them left out', () => {
    expect(summariseStep({ type: 'element.create', element } as never, before).key).toBe('activity.elementAdded')
    const mixed = { type: 'transaction', commands: [{ type: 'scope.describe', patch: { activeDiagramId: 'x' } }, { type: 'element.create', element }] }
    expect(summariseStep(mixed as never, before)).toMatchObject({ key: 'activity.elementAdded', name: 'Billing' })
  })

  it('names a content that arrives whole, and a put back by the entry it puts back to', () => {
    expect(summariseStep({ type: 'scope.replace', content: emptyContent('Shop') }, before)).toEqual({ key: 'activity.scopeReplaced' })
    expect(summariseStep({ type: 'scope.replace', content: emptyContent('Shop'), putBack: { subject: 'Added Billing' } }, before))
      .toEqual({ key: 'activity.scopePutBack', name: 'Added Billing' })
  })

  it('names a step of pictures, and one of what the scope says about itself', () => {
    expect(summariseStep({ type: 'image.remove', name: 'logo.png' }, before)).toEqual({ key: 'activity.picturesChanged' })
    expect(summariseStep({ type: 'scope.describe', patch: { activeDiagramId: 'x' } }, before)).toEqual({ key: 'activity.projectSettings' })
  })
})

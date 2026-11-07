// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/** A numeric scale on an aspect, and a function rated on it (ADR-0046). */
import { describe, expect, it } from 'vitest'
import { aspectScale, aspectScalesRefusal, heatOf, onScale, ratingOn, ratingsRefusal, withRating } from './aspectScale'
import { apply, writesOf } from './reducer'
import { fromArrays } from './normalised'
import type { Command } from './commands'
import type { DesignElement } from './types'

const element = (id: string, over: Partial<DesignElement> = {}): DesignElement => ({
  id, name: id, kind: 'function', lifecycle: 'live', isManaged: false, aspects: {}, ...over,
})
const model = (...elements: DesignElement[]) => fromArrays({ name: 'Acme', diagrams: [], elements, relations: [] })
const landed = (at: ReturnType<typeof model>, command: Command) => {
  const result = apply(at, command)
  if (!result.ok) throw new Error(result.reason)
  return result
}

describe('a scale', () => {
  it('runs from 1 to 5 where nobody said another', () => {
    expect(aspectScale('maturity', ' Maturity ')).toEqual({ key: 'maturity', label: 'Maturity', min: 1, max: 5 })
    expect(aspectScale('risk', 'Risk', { min: 0, max: 3, code: 'RSK' })).toEqual({ key: 'risk', label: 'Risk', min: 0, max: 3, code: 'RSK' })
  })

  it('holds together, each aspect once', () => {
    expect(aspectScalesRefusal([aspectScale('a', 'A'), aspectScale('b', 'B')])).toBe(false)
    expect(aspectScalesRefusal([aspectScale('a', 'A'), aspectScale('a', 'B')])).toBe(true)
    expect(aspectScalesRefusal([aspectScale('a', '')])).toBe(true)
    expect(aspectScalesRefusal([aspectScale('a', 'A', { min: 5, max: 5 })])).toBe(true)
    expect(aspectScalesRefusal([aspectScale('a', 'A', { min: 1.5 })])).toBe(true)
    expect(aspectScalesRefusal([aspectScale('a', 'A', { max: 1000 })])).toBe(true)
  })

  it('reads a value off it, and one outside it as unrated, so narrowing loses nothing', () => {
    const scale = aspectScale('maturity', 'Maturity')
    expect(onScale(scale, 3)).toBe(true)
    expect(onScale(scale, 3.5)).toBe(false)
    expect(ratingOn({ ratings: { maturity: 4 } }, scale)).toBe(4)
    expect(ratingOn({ ratings: { maturity: 4 } }, { ...scale, max: 3 })).toBeUndefined()
    expect(ratingOn({}, scale)).toBeUndefined()
    expect(heatOf(scale, 1)).toBe(0)
    expect(heatOf(scale, 5)).toBe(1)
    expect(heatOf(scale, 3)).toBe(0.5)
  })

  it('is kept as the project\'s setting, refused when it does not hold together', () => {
    const scales = [aspectScale('maturity', 'Maturity')]
    const set = landed(model(), { type: 'project.settings', patch: { aspectScales: scales } })
    expect(set.model.aspectScales).toEqual(scales)
    expect(apply(model(), { type: 'project.settings', patch: { aspectScales: [aspectScale('a', '')] } })).toEqual({ ok: false, reason: 'command.badScale' })
    expect(landed(set.model, set.inverse).model.aspectScales).toBeUndefined()
  })
})

describe('a rating', () => {
  it('is set and taken away per aspect, and undo puts back what was there', () => {
    const start = model(element('fulfilment', { ratings: { importance: 2 } }))
    const rated = landed(start, { type: 'element.rate', id: 'fulfilment', aspect: 'maturity', value: 3 })
    expect(rated.model.elements.fulfilment.ratings).toEqual({ importance: 2, maturity: 3 })
    expect(landed(rated.model, rated.inverse).model.elements.fulfilment.ratings).toEqual({ importance: 2 })
    const taken = landed(rated.model, { type: 'element.rate', id: 'fulfilment', aspect: 'importance' })
    expect(taken.model.elements.fulfilment.ratings).toEqual({ maturity: 3 })
    expect(landed(taken.model, taken.inverse).model.elements.fulfilment.ratings).toEqual({ maturity: 3, importance: 2 })
  })

  it('leaves no empty map behind', () => {
    expect(withRating({ maturity: 3 }, 'maturity', undefined)).toBeUndefined()
    const rated = landed(model(element('fulfilment')), { type: 'element.rate', id: 'fulfilment', aspect: 'maturity', value: 3 })
    const gone = landed(rated.model, { type: 'element.rate', id: 'fulfilment', aspect: 'maturity' })
    expect('ratings' in gone.model.elements.fulfilment).toBe(false)
  })

  it('goes on a function and is a whole number, wherever it is written', () => {
    const start = model(element('billing', { kind: 'application' }), element('fulfilment'))
    expect(apply(start, { type: 'element.rate', id: 'billing', aspect: 'maturity', value: 3 })).toEqual({ ok: false, reason: 'command.badScale' })
    expect(apply(start, { type: 'element.rate', id: 'fulfilment', aspect: 'maturity', value: 3.5 })).toEqual({ ok: false, reason: 'command.badScale' })
    expect(apply(start, { type: 'element.update', id: 'billing', patch: { ratings: { maturity: 3 } } })).toEqual({ ok: false, reason: 'command.badScale' })
    expect(ratingsRefusal({ kind: 'function' })).toBe(false)
  })

  it('writes only its own aspect, so two people rating two aspects do not meet', () => {
    expect(writesOf({ type: 'element.rate', id: 'fulfilment', aspect: 'maturity', value: 3 })).toEqual(['element/fulfilment/ratings/maturity'])
  })
})

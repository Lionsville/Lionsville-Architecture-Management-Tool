// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * A drawing's content is one field. Applying a replacement and then its
 * inverse puts the earlier three back — including when there were none, and
 * when the replacement clears them. The write is one key.
 */
import { describe, expect, it } from 'vitest'
import type { DrawingContent } from '../types'
import { fromArrays } from '../normalised'
import { apply, writesOf } from '../reducer'
import type { Model } from '../normalised'

function random(seed: number) {
  let state = seed >>> 0
  const next = () => {
    state = (state + 0x6D2B79F5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const int = (below: number) => Math.floor(next() * below)
  const chance = (p: number) => next() < p
  return { int, chance }
}

function content(seed: number): DrawingContent | undefined {
  const r = random(seed)
  if (r.chance(0.25)) return undefined
  const links = Array.from({ length: r.int(3) }, (_, i) => ({
    shapeId: `s${i}`,
    elementId: `e${r.int(4)}`,
    area: { x: r.int(50), y: r.int(50), width: 10 + r.int(40), height: 10 + r.int(40) },
  }))
  return {
    xml: `<mxfile>${seed}<mxCell id="s0" link="element:e0"/></mxfile>`,
    ...(r.chance(0.5) ? { picture: `sha256:${seed.toString(16).padStart(4, '0')}` } : {}),
    links,
  }
}

function held(drawing: DrawingContent | undefined): Model {
  return fromArrays({
    name: 'Landscape',
    elements: [],
    relations: [],
    diagrams: [{
      id: 'ctx', kind: 'drawing', name: 'Context', members: [],
      ...(drawing ? { drawing } : {}),
    }],
  })
}

describe('a drawing\'s update and its inverse', () => {
  it('restores the earlier drawing, present or absent, and writes one key', () => {
    for (let seed = 1; seed <= 40; seed += 1) {
      const before = content(seed)
      const after = content(seed * 17 + 3)
      const model = held(before)
      const command = { type: 'diagram.update' as const, id: 'ctx', patch: { drawing: after } }
      expect(writesOf(command)).toEqual(['diagram/ctx/drawing'])
      const applied = apply(model, command)
      expect(applied.ok, `seed ${seed}`).toBe(true)
      if (!applied.ok) continue
      expect(applied.model.diagrams.ctx.drawing).toEqual(after)
      const undone = apply(applied.model, applied.inverse)
      expect(undone.ok, `seed ${seed} inverse`).toBe(true)
      expect(undone.ok && undone.model).toStrictEqual(model)
    }
  })

  it('keeps the other fields of a diagram patch on their own keys', () => {
    expect(writesOf({
      type: 'diagram.update', id: 'ctx', patch: { asOf: '2026-01-01', drawing: { xml: '<x/>', links: [] } },
    })).toEqual(['diagram/ctx/asOf', 'diagram/ctx/drawing'])
  })
})

// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

import { describe, expect, it } from 'vitest'
import { hostCommands, useCommands } from './technologyWrites'
import { element } from './testFixtures'
import type { Relation } from './types'

const held = {
  elements: [element('s', { kind: 'platformService', name: 'S' })],
  relations: [
    { id: 'u', type: 'uses', sourceId: 'a', targetId: 's' },
    { id: 'h', type: 'hostedOn', sourceId: 'a', targetId: 'p' },
  ] as Relation[],
}
const make = { rowId: () => 'new' }

describe('one use, as commands', () => {
  it('writes nothing for what is already said', () => expect(useCommands(held, make, 'a', 's', true)).toEqual([]))
  it('takes the row off', () => expect(useCommands(held, make, 'a', 's', false)).toEqual([{ type: 'relation.delete', id: 'u' }]))
  it('brings the stand-in first, in the same step', () => {
    const standIn = element('x', { kind: 'platform', name: 'X' })
    expect(useCommands(held, { ...make, standIn }, 'a', 'x', true).map((one) => one.type)).toEqual(['element.create', 'relation.create'])
  })
})

describe('where it runs, as commands', () => {
  it('moves the row it has', () => expect(hostCommands(held, make, 'a', 'q')).toEqual([{ type: 'relation.update', id: 'h', patch: { targetId: 'q' } }]))
  it('makes one where there is none', () => expect(hostCommands(held, make, 'b', 'q')[0]).toMatchObject({ type: 'relation.create' }))
  it('takes it away', () => expect(hostCommands(held, make, 'a', undefined)).toEqual([{ type: 'relation.delete', id: 'h' }]))
})

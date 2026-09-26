// SPDX-License-Identifier: AGPL-3.0-only
// SPDX-FileCopyrightText: 2024–2026 Lionsville Group BV

/**
 * What a command says it may carry (ADR-0028), and the one writer holding it
 * to that: a patch naming a key outside its list is refused, the guard is run
 * where it is asked for, and what a command writes is read off its entry.
 */
import { describe, expect, it } from 'vitest'
import type { Command } from '../commands'
import { replacement } from '../commands'
import { fromArrays, toArrays } from '../normalised'
import type { Model } from '../normalised'
import { apply, applyGuarded, EVERYTHING, writesOf } from '../reducer'
import { connection, diagram, element } from '../testFixtures'
import type { CommandEntry, CommandType } from './handler'
import { COMMAND_TABLE } from './table'

function landscape(): Model {
  return fromArrays({
    name: 'Design',
    description: 'What this is.',
    elements: [
      element('crews', { name: 'Crews', vendor: 'Acme', description: 'Plans crews.' }),
      element('depot', { name: 'Depot', ref: 'acme/depots', lifecycle: 'live' }),
    ],
    relations: [connection('c1', 'crews', 'depot')],
    diagrams: [diagram('d1', { placements: [{ id: 'crews', x: 0, y: 0 }] })],
    decisions: [{ id: 'adr-1', number: 1, title: 'Use it', status: 'proposed', date: '2026-09-01', body: '', signers: [] }],
  })
}

describe('a command without a descriptor', () => {
  it('does not compile', () => {
    const entry = COMMAND_TABLE['diagram.delete']
    // @ts-expect-error — an entry is its descriptor and its apply; an apply alone is not one
    const bare: CommandEntry<'diagram.delete'> = { apply: entry.apply }
    // @ts-expect-error — and a patch-carrying command without the keys its patch may name is not one either
    const unlisted: CommandEntry<'diagram.update'> = { ...COMMAND_TABLE['diagram.update'], patch: undefined }
    expect([bare, unlisted]).toHaveLength(2)
  })

  it('names, for every command, exactly the fields a door must find on it', () => {
    const carries = Object.fromEntries(
      (Object.keys(COMMAND_TABLE) as CommandType[]).map((type) => [type, Object.keys(COMMAND_TABLE[type].carries).sort()]),
    )
    expect(carries['element.update']).toEqual(['id', 'patch'])
    expect(carries['member.set']).toEqual(['diagramId', 'members'])
    expect(carries.restore).toEqual(['commands', 'restored'])
    // `at` and the meta are optional and never a command's own.
    for (const fields of Object.values(carries)) {
      expect(fields).not.toContain('at')
      expect(fields).not.toContain('coalesce')
      expect(fields).not.toContain('type')
    }
    // Every command that carries a patch says which keys it may carry.
    for (const type of Object.keys(COMMAND_TABLE) as CommandType[]) {
      const entry = COMMAND_TABLE[type] as { carries: object; patch?: { keys: object } }
      expect(Boolean(entry.patch), type).toBe('patch' in entry.carries)
    }
  })
})

describe('a patch holds to its keys', () => {
  it('refuses a key an element does not have, and changes nothing', () => {
    const held = landscape()
    const result = apply(held, { type: 'element.update', id: 'crews', patch: { name: 'Crew planning', colour: 'red' } as never })
    expect(result).toEqual({ ok: false, reason: 'command.notAField' })
  })

  it('refuses a settings patch carrying one of the model\'s own lists, which used to replace it', () => {
    const held = landscape()
    for (const key of ['elements', 'relations', 'diagrams', 'order', 'decisions']) {
      const patch = { name: 'Renamed', [key]: {} } as never
      expect(apply(held, { type: 'project.settings', patch })).toEqual({ ok: false, reason: 'command.notAField' })
    }
    // …and still takes the four it may carry.
    const renamed = apply(held, { type: 'project.settings', patch: { name: 'Renamed', description: undefined } })
    expect(renamed.ok && renamed.model.name).toBe('Renamed')
    expect(renamed.ok && toArrays(renamed.model).elements).toHaveLength(2)
  })

  it('refuses a key on the board, the view, a relation and a record', () => {
    const held = landscape()
    const bad: Command[] = [
      { type: 'board.set', diagramId: 'd1', patch: { members: {} } as never },
      { type: 'diagram.update', id: 'd1', patch: { nodes: {} } as never },
      { type: 'relation.update', id: 'c1', patch: { sourceId: 'crews', weight: 3 } as never },
      { type: 'decision.update', id: 'adr-1', patch: { status: 'accepted', locked: true } as never },
    ]
    for (const command of bad) expect(apply(held, command), command.type).toEqual({ ok: false, reason: 'command.notAField' })
  })

  it('refuses a key off the prototype, and a patch that is not an object', () => {
    const held = landscape()
    const hostile = JSON.parse('{"__proto__": {"polluted": true}, "name": "X"}') as never
    expect(apply(held, { type: 'element.update', id: 'crews', patch: hostile })).toEqual({ ok: false, reason: 'command.notAField' })
    expect(apply(held, { type: 'element.update', id: 'crews', patch: null as never })).toEqual({ ok: false, reason: 'command.notAField' })
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })

  it('takes the whole transaction down with a key refused inside it', () => {
    const held = landscape()
    const result = apply(held, {
      type: 'transaction',
      commands: [
        { type: 'element.update', id: 'crews', patch: { name: 'Crew planning' } },
        { type: 'element.update', id: 'crews', patch: { bogus: 1 } as never },
      ],
    })
    expect(result).toEqual({ ok: false, reason: 'command.notAField' })
  })

  it('lets through a key that only says what the record already says, as a whole row\'s replacement does', () => {
    // A field an older file left on a row: not the model's, but the row's, and
    // a replacement names every key the row holds.
    const held = fromArrays({
      name: 'Design',
      elements: [{ ...element('crews'), legacy: 'kept' } as never],
      relations: [], diagrams: [diagram('d1')],
    })
    const row = held.elements.crews
    const result = apply(held, { type: 'element.update', id: 'crews', patch: replacement(row, { ...row, name: 'Crew planning' }) })
    expect(result.ok && result.model.elements.crews.name).toBe('Crew planning')
    // The id is the record's key, restated and never changed.
    expect(apply(held, { type: 'element.update', id: 'crews', patch: { id: 'crews' } }).ok).toBe(true)
    expect(apply(held, { type: 'element.update', id: 'crews', patch: { id: 'other' } }))
      .toEqual({ ok: false, reason: 'command.notAField' })
    // Writing the stray field, rather than restating it, is refused.
    expect(apply(held, { type: 'element.update', id: 'crews', patch: { legacy: 'changed' } as never }))
      .toEqual({ ok: false, reason: 'command.notAField' })
  })

  it('answers a patch on something gone as gone, not as a key refused', () => {
    expect(apply(landscape(), { type: 'element.update', id: 'nope', patch: { name: 'X' } }))
      .toEqual({ ok: false, reason: 'command.gone' })
  })
})

describe('the guard, where the writer asks for it', () => {
  const writeOwnerDetail: Command = { type: 'element.update', id: 'depot', patch: { vendor: 'Other' } }

  it('refuses the owner\'s detail, a cache or the description written on a stand-in', () => {
    const held = landscape()
    expect(applyGuarded(held, writeOwnerDetail)).toEqual({ ok: false, reason: 'command.ownedElsewhere' })
    expect(applyGuarded(held, { type: 'element.update', id: 'depot', patch: { name: 'Mine now' } }))
      .toEqual({ ok: false, reason: 'command.ownedElsewhere' })
    expect(applyGuarded(held, { type: 'element.update', id: 'depot', patch: { description: 'Ours.' } }))
      .toEqual({ ok: false, reason: 'command.ownedElsewhere' })
    // At any depth of a transaction.
    expect(applyGuarded(held, { type: 'transaction', commands: [{ type: 'transaction', commands: [writeOwnerDetail] }] }))
      .toEqual({ ok: false, reason: 'command.ownedElsewhere' })
  })

  it('lets through what is this scope\'s: a definition, a stand-in\'s presentation, and a value restated', () => {
    const held = landscape()
    expect(applyGuarded(held, { type: 'element.update', id: 'crews', patch: { vendor: 'Other' } }).ok).toBe(true)
    expect(applyGuarded(held, { type: 'element.update', id: 'depot', patch: { accentColor: '#123456' } }).ok).toBe(true)
    expect(applyGuarded(held, { type: 'element.update', id: 'depot', patch: { name: 'Depot', lifecycle: 'live' } }).ok).toBe(true)
  })

  it('lets a link be undone: the ref taken off leaves a definition, whose fields are its own', () => {
    const held = landscape()
    const linked = applyGuarded(held, { type: 'element.link', id: 'crews', name: 'Crews', ref: 'acme/other' })
    expect(linked.ok).toBe(true)
    if (!linked.ok) return
    const undone = applyGuarded(linked.model, linked.inverse)
    expect(undone.ok && undone.model).toStrictEqual(held)
  })

  it('judges each command against the model as it stands when that command lands', () => {
    // Linked in the first command, written in the second: a stand-in by then.
    const held = landscape()
    const result = applyGuarded(held, {
      type: 'transaction',
      commands: [
        { type: 'element.link', id: 'crews', name: 'Crews', ref: 'acme/other' },
        { type: 'element.update', id: 'crews', patch: { vendor: 'Other' } },
      ],
    })
    expect(result).toEqual({ ok: false, reason: 'command.ownedElsewhere' })
  })

  it('is not run by apply, whose callers asked before they built the command', () => {
    expect(apply(landscape(), writeOwnerDetail).ok).toBe(true)
  })
})

describe('what a command writes', () => {
  it('names the fields a patch names, one level into an object, and the record for a delete', () => {
    expect(writesOf({ type: 'element.update', id: 'crews', patch: { name: 'X', aspects: { cost: { status: 'atRisk' }, risk: { status: 'managed' } } } }))
      .toEqual(['element/crews/name', 'element/crews/aspects/cost', 'element/crews/aspects/risk'])
    expect(writesOf({ type: 'element.update', id: 'crews', patch: {} })).toEqual(['element/crews'])
    expect(writesOf({ type: 'element.delete', id: 'crews' })).toEqual(['element/crews'])
    expect(writesOf({ type: 'member.remove', diagramId: 'd1', elementIds: ['crews'] }))
      .toEqual(['diagram/d1/member/crews', 'diagram/d1/node/crews'])
    expect(writesOf({ type: 'project.settings', patch: { name: 'X' } })).toEqual(['project/name'])
  })

  it('answers a transaction with its commands\', and anything at all for a type it does not know', () => {
    expect(writesOf({
      type: 'transaction',
      commands: [
        { type: 'diagram.rename', id: 'd1', name: 'X' },
        { type: 'nonsense' } as never,
      ],
    })).toEqual(['diagram/d1/name', EVERYTHING])
    expect(writesOf({ type: 'nonsense' } as never)).toBeUndefined()
    expect(writesOf({ type: 'constructor' } as never)).toBeUndefined()
  })
})
